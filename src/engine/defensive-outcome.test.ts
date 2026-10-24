import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { analyzeRound } from './analysis';
import { defensiveOutcome, defenseSummary, defenseWinner, directReplyPotted } from './defensive-outcome';
import { simulateShot } from './physics';
import { directShotRoutes, evaluateShotObjective } from './objectives';
import { secondShotPotted } from './second-shot';
import { perturbShot } from './stroke-errors';
import { seededRandom } from './math';
import { DEFAULT_CHARACTER, PREMADE_CHARACTERS } from './characters';
it.each([0, 1, 5, 8, 76 * 919])('evaluates actual opponent leaves without rewarding invalid misses, seed %i', seed => {
  const source = generateScenario(76, seed), before = structuredClone(source), p = prepareRound(source, { regenerate: false });
  expect(source).toEqual(before); expect(p.scenario.balls).toEqual(source.balls);
  const plain = prepareRound({ ...source, curriculum: { ...source.curriculum!, learning: undefined } }, { regenerate: false });
  expect(p.scenario.objective).toEqual(plain.scenario.objective);
  const [a, b, c] = p.balls[0].options;
  for (const [o, original] of [[a, plain.balls[0].options[0]], [c, plain.balls[0].options[2]]]) expect({ ...o.plan, id: original.id }).toEqual(original.plan);
  expect(b.plan.speed).toBe(c.plan.speed * .95); expect(b.plan.topSpin).toBe(c.plan.topSpin - .2);
  expect(b.plan.angle).toBe(c.plan.angle); expect(b.plan.sideSpin).toBe(c.plan.sideSpin); expect(b.plan.pocketId).toBe(c.plan.pocketId);
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(Math.hypot(p.balls[0].options[i].plan.target.x - p.balls[0].options[j].plan.target.x, p.balls[0].options[i].plan.target.y - p.balls[0].options[j].plan.target.y)).toBeGreaterThanOrEqual(.12);
  for (const o of [b, c]) expect(evaluateShotObjective(p.scenario, o.plan, simulateShot(p.scenario, o.plan)).success).toBe(true);
  const result = analyzeRound(p, { ballId: 1, optionId: b.id }, { samples: 64 });
  const summaries = [b, c].map(o => { const s = result.candidates.find(x => x.plan.id === o.id)!; return defenseSummary(s.defenseTrials!, s.trialSuccesses!); });
  expect(Math.abs(summaries[0].completed - summaries[1].completed)).toBeLessThanOrEqual(6);
  expect(defenseWinner(...summaries as [typeof summaries[0], typeof summaries[0]])).toBe('second');
  for (const shot of result.candidates) {
    const random = seededRandom(source.seed ^ 0x3A7B91);
    const trials = shot.defenseTrials!, summary = defenseSummary(trials, shot.trialSuccesses!);
    expect(Object.values(summary.counts).reduce((a, b) => a + b, 0)).toBe(shot.samples);
    expect(summary.completed / shot.samples).toBe(shot.successRate);
    expect(summary.counts.pot / shot.samples).toBe(shot.legalPotRate);
    expect(summary.twoWay).toBeLessThanOrEqual(shot.samples);
    for (const [i, trial] of trials.entries()) {
      const plan = perturbShot(shot.plan, random, DEFAULT_CHARACTER.talents), sim = simulateShot(p.scenario, plan, { record: false, recordPaths: true });
      expect(trial).toEqual(defensiveOutcome(p.scenario, sim).trial);
      if (trial.kind === 'screened' || trial.kind === 'limited') {
        expect(shot.trialSuccesses![i]).toBe(false); expect(sim.stopped && !sim.scratch && sim.firstContact === 1 && !sim.potted.length).toBe(true);
        expect(directShotRoutes(sim.finalBalls.filter(b => !b.pocketed), 1, source.defense!.maxCutAngle)).toHaveLength(0);
      }
    }
    for (const [kind, e] of Object.entries(shot.defenseExamples!)) {
      expect(trials[e.index].kind).toBe(kind); expect(trials.slice(0, e.index).some(t => t.kind === kind)).toBe(false);
      expect(e.opening).toEqual(simulateShot(p.scenario, e.openingPlan, { record: false, recordPaths: true }));
      expect(e.opening.finalBalls).toEqual(shot.sampleBallEnds[e.index]);
      const balls = e.opening.finalBalls.filter(b => !b.pocketed).map(b => ({ id: b.id, position: b.position }));
      expect(e.reply.scenario.balls).toEqual(kind === 'open' ? balls : balls.filter(b => b.id !== e.blockerId));
      expect(e.reply.simulation).toEqual(simulateShot(e.reply.scenario, e.reply.plan, { record: false, recordPaths: true }));
      expect(secondShotPotted(1, e.reply.simulation)).toBe(true); expect(directReplyPotted(e.reply.plan, e.reply.simulation)).toBe(true);
      expect(directReplyPotted(e.reply.plan, { ...e.reply.simulation, ballContacts: [[0, 1], [1, 3]] })).toBe(false);
      expect(directReplyPotted({ ...e.reply.plan, pocketId: (e.reply.plan.pocketId + 1) % 6 }, e.reply.simulation)).toBe(false);
      if (kind === 'screened') { expect(e.blockedReply).toEqual(simulateShot({ ...e.reply.scenario, balls }, e.reply.plan, { record: false, recordPaths: true })); expect(e.blockedReply!.firstContact).toBe(e.blockerId); }
    }
  }
  const ordinary = analyzeRound({ ...p, scenario: { ...p.scenario, defense: undefined }, defenseOptionIds: undefined }, { ballId: 1, optionId: b.id }, { samples: 64 });
  expect(result.points).toBe(ordinary.points); expect(result.scoring).toEqual(ordinary.scoring);
  for (const s of result.candidates) { const { defenseTrials: _trials, defenseExamples: _examples, ...rest } = s; expect(rest).toEqual(ordinary.candidates.find(x => x.plan.id === s.plan.id)); }
}, 60000);
it('keeps invalid turns out of defensive credit and validates the opponent objective', () => {
  const p = prepareRound(generateScenario(76, 76 * 919), { regenerate: false });
  const r = analyzeRound(p, { ballId: 1, optionId: p.defenseOptionIds![1] }, { samples: 64 });
  const s = r.candidates.find(s => s.plan.id === p.defenseOptionIds![1])!, e = s.defenseExamples!.screened!;
  for (const flags of [{ stopped: false }, { scratch: true }, { firstContact: 4 }, { potted: [3] }, { objectCushions: 0, cueRebounds: [] }]) expect(defensiveOutcome(p.scenario, { ...e.opening, ...flags }).trial.kind).toBe('ineligible');
  expect(defensiveOutcome(p.scenario, s.nominal).trial.kind).toBe('pot');
  expect(() => defensiveOutcome({ ...p.scenario, defense: undefined }, s.nominal)).toThrow('opponent objective');
  for (const defense of [{ ballId: 2, maxCutAngle: 60 }, { ballId: 1, maxCutAngle: 90 }, { ballId: 1, maxCutAngle: NaN }]) expect(() => prepareRound({ ...p.scenario, defense })).toThrow('defensive objective');
  const empty = defenseSummary([], []); expect(defenseWinner(empty, empty)).toBeNull();
  const same = defenseSummary([{ kind: 'screened' }, { kind: 'open' }], [false, false]); expect(defenseWinner(same, same)).toBe('equal');
  const denied = defenseSummary([{ kind: 'limited' }], [false]); expect(defenseWinner(denied, same)).toBe('first');
  expect(defenseSummary([{ kind: 'unproven' }, { kind: 'ineligible' }], [false, false]).twoWay).toBe(0);
}, 30000);
it('remains playable for every character and reports unresolved searches honestly', () => {
  const p = prepareRound(generateScenario(76, 1), { regenerate: false });
  for (const character of PREMADE_CHARACTERS) {
    const r = analyzeRound(p, { ballId: 1, optionId: p.defenseOptionIds![0] }, { samples: 32, talents: character.talents });
    expect(r.candidates.some(s => s.successRate > 0)).toBe(true);
    for (const s of r.candidates) expect(defenseSummary(s.defenseTrials!, s.trialSuccesses!).total).toBe(32);
  }
  const r = analyzeRound(p, { ballId: 1, optionId: p.defenseOptionIds![0] }, { samples: 64 });
  expect(r.candidates.some(s => s.defenseTrials!.some(t => t.kind === 'unproven'))).toBe(true);
}, 30000);
