// Short tones for training feedback, made with Web Audio (no sound files). Quiet on purpose.
let context: AudioContext | undefined;

function tone(freqs: number[], step = 0.09, volume = 0.05) {
  try {
    context ??= new AudioContext();
    const start = context.currentTime;
    freqs.forEach((freq, i) => {
      const osc = context!.createOscillator();
      const gain = context!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = start + i * step;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.8);
      osc.connect(gain).connect(context!.destination);
      osc.start(t);
      osc.stop(t + step * 2);
    });
  } catch {
    /* no audio: training works without it */
  }
}

export const sounds = {
  right: () => tone([660, 880]),
  wrong: () => tone([220], 0.14, 0.04),
  /** A line or a review session finished without a miss. */
  done: () => tone([523, 659, 784, 1047], 0.08),
};
