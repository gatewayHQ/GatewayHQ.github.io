// app/video/encoder.js
// Renders the composition frame-by-frame to a canvas and encodes it to a real
// MP4 (H.264 + optional AAC) entirely in the browser via WebCodecs + mp4-muxer.
// No server, no FFmpeg, no GitHub Actions. Falls back to MediaRecorder/WebM
// where WebCodecs (or H.264 encode) isn't available.

import { Muxer, ArrayBufferTarget } from '../../lib/mp4-muxer.mjs';
import { drawFrame, totalDuration } from './renderer.js';

const AVC_CANDIDATES = ['avc1.42E01F', 'avc1.4D401F', 'avc1.640028', 'avc1.42001f'];

/** Feature-detect the best available encode path. */
export async function detectSupport() {
  const hasVE = typeof VideoEncoder !== 'undefined';
  let avc = null;
  if (hasVE) {
    for (const codec of AVC_CANDIDATES) {
      try {
        const r = await VideoEncoder.isConfigSupported({ codec, width: 1080, height: 1920, bitrate: 6e6, framerate: 30 });
        if (r && r.supported) { avc = codec; break; }
      } catch { /* keep probing */ }
    }
  }
  const hasMR = typeof MediaRecorder !== 'undefined';
  return { webcodecs: hasVE, avc, mediarecorder: hasMR, mp4: !!avc };
}

/**
 * Encode the model to a downloadable video.
 * @returns {Promise<{blob: Blob, ext: string, mime: string, path: string}>}
 */
export async function encode(model, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const support = await detectSupport();

  if (support.mp4) return encodeWebCodecsMP4(model, opts, support.avc, onProgress);
  if (support.mediarecorder) return encodeMediaRecorderWebM(model, opts, onProgress);
  throw new Error('This browser cannot encode video (no WebCodecs or MediaRecorder). Use a recent Chrome, Edge, or Safari.');
}

// ── Primary path: WebCodecs → MP4 ───────────────────────────────────────────
async function encodeWebCodecsMP4(model, opts, codec, onProgress) {
  const { width: W, height: H, fps } = model;
  const total = totalDuration(model);
  const frameCount = Math.max(1, Math.round(total * fps));

  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d', { alpha: false });

  const hasAudio = !!opts.audioBuffer;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    fastStart: 'in-memory',                 // moov at front → streamable/uploadable
    firstTimestampBehavior: 'offset',
    video: { codec: 'avc', width: W, height: H, frameRate: fps },
    ...(hasAudio ? { audio: { codec: 'aac', numberOfChannels: Math.min(2, opts.audioBuffer.numberOfChannels), sampleRate: opts.audioBuffer.sampleRate } } : {}),
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { throw e; },
  });
  videoEncoder.configure({
    codec, width: W, height: H, framerate: fps,
    bitrate: bitrateFor(W, H, opts.quality),
    latencyMode: 'quality',
  });

  const usPerFrame = 1e6 / fps;
  for (let i = 0; i < frameCount; i++) {
    if (opts.signal?.aborted) { videoEncoder.close(); throw new Error('Render cancelled'); }
    drawFrame(model, i / fps, ctx, W, H);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * usPerFrame), duration: Math.round(usPerFrame) });
    videoEncoder.encode(frame, { keyFrame: i % fps === 0 });   // 1s GOP
    frame.close();
    if (videoEncoder.encodeQueueSize > 12) await nextTick();    // bound memory
    if (i % 5 === 0) onProgress(i / frameCount * (hasAudio ? 0.85 : 0.95), 'Encoding video frames');
  }
  await videoEncoder.flush();
  videoEncoder.close();

  if (hasAudio) {
    try { await encodeAudioAAC(opts.audioBuffer, total, muxer, onProgress); }
    catch (e) { console.warn('[video] audio encode failed, exporting silent:', e?.message || e); }
  }

  onProgress(0.98, 'Finalizing MP4');
  muxer.finalize();
  const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
  onProgress(1, 'Done');
  return { blob, ext: 'mp4', mime: 'video/mp4', path: 'webcodecs' };
}

// AAC audio via WebCodecs AudioEncoder, fed from a decoded AudioBuffer.
async function encodeAudioAAC(audioBuffer, maxSec, muxer, onProgress) {
  if (typeof AudioEncoder === 'undefined') throw new Error('No AudioEncoder');
  const ch = Math.min(2, audioBuffer.numberOfChannels);
  const sr = audioBuffer.sampleRate;
  const supported = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: ch, bitrate: 192000 });
  if (!supported?.supported) throw new Error('AAC encode unsupported');

  const enc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { throw e; } });
  enc.configure({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: ch, bitrate: 192000 });

  const totalFrames = Math.min(audioBuffer.length, Math.floor(maxSec * sr));
  const fadeFrames = Math.min(Math.floor(2 * sr), Math.floor(totalFrames / 4)); // 2s out-fade
  // Build planar f32 with a tail fade so the music doesn't cut abruptly.
  const planar = new Float32Array(totalFrames * ch);
  for (let c = 0; c < ch; c++) {
    const src = audioBuffer.getChannelData(c);
    for (let i = 0; i < totalFrames; i++) {
      let s = src[i] || 0;
      const fadeAt = totalFrames - fadeFrames;
      if (i > fadeAt) s *= (totalFrames - i) / fadeFrames;
      planar[c * totalFrames + i] = s * 0.85; // duck slightly under nothing-but-music
    }
  }
  const CHUNK = 4096;
  for (let off = 0; off < totalFrames; off += CHUNK) {
    const n = Math.min(CHUNK, totalFrames - off);
    const data = new Float32Array(n * ch);
    for (let c = 0; c < ch; c++) data.set(planar.subarray(c * totalFrames + off, c * totalFrames + off + n), c * n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round(off / sr * 1e6), data });
    enc.encode(ad); ad.close();
    if (enc.encodeQueueSize > 8) await nextTick();
  }
  await enc.flush(); enc.close();
  onProgress(0.97, 'Mixing audio');
}

// ── Fallback path: MediaRecorder → WebM ─────────────────────────────────────
// Real-time capture; lower fidelity and WebM (not MP4), but works where
// WebCodecs/H.264 encode is unavailable. The agent can still upload WebM to
// most platforms; a later ffmpeg.wasm step can transcode to MP4 if needed.
async function encodeMediaRecorderWebM(model, opts, onProgress) {
  const { width: W, height: H, fps } = model;
  const total = totalDuration(model);
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d', { alpha: false });
  const stream = canvas.captureStream(fps);
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrateFor(W, H, opts.quality) });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((res) => (rec.onstop = res));
  rec.start();

  const frameCount = Math.round(total * fps);
  const startT = performance.now();
  for (let i = 0; i < frameCount; i++) {
    if (opts.signal?.aborted) { rec.stop(); throw new Error('Render cancelled'); }
    drawFrame(model, i / fps, ctx, W, H);
    // pace to ~real time so MediaRecorder samples each frame
    const target = startT + (i / fps) * 1000;
    const wait = target - performance.now();
    if (wait > 0) await sleep(wait);
    if (i % 5 === 0) onProgress(i / frameCount * 0.95, 'Recording video');
  }
  rec.stop();
  await done;
  onProgress(1, 'Done');
  return { blob: new Blob(chunks, { type: mime }), ext: 'webm', mime, path: 'mediarecorder' };
}

// ── helpers ─────────────────────────────────────────────────────────────────
function bitrateFor(W, H, quality) {
  const px = W * H;
  const base = px >= 1920 * 1080 ? 10e6 : px >= 1080 * 1350 ? 7e6 : 6e6;
  return quality === 'high' ? base * 1.4 : quality === 'draft' ? base * 0.5 : base;
}
function makeCanvas(W, H) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(W, H);
  const c = document.createElement('canvas'); c.width = W; c.height = H; return c;
}
function nextTick() { return new Promise((r) => setTimeout(r, 0)); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
