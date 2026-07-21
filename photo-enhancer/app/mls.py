"""MLS compliance — disclosure of generative edits.

Why this exists: most MLS rules and the NAR Code of Ethics (Article 12 —
no misleading advertising) require that a photo not misrepresent the property.
Non-generative corrections (exposure, white balance, straightening, sharpening)
are universally accepted — they're what every photographer does. But
*generative* edits that add or remove real-world content — sky replacement,
object/clutter removal, and especially virtual staging — must be disclosed,
and many MLSs require the label "Virtually Staged" plus keeping the original
available. Rules vary by MLS and state, so treat this as a safe default and
confirm your local MLS's specific policy.

This module:
  • decides whether a given edit set requires disclosure,
  • generates the human-readable disclosure caption,
  • writes it into the JPEG's IPTC/EXIF caption fields, and
  • writes a machine-readable sidecar JSON next to the output.
"""
from __future__ import annotations

import json
from pathlib import Path

import piexif

# Edits that alter real-world scene content → require disclosure.
GENERATIVE_EDITS = {
    "sky_replacement": "sky replacement",
    "declutter": "digital decluttering / item removal",
    "object_removal": "object removal",
    "virtual_staging": "virtual staging",
}

# Non-generative corrections — accepted, no disclosure required.
CORRECTIVE_EDITS = {
    "perspective_correction", "white_balance", "exposure_balance",
    "window_pull", "clarity_sharpen",
}


def disclosure_required(applied_edits: list[str]) -> bool:
    return any(e in GENERATIVE_EDITS for e in applied_edits)


def disclosure_text(applied_edits: list[str]) -> str:
    gens = [GENERATIVE_EDITS[e] for e in applied_edits if e in GENERATIVE_EDITS]
    if not gens:
        return ""
    if "virtual staging" in gens:
        # Virtual staging gets the strongest, most specific label.
        others = [g for g in gens if g != "virtual staging"]
        base = "This image has been VIRTUALLY STAGED."
        if others:
            base += " It also includes: " + ", ".join(others) + "."
        return base + " Furnishings are digital representations and are not included."
    return "This image has been digitally edited (" + ", ".join(gens) + ")."


def build_sidecar(filename: str, house_style: str, room_type: str,
                  corrective: list[str], generative: list[str],
                  provider: str, prompts_used: dict) -> dict:
    """Machine-readable provenance record. Keep this with the delivered photo;
    it's your audit trail for what was changed and how."""
    return {
        "file": filename,
        "house_style": house_style,
        "room_type": room_type,
        "corrective_edits": corrective,          # no disclosure needed
        "generative_edits": generative,          # disclosed
        "disclosure_required": disclosure_required(generative),
        "disclosure_text": disclosure_text(generative),
        "generative_provider": provider if generative else "",
        "prompts": prompts_used,                 # exact prompts sent to models
        "tool": "gateway-photo-enhancer",
    }


def write_sidecar(sidecar: dict, out_path: Path) -> Path:
    p = out_path.with_suffix(out_path.suffix + ".mls.json")
    p.write_text(json.dumps(sidecar, indent=2))
    return p


def embed_disclosure_exif(jpeg_path: Path, disclosure: str) -> None:
    """Write the disclosure into EXIF ImageDescription + XPComment so it
    travels with the file even if the sidecar is separated. No-op on failure —
    metadata embedding must never lose the actual photo."""
    if not disclosure:
        return
    try:
        exif = piexif.load(str(jpeg_path))
        exif["0th"][piexif.ImageIFD.ImageDescription] = disclosure.encode("utf-8")
        exif["0th"][piexif.ImageIFD.XPComment] = disclosure.encode("utf-16-le")
        piexif.insert(piexif.dump(exif), str(jpeg_path))
    except Exception:
        pass
