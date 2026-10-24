import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { nominatedBallEvidence, NOMINATED_BALL_CUT_LIMIT } from './nominated-ball';
import { directShotGeometry } from './shot-geometry';
import { PREMADE_CHARACTERS } from './characters';
import { analyzeRound } from './analysis';
import { hasProvenNextShot } from './objectives';

it.each([0,1,5,8])('preserves a genuine opener-versus-connection decision, reflection %i',seed=>{
 const scenario=generateScenario(31,seed),original=structuredClone(scenario);
 const p=prepareRound(scenario,{regenerate:false});
 expect(scenario).toEqual(original);
 expect(p.nextBallNominations!.map(c=>c.ballId)).toEqual([2,3]);
 for(const contrast of p.nextBallNominations!){
  const reserved={...p,balls:p.balls.filter(b=>b.ballId!==contrast.ballId)};
  for(const character of PREMADE_CHARACTERS){
   const lostOption=reserved.balls.flatMap(b=>b.options).find(o=>o.id===contrast.lostId)!;
   const result=analyzeRound(reserved,{ballId:lostOption.plan.ballId,optionId:lostOption.id},{samples:32,talents:character.talents});
   expect(result.candidates.some(s=>s.plan.ballId===contrast.ballId)).toBe(false);
   expect(result.best.plan.ballId).not.toBe(contrast.ballId);
   expect(result.candidates.some(s=>s.successRate>0)).toBe(true);
   const lost=result.candidates.find(s=>s.plan.id===contrast.lostId)!,kept=result.candidates.find(s=>s.plan.id===contrast.keptId)!;
   const a=nominatedBallEvidence(p.scenario,lost.plan,lost.nominal,contrast.ballId),b=nominatedBallEvidence(p.scenario,kept.plan,kept.nominal,contrast.ballId);
   expect(a.legalPot).toBe(true);expect(a.remaining).toBe(true);expect(a.routes).toHaveLength(0);expect(a.connectionMet).toBe(false);
   expect(b.connectionMet).toBe(true);
   expect(lost.plan.ballId).not.toBe(kept.plan.ballId);
   expect(directShotGeometry(p.scenario,kept.plan).cutDegrees-directShotGeometry(p.scenario,lost.plan).cutDegrees).toBeGreaterThan(8);
   const proof={...p.scenario,objective:{kind:'position' as const,ballId:kept.plan.ballId,nextBallId:contrast.ballId,radius:.2,maxCutAngle:NOMINATED_BALL_CUT_LIMIT}};
   expect(hasProvenNextShot(proof,kept.nominal)).toBe(true);
   for(const shot of result.candidates){
    const before=structuredClone(shot.nominal);
    nominatedBallEvidence(p.scenario,shot.plan,shot.nominal,contrast.ballId);
    expect(shot.nominal).toEqual(before);
   }
  }
 }
},30000);
