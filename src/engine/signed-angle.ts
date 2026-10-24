import { directNextShotRoutes } from './objectives';
import { dot, normalize, subtract } from './math';
import { POCKET_GEOMETRY } from './table-geometry';
import type { Scenario, Simulation, Vec2 } from './types';

/** Sign is clockwise from the object-to-pocket line to the incoming cue
 * direction in the table's screen coordinates. Departure is ideal stun geometry. */
export function signedAngleEvidence(scenario: Scenario, sim: Simulation, pocketId: number) {
 const route=directNextShotRoutes(scenario,sim).find(r=>r.pocketId===pocketId);
 const object=sim.finalBalls.find(b=>b.id===scenario.objective!.nextBallId);
 if(!route||!object||object.pocketed) return null;
 const pocket=POCKET_GEOMETRY.find(p=>p.id===pocketId)!;
 const outgoing=normalize(subtract(pocket.center,object.position)),incoming=normalize(subtract(route.ghost,sim.cueEnd));
 const projection=dot(outgoing,incoming);
 const angle=Math.atan2(outgoing.x*incoming.y-outgoing.y*incoming.x,projection)*180/Math.PI;
 const departure=normalize({x:incoming.x-outgoing.x*projection,y:incoming.y-outgoing.y*projection});
 return {angle,departure,ghost:route.ghost,object:object.position,pocket,cutAngle:route.cutAngle};
}

export function pointsTowardPreview(e: { departure: Vec2; ghost: Vec2 }, target: Vec2) {
 return dot(e.departure,normalize(subtract(target,e.ghost)))>.95;
}
