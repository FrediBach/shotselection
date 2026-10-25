import { distance } from './math';
import { tuningList, tuningNumber } from './lesson-tuning';
import { evaluateShotObjective } from './objectives';
import { simulateShot } from './physics';
import { directReplyPotted } from './defensive-outcome';
import { secondShotPlan, secondShotSetup } from './second-shot';
import type { FinishOption, Scenario } from './types';

/** Fixed pace offsets produce real settled leaves. Bounded nominal proofs, not
 * an ensemble ranking or a claim that the displayed response is the only pot. */
export function landingRecoveryPreview(source: Scenario, options: FinishOption[]) {
  if (!source.objective?.target) return null;
  for (const option of options) {
    const leaves = tuningList(source, 'landingRecoveryPaceMultipliers').map(multiplier => {
      const opener = { ...option.plan, speed: option.plan.speed * multiplier };
      const first = simulateShot(source, opener, { record: false, recordPaths: true });
      if (!evaluateShotObjective(source, opener, first).success || distance(first.cueEnd, source.objective!.target!) < tuningNumber(source, 'landingRecoveryMinTargetOffset')) return null;
      const setup = secondShotSetup(source, opener, first);
      for (const route of setup.routes) for (const pace of tuningList(source, 'landingRecoveryReplySpeeds')) for (const spin of tuningList(source, 'landingRecoveryReplyTopSpins')) {
        const response = secondShotPlan(setup.scenario, setup.ballId, route, pace, spin);
        const second = simulateShot(setup.scenario, response, { record: false, recordPaths: true });
        if (directReplyPotted(response, second)) return { multiplier, opener, first, scenario: setup.scenario, response, second, cut: route.cutAngle };
      }
      return null;
    });
    const [a, b] = leaves;
    if (!a || !b || a.response.pocketId !== b.response.pocketId || distance(a.first.cueEnd, b.first.cueEnd) < tuningNumber(source, 'landingRecoveryMinLeafSeparation') || Math.abs(a.cut - b.cut) < tuningNumber(source, 'landingRecoveryMinCutDifference')) continue;
    const copied = [simulateShot(a.scenario, b.response, { record: false, recordPaths: true }), simulateShot(b.scenario, a.response, { record: false, recordPaths: true })];
    if (directReplyPotted(b.response, copied[0]) || directReplyPotted(a.response, copied[1])) continue;
    return { referenceId: option.id, leaves: [a, b], copied };
  }
  return null;
}
export type LandingRecoveryPreview = NonNullable<ReturnType<typeof landingRecoveryPreview>>;
