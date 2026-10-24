import { TABLE } from './constants';
import { directNextShotRoutes, directShotRoutes, evaluateShotObjective } from './objectives';
import { distance, normalize, subtract } from './math';
import { simulateShot } from './physics';
import { POCKET_GEOMETRY } from './table-geometry';
import type { PreparedRound, Vec2 } from './types';

export interface BackwardPlan {
  pocketId: number;
  object: Vec2;
  ghost: Vec2;
  opposite: Vec2;
  /** Discrete geometric checks within the scored zone, not a guaranteed region. */
  samples: { position: Vec2; compatible: boolean }[];
}

/** Work backward from an actual offered, successful opener. The preview assumes
 * the opener is removed and other balls stay put; results use actual settled balls. */
export function buildBackwardPlan(prepared: PreparedRound): BackwardPlan | null {
  const { scenario } = prepared, objective = scenario.objective;
  if (!objective?.target) return null;
  const object = scenario.balls.find(ball=>ball.id===objective.nextBallId)!;
  const options=prepared.balls.flatMap(ball=>ball.options);
  for(const option of options) {
    const sim=simulateShot(scenario,option.plan,{record:false});
    if(!evaluateShotObjective(scenario,option.plan,sim).success) continue;
    if(sim.finalBalls.some(ball=>ball.id!==0&&ball.id!==objective.ballId&&(ball.pocketed||distance(ball.position,scenario.balls.find(b=>b.id===ball.id)!.position)>.001))) continue;
    for(const route of directNextShotRoutes(scenario,sim)) {
      const pocket=POCKET_GEOMETRY.find(p=>p.id===route.pocketId)!;
      const direction=normalize(subtract(pocket.center,object.position));
      const samples: BackwardPlan['samples']=[];
      for(let row=-5;row<=5;row++) for(let col=-5;col<=5;col++) {
        if(row*row+col*col>25) continue;
        const position={x:objective.target.x+col*objective.radius/5,y:objective.target.y+row*objective.radius/5};
        if(position.x<TABLE.ballRadius||position.x>TABLE.length-TABLE.ballRadius||position.y<TABLE.ballRadius||position.y>TABLE.width-TABLE.ballRadius) continue;
        const balls=scenario.balls.filter(b=>b.id!==objective.ballId).map(b=>b.id===0?{...b,position}:b);
        samples.push({position,compatible:directShotRoutes(balls,objective.nextBallId,objective.maxCutAngle).some(r=>r.pocketId===route.pocketId)});
      }
      if(!samples.some(s=>s.compatible && distance(s.position,objective.target!)<1e-9)) continue;
      return {pocketId:route.pocketId,object:{...object.position},ghost:route.ghost,
        opposite:{x:object.position.x+direction.x*TABLE.ballDiameter,y:object.position.y+direction.y*TABLE.ballDiameter},samples};
    }
  }
  return null;
}
