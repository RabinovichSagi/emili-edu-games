#!/usr/bin/env python3
"""
Split a single "A..Z with pauses" MP3 into per-letter audio files.

Input (prepared by you):
  public/english/letters/audio/ttsmaker-file-2026-4-28-20-40-27.mp3

Output:
  public/english/letters/audio/a.wav ... z.wav

Approach:
  - Use ffmpeg's silencedetect to find the silence gaps.
  - Treat each non-silence region between gaps as one letter utterance.
  - Extract 26 segments in order and write WAV for maximum compatibility.
"""

from __future__ import annotations

import argparse
import re
import string
import subprocess
from dataclasses import dataclass
from pathlib import Path


SILENCE_START_RE = re.compile(r"silence_start:\s*(?P<t>[0-9.]+)")
SILENCE_END_RE = re.compile(r"silence_end:\s*(?P<t>[0-9.]+)")


@dataclass(frozen=True)
class Silence:
    start: float
    end: float


def run_capture(cmd: list[str]) -> str:
    p = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    return p.stdout


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def detect_silences(inp: Path, noise_db: str, min_s: float) -> list[Silence]:
    out = run_capture(
        [
            "ffmpeg",
            "-loglevel",
            "info",
            "-hide_banner",
            "-i",
            str(inp),
            "-af",
            f"silencedetect=noise={noise_db}:d={min_s}",
            "-f",
            "null",
            "-",
        ]
    )

    starts: list[float] = []
    ends: list[float] = []
    for line in out.splitlines():
        m = SILENCE_START_RE.search(line)
        if m:
            starts.append(float(m.group("t")))
        m = SILENCE_END_RE.search(line)
        if m:
            ends.append(float(m.group("t")))

    # Pair them in order: start0..end0, start1..end1...
    pairs: list[Silence] = []
    for i in range(min(len(starts), len(ends))):
        s = starts[i]
        e = ends[i]
        if e > s:
            pairs.append(Silence(start=s, end=e))
    return pairs


def build_non_silence_segments(silences: list[Silence]) -> list[tuple[float, float]]:
    """
    Returns non-silence segments as (start, end) seconds based on silence gaps.
    The combined file is expected to look like:
      [voice][silence][voice][silence]...[voice]
    so we include:
      - leading segment: (0, silence0.start)
      - middle segments: (silence_i.end, silence_{i+1}.start)
      - trailing segment: (silence_last.end, duration)
    """
    raise RuntimeError("duration required; call build_non_silence_segments_with_duration")


def build_non_silence_segments_with_duration(silences: list[Silence], duration: float) -> list[tuple[float, float]]:
    segs: list[tuple[float, float]] = []
    if not silences:
        return [(0.0, duration)]

    # leading
    if silences[0].start > 0.05:
        segs.append((0.0, silences[0].start))

    # middle
    for a, b in zip(silences, silences[1:]):
        start = a.end
        end = b.start
        if end - start > 0.05:
            segs.append((start, end))

    # trailing
    last = silences[-1]
    if duration - last.end > 0.05:
        segs.append((last.end, duration))

    return segs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--input",
        default="public/english/letters/audio/ttsmaker-file-2026-4-28-20-40-27.mp3",
        help="Path to the combined MP3",
    )
    ap.add_argument("--outdir", default="public/english/letters/audio", help="Output directory")
    ap.add_argument("--noise", default="-35dB", help="silencedetect noise threshold (e.g. -35dB)")
    ap.add_argument("--min_silence", type=float, default=0.25, help="minimum silence duration in seconds")
    ap.add_argument("--lead_in", type=float, default=0.10, help="seconds to include before each detected segment")
    ap.add_argument("--tail_out", type=float, default=0.10, help="seconds to include after each detected segment")
    args = ap.parse_args()

    inp = Path(args.input)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    # Clean prior letter outputs.
    for ch in string.ascii_lowercase:
        p = outdir / f"{ch}.wav"
        if p.exists():
            p.unlink()

    silences = detect_silences(inp, args.noise, args.min_silence)
    # duration via ffprobe
    dur_out = run_capture(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(inp)])
    duration = float(dur_out.strip())
    segs = build_non_silence_segments_with_duration(silences, duration)

    letters = list(string.ascii_lowercase)
    if len(segs) < len(letters):
        raise SystemExit(f"Detected only {len(segs)} non-silence segments; expected at least {len(letters)}. Try adjusting --noise/--min_silence.")

    # Take first 26 segments in order.
    for ch, (s, e) in zip(letters, segs[:26]):
        # Expand into the surrounding silence to avoid cutting consonant onsets/offsets.
        start = max(0.0, s - args.lead_in)
        end = min(duration, e + args.tail_out)
        end = max(start + 0.02, end)
        dur = end - start
        out = outdir / f"{ch}.wav"

        run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-hide_banner",
                "-ss",
                f"{start:.3f}",
                "-t",
                f"{dur:.3f}",
                "-i",
                str(inp),
                "-vn",
                "-ac",
                "1",
                "-ar",
                "22050",
                "-c:a",
                "pcm_s16le",
                str(out),
            ]
        )
        print(f"Wrote {out}  ({start:.3f}..{end:.3f})")


if __name__ == "__main__":
    main()
