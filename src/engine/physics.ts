import { Body, ContactMaterial, GSSolver, Material, Sphere, Vec3, World } from 'cannon-es';
import { POCKETS, TABLE } from './constants';
import { clamp, distance } from './math';
import type { Scenario, ShotPlan, Simulation, SimulateOptions, Vec2 } from './types';

const G = 9.80665;
const R = TABLE.ballRadius;
interface Rail { a: Vec2; b: Vec2 }

/** Finite cushion noses and angled pocket jaws, rather than an enclosed rectangle. */
function buildRails(): Rail[] {
  const length = TABLE.length;
  const width = TABLE.width;
  const corner = TABLE.cornerMouth / Math.SQRT2;
  const side = TABLE.sideMouth / 2;
  const rails: Rail[] = [];
  const add = (ax: number, ay: number, bx: number, by: number) => rails.push({ a: { x: ax, y: ay }, b: { x: bx, y: by } });
  for (const y of [0, width]) {
    const outside = y === 0 ? -1 : 1;
    add(corner, y, length / 2 - side, y);
    add(length / 2 + side, y, length - corner, y);
    add(corner, y, corner - 0.043, y + outside * 0.04);
    add(length - corner, y, length - corner + 0.043, y + outside * 0.04);
    add(length / 2 - side, y, length / 2 - side + 0.009, y + outside * 0.036);
    add(length / 2 + side, y, length / 2 + side - 0.009, y + outside * 0.036);
  }
  for (const x of [0, length]) {
    const outside = x === 0 ? -1 : 1;
    add(x, corner, x, width - corner);
    add(x, corner, x + outside * 0.04, corner - 0.043);
    add(x, width - corner, x + outside * 0.04, width - corner + 0.043);
  }
  return rails;
}
const RAILS = buildRails();

/** Slip-point velocity u = v + omega x (0,0,-R). The 7/2 factor gives the
 * exact slide-to-roll transition for a solid homogeneous sphere (I=2mR²/5). */
function applyCloth(body: Body, dt: number) {
  const velocity = body.velocity;
  const spin = body.angularVelocity;
  const slipX = velocity.x - R * spin.y;
  const slipY = velocity.y + R * spin.x;
  const slip = Math.hypot(slipX, slipY);
  let rollingTime = dt;
  if (slip > 1e-7) {
    const slidingTime = Math.min(dt, slip / (3.5 * TABLE.slidingFriction * G));
    const impulse = TABLE.slidingFriction * G * slidingTime;
    const dx = -impulse * slipX / slip;
    const dy = -impulse * slipY / slip;
    velocity.x += dx;
    velocity.y += dy;
    spin.x += 2.5 * dy / R;
    spin.y -= 2.5 * dx / R;
    rollingTime -= slidingTime;
  }
  if (rollingTime > 0) {
    const speed = Math.hypot(velocity.x, velocity.y);
    const remaining = Math.max(0, speed - TABLE.rollingFriction * G * rollingTime);
    const ratio = speed > 0 ? remaining / speed : 0;
    velocity.x *= ratio;
    velocity.y *= ratio;
    spin.x = -velocity.y / R;
    spin.y = velocity.x / R;
  }
  spin.z = Math.sign(spin.z) * Math.max(0, Math.abs(spin.z) - 10 * dt);
}

function resolveRails(body: Body) {
  for (const rail of RAILS) {
    const dx = rail.b.x - rail.a.x;
    const dy = rail.b.y - rail.a.y;
    const t = clamp(((body.position.x - rail.a.x) * dx + (body.position.y - rail.a.y) * dy) / (dx * dx + dy * dy), 0, 1);
    const px = rail.a.x + t * dx;
    const py = rail.a.y + t * dy;
    const nx0 = body.position.x - px;
    const ny0 = body.position.y - py;
    const gap = Math.hypot(nx0, ny0);
    if (gap >= R || gap < 1e-8) continue;
    const nx = nx0 / gap;
    const ny = ny0 / gap;
    const normalSpeed = body.velocity.x * nx + body.velocity.y * ny;
    if (normalSpeed >= 0) continue;
    body.position.x += nx * (R - gap + 1e-6);
    body.position.y += ny * (R - gap + 1e-6);
    const normalImpulse = -(1 + TABLE.cushionRestitution) * normalSpeed;
    body.velocity.x += normalImpulse * nx;
    body.velocity.y += normalImpulse * ny;
    // Coulomb-limited tangent impulse couples running/reverse english to rebound.
    const tx = -ny;
    const ty = nx;
    const tangentSlip = body.velocity.x * tx + body.velocity.y * ty - R * body.angularVelocity.z;
    const tangentImpulse = clamp(-tangentSlip / 3.5, -normalImpulse * 0.14, normalImpulse * 0.14);
    body.velocity.x += tangentImpulse * tx;
    body.velocity.y += tangentImpulse * ty;
    body.angularVelocity.z -= 2.5 * tangentImpulse / R;
  }
}

function isPocketed(position: Vec2): boolean {
  return POCKETS.some(pocket => {
    if (pocket.kind === 'corner') return distance(position, pocket.position) < 0.049;
    const atMouth = pocket.position.y === 0 ? position.y < 0.008 : position.y > TABLE.width - 0.008;
    return atMouth && Math.abs(position.x - pocket.position.x) < 0.045;
  });
}

export function simulateShot(scenario: Scenario, plan: ShotPlan, options: SimulateOptions = {}): Simulation {
  const record = options.record !== false;
  const recordPaths = record || options.recordPaths === true;
  const world = new World({ gravity: undefined, allowSleep: false });
  world.gravity.set(0, 0, 0);
  world.frictionGravity = new Vec3(0, 0, -G);
  (world.solver as GSSolver).iterations = 12;
  (world.solver as GSSolver).tolerance = 1e-8;
  const ballMaterial = new Material('phenolic');
  world.addContactMaterial(new ContactMaterial(ballMaterial, ballMaterial, {
    friction: 0.035,
    restitution: TABLE.ballRestitution,
    contactEquationStiffness: 1e9,
    contactEquationRelaxation: 3,
    frictionEquationStiffness: 1e8,
  }));
  const bodyIds = new Map<number, number>();
  const bodies = scenario.balls.map(ball => {
    const body = new Body({ mass: TABLE.ballMass, shape: new Sphere(R), material: ballMaterial, linearDamping: 0, angularDamping: 0, allowSleep: false });
    body.position.set(ball.position.x, ball.position.y, 0);
    body.linearFactor.set(1, 1, 0);
    bodyIds.set(body.id, ball.id);
    world.addBody(body);
    return { id: ball.id, body, pocketed: false };
  });
  const cue = bodies.find(ball => ball.id === 0);
  if (!cue) throw new Error('A scenario needs a cue ball (id 0).');
  const speed = clamp(plan.speed, 0.05, 4);
  cue.body.velocity.set(Math.cos(plan.angle) * speed, Math.sin(plan.angle) * speed, 0);
  cue.body.angularVelocity.set(-Math.sin(plan.angle) * speed / R * plan.topSpin, Math.cos(plan.angle) * speed / R * plan.topSpin, plan.sideSpin);
  let firstContact: number | null = null;
  cue.body.addEventListener('collide', (event: { body: Body }) => {
    if (firstContact === null) firstContact = bodyIds.get(event.body.id) ?? null;
  });
  const simulation: Simulation = { frames: [], cuePath: [], objectPath: [], cueEnd: { ...cue.body.position }, potted: [], scratch: false, firstContact: null, duration: 0, stopped: false };
  const object = bodies.find(ball => ball.id === plan.ballId);
  const appendPathPoint = (path: Vec2[], body: Body) => {
    const previous = path.at(-1);
    // Suppress stationary repetitions, including after a ball has dropped.
    if (!previous || previous.x !== body.position.x || previous.y !== body.position.y) path.push({ x: body.position.x, y: body.position.y });
  };
  const saveSnapshot = (time: number) => {
    if (record && simulation.frames.at(-1)?.time !== time) simulation.frames.push({ time, balls: bodies.map(({ id, body, pocketed }) => ({ id, position: { x: body.position.x, y: body.position.y }, pocketed })) });
    if (recordPaths) {
      if (!cue.pocketed) appendPathPoint(simulation.cuePath, cue.body);
      if (object && !object.pocketed) appendPathPoint(simulation.objectPath, object.body);
    }
  };
  saveSnapshot(0);
  const maxSteps = Math.ceil((options.maxTime ?? 15) / TABLE.step);
  let quietSteps = 0;
  for (let step = 1; step <= maxSteps; step++) {
    for (const ball of bodies) if (!ball.pocketed) applyCloth(ball.body, TABLE.step);
    world.step(TABLE.step);
    let moving = false;
    for (const ball of bodies) {
      if (ball.pocketed) continue;
      ball.body.position.z = 0;
      ball.body.velocity.z = 0;
      resolveRails(ball.body);
      if (isPocketed(ball.body.position)) {
        ball.pocketed = true;
        simulation.potted.push(ball.id);
        world.removeBody(ball.body);
        ball.body.velocity.setZero();
        ball.body.angularVelocity.setZero();
      } else if (ball.body.position.x < -0.12 || ball.body.position.x > TABLE.length + 0.12 || ball.body.position.y < -0.12 || ball.body.position.y > TABLE.width + 0.12) {
        // A ball travelling completely beyond an open pocket throat has dropped.
        ball.pocketed = true;
        simulation.potted.push(ball.id);
        world.removeBody(ball.body);
      } else if (Math.hypot(ball.body.velocity.x, ball.body.velocity.y) > 0.005 || Math.hypot(ball.body.angularVelocity.x, ball.body.angularVelocity.y) * R > 0.008) moving = true;
      if (ball.pocketed && recordPaths) {
        // Save the exact physics capture location on the actual drop step. The
        // next 30 Hz snapshot may be later; never extend paths to pocket centers.
        if (ball.id === 0) appendPathPoint(simulation.cuePath, ball.body);
        if (ball.id === plan.ballId) appendPathPoint(simulation.objectPath, ball.body);
      }
    }
    simulation.duration = step * TABLE.step;
    if ((record || recordPaths) && step % 8 === 0) saveSnapshot(simulation.duration);
    quietSteps = moving ? 0 : quietSteps + 1;
    if (quietSteps >= 8) { simulation.stopped = true; break; }
  }
  saveSnapshot(simulation.duration);
  simulation.cueEnd = { x: cue.body.position.x, y: cue.body.position.y };
  simulation.scratch = cue.pocketed;
  simulation.firstContact = firstContact;
  return simulation;
}
