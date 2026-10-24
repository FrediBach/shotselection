import { distance } from './math';
import { simulateShot } from './physics';
import { directShotGeometry } from './shot-geometry';
import { cueStroke } from './table-conditions';
import { POCKET_GEOMETRY } from './table-geometry';
import type { DrawDecayExperiment, PreparedRound, Scenario, ShotPlan } from './types';

/** Unscored, collinear approaches: only cue position changes in the first pair,
 * then only launch backspin changes in the long-approach recovery. */
export function buildDrawDecayExperiment(round: PreparedRound): DrawDecayExperiment | null {
 const scenario=round.scenario, cue=scenario.balls.find(b=>b.id===0)!;
 const run=(label:string, layout:Scenario, plan:ShotPlan)=>{
  const simulation=simulateShot(layout,plan,{record:false,recordPaths:true});
  const stroke=cueStroke(plan,layout.conditions);
  return {label,scenario:layout,plan,simulation,approach:distance(layout.balls.find(b=>b.id===0)!.position,simulation.firstImpact?.position??cue.position),launchSpeed:stroke.speed,launchRollSpeed:stroke.speed*stroke.topSpin};
 };
 const valid=(v:ReturnType<typeof run>)=>{
  const sim=v.simulation,pocket=POCKET_GEOMETRY.find(p=>p.id===v.plan.pocketId)!;
  return sim.stopped&&!sim.scratch&&sim.firstContact===v.plan.ballId&&sim.ballContacts?.length===1
   &&!sim.objectCushions&&!sim.cueRebounds?.some(r=>r.beforeContact)
   &&sim.potted.includes(v.plan.ballId)&&distance(sim.finalBalls.find(b=>b.id===v.plan.ballId)!.position,pocket.center)<pocket.radius;
 };
 for(const option of round.balls[0]?.options??[]){
  const geometry=directShotGeometry(scenario,option.plan);
  if(geometry.cueDistance<.6) continue;
  const short:Scenario={...scenario,balls:scenario.balls.map(b=>b.id!==0?b:{...b,position:{
   x:cue.position.x+Math.cos(option.plan.angle)*(geometry.cueDistance-.2),
   y:cue.position.y+Math.sin(option.plan.angle)*(geometry.cueDistance-.2),
  }})};
  for(const speed of [1.8,2.1,2.4,2.7,3,3.3]) for(const topSpin of [-.25,-.4,-.6,-.8]){
   const plan={...option.plan,speed,topSpin,sideSpin:0};
   const long=run('Long approach',scenario,plan);
   if(!valid(long)||(long.simulation.firstImpact?.cueRollSpeedBefore??-1)<.08) continue;
   const close=run('Short approach',short,plan);
   if(!valid(close)||(close.simulation.firstImpact?.cueRollSpeedBefore??1)>-.08||long.approach-close.approach<.4) continue;
   const recovery=run('Long approach · more backspin',scenario,{...plan,topSpin:-1.1});
   if(!valid(recovery)||(recovery.simulation.firstImpact?.cueRollSpeedBefore??1)>-.08) continue;
   return {variants:[close,long,recovery]};
  }
 }
 return null;
}
