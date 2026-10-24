import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { angleTrapEvidence, isOvershootPair, sampledCueTravel } from './angle-trap';
import { evaluateShotObjective, hasProvenNextShot } from './objectives';
import { PREMADE_CHARACTERS } from './characters';
import { analyzeRound } from './analysis';
import { distance, dot, normalize, subtract } from './math';
import { POCKET_GEOMETRY } from './table-geometry';

it.each([0,1,5,8])('isolates in-zone overshoot for all presets, reflection %i',seed=>{
 const scenario=generateScenario(28,seed),original=structuredClone(scenario);
 const p=prepareRound(scenario,{regenerate:false});
 expect(scenario).toEqual(original);
 for(const character of PREMADE_CHARACTERS){
  const result=analyzeRound(p,{ballId:1,optionId:p.balls[0].options[0].id},{samples:32,talents:character.talents});
  expect(result.candidates.some(s=>s.successRate>0)).toBe(true);
  const shots=result.candidates.map(s=>({s,e:angleTrapEvidence(p.scenario,s.nominal),o:evaluateShotObjective(p.scenario,s.plan,s.nominal)}));
  const long=shots.find(a=>a.o.legalPot&&a.o.positioned&&!a.e.permitted.length&&a.e.best&&shots.some(b=>b.o.success&&isOvershootPair(a.s.nominal,b.s.nominal)))!;
  expect(long).toBeDefined();
  const short=shots.find(b=>b.o.success&&b.s.plan.pocketId===long.s.plan.pocketId&&isOvershootPair(long.s.nominal,b.s.nominal))!;
  expect(short).toBeDefined();
  expect(long.e.best!.cutAngle).toBeGreaterThan(63);
  expect(short.e.permitted[0].cutAngle).toBeLessThan(57);
  expect(sampledCueTravel(long.s.nominal)-sampledCueTravel(short.s.nominal)).toBeGreaterThan(.12);
  const a=long.s.nominal,b=short.s.nominal;
  expect(dot(normalize(subtract(a.cueEnd,a.firstImpact!.position)),normalize(subtract(b.cueEnd,b.firstImpact!.position)))).toBeGreaterThan(.95);
  expect(evaluateShotObjective({...p.scenario,objective:{...p.scenario.objective!,maxCutAngle:89.9}},long.s.plan,a).success).toBe(true);
  expect(hasProvenNextShot(p.scenario,b)).toBe(true);
  for(const {s} of [long,short]){
   expect(s.nominal.ballContacts).toHaveLength(1);
   expect(s.nominal.cueRebounds).toHaveLength(0);
   expect(s.nominal.scratch).toBe(false);
   expect(s.nominal.stopped).toBe(true);
   const pocket=POCKET_GEOMETRY.find(p=>p.id===s.plan.pocketId)!;
   expect(distance(s.nominal.finalBalls.find(b=>b.id===1)!.position,pocket.center)).toBeLessThan(pocket.radius);
   const before=structuredClone(s.nominal);
   angleTrapEvidence(p.scenario,s.nominal);sampledCueTravel(s.nominal);
   expect(s.nominal).toEqual(before);
  }
 }
},30000);
