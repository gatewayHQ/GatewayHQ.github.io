"""Deterministic, non-generative image operations (OpenCV / NumPy / Pillow).

These are the MLS-safe core of the pipeline. Nothing here invents pixels that
weren't in the original scene — it corrects geometry, exposure, color, and
detail the way a photographer would in Lightroom. Because they are pure math,
they run fast, offline, and identically for every photo in a gallery, which is
what produces a *consistent* listing set.

Every function takes and returns a float image in [0,1], RGB, so they compose
cleanly. `enhance()` at the bottom runs the whole local grade for one photo.
"""
from __future__ import annotations

import cv2
import numpy as np

from .house_style import LocalLook


# ── helpers ───────────────────────────────────────────────────────────

def _to_float(img_u8: np.ndarray) -> np.ndarray:
    return img_u8.astype(np.float32) / 255.0


def _to_u8(img_f: np.ndarray) -> np.ndarray:
    return np.clip(img_f * 255.0, 0, 255).astype(np.uint8)


def _luminance(rgb: np.ndarray) -> np.ndarray:
    # Rec. 709 luma
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


# ── perspective / straightening ─────────────────────────────────────────

def straighten_verticals(rgb: np.ndarray, strength: float) -> np.ndarray:
    """Deskew so dominant near-vertical lines (door frames, wall corners,
    building edges) become truly vertical.

    Full keystone correction is deliberately conservative: an over-corrected
    interior looks worse than a slightly-off one, and aggressive warping can
    misrepresent room proportions (an MLS concern). We detect the median tilt
    of strong near-vertical edges and rotate by a fraction of it scaled by
    `strength`. Returns the input unchanged when no confident lines are found.
    """
    if strength <= 0:
        return rgb

    u8 = _to_u8(rgb)
    gray = cv2.cvtColor(u8, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 60, 180)
    h, w = gray.shape
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180, threshold=80,
        minLineLength=int(h * 0.35), maxLineGap=20,
    )
    if lines is None:
        return rgb

    angles = []
    for x1, y1, x2, y2 in np.asarray(lines).reshape(-1, 4):
        dx, dy = (x2 - x1), (y2 - y1)
        if dy == 0:
            continue
        angle = np.degrees(np.arctan2(dx, dy))  # 0 = perfectly vertical
        if abs(angle) < 15:                      # only near-vertical lines
            angles.append(angle)
    if len(angles) < 3:
        return rgb

    tilt = float(np.median(angles)) * strength
    if abs(tilt) < 0.15:                         # already straight enough
        return rgb

    m = cv2.getRotationMatrix2D((w / 2, h / 2), -tilt, 1.0)
    rotated = cv2.warpAffine(
        u8, m, (w, h), flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REFLECT_101,
    )
    # Crop the small border the rotation introduces so no reflected edge ships.
    crop = int(abs(np.sin(np.radians(tilt))) * h) + 2
    if crop > 0 and crop * 2 < min(h, w):
        rotated = rotated[crop:h - crop, crop:w - crop]
    return _to_float(rotated)


# ── white balance ────────────────────────────────────────────────────────

def neutral_white_balance(rgb: np.ndarray, warmth: float, tint: float) -> np.ndarray:
    """Remove color casts so walls read neutral. Combines a robust gray-world
    estimate with a bright-pixel (white-patch) estimate, then applies the
    style's warmth/tint bias so the office look stays intentional, not clinical.
    """
    lum = _luminance(rgb)
    bright = rgb[lum > np.percentile(lum, 90)]
    gray_mean = rgb.reshape(-1, 3).mean(axis=0) + 1e-6
    white_mean = (bright.mean(axis=0) if len(bright) else gray_mean) + 1e-6

    # Blend the two estimators; target the overall luminance so we scale
    # channels toward neutral without shifting exposure.
    est = 0.5 * gray_mean + 0.5 * white_mean
    target = est.mean()
    gains = target / est
    gains = np.clip(gains, 0.7, 1.4)             # guard against wild casts

    out = rgb * gains
    # Style bias: warmth pushes R up / B down; tint pushes G.
    out[..., 0] *= (1.0 + 0.15 * warmth)
    out[..., 2] *= (1.0 - 0.15 * warmth)
    out[..., 1] *= (1.0 + 0.10 * tint)
    return np.clip(out, 0, 1)


# ── exposure / tone ────────────────────────────────────────────────────────

def balance_exposure(rgb: np.ndarray, shadow_lift: float, highlight_recovery: float,
                     exposure_bias: float) -> np.ndarray:
    """HDR-style tone balancing on a single frame: lift shadows and recover
    highlights so a dim interior brightens without blowing out. Operates on the
    L channel in LAB so hue/saturation are preserved.
    """
    u8 = _to_u8(rgb)
    lab = cv2.cvtColor(u8, cv2.COLOR_RGB2LAB).astype(np.float32)
    L = lab[..., 0] / 255.0

    if exposure_bias:
        L = np.clip(L * (2.0 ** exposure_bias), 0, 1)

    # Local contrast normalization brightens interiors evenly.
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    L_eq = clahe.apply((L * 255).astype(np.uint8)).astype(np.float32) / 255.0
    L = L * (1 - 0.5) + L_eq * 0.5

    # Shadow lift (gamma < 1 in dark regions) + highlight rolloff.
    shadows = 1.0 - np.clip(L / 0.5, 0, 1)
    L = L + shadow_lift * shadows * (1.0 - L)
    highs = np.clip((L - 0.6) / 0.4, 0, 1)
    L = L - highlight_recovery * highs * (L - 0.6)

    lab[..., 0] = np.clip(L, 0, 1) * 255.0
    out = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2RGB)
    return _to_float(out)


def window_pull(rgb: np.ndarray, strength: float = 0.35) -> np.ndarray:
    """Recover detail in blown-out windows so exterior views become visible
    while the interior stays correctly exposed — the single-frame equivalent of
    an exposure-blended "window pull". Only near-white, high-luminance regions
    (typical of overexposed glass) are pulled down, using a soft mask so the
    transition at the window frame stays natural.
    """
    if strength <= 0:
        return rgb
    lum = _luminance(rgb)
    # Mask: very bright AND low-saturation (windows blow out toward white).
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    sat = (mx - mn) / (mx + 1e-6)
    mask = np.clip((lum - 0.82) / 0.18, 0, 1) * (1.0 - np.clip(sat / 0.25, 0, 1))
    mask = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 3)

    pulled = rgb * (1.0 - strength * mask[..., None])
    # Nudge a touch of contrast back into the recovered region.
    pulled = np.clip(pulled, 0, 1)
    return pulled


# ── color ───────────────────────────────────────────────────────────────

def apply_vibrance_saturation(rgb: np.ndarray, vibrance: float, saturation: float) -> np.ndarray:
    u8 = _to_u8(rgb)
    hsv = cv2.cvtColor(u8, cv2.COLOR_RGB2HSV).astype(np.float32)
    s = hsv[..., 1] / 255.0
    if saturation:
        s = s * (1.0 + saturation)
    if vibrance:
        # Vibrance protects already-saturated pixels (and skin) from clipping.
        s = s + vibrance * (1.0 - s) * s * 2.0
    hsv[..., 1] = np.clip(s, 0, 1) * 255.0
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    return _to_float(out)


# ── detail ───────────────────────────────────────────────────────────────

def clarity_and_sharpen(rgb: np.ndarray, clarity: float, sharpen_amount: float) -> np.ndarray:
    out = rgb
    if clarity:
        # Local-contrast "clarity" via unsharp on a large radius.
        blur = cv2.GaussianBlur(out, (0, 0), 12)
        out = np.clip(out + clarity * (out - blur), 0, 1)
    if sharpen_amount:
        blur = cv2.GaussianBlur(out, (0, 0), 1.2)
        out = np.clip(out + sharpen_amount * (out - blur), 0, 1)
    return out


# ── orchestration for one photo ──────────────────────────────────────────

def enhance(img_u8_rgb: np.ndarray, look: LocalLook, *,
            do_perspective: bool, do_white_balance: bool,
            do_exposure: bool, do_window_pull: bool,
            do_clarity: bool) -> np.ndarray:
    """Run the full local grade for one photo and return a uint8 RGB image.

    Order matters: geometry first, then exposure, then color, then detail —
    the same order a retoucher works in, so each step sees corrected input.
    """
    rgb = _to_float(img_u8_rgb)

    if do_perspective:
        rgb = straighten_verticals(rgb, look.perspective_strength)
    if do_white_balance:
        rgb = neutral_white_balance(rgb, look.warmth, look.tint)
    if do_exposure:
        rgb = balance_exposure(rgb, look.shadow_lift, look.highlight_recovery,
                               look.exposure_bias)
    if do_window_pull:
        rgb = window_pull(rgb)
    # Color grade always follows exposure.
    rgb = apply_vibrance_saturation(rgb, look.vibrance, look.saturation)
    if do_clarity:
        rgb = clarity_and_sharpen(rgb, look.clarity, look.sharpen_amount)

    return _to_u8(rgb)
