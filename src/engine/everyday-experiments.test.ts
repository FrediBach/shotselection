import { it, expect } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { buildEverydayExperiment, speedProbeSummary } from './everyday-experiments';
import { postContactRebounds } from './lesson-evidence';
import { directShotGeometry } from './shot-geometry';
import { simulateShot } from './physics';
import { analyzeShot } from './analysis';
import { PREMADE_CHARACTERS } from './characters';
import { distance } from './math';
it.each([15,17,18].flatMap(level=>[0,1,5,8].map(seed=>[level,seed])))('demonstrates the actual claimed effect in level %i reflection %i',(level,seed)=>{
  const scenario=generateScenario(level,seed), original=structuredClone(scenario);
  const p=prepareRound(scenario,{regenerate:false});
  expect(p.balls.length).toBe(level===15?2:3);
  expect(p.experiment).toBeDefined();
  expect(buildEverydayExperiment({...p,balls:p.balls.slice(0,1)})).toBeNull();
  const [a,b,c]=p.experiment!.variants;
  for(const v of p.experiment!.variants) {
    const replay=simulateShot(scenario,v.plan,{record:false,recordPaths:true});
    expect(replay).toEqual(v.simulation);
    expect(replay.firstContact).toBe(v.plan.ballId);
    expect(replay.stopped).toBe(true);
    expect(replay.ballContacts).toEqual([[0,v.plan.ballId]]);
    if (replay.potted.includes(v.plan.ballId)) {
      const pocket=directShotGeometry(scenario,v.plan).pocket;
      expect(distance(replay.finalBalls.find(ball=>ball.id===v.plan.ballId)!.position,pocket.center)).toBeLessThan(pocket.radius);
    }
  }
  if(level===15 || level===17) {
    expect({...a.plan,speed:b.plan.speed}).toEqual(b.plan);
    expect(a.simulation.scratch).toBe(false);
    expect(a.simulation.potted).toContain(a.plan.ballId);
    expect(b.simulation.potted).toContain(b.plan.ballId);
  }
  if(level===15) {
    expect(b.simulation.scratch).toBe(true);
    expect(postContactRebounds(b.simulation)).toHaveLength(0);
  } else if(level===17) {
    expect(speedProbeSummary(a)).toMatchObject({railHits:0,samples:5,safeSamples:5});
    expect(speedProbeSummary(b).railHits).toBeGreaterThan(0);
    expect(speedProbeSummary(b).railHits).toBeLessThan(5);
    for(const v of [a,b]) for(const trial of v.speedTrials!) {
      expect(trial.simulation).toEqual(simulateShot(scenario,{...v.plan,speed:v.plan.speed*trial.multiplier},{record:false,recordPaths:true}));
    }
  } else {
    expect(a.plan.speed).toBe(b.plan.speed);
    expect(a.plan.topSpin).toBe(0);expect(b.plan.topSpin).toBe(0);
    expect(a.plan.sideSpin).toBe(0);expect(b.plan.sideSpin).toBe(0);
    expect(Math.abs(a.simulation.firstImpact!.cueSpeedBefore-b.simulation.firstImpact!.cueSpeedBefore)).toBeLessThan(.04);
    expect(a.simulation.firstImpact!.objectSpeedAfter-b.simulation.firstImpact!.objectSpeedAfter).toBeGreaterThan(.08);
    expect(b.simulation.firstImpact!.cueSpeedAfter).toBeGreaterThan(a.simulation.firstImpact!.cueSpeedAfter);
    expect(b.simulation.potted).not.toContain(b.plan.ballId);
    const thinGeometry = directShotGeometry(scenario,b.plan);
    expect(distance(thinGeometry.object,b.simulation.finalBalls.find(ball=>ball.id===b.plan.ballId)!.position)).toBeLessThan(thinGeometry.objectDistance-.08);
    expect(a.simulation.potted).toContain(a.plan.ballId);
    expect(c.simulation.potted).toContain(c.plan.ballId);
    expect({...b.plan,speed:c.plan.speed}).toEqual(c.plan);
    for(const v of [a,b,c]) { expect(v.simulation.objectCushions).toBe(0);expect(v.simulation.scratch).toBe(false); }
  }
  expect(scenario).toEqual(original);
},30000);
it.each([15,17,18,19])('keeps every ball viable across presets and reflections in level %i',level=>{
  for(const seed of [0,1,5,8]) {
    const p=prepareRound(generateScenario(level,seed),{regenerate:false});
    expect(p.balls).toHaveLength(level===15?2:level===19?4:3);
    for(const character of PREMADE_CHARACTERS) for(const ball of p.balls) {
      expect(ball.options.some(option=>analyzeShot(p.scenario,option.plan,32,character.talents).successRate>0)).toBe(true);
    }
  }
},60000);
