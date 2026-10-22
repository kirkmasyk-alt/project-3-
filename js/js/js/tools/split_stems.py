#!/usr/bin/env python3
"""Split a song into stems with Demucs and print its BPM.

Usage:
    python tools/split_stems.py song.mp3
    python tools/split_stems.py song.mp3 --out stems_out
"""
import argparse
import subprocess
import sys
from pathlib import Path


def detect_bpm(path):
    try:
        import librosa
    except ImportError:
        print("librosa not installed, skipping BPM detection (pip install librosa).")
        return None, None
    y, sr = librosa.load(str(path), mono=True)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(tempo[0]) if hasattr(tempo, "__len__") else float(tempo)
    return bpm, len(y) / sr


def main():
    ap = argparse.ArgumentParser(description="Split a song into stems with Demucs.")
    ap.add_argument("song", help="path to an audio file (mp3, wav, ...)")
    ap.add_argument("--out", default="stems_out", help="output folder (default: stems_out)")
    ap.add_argument("--model", default="htdemucs", help="Demucs model (default: htdemucs)")
    args = ap.parse_args()

    song = Path(args.song)
    if not song.exists():
        sys.exit(f"File not found: {song}")

    print(f"Splitting {song.name} with Demucs ({args.model})... this can take a few minutes.")
    cmd = [sys.executable, "-m", "demucs", "-n", args.model, "-o", args.out, str(song)]
    if subprocess.run(cmd).returncode != 0:
        sys.exit("Demucs failed. Check that demucs and ffmpeg are installed (see README).")

    stem_dir = Path(args.out) / args.model / song.stem
    print(f"\nStems written to: {stem_dir}")
    for f in sorted(stem_dir.glob("*.wav")):
        print("  ", f.name)

    bpm, dur = detect_bpm(song)
    if bpm:
        print(f"\nEstimated BPM: {bpm:.1f}")
        print("In Voice DAW: set BPM to about", round(bpm), "and pick Bars so the loop")
        print("length matches a section you want (one bar = 4 beats = "
              f"{240 / bpm:.2f}s at this tempo).")
        print("Stems play from the start of the file, so the first bars are what loops.")
        print("Automatic BPM detection can be off by half or double: trust your ears.")


if __name__ == "__main__":
    main()
