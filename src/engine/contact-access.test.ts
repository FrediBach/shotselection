import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { contactAccessEvidence } from './contact-access';
import { TABLE } from './constants';
import { angleTrapEvidence } from './angle-trap';
import { evaluateShotObjective } from './objectives';
import { PREMADE_CHARACTERS } from './characters';
import { analyzeRound } from './analysis';
import { hasProvenNextShot } from './objectives';
import { distance } from './math';
import { POCKET_GEOMETRY } from './table-geometry';
it.each([0,1,5,8])('proves contact clearance independently of the cut limit, reflection %i',seed=>{
 const scenario=generateScenario(26,seed),original=structuredClone(scenario);
 const p=prepareRound(scenario,{regenerate:false});
 expect(scenario).toEqual(original);
 for(const character of PREMADE_CHARACTERS){
  const result=analyzeRound(p,{ballId:1,optionId:p.balls[0].options[0].id},{samples:32,talents:character.talents});
  expect(result.candidates.some(s=>s.successRate>0)).toBe(true);
  const shots=result.candidates.map(s=>({s,e:contactAccessEvidence(p.scenario,s.nominal,p.contactAccessPocket!),o:evaluateShotObjective(p.scenario,s.plan,s.nominal)}));
  const near=shots.find(s=>s.o.legalPot&&s.o.positioned&&s.e?.visible&&s.e.prematureContact)!;
  expect(near).toBeDefined();
  const far=shots.find(s=>s.o.success&&s.e?.permitted&&s.e.distance>near.e!.distance+.08&&s.s.plan.pocketId===near.s.plan.pocketId)!;
  expect(far).toBeDefined();
  expect(near.e!.distance).toBeLessThan(.18);
  expect(near.e!.distance).toBeGreaterThan(TABLE.ballDiameter+.002);
  expect(distance(near.e!.firstTouch,near.e!.object)).toBeCloseTo(TABLE.ballDiameter,8);
  expect(distance(near.e!.firstTouch,near.e!.ghost)).toBeGreaterThan(.002);
  expect(distance(far.e!.firstTouch,far.e!.ghost)).toBeLessThan(.00001);
  expect(angleTrapEvidence(p.scenario,near.s.nominal).unrestricted).toHaveLength(0);
  expect(hasProvenNextShot(p.scenario,far.s.nominal)).toBe(true);
  for(const {s} of shots){
   expect(s.nominal.ballContacts).toHaveLength(1);
   const pocket=POCKET_GEOMETRY.find(p=>p.id===s.plan.pocketId)!;
   expect(distance(s.nominal.finalBalls.find(b=>b.id===1)!.position,pocket.center)).toBeLessThan(pocket.radius);
   const before=structuredClone(s.nominal);
   contactAccessEvidence(p.scenario,s.nominal,p.contactAccessPocket!);
   expect(s.nominal).toEqual(before);
  }
 }
},30000);
