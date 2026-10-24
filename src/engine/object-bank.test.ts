import { expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { objectBankReplay } from './object-bank';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { evaluateShotObjective } from './objectives';
import { TABLE } from './constants';
it.each([0,1,5,8,87*919])('identifies the counted object-ball rebound, seed %i', seed => {
  const source=generateScenario(87,seed), before=structuredClone(source), p=prepareRound(source,{regenerate:false});
  expect(p.scenario).toEqual(before);
  for(const option of p.balls[0].options){
    const analysis=analyzeShot(source,option.plan,8), sim=analysis.nominal, saved=structuredClone(sim), data=objectBankReplay(source,sim)!;
    expect(data).not.toBeNull(); expect(data.ballId).toBe(1); expect(data.rebound.ballId).toBe(1);
    expect(sim.objectRebounds).toHaveLength(sim.objectCushions!); expect(sim.objectCushions).toBeGreaterThanOrEqual(1);
    expect(sim.cueBanksBeforeContact).toBe(0); expect(data.rebound.time).toBeGreaterThan(data.contact.time);
    expect(data.rebound.position).toEqual(data.rebound.balls.find(b=>b.id===1)!.position);
    expect(Math.min(data.rebound.position.y,1.27-data.rebound.position.y)).toBeCloseTo(TABLE.ballRadius,2);
    expect(data.rebound.incoming.y*data.rebound.outgoing.y).toBeLessThan(0);
    expect(data.before[0]).toEqual(data.contact.balls!.find(b=>b.id===1)!.position);
    expect(data.before.at(-1)).toEqual(data.rebound.position); expect(data.after[0]).toEqual(data.rebound.position);
    expect(data.after.at(-1)).toEqual(sim.finalBalls.find(b=>b.id===1)!.position);
    const frames=sim.frames.filter(f=>f.time>data.rebound.time), expected=[data.rebound.position];
    for(const frame of frames){const ball=frame.balls.find(b=>b.id===1)!;expected.push(ball.position);if(ball.pocketed)break;}
    expect(data.after).toEqual(expected);
    expect(evaluateShotObjective(source,option.plan,sim).success).toBe(true);
    expect(evaluateShotObjective(source,option.plan,{...sim,objectCushions:0,cueBanksBeforeContact:3}).success).toBe(false);
    const ordinary=simulateShot(source,option.plan);
    expect(ordinary.objectRebounds).toBeUndefined();
    for(const key of ['frames','finalBalls','objectCushions','potted','cueRebounds','ballContacts','duration'] as const)expect(sim[key]).toEqual(ordinary[key]);
    const recorded=simulateShot(source,option.plan,{record:false,recordObjectRebounds:true});
    expect(recorded.objectRebounds).toEqual(sim.objectRebounds); expect(recorded.objectCushions).toBe(sim.objectCushions);
    const {nominal:ignored,...scores}=analysis, {nominal:other,...old}=analyzeShot({...source,curriculum:undefined},option.plan,8);
    void ignored;void other;expect(scores).toEqual(old);expect(sim).toEqual(saved);
    expect(objectBankReplay(source,{...sim,objectRebounds:undefined})).toBeNull();
    expect(objectBankReplay(source,{...sim,frames:[]})).toBeNull();
    expect(objectBankReplay(source,{...sim,objectRebounds:sim.objectRebounds!.map(e=>({...e,ballId:0}))})).toBeNull();
    expect(objectBankReplay({...source,trick:undefined},sim)).toBeNull();
  }
  expect(source).toEqual(before);
},30000);
