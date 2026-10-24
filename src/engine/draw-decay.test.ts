import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { directShotGeometry } from './shot-geometry';
import { PREMADE_CHARACTERS } from './characters';
import { analyzeRound } from './analysis';
import { hasProvenNextShot, evaluateShotObjective } from './objectives';
import { POCKET_GEOMETRY } from './table-geometry';
import { distance } from './math';

it.each([0,1,5,8])('isolates draw decay and spin-only recovery, reflection %i',seed=>{
 const scenario=generateScenario(27,seed),original=structuredClone(scenario);
 const p=prepareRound(scenario,{regenerate:false});
 expect(scenario).toEqual(original);
 const [short,long,recovery]=p.drawDecay!.variants;
 expect(short.plan).toEqual(long.plan);
 expect(recovery.scenario).toEqual(long.scenario);
 expect({...recovery.plan,topSpin:long.plan.topSpin}).toEqual(long.plan);
 expect(recovery.plan.topSpin).toBeLessThan(long.plan.topSpin);
 expect(short.scenario.balls.filter(b=>b.id!==0)).toEqual(long.scenario.balls.filter(b=>b.id!==0));
 expect(short.scenario.conditions).toEqual(long.scenario.conditions);
 expect(directShotGeometry(short.scenario,short.plan).cutDegrees).toBeCloseTo(directShotGeometry(long.scenario,long.plan).cutDegrees,5);
 expect(long.approach-short.approach).toBeGreaterThan(.4);
 expect(short.launchRollSpeed).toEqual(long.launchRollSpeed);
 expect(short.launchRollSpeed).toBeLessThan(0);
 expect(short.simulation.firstImpact!.cueRollSpeedBefore).toBeLessThan(-.08);
 expect(long.simulation.firstImpact!.cueRollSpeedBefore).toBeGreaterThan(.08);
 expect(recovery.simulation.firstImpact!.cueRollSpeedBefore).toBeLessThan(-.08);
 for(const v of p.drawDecay!.variants){
  expect(v.simulation.stopped).toBe(true);
  expect(v.simulation.scratch).toBe(false);
  expect(v.simulation.ballContacts).toHaveLength(1);
  expect(v.simulation.cueRebounds?.filter(r=>r.beforeContact)??[]).toHaveLength(0);
  expect(v.simulation.objectCushions).toBe(0);
  expect(v.simulation.potted).toContain(v.plan.ballId);
  expect(distance(v.simulation.finalBalls.find(b=>b.id===v.plan.ballId)!.position,POCKET_GEOMETRY.find(p=>p.id===v.plan.pocketId)!.center)).toBeLessThan(.1);
 }
},30000);

it.each([0,1,5,8])('preserves the separate scored position challenge, reflection %i',seed=>{
 const p=prepareRound(generateScenario(27,seed),{regenerate:false});
 const before=structuredClone(p);
 for(const character of PREMADE_CHARACTERS){
  const result=analyzeRound(p,{ballId:1,optionId:p.balls[0].options[0].id},{samples:32,talents:character.talents});
  expect(result.candidates).toHaveLength(3);
  expect(result.candidates.some(s=>s.successRate>0)).toBe(true);
  expect(result.candidates.some(s=>evaluateShotObjective(p.scenario,s.plan,s.nominal).success&&hasProvenNextShot(p.scenario,s.nominal))).toBe(true);
 }
 expect(p).toEqual(before);
},30000);
