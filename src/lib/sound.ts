export type GameSound = 'select' | 'confirm' | 'result' | 'perfect' | 'shot' | 'cushion' | 'collision' | 'pocket'

export interface GameAudio {
  /** Call from a pointer or keyboard gesture. Creating this controller alone is silent. */
  unlock(): void
  /** Impact strength is clamped to 0–1. Effects never create or resume an audio context. */
  play(sound: GameSound, strength?: number): void
  setEnabled(enabled: boolean): void
  stop(): void
  dispose(): void
}

interface Note {
  frequency: number
  endFrequency?: number
  offset?: number
  duration: number
  volume: number
  waveform?: OscillatorType
}

interface Voice {
  oscillator: OscillatorNode
  gain: GainNode
}

// Very short falling pitches give impacts a dry, rounded sound without audio files.
// Longer sine envelopes keep the success melody soft even when notes overlap.
const SOUNDS: Record<GameSound, readonly Note[]> = {
  select: [{ frequency: 620, endFrequency: 260, duration: 0.035, volume: 0.035, waveform: 'triangle' }],
  confirm: [
    { frequency: 740, endFrequency: 330, duration: 0.04, volume: 0.045, waveform: 'triangle' },
    { frequency: 220, duration: 0.055, volume: 0.025 },
  ],
  shot: [
    { frequency: 980, endFrequency: 300, duration: 0.035, volume: 0.075, waveform: 'triangle' },
    { frequency: 175, endFrequency: 120, duration: 0.06, volume: 0.045 },
  ],
  collision: [
    { frequency: 1850, endFrequency: 920, duration: 0.025, volume: 0.065, waveform: 'triangle' },
    { frequency: 720, endFrequency: 260, duration: 0.018, volume: 0.04 },
  ],
  cushion: [
    { frequency: 175, endFrequency: 100, duration: 0.055, volume: 0.065 },
    { frequency: 420, endFrequency: 220, duration: 0.025, volume: 0.025, waveform: 'triangle' },
  ],
  pocket: [
    { frequency: 110, endFrequency: 65, duration: 0.15, volume: 0.085 },
    { frequency: 350, endFrequency: 120, duration: 0.045, volume: 0.035, waveform: 'triangle' },
  ],
  result: [
    { frequency: 392, duration: 0.26, volume: 0.04 },
    { frequency: 523.25, offset: 0.09, duration: 0.32, volume: 0.04 },
  ],
  perfect: [
    { frequency: 261.63, duration: 0.65, volume: 0.035 },
    { frequency: 523.25, duration: 0.34, volume: 0.055 },
    { frequency: 659.25, offset: 0.12, duration: 0.38, volume: 0.05 },
    { frequency: 783.99, offset: 0.24, duration: 0.42, volume: 0.045 },
    { frequency: 1046.5, offset: 0.4, duration: 0.65, volume: 0.04 },
  ],
}

/** Optional audio: unavailable or blocked browser audio never interrupts gameplay. */
export function createGameAudio(): GameAudio {
  let context: AudioContext | null = null
  let enabled = true
  let disposed = false
  let unlocking = false
  let queuedSound: { sound: GameSound; strength: number } | null = null
  const voices = new Set<Voice>()

  function release(voice: Voice) {
    voices.delete(voice)
    voice.oscillator.onended = null
    voice.oscillator.disconnect()
    voice.gain.disconnect()
  }

  function stop() {
    queuedSound = null
    for (const voice of voices) {
      try {
        voice.gain.gain.cancelScheduledValues(0)
        voice.gain.gain.setValueAtTime(0, context?.currentTime ?? 0)
        voice.oscillator.stop()
      } catch {
        // A browser may have already ended or closed this voice.
      }
      release(voice)
    }
  }

  function play(sound: GameSound, strength = 1) {
    if (!enabled || disposed || !context) return
    const volume = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 1
    if (volume === 0) return
    if (context.state !== 'running') {
      if (unlocking) queuedSound = { sound, strength: volume }
      return
    }
    // Bound simultaneous voices during dense sequences of ball contacts.
    if (voices.size + SOUNDS[sound].length > 40) return
    const start = context.currentTime + 0.005
    for (const note of SOUNDS[sound]) {
      let oscillator: OscillatorNode | undefined
      let gain: GainNode | undefined
      let voice: Voice | undefined
      try {
        oscillator = context.createOscillator()
        gain = context.createGain()
        voice = { oscillator, gain }
        voices.add(voice)
        const at = start + (note.offset ?? 0)
        const attack = Math.min(0.008, note.duration / 8)
        oscillator.type = note.waveform ?? 'sine'
        oscillator.frequency.setValueAtTime(note.frequency, at)
        if (note.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(note.endFrequency, at + note.duration)
        gain.gain.setValueAtTime(0, at)
        gain.gain.linearRampToValueAtTime(note.volume * volume, at + attack)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + note.duration)
        gain.gain.linearRampToValueAtTime(0, at + note.duration + 0.01)
        oscillator.connect(gain)
        gain.connect(context.destination)
        const activeVoice = voice
        oscillator.onended = () => release(activeVoice)
        oscillator.start(at)
        oscillator.stop(at + note.duration + 0.015)
      } catch {
        try { oscillator?.stop() } catch { /* The voice may not have started. */ }
        if (voice) release(voice)
        else {
          oscillator?.disconnect()
          gain?.disconnect()
        }
      }
    }
  }

  function unlock() {
    if (!enabled || disposed || unlocking) return
    try {
      if (!context || context.state === 'closed') {
        const browser = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }
        const AudioContextClass = browser.AudioContext ?? browser.webkitAudioContext
        if (!AudioContextClass) return
        context = new AudioContextClass()
      }
      if (context.state === 'running') return
      unlocking = true
      void context.resume().then(() => {
        unlocking = false
        const pending = queuedSound
        queuedSound = null
        if (pending) play(pending.sound, pending.strength)
      }).catch(() => {
        unlocking = false
        queuedSound = null
      })
    } catch {
      unlocking = false
      queuedSound = null
    }
  }

  return {
    unlock,
    play,
    setEnabled(value) {
      enabled = value
      if (!value) stop()
    },
    stop,
    dispose() {
      disposed = true
      stop()
      if (context && context.state !== 'closed') {
        try { void context.close().catch(() => {}) } catch { /* Audio is optional. */ }
      }
      context = null
    },
  }
}
