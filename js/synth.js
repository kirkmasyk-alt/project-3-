/* All sound output: live voice, loop notes, drums, metronome. */
const Synth = (() => {
  const INST = {
    bass: {t1:'sawtooth', t2:'square',   det:6,  cut:700,  atk:0.01, rel:0.12, oct:-1},
    sub:  {t1:'sine',     t2:'sine',     det:0,  cut:400,  atk:0.01, rel:0.20, oct:-1},
    lead: {t1:'sawtooth', t2:'sawtooth', det:12, cut:3500, atk:0.01, rel:0.10, oct:0},
    pad:  {t1:'triangle', t2:'sawtooth', det:8,  cut:1200, atk:0.15, rel:0.50, oct:0}
  };
  let ctx, master, noise, live, cur = 'bass';
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function init(c) {
    ctx = c;
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; g.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    o1.start(); o2.start();
    live = {o1, o2, f, g};
    setInst(cur);
  }
  function getMaster() { return master; }
  function setVolume(v) { if (master) master.gain.value = v; }
  function setInst(k) {
    cur = k;
    if (!live) return;
    const i = INST[k];
    live.o1.type = i.t1; live.o2.type = i.t2;
    live.o2.detune.value = i.det; live.f.frequency.value = i.cut;
  }
  function liveOn(m) {
    const i = INST[cur], f = hz(m) * Math.pow(2, i.oct), t = ctx.currentTime;
    live.o1.frequency.setTargetAtTime(f, t, 0.015);
    live.o2.frequency.setTargetAtTime(f, t, 0.015);
    live.g.gain.setTargetAtTime(0.5, t, i.atk);
  }
  function liveOff() { live.g.gain.setTargetAtTime(0, ctx.currentTime, INST[cur].rel / 3); }

  function note(m, dur, t) {
    const i = INST[cur], f = hz(m) * Math.pow(2, i.oct), d = Math.max(dur, i.atk);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    const fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = i.t1; o2.type = i.t2; o2.detune.value = i.det;
    o1.frequency.value = f; o2.frequency.value = f;
    fl.type = 'lowpass'; fl.frequency.value = i.cut;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + i.atk);
    g.gain.setValueAtTime(0.5, t + d);
    g.gain.linearRampToValueAtTime(0.0001, t + d + i.rel);
    o1.connect(fl); o2.connect(fl); fl.connect(g); g.connect(master);
    const end = t + d + i.rel + 0.05;
    o1.start(t); o2.start(t); o1.stop(end); o2.stop(end);
  }

  function drum(type, t) {
    if (type === 'kick') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.45);
      return;
    }
    const hat = type === 'hat', dur = hat ? 0.06 : 0.2;
    const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = noise;
    f.type = 'highpass'; f.frequency.value = hat ? 7000 : 1500;
    g.gain.setValueAtTime(hat ? 0.5 : 0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + dur + 0.02);
    if (!hat) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 190;
      og.gain.setValueAtTime(0.5, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.15);
    }
  }
  function click(t, accent) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = accent ? 1600 : 1000;
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.05);
  }
  return {init, getMaster, setVolume, setInst, liveOn, liveOff, note, drum, click};
})();
