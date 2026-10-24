import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { angleTrapEvidence } from './angle-trap';
import { evaluateShotObjective } from './objectives';
import { PREMADE_CHARACTERS } from './characters';
import { analyzeRound } from './analysis';
import { hasProvenNextShot } from './objectives';
import { distance } from './math';
import { POCKET_GEOMETRY } from './table-geometry';
it.each([0,1,5,8])('isolates the next-angle trap, reflection %i',seed=>{
 const p=prepareRound(generateScenario(25,seed),{regenerate:false});
 const shots=p.balls[0].options.map(o=>{const sim=simulateShot(p.scenario,o.plan,{record:false});return {plan:o.plan,sim,e:angleTrapEvidence(p.scenario,sim),objective:evaluateShotObjective(p.scenario,o.plan,sim)};});
 const near=shots.find(s=>s.objective.positioned&&s.objective.legalPot&&!s.e.permitted.length&&s.e.best)!;
 const far=shots.find(s=>s.objective.success&&s.e.distance!>near?.e.distance!)!;
 expect(near).toBeDefined();expect(far).toBeDefined();
 expect(near.e.best!.cutAngle).toBeGreaterThan(p.scenario.objective!.maxCutAngle+3);
 expect(far.e.permitted[0].cutAngle).toBeLessThan(p.scenario.objective!.maxCutAngle-3);
},30000);

it.each([0,1,5,8])('keeps a proven alternative under every preset, reflection %i',seed=>{
 const scenario=generateScenario(25,seed),original=structuredClone(scenario);
 const p=prepareRound(scenario,{regenerate:false});
 expect(scenario).toEqual(original);
 for(const character of PREMADE_CHARACTERS){
  const result=analyzeRound(p,{ballId:1,optionId:p.balls[0].options[0].id},{samples:32,talents:character.talents});
  expect(result.candidates.some(s=>s.successRate>0)).toBe(true);
  for(const s of result.candidates){
   const pocket=POCKET_GEOMETRY.find(p=>p.id===s.plan.pocketId)!;
   expect(distance(s.nominal.finalBalls.find(b=>b.id===1)!.position,pocket.center)).toBeLessThan(pocket.radius);
   const before=structuredClone(s.nominal);
   const e=angleTrapEvidence(p.scenario,s.nominal);
   expect(s.nominal).toEqual(before);
   if(evaluateShotObjective(p.scenario,s.plan,s.nominal).success) expect(hasProvenNextShot(p.scenario,s.nominal)).toBe(true);
   if(evaluateShotObjective(p.scenario,s.plan,s.nominal).positioned&&!e.permitted.length) {
    expect(e.unrestricted.length).toBeGreaterThan(0);
    expect(e.unrestricted.every(r=>r.cutAngle>p.scenario.objective!.maxCutAngle)).toBe(true);
    expect(evaluateShotObjective({...p.scenario,objective:{...p.scenario.objective!,maxCutAngle:89.9}},s.plan,s.nominal).success).toBe(true);
   }
  }
 }
},30000);
