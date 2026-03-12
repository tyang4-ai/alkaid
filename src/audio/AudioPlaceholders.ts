// Alkaid (破军) — Procedural Audio Placeholders
// Generates short, characteristic sounds using Web Audio API.
// No external audio files or libraries required.

export class AudioPlaceholders {
  private ctx: AudioContext | null = null;

  getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  /** Resume a suspended AudioContext (browser autoplay policy). */
  async resume(): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  /** Create white noise buffer of given duration. */
  private createNoiseBuffer(duration: number): AudioBuffer {
    const ctx = this.getContext();
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Short noise burst + metallic ring.
   * Noise -> bandpass filter (2000-4000Hz) -> gain envelope (sharp attack, fast decay).
   */
  swordClash(volume: number): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Noise burst through bandpass
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.15);

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 3000;
    bandpass.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    noise.connect(bandpass).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.15);

    // Metallic ring (high sine)
    const ring = ctx.createOscillator();
    ring.type = 'sine';
    ring.frequency.value = 4200;

    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(volume * 0.15, now);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    ring.connect(ringGain).connect(ctx.destination);
    ring.start(now);
    ring.stop(now + 0.2);
  }

  /**
   * Multiple short whooshes simulating arrows in flight.
   * Noise -> highpass filter -> fast staccato gain envelope.
   */
  arrowVolley(volume: number): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    for (let i = 0; i < 5; i++) {
      const offset = i * 0.04 + Math.random() * 0.02;
      const noise = ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer(0.08);

      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 3000 + Math.random() * 2000;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(volume * 0.2, now + offset + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);

      noise.connect(highpass).connect(gain).connect(ctx.destination);
      noise.start(now + offset);
      noise.stop(now + offset + 0.08);
    }
  }

  /**
   * Low rumble + rhythmic hoofbeats.
   * Oscillator (low freq) + noise bursts at intervals.
   */
  cavalryCharge(volume: number): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Low rumble
    const rumble = ctx.createOscillator();
    rumble.type = 'sine';
    rumble.frequency.value = 60;

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(volume * 0.25, now + 0.1);
    rumbleGain.gain.linearRampToValueAtTime(volume * 0.35, now + 0.6);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

    rumble.connect(rumbleGain).connect(ctx.destination);
    rumble.start(now);
    rumble.stop(now + 1.0);

    // Hoofbeats (short low thuds at intervals)
    for (let i = 0; i < 6; i++) {
      const offset = 0.05 + i * 0.13;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(100, now + offset);
      osc.frequency.exponentialRampToValueAtTime(50, now + offset + 0.06);

      const g = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.2, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);

      osc.connect(g).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.07);
    }
  }

  /**
   * Brass-like horn signal.
   * Sawtooth oscillator -> lowpass filter -> gain envelope (slow attack, sustain).
   */
  hornSignal(volume: number): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 220;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 800;
    lowpass.Q.value = 1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.25, now + 0.15);
    gain.gain.linearRampToValueAtTime(volume * 0.2, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc.connect(lowpass).connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.9);
  }

  /**
   * Continuous rain — white noise with bandpass, gentle volume.
   * Returns a stop function for cleanup.
   */
  rain(volume: number): { stop(): void } {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Looping noise — create a long buffer
    const duration = 2;
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(duration);
    noise.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1500;
    bandpass.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.15, now + 0.5);

    noise.connect(bandpass).connect(gain).connect(ctx.destination);
    noise.start(now);

    return {
      stop() {
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        try { noise.stop(ctx.currentTime + 0.35); } catch { /* already stopped */ }
      },
    };
  }

  /**
   * Filtered noise with slow modulation for wind.
   * Noise -> bandpass (200-800Hz) -> LFO on filter frequency.
   * Returns a stop function for cleanup.
   */
  wind(volume: number): { stop(): void } {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(3);
    noise.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 500;
    bandpass.Q.value = 0.3;

    // LFO modulates filter frequency
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.3; // slow modulation
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 300; // modulation depth
    lfo.connect(lfoGain).connect(bandpass.frequency);
    lfo.start(now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.12, now + 0.5);

    noise.connect(bandpass).connect(gain).connect(ctx.destination);
    noise.start(now);

    return {
      stop() {
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        try { noise.stop(ctx.currentTime + 0.6); } catch { /* already stopped */ }
        try { lfo.stop(ctx.currentTime + 0.6); } catch { /* already stopped */ }
      },
    };
  }

  /**
   * Low thud drum beat.
   * Oscillator (sine, 80Hz→40Hz sweep) -> short gain envelope.
   */
  drumBeat(volume: number): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Short UI click.
   * Sine oscillator (800Hz) -> very short envelope (10ms).
   */
  uiClick(volume: number): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.015);
  }

  /**
   * Steady drum rhythm for battle music placeholder.
   * Multiple drum beats in sequence.
   * Returns a stop function for cleanup.
   */
  battleDrums(volume: number): { stop(): void } {
    let stopped = false;
    let nextBeatTimeout: ReturnType<typeof setTimeout> | null = null;

    const playBeat = () => {
      if (stopped) return;
      this.drumBeat(volume * 0.6);
      // Schedule next beat (tempo ~100 BPM)
      nextBeatTimeout = setTimeout(playBeat, 600);
    };

    playBeat();

    return {
      stop() {
        stopped = true;
        if (nextBeatTimeout !== null) clearTimeout(nextBeatTimeout);
      },
    };
  }

  /**
   * Procedural battle music using Chinese pentatonic scale (C, D, E, G, A).
   * Guqin-style arpeggios during calm, adds drums when combat fires.
   * Returns a stop function and a method to intensify when combat occurs.
   */
  battleMusic(volume: number): { stop(): void; intensify(): void } {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Chinese pentatonic scale frequencies (C4, D4, E4, G4, A4, C5, D5, E5)
    const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];

    let stopped = false;
    let intense = false;
    let nextNoteTimeout: ReturnType<typeof setTimeout> | null = null;
    let drumTimeout: ReturnType<typeof setTimeout> | null = null;

    // Master gain for fade-in/out
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(volume * 0.3, now + 2);
    masterGain.connect(ctx.destination);

    // Play a single guqin-like note (plucked string simulation)
    const playNote = (freq: number, time: number, dur: number) => {
      if (stopped) return;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      // Second harmonic for richness
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2;

      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.25, time);
      noteGain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      const noteGain2 = ctx.createGain();
      noteGain2.gain.setValueAtTime(0.08, time);
      noteGain2.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.7);

      osc.connect(noteGain).connect(masterGain);
      osc2.connect(noteGain2).connect(masterGain);
      osc.start(time);
      osc.stop(time + dur);
      osc2.start(time);
      osc2.stop(time + dur);
    };

    // Arpeggio pattern generator
    let noteIndex = 0;
    const patterns = [
      [0, 2, 4, 2],    // C E G E
      [1, 3, 5, 3],    // D G C5 G
      [0, 4, 5, 4],    // C A C5 A
      [2, 4, 6, 4],    // E A D5 A
    ];
    let patternIndex = 0;

    const scheduleArpeggio = () => {
      if (stopped) return;
      const pattern = patterns[patternIndex % patterns.length];
      const baseTime = ctx.currentTime;
      const noteSpacing = intense ? 0.25 : 0.4; // Faster when intense

      for (let i = 0; i < pattern.length; i++) {
        const freq = PENTATONIC[pattern[i]];
        playNote(freq, baseTime + i * noteSpacing, intense ? 0.5 : 0.8);
      }

      patternIndex++;
      noteIndex++;

      // Vary pattern every 4 cycles
      if (noteIndex % 4 === 0) {
        patternIndex = Math.floor(Math.random() * patterns.length);
      }

      const nextDelay = (pattern.length * noteSpacing + (intense ? 0.2 : 0.5)) * 1000;
      nextNoteTimeout = setTimeout(scheduleArpeggio, nextDelay);
    };

    // Drum pattern for intense combat
    const scheduleDrums = () => {
      if (stopped || !intense) {
        drumTimeout = null;
        return;
      }
      this.drumBeat(volume * 0.5);
      drumTimeout = setTimeout(scheduleDrums, 500);
    };

    // Start arpeggios
    scheduleArpeggio();

    return {
      intensify: () => {
        if (intense || stopped) return;
        intense = true;
        // Boost volume slightly
        masterGain.gain.linearRampToValueAtTime(volume * 0.45, ctx.currentTime + 0.5);
        scheduleDrums();
      },
      stop: () => {
        stopped = true;
        // Fade out
        masterGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        if (nextNoteTimeout !== null) clearTimeout(nextNoteTimeout);
        if (drumTimeout !== null) clearTimeout(drumTimeout);
        setTimeout(() => {
          try { masterGain.disconnect(); } catch { /* already disconnected */ }
        }, 2000);
      },
    };
  }

  /** Clean up the AudioContext. */
  destroy(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => { /* ignore */ });
      this.ctx = null;
    }
  }
}
