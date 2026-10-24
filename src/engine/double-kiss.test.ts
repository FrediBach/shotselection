import { analyzeRound } from './analysis';
import { expect,it } from 'vitest';
import {generateScenario} from './scenarios';
import {prepareRound} from './preparation';
import {simulateShot} from './physics';
import {evaluateShotObjective} from './objectives';
import {doubleKissPreview} from './double-kiss';
it.each([0,1,5,8,88*919])('proves a clean bank and unwanted second kiss, seed %i',seed=>{
 const source=generateScenario(88,seed),before=structuredClone(source),p=prepareRound(source,{regenerate:false}),data=p.doubleKiss!;
 expect(data).toBeDefined();expect(source).toEqual(before);expect(p.scenario).toEqual(source);expect(source.bank).toBeUndefined();expect(source.balls).toHaveLength(2);
 expect(source.trick).toMatchObject({minObjectCushions:1,requiredContacts:[[0,1]]});
 for(const option of p.balls[0].options)expect(evaluateShotObjective(source,option.plan,simulateShot(source,option.plan)).success).toBe(true);
 const [clear,bad]=data.variants;
 expect(clear.plan.angle).toBe(bad.plan.angle);expect(clear.plan.speed).toBe(2.5);expect(bad.plan.speed).toBe(2.5);
 expect([clear.plan.topSpin,bad.plan.topSpin]).toEqual([0,1.05]);expect(clear.plan.sideSpin).toBe(0);expect(bad.plan.sideSpin).toBe(0);
 expect(clear.success).toBe(true);expect(clear.kiss).toBeUndefined();expect(bad.success).toBe(false);expect(bad.simulation.potted).not.toContain(1);
 expect(bad.kiss!.time).toBeGreaterThan(bad.rebound.time);expect(bad.kiss!.ballIds).toEqual([0,1]);expect(bad.kiss!.pottedBefore).not.toContain(1);expect(data.deflection).toBeGreaterThan(.1);
 for(const v of data.variants){
  expect(v.simulation).toEqual(simulateShot(source,v.plan,{recordContacts:true,recordObjectRebounds:true}));
  expect(v.simulation.scratch).toBe(false);expect(v.simulation.stopped).toBe(true);expect(v.simulation.cueBanksBeforeContact).toBe(0);
  expect(v.closest.time).toBeGreaterThan(v.rebound.time);expect(v.simulation.frames).toContainEqual({time:v.closest.time,balls:v.closest.balls});
 }
 expect(doubleKissPreview(source,[])).toBeNull();expect(doubleKissPreview({...source,trick:undefined},p.balls[0].options)).toBeNull();
},30000);

it('keeps practice evidence separate from scoring',()=>{
 const p=prepareRound(generateScenario(88,88*919)),before=structuredClone(p),selection={ballId:1,optionId:p.balls[0].options[0].id};
 expect(analyzeRound(p,selection,{samples:8})).toEqual(analyzeRound({...p,doubleKiss:undefined},selection,{samples:8}));
 expect(p).toEqual(before);
});
