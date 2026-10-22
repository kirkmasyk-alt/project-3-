/* Tempo, count-in, recording, loop playback (16th-note grid). */
const Looper = (() => {
  const S = {bpm: 100, bars: 2, metro: true, mode: 'hum',
             running: false, recording: false, armed: false, pending: false, recEnd: 0};
  const tracks = {drums: [], melody: []};
  let ctx, opts = {}, timer, n = 0, nextTime = 0, t0 = 0, open = null;
  const sd = () => 60 / S.bpm / 4;
  const total = () => S.bars * 16;
  const loopSeconds = () => total() * sd();

  function init(c, o) { ctx = c; opts = o; }
  function status() {
    if (!S.running) return 'stopped';
    if (S.recording) return 'recording';
    if (S.armed) return 'armed';
    if (n < 0) return 'countin';
    return 'playing';
  }
  function emit() { if (opts.onState) opts.onState(status()); }
  function changed() { if (opts.onChange) opts.onChange(); }

  function start(rec) {
    if (S.running) return;
    S.running = true; S.pending = rec; S.recording = false; S.armed = false;
    n = rec ? -16 : 0;
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(pump, 25);
    pump(); emit();
  }
  function stop() {
    if (!S.running) return;
    clearInterval(timer);
    closeNote(ctx.currentTime);
    S.running = false; S.recording = false; S.armed = false; S.pending = false;
    emit();
  }
  function arm() {
    if (!S.running || S.recording) return;
    S.armed = !S.armed; emit();
  }

  function pump() {
    while (nextTime < ctx.currentTime + 0.12) { sched(n, nextTime); nextTime += sd(); n++; }
  }
  function sched(k, t) {
    const T = total();
    if (k >= 0) {
      const s = k % T;
      if (s === 0) {
        t0 = t;
        if (S.recording && k > 0) { closeNote(t); S.recording = false; S.recEnd = t + 0.06; }
        else if (S.pending || S.armed) { S.recording = true; S.pending = false; S.armed = false; }
        emit();
        // tell stems a new pass of the loop starts at audio time t
        if (opts.onLoop) opts.onLoop(t, loopSeconds());
      }
      for (const e of tracks.drums) if (e.step === s) Synth.drum(e.type, t);
      for (const e of tracks.melody) if (e.step === s) Synth.note(e.midi, e.len * sd(), t);
    }
    if (S.metro && k % 4 === 0) Synth.click(t, k % 16 === 0);
    if (opts.onStep) opts.onStep(k >= 0 ? k % T : -1, t);
  }

  const active = () => S.recording || ctx.currentTime < S.recEnd;
  function stepAt(time, lat) {
    const T = total(), k = Math.round((time - lat - t0) / sd());
    return ((k % T) + T) % T;
  }
  function hit(type, t) {
    if (!active() || S.mode !== 'beat') return;
    const s = stepAt(t, 0.04);
    if (!tracks.drums.some(e => e.step === s && e.type === type)) { tracks.drums.push({step: s, type}); changed(); }
  }
  function noteOn(m, t) { if (active() && S.mode === 'hum') open = {m, t}; }
  function noteOff(t) { closeNote(t); }
  function closeNote(t) {
    if (!open) return;
    const T = total(), s = stepAt(open.t, 0.07);
    const len = Math.max(1, Math.min(Math.round((t - open.t) / sd()), T - s));
    tracks.melody.push({step: s, midi: open.m, len});
    open = null; changed();
  }

  function clear(which) { tracks[which].length = 0; changed(); }
  function setBpm(v) { if (!S.running) S.bpm = v; }
  function setBars(v) { if (!S.running) S.bars = v; }
  function setMetro(v) { S.metro = v; }
  function setMode(m) { S.mode = m; }
  return {init, start, stop, arm, hit, noteOn, noteOff, clear, setBpm, setBars, setMetro, setMode,
          tracks, total, loopSeconds, status, isRunning: () => S.running};
})();
