"""Sanity tests for the deterministic local ops. Run: pytest -q

These don't need any API keys — they prove the MLS-safe core works offline.
"""
import numpy as np

from app import local_ops, imaging_io, house_style, mls


def _synthetic_room() -> np.ndarray:
    """A dim, slightly warm-cast image with a blown-out 'window' patch."""
    rng = np.random.default_rng(0)
    img = (rng.integers(30, 90, (600, 800, 3))).astype(np.uint8)
    img[:, :, 0] = np.clip(img[:, :, 0] + 20, 0, 255)   # warm cast
    img[100:300, 550:750] = 252                          # blown window
    return img


def test_enhance_preserves_shape_and_type():
    img = _synthetic_room()
    look = house_style.get_style("gateway_default").look
    out = local_ops.enhance(img, look, do_perspective=False, do_white_balance=True,
                            do_exposure=True, do_window_pull=True, do_clarity=True)
    assert out.dtype == np.uint8
    assert out.ndim == 3 and out.shape[2] == 3


def test_window_pull_darkens_blown_region():
    img = imaging_io.decode_rgb(imaging_io.encode_jpeg(_synthetic_room(), 90))
    rgb = img.astype(np.float32) / 255.0
    before = rgb[150:250, 600:700].mean()
    after = local_ops.window_pull(rgb, 0.4)[150:250, 600:700].mean()
    assert after < before                                # recovered highlights


def test_white_balance_reduces_cast():
    img = _synthetic_room().astype(np.float32) / 255.0
    out = local_ops.neutral_white_balance(img, warmth=0.0, tint=0.0)
    # After neutralizing, the red/blue channel means should be closer together.
    spread_before = abs(img[..., 0].mean() - img[..., 2].mean())
    spread_after = abs(out[..., 0].mean() - out[..., 2].mean())
    assert spread_after <= spread_before + 1e-6


def test_jpeg_roundtrip_and_resize():
    img = _synthetic_room()
    data = imaging_io.encode_jpeg(img, 90)
    decoded = imaging_io.decode_rgb(data)
    resized = imaging_io.resize_long_edge(decoded, 400)
    assert max(resized.shape[:2]) == 400


def test_disclosure_logic():
    assert mls.disclosure_required(["virtual_staging"]) is True
    assert mls.disclosure_required(["white_balance", "exposure_balance"]) is False
    text = mls.disclosure_text(["virtual_staging", "sky_replacement"])
    assert "VIRTUALLY STAGED" in text
