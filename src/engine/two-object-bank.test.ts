import { expect,it } from 'vitest';
import {generateScenario} from './scenarios';
import {prepareRound,MIN_FINISH_SEPARATION} from './preparation';
import {analyzeShot} from './analysis';
import {simulateShot} from './physics';
import {evaluateShotObjective} from './objectives';
import {twoObjectBankReplay} from './two-object-bank';
import {distance} from './math';
it.each([0,1,5,8,89*919])('proves two object rebounds with a simple cue finish, seed %i',seed=>{
 const source=generateScenario(89,seed),before=structuredClone(source),p=prepareRound(source,{regenerate:false});
 expect(source).toEqual(before);expect(p.scenario).toEqual(source);expect(source.bank).toBeUndefined();expect(source.balls).toHaveLength(2);expect(source.trick!.minObjectCushions).toBe(2);
 for(const option of p.balls[0].options){
  const a=analyzeShot(source,option.plan,8),sim=a.nominal,data=twoObjectBankReplay(source,sim)!;
  expect(data).not.toBeNull();expect(sim.objectCushions).toBe(2);expect(sim.cueRebounds).toHaveLength(0);expect(sim.ballContacts).toEqual([[0,1]]);
  expect(data.sides).toEqual(['long','short']);expect(data.rebounds[0].time).toBeLessThan(data.rebounds[1].time);
  for(const [i,r] of data.rebounds.entries()){
   expect(r.ballId).toBe(1);expect(r.balls.find(b=>b.id===1)!.pocketed).toBe(false);
   expect(data.segments[i].at(-1)).toEqual(r.position);expect(data.segments[i+1][0]).toEqual(r.position);
   expect(data.speeds[i].before).toBe(Math.hypot(r.incoming.x,r.incoming.y));expect(data.speeds[i].after).toBe(Math.hypot(r.outgoing.x,r.outgoing.y));expect(data.speeds[i].after).toBeLessThan(data.speeds[i].before);
   expect(i===0?r.incoming.y*r.outgoing.y:r.incoming.x*r.outgoing.x).toBeLessThan(0);
  }
  expect(data.segments[2].at(-1)).toEqual(sim.finalBalls.find(b=>b.id===1)!.position);
  expect(evaluateShotObjective(source,option.plan,sim).success).toBe(true);
  for(const count of [0,1])expect(evaluateShotObjective(source,option.plan,{...sim,objectCushions:count,cueBanksBeforeContact:3}).success).toBe(false);
  const {nominal:ignored,...scored}=a,{nominal:ordinary,...scores}=analyzeShot({...source,curriculum:undefined},option.plan,8);
  void ignored;expect(scored).toEqual(scores);expect(sim.frames).toEqual(ordinary.frames);expect(sim.finalBalls).toEqual(ordinary.finalBalls);
  expect(sim.finalBalls).toEqual(simulateShot(source,option.plan).finalBalls);
  for(const other of p.balls[0].options)if(other.id!==option.id)expect(distance(option.plan.target,other.plan.target)).toBeGreaterThanOrEqual(MIN_FINISH_SEPARATION);
  expect(twoObjectBankReplay(source,{...sim,objectRebounds:sim.objectRebounds!.slice(0,1)})).toBeNull();
  expect(twoObjectBankReplay(source,{...sim,objectRebounds:[...sim.objectRebounds!].reverse()})).toBeNull();
  expect(twoObjectBankReplay(source,{...sim,objectRebounds:sim.objectRebounds!.map(r=>({...r,ballId:0}))})).toBeNull();
  expect(twoObjectBankReplay(source,{...sim,frames:[]})).toBeNull();
 }
 expect(source).toEqual(before);
},30000);
