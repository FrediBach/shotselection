import schemaDocument from '../levels/level.schema.json' with { type: 'json' };
import { TABLE } from './constants';
import { distance, seededRandom, segmentDistance } from './math';
import { reflectTableConditions } from './table-conditions';
import { isPocketed, RAILS } from './table-geometry';
import type { LevelLabSettings, Scenario, Vec2 } from './types';

/** Portable authoring data. Simulation results and inferred shot choices are never stored. */
export interface LevelDefinition {
  $schema?: string;
  schemaVersion: 1;
  id: string;
  kind: 'level' | 'draft';
  variation: { mirrorX: boolean; mirrorY: boolean };
  scenario: Omit<Scenario, 'authoring'>;
  lab?: LevelLabSettings;
}

type JsonSchema = {
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  type?: string;
  const?: unknown;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
};
const schema = schemaDocument as JsonSchema;
const fail = (path: string, message: string): never => { throw new Error(`${path}: ${message}`); };

/** The same schema powers editor hints and import validation, including unknown-field checks. */
function validateShape(value: unknown, shape: JsonSchema, path: string): void {
  if (shape.$ref) {
    const name = shape.$ref.replace('#/$defs/', '');
    validateShape(value, schema.$defs![name], path);
    return;
  }
  if (Object.hasOwn(shape, 'const') && value !== shape.const) fail(path, `must be ${JSON.stringify(shape.const)}.`);
  if (shape.enum && !shape.enum.includes(value)) fail(path, `must be one of ${shape.enum.join(', ')}.`);
  if (shape.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object.');
    const object = value as Record<string, unknown>;
    for (const key of shape.required ?? []) if (!Object.hasOwn(object, key)) fail(`${path}.${key}`, 'is required.');
    for (const [key, field] of Object.entries(object)) {
      const property = shape.properties && Object.hasOwn(shape.properties, key) ? shape.properties[key] : undefined;
      if (property) validateShape(field, property, `${path}.${key}`);
      else if (shape.additionalProperties === false) fail(`${path}.${key}`, 'is not a recognized setting.');
      else if (typeof shape.additionalProperties === 'object') validateShape(field, shape.additionalProperties, `${path}.${key}`);
    }
  } else if (shape.type === 'array') {
    if (!Array.isArray(value)) fail(path, 'must be an array.');
    const list = value as unknown[];
    if (shape.minItems !== undefined && list.length < shape.minItems) fail(path, `needs at least ${shape.minItems} item(s).`);
    if (shape.maxItems !== undefined && list.length > shape.maxItems) fail(path, `allows at most ${shape.maxItems} item(s).`);
    list.forEach((item, index) => validateShape(item, shape.items!, `${path}[${index}]`));
  } else if (shape.type === 'number' || shape.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number.');
    const number = value as number;
    if (shape.type === 'integer' && !Number.isInteger(number)) fail(path, 'must be an integer.');
    if (shape.minimum !== undefined && number < shape.minimum) fail(path, `must be at least ${shape.minimum}.`);
    if (shape.maximum !== undefined && number > shape.maximum) fail(path, `must be at most ${shape.maximum}.`);
    if (shape.exclusiveMinimum !== undefined && number <= shape.exclusiveMinimum) fail(path, `must be greater than ${shape.exclusiveMinimum}.`);
    if (shape.exclusiveMaximum !== undefined && number >= shape.exclusiveMaximum) fail(path, `must be less than ${shape.exclusiveMaximum}.`);
  } else if (shape.type === 'string') {
    if (typeof value !== 'string') fail(path, 'must be text.');
    const string = value as string;
    if (shape.minLength !== undefined && string.trim().length < shape.minLength) fail(path, 'must not be empty.');
    if (shape.pattern && !new RegExp(shape.pattern).test(string)) fail(path, 'has an invalid format.');
  } else if (shape.type === 'boolean' && typeof value !== 'boolean') fail(path, 'must be true or false.');
}

function validateReferences(document: LevelDefinition): void {
  const { scenario } = document;
  const ids = new Set<number>();
  for (const ball of scenario.balls) {
    if (ids.has(ball.id)) fail('level.scenario.balls', `ball ${ball.id} appears more than once.`);
    ids.add(ball.id);
  }
  if (!ids.has(0)) fail('level.scenario.balls', 'must include the cue ball (id 0).');
  const requireBall = (id: number, path: string) => {
    if (!ids.has(id)) fail(`level.scenario.${path}`, `references ball ${id}, which is not on the table.`);
  };
  for (const key of ['objective', 'finalBall', 'defense', 'bank', 'plant', 'trick'] as const) {
    const objective = scenario[key];
    if (objective) requireBall(objective.ballId, `${key}.ballId`);
  }
  if (scenario.objective) {
    if (scenario.scoring?.position === false) fail('level.scenario.scoring.position', 'position objectives require finish scoring. Remove the objective for a pot-only exercise.');
    const objective = scenario.objective;
    requireBall(objective.nextBallId, 'objective.nextBallId');
    if (objective.ballId === objective.nextBallId) fail('level.scenario.objective.nextBallId', 'must differ from the first ball.');
    if (objective.ellipse && objective.ellipse.longRadius <= objective.radius) fail('level.scenario.objective.ellipse.longRadius', 'must exceed the short radius.');
    if (objective.ellipse && objective.regions) fail('level.scenario.objective', 'cannot combine an ellipse and disjoint regions.');
    if (objective.regions && distance(...objective.regions) <= objective.radius * 2) fail('level.scenario.objective.regions', 'must be separate landing regions.');
    for (const region of objective.regions ?? []) {
      if (region.x < objective.radius || region.x > TABLE.length - objective.radius || region.y < objective.radius || region.y > TABLE.width - objective.radius) {
        fail('level.scenario.objective.regions', 'each region must fit inside the table.');
      }
    }
  }
  if (scenario.plant) {
    requireBall(scenario.plant.targetBallId, 'plant.targetBallId');
    if (scenario.plant.ballId === scenario.plant.targetBallId) fail('level.scenario.plant', 'needs two distinct object balls.');
    if (scenario.bank || scenario.objective) fail('level.scenario.plant', 'cannot combine a plant with a bank or position objective.');
    if (scenario.balls.length < 4) fail('level.scenario.plant', 'needs a free object ball in addition to the plant pair.');
  }
  if (scenario.bank && scenario.objective) fail('level.scenario.bank', 'cannot combine a bank with a position objective.');
  if (scenario.finalBall && scenario.scoring?.position === true) fail('level.scenario.scoring.position', 'a final-ball objective is pot-only and cannot enable finish scoring.');
  if (scenario.finalBall && (scenario.balls.length !== 2 || scenario.objective || scenario.bank || scenario.plant || scenario.trick || scenario.defense || scenario.plannedMovement)) {
    fail('level.scenario.finalBall', 'requires just the cue and final ball with no other objective.');
  }
  if (scenario.plannedMovement) {
    requireBall(scenario.plannedMovement.blockerId, 'plannedMovement.blockerId');
    if (!scenario.objective || [scenario.objective.ballId, scenario.objective.nextBallId].includes(scenario.plannedMovement.blockerId)) {
      fail('level.scenario.plannedMovement', 'requires a position objective and a separate blocker.');
    }
  }
  if (scenario.defense && (!scenario.objective || scenario.defense.ballId !== scenario.objective.ballId)) fail('level.scenario.defense', 'must use the position objective’s first ball.');
  if (scenario.trick) {
    if (scenario.objective || scenario.plant) fail('level.scenario.trick', 'cannot combine a trick with a plant or position objective.');
    const trick = scenario.trick;
    requireBall(trick.potBallId, 'trick.potBallId');
    trick.requiredPots.forEach(id => requireBall(id, 'trick.requiredPots'));
    trick.requiredContacts.forEach(([a, b]) => {
      requireBall(a, 'trick.requiredContacts'); requireBall(b, 'trick.requiredContacts');
      if (a === b) fail('level.scenario.trick.requiredContacts', 'a contact needs two different balls.');
    });
    if (!trick.requiredPots.includes(trick.potBallId)) fail('level.scenario.trick.requiredPots', 'must include the nominated pot ball.');
  }
  scenario.curriculum?.learning?.pockets?.forEach((route, index) => requireBall(route.ballId, `curriculum.learning.pockets[${index}].ballId`));
  if (scenario.curriculum && scenario.curriculum.lessonIndex >= scenario.curriculum.lessonCount) fail('level.scenario.curriculum.lessonIndex', 'must be below lessonCount.');
  const shotIds = new Set<string>();
  scenario.authoredShots?.forEach((shot, index) => {
    if (shotIds.has(shot.id)) fail('level.scenario.authoredShots', `duplicate stroke id ${shot.id}.`);
    shotIds.add(shot.id);
    requireBall(shot.settings.ballId, `authoredShots[${index}].settings.ballId`);
    if (shot.potBallId !== undefined) requireBall(shot.potBallId, `authoredShots[${index}].potBallId`);
  });
  for (const id of Object.keys(document.lab?.assistance ?? {})) {
    if (!shotIds.has(id)) fail(`level.lab.assistance.${id}`, 'does not match an authored stroke.');
  }
  const patchIds = new Set<string>();
  for (const patch of scenario.conditions?.patches ?? []) {
    if (patchIds.has(patch.id)) fail('level.scenario.conditions.patches', `duplicate patch id ${patch.id}.`);
    patchIds.add(patch.id);
  }
  const rails = scenario.conditions?.cushions?.map(cushion => cushion.rail) ?? [];
  if (new Set(rails).size !== rails.length) fail('level.scenario.conditions.cushions', 'each rail may appear only once.');
  // Drafts deliberately permit unfinished placements; playing still runs the normal layout checks.
  if (document.kind === 'level') {
    for (const ball of scenario.balls) {
      const { x, y } = ball.position;
      if (x < TABLE.ballRadius || x > TABLE.length - TABLE.ballRadius || y < TABLE.ballRadius || y > TABLE.width - TABLE.ballRadius
        || isPocketed(ball.position) || RAILS.some(rail => segmentDistance(ball.position, rail.a, rail.b) < TABLE.ballRadius - 1e-8)) {
        fail('level.scenario.balls', `ball ${ball.id} must fit clear of the cushions and pockets.`);
      }
    }
    for (let i = 0; i < scenario.balls.length; i++) for (let j = i + 1; j < scenario.balls.length; j++) {
      if (distance(scenario.balls[i].position, scenario.balls[j].position) < TABLE.ballDiameter - 1e-8) {
        fail('level.scenario.balls', `balls ${scenario.balls[i].id} and ${scenario.balls[j].id} overlap. Save an unfinished placement as a draft.`);
      }
    }
  }
}

/** Reject malformed input before it reaches a worker or replaces an editor’s current state. */
export function validateLevelDefinition(value: unknown): LevelDefinition {
  validateShape(value, schema, 'level');
  const document = value as LevelDefinition;
  validateReferences(document);
  return structuredClone(document);
}

export function parseLevelJson(text: string): LevelDefinition {
  if (text.length > 1_000_000) throw new Error('Level JSON must be smaller than 1 MB.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('The file is not valid JSON. Check commas, quotes and brackets.'); }
  return validateLevelDefinition(value);
}

function omitUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitUndefined);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([, field]) => field !== undefined).map(([key, field]) => [key, omitUndefined(field)]));
  return value;
}

export function serializeLevelJson(document: LevelDefinition): string {
  return `${JSON.stringify(validateLevelDefinition(omitUndefined(document)), null, 2)}\n`;
}

/** Snapshot generated layouts in their visible orientation; preserve explicitly imported variation settings. */
export function levelFromScenario(scenario: Scenario, overrides: { kind?: LevelDefinition['kind']; lab?: LevelLabSettings } = {}): LevelDefinition {
  const { authoring, ...data } = structuredClone(scenario);
  const lab = overrides.lab ?? authoring?.lab;
  return validateLevelDefinition(omitUndefined({
    schemaVersion: 1,
    id: authoring?.id ?? (scenario.curriculum ? `level-${String(scenario.level).padStart(3, '0')}` : 'lab-draft'),
    kind: overrides.kind ?? authoring?.kind ?? (scenario.curriculum ? 'level' : 'draft'),
    variation: authoring?.imported ? authoring.variation : { mirrorX: false, mirrorY: false },
    scenario: data,
    ...(lab ? { lab } : {}),
  }));
}

/** Imports stay exactly as saved; course generation explicitly opts into seeded reflections. */
export function scenarioFromLevel(document: LevelDefinition, options: { seed?: number; applyVariation?: boolean } = {}): Scenario {
  const definition = validateLevelDefinition(document);
  const scenario: Scenario = definition.scenario;
  const seed = options.seed ?? scenario.seed;
  if (!Number.isFinite(seed)) throw new Error('Choose a finite level seed.');
  scenario.seed = seed;
  const random = seededRandom(seed);
  const mirrorX = Boolean(options.applyVariation && definition.variation.mirrorX && random() > .5);
  const mirrorY = Boolean(options.applyVariation && definition.variation.mirrorY && random() > .5);
  const point = ({ x, y }: Vec2): Vec2 => ({ x: mirrorX ? TABLE.length - x : x, y: mirrorY ? TABLE.width - y : y });
  const pocket = (id: number) => {
    const x = mirrorX ? [2, 1, 0, 5, 4, 3][id] : id;
    return mirrorY ? [5, 4, 3, 2, 1, 0][x] : x;
  };
  const sign = mirrorX !== mirrorY ? -1 : 1;
  if (options.applyVariation) {
    scenario.balls = scenario.balls.map(ball => ({ ...ball, position: point(ball.position) }));
    if (scenario.conditions) scenario.conditions = reflectTableConditions(scenario.conditions, mirrorX, mirrorY);
    if (scenario.curriculum?.learning?.pockets) scenario.curriculum.learning.pockets = scenario.curriculum.learning.pockets.map(route => ({ ...route, pocketId: pocket(route.pocketId) }));
    if (scenario.objective) {
      const objective = scenario.objective;
      if (objective.target) objective.target = point(objective.target);
      if (objective.regions) objective.regions = objective.regions.map(point) as [Vec2, Vec2];
      if (objective.ellipse) objective.ellipse.angle = Math.atan2(Math.sin(objective.ellipse.angle) * (mirrorY ? -1 : 1), Math.cos(objective.ellipse.angle) * (mirrorX ? -1 : 1));
    }
    if (scenario.plant) scenario.plant.pocketId = pocket(scenario.plant.pocketId);
    if (scenario.trick) { scenario.trick.aim = point(scenario.trick.aim); scenario.trick.pocketId = pocket(scenario.trick.pocketId); }
    scenario.authoredShots?.forEach(shot => {
      shot.settings.pocketId = pocket(shot.settings.pocketId);
      shot.settings.aimOffset *= sign;
      shot.settings.sideSpin *= sign;
      if (shot.target) shot.target = point(shot.target);
    });
  }
  scenario.authoring = {
    id: definition.id, kind: definition.kind, variation: definition.variation,
    imported: !options.applyVariation,
    fixedObjective: Boolean(definition.scenario.objective?.target || definition.scenario.objective?.regions),
    ...(definition.lab ? { lab: definition.lab } : {}),
  };
  return scenario;
}
