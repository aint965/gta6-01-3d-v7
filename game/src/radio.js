const stations = ['Breakwater 88', 'Night Tide', 'Solmar Common'];
const surf = [64,67,69,67,64,62,60,62,65,69,72,69,67,64,62,60];
const synth = [57,64,69,71,60,67,72,74,55,62,67,69,53,60,65,67];
const bulletins = [
  'Marina ferry service is running on schedule.',
  'The night market opens at dusk in South Market.',
  'New shade trees are coming to the civic park.',
  'The waterfront cooperative has published its latest accounts.',
];

export function createRadio() {
  const display = document.querySelector('#radio-station');
  const caption = document.querySelector('#radio-caption');
  const button = document.querySelector('#radio-mute');
  let station = 0, muted = false, context, master, bus, next = 0, step = 0, timer;
  let scheduled = 0;
  const hz = note => 440 * 2**((note-69)/12);

  function tone(time, frequency, duration, volume, wave = 'sine', end = frequency) {
    const source = context.createOscillator(), envelope = context.createGain();
    source.type = wave;
    source.frequency.setValueAtTime(frequency,time);
    source.frequency.exponentialRampToValueAtTime(end,time+duration);
    envelope.gain.setValueAtTime(0.0001,time);
    envelope.gain.exponentialRampToValueAtTime(volume,time+0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001,time+duration);
    source.connect(envelope).connect(bus);
    source.start(time);
    source.stop(time+duration+0.01);
    source.onended = () => { source.disconnect(); envelope.disconnect(); };
    scheduled++;
  }

  function pulse() {
    if (context.state !== 'running') return;
    next = Math.max(next,context.currentTime+0.01);
    const beat = [0.154,0.183,0.265][station];
    while (next < context.currentTime+0.18) {
      const i = step % 16;
      if (station === 0) {
        tone(next,hz(surf[i]),0.17,0.19,'triangle');
        tone(next+0.077,hz(surf[i]),0.13,0.055,'triangle');
        if (i % 4 === 0) tone(next,hz(i < 8 ? 36 : 41),0.30,0.22,'triangle');
        if (i % 4 === 2) tone(next,135,0.09,0.18,'sine',47);
      } else if (station === 1) {
        tone(next,hz(synth[i]),0.22,0.085,'square');
        if (i % 2 === 0) tone(next,hz(synth[i-i%4]-24),0.25,0.17,'triangle');
        if (i % 4 === 0) tone(next,110,0.13,0.22,'sine',39);
      } else {
        const item = Math.floor(step/32) % bulletins.length;
        if (step % 32 === 0) caption.textContent = bulletins[item];
        if (step % 32 < 4) tone(next,hz([65,72,77,81][i]),0.43,0.16,'triangle');
        if (i === 0 || i === 8) tone(next,hz(41),0.9,0.09,'sine');
        if (i > 3 && i % 2 === 0) tone(next,hz(53 + (item+i)%5),0.15,0.055,'triangle');
      }
      next += beat;
      step++;
    }
  }

  function updateDisplay() {
    display.textContent = stations[station];
    caption.textContent = station === 2 ? bulletins[0] : station === 0 ? 'Surf instrumentals' : 'After-dark synth';
    button.textContent = muted ? 'Unmute · M' : 'Mute · M';
    button.setAttribute('aria-pressed',String(muted));
  }

  function unlock() {
    if (!context && window.AudioContext) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.21;
      master.connect(context.destination);
      bus = context.createGain();
      bus.connect(master);
      timer = setInterval(pulse,50);
      window.addEventListener('pagehide', () => { clearInterval(timer); context.close().catch(() => {}); },{ once:true });
    }
    if (context?.state === 'suspended') context.resume().catch(() => {});
  }

  function toggleMute() {
    unlock();
    muted = !muted;
    master?.gain.setTargetAtTime(muted ? 0 : 0.21,context.currentTime,0.02);
    updateDisplay();
  }

  function cycle() {
    unlock();
    station = (station+1)%stations.length;
    step = 0;
    if (context) {
      const previous = bus;
      previous.gain.setTargetAtTime(0,context.currentTime,0.022);
      setTimeout(() => previous.disconnect(),180);
      bus = context.createGain();
      bus.connect(master);
      next = context.currentTime+0.025;
    }
    updateDisplay();
  }

  button.addEventListener('click',toggleMute);
  updateDisplay();
  return { unlock, cycle, toggleMute, snapshot: () => ({ name: stations[station], muted, scheduled, audio: context?.state ?? 'idle' }) };
}
