"""Small image I/O helpers shared by the pipeline."""
from __future__ import annotations

import io

import numpy as np
from PIL import Image, ImageOps

# iPhones default to HEIC. pillow-heif teaches Pillow to read it; if the wheel
# isn't installed the app still runs for JPEG/PNG and HEIC yields a clear error.
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIC_SUPPORTED = True
except Exception:  # pragma: no cover - depends on optional dependency
    HEIC_SUPPORTED = False


def decode_rgb(data: bytes) -> np.ndarray:
    """Bytes → uint8 RGB ndarray, honoring the iPhone's EXIF orientation flag
    (phone photos are almost always stored rotated with an orientation tag)."""
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img)          # apply orientation, then drop it
    img = img.convert("RGB")
    return np.asarray(img)


def encode_jpeg(rgb: np.ndarray, quality: int) -> bytes:
    img = Image.fromarray(np.ascontiguousarray(rgb))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True,
             progressive=True, subsampling=0)
    return buf.getvalue()


def resize_long_edge(rgb: np.ndarray, long_edge: int) -> np.ndarray:
    h, w = rgb.shape[:2]
    longest = max(h, w)
    if long_edge <= 0 or longest <= long_edge:
        return rgb
    scale = long_edge / longest
    new_size = (int(round(w * scale)), int(round(h * scale)))
    img = Image.fromarray(rgb).resize(new_size, Image.LANCZOS)
    return np.asarray(img)
