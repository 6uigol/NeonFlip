
class AudioService {
  private ctx: AudioContext | null = null;
  private masterVolume: GainNode | null = null;
  private isEnabled: boolean = false;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterVolume = this.ctx.createGain();
    this.masterVolume.connect(this.ctx.destination);
    this.masterVolume.gain.value = 0.6;
    this.isEnabled = true;
  }

  resume() {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playJump() {
    if (!this.ctx || !this.masterVolume) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.masterVolume);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playCollect() {
    if (!this.ctx || !this.masterVolume) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.masterVolume);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playExplosion() {
    if (!this.ctx || !this.masterVolume) return;
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterVolume);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.5);
  }

  // Simple synth loop for BGM
  private bgmOscs: OscillatorNode[] = [];
  private bgmGains: GainNode[] = [];
  private bgmInterval: any = null;
  private step: number = 0;

  startBGM() {
    if (!this.ctx || !this.masterVolume || this.bgmInterval) return;
    
    const tempo = 120;
    const stepTime = 60 / tempo / 2; // 8th notes

    this.bgmInterval = setInterval(() => {
      if (!this.ctx || !this.masterVolume || !this.isEnabled) return;
      
      const time = this.ctx.currentTime;
      
      // Kick drum every 4 steps
      if (this.step % 4 === 0) {
        this.playKick(time);
      }
      
      // Bass synth
      if (this.step % 2 === 0) {
        const notes = [55, 55, 65, 48]; // G1, G1, F2, C1
        this.playBass(notes[Math.floor(this.step / 4) % notes.length], time);
      }

      // Hi-hat every 2 steps (offset)
      if (this.step % 2 === 1) {
        this.playHat(time);
      }

      this.step = (this.step + 1) % 16;
    }, stepTime * 1000);
  }

  private playKick(time: number) {
    if (!this.ctx || !this.masterVolume) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
    osc.connect(gain);
    gain.connect(this.masterVolume);
    osc.start(time);
    osc.stop(time + 0.5);
  }

  private playBass(freq: number, time: number) {
    if (!this.ctx || !this.masterVolume) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    osc.connect(gain);
    gain.connect(this.masterVolume);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  private playHat(time: number) {
    if (!this.ctx || !this.masterVolume) return;
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 5000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterVolume);
    noise.start(time);
    noise.stop(time + 0.05);
  }

  stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  setMute(mute: boolean) {
    if (this.masterVolume) {
      this.masterVolume.gain.setTargetAtTime(mute ? 0 : 0.6, this.ctx?.currentTime || 0, 0.1);
    }
  }
}

export const audioService = new AudioService();
