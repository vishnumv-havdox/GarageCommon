/**
 * Web Audio API Alarm & Chime Generator
 * Synthesizes crisp, modern alerts without external audio file dependencies.
 */

let activeAudioContext: AudioContext | null = null;
let activeLoopInterval: any = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!activeAudioContext || activeAudioContext.state === "closed") {
    activeAudioContext = new AudioContextClass();
  }
  if (activeAudioContext.state === "suspended") {
    activeAudioContext.resume().catch(() => {});
  }
  return activeAudioContext;
}

export type AlarmToneType = "chime" | "digital" | "bell" | "radar";

/**
 * Play a single chime / tone pulse
 */
export function playTone(tone: AlarmToneType = "chime", volume: number = 0.5): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume * 0.4, now);
    gainNode.connect(ctx.destination);

    if (tone === "chime") {
      // Pleasant marimba / bell arpeggio (C5, E5, G5, C6)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        noteGain.gain.setValueAtTime(0, now + idx * 0.12);
        noteGain.gain.linearRampToValueAtTime(volume * 0.5, now + idx * 0.12 + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);

        osc.connect(noteGain);
        noteGain.connect(gainNode);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.65);
      });
    } else if (tone === "digital") {
      // Crisp digital watch / alarm beeps (be-be-beep)
      const beeps = [0, 0.15, 0.3];
      beeps.forEach((startOffset) => {
        const osc = ctx.createOscillator();
        const beepGain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(880, now + startOffset);

        beepGain.gain.setValueAtTime(0, now + startOffset);
        beepGain.gain.linearRampToValueAtTime(volume * 0.25, now + startOffset + 0.01);
        beepGain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + 0.09);

        osc.connect(beepGain);
        beepGain.connect(gainNode);

        osc.start(now + startOffset);
        osc.stop(now + startOffset + 0.1);
      });
    } else if (tone === "bell") {
      // High-frequency workshop brass chime
      [1174.66, 1760].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const bellGain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        bellGain.gain.setValueAtTime(volume * 0.6, now + idx * 0.08);
        bellGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.9);

        osc.connect(bellGain);
        bellGain.connect(gainNode);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.95);
      });
    } else if (tone === "radar") {
      // Sonar pulse
      const osc = ctx.createOscillator();
      const pulseGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.4);

      pulseGain.gain.setValueAtTime(0, now);
      pulseGain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.03);
      pulseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(pulseGain);
      pulseGain.connect(gainNode);

      osc.start(now);
      osc.stop(now + 0.65);
    }
  } catch (err) {
    console.error("Audio playback error:", err);
  }
}

/**
 * Start repeating alarm loop until stopped
 */
export function startAlarmLoop(tone: AlarmToneType = "chime", volume: number = 0.5): void {
  stopAlarmLoop();
  // Play immediately
  playTone(tone, volume);
  // Repeat every 3.5 seconds
  activeLoopInterval = setInterval(() => {
    playTone(tone, volume);
  }, 3500);
}

/**
 * Stop repeating alarm loop
 */
export function stopAlarmLoop(): void {
  if (activeLoopInterval) {
    clearInterval(activeLoopInterval);
    activeLoopInterval = null;
  }
}
