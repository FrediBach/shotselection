import type { SimulationSoundEvent } from '../engine/types';

/** Consumes physical events once against the same clock used to draw the balls. */
export class PlaybackSoundCursor {
  private next = 0;

  constructor(private readonly events: readonly SimulationSoundEvent[]) {}

  advance(time: number, emit?: (event: SimulationSoundEvent) => void) {
    while (this.next < this.events.length && this.events[this.next].time <= time) {
      const event = this.events[this.next++];
      // A seek or throttled frame should never play a backlog of old impacts.
      if (time - event.time <= 0.12) emit?.(event);
    }
  }
}
