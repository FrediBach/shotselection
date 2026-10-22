import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGameAudio } from './sound'

class MockOscillator {
  frequency = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
  type = 'sine'
  onended: (() => void) | null = null
  connect = vi.fn()
  disconnect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class MockGain {
  gain = {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  }
  connect = vi.fn()
  disconnect = vi.fn()
}

let initialState: AudioContextState
let resumeEffect: (context: MockAudioContext) => Promise<void>

class MockAudioContext {
  static instances: MockAudioContext[] = []
  state = initialState
  currentTime = 10
  destination = {}
  oscillators: MockOscillator[] = []
  gains: MockGain[] = []
  constructor() { MockAudioContext.instances.push(this) }
  resume = vi.fn(() => resumeEffect(this))
  close = vi.fn(() => {
    this.state = 'closed'
    return Promise.resolve()
  })
  createOscillator() {
    const oscillator = new MockOscillator()
    this.oscillators.push(oscillator)
    return oscillator
  }
  createGain() {
    const gain = new MockGain()
    this.gains.push(gain)
    return gain
  }
}

beforeEach(() => {
  MockAudioContext.instances = []
  initialState = 'running'
  resumeEffect = context => {
    context.state = 'running'
    return Promise.resolve()
  }
  vi.stubGlobal('AudioContext', MockAudioContext)
  vi.stubGlobal('webkitAudioContext', undefined)
})

afterEach(() => vi.unstubAllGlobals())

describe('optional game audio', () => {
  it('creates audio only when explicitly unlocked by a user gesture', () => {
    const audio = createGameAudio()
    audio.play('perfect')
    audio.setEnabled(true)
    expect(MockAudioContext.instances).toHaveLength(0)
    audio.unlock()
    audio.unlock()
    expect(MockAudioContext.instances).toHaveLength(1)
    audio.play('select')
    expect(MockAudioContext.instances[0].oscillators).toHaveLength(1)
  })

  it('works silently when Web Audio is absent or its constructor is blocked', () => {
    vi.stubGlobal('AudioContext', undefined)
    const audio = createGameAudio()
    expect(() => { audio.unlock(); audio.play('perfect') }).not.toThrow()
    vi.stubGlobal('AudioContext', class { constructor() { throw new Error('Blocked') } })
    expect(() => { audio.unlock(); audio.play('perfect'); audio.dispose() }).not.toThrow()
  })

  it('supports the prefixed browser audio constructor', () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', MockAudioContext)
    const audio = createGameAudio()
    audio.unlock()
    audio.play('select')
    expect(MockAudioContext.instances[0].oscillators).toHaveLength(1)
  })

  it('plays the latest queued cue once unlocking finishes', async () => {
    initialState = 'suspended'
    let finishResume = () => {}
    resumeEffect = context => new Promise(resolve => {
      finishResume = () => { context.state = 'running'; resolve() }
    })
    const audio = createGameAudio()
    audio.unlock()
    audio.play('select')
    audio.play('perfect')
    const context = MockAudioContext.instances[0]
    expect(context.oscillators).toHaveLength(0)
    finishResume()
    await Promise.resolve()
    expect(context.oscillators).toHaveLength(5)
  })

  it('swallows rejected resumes and allows a later gesture to retry', async () => {
    initialState = 'suspended'
    resumeEffect = () => Promise.reject(new Error('Autoplay blocked'))
    const audio = createGameAudio()
    audio.unlock()
    audio.play('perfect')
    await Promise.resolve()
    await Promise.resolve()
    const context = MockAudioContext.instances[0]
    expect(context.oscillators).toHaveLength(0)
    resumeEffect = resumed => { resumed.state = 'running'; return Promise.resolve() }
    audio.unlock()
    audio.play('select')
    expect(context.resume).toHaveBeenCalledTimes(2)
    expect(context.oscillators).toHaveLength(1)
  })

  it('does not resume audio from a background sound request', () => {
    const audio = createGameAudio()
    audio.unlock()
    const context = MockAudioContext.instances[0]
    context.state = 'suspended'
    audio.play('perfect')
    expect(context.resume).not.toHaveBeenCalled()
    expect(context.oscillators).toHaveLength(0)
  })

  it('immediately silences and releases all scheduled notes when muted', () => {
    const audio = createGameAudio()
    audio.unlock()
    audio.play('perfect')
    const context = MockAudioContext.instances[0]
    expect(context.oscillators).toHaveLength(5)
    audio.setEnabled(false)
    for (const oscillator of context.oscillators) {
      expect(oscillator.stop).toHaveBeenLastCalledWith()
      expect(oscillator.disconnect).toHaveBeenCalledOnce()
      expect(oscillator.onended).toBeNull()
    }
    for (const gain of context.gains) {
      expect(gain.gain.cancelScheduledValues).toHaveBeenCalledWith(0)
      expect(gain.gain.setValueAtTime).toHaveBeenLastCalledWith(0, context.currentTime)
      expect(gain.disconnect).toHaveBeenCalledOnce()
    }
    audio.play('perfect')
    expect(context.oscillators).toHaveLength(5)
  })

  it('cancels a pending cue when stopped before audio unlocks', async () => {
    initialState = 'suspended'
    let finishResume = () => {}
    resumeEffect = context => new Promise(resolve => {
      finishResume = () => { context.state = 'running'; resolve() }
    })
    const audio = createGameAudio()
    audio.unlock()
    audio.play('perfect')
    audio.stop()
    finishResume()
    await Promise.resolve()
    expect(MockAudioContext.instances[0].oscillators).toHaveLength(0)
  })

  it('releases naturally completed sounds', () => {
    const audio = createGameAudio()
    audio.unlock()
    audio.play('select')
    const context = MockAudioContext.instances[0]
    context.oscillators[0].onended?.()
    expect(context.oscillators[0].disconnect).toHaveBeenCalledOnce()
    expect(context.gains[0].disconnect).toHaveBeenCalledOnce()
    audio.stop()
    expect(context.oscillators[0].disconnect).toHaveBeenCalledOnce()
  })

  it('scales and clamps impact strength without scheduling silent impacts', () => {
    const audio = createGameAudio()
    audio.unlock()
    audio.play('collision', 0)
    audio.play('collision', -1)
    const context = MockAudioContext.instances[0]
    expect(context.gains).toHaveLength(0)
    audio.play('collision', 0.5)
    audio.play('collision', 2)
    expect(context.gains[0].gain.linearRampToValueAtTime.mock.calls[0][0]).toBe(0.065 / 2)
    expect(context.gains[2].gain.linearRampToValueAtTime.mock.calls[0][0]).toBe(0.065)
  })

  it('keeps dense contact sequences bounded and can play after stopping', () => {
    const audio = createGameAudio()
    audio.unlock()
    for (let index = 0; index < 100; index++) audio.play('collision')
    const context = MockAudioContext.instances[0]
    expect(context.oscillators).toHaveLength(40)
    audio.stop()
    audio.play('shot')
    expect(context.oscillators).toHaveLength(42)
  })

  it('closes the context once and remains silent after disposal', () => {
    const audio = createGameAudio()
    audio.unlock()
    audio.play('perfect')
    const context = MockAudioContext.instances[0]
    audio.dispose()
    audio.dispose()
    audio.setEnabled(true)
    audio.unlock()
    audio.play('perfect')
    expect(context.close).toHaveBeenCalledOnce()
    expect(context.oscillators).toHaveLength(5)
    expect(MockAudioContext.instances).toHaveLength(1)
  })
})
