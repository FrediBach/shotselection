import { describe, expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { kickIntroductionEvidence } from './kick-introduction';

describe('kick introduction', () => {
  it.each([0, 1, 5, 8, 51 * 919])('labels actual pre-contact rebounds for all offered strokes at seed %i', seed => {
    const p = prepareRound(generateScenario(51, seed), { regenerate: false });
    for (const option of p.balls[0].options) {
      const simulation = simulateShot(p.scenario, option.plan);
      const before = JSON.stringify(simulation);
      const evidence = kickIntroductionEvidence(p.scenario, simulation)!;
      expect(evidence).not.toBeNull();
      expect(evidence.first).toBe(simulation.cueRebounds![0]);
      expect(evidence.first.beforeContact).toBe(true);
      expect(evidence.first.time).toBeLessThan(evidence.contact.time);
      expect(evidence.incoming[0]).toEqual(simulation.cueApproachPath[0]);
      expect(evidence.incoming.at(-1)).toEqual(evidence.first.position);
      expect(evidence.outgoing[0]).toEqual(evidence.first.position);
      expect(evidence.outgoing.at(-1)).toEqual(evidence.contact.position);
      expect([...evidence.incoming, ...evidence.outgoing.slice(1, -1)]).toEqual(simulation.cueApproachPath);
      expect(JSON.stringify(simulation)).toBe(before);
    }
  });
  it('rejects unverified, late and missing rebound evidence', () => {
    const p = prepareRound(generateScenario(51, 0), { regenerate: false });
    const s = simulateShot(p.scenario, p.balls[0].options[0].plan);
    for (const invalid of [
      { ...s, scratch: true }, { ...s, stopped: false }, { ...s, firstContact: 2 },
      { ...s, potted: [] }, { ...s, firstImpact: undefined },
      { ...s, cueRebounds: [] }, { ...s, cueBanksBeforeContact: 0 },
      { ...s, cueApproachPath: [] },
      { ...s, cueRebounds: s.cueRebounds!.map(r => ({ ...r, beforeContact: false })) },
      { ...s, cueRebounds: s.cueRebounds!.map(r => ({ ...r, time: s.firstImpact!.time })) },
    ]) expect(kickIntroductionEvidence(p.scenario, invalid)).toBeNull();
    expect(kickIntroductionEvidence({ ...p.scenario, bank: undefined }, s)).toBeNull();
  });
});
