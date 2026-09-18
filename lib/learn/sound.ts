"use client";

// ============================================================
// Sound, all made on this device. No audio files, no microphone.
//
// Two things make browser sound unreliable, and both are handled here:
//   · Browsers only allow sound that starts from a tap. Safari is strict:
//     speech queued even 80 ms after the tap is silently dropped. So speech
//     starts inside the tap whenever it can, and the first tap anywhere
//     unlocks audio and speech for the rest of the visit.
//   · Some browsers and embedded views have no working speech at all. If the
//     browser voice has not started within a second, the Mac's own voice
//     (macOS `say`, via /api/speak) reads the line instead, and is used from
//     then on.
// ============================================================

let ctx: AudioContext | null = null;
let volume = 0.9;
let effectsOn = true;

/** Bead clicks, coin clinks, counting pops. Separate from the voice and the cheer. */
export function setEffects(on: boolean) {
  effectsOn = on;
}

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType = "sine", slideTo?: number) {
  const a = audio();
  if (!a || volume === 0) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  const t = a.currentTime + start;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol * volume, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** A short burst of filtered noise: the "tock" in a wooden click. */
function knock(start: number, dur: number, vol: number, freq: number) {
  const a = audio();
  if (!a || volume === 0) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 4;
  const g = a.createGain();
  g.gain.value = vol * volume;
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + start);
}

// ---------- sound effects ----------

const q = (quiet: boolean) => (quiet ? 0.35 : 1);

/** A bead sliding onto a rod: a soft wooden click, lower for bigger places. */
export function sfxBead(place: "ones" | "tens" | "hundreds", up: boolean, quiet = false) {
  if (!effectsOn) return;
  const base = place === "ones" ? 1500 : place === "tens" ? 1100 : 800;
  knock(0, 0.05, 0.5 * q(quiet), up ? base : base * 0.8);
  tone(up ? base / 2 : base / 2.6, 0, 0.07, 0.05 * q(quiet), "triangle");
}

/** Coins: a bright two-partial clink. */
export function sfxCoin(quiet = false) {
  if (!effectsOn) return;
  tone(2637, 0, 0.35, 0.05 * q(quiet));
  tone(3951, 0.01, 0.25, 0.03 * q(quiet));
  knock(0, 0.03, 0.2 * q(quiet), 4000);
}

/** Tapping an item to count it: a soft pop that climbs a little with each count. */
export function sfxCount(n: number, quiet = false) {
  if (!effectsOn) return;
  const f = 520 * Math.pow(2, Math.min(n - 1, 12) / 12);
  tone(f, 0, 0.12, 0.08 * q(quiet), "sine", f * 1.25);
}

/** Choosing an answer. */
export function sfxTap(quiet = false) {
  if (!effectsOn) return;
  knock(0, 0.03, 0.25 * q(quiet), 2200);
}

/** An item taken away (eaten, dropped off). */
export function sfxAway(quiet = false) {
  if (!effectsOn) return;
  tone(500, 0, 0.18, 0.05 * q(quiet), "sine", 300);
}

/** A clock tick for time questions. */
export function sfxTick(quiet = false) {
  if (!effectsOn) return;
  knock(0, 0.02, 0.35 * q(quiet), 3000);
  knock(0.5, 0.02, 0.25 * q(quiet), 2600);
}

export function playChime(quiet: boolean) {
  const v = quiet ? 0.06 : 0.18;
  tone(784, 0, 0.9, v);
  tone(1175, 0.16, 1.1, v * 0.8);
}

// TODO(sound): speaks even when read-aloud is "off", and speak() cuts off the current line. See HANDOVER.md.
export function playWoohoo(quiet: boolean) {
  const v = quiet ? 0.05 : 0.14;
  [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.45, v, "triangle"));
  void speak("Woo hoo!", { pitch: 1.7, rate: 1.05, quiet });
}

// ---------- voice ----------

export type VoicePath = "natural" | "browser" | "mac" | "none";

/**
 * Who is talking. The Mac has a real child's voice (Junior) and a deep,
 * warm one (Grandpa) that suits a cuddly animal; browsers that do not
 * expose them get the nearest voice, pitched up or down.
 */
export type VoiceStyle = "child" | "bear" | "grownup";
const STYLE: Record<VoiceStyle, { names: RegExp; pitch: number; fallbackPitch: number; rate: number }> = {
  child: { names: /^Junior\b/i, pitch: 1.1, fallbackPitch: 1.6, rate: 0.95 },
  bear: { names: /^Grandpa\b/i, pitch: 0.9, fallbackPitch: 0.55, rate: 0.82 },
  grownup: { names: /^(Samantha|Karen|Daniel|Google US English)\b/i, pitch: 1.05, fallbackPitch: 1.05, rate: 0.9 },
};
let style: VoiceStyle = "child";

export function setVoiceStyle(s: VoiceStyle) {
  if (s === style) return;
  style = s;
  pickVoice();
}

/** Lets the character move its mouth while the voice is playing. */
function talking(on: boolean) {
  try {
    window.dispatchEvent(new CustomEvent("tally:speaking", { detail: on }));
  } catch {
    // no window
  }
}

let voice: SpeechSynthesisVoice | null = null;
let pending: ReturnType<typeof setTimeout> | undefined;
/** Once the browser voice has failed, go straight to the Mac voice. */
let preferMac = false;
let player: HTMLAudioElement | null = null;
const clips = new Map<string, string>();

let styleMatched = false;

function pickVoice() {
  try {
    const vs = window.speechSynthesis.getVoices();
    const styled = vs.find((v) => /^en/i.test(v.lang) && STYLE[style].names.test(v.name));
    styleMatched = !!styled;
    voice =
      styled ??
      vs.find((v) => /^en/i.test(v.lang) && /Samantha|Karen|Daniel|Google UK English Female|Google US English|Natural/i.test(v.name)) ??
      vs.find((v) => /^en/i.test(v.lang) && v.localService) ??
      vs.find((v) => /^en/i.test(v.lang)) ??
      null;
  } catch {
    voice = null;
  }
}

const hasSpeech = () => typeof window !== "undefined" && "speechSynthesis" in window;

if (hasSpeech()) {
  pickVoice();
  window.speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
}

/**
 * The first tap anywhere unlocks sound for the whole visit: the audio
 * context resumes and an empty utterance clears Safari's speech gate.
 */
let unlocked = false;
export function unlockAudio() {
  if (unlocked || typeof window === "undefined") return;
  unlocked = true;
  audio();
  try {
    if (hasSpeech()) window.speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
  } catch {
    // no speech; the Mac voice will be used
  }
  try {
    player ??= new Audio();
    player.muted = true;
    void player.play().catch(() => undefined);
    player.muted = false;
  } catch {
    // nothing to unlock
  }
}
if (typeof window !== "undefined") {
  for (const ev of ["pointerdown", "keydown", "touchstart"]) window.addEventListener(ev, unlockAudio, { once: true, capture: true });
}

/** Natural voice down: try again in a minute, in case the server was just starting. */
let naturalDownUntil = 0;

async function speakServer(text: string, quiet: boolean, rate: number, engine: "natural" | "system"): Promise<VoicePath> {
  try {
    const key = `${engine}|${style}|${rate}|${text}`;
    let url = clips.get(key);
    if (!url) {
      const r = await fetch("/api/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, rate, style, engine }),
      });
      if (!r.ok) {
        if (engine === "natural") naturalDownUntil = Date.now() + 60_000;
        return "none";
      }
      url = URL.createObjectURL(await r.blob());
      clips.set(key, url);
      if (clips.size > 40) {
        const [k, v] = clips.entries().next().value as [string, string];
        URL.revokeObjectURL(v);
        clips.delete(k);
      }
    }
    player ??= new Audio();
    player.pause();
    player.src = url;
    player.volume = volume * (quiet ? 0.45 : 1);
    player.onplay = () => talking(true);
    player.onended = player.onpause = () => talking(false);
    await player.play();
    return engine === "natural" ? "natural" : "mac";
  } catch {
    return "none";
  }
}

/**
 * Say a line. Resolves with the path that actually produced sound, so the
 * grown-ups page can say "the browser voice works" or "using the Mac voice".
 */
export function speak(text: string, opts: { pitch?: number; rate?: number; quiet?: boolean } = {}): Promise<VoicePath> {
  if (typeof window === "undefined" || !text.trim() || volume === 0) return Promise.resolve("none");
  const quiet = !!opts.quiet;
  const rate = opts.rate ?? STYLE[style].rate;
  stopSpeaking();
  return (async () => {
    // TODO(sound): this await puts the browser voice outside the tap, which Safari drops. See HANDOVER.md.
    // Best first: the natural on-device voice, when its server is running.
    if (Date.now() > naturalDownUntil) {
      const p = await speakServer(text, quiet, rate, "natural");
      if (p === "natural") return p;
    }
    if (preferMac || !hasSpeech()) return speakServer(text, quiet, rate, "system");
    return speakBrowser(text, quiet, rate, opts.pitch);
  })();
}

function speakBrowser(text: string, quiet: boolean, rate: number, pitch?: number): Promise<VoicePath> {
  return new Promise<VoicePath>((resolve) => {
    const synth = window.speechSynthesis;
    let started = false;
    const go = () => {
      if (!voice) pickVoice();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? "en-US";
      u.rate = rate;
      u.pitch = pitch ?? (styleMatched ? STYLE[style].pitch : STYLE[style].fallbackPitch);
      u.volume = volume * (quiet ? 0.45 : 1);
      u.onstart = () => {
        started = true;
        talking(true);
        resolve("browser");
      };
      u.onend = () => talking(false);
      u.onerror = (e) => {
        if (started || e.error === "interrupted" || e.error === "canceled") return;
        // TODO(sound): permanent, and /api/speak "system" is 404 off a Mac, so speech stays silent. See HANDOVER.md.
        preferMac = true;
        void speakServer(text, quiet, rate, "system").then(resolve);
      };
      synth.speak(u);
      synth.resume();
      // No start within a second: this browser's voice is not working here.
      setTimeout(() => {
        if (started) return;
        preferMac = true;
        synth.cancel();
        void speakServer(text, quiet, rate, "system").then(resolve);
      }, 1200);
    };
    // Speak inside the tap when nothing is playing (Safari needs that); only
    // after interrupting earlier speech wait a moment (Chrome needs that).
    if (synth.speaking || synth.pending) {
      synth.cancel();
      pending = setTimeout(go, 80);
    } else {
      go();
    }
  });
}

export function stopSpeaking() {
  clearTimeout(pending);
  talking(false);
  try {
    if (hasSpeech() && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) window.speechSynthesis.cancel();
  } catch {
    // nothing queued
  }
  try {
    player?.pause();
  } catch {
    // nothing playing
  }
}

export const canSpeak = () => typeof window !== "undefined";
