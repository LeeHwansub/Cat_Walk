import { analyzeClip, MEOW_CLIPS, pickMeowClip, PURR_FILES, PURR_LOWPASS_HZ, PURR_MAX_GAIN, sizePitch, type MeowMood } from './clips';

/**
 * 사운드 시스템 (기획서 10장). Web Audio API만 사용한다.
 *
 * 울음소리·골골송: 사용자가 제공한 파일(public/assets/sounds)을 재생한다. (docs/ASSETS.md)
 * 파일을 불러오지 못하면 코드로 합성한 소리로 대신한다.
 * 환경음(바람, 새소리): 코드로 합성한다.
 */
type SynthKind = 'short' | 'long' | 'trill';

interface LoadedClip {
  buffer: AudioBuffer;
  /** 앞쪽 무음을 건너뛸 시작 위치 (초) */
  start: number;
  /** 음량 맞춤 배율 */
  gain: number;
}

const SOUND_DIR = `${import.meta.env.BASE_URL}assets/sounds/`;

const MIN_GAP = 4; // 울음소리 사이 최소 간격 (초)

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private catBus!: GainNode;
  /** 고양이 소리 리미터: 순간적으로 튀는 소리를 눌러 클리핑을 막는다 */
  private catLimiter!: DynamicsCompressorNode;
  private ambBus!: GainNode;
  private noise!: AudioBuffer;
  private lastMeowAt = -100;
  private lastKind: SynthKind | null = null;
  private lastClipId: string | null = null;
  private readonly clips = new Map<string, LoadedClip>();
  private readonly purrClips: LoadedClip[] = [];
  private lastPurrIndex = -1;
  private kitten = false;
  /** 크기 조절 값에 따른 울음 음높이 배율 */
  private pitch = 1;
  /** 마지막으로 재생한 소리 (점검용) */
  lastPlayed: string | null = null;
  private purrGain: GainNode | null = null;
  private purrUntil = 0;
  private birdTimer = 0;
  private muteAll = false;
  private muteCat = false;

  /** 브라우저는 사용자 입력 전 소리를 막으므로 첫 클릭 때 호출한다 */
  init(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.catBus = this.ctx.createGain();
    this.catBus.connect(this.master);
    this.catLimiter = this.ctx.createDynamicsCompressor();
    this.catLimiter.threshold.value = -1; // 순간적으로 튀는 소리만 누른다
    this.catLimiter.knee.value = 0;
    this.catLimiter.ratio.value = 20;
    this.catLimiter.attack.value = 0.002;
    this.catLimiter.release.value = 0.05; // 빨리 풀어서 이어지는 소리(골골송)가 같이 작아지지 않게
    this.catLimiter.connect(this.catBus);
    this.ambBus = this.ctx.createGain();
    this.ambBus.gain.value = 0.6;
    this.ambBus.connect(this.master);
    this.noise = this.makeNoise(2);
    this.applyMute();
    this.startWind();
    void this.loadClips();
  }

  /** 불러온 소리 파일 수 */
  get loadedCount(): number {
    return this.clips.size + this.purrClips.length;
  }

  /** 새끼 고양이면 새끼 울음 또는 높은 음 울음을 쓰고, 크기가 작을수록 음을 약간 높인다 */
  setVoice(kitten: boolean, size: number): void {
    this.kitten = kitten;
    this.pitch = sizePitch(size);
  }

  private async loadClips(): Promise<void> {
    const load = async (file: string, opts: { maxGain?: number; peakLimit?: number | null; lowpassHz?: number } = {}): Promise<LoadedClip | null> => {
      try {
        const res = await fetch(SOUND_DIR + file);
        if (!res.ok) throw new Error(`${res.status}`);
        const buffer = await this.ctx!.decodeAudioData(await res.arrayBuffer());
        // 모든 채널을 함께 측정한다 (스테레오는 두 채널 음량의 합, BS.1770)
        const channels = Array.from({ length: buffer.numberOfChannels }, (_, ch) => buffer.getChannelData(ch));
        const { start, gain } = analyzeClip(channels, buffer.sampleRate, opts);
        return { buffer, start, gain };
      } catch (err) {
        console.warn(`[audio] ${file} 불러오기 실패, 합성음으로 대신합니다`, err);
        return null;
      }
    };
    await Promise.all([
      ...MEOW_CLIPS.map(async (c) => {
        const loaded = await load(c.file);
        if (loaded) this.clips.set(c.id, loaded);
      }),
      ...PURR_FILES.map(async (f) => {
        const p = await load(f, { maxGain: PURR_MAX_GAIN, peakLimit: null, lowpassHz: PURR_LOWPASS_HZ });
        if (p) this.purrClips.push(p);
      }),
    ]);
  }

  setMute(all: boolean, cat: boolean): void {
    this.muteAll = all;
    this.muteCat = cat;
    this.applyMute();
  }

  private applyMute(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muteAll ? 0 : 0.9, t, 0.05);
    this.catBus.gain.setTargetAtTime(this.muteCat ? 0 : 1, t, 0.05);
  }

  /** 상황에 맞는 울음을 재생한다. 직전 울음 직후라면 재생하지 않고 false. */
  meow(mood: MeowMood = 'normal'): boolean {
    const ctx = this.ctx;
    if (!ctx) return false;
    const now = ctx.currentTime;
    if (now - this.lastMeowAt < MIN_GAP) return false;
    this.lastMeowAt = now;

    const loaded = MEOW_CLIPS.filter((c) => this.clips.has(c.id));
    const pick = pickMeowClip(loaded, mood, this.kitten, this.lastClipId, Math.random);
    if (pick) {
      const clip = this.clips.get(pick.clip.id)!;
      const src = ctx.createBufferSource();
      src.buffer = clip.buffer;
      src.playbackRate.value = pick.rate * this.pitch * (0.97 + Math.random() * 0.06); // 같은 파일도 조금씩 다르게
      const g = ctx.createGain();
      g.gain.value = clip.gain; // 모든 소리를 같은 평균 음량으로 (analyzeClip)
      src.connect(g).connect(this.catLimiter);
      src.start(now + 0.01, clip.start);
      this.lastClipId = pick.clip.id;
      this.lastPlayed = pick.clip.id;
      return true;
    }
    const kind: SynthKind = mood === 'hungry' ? 'long' : mood === 'curious' ? 'trill' : this.lastKind === 'short' ? 'long' : 'short';
    this.synthMeow(kind, now);
    return true;
  }

  private synthMeow(k: SynthKind, now: number): void {
    const ctx = this.ctx!;
    this.lastKind = k;
    this.lastPlayed = `synth-${k}`;

    const dur = k === 'short' ? 0.32 : k === 'long' ? 0.75 : 0.45;
    const base = (k === 'short' ? 620 : k === 'long' ? 520 : 480) * this.pitch * (this.kitten ? 1.25 : 1) * (0.92 + Math.random() * 0.16);
    const t0 = now + 0.01;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * 0.9, t0);
    osc.frequency.linearRampToValueAtTime(base * 1.35, t0 + dur * 0.35);
    osc.frequency.exponentialRampToValueAtTime(base * 0.75, t0 + dur);

    // '이-아-오' 같은 야옹 소리를 만드는 포먼트 필터 두 개
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 5;
    f1.frequency.setValueAtTime(900, t0);
    f1.frequency.linearRampToValueAtTime(1500, t0 + dur * 0.4);
    f1.frequency.linearRampToValueAtTime(700, t0 + dur);
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.Q.value = 8;
    f2.frequency.setValueAtTime(2600, t0);
    f2.frequency.linearRampToValueAtTime(3200, t0 + dur * 0.4);
    f2.frequency.linearRampToValueAtTime(2200, t0 + dur);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(0.5, t0 + 0.04);
    env.gain.setValueAtTime(0.5, t0 + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    let src: AudioNode = osc;
    if (k === 'trill') {
      // 짧은 '므릅' 소리: 빠른 진폭 변조
      const am = ctx.createGain();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 28;
      const depth = ctx.createGain();
      depth.gain.value = 0.5;
      lfo.connect(depth).connect(am.gain);
      am.gain.value = 0.5;
      osc.connect(am);
      lfo.start(t0);
      lfo.stop(t0 + dur);
      src = am;
    }
    const g1 = ctx.createGain();
    g1.gain.value = 1;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    src.connect(f1).connect(g1).connect(env);
    src.connect(f2).connect(g2).connect(env);
    env.connect(this.catBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** 골골송. 이미 골골거리는 중이면 겹쳐 재생하지 않는다. */
  purr(seconds: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.purrGain && now < this.purrUntil) return;
    if (this.purrClips.length > 0) {
      // 직전과 다른 녹음을 고른다
      let i = Math.floor(Math.random() * this.purrClips.length);
      if (this.purrClips.length > 1 && i === this.lastPurrIndex) i = (i + 1) % this.purrClips.length;
      this.lastPurrIndex = i;
      const clip = this.purrClips[i];
      // 파일을 반복 재생하며 서서히 커졌다가 서서히 줄어든다
      const src = ctx.createBufferSource();
      src.buffer = clip.buffer;
      src.loop = true;
      src.loopStart = clip.start;
      src.loopEnd = clip.buffer.duration;
      // 휴대폰 녹음을 크게 키우면 고음 잡음도 커지므로, 저음인 골골 소리만 남긴다
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = PURR_LOWPASS_HZ;
      lp.Q.value = -3.01; // Web Audio lowpass의 Q는 dB 단위. -3.01dB = Q 0.707(공진 없음), 측정 필터와 같다
      const out = ctx.createGain();
      const vol = clip.gain;
      out.gain.setValueAtTime(0.0001, now);
      out.gain.linearRampToValueAtTime(vol, now + 0.6);
      out.gain.setValueAtTime(vol, now + Math.max(0.6, seconds - 0.8));
      out.gain.linearRampToValueAtTime(0.0001, now + seconds);
      src.connect(lp).connect(out).connect(this.catLimiter);
      src.start(now, clip.start);
      src.stop(now + seconds + 0.05);
      this.purrGain = out;
      this.purrUntil = now + seconds;
      this.lastPlayed = `purr-${i + 1}`;
      return;
    }
    this.synthPurr(seconds, now);
  }

  /** 합성 골골송: 낮은 잡음을 25Hz 정도로 진폭 변조하고, 숨에 맞춰 커졌다 작아진다 */
  private synthPurr(seconds: number, now: number): void {
    const ctx = this.ctx!;
    this.lastPlayed = 'synth-purr';
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const am = ctx.createGain();
    am.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 25;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(am.gain);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    // 숨쉬기: 2.2초마다 강(들숨)·약(날숨) 반복
    for (let t = 0; t < seconds; t += 2.2) {
      out.gain.linearRampToValueAtTime(0.9, now + t + 0.9);
      out.gain.linearRampToValueAtTime(0.45, now + t + 2.0);
    }
    out.gain.linearRampToValueAtTime(0.0001, now + seconds + 0.4);
    src.connect(lp).connect(am).connect(out).connect(this.catBus);
    src.start(now);
    lfo.start(now);
    src.stop(now + seconds + 0.5);
    lfo.stop(now + seconds + 0.5);
    this.purrGain = out;
    this.purrUntil = now + seconds;
  }

  /** 매 프레임 호출: 가끔 새소리 */
  update(dt: number): void {
    if (!this.ctx) return;
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 4 + Math.random() * 8;
      this.chirp();
    }
  }

  private chirp(): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.05;
    const notes = 2 + Math.floor(Math.random() * 3);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.ambBus);
    for (let i = 0; i < notes; i++) {
      const t = t0 + i * 0.13;
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f = 2800 + Math.random() * 1500;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g).connect(pan);
      o.start(t);
      o.stop(t + 0.1);
    }
  }

  private startWind(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.value = 0.035;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const depth = ctx.createGain();
    depth.gain.value = 0.02;
    lfo.connect(depth).connect(g.gain);
    src.connect(lp).connect(g).connect(this.ambBus);
    src.start();
    lfo.start();
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // 부드러운 소리를 위해 저음이 많은 브라운 노이즈
      last = (last + (Math.random() * 2 - 1) * 0.08) * 0.985;
      data[i] = last * 3;
    }
    return buf;
  }
}
