/* Mic analysis: pitch to notes, onsets to kick/snare/hat. */
const Detect = (() => {
  const S = {gate: 0.022, kThr: 0.47, hThr: 0.37};
  let ctx, an, tbuf, fbuf, cb = {}, mode = 'hum';
  let prevRms = 0, lastHit = 0, pending = false, cand = -1, cc = 0, cur = -1, silent = 0;

  function init(c, a, callbacks) {
    ctx = c; an = a; cb = callbacks;
    tbuf = new Float32Array(an.fftSize);
    fbuf = new Float32Array(an.frequencyBinCount);
  }
  function set(k, v) { S[k] = v; }
  function setMode(m) { endNote(); mode = m; pending = false; }
  function endNote() {
    if (cur >= 0 && cb.onNoteOff) cb.onNoteOff(ctx.currentTime);
    cur = -1; cand = -1; cc = 0;
  }

  function pitch(b, sr) {
    const N = 1024, minL = Math.floor(sr / 900), maxL = Math.floor(sr / 70);
    let e0 = 0;
    for (let i = 0; i < N; i++) e0 += b[i] * b[i];
    const c = new Float32Array(maxL + 2);
    let best = 0, bl = 0;
    for (let l = minL; l <= maxL; l++) {
      let s = 0, e1 = 0;
      for (let i = 0; i < N; i++) { s += b[i] * b[i + l]; e1 += b[i + l] * b[i + l]; }
      c[l] = s / Math.sqrt(e0 * e1 + 1e-9);
      if (c[l] > best) { best = c[l]; bl = l; }
    }
    if (best < 0.8) return 0;
    for (let l = minL + 1; l < bl; l++) {
      if (c[l] > 0.9 * best && c[l] >= c[l - 1] && c[l] >= c[l + 1]) { bl = l; break; }
    }
    const a = c[bl - 1], m = c[bl], d = c[bl + 1], den = 2 * (a - 2 * m + d);
    const shift = den ? (a - d) / den : 0;
    return sr / (bl + (isFinite(shift) ? shift : 0));
  }

  function hum(rms) {
    const f = rms > S.gate ? pitch(tbuf, ctx.sampleRate) : 0;
    if (!f) { if (++silent > 3 && cur >= 0) endNote(); return; }
    silent = 0;
    const m = Math.round(69 + 12 * Math.log2(f / 440));
    if (m === cand) cc++; else { cand = m; cc = 1; }
    if (cc >= 3 && m !== cur) {
      if (cur >= 0 && cb.onNoteOff) cb.onNoteOff(ctx.currentTime);
      cur = m;
      if (cb.onNoteOn) cb.onNoteOn(m, ctx.currentTime, f);
    }
  }

  function beat(rms, now) {
    if (pending) { pending = false; classify(); }
    else if (rms > S.gate && rms > prevRms * 1.6 && now - lastHit > 100) { pending = true; lastHit = now; }
    prevRms = Math.max(rms, prevRms * 0.85);
  }
  function classify() {
    an.getFloatFrequencyData(fbuf);
    const bw = ctx.sampleRate / an.fftSize;
    let lo = 0, mi = 0, hi = 0;
    for (let i = 1; i < fbuf.length; i++) {
      const f = i * bw, p = Math.pow(10, fbuf[i] / 10);
      if (f < 250) lo += p; else if (f < 3000) mi += p; else hi += p;
    }
    const t = lo + mi + hi + 1e-12, L = lo / t, H = hi / t;
    const type = L > S.kThr ? 'kick' : (H > S.hThr ? 'hat' : 'snare');
    if (cb.onHit) cb.onHit(type, ctx.currentTime, L, H);
  }

  function tick(now) {
    if (!an) return 0;
    an.getFloatTimeDomainData(tbuf);
    let s = 0;
    for (let i = 1536; i < 2048; i++) s += tbuf[i] * tbuf[i];
    const rms = Math.sqrt(s / 512);
    if (mode === 'hum') hum(rms); else beat(rms, now);
    return rms;
  }
  return {init, set, setMode, tick};
})();
