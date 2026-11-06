use crate::{
  dpi::{LogicalPosition, LogicalSize, PhysicalPosition},
  error::ExternalError,
  window::WindowSizeConstraints,
};
use gtk::{
  gdk::{
    self,
    prelude::{DeviceExt, SeatExt},
    Display,
  },
  glib::{self},
  prelude::*,
};
use std::{cell::RefCell, rc::Rc};

#[inline]
pub fn cursor_position(is_wayland: bool) -> Result<PhysicalPosition<f64>, ExternalError> {
  if is_wayland {
    Ok((0, 0).into())
  } else {
    Display::default()
      .map(|d| {
        (
          d.default_seat().and_then(|s| s.pointer()),
          d.default_group(),
        )
      })
      .map(|(p, g)| {
        p.map(|p| {
          let (_, x, y) = p.position_double();
          LogicalPosition::new(x, y).to_physical(g.scale_factor() as _)
        })
      })
      .map(|p| p.ok_or(ExternalError::Os(os_error!(super::OsError))))
      .ok_or(ExternalError::Os(os_error!(super::OsError)))?
  }
}

pub fn set_size_constraints<W: GtkWindowExt + WidgetExt>(
  window: &W,
  constraints: WindowSizeConstraints,
) {
  let window = window.upcast_ref::<gtk::Window>();
  let state = match geometry_state(window) {
    Some(state) => state,
    None => {
      let state = Rc::new(RefCell::new(GeometryState {
        constraints,
        aspect: AspectState::default(),
        observed: false,
        applied: None,
      }));
      // This private key always owns this exact type, on GTK's main thread.
      unsafe { window.set_data(GEOMETRY_STATE, state.clone()) };
      state
    }
  };
  state.borrow_mut().constraints = constraints;
  publish_geometry(window, &state, true, true);
}

const GEOMETRY_STATE: &str = "tao-x11-geometry-state-v1";

#[derive(Clone, Copy, Default)]
struct AspectState {
  enabled: bool,
  fullscreen: Option<bool>,
  maximized: Option<bool>,
}

impl AspectState {
  fn active(self, native: gdk::WindowState, resizable: bool) -> bool {
    self.enabled
      && resizable
      && self.fullscreen.is_none()
      && self.maximized.is_none()
      && !native.intersects(
        gdk::WindowState::FULLSCREEN | gdk::WindowState::MAXIMIZED | gdk::WindowState::TILED,
      )
  }

  fn observe(&mut self, changed: gdk::WindowState, native: gdk::WindowState) {
    for (flag, pending) in [
      (gdk::WindowState::FULLSCREEN, &mut self.fullscreen),
      (gdk::WindowState::MAXIMIZED, &mut self.maximized),
    ] {
      if changed.contains(flag) && *pending == Some(native.contains(flag)) {
        *pending = None;
      }
    }
  }
}

struct GeometryState {
  constraints: WindowSizeConstraints,
  aspect: AspectState,
  observed: bool,
  applied: Option<bool>,
}

fn geometry_state(window: &gtk::Window) -> Option<Rc<RefCell<GeometryState>>> {
  // Clone the owner before any GTK call; signal reentry never holds a qdata borrow.
  unsafe {
    window
      .data::<Rc<RefCell<GeometryState>>>(GEOMETRY_STATE)
      .map(|state| state.as_ref().clone())
  }
}

fn native_state(window: &gtk::Window) -> gdk::WindowState {
  window
    .window()
    .map(|native| native.state())
    .unwrap_or_else(gdk::WindowState::empty)
}

fn publish_geometry(
  window: &gtk::Window,
  state: &Rc<RefCell<GeometryState>>,
  force: bool,
  synchronous: bool,
) {
  let (constraints, active, observed) = {
    let mut state = state.borrow_mut();
    let active = state
      .aspect
      .active(native_state(window), window.is_resizable());
    if !force && state.applied == Some(active) {
      return;
    }
    state.applied = Some(active);
    (state.constraints, active, state.observed)
  };
  let mut geom_mask = gdk::WindowHints::empty();
  if constraints.has_min() {
    geom_mask |= gdk::WindowHints::MIN_SIZE;
  }
  if constraints.has_max() {
    geom_mask |= gdk::WindowHints::MAX_SIZE;
  }
  if active {
    geom_mask |= gdk::WindowHints::ASPECT;
  }

  let scale_factor = window.scale_factor() as f64;

  let min_size: LogicalSize<i32> = constraints.min_size_logical(scale_factor);
  let max_size: LogicalSize<i32> = constraints.max_size_logical(scale_factor);

  let picky_none: Option<&gtk::Window> = None;
  window.set_geometry_hints(
    picky_none,
    Some(&gdk::Geometry::new(
      min_size.width,
      min_size.height,
      max_size.width,
      max_size.height,
      0,
      0,
      0,
      0,
      if active { 16.0 / 9.0 } else { 0.0 },
      if active { 16.0 / 9.0 } else { 0.0 },
      gdk::Gravity::Center,
    )),
    geom_mask,
  );
  if observed && synchronous {
    // Enabling and pre-transition barriers may apply GTK's pending layout.
    // Disabling and signal callbacks must leave it queued: a window-state
    // signal runs before GTK updates its own flags and consumes restored sizes.
    // Flushing there can resize the window using its old fullscreen allocation.
    #[allow(deprecated)]
    window.check_resize();
  }
}

/// Suspend before the native request, not after its first configure. Only the
/// matching state event may retire this barrier; an unrelated focus event cannot
/// re-arm the ratio while a fullscreen/maximize request is still pending.
/// If a WM ignores/coalesces the request without a state event, remain inactive;
/// a timeout or a passive query cannot prove the native transition is complete.
pub(crate) fn aspect_transition<W: GtkWindowExt + WidgetExt>(
  window: &W,
  flag: gdk::WindowState,
  enabled: bool,
) {
  let window = window.upcast_ref::<gtk::Window>();
  let Some(state) = geometry_state(window) else {
    return;
  };
  {
    let mut state = state.borrow_mut();
    let pending = if flag == gdk::WindowState::FULLSCREEN {
      &mut state.aspect.fullscreen
    } else {
      &mut state.aspect.maximized
    };
    if pending.is_some() || native_state(window).contains(flag) != enabled {
      *pending = Some(enabled);
    }
  }
  // A callback may have queued these same hints without flushing them yet.
  // Bypass that cache before issuing the native transition request.
  publish_geometry(window, &state, true, true);
}

pub(crate) fn gtk_window_aspect_lock(
  window: &gtk::ApplicationWindow,
  enabled: Option<bool>,
) -> Result<Option<(bool, bool)>, String> {
  let window = window.upcast_ref::<gtk::Window>();
  if !cfg!(feature = "x11") || !window.display().backend().is_x11() {
    // GTK3 Wayland retains ASPECT during fixed-state configure processing. Its
    // missing preconfigure policy must not be replaced with a late resize loop.
    return Ok(None);
  }
  let Some(state) = geometry_state(window) else {
    return Ok(None);
  };
  // Capture native state before changing the requested policy or installing
  // observers. An unavailable snapshot must never turn into guessed hints.
  let original = if enabled.is_some() {
    Some(x11_geometry(window, None)?)
  } else {
    None
  };
  if enabled.is_some() && !state.borrow().observed {
    {
      let native = native_state(window);
      let mut state = state.borrow_mut();
      state.observed = true;
      state.aspect.observe(
        gdk::WindowState::FULLSCREEN | gdk::WindowState::MAXIMIZED,
        native,
      );
    }
    window.connect_window_state_event(|window, event| {
      if let Some(state) = geometry_state(window) {
        let native = native_state(window);
        state
          .borrow_mut()
          .aspect
          .observe(event.changed_mask(), native);
        publish_geometry(window, &state, false, false);
      }
      glib::Propagation::Proceed
    });
    window.connect_resizable_notify(|window| {
      if let Some(state) = geometry_state(window) {
        publish_geometry(window, &state, false, false);
      }
    });
    window.connect_scale_factor_notify(|window| {
      if let Some(state) = geometry_state(window) {
        publish_geometry(window, &state, true, false);
      }
    });
  }
  let previous = state.borrow().aspect.enabled;
  if let Some(enabled) = enabled {
    state.borrow_mut().aspect.enabled = enabled;
    // OFF changes hints only; it must not flush an unrelated pending resize.
    publish_geometry(window, &state, true, enabled);
  }
  let aspect = state.borrow().aspect;
  let expected = aspect.active(native_state(window), window.is_resizable());
  // GTK may retain its previous hint cache across a deferred configure. Keep
  // both explicit SETs authoritative without depending on a cache-flush hack.
  let publication = if enabled.is_some() {
    x11_publish_aspect(window, expected)
  } else {
    x11_aspect(window)
  };
  let actual = publication.and_then(|actual| {
    if enabled.is_some() && actual != Some(expected) {
      Err("GTK did not publish the requested native aspect constraint".into())
    } else {
      Ok(actual)
    }
  });
  let actual = match actual {
    Ok(actual) => actual,
    Err(error) => {
      if let Some(original) = original {
        // Restore policy and hints without flushing layout, including after a
        // failed OFF. Geometry already changed by a WM is not rolled back.
        state.borrow_mut().aspect.enabled = previous;
        publish_geometry(window, &state, true, false);
        if let Err(restore_error) = x11_restore_aspect(window, &original) {
          return Err(format!("{error}; restoring native geometry hints failed: {restore_error}"));
        }
      }
      return Err(error);
    }
  };
  // A passive read does not publish hints, normalize size, or infer the native
  // constraint from our preference. A mismatched/foreign hint is never active.
  Ok(Some((aspect.enabled, expected && actual == Some(true))))
}

#[cfg(feature = "x11")]
type NativeGeometry = Vec<std::os::raw::c_long>;

#[cfg(not(feature = "x11"))]
struct NativeGeometry;

#[cfg(feature = "x11")]
fn x11_geometry(
  window: &gtk::Window,
  replacement: Option<&[std::os::raw::c_long]>,
) -> Result<NativeGeometry, String> {
  use x11_dl::xlib;

  if replacement.is_some_and(|words| !matches!(words.len(), 15 | 18)) {
    return Err("Invalid native X11 geometry hints length".into());
  }
  let native = window.window().ok_or("Native window is not realized")?;
  let display = window.display();
  let xlib = xlib::Xlib::open().map_err(|_| "X11 hints access unavailable")?;
  // XGet/SetWMNormalHints mask unknown flag bits and clear inactive fields.
  // Preserve the complete ICCCM property instead, using Xlib's native-long
  // storage for format-32 values. Missing or malformed properties fail closed.
  // This remains the same GeometryState owner and GTK display/error trap.
  unsafe {
    let gd = display.as_ptr() as *mut gdk_x11_sys::GdkX11Display;
    let xdisplay = gdk_x11_sys::gdk_x11_display_get_xdisplay(gd);
    let xid =
      gdk_x11_sys::gdk_x11_window_get_xid(native.as_ptr() as *mut gdk_x11_sys::GdkX11Window);
    if xdisplay.is_null() || xid == 0 {
      return Err("Native X11 window is unavailable".into());
    }
    let mut actual_type = 0;
    let mut actual_format = 0;
    let mut count = 0;
    let mut remaining = 0;
    let mut data = std::ptr::null_mut();
    gdk_x11_sys::gdk_x11_display_error_trap_push(gd);
    if let Some(words) = replacement {
      (xlib.XChangeProperty)(
        xdisplay.cast(), xid, xlib::XA_WM_NORMAL_HINTS, xlib::XA_WM_SIZE_HINTS,
        32, xlib::PropModeReplace, words.as_ptr().cast(), words.len() as i32,
      );
    }
    let status = (xlib.XGetWindowProperty)(
      xdisplay.cast(), xid, xlib::XA_WM_NORMAL_HINTS, 0, 18, xlib::False,
      xlib::AnyPropertyType as _, &mut actual_type, &mut actual_format,
      &mut count, &mut remaining, &mut data,
    );
    let result: Result<NativeGeometry, &'static str> = if status != xlib::Success as _ {
      Err("Native X11 geometry hints are unavailable")
    } else if actual_type == 0 {
      Err("Native X11 geometry hints are unavailable")
    } else if actual_type != xlib::XA_WM_SIZE_HINTS || actual_format != 32
      || !matches!(count, 15 | 18) || remaining != 0 || data.is_null()
    {
      Err("Invalid native X11 geometry hints property")
    } else {
      Ok(std::slice::from_raw_parts(data.cast::<std::os::raw::c_long>(), count as usize)
        .iter().map(|word| *word as u32 as std::os::raw::c_long).collect())
    };
    if !data.is_null() {
      (xlib.XFree)(data.cast());
    }
    let error = gdk_x11_sys::gdk_x11_display_error_trap_pop(gd);
    if error != 0 {
      return Err("Native X11 geometry hints request failed".into());
    }
    let words = result.map_err(str::to_owned)?;
    if let Some(requested) = replacement {
      if words.as_slice() != requested {
        return Err("Native X11 geometry hints did not match the requested update".into());
      }
    }
    Ok(words)
  }
}

#[cfg(not(feature = "x11"))]
fn x11_geometry(
  _window: &gtk::Window,
  _replacement: Option<&[std::os::raw::c_long]>,
) -> Result<NativeGeometry, String> {
  Err("X11 support is unavailable".into())
}

#[cfg(feature = "x11")]
fn native_aspect(words: &[std::os::raw::c_long]) -> Option<bool> {
  if words[0] & x11_dl::xlib::PAspect == 0 {
    return Some(false);
  }
  let exact = |x: std::os::raw::c_long, y: std::os::raw::c_long| {
    let (x, y) = (x as i32, y as i32);
    x > 0 && y > 0 && i64::from(x) * 9 == i64::from(y) * 16
  };
  (exact(words[11], words[12]) && exact(words[13], words[14])).then_some(true)
}

#[cfg(feature = "x11")]
fn replace_native_aspect(
  words: &mut [std::os::raw::c_long],
  active: bool,
  ratios: Option<[std::os::raw::c_long; 4]>,
) {
  if active {
    words[0] |= x11_dl::xlib::PAspect;
  } else {
    words[0] &= !x11_dl::xlib::PAspect;
  }
  if let Some(ratios) = ratios {
    words[11..15].copy_from_slice(&ratios);
  }
}

#[cfg(feature = "x11")]
fn x11_publish_aspect(window: &gtk::Window, active: bool) -> Result<Option<bool>, String> {
  let mut words = x11_geometry(window, None)?;
  replace_native_aspect(&mut words, active, active.then_some([16, 9, 16, 9]));
  x11_geometry(window, Some(&words)).map(|verified| native_aspect(&verified))
}

#[cfg(not(feature = "x11"))]
fn x11_publish_aspect(_window: &gtk::Window, _active: bool) -> Result<Option<bool>, String> {
  Err("X11 support is unavailable".into())
}

#[cfg(feature = "x11")]
fn x11_restore_aspect(window: &gtk::Window, original: &NativeGeometry) -> Result<(), String> {
  // ON may have published new layout-derived bounds. Restore only this
  // transaction's aspect fields, preserving all current non-aspect words.
  let mut words = x11_geometry(window, None)?;
  let was_present = original[0] & x11_dl::xlib::PAspect != 0;
  let ratios = Some([original[11], original[12], original[13], original[14]]);
  replace_native_aspect(&mut words, was_present, ratios);
  x11_geometry(window, Some(&words)).map(|_| ())
}

#[cfg(not(feature = "x11"))]
fn x11_restore_aspect(_window: &gtk::Window, _original: &NativeGeometry) -> Result<(), String> {
  Err("X11 support is unavailable".into())
}

#[cfg(feature = "x11")]
fn x11_aspect(window: &gtk::Window) -> Result<Option<bool>, String> {
  let words = x11_geometry(window, None)?;
  Ok(native_aspect(&words))
}

#[cfg(not(feature = "x11"))]
fn x11_aspect(_window: &gtk::Window) -> Result<Option<bool>, String> {
  Err("X11 support is unavailable".into())
}

pub struct WindowMaximizeProcess<W: GtkWindowExt + WidgetExt> {
  window: W,
  resizable: bool,
  step: u8,
}

impl<W: GtkWindowExt + WidgetExt> WindowMaximizeProcess<W> {
  pub fn new(window: W, resizable: bool) -> Rc<RefCell<Self>> {
    aspect_transition(&window, gdk::WindowState::MAXIMIZED, true);
    Rc::new(RefCell::new(Self {
      window,
      resizable,
      step: 0,
    }))
  }

  pub fn next_step(&mut self) -> glib::ControlFlow {
    match self.step {
      0 => {
        self.window.set_resizable(true);
        self.step += 1;
        glib::ControlFlow::Continue
      }
      1 => {
        self.window.maximize();
        self.step += 1;
        glib::ControlFlow::Continue
      }
      2 => {
        self.window.set_resizable(self.resizable);
        glib::ControlFlow::Break
      }
      _ => glib::ControlFlow::Break,
    }
  }
}

#[cfg(test)]
mod aspect_tests {
  use super::AspectState;
  use gtk::gdk::WindowState;

  #[cfg(feature = "x11")]
  #[test]
  fn native_aspect_update_preserves_nonaspect_words_in_both_icccm_layouts() {
    for length in [15, 18] {
      let original: Vec<std::os::raw::c_long> = (0..length).map(|n| n + 1000).collect();
      let mut words = original.clone();
      words[0] |= 1 << 30;
      let flags = words[0];
      super::replace_native_aspect(&mut words, true, Some([16, 9, 16, 9]));
      assert_eq!(super::native_aspect(&words), Some(true));
      assert_eq!(words[0], flags | x11_dl::xlib::PAspect);
      for index in (1..length as usize).filter(|index| !(11..15).contains(index)) {
        assert_eq!(words[index], original[index]);
      }
      let enabled = words.clone();
      super::replace_native_aspect(&mut words, false, None);
      assert_eq!(super::native_aspect(&words), Some(false));
      assert_eq!(words[0], flags & !x11_dl::xlib::PAspect);
      assert_eq!(&words[1..], &enabled[1..]);
    }
  }

  #[cfg(feature = "x11")]
  #[test]
  fn native_aspect_rollback_preserves_newer_layout_hints() {
    let mut current = vec![0; 18];
    current[0] = (1 << 30) | x11_dl::xlib::PMinSize;
    current[5] = 640;
    current[6] = 360;
    let newer = current.clone();
    super::replace_native_aspect(&mut current, true, Some([4, 3, 4, 3]));
    assert_eq!(super::native_aspect(&current), None);
    assert_eq!(current[0], newer[0] | x11_dl::xlib::PAspect);
    assert_eq!(&current[1..11], &newer[1..11]);
    assert_eq!(&current[15..], &newer[15..]);
    assert_eq!(&current[11..15], &[4, 3, 4, 3]);
  }

  #[test]
  fn fixed_state_request_does_not_rearm_on_stale_or_unrelated_native_events() {
    for flag in [WindowState::FULLSCREEN, WindowState::MAXIMIZED] {
      let mut state = AspectState {
        enabled: true,
        ..AspectState::default()
      };
      if flag == WindowState::FULLSCREEN {
        state.fullscreen = Some(true);
      } else {
        state.maximized = Some(true);
      }
      state.observe(WindowState::FOCUSED, WindowState::empty());
      state.observe(flag, WindowState::empty());
      assert!(!state.active(WindowState::empty(), true));
      state.observe(flag, flag);
      assert!(!state.active(flag, true));
      if flag == WindowState::FULLSCREEN {
        state.fullscreen = Some(false);
      } else {
        state.maximized = Some(false);
      }
      state.observe(WindowState::FOCUSED, WindowState::empty());
      assert!(!state.active(WindowState::empty(), true));
      state.observe(flag, WindowState::empty());
      assert!(state.active(WindowState::empty(), true));
    }
  }

  #[test]
  fn explicit_off_survives_restore_and_does_not_change_another_window() {
    let other = AspectState {
      enabled: true,
      ..AspectState::default()
    };
    let mut state = AspectState {
      enabled: false,
      fullscreen: Some(false),
      maximized: Some(false),
    };
    state.observe(
      WindowState::FULLSCREEN | WindowState::MAXIMIZED,
      WindowState::empty(),
    );
    assert!(!state.active(WindowState::empty(), true));
    assert!(other.active(WindowState::empty(), true));
    for native in [WindowState::FULLSCREEN, WindowState::MAXIMIZED, WindowState::TILED] {
      assert!(!other.active(native, true));
    }
    assert!(!other.active(WindowState::empty(), false));
  }
}
