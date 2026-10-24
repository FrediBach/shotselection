import { compareConditionRobustness } from './condition-robustness';
import { compareEquipmentRepairs } from './equipment-repair';
import { comparePlayerProfiles } from './player-profile';
import { plannedMovementOutcome } from './objectives';
import { defensiveOutcome } from './defensive-outcome';
import { inPositionGap } from './disconnected-position';
import { analyzeContinuation } from './conditional-continuation';
import { assignmentFailureMask } from './assignment-failure';
import { shiftedPlantSetup } from './plant-setup';
import { plantTrialStage } from './plant-failure';
import type { PlantTrialStage } from './plant-failure';
import { analyzeSequences, sequenceLayout } from './sequence-reliability';
import { perturbShot } from './stroke-errors';
import { TABLE } from './constants';
import { DEFAULT_CHARACTER } from './characters';
import { clamp, distance, seededRandom } from './math';
import { simulateShot } from './physics';
import { scoreSelection } from './scoring';
import { evaluateShotObjective, positionToleranceForScenario } from './objectives';
export { pointsFor } from './scoring';
import type { AnalyzeOptions, CharacterTalents, ObjectBallTrial, PreparedRound, RoundAnalysis, Scenario, Selection, ShotAnalysis, ShotPlan, SimulationBall, Vec2 } from './types';

export function analyzeShot(scenario: Scenario, plan: ShotPlan, samples = 48, talents: CharacterTalents = DEFAULT_CHARACTER.talents): ShotAnalysis {
  const count = clamp(Math.floor(samples), 8, 128);
  const tolerance = positionToleranceForScenario(scenario);
  const random = seededRandom(scenario.seed ^ 0x3A7B91);
  const nominal = simulateShot(scenario, plan, { recordContacts: scenario.curriculum?.learning?.comparison === 'dirty-contact' || scenario.curriculum?.learning?.comparison === 'patch-route' || scenario.curriculum?.learning?.comparison === 'slow-drift' || scenario.curriculum?.learning?.comparison === 'carom-plant' || scenario.curriculum?.learning?.comparison === 'contact-chain' || scenario.curriculum?.learning?.comparison === 'split-paths' || scenario.curriculum?.learning?.comparison === 'kiss-path' || scenario.curriculum?.learning?.comparison === 'carom-contact' || scenario.curriculum?.learning?.comparison === 'follow-contact' || scenario.curriculum?.learning?.comparison === 'draw-return' || scenario.curriculum?.learning?.comparison === 'object-bank' || scenario.curriculum?.learning?.comparison === 'two-object-bank', recordObjectRebounds: scenario.curriculum?.learning?.comparison === 'object-bank' || scenario.curriculum?.learning?.comparison === 'two-object-bank' });
  const endpoints: Vec2[] = [];
  const samplePaths: Vec2[][] = [];
  const sampleObjectPaths: ObjectBallTrial[] = [];
  const sampleBallEnds: SimulationBall[][] = [];
  const trialSuccesses: boolean[] = [];
  const trialLegalPots = scenario.curriculum?.learning?.comparison === 'conditional-continuation' ? [] as boolean[] : undefined;
  const disconnectedTrials: ShotAnalysis['disconnectedTrials'] = scenario.curriculum?.learning?.comparison === 'disconnected-position' ? [] : undefined;
  const movementTrials: ShotAnalysis['movementTrials'] = scenario.plannedMovement ? [] : undefined;
  const defenseTrials: ShotAnalysis['defenseTrials'] = scenario.defense ? [] : undefined;
  const defenseExamples: ShotAnalysis['defenseExamples'] = scenario.defense ? {} : undefined;
  const assignmentFailures = scenario.curriculum?.learning?.comparison === 'assignment-failure' ? [] as number[] : undefined;
  const trialTargetCredits = scenario.curriculum?.learning?.comparison === 'plant-quality' ? [] as number[] : undefined;
  const spareContactTrials = scenario.curriculum?.learning?.comparison === 'collision-assistance' ? [] as boolean[] : undefined;
  const plantTrialStages = scenario.curriculum?.learning?.comparison === 'plant-failure' && scenario.plant
    && plan.ballId === scenario.plant.ballId && plan.potBallId === scenario.plant.targetBallId ? [] as PlantTrialStage[] : undefined;
  let pots = 0;
  let scratches = 0;
  let positions = 0;
  let successes = 0;
  let legalPots = 0;
  let nextShots = 0;
  let quality = 0;
  // Same random perturbations for every candidate: common random numbers reduce
  // comparison noise. These are stroke errors, not invented success percentages.
  for (let index = 0; index < count; index++) {
    const perturbed = perturbShot(plan, random, talents);
    const simulation = simulateShot(scenario, perturbed, { record: false, recordPaths: true });
    sampleBallEnds.push(simulation.finalBalls);
    movementTrials?.push(plannedMovementOutcome(scenario, simulation));
    spareContactTrials?.push(Boolean(simulation.ballContacts?.some(([a, b]) => (a === 0 && b === 3) || (a === 3 && b === 0))));
    const dropped = scenario.trick
      ? scenario.trick.requiredPots.every(ballId => simulation.potted.includes(ballId))
      : simulation.potted.includes(plan.potBallId ?? plan.ballId);
    const potted = dropped && simulation.firstContact === plan.ballId;
    sampleObjectPaths.push({ path: simulation.objectPath, outcome: potted ? 'pot' : dropped ? 'foul' : 'miss' });
    const { legalPot: legal, error, zoneRatio, positioned, nextShotAvailable, success } = evaluateShotObjective(scenario, plan, simulation);
    if (disconnectedTrials) disconnectedTrials.push({ point: simulation.cueEnd, region: scenario.objective!.regions!.findIndex(center => distance(simulation.cueEnd, center) <= tolerance), gap: inPositionGap(scenario.objective!, simulation.cueEnd), settled: simulation.stopped, scratch: simulation.scratch, nextShotAvailable, legalPot: legal, success });
    if (defenseTrials && defenseExamples) {
      const evidence = defensiveOutcome(scenario, simulation);
      defenseTrials.push(evidence.trial);
      const kind = evidence.trial.kind;
      if ((kind === 'open' || kind === 'screened') && evidence.reply && !defenseExamples[kind]) {
        const reply = evidence.reply;
        const actual = { ...reply.scenario, balls: simulation.finalBalls.filter(b => !b.pocketed).map(b => ({ id: b.id, position: b.position })) };
        defenseExamples[kind] = { index, openingPlan: perturbed, opening: simulation, blockerId: evidence.trial.blockerId,
          reply: { ...reply, simulation: simulateShot(reply.scenario, reply.plan, { record: false, recordPaths: true }) },
          ...(evidence.blockedReply ? { blockedReply: simulateShot(actual, reply.plan, { record: false, recordPaths: true }) } : {}) };
      }
    }
    assignmentFailures?.push(assignmentFailureMask(legal, positioned, nextShotAvailable));
    if (plantTrialStages) plantTrialStages.push(plantTrialStage(scenario, plan, simulation, success)!);
    if (potted) pots++;
    if (simulation.scratch) scratches++;
    if (positioned) positions++;
    if (legal) legalPots++;
    trialLegalPots?.push(legal);
    trialSuccesses.push(success);
    if (success) successes++;
    if (nextShotAvailable) nextShots++;
    const credit = scenario.finalBall ? Number(legal) : legal && nextShotAvailable ? (scenario.objective?.ellipse ? Math.exp(-(zoneRatio ** 2) / 2) : Math.exp(-(error * error) / (2 * tolerance ** 2))) : 0;
    quality += credit;
    trialTargetCredits?.push(credit);
    if (!simulation.scratch && simulation.stopped) endpoints.push(simulation.cueEnd);
    if (index < 24) samplePaths.push(simulation.cuePath);
  }
  const meanEnd = endpoints.length ? { x: endpoints.reduce((sum, p) => sum + p.x, 0) / endpoints.length, y: endpoints.reduce((sum, p) => sum + p.y, 0) / endpoints.length } : nominal.cueEnd;
  const spread = endpoints.length ? Math.sqrt(endpoints.reduce((sum, p) => sum + distance(p, meanEnd) ** 2, 0) / endpoints.length) : Math.hypot(TABLE.length, TABLE.width);
  const successRate = successes / count;
  // Pot AND position dominates. A missed pot or scratch never earns utility.
  const score = scenario.finalBall ? successRate : (0.72 * successes + 0.2 * quality + 0.08 * legalPots) / count;
  const isPlant = !scenario.trick && plan.potBallId !== undefined && plan.potBallId !== plan.ballId;
  const explanation = scenario.finalBall ? 'Only the final pot matters: correct first contact, no scratch and all balls stopped. Cue-ball position earns no extra credit.' : scenario.trick
    ? successRate >= 0.8
      ? 'The complete trick repeats reliably: the required balls drop, the contact and cushion sequence holds, and the cue ball finishes under control.'
      : pots / count < 0.55
        ? 'Small stroke errors often leave a required ball on the table. Compare the complete sequence and the pace reaching each contact.'
        : legalPots / count < pots / count
          ? 'Potting the required balls is only part of this trick. The contact and cushion sequence must also match the briefing, with no scratch.'
          : 'The trick can work, but speed and spin need care to hold the cue-ball finish. Compare complete success across the trials.'
    : isPlant
    ? sampleObjectPaths.every(trial => trial.outcome === 'miss') && !nominal.potted.includes(plan.potBallId!)
      ? `The attempted plant does not pot ball ${plan.potBallId} in the nominal stroke or any sampled trial. Compare its line with the free ball.`
      : successRate >= 0.8
        ? `The plant sends ball ${plan.potBallId} into the pocket with a repeatable cue-ball finish. Small stroke errors remain manageable.`
        : pots / count < 0.55
          ? `The plant has little margin: errors at the first contact change how ball ${plan.ballId} reaches ball ${plan.potBallId}. A difficult free ball can still be the better choice.`
          : scratches / count > 0.12
            ? 'The plant can pot, but the cue ball runs close to a pocket. Scratch risk weakens this choice.'
            : 'The plant can pot, but speed and spin need care to hold the chosen cue-ball finish. Compare that control with the free ball.'
    : scenario.objective
    ? successRate >= 0.8
      ? `A reliable pot and a controlled finish in the landing zone leave ball ${scenario.objective.nextBallId} available.`
      : nextShots / count < 0.55
        ? `Potting alone is not enough: this finish often leaves ball ${scenario.objective.nextBallId} blocked or too thin. Look for a clearer next-ball angle.`
        : `Ball ${scenario.objective.nextBallId} can be played from this side, but pace and spin must hold the shared landing zone after a legal pot.`
    : scenario.conditions
    ? successRate >= 0.8
      ? 'This route handles the table defects with a repeatable pot and cue-ball finish. The same faults are active in every trial.'
      : pots / count < 0.55
        ? 'On this damaged table, small stroke changes often spoil the pot. Compare the contact angle, time spent rolling and any damaged areas the route crosses.'
        : scratches / count > 0.12
          ? 'The defects change the route, but the cue ball still reaches a pocket too often. Compare the safer finish on another stroke or ball.'
          : 'The pot can work on this table, but the finish is sensitive to small speed and spin changes. Read the condition report alongside the spread of endpoints.'
    : successRate >= 0.8
    ? 'A generous pot and a repeatable cue-ball finish. Small stroke errors stay manageable.'
    : pots / count < 0.55
      ? 'The pot has a narrow margin. Small changes in aim often miss the pocket.'
      : scratches / count > 0.12
        ? 'The cue ball runs close to a pocket. Scratch risk makes this route less dependable.'
        : 'The pot is available, but speed and spin need care to hold the chosen cue-ball position.';
  return { plan, successRate, ...(movementTrials ? { movementTrials } : {}), potRate: pots / count, legalPotRate: legalPots / count, targetQuality: quality / count, scratchRate: scratches / count, positionRate: positions / count, ...(scenario.objective ? { nextShotRate: nextShots / count } : {}), spread, meanEnd, samplePaths, sampleObjectPaths, sampleEnds: endpoints, sampleBallEnds, trialSuccesses, ...(trialLegalPots ? { trialLegalPots } : {}), ...(assignmentFailures ? { assignmentFailures } : {}), ...(defenseTrials ? { defenseTrials, defenseExamples } : {}), ...(disconnectedTrials ? { disconnectedTrials } : {}), ...(trialTargetCredits ? { trialTargetCredits } : {}), ...(spareContactTrials ? { spareContactTrials } : {}), ...(plantTrialStages ? { plantTrialStages } : {}), score, nominal, samples: count, explanation };
}

export function analyzeRound(prepared: PreparedRound, selection: Selection, options: AnalyzeOptions = {}): RoundAnalysis {
  const offered = prepared.balls.flatMap(ball => ball.options);
  const chosen = offered.find(option => option.id === selection.optionId && option.plan.ballId === selection.ballId);
  if (!chosen) throw new Error('This finish is not available in the current round. Choose one of the offered options.');
  const { scenario } = prepared;
  // Each fixed plan is evaluated once for the playable layout. No target optimization or unseen
  // alternatives are introduced after the player has made their decision.
  const candidates = offered.map(option => analyzeShot(scenario, option.plan, options.samples ?? 48, options.talents));
  const selected = candidates.find(candidate => candidate.plan.id === chosen.id)!;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const scoring = scoreSelection(selected, candidates);
  const sequenceComparison = prepared.sequenceComparison ? {
    ...analyzeSequences(sequenceLayout(scenario, candidates.find(c => c.plan.id === prepared.sequenceComparison!.referenceId)!.nominal), prepared.sequenceComparison.orders, scenario.objective!.maxCutAngle, 128, options.talents),
    referenceId: prepared.sequenceComparison.referenceId,
  } : undefined;
  // A separate, fixed-layout diagnostic reuses the same plans and indexed errors; it never enters scoring.
  const plantSetup = scenario.curriculum?.learning?.comparison === 'plant-setup'
    ? offered.map(option => {
      const shot = analyzeShot(shiftedPlantSetup(scenario), option.plan, options.samples ?? 48, options.talents);
      return { plan: shot.plan, score: shot.score, successRate: shot.successRate, samples: shot.samples };
    }) : undefined;
  const continuation = prepared.continuation ? analyzeContinuation(scenario, prepared.continuation,
    candidates.find(c => c.plan.id === prepared.continuation!.referenceId)!, options.talents) : null;
  const playerProfiles = scenario.curriculum?.learning?.comparison === 'player-profile' ? comparePlayerProfiles(scenario, offered.map(o => o.plan)) : undefined;
  const equipmentRepairs = scenario.curriculum?.learning?.comparison === 'equipment-repair' ? compareEquipmentRepairs(scenario, candidates, selected.samples, options.talents, analyzeShot) : undefined;
  const conditionRobustness = scenario.curriculum?.learning?.comparison === 'condition-robustness' ? compareConditionRobustness(scenario, candidates, selected.samples, options.talents, analyzeShot) : undefined;
  return { ...(conditionRobustness ? { conditionRobustness } : {}), ...(equipmentRepairs ? { equipmentRepairs } : {}), ...(playerProfiles ? { playerProfiles } : {}), ...(continuation ? { continuation } : {}), ...(plantSetup ? { plantSetup } : {}), ...(sequenceComparison ? { sequenceComparison } : {}), candidates, selected, best, points: scoring.points, scoring, samples: selected.samples, positionTolerance: positionToleranceForScenario(scenario) };
}
