import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { isStopContact, isRollingContact, zoneMargin } from './position-learning';
import { POCKET_GEOMETRY } from './table-geometry';
import { evaluateShotObjective } from './objectives';
import { PREMADE_CHARACTERS } from './characters';
import { analyzeRound } from './analysis';
import { contactRollRatio } from './position-learning';
import { hasProvenNextShot } from './objectives';
import { distance } from './math';
it.each([22,23].flatMap(level=>[0,1,5,8].map(seed=>[level,seed])))('preserves the learning contrast in level %i reflection %i',(level,seed)=>{
 const p=prepareRound(generateScenario(level,seed),{regenerate:false});
 expect(p.balls).toHaveLength(1);
 const shots=p.balls[0].options.map(o=>({plan:o.plan,sim:simulateShot(p.scenario,o.plan,{record:false})}));
 for(const shot of shots) {
  const pocket=POCKET_GEOMETRY.find(p=>p.id===shot.plan.pocketId)!;
  expect(distance(shot.sim.finalBalls.find(b=>b.id===1)!.position,pocket.center)).toBeLessThan(pocket.radius);
 }
 if(level===22){
 expect(shots.some(s=>isStopContact(p.scenario,s.plan,s.sim)&&evaluateShotObjective(p.scenario,s.plan,s.sim).success)).toBe(true);
 expect(shots.some(s=>isRollingContact(p.scenario,s.plan,s.sim))).toBe(true);
 }else{
 const legal=shots.filter(s=>evaluateShotObjective(p.scenario,s.plan,s.sim).success);
 expect(legal.some(s=>zoneMargin(p.scenario,s.sim)!>=p.scenario.objective!.radius*.8)).toBe(true);
 expect(legal.some(s=>zoneMargin(p.scenario,s.sim)!<=p.scenario.objective!.radius*.3)).toBe(true);
 }
},30000);

it.each([22,23])('keeps the position lesson playable for all presets and reflections, level %i',level=>{
 for(const seed of [0,1,5,8]) {
  const scenario=generateScenario(level,seed),original=structuredClone(scenario);
  const p=prepareRound(scenario,{regenerate:false});
  expect(scenario).toEqual(original);
  const options=p.balls[0].options;
  for(const character of PREMADE_CHARACTERS) {
   const result=analyzeRound(p,{ballId:1,optionId:options[0].id},{samples:32,talents:character.talents});
   expect(result.candidates.some(s=>s.successRate>0)).toBe(true);
   if(level===23) {
    const legal=result.candidates.filter(s=>evaluateShotObjective(p.scenario,s.plan,s.nominal).success);
    expect(legal.length).toBeGreaterThanOrEqual(2);
    for(const shot of legal) {
     expect(hasProvenNextShot(p.scenario,shot.nominal)).toBe(true);
     const count=shot.sampleBallEnds.filter(balls=>{const cue=balls.find(b=>b.id===0)!;return !cue.pocketed&&distance(cue.position,p.scenario.objective!.target!)<=p.scenario.objective!.radius;}).length;
     // All these short direct strokes settle; verify the displayed in-zone fraction.
     expect(shot.positionRate).toBe(count/shot.samples);
    }
   }else {
    const stop=result.candidates.find(s=>isStopContact(p.scenario,s.plan,s.nominal))!;
    expect(stop.plan.topSpin).toBeLessThan(0);
    expect(Math.abs(contactRollRatio(stop.nominal)!)).toBeLessThan(.15);
   }
  }
 }
},60000);
it('rejects a layout that cannot provide the authored near-full contact',()=>{
 const scenario=generateScenario(22,0);
 scenario.balls[0].position.x+=.5;
 expect(()=>prepareRound(scenario,{regenerate:false})).toThrow(/No feasible/);
});
