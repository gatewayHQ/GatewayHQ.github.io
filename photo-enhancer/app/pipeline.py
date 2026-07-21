"""End-to-end enhancement pipeline for one batch (one listing gallery).

Flow per batch:
  1. Analyze every photo with Claude (concurrent) → room type, clutter, etc.
  2. Non-generative grade — the MLS-safe core:
       • Imagen path (recommended): one project graded with the office AI
         Profile, applied identically across the gallery (+ sky if requested).
       • Local path: deterministic OpenCV grade per photo (offline, no keys).
  3. Generative edits (opt-in, per photo, gated by the analysis so agents get
     smart defaults with minimal clicks): sky replacement, declutter, object
     removal, virtual staging. Prompts are authored by Claude.
  4. Finalize: resize to MLS long edge, embed disclosure, write JPEG + sidecar.

Consistency across the gallery comes from (a) one shared house style / AI
Profile and (b) grading the whole set with the same parameters in one pass.
"""
from __future__ import annotations

import asyncio
import logging

from . import claude_client, house_style, imaging_io, local_ops, mls
from .config import get_settings
from .models import EnhanceOptions, PhotoResult, SkyStyle
from .providers import GenerativeProvider, GenEdit
from .providers.base import (
    EDIT_GRADE, EDIT_SKY, EDIT_DECLUTTER, EDIT_OBJECT_REMOVAL, EDIT_STAGING,
)

log = logging.getLogger("photo-enhancer.pipeline")


def _corrective_list(opts: EnhanceOptions) -> list[str]:
    out = []
    if opts.perspective_correction: out.append("perspective_correction")
    if opts.white_balance:          out.append("white_balance")
    if opts.exposure_balance:       out.append("exposure_balance")
    if opts.window_pull:            out.append("window_pull")
    if opts.clarity_sharpen:        out.append("clarity_sharpen")
    return out


async def process_batch(
    photos: list[tuple[str, bytes]],
    opts: EnhanceOptions,
    provider: GenerativeProvider,
    on_photo_update,
) -> list[PhotoResult]:
    settings = get_settings()
    style = house_style.get_style(opts.house_style)
    long_edge = opts.long_edge or settings.mls_long_edge

    # ── 1) analyze all photos concurrently ────────────────────────────
    analyses = await asyncio.gather(*[claude_client.analyze_photo(b) for _, b in photos])

    results: dict[str, PhotoResult] = {}
    for (fn, _), an in zip(photos, analyses):
        rt = opts.room_type.value if opts.room_type.value != "auto" else an.get("room_type", "interior")
        results[fn] = PhotoResult(filename=fn, status="analyzing", room_type=rt)
        on_photo_update(results[fn])

    corrective = _corrective_list(opts)

    # ── 2) non-generative grade ───────────────────────────────────────
    use_imagen = (provider.name == "imagen" and provider.available()
                  and EDIT_GRADE in provider.capabilities)

    graded: dict[str, bytes] = {}
    imagen_did_sky = False

    if use_imagen:
        for fn in results:
            results[fn].status = "editing"; on_photo_update(results[fn])
        sky = opts.sky_replacement.value
        batch_results = await provider.process_batch(
            photos, sky=sky, profile_key=style.look.imagen_profile_key,
        )
        imagen_did_sky = sky != "none"
        by_name = {r.filename: r for r in batch_results}
        for fn, original in photos:
            r = by_name.get(fn)
            if r and r.image_bytes:
                graded[fn] = r.image_bytes
            else:
                # Imagen failed for this photo — fall back to the local grade
                # so the agent still gets a usable file.
                log.warning("Imagen grade failed for %s (%s); using local grade",
                            fn, r.error if r else "no result")
                graded[fn] = _local_grade(original, style, opts, settings.jpeg_quality)
    else:
        for fn, original in photos:
            results[fn].status = "editing"; on_photo_update(results[fn])
            graded[fn] = _local_grade(original, style, opts, settings.jpeg_quality)

    # ── 3) generative edits (per photo, gated by analysis) ────────────
    for (fn, _), an in zip(photos, analyses):
        res = results[fn]
        generative_applied: list[str] = []
        prompts_used: dict[str, str] = {}
        img = graded[fn]

        plan = _generative_plan(opts, an, imagen_did_sky)
        for edit, detail in plan:
            if not provider.supports(edit):
                # Imagen can't declutter/stage; note it and continue gracefully.
                log.info("Provider '%s' can't do '%s' for %s — skipped",
                         provider.name, edit, fn)
                continue
            prompt = await claude_client.author_prompt(
                an, edit, detail, style.description)
            prompts_used[edit] = prompt
            params = {}
            if edit == EDIT_SKY:
                params["sky"] = opts.sky_replacement.value
                params["profile_key"] = style.look.imagen_profile_key
            gr = await provider.edit(GenEdit(fn, img, edit, prompt, params))
            if gr.image_bytes:
                img = gr.image_bytes
                generative_applied.append(edit)
            else:
                log.warning("Generative '%s' failed for %s: %s", edit, fn, gr.error)

        if imagen_did_sky and opts.sky_replacement != SkyStyle.none:
            generative_applied.append(EDIT_SKY)
            prompts_used.setdefault(EDIT_SKY, f"Imagen sky replacement: {opts.sky_replacement.value}")

        # ── 4) finalize ───────────────────────────────────────────────
        try:
            _finalize(fn, img, long_edge, settings, style, res.room_type or "interior",
                      corrective, generative_applied, provider.name, prompts_used)
            res.status = "done"
            res.generative_steps = generative_applied
            res.output_url = f"/output/{fn}"
            res.sidecar_url = f"/output/{fn}.mls.json"
            res.disclosure_required = mls.disclosure_required(generative_applied)
            res.disclosure_text = mls.disclosure_text(generative_applied) or None
        except Exception as e:
            log.error("Finalize failed for %s: %s", fn, e)
            res.status = "error"
            res.error = str(e)
        on_photo_update(res)

    return list(results.values())


def _local_grade(original: bytes, style, opts: EnhanceOptions, quality: int) -> bytes:
    rgb = imaging_io.decode_rgb(original)
    out = local_ops.enhance(
        rgb, style.look,
        do_perspective=opts.perspective_correction,
        do_white_balance=opts.white_balance,
        do_exposure=opts.exposure_balance,
        do_window_pull=opts.window_pull,
        do_clarity=opts.clarity_sharpen,
    )
    return imaging_io.encode_jpeg(out, quality)


def _generative_plan(opts: EnhanceOptions, analysis: dict,
                     imagen_did_sky: bool) -> list[tuple[str, str]]:
    """Decide which generative edits to run for this specific photo, using the
    analysis so the agent doesn't have to hand-pick per image."""
    plan: list[tuple[str, str]] = []

    if opts.sky_replacement != SkyStyle.none and not imagen_did_sky:
        if analysis.get("sky_visible") or analysis.get("room_type") in ("exterior", "aerial", "twilight"):
            plan.append((EDIT_SKY, opts.sky_replacement.value.replace("_", " ")))

    if opts.declutter:
        clutter = analysis.get("clutter") or []
        if clutter:
            plan.append((EDIT_DECLUTTER, ", ".join(clutter)))

    if opts.object_removal:
        plan.append((EDIT_OBJECT_REMOVAL, ", ".join(opts.object_removal)))

    if opts.virtual_staging and analysis.get("is_empty"):
        plan.append((EDIT_STAGING, opts.staging_style))

    return plan


def _finalize(fn, img_bytes, long_edge, settings, style, room_type,
              corrective, generative, provider_name, prompts_used) -> None:
    rgb = imaging_io.decode_rgb(img_bytes)
    rgb = imaging_io.resize_long_edge(rgb, long_edge)
    final = imaging_io.encode_jpeg(rgb, settings.jpeg_quality)

    out_path = settings.output_path / fn
    out_path.write_bytes(final)

    sidecar = mls.build_sidecar(
        fn, style.key, room_type, corrective, generative, provider_name, prompts_used)
    mls.write_sidecar(sidecar, out_path)
    mls.embed_disclosure_exif(out_path, sidecar["disclosure_text"])
