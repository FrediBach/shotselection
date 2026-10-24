import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { kickCorridorEvidence, withoutKickBlocker } from './kick-corridor';
import { distance } from './math';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 55 * 919])('proves a clear incoming and blocked outgoing kick leg, seed %i', seed => {
  const source = generateScenario(55, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), x = p.kickCorridor!;
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(x).toBeDefined(); expect(p.balls[0].options).toHaveLength(3);
  const option = p.balls[0].options.find(o => o.id === x.referenceId)!;
  const before = structuredClone(x), e = kickCorridorEvidence(source, option.plan, x)!;
  expect(e).not.toBeNull(); expect(x).toEqual(before);
  const open = withoutKickBlocker(source);
  expect(open).toEqual({ ...source, balls: source.balls.filter(b => b.id !== 3) });
  for (const [scenario, plan, simulation] of [[source, option.plan, x.reference], [open, option.plan, x.referenceOpen], [source, x.blockedPlan, x.blocked], [open, x.blockedPlan, x.intended]] as const)
    expect(simulation).toEqual(simulateShot(scenario, plan, { record: false, recordPaths: true }));
  for (const simulation of [x.reference, x.referenceOpen, x.intended]) {
    expect(simulation.firstContact).toBe(1); expect(simulation.potted).toContain(1);
    expect(simulation.scratch).toBe(false); expect(simulation.stopped).toBe(true);
    expect(simulation.objectCushions).toBe(0);
  }
  expect(x.blocked.firstContact).toBe(3); expect(x.blocked.potted).not.toContain(1);
  expect(x.blocked.cueBanksBeforeContact).toBe(1); expect(e.contact.time).toBeGreaterThan(e.rebound.time);
  expect(e.rebound).toEqual(e.intended.first);
  expect(e.blockedIncoming).toEqual(e.intended.incoming);
  expect(x.reference.cueApproachPath).toEqual(x.referenceOpen.cueApproachPath);
  expect(e.incomingClearance).toBeGreaterThanOrEqual(.03);
  expect(e.outgoingClearance).toBeLessThanOrEqual(-.005);
  expect(e.clearIncoming).toBeGreaterThanOrEqual(.03); expect(e.clearOutgoing).toBeGreaterThanOrEqual(.03);
  expect(distance(e.contact.position, e.rebound.position)).toBeGreaterThanOrEqual(.1);
  expect(e.blockedOutgoing[0]).toEqual(e.rebound.position);
  expect(e.blockedOutgoing.at(-1)).toEqual(e.contact.position);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: option.id }, { samples: 32, talents: character.talents });
    expect(kickCorridorEvidence(source, option.plan, { ...x, reference: result.selected.nominal })).not.toBeNull();
  }
});

it('rejects absent obstructions, early/wrong contacts and unproven pot routes', () => {
  const p = prepareRound(generateScenario(55, 0), { regenerate: false }), x = p.kickCorridor!;
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  for (const invalid of [
    { ...x, blocked: { ...x.blocked, firstContact: 1 } },
    { ...x, blocked: { ...x.blocked, firstImpact: undefined } },
    { ...x, blocked: { ...x.blocked, cueBanksBeforeContact: 0 } },
    { ...x, blocked: { ...x.blocked, cueRebounds: [] } },
    { ...x, blocked: { ...x.blocked, firstImpact: { ...x.blocked.firstImpact!, time: 0 } } },
    { ...x, intended: { ...x.intended, potted: [] } },
    { ...x, reference: { ...x.reference, scratch: true } },
    { ...x, referenceOpen: { ...x.referenceOpen, cueApproachPath: [] } },
    { ...x, blockedPlan: { ...x.blockedPlan, pocketId: -1 } },
  ]) expect(kickCorridorEvidence(p.scenario, plan, invalid)).toBeNull();
  expect(kickCorridorEvidence(withoutKickBlocker(p.scenario), plan, x)).toBeNull();
  const shifted = { ...p.scenario, balls: p.scenario.balls.map(b => b.id === 3 ? { ...b, position: { x: 1.68, y: .86 } } : b) };
  expect(kickCorridorEvidence(shifted, plan, x)).toBeNull();
});
