import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { signedAngleEvidence, pointsTowardPreview } from './signed-angle';
import { PREMADE_CHARACTERS } from './characters';
import { analyzeRound } from './analysis';
import { evaluateShotObjective, hasProvenNextShot } from './objectives';
import { distance, dot, normalize, subtract } from './math';
import { TABLE } from './constants';

it.each([0,1,5,8])('isolates opposite legal sides for every preset, reflection %i',seed=>{
 const scenario=generateScenario(29,seed),original=structuredClone(scenario);
 const p=prepareRound(scenario,{regenerate:false}),preview=p.signedAnglePreview!;
 expect(scenario).toEqual(original);
 expect(preview.choices).toHaveLength(2);
 expect(preview.choices[0].angle*preview.choices[1].angle).toBeLessThan(0);
 expect(preview.choices.filter(c=>pointsTowardPreview(c,preview.target))).toHaveLength(1);
 expect(preview.target.x-preview.radius).toBeGreaterThan(TABLE.ballRadius);
 expect(preview.target.y-preview.radius).toBeGreaterThan(TABLE.ballRadius);
 expect(preview.target.x+preview.radius).toBeLessThan(TABLE.length-TABLE.ballRadius);
 expect(preview.target.y+preview.radius).toBeLessThan(TABLE.width-TABLE.ballRadius);
 const preparedBefore=structuredClone(p);
 for(const character of PREMADE_CHARACTERS){
  const result=analyzeRound(p,{ballId:1,optionId:p.balls[0].options[0].id},{samples:32,talents:character.talents});
  expect(result.candidates.some(s=>s.successRate>0)).toBe(true);
  const shots=preview.choices.map(c=>result.candidates.find(s=>s.plan.id===c.optionId)!);
  expect(shots[0].plan.pocketId).toBe(shots[1].plan.pocketId);
  for(const [i,s] of shots.entries()){
   const e=signedAngleEvidence(p.scenario,s.nominal,preview.pocketId)!;
   expect(e).not.toBeNull();
   expect(e.angle).toBeCloseTo(preview.choices[i].angle,8);
   expect(Math.abs(e.angle)).toBeGreaterThanOrEqual(8);
   expect(Math.abs(e.angle)).toBeLessThanOrEqual(57);
   expect(Math.abs(e.angle)).toBeCloseTo(e.cutAngle,8);
   expect(dot(e.departure,normalize(subtract(e.pocket.center,e.object)))).toBeCloseTo(0,8);
   expect(distance(s.nominal.cueEnd,preview.choices[i].cue)).toBeLessThan(1e-8);
   expect(evaluateShotObjective(p.scenario,s.plan,s.nominal).success).toBe(true);
   expect(hasProvenNextShot(p.scenario,s.nominal)).toBe(true);
   expect(s.nominal.ballContacts).toHaveLength(1);
   expect(distance(e.object,scenario.balls.find(b=>b.id===2)!.position)).toBeLessThan(.001);
  }
 }
 expect(p).toEqual(preparedBefore);
},30000);
