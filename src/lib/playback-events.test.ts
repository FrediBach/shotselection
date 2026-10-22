import { describe, expect, it, vi } from 'vitest';
import type { SimulationSoundEvent } from '../engine/types';
import { PlaybackSoundCursor } from './playback-events';

const events: SimulationSoundEvent[] = [
  { type: 'cue', time: 0, strength: 0.5 },
  { type: 'ball', time: 0.4, strength: 0.4 },
  { type: 'cushion', time: 0.45, strength: 0.3 },
  { type: 'pocket', time: 0.8, strength: 0.2 },
];

describe('playback sound cursor', () => {
  it('emits only events reached by the visible replay, exactly once', () => {
    const emit = vi.fn();
    const cursor = new PlaybackSoundCursor(events);
    cursor.advance(0, emit);
    cursor.advance(0, emit);
    cursor.advance(0.39, emit);
    expect(emit.mock.calls.map(([event]) => event)).toEqual(events.slice(0, 1));
    cursor.advance(0.46, emit);
    cursor.advance(0.8, emit);
    cursor.advance(1, emit);
    expect(emit.mock.calls.map(([event]) => event)).toEqual(events);
  });

  it('drops stale events after a clock jump instead of playing a backlog', () => {
    const emit = vi.fn();
    const cursor = new PlaybackSoundCursor(events);
    cursor.advance(0.85, emit);
    expect(emit.mock.calls.map(([event]) => event)).toEqual([events[3]]);
    cursor.advance(0.85, emit);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('consumes muted events and allows a fresh replay to start at the cue strike', () => {
    const emit = vi.fn();
    const first = new PlaybackSoundCursor(events);
    first.advance(0.45);
    first.advance(0.45, emit);
    expect(emit).not.toHaveBeenCalled();
    const replay = new PlaybackSoundCursor(events);
    replay.advance(0, emit);
    expect(emit).toHaveBeenCalledExactlyOnceWith(events[0]);
  });
});
