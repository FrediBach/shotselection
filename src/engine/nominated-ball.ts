import { directShotRoutes, evaluateShotObjective, hasProvenNextShot } from './objectives';
import { directShotGeometry } from './shot-geometry';
import { simulateShot } from './physics';
import type { PreparedRound, Scenario, ShotPlan, Simulation } from './types';

export const NOMINATED_BALL_CUT_LIMIT = 60;

export function nominatedBallEvidence(scenario: Scenario, plan: ShotPlan, sim: Simulation, ballId: number) {
 const remaining=sim.finalBalls.some(b=>b.id===ballId&&!b.pocketed);
 const routes=remaining&&ballId!==plan.ballId&&sim.stopped&&!sim.scratch
  ?directShotRoutes(sim.finalBalls.filter(b=>!b.pocketed),ballId,NOMINATED_BALL_CUT_LIMIT):[];
 const legalPot=evaluateShotObjective(scenario,plan,sim).legalPot;
 return {remaining,routes,legalPot,connectionMet:legalPot&&routes.length>0};
}

/** Require an easier opening cut that loses a named connection and a harder
 * opening cut that preserves it. This is geometry, not an ensemble ranking. */
export function findNominatedBallContrasts(prepared: PreparedRound) {
 const contrasts: { ballId: number; lostId: string; keptId: string }[] = [];
 const shots=prepared.balls.flatMap(b=>b.options).map(o=>({option:o,sim:simulateShot(prepared.scenario,o.plan,{record:false}),cut:directShotGeometry(prepared.scenario,o.plan).cutDegrees}));
 for(const ball of prepared.scenario.balls.filter(b=>b.id!==0)){
  const choices=shots.filter(s=>s.option.plan.ballId!==ball.id).map(s=>({...s,e:nominatedBallEvidence(prepared.scenario,s.option.plan,s.sim,ball.id)}));
  search: for(const lost of choices.filter(s=>s.e.legalPot&&s.e.remaining&&!s.e.routes.length))
   for(const kept of choices.filter(s=>s.e.connectionMet&&s.option.plan.ballId!==lost.option.plan.ballId&&s.cut>lost.cut+8)){
    const proofScenario={...prepared.scenario,objective:{kind:'position' as const,ballId:kept.option.plan.ballId,nextBallId:ball.id,radius:.2,maxCutAngle:NOMINATED_BALL_CUT_LIMIT}};
    if(hasProvenNextShot(proofScenario,kept.sim)) { contrasts.push({ballId:ball.id,lostId:lost.option.id,keptId:kept.option.id}); break search; }
   }
 }
 return contrasts;
}
