// Web Audio API procedural sound engine - 100% reliable, zero asset dependencies

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.driftOsc = null;
    this.driftGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.initEngineAudio();
      this.initialized = true;
    } catch (e) {
      console.warn('WebAudio not supported:', e);
    }
  }

  ensureContext() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.enabled = !this.enabled;
    if (!this.enabled && this.engineGain) {
      this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
      if (this.driftGain) this.driftGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    return this.enabled;
  }

  initEngineAudio() {
    if (!this.ctx) return;

    // Dual oscillator engine sound (low saw + triangle)
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

    // Filter to make it sound like a kart motor
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, this.ctx.currentTime);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc.start();

    // Drift screech noise
    this.driftOsc = this.ctx.createOscillator();
    this.driftOsc.type = 'triangle';
    this.driftOsc.frequency.setValueAtTime(800, this.ctx.currentTime);

    const driftFilter = this.ctx.createBiquadFilter();
    driftFilter.type = 'bandpass';
    driftFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    driftFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.driftOsc.connect(driftFilter);
    driftFilter.connect(this.driftGain);
    this.driftGain.connect(this.ctx.destination);

    this.driftOsc.start();
  }

  updateEngine(speedRatio, isDrifting) {
    if (!this.initialized || !this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Pitch engine based on kart speed
    if (this.engineOsc && this.engineGain) {
      const minFreq = 42;
      const maxFreq = 165;
      const targetFreq = minFreq + speedRatio * (maxFreq - minFreq);
      this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.05);

      const targetGain = 0.02 + speedRatio * 0.06;
      this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);
    }

    // Drift screech
    if (this.driftGain) {
      const driftTarget = isDrifting ? 0.06 : 0;
      this.driftGain.gain.setTargetAtTime(driftTarget, now, 0.03);
    }
  }

  playItemBoxChime() {
    if (!this.enabled) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.3);
    });
  }

  playBoostWhoosh() {
    if (!this.enabled) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.35);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(2500, now + 0.35);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.52);
  }

  playRocketLaunch() {
    if (!this.enabled) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.25);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.32);
  }

  playExplosion() {
    if (!this.enabled) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    // Sub-bass punch
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(120, now);
    subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.45);

    subGain.gain.setValueAtTime(0.35, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.52);

    // Noise blast
    const bufferSize = this.ctx.sampleRate * 0.45;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.45);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.28, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.46);
  }

  playGatlingShot() {
    if (!this.enabled) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  playHitDamage() {
    if (!this.enabled) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  playVictoryFanfare() {
    if (!this.enabled) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    const notes = [
      { f: 523.25, d: 0.15, o: 0 },
      { f: 659.25, d: 0.15, o: 0.16 },
      { f: 783.99, d: 0.15, o: 0.32 },
      { f: 1046.50, d: 0.6, o: 0.48 }
    ];

    notes.forEach(n => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, now + n.o);

      gain.gain.setValueAtTime(0.18, now + n.o);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.o + n.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + n.o);
      osc.stop(now + n.o + n.d + 0.05);
    });
  }
}

export const sounds = new SoundEngine();
