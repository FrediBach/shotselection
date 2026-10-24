import { DEFAULT_CHARACTER, talentNoiseMultiplier } from './characters';
import { normalRandom } from './math';
import type { CharacterTalents, ShotPlan } from './types';

/** Shared stroke-error model. Call in this order to preserve common random numbers. */
export function perturbShot(plan: ShotPlan, random: () => number, talents: CharacterTalents = DEFAULT_CHARACTER.talents): ShotPlan {
  return { ...plan,
    angle: plan.angle + normalRandom(random) * (0.0044 + Math.abs(plan.sideSpin) * .000025) * talentNoiseMultiplier(talents.anglePrecision),
    speed: plan.speed * (1 + normalRandom(random) * .035 * talentNoiseMultiplier(talents.strengthPrecision)),
    topSpin: plan.topSpin + normalRandom(random) * .085 * talentNoiseMultiplier(talents.spinPrecision),
    sideSpin: plan.sideSpin + normalRandom(random) * 3 * talentNoiseMultiplier(talents.englishPrecision),
  };
}
