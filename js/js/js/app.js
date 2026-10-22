/* Wires the screen to Synth, Detect, Looper and Stems. */
(function () {
  const $ = id => document.getElementById(id);
  const NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const COL = {kick: '#fb923c', snare: '#38bdf8', hat: '#34d399'};
  let ctx, stream, analyser, mode = 'hum', prevS = -1;
  const noteName = m => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

  async function ensureMic() {
    if (ctx) return true;
    try {
      const c = new (window.AudioContext || window.webkitAudioContext)({latencyHint: 'interactive'});
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false}
      });
      ctx = c;
    } catch (e) {
      alert('Mic error: ' + e.message);
      return false;
    }
    await ctx.resume();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0;
    ctx.createMediaStreamSource(stream).connect(analyser);
    Synth.init(ctx);
    Stems.init(ctx, Synth.getMaster(), () => Looper.loopSeconds());
    applySettings();
    Detect.init(ctx, analyser, {
      onHit(type, t, L, H) {
        Synth.drum(type, ctx.currentTime); Looper.hit(type, t); flash(type);
        $('stats').textContent = `Last: ${type}  (L${Math.round(L*100)} H${Math.round(H*100)})`;
      },
      onNoteOn(m, t, f) { Synth.liveOn(m); Looper.noteOn(m, t); show(noteName(m), Math.round(f) + ' Hz'); },
      onNoteOff(t) { Synth.liveOff(); Looper.noteOff(t); show('–', 'Hum a steady note'); }
    });
    Looper.init(ctx, {
      onState: setState,
      onStep: (s, t) => setTimeout(() => mark(s), Math.max(0, (t - ctx.currentTime) * 1000)),
      onChange: renderGrid,
      onLoop: (t, sec) => Stems.startLoop(t, sec)
    });
    Detect.setMode(mode);
    requestAnimationFrame(loop);
    return true;
  }

  function loop(now) {
    const rms = Detect.tick(now);
    $('lvl').style.width = Math.min(100, rms * 400) + '%';
    requestAnimationFrame(loop);
  }
  function show(n, h) { $('note').textContent = n; $('hz').textContent = h; }
  function flash(type) {
    const el = $('p-' + type);
    el.style.background = COL[type]; el.style.color = '#0B0D12';
    setTimeout(() => { el.style.background = ''; el.style.color = ''; }, 120);
  }

  function renderGrid() {
    const T = Looper.total(), g = $('grid');
    g.innerHTML = ''; prevS = -1;
    [['drums', 'Drums'], ['melody', 'Melody']].forEach(([k, label]) => {
      const row = document.createElement('div'); row.className = 'track-row';
      const nm = document.createElement('span'); nm.className = 'track-label'; nm.textContent = label;
      const cells = document.createElement('div'); cells.className = 'cells';
      cells.style.gridTemplateColumns = `repeat(${T},1fr)`;
      for (let s = 0; s < T; s++) {
        const c = document.createElement('i');
        if (s % 4 === 0) c.className = 'q';
        cells.appendChild(c);
      }
      Looper.tracks[k].forEach(e => {
        for (let j = 0; j < (e.len || 1); j++) {
          const c = cells.children[e.step + j];
          if (c) c.classList.add(k === 'drums' ? 'd' : 'm');
        }
      });
      row.appendChild(nm); row.appendChild(cells); g.appendChild(row);
    });
  }
  function mark(s) {
    document.querySelectorAll('.cells').forEach(r => {
      if (prevS >= 0 && r.children[prevS]) r.children[prevS].classList.remove('now');
      if (s >= 0 && r.children[s]) r.children[s].classList.add('now');
    });
    prevS = s;
  }

  const LABELS = {
    stopped:   ['Record', 'Play', 'Ready'],
    countin:   ['Get ready…', 'Stop', 'Count-in'],
    recording: ['Recording', 'Stop', 'Recording…'],
    armed:     ['Overdub next', 'Stop', 'Armed for next pass'],
    playing:   ['Overdub', 'Stop', 'Playing']
  };
  function setState(st) {
    const l = LABELS[st];
    $('rec').textContent = l[0]; $('play').textContent = l[1]; $('status').textContent = l[2];
    $('rec').classList.toggle('on', st === 'recording' || st === 'countin' || st === 'armed');
    $('bpm').disabled = $('bars').disabled = st !== 'stopped';
    if (st === 'stopped') Stems.stopAll();
  }

  $('rec').onclick = async () => {
    if (!(await ensureMic())) return;
    if (Looper.isRunning()) Looper.arm(); else Looper.start(true);
  };
  $('play').onclick = async () => {
    if (!(await ensureMic())) return;
    if (Looper.isRunning()) Looper.stop(); else Looper.start(false);
  };
  $('clrD').onclick = () => Looper.clear('drums');
  $('clrM').onclick = () => Looper.clear('melody');

  function setMode(m) {
    mode = m; Looper.setMode(m);
    $('tHum').setAttribute('aria-pressed', m === 'hum');
    $('tBeat').setAttribute('aria-pressed', m === 'beat');
    $('humBox').style.display = m === 'hum' ? '' : 'none';
    $('beatBox').style.display = m === 'beat' ? '' : 'none';
    if (ctx) Detect.setMode(m);
  }
  function applySettings() {
    Synth.setVolume($('vol').value / 100);
    Synth.setInst($('inst').value);
    Detect.set('gate', 0.002 + 0.08 * Math.pow(1 - $('gate').value / 100, 2));
    Detect.set('kThr', 0.8 - 0.6 * $('kSplit').value / 100);
    Detect.set('hThr', 0.7 - 0.6 * $('hSplit').value / 100);
  }
  $('tHum').onclick = () => setMode('hum');
  $('tBeat').onclick = () => setMode('beat');
  ['vol', 'inst', 'gate', 'kSplit', 'hSplit'].forEach(id => {
    $(id).oninput = () => ctx && applySettings();
  });
  $('bpm').onchange = e => {
    const v = Math.min(180, Math.max(60, parseInt(e.target.value) || 100));
    e.target.value = v; Looper.setBpm(v); if (ctx) Stems.refresh();
  };
  $('bars').onchange = e => {
    Looper.setBars(parseInt(e.target.value)); renderGrid(); if (ctx) Stems.refresh();
  };
  $('metro').onchange = e => Looper.setMetro(e.target.checked);

  const drop = $('drop'), fileIn = $('fileIn');
  drop.onclick = () => fileIn.click();
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('drag'); };
  drop.ondragleave = () => drop.classList.remove('drag');
  drop.ondrop = async e => {
    e.preventDefault(); drop.classList.remove('drag');
    if (!(await ensureMic())) return;
    Stems.addFiles(e.dataTransfer.files);
  };
  fileIn.onchange = async () => {
    if (!(await ensureMic())) return;
    Stems.addFiles(fileIn.files);
  };

  renderGrid();
})();
