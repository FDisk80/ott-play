//! The hook owns only WM_SIZING. Snap, maximize and fullscreen geometry remain OS-owned.
use super::geometry::{
    constrain, tracking_after_chain, Edge, Insets, Limits, Rect, TrackingBounds,
};
use std::ffi::c_void;
type Hwnd = *mut c_void;
type Proc = unsafe extern "system" fn(Hwnd, u32, usize, isize, usize, usize) -> isize;
const ID: usize = 0x4f545441;
const WM_SIZING: u32 = 0x0214;
const WM_NCDESTROY: u32 = 0x0082;
const WM_GETMINMAXINFO: u32 = 0x0024;
const WM_DPICHANGED: u32 = 0x02E0;
const WM_DISPLAYCHANGE: u32 = 0x007E;
#[repr(C)]
#[derive(Default, Clone, Copy)]
struct Point {
    x: i32,
    y: i32,
}
#[repr(C)]
#[derive(Default)]
struct MinMax {
    reserved: Point,
    max_size: Point,
    max_position: Point,
    min_track: Point,
    max_track: Point,
}
#[repr(C)]
struct Monitor {
    size: u32,
    monitor: Rect,
    work: Rect,
    flags: u32,
}
#[link(name = "comctl32")]
extern "system" {
    fn SetWindowSubclass(w: Hwnd, p: Option<Proc>, id: usize, data: usize) -> i32;
    fn GetWindowSubclass(w: Hwnd, p: Option<Proc>, id: usize, data: *mut usize) -> i32;
    fn RemoveWindowSubclass(w: Hwnd, p: Option<Proc>, id: usize) -> i32;
    fn DefSubclassProc(w: Hwnd, message: u32, wparam: usize, lparam: isize) -> isize;
}
#[link(name = "user32")]
extern "system" {
    fn GetWindowRect(w: Hwnd, r: *mut Rect) -> i32;
    fn GetClientRect(w: Hwnd, r: *mut Rect) -> i32;
    fn IsZoomed(w: Hwnd) -> i32;
    fn IsIconic(w: Hwnd) -> i32;
    fn MonitorFromWindow(w: Hwnd, flags: u32) -> *mut c_void;
    fn GetMonitorInfoW(m: *mut c_void, info: *mut Monitor) -> i32;
}
struct State {
    enabled: bool,
    bounds: Option<TrackingBounds>,
}
fn empty_rect() -> Rect {
    Rect {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    }
}
unsafe fn ordinary(w: Hwnd) -> bool {
    if IsZoomed(w) != 0 || IsIconic(w) != 0 {
        return false;
    }
    let mut rect = empty_rect();
    let mut info = Monitor {
        size: std::mem::size_of::<Monitor>() as u32,
        monitor: empty_rect(),
        work: empty_rect(),
        flags: 0,
    };
    // A full-monitor borderless window is conservatively not an interactive resize target.
    GetWindowRect(w, &mut rect) != 0
        && GetMonitorInfoW(MonitorFromWindow(w, 2), &mut info) != 0
        && rect != info.monitor
}
fn tracking(bounds: &MinMax) -> TrackingBounds {
    TrackingBounds {
        min_width: bounds.min_track.x,
        min_height: bounds.min_track.y,
        max_width: bounds.max_track.x,
        max_height: bounds.max_track.y,
    }
}
unsafe fn geometry(w: Hwnd, bounds: TrackingBounds) -> Option<(Insets, Limits)> {
    let mut outer = empty_rect();
    let mut inner = empty_rect();
    if GetWindowRect(w, &mut outer) == 0 || GetClientRect(w, &mut inner) == 0 {
        return None;
    }
    let horizontal = u32::try_from(
        i64::from(outer.right) - i64::from(outer.left) - i64::from(inner.right)
            + i64::from(inner.left),
    )
    .ok()?;
    let vertical = u32::try_from(
        i64::from(outer.bottom) - i64::from(outer.top) - i64::from(inner.bottom)
            + i64::from(inner.top),
    )
    .ok()?;
    let insets = Insets {
        horizontal,
        vertical,
    };
    Some((insets, bounds.content_limits(insets)?))
}
unsafe extern "system" fn sizing(
    w: Hwnd,
    message: u32,
    wparam: usize,
    lparam: isize,
    _id: usize,
    data: usize,
) -> isize {
    if message == WM_NCDESTROY {
        RemoveWindowSubclass(w, Some(sizing), ID);
        drop(Box::from_raw(data as *mut State));
        return DefSubclassProc(w, message, wparam, lparam);
    }
    if message == WM_GETMINMAXINFO && lparam != 0 {
        // The OS initializes this real message. Tao changes configured limits
        // only and deliberately does not forward to DefWindowProc. Capture
        // after chaining so unspecified limits retain the original OS values.
        let mut result = 0;
        let bounds = tracking_after_chain(tracking(&*(lparam as *const MinMax)), |bounds| {
            result = DefSubclassProc(w, message, wparam, lparam);
            *bounds = tracking(&*(lparam as *const MinMax));
        });
        (*(data as *mut State)).bounds = bounds;
        return result;
    }
    if message == WM_DPICHANGED || message == WM_DISPLAYCHANGE {
        // Never use a previous monitor/DPI's limits. A subsequent real
        // WM_GETMINMAXINFO (including a nested one) supplies fresh bounds.
        (*(data as *mut State)).bounds = None;
    }
    if message == WM_SIZING && lparam != 0 && (*(data as *const State)).enabled && ordinary(w) {
        if let (Some(edge), Some((insets, limits))) = (
            Edge::from_native(wparam),
            (*(data as *const State))
                .bounds
                .and_then(|bounds| geometry(w, bounds)),
        ) {
            if let Some(rect) = constrain(*(lparam as *const Rect), edge, insets, limits) {
                *(lparam as *mut Rect) = rect;
                return 1;
            }
        }
    }
    DefSubclassProc(w, message, wparam, lparam)
}
/// Must run on the native window thread. Hook state is released at WM_NCDESTROY.
pub fn apply(window: &tauri::Window, enabled: Option<bool>) -> Result<(bool, bool), String> {
    let w = window.hwnd().map_err(|e| e.to_string())?.0 as Hwnd;
    if w.is_null() {
        return Err("Native window unavailable".into());
    }
    unsafe {
        let mut data = 0usize;
        if GetWindowSubclass(w, Some(sizing), ID, &mut data) == 0 {
            let pointer = Box::into_raw(Box::new(State {
                enabled: false,
                bounds: None,
            }));
            if SetWindowSubclass(w, Some(sizing), ID, pointer as usize) == 0 {
                drop(Box::from_raw(pointer));
                return Err("Native aspect hook unavailable".into());
            }
            data = pointer as usize;
        }
        if let Some(value) = enabled {
            (*(data as *mut State)).enabled = value;
        }
        let mut confirmed = 0usize;
        if GetWindowSubclass(w, Some(sizing), ID, &mut confirmed) == 0 || confirmed != data {
            return Err("Native aspect hook readback failed".into());
        }
        let enabled = (*(data as *const State)).enabled;
        Ok((enabled, enabled && ordinary(w)))
    }
}
