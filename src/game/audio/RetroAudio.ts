// Retro 16-bit Chiptune & Sound Effects Synthesizer (Web Audio API)

class RetroAudioEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private volume: number = 0.65;
  private bgmMode: 'none' | 'menu' | 'exploration' | 'victory' = 'none';
  private bgmInterval: number | null = null;
  private bgmStep: number = 0;

  constructor() {
    try {
      const savedMute = localStorage.getItem('math_maze_muted');
      const savedVol = localStorage.getItem('math_maze_volume');
      if (savedMute !== null) this.muted = savedMute === 'true';
      if (savedVol !== null) this.volume = Math.max(0, Math.min(1, Number(savedVol)));
    } catch {
      // Ignore storage access errors
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    try {
      localStorage.setItem('math_maze_muted', String(mute));
    } catch {}
    if (mute) {
      this.stopBgm();
    }
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('math_maze_volume', String(this.volume));
    } catch {}
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'square',
    delaySec: number = 0,
    gainScale: number = 0.18
  ) {
    const ctx = this.ensureContext();
    if (!ctx || this.muted || this.volume <= 0.01) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    const peak = Math.max(0.001, this.volume * gainScale);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  public playButtonClick(): void {
    this.playTone(660, 0.05, 'square', 0, 0.14);
    this.playTone(880, 0.06, 'square', 0.04, 0.12);
  }

  public playFootstep(): void {
    const pitchVariance = 0.92 + Math.random() * 0.16;
    this.playTone(135 * pitchVariance, 0.04, 'triangle', 0, 0.08);
  }

  public playKeyCollected(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      this.playTone(f, 0.11, 'square', idx * 0.065, 0.2);
    });
  }

  public playCorrectAnswer(): void {
    this.playTone(587.33, 0.09, 'square', 0, 0.2);
    this.playTone(880, 0.18, 'square', 0.08, 0.22);
  }

  public playWrongAnswer(): void {
    this.playTone(196, 0.16, 'sawtooth', 0, 0.24);
    this.playTone(146.83, 0.25, 'sawtooth', 0.14, 0.24);
  }

  public playDoorOpening(): void {
    const notes = [220, 277.18, 329.63, 440, 554.37, 659.25];
    notes.forEach((f, idx) => {
      this.playTone(f, 0.14, 'triangle', idx * 0.08, 0.22);
    });
  }

  public playVictory(): void {
    const melody = [523.25, 659.25, 783.99, 659.25, 1046.5];
    const times = [0, 0.12, 0.24, 0.36, 0.48];
    const durations = [0.1, 0.1, 0.1, 0.1, 0.4];
    melody.forEach((f, i) => {
      this.playTone(f, durations[i], 'square', times[i], 0.22);
    });
  }

  public playGameOver(): void {
    const melody = [392.0, 349.23, 329.63, 261.63];
    melody.forEach((f, i) => {
      this.playTone(f, 0.2, 'sawtooth', i * 0.18, 0.18);
    });
  }

  public startBgm(mode: 'menu' | 'exploration' | 'victory'): void {
    if (this.bgmMode === mode && this.bgmInterval !== null) return;
    this.stopBgm();
    this.bgmMode = mode;
    this.bgmStep = 0;

    const menuSeq = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 349.23];
    const exploreSeq = [220.0, 261.63, 329.63, 293.66, 246.94, 329.63, 220.0, 196.0];
    const victorySeq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 880.0, 1046.5];

    const seq = mode === 'menu' ? menuSeq : mode === 'exploration' ? exploreSeq : victorySeq;

    this.bgmInterval = window.setInterval(() => {
      if (this.muted || this.volume <= 0.01) return;
      const note = seq[this.bgmStep % seq.length];
      this.bgmStep++;
      this.playTone(note, 0.18, 'triangle', 0, 0.05);
    }, 320);
  }

  public stopBgm(): void {
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    this.bgmMode = 'none';
  }
}

export const retroAudio = new RetroAudioEngine();
