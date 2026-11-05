//! Integer physical-pixel geometry for Windows WM_SIZING.
//! No window setters: the native sizing callback edits its proposed RECT once.
#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}
#[derive(Clone, Copy, Debug)]
pub struct Limits {
    pub min_width: u32,
    pub min_height: u32,
    pub max_width: u32,
    pub max_height: u32,
}
#[derive(Clone, Copy, Debug)]
pub struct Insets {
    pub horizontal: u32,
    pub vertical: u32,
}
#[derive(Clone, Copy, Debug)]
pub enum Edge {
    Left,
    Right,
    Top,
    TopLeft,
    TopRight,
    Bottom,
    BottomLeft,
    BottomRight,
}
impl Edge {
    pub fn from_native(value: usize) -> Option<Self> {
        Some(match value {
            1 => Self::Left,
            2 => Self::Right,
            3 => Self::Top,
            4 => Self::TopLeft,
            5 => Self::TopRight,
            6 => Self::Bottom,
            7 => Self::BottomLeft,
            8 => Self::BottomRight,
            _ => return None,
        })
    }
}
fn round(n: u64, d: u64) -> u64 {
    (n + d / 2) / d
}
/// Preserve the opposite corner (or edge midpoint) and respect existing native
/// content min/max limits. Pixel rounding is at most half a width pixel.
/// Invalid/impossible limits leave the original OS proposal to its normal handler.
pub fn constrain(rect: Rect, edge: Edge, inset: Insets, limits: Limits) -> Option<Rect> {
    let ow = i64::from(rect.right) - i64::from(rect.left);
    let oh = i64::from(rect.bottom) - i64::from(rect.top);
    let w = u64::try_from(ow - i64::from(inset.horizontal)).ok()?;
    let h = u64::try_from(oh - i64::from(inset.vertical)).ok()?;
    if w == 0 || h == 0 || w > i32::MAX as u64 || h > i32::MAX as u64 {
        return None;
    }
    let lo_w = u64::from(limits.min_width.max(1));
    let lo_h = u64::from(limits.min_height.max(1));
    let hi_w = u64::from(limits.max_width.min(i32::MAX as u32));
    let hi_h = u64::from(limits.max_height.min(i32::MAX as u32));
    // width = round(height * 16 / 9). These inverse bounds keep rounding inside
    // BOTH limits, including very narrow legal ranges.
    let minimum = lo_h.max((lo_w * 9).saturating_sub(4).div_ceil(16));
    let maximum = hi_h.min((hi_w * 9 + 4) / 16);
    if lo_w > hi_w || minimum > maximum || maximum == 0 {
        return None;
    }
    let wanted = match edge {
        Edge::Left | Edge::Right => round(w * 9, 16),
        Edge::Top | Edge::Bottom => h,
        _ => round(9 * (16 * w + 9 * h), 337),
    };
    let height = wanted.clamp(minimum, maximum);
    let width = round(height * 16, 9);
    let ow = i64::try_from(width + u64::from(inset.horizontal)).ok()?;
    let oh = i64::try_from(height + u64::from(inset.vertical)).ok()?;
    let (left, top) = match edge {
        Edge::Left => (
            i64::from(rect.right) - ow,
            (i64::from(rect.top) + i64::from(rect.bottom) - oh) / 2,
        ),
        Edge::Right => (
            i64::from(rect.left),
            (i64::from(rect.top) + i64::from(rect.bottom) - oh) / 2,
        ),
        Edge::Top => (
            (i64::from(rect.left) + i64::from(rect.right) - ow) / 2,
            i64::from(rect.bottom) - oh,
        ),
        Edge::Bottom => (
            (i64::from(rect.left) + i64::from(rect.right) - ow) / 2,
            i64::from(rect.top),
        ),
        Edge::TopLeft => (i64::from(rect.right) - ow, i64::from(rect.bottom) - oh),
        Edge::TopRight => (i64::from(rect.left), i64::from(rect.bottom) - oh),
        Edge::BottomLeft => (i64::from(rect.right) - ow, i64::from(rect.top)),
        Edge::BottomRight => (i64::from(rect.left), i64::from(rect.top)),
    };
    Some(Rect {
        left: left.try_into().ok()?,
        top: top.try_into().ok()?,
        right: (left + ow).try_into().ok()?,
        bottom: (top + oh).try_into().ok()?,
    })
}
/// Outer-window tracking limits initialized by the OS and then amended by the
/// existing window procedure. No synthetic zero/default-unbounded message.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TrackingBounds {
    pub min_width: i32,
    pub min_height: i32,
    pub max_width: i32,
    pub max_height: i32,
}
impl TrackingBounds {
    fn valid(self) -> bool {
        self.min_width > 0
            && self.min_height > 0
            && self.max_width >= self.min_width
            && self.max_height >= self.min_height
    }
    pub fn content_limits(self, inset: Insets) -> Option<Limits> {
        if !self.valid() {
            return None;
        }
        let max_width = (self.max_width as u32).checked_sub(inset.horizontal)?;
        let max_height = (self.max_height as u32).checked_sub(inset.vertical)?;
        if max_width == 0 || max_height == 0 {
            return None;
        }
        Some(Limits {
            min_width: (self.min_width as u32)
                .saturating_sub(inset.horizontal)
                .max(1),
            min_height: (self.min_height as u32)
                .saturating_sub(inset.vertical)
                .max(1),
            max_width,
            max_height,
        })
    }
}
/// Always chain the real native message, even if its incoming bounds are
/// unusable. Publish only initialized, valid bounds after configured overrides.
pub fn tracking_after_chain(
    mut bounds: TrackingBounds,
    chain: impl FnOnce(&mut TrackingBounds),
) -> Option<TrackingBounds> {
    let initialized = bounds.valid();
    chain(&mut bounds);
    (initialized && bounds.valid()).then_some(bounds)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn system_bounds() -> TrackingBounds {
        TrackingBounds {
            min_width: 160,
            min_height: 90,
            max_width: 3840,
            max_height: 2160,
        }
    }
    #[test]
    fn unconfigured_tracking_retains_system_minimum_and_maximum() {
        let bounds = tracking_after_chain(system_bounds(), |_| {}).unwrap();
        assert_eq!(bounds, system_bounds());
        let limits = bounds
            .content_limits(Insets {
                horizontal: 16,
                vertical: 40,
            })
            .unwrap();
        assert_eq!((limits.min_width, limits.min_height), (144, 50));
        assert_eq!((limits.max_width, limits.max_height), (3824, 2120));
        let r = constrain(
            Rect {
                left: 0,
                top: 0,
                right: 8000,
                bottom: 6000,
            },
            Edge::BottomRight,
            Insets {
                horizontal: 16,
                vertical: 40,
            },
            limits,
        )
        .unwrap();
        assert!(r.right <= 3840 && r.bottom <= 2160);
    }
    #[test]
    fn partial_tracking_overrides_preserve_other_system_axes_and_bounds() {
        for min_only in [true, false] {
            let bounds = tracking_after_chain(system_bounds(), |bounds| {
                if min_only {
                    bounds.min_width = 640;
                    bounds.min_height = 360;
                } else {
                    bounds.max_width = 1920;
                    bounds.max_height = 1080;
                }
            })
            .unwrap();
            if min_only {
                assert_eq!((bounds.max_width, bounds.max_height), (3840, 2160));
                assert_eq!((bounds.min_width, bounds.min_height), (640, 360));
            } else {
                assert_eq!((bounds.min_width, bounds.min_height), (160, 90));
                assert_eq!((bounds.max_width, bounds.max_height), (1920, 1080));
            }
        }
        let bounds = tracking_after_chain(system_bounds(), |b| b.min_width = 320).unwrap();
        assert_eq!(
            (
                bounds.min_width,
                bounds.min_height,
                bounds.max_width,
                bounds.max_height
            ),
            (320, 90, 3840, 2160)
        );
    }
    #[test]
    fn uninitialized_or_invalid_tracking_never_becomes_unbounded() {
        let mut called = false;
        assert!(tracking_after_chain(
            TrackingBounds {
                min_width: 0,
                min_height: 0,
                max_width: 0,
                max_height: 0
            },
            |b| {
                called = true;
                b.min_width = 320;
            }
        )
        .is_none());
        assert!(called);
        assert!(tracking_after_chain(system_bounds(), |b| b.max_width = 1).is_none());
        assert!(system_bounds()
            .content_limits(Insets {
                horizontal: 4000,
                vertical: 0
            })
            .is_none());
    }

    fn limits() -> Limits {
        Limits {
            min_width: 1,
            min_height: 1,
            max_width: 10000,
            max_height: 10000,
        }
    }
    #[test]
    fn every_native_edge_preserves_opposite_anchor_and_content_ratio() {
        let r = Rect {
            left: 100,
            top: 200,
            right: 927,
            bottom: 743,
        };
        for id in 1..=8 {
            let q = constrain(
                r,
                Edge::from_native(id).unwrap(),
                Insets {
                    horizontal: 17,
                    vertical: 43,
                },
                limits(),
            )
            .unwrap();
            let w = i64::from(q.right) - i64::from(q.left) - 17;
            let h = i64::from(q.bottom) - i64::from(q.top) - 43;
            assert!((w * 9 - h * 16).abs() <= 4, "edge {id}");
            match id {
                1 | 4 | 7 => assert_eq!(q.right, r.right),
                2 | 5 | 8 => assert_eq!(q.left, r.left),
                _ => {}
            }
            match id {
                3 | 4 | 5 => assert_eq!(q.bottom, r.bottom),
                6 | 7 | 8 => assert_eq!(q.top, r.top),
                _ => {}
            }
        }
    }
    #[test]
    fn physical_insets_at_fractional_scales_are_not_scaled_twice() {
        for (horizontal, vertical) in [(0, 0), (16, 39), (20, 49), (24, 59), (32, 78)] {
            let r = Rect {
                left: -1200,
                top: -200,
                right: 500,
                bottom: 900,
            };
            let q = constrain(
                r,
                Edge::BottomRight,
                Insets {
                    horizontal,
                    vertical,
                },
                limits(),
            )
            .unwrap();
            assert_eq!((q.left, q.top), (r.left, r.top));
            assert!(
                ((i64::from(q.right - q.left) - i64::from(horizontal)) * 9
                    - (i64::from(q.bottom - q.top) - i64::from(vertical)) * 16)
                    .abs()
                    <= 4
            );
        }
    }
    #[test]
    fn both_minimum_and_maximum_apply_after_rounding() {
        for width in 1..100 {
            let l = Limits {
                min_width: width,
                min_height: 1,
                max_width: width,
                max_height: 100,
            };
            if let Some(q) = constrain(
                Rect {
                    left: 0,
                    top: 0,
                    right: 200,
                    bottom: 200,
                },
                Edge::BottomRight,
                Insets {
                    horizontal: 0,
                    vertical: 0,
                },
                l,
            ) {
                assert_eq!(q.right as u32, width);
                assert!(q.bottom > 0 && q.bottom <= 100);
            }
        }
        assert!(constrain(
            Rect {
                left: 0,
                top: 0,
                right: 10,
                bottom: 10
            },
            Edge::Right,
            Insets {
                horizontal: 0,
                vertical: 0
            },
            Limits {
                min_width: 100,
                min_height: 100,
                max_width: 100,
                max_height: 100
            }
        )
        .is_none());
    }
    #[test]
    fn malformed_and_overflow_rectangles_are_refused() {
        assert!(Edge::from_native(0).is_none());
        assert!(Edge::from_native(9).is_none());
        for r in [
            Rect {
                left: 0,
                top: 0,
                right: 0,
                bottom: 10,
            },
            Rect {
                left: 20,
                top: 0,
                right: 10,
                bottom: 10,
            },
            Rect {
                left: i32::MIN,
                top: 0,
                right: i32::MAX,
                bottom: 10,
            },
            Rect {
                left: i32::MAX - 10,
                top: 0,
                right: i32::MAX,
                bottom: 1000,
            },
        ] {
            assert!(constrain(
                r,
                Edge::BottomRight,
                Insets {
                    horizontal: 0,
                    vertical: 0
                },
                limits()
            )
            .is_none());
        }
    }
}
