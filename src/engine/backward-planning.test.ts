import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { directShotRoutes, directNextShotRoutes, evaluateShotObjective } from './objectives';
import { simulateShot } from './physics';
import { distance, dot, normalize, subtract } from './math';
import { TABLE } from './constants';
import { POCKET_GEOMETRY } from './table-geometry';
import { PREMADE_CHARACTERS } from './characters';
import { analyzeRound } from './analysis';
it.each([0,1,5,8])('builds a reachable backward plan with independently checked samples, reflection %i',seed=>{
 const scenario=generateScenario(24,seed), original=structuredClone(scenario);
 const prepared=prepareRound(scenario,{regenerate:false});
 const plan=prepared.backwardPlan!,objective=prepared.scenario.objective!;
 expect(plan).toBeDefined();expect(scenario).toEqual(original);
 const direction=normalize(subtract(POCKET_GEOMETRY[plan.pocketId].center,plan.object));
 expect(distance(plan.ghost,plan.object)).toBeCloseTo(TABLE.ballDiameter,10);
 expect(dot(normalize(subtract(plan.object,plan.ghost)),direction)).toBeCloseTo(1,10);
 expect(dot(normalize(subtract(plan.object,plan.opposite)),direction)).toBeCloseTo(-1,10);
 expect(plan.samples.some(s=>s.compatible)).toBe(true);
 for(const sample of plan.samples){
  expect(distance(sample.position,objective.target!)).toBeLessThanOrEqual(objective.radius+1e-9);
  const balls=scenario.balls.filter(b=>b.id!==1).map(b=>b.id===0?{...b,position:sample.position}:b);
  expect(sample.compatible).toBe(directShotRoutes(balls,2,objective.maxCutAngle).some(r=>r.pocketId===plan.pocketId));
 }
 expect(prepared.balls[0].options.some(option=>{
  const sim=simulateShot(prepared.scenario,option.plan,{record:false});
  return evaluateShotObjective(prepared.scenario,option.plan,sim).success&&directNextShotRoutes(prepared.scenario,sim).some(r=>r.pocketId===plan.pocketId);
 })).toBe(true);
 for(const character of PREMADE_CHARACTERS){
  const result=analyzeRound(prepared,{ballId:1,optionId:prepared.balls[0].options[0].id},{samples:32,talents:character.talents});
  expect(result.candidates.some(s=>s.successRate>0)).toBe(true);
 }
},30000);
