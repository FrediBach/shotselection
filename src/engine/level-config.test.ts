import { describe, expect, it } from 'vitest';
import { TABLE } from './constants';
import { COURSE_LEVELS, generateScenario } from './scenarios';
import { levelFromScenario, parseLevelJson, scenarioFromLevel, serializeLevelJson, validateLevelDefinition } from './level-config';
import type { LevelDefinition } from './level-config';

const draft = (): LevelDefinition => ({
  schemaVersion: 1, id: 'custom-draft', kind: 'draft', variation: { mirrorX: false, mirrorY: false },
  scenario: { level: 1, seed: 42, title: 'Custom table', description: '', balls: [
    { id: 0, position: { x: .7, y: .9 } }, { id: 1, position: { x: 1.2, y: .3 } },
  ], authoredShots: [{ id: 'authored-one', label: 'Gentle draw', settings: { ballId: 1, pocketId: 1, speed: 1.3, topSpin: -.7, sideSpin: 12, aimOffset: 2 }, target: { x: .8, y: .6 }, potBallId: 1 }] },
  lab: { samples: 64, talents: { anglePrecision: 80, englishPrecision: 60, strengthPrecision: 70, spinPrecision: 75 }, assistance: { 'authored-one': { enabled: true, locks: { speed: true, topSpin: false } } } },
});

describe('portable level definitions', () => {
  it('provides a validated, independently tunable definition for every course level', () => {
    expect(COURSE_LEVELS).toHaveLength(100);
    for (const document of COURSE_LEVELS) {
      expect(document.scenario.scoring).toBeDefined();
      expect(document.scenario.shotGeneration).toBeDefined();
      expect(document.scenario.lessonTuning).toBeDefined();
    }
  });

  it('exports a reflected course table in its exact visible orientation', () => {
    const source = generateScenario(100, 1);
    const saved = levelFromScenario(source);
    expect(saved.variation).toEqual({ mirrorX: false, mirrorY: false });
    const reopened = scenarioFromLevel(parseLevelJson(serializeLevelJson(saved)), { seed: 999 });
    expect({ ...reopened, seed: source.seed, authoring: undefined }).toEqual({ ...source, authoring: undefined });
    expect(reopened.authoring).toMatchObject({ id: 'level-100', imported: true });
    expect(scenarioFromLevel(saved, { applyVariation: true }).balls).toEqual(source.balls);
  });

  it('preserves deliberately imported variation settings while reopening the exact saved orientation', () => {
    const document = draft();
    document.variation = { mirrorX: true, mirrorY: true };
    const imported = scenarioFromLevel(parseLevelJson(serializeLevelJson(document)));
    const exported = levelFromScenario(imported);
    expect(exported.variation).toEqual(document.variation);
    expect(exported.scenario.balls).toEqual(document.scenario.balls);
    expect(scenarioFromLevel(exported).balls).toEqual(document.scenario.balls);
  });

  it('round-trips explicit strokes, finish targets, lab precision and control locks', () => {
    const document = draft();
    expect(parseLevelJson(serializeLevelJson(document))).toEqual(document);
    const scenario = scenarioFromLevel(document);
    expect(levelFromScenario(scenario)).toEqual(document);
    scenario.balls[0].position.x = 1;
    scenario.authoredShots![0].settings.speed = 2;
    expect(document.scenario.balls[0].position.x).toBe(.7);
    expect(document.scenario.authoredShots![0].settings.speed).toBe(1.3);
  });

  it('reflects authored aims, English and targets together with the table', () => {
    const document = draft();
    document.variation = { mirrorX: true, mirrorY: false };
    // Mulberry32 seed 1 begins above .5, so this is a single horizontal reflection.
    const scenario = scenarioFromLevel(document, { seed: 1, applyVariation: true });
    expect(scenario.balls[0].position).toEqual({ x: TABLE.length - .7, y: .9 });
    expect(scenario.authoredShots![0].settings).toMatchObject({ sideSpin: -12, aimOffset: -2, speed: 1.3, topSpin: -.7 });
    expect(scenario.authoredShots![0].target).toEqual({ x: TABLE.length - .8, y: .6 });
    expect(document.scenario.authoredShots![0].settings.sideSpin).toBe(12);
  });

  it('preserves fixed landing regions and ellipses through save/load', () => {
    const scenario = generateScenario(21, 0);
    scenario.objective!.target = { x: .8, y: .8 };
    scenario.objective!.regions = [{ x: .4, y: .4 }, { x: 1.8, y: .9 }];
    const reopened = scenarioFromLevel(parseLevelJson(serializeLevelJson(levelFromScenario(scenario))));
    expect(reopened.objective).toEqual(scenario.objective);
    const ellipse = generateScenario(50, 1);
    expect(scenarioFromLevel(levelFromScenario(ellipse)).objective).toEqual(ellipse.objective);
  });

  it('omits unset optional fields during export without hiding invalid numbers', () => {
    const scenario = generateScenario(21, 0);
    scenario.objective!.target = undefined;
    scenario.objective!.regions = undefined;
    scenario.conditions = undefined;
    expect(() => serializeLevelJson(levelFromScenario(scenario))).not.toThrow();
    const custom = scenarioFromLevel(draft());
    custom.authoredShots![0].target = undefined;
    custom.authoredShots![0].potBallId = undefined;
    expect(parseLevelJson(serializeLevelJson(levelFromScenario(custom))).scenario.authoredShots![0]).not.toHaveProperty('target');
    custom.authoredShots![0].settings.speed = Number.NaN;
    expect(() => levelFromScenario(custom)).toThrow(/finite/);
  });

  it('distinguishes a deliberately saved landing target from a generated one', () => {
    const scenario = generateScenario(21, 0);
    expect(scenario.authoring?.fixedObjective).toBe(false);
    scenario.objective!.target = { x: .8, y: .8 };
    expect(scenarioFromLevel(levelFromScenario(scenario)).authoring?.fixedObjective).toBe(true);
  });

  it('permits unfinished draft placements while rejecting overlapping published levels', () => {
    const document = draft();
    document.scenario.balls[1].position = { ...document.scenario.balls[0].position };
    expect(parseLevelJson(serializeLevelJson(document))).toEqual(document);
    expect(() => validateLevelDefinition({ ...document, kind: 'level' })).toThrow(/overlap/);
  });

  it.each([
    ['unsupported schema version', (document: LevelDefinition) => ({ ...document, schemaVersion: 2 }), /schemaVersion/],
    ['unknown setting', (document: LevelDefinition) => ({ ...document, scenario: { ...document.scenario, typo: 1 } }), /typo/],
    ['nonfinite value', (document: LevelDefinition) => ({ ...document, scenario: { ...document.scenario, seed: Infinity } }), /finite/],
    ['missing cue', (document: LevelDefinition) => ({ ...document, scenario: { ...document.scenario, balls: document.scenario.balls.map(ball => ({ ...ball, id: ball.id + 1 })) } }), /cue ball/],
    ['duplicate ball ID', (document: LevelDefinition) => ({ ...document, scenario: { ...document.scenario, balls: [document.scenario.balls[0], document.scenario.balls[0]] } }), /more than once/],
    ['missing stroke ball', (document: LevelDefinition) => { document.scenario.authoredShots![0].settings.ballId = 4; return document; }, /not on the table/],
    ['out-of-range stroke', (document: LevelDefinition) => { document.scenario.authoredShots![0].settings.speed = 10; return document; }, /speed/],
    ['duplicate stroke ID', (document: LevelDefinition) => { document.scenario.authoredShots!.push(document.scenario.authoredShots![0]); return document; }, /duplicate stroke/],
    ['unknown assistance stroke', (document: LevelDefinition) => { document.lab!.assistance!.missing = { enabled: true, locks: {} }; return document; }, /does not match/],
    ['missing objective ball', (document: LevelDefinition) => { document.scenario.objective = { kind: 'position', ballId: 1, nextBallId: 2, radius: .2, maxCutAngle: 50 }; return document; }, /not on the table/],
    ['malformed table conditions', (document: LevelDefinition) => { document.scenario.conditions = { id: 'slow', name: 'Slow', description: 'Heavy cloth', cloth: -1 }; return document; }, /cloth/],
    ['unrecognized tuning', (document: LevelDefinition) => { document.scenario.lessonTuning = { typo: 1 }; return document; }, /typo/],
    ['incomplete offset pair', (document: LevelDefinition) => { document.scenario.lessonTuning = { plantQualityPlantOffset: [.1] }; return document; }, /at least 2/],
    ['incomplete recovery comparison', (document: LevelDefinition) => { document.scenario.lessonTuning = { landingRecoveryPaceMultipliers: [1] }; return document; }, /at least 2/],
    ['negative generation speed', (document: LevelDefinition) => { document.scenario.lessonTuning = { bankSpeeds: [-1] }; return document; }, /bankSpeeds/],
    ['excessive generation spin', (document: LevelDefinition) => { document.scenario.lessonTuning = { expandedTopSpins: [3] }; return document; }, /expandedTopSpins/],
    ['invalid target fraction', (document: LevelDefinition) => { document.scenario.lessonTuning = { playerProfileTargetFraction: 2 }; return document; }, /playerProfileTargetFraction/],
  ])('rejects %s before replacing the editor', (_name, modify, message) => {
    expect(() => validateLevelDefinition(modify(draft()))).toThrow(message);
  });

  it('rejects disabling finish scoring for a position objective', () => {
    const document = levelFromScenario(generateScenario(21, 0));
    document.scenario.scoring!.position = false;
    expect(() => validateLevelDefinition(document)).toThrow(/position objectives require finish scoring/);
  });

  it('rejects enabling finish scoring for a final-ball objective', () => {
    const document = levelFromScenario(generateScenario(79, 0));
    document.scenario.scoring!.position = true;
    expect(() => validateLevelDefinition(document)).toThrow(/final-ball objective is pot-only/);
  });

  it('reports malformed JSON and oversized inputs clearly', () => {
    expect(() => parseLevelJson('{ nope')).toThrow('not valid JSON');
    expect(() => parseLevelJson(' '.repeat(1_000_001))).toThrow('1 MB');
  });
});
