import { TABLE } from './constants';
import { clearsRails, directNextShotRoutes } from './objectives';
import { distance, dot, normalize, segmentDistance, subtract } from './math';
import { POCKET_GEOMETRY } from './table-geometry';
import type { Scenario, Simulation } from './types';

/** Settled cue-to-ghost approach: touching the next ball early prevents this contact. */
export function contactAccessEvidence(scenario: Scenario, sim: Simulation, pocketId: number) {
 const balls=sim.finalBalls.filter(b=>!b.pocketed), cue=balls.find(b=>b.id===0), object=balls.find(b=>b.id===scenario.objective!.nextBallId);
 if(!cue||!object||!sim.stopped) return null;
 const pocket=POCKET_GEOMETRY.find(p=>p.id===pocketId)!;
 const direction=normalize(subtract(pocket.center,object.position));
 const ghost={x:object.position.x-direction.x*TABLE.ballDiameter,y:object.position.y-direction.y*TABLE.ballDiameter};
 const others=balls.filter(b=>b.id!==0&&b.id!==object.id);
 const visible=clearsRails(cue.position,object.position)&&!others.some(b=>segmentDistance(b.position,cue.position,object.position)<TABLE.ballDiameter*1.025);
 // The moving cue center must stay outside a ball-diameter disc around the object.
 const clearance=segmentDistance(object.position,cue.position,ghost)-TABLE.ballDiameter;
 const path=subtract(ghost,cue.position), relative=subtract(cue.position,object.position),a=dot(path,path),b=2*dot(path,relative),c=dot(relative,relative)-TABLE.ballDiameter**2;
 const t=a>1e-12?(-b-Math.sqrt(Math.max(0,b*b-4*a*c)))/(2*a):1;
 const firstTouch={x:cue.position.x+path.x*Math.max(0,Math.min(1,t)),y:cue.position.y+path.y*Math.max(0,Math.min(1,t))};
 return {cue:cue.position,object:object.position,ghost,firstTouch,pocket,visible,clearance,
  prematureContact:clearance<-.002, distance:distance(cue.position,object.position),
  permitted:directNextShotRoutes(scenario,sim).some(r=>r.pocketId===pocketId)};
}
