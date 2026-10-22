# project-3-
# Voice DAW

A browser DAW you control with your mouth, built as a personal experiment.

## Vision
- Hum a melody or beatbox a rhythm into the mic and hear it as any instrument.
- Record loops, layer tracks, then reshape sounds by chatting with an AI agent
  (so there is no need to learn a complicated DAW).
- Genres: hip-hop and electronic music. Use: fresh original tracks for DJ sets.
- Design rule: simple on the surface, full control underneath. Nothing locked, everything undoable.

## Files
- `index.html`, `style.css` – the page
- `js/synth.js` – all sound output (live voice, loop notes, drums, metronome)
- `js/detect.js` – mic analysis: pitch to notes, onsets to kick/snare/hat
- `js/looper.js` – tempo, count-in, recording, loop playback (16th-note grid)
- `js/app.js` – wires the screen to the rest

## Run
Needs https or localhost for mic access. GitHub Pages works. Chrome recommended. Use headphones.

## Status
Round 2: record and loop (drums + melody, overdub, instrument swap).

## Planned (in order)
1. More tracks, per-track volume and mute, save and export WAV
2. Raw voice recording with effects (reverb, delay, pitch, harmony)
3. Chat agent that edits the project through a set of named functions
4. Python helper for stem splitting (Demucs) and song-to-electronic
5. DJ export: BPM/key in filenames, loudness, stems

## Notes for AI coding tools
- Keep changes small, test after each one, commit often.
- Nothing can be heard by the tool: describe audio problems in words.
