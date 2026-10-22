/* External stems (e.g. from Demucs). They start on every loop boundary,
   are cut to the loop length, and go through the master volume. */
const Stems = (() => {
  let ctx, dest, getLoopSec = () => 0;
  const list = [];
  let playing = [];

  function init(c, destination, loopSecFn) {
    ctx = c; dest = destination; getLoopSec = loopSecFn;
  }

  async function addFiles(files) {
    for (const file of files) {
      try {
        const buf = await ctx.decodeAudioData(await file.arrayBuffer());
        const gain = ctx.createGain();
        gain.gain.value = 0.7;
        gain.connect(dest);
        list.push({name: file.name, buffer: buf, gain, vol: 0.7, muted: false});
        render();
      } catch (e) {
        alert('Could not read ' + file.name + ': ' + e.message);
      }
    }
  }

  // Called by the looper at every loop start (audio-clock time t).
  function startLoop(t, loopSec) {
    for (const s of list) {
      const src = ctx.createBufferSource();
      src.buffer = s.buffer;
      src.connect(s.gain);
      src.start(t, 0, Math.min(loopSec, s.buffer.duration));
      playing.push(src);
      src.onended = () => { playing = playing.filter(x => x !== src); };
    }
  }

  function stopAll() {
    for (const src of playing) { try { src.stop(); } catch (e) {} }
    playing = [];
  }

  function applyGain(s) { s.gain.gain.value = s.muted ? 0 : s.vol; }

  function remove(i) {
    const s = list[i];
    if (!s) return;
    s.gain.disconnect();
    list.splice(i, 1);
    render();
  }

  function render() {
    const el = document.getElementById('stemList');
    el.innerHTML = '';
    const loopSec = getLoopSec();
    list.forEach((s, i) => {
      const row = document.createElement('div'); row.className = 'stem-item';

      const nm = document.createElement('span'); nm.className = 'stem-name'; nm.textContent = s.name;

      const info = document.createElement('span'); info.className = 'stem-info';
      const d = s.buffer.duration;
      info.textContent = d.toFixed(1) + 's, loop is ' + loopSec.toFixed(1) + 's';
      if (Math.abs(d - loopSec) / loopSec > 0.05) {
        info.classList.add('bad');
        info.textContent += d > loopSec
          ? ' (longer: will be cut)'
          : ' (shorter: goes silent early)';
      }

      const vol = document.createElement('input');
      vol.type = 'range'; vol.min = 0; vol.max = 100; vol.value = Math.round(s.vol * 100);
      vol.oninput = () => { s.vol = vol.value / 100; applyGain(s); };

      const mute = document.createElement('button');
      mute.textContent = s.muted ? 'Unmute' : 'Mute';
      mute.classList.toggle('on', s.muted);
      mute.onclick = () => { s.muted = !s.muted; applyGain(s); render(); };

      const rm = document.createElement('button');
      rm.textContent = 'Remove';
      rm.onclick = () => remove(i);

      row.append(nm, info, vol, mute, rm);
      el.appendChild(row);
    });
  }

  return {init, addFiles, startLoop, stopAll, refresh: render};
})();
