import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { PREMADE_CHARACTERS } from './characters';
import { analyzeRound } from './analysis';
import { nextPocketEvidence } from './next-pocket';
import { evaluateShotObjective, hasProvenNextShot } from './objectives';
import { POCKET_GEOMETRY } from './table-geometry';

it.each([0,1,5,8])('verifies the declared pocket independently of any-pocket scoring, reflection %i',seed=>{
 const scenario=generateScenario(30,seed),original=structuredClone(scenario);
 const prepared=prepareRound(scenario,{regenerate:false});
 expect(scenario).toEqual(original);
 for(const character of PREMADE_CHARACTERS){
  const result=analyzeRound(prepared,{ballId:1,optionId:prepared.balls[0].options[0].id},{samples:32,talents:character.talents});
  expect(result.candidates.some(s=>s.successRate>0)).toBe(true);
  const successful=result.candidates.find(s=>evaluateShotObjective(prepared.scenario,s.plan,s.nominal).success&&hasProvenNextShot(prepared.scenario,s.nominal))!;
  expect(successful).toBeDefined();
  expect(hasProvenNextShot(prepared.scenario,successful.nominal)).toBe(true);
  const checks=POCKET_GEOMETRY.map(p=>nextPocketEvidence(prepared.scenario,successful.plan,successful.nominal,p.id));
  expect(checks.some(e=>e.planMet)).toBe(true);
  expect(checks.some(e=>!e.planMet&&e.routes.length>0&&e.objective.success)).toBe(true);
  for(const shot of result.candidates){
   const before=structuredClone(shot);
   for(const pocket of POCKET_GEOMETRY){
    const e=nextPocketEvidence(prepared.scenario,shot.plan,shot.nominal,pocket.id);
    expect(e.intended?.pocketId??null).toBe(e.routes.some(r=>r.pocketId===pocket.id)?pocket.id:null);
    expect(e.planMet).toBe(e.objective.legalPot&&e.objective.positioned&&Boolean(e.intended));
    expect(e.objective).toEqual(evaluateShotObjective(prepared.scenario,shot.plan,shot.nominal));
   }
   expect(shot).toEqual(before);
  }
 }
},30000);
