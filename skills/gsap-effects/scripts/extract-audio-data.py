#!/usr/bin/env python3
"""
Extract per-frame audio visualization data from an audio or video file.

Outputs JSON with RMS amplitude and frequency band data at the target FPS,
ready to embed in a HyperFrames composition.

Usage:
    python extract-audio-data.py input.mp3 -o audio-data.json
    python extract-audio-data.py input.mp4 --fps 30 --bands 8 -o audio-data.json

Requirements:
    - Python 3.9+
    - ffmpeg (for decoding audio)
    - numpy (pip install numpy)
"""

import argparse
import json
import subprocess
import struct
import sys
import math

def decode_audio(path: str, sample_rate: int = 44100) -> tuple[bytes, int]:
    """Decode audio to raw PCM s16le mono via ffmpeg."""
    cmd = [
        "ffmpeg", "-i", path,
        "-vn",                    # no video
        "-ac", "1",               # mono
        "-ar", str(sample_rate),  # resample
        "-f", "s16le",            # raw 16-bit signed little-endian
        "-acodec", "pcm_s16le",
        "-loglevel", "error",
        "pipe:1",
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        print(f"ffmpeg error: {result.stderr.decode()}", file=sys.stderr)
        sys.exit(1)
    return result.stdout, sample_rate


def pcm_to_floats(pcm: bytes) -> list[float]:
    """Convert raw PCM s16le bytes to float samples in [-1, 1]."""
    n_samples = len(pcm) // 2
    samples = struct.unpack(f"<{n_samples}h", pcm[:n_samples * 2])
    return [s / 32768.0 for s in samples]


def compute_rms(samples: list[float]) -> float:
    """RMS amplitude of a frame."""
    if not samples:
        return 0.0
    return math.sqrt(sum(s * s for s in samples) / len(samples))


def compute_fft_bands(samples: list[float], sample_rate: int, n_bands: int) -> list[float]:
    """Compute magnitude in frequency bands via FFT (no numpy needed)."""
    n = len(samples)
    if n == 0:
        return [0.0] * n_bands

    # Apply Hann window
    windowed = [samples[i] * (0.5 - 0.5 * math.cos(2 * math.pi * i / n)) for i in range(n)]

    # Use numpy if available for speed, fall back to pure Python
    try:
        import numpy as np
        fft = np.fft.rfft(windowed)
        magnitudes = list(np.abs(fft))
    except ImportError:
        # Pure Python DFT (slow but works without numpy)
        half = n // 2 + 1
        magnitudes = []
        for k in range(half):
            re = sum(windowed[i] * math.cos(2 * math.pi * k * i / n) for i in range(n))
            im = sum(windowed[i] * math.sin(2 * math.pi * k * i / n) for i in range(n))
            magnitudes.append(math.sqrt(re * re + im * im))

    # Frequency resolution
    freq_per_bin = sample_rate / n
    n_bins = len(magnitudes)

    # Split bins into bands using logarithmic spacing (20Hz to Nyquist)
    min_freq = 20.0
    max_freq = sample_rate / 2.0
    band_edges = [min_freq * (max_freq / min_freq) ** (i / n_bands) for i in range(n_bands + 1)]

    bands = []
    for b in range(n_bands):
        low_bin = max(0, int(band_edges[b] / freq_per_bin))
        high_bin = min(n_bins - 1, int(band_edges[b + 1] / freq_per_bin))
        if high_bin <= low_bin:
            high_bin = low_bin + 1
        band_mag = sum(magnitudes[low_bin:high_bin]) / max(1, high_bin - low_bin)
        bands.append(band_mag)

    # Normalize to 0-1 range
    peak = max(bands) if bands else 1.0
    if peak > 0:
        bands = [b / peak for b in bands]

    return bands


def extract(path: str, fps: int, n_bands: int) -> dict:
    """Extract per-frame audio data."""
    print(f"Decoding audio from {path}...", file=sys.stderr)
    pcm, sample_rate = decode_audio(path)
    samples = pcm_to_floats(pcm)
    duration = len(samples) / sample_rate
    frame_size = sample_rate // fps
    total_frames = int(duration * fps)

    print(f"Duration: {duration:.1f}s, {total_frames} frames at {fps}fps", file=sys.stderr)
    print(f"Extracting RMS + {n_bands} frequency bands per frame...", file=sys.stderr)

    frames = []
    for f in range(total_frames):
        start = f * frame_size
        end = start + frame_size
        frame_samples = samples[start:end]

        rms = compute_rms(frame_samples)
        bands = compute_fft_bands(frame_samples, sample_rate, n_bands)

        frames.append({
            "time": round(f / fps, 4),
            "rms": round(rms, 4),
            "bands": [round(b, 4) for b in bands],
        })

    # Normalize RMS to 0-1 across the whole track
    peak_rms = max(f["rms"] for f in frames) if frames else 1.0
    if peak_rms > 0:
        for f in frames:
            f["rms"] = round(f["rms"] / peak_rms, 4)

    return {
        "duration": round(duration, 4),
        "fps": fps,
        "bands": n_bands,
        "totalFrames": total_frames,
        "frames": frames,
    }


def main():
    parser = argparse.ArgumentParser(description="Extract per-frame audio visualization data")
    parser.add_argument("input", help="Audio or video file")
    parser.add_argument("-o", "--output", default="audio-data.json", help="Output JSON path")
    parser.add_argument("--fps", type=int, default=30, help="Frames per second (default: 30)")
    parser.add_argument("--bands", type=int, default=8, help="Number of frequency bands (default: 8)")
    args = parser.parse_args()

    data = extract(args.input, args.fps, args.bands)

    with open(args.output, "w") as f:
        json.dump(data, f)

    print(f"Wrote {args.output} ({data['totalFrames']} frames, {data['bands']} bands)", file=sys.stderr)


if __name__ == "__main__":
    main()
