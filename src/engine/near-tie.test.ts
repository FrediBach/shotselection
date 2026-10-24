import { expect, it } from 'vitest';
import { closestSuccessPair, pairedSuccessEvidence } from './near-tie';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import type { ShotAnalysis } from './types';
const outcomes = (trialSuccesses?: boolean[]) => ({ trialSuccesses } as ShotAnalysis);
it('uses discordant paired outcomes, including an exact small-sample threshold', () => {
  const a = outcomes([true,true,true,true,true,true,false,false]);
  const b = outcomes([false,false,false,false,false,false,false,false]);
  expect(pairedSuccessEvidence(a,b)).toMatchObject({ aOnly:6,bOnly:0,same:2,samples:8,pValue:.03125,clearDifference:true });
  expect(pairedSuccessEvidence(b,a)).toMatchObject({ aOnly:0,bOnly:6,pValue:.03125 });
  expect(pairedSuccessEvidence(a,a)).toMatchObject({ pValue:1,clearDifference:false });
  expect(pairedSuccessEvidence(outcomes([true,false]),outcomes([false,true]))).toMatchObject({ pValue:1,clearDifference:false });
  expect(pairedSuccessEvidence(outcomes([true]),outcomes([false]))).toMatchObject({ pValue:1,clearDifference:false });
  expect(pairedSuccessEvidence(outcomes(),a)).toBeNull();
  expect(pairedSuccessEvidence(outcomes([]),outcomes([]))).toBeNull();
  expect(pairedSuccessEvidence(outcomes([true]),a)).toBeNull();
  expect(closestSuccessPair([])).toBeNull();
});
it.each([0,1,5,8])('offers a genuine close viable pair for every preset, reflection %i', seed => {
  const p = prepareRound(generateScenario(20,seed), {regenerate:false});
  expect(p.balls).toHaveLength(4);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, {ballId:p.balls[0].ballId,optionId:p.balls[0].options[0].id}, {samples:64,talents:character.talents});
    expect(result.candidates).toHaveLength(12);
    for(const shot of result.candidates) {
      expect(shot.trialSuccesses).toHaveLength(64);
      expect(shot.trialSuccesses!.filter(Boolean).length/64).toBe(shot.successRate);
    }
    const pair = closestSuccessPair(result.candidates);
    expect(pair).not.toBeNull();
    expect(pair!.evidence.gap).toBeLessThanOrEqual(.05);
    expect(pair!.evidence.clearDifference).toBe(false);
  }
},60000);
