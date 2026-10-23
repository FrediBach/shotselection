import { describe, expect, it } from 'vitest';
import { bankPlanForStroke, bankRoutesFor } from './bank-routes';
import { simulateShot } from './physics';
import type { Scenario } from './types';

const scenario: Scenario = {
  level: 51, seed: 0, title: 'Calibrated bank', description: '', bank: { ballId: 1, minCushions: 1 }, balls: [
    { id: 0, position: { x: 1.02, y: 0.78 } },
    { id: 1, position: { x: 1.27, y: 0.28 } },
    { id: 2, position: { x: 1.145, y: 0.53 } },
  ],
};

describe('physical bank aim calibration', () => {
  it('rejects bank planning when the cue ball, target ball or bank objective is missing', () => {
    const route = bankRoutesFor(scenario, 1)[0];
    expect(route).toBeDefined();
    expect(bankPlanForStroke({ ...scenario, balls: scenario.balls.filter(ball => ball.id !== 0) }, route, 1.6, 1.6)).toBeNull();
    expect(bankPlanForStroke({ ...scenario, balls: scenario.balls.filter(ball => ball.id !== 1) }, route, 1.6, 1.6)).toBeNull();
    expect(bankPlanForStroke({ ...scenario, bank: undefined }, route, 1.6, 1.6)).toBeNull();
  });

  it('corrects a mirror-table aim for actual cushion restitution and spin', () => {
    const route = bankRoutesFor(scenario, 1).find(candidate => candidate.pocketId === 1 && candidate.sides[0] === 'bottom')!;
    const plan = bankPlanForStroke(scenario, route, 1.6, 1.6)!;
    expect(plan).not.toBeNull();
    expect(Math.abs(plan.angle - route.angle)).toBeGreaterThan(0.01);
    const uncorrected = simulateShot(scenario, { ...plan, angle: route.angle }, { record: false });
    expect(uncorrected.potted).not.toContain(1);
    const calibrated = simulateShot(scenario, plan, { record: false });
    expect(calibrated.firstContact).toBe(1);
    expect(calibrated.cueBanksBeforeContact).toBe(1);
    expect(calibrated.potted).toContain(1);
    expect(calibrated.scratch).toBe(false);
  });

  it('rejects a calibrated route when another ball occupies its approach', () => {
    const route = bankRoutesFor(scenario, 1).find(candidate => candidate.pocketId === 1 && candidate.sides[0] === 'bottom')!;
    const plan = bankPlanForStroke(scenario, route, 1.6, 1.6)!;
    const blocked: Scenario = { ...scenario, balls: [...scenario.balls, { id: 3, position: {
      x: scenario.balls[0].position.x + Math.cos(plan.angle) * 0.16,
      y: scenario.balls[0].position.y + Math.sin(plan.angle) * 0.16,
    } }] };
    expect(bankPlanForStroke(blocked, route, 1.6, 1.6)).toBeNull();
  });

  it('converges to equivalent three-cushion aims when either table axis is reflected', () => {
    const angles: number[] = [];
    for (const reflection of [0, 1, 2, 3]) {
      const reflected: Scenario = { ...scenario, bank: { ballId: 1, minCushions: 3 }, balls: [
        { id: 0, position: { x: 1.7, y: 0.9 } },
        { id: 1, position: { x: 0.22, y: 0.16 } },
      ].map(ball => ({ ...ball, position: {
        x: reflection & 1 ? 2.54 - ball.position.x : ball.position.x,
        y: reflection & 2 ? 1.27 - ball.position.y : ball.position.y,
      } })) };
      const sides = [['bottom', 'right', 'top'], ['bottom', 'left', 'top'], ['top', 'right', 'bottom'], ['top', 'left', 'bottom']][reflection];
      const route = bankRoutesFor(reflected, 1).find(candidate => candidate.pocketId === [0, 2, 5, 3][reflection]
        && candidate.sides.every((side, index) => side === sides[index]))!;
      const plan = bankPlanForStroke(reflected, route, 2.8, -1.1)!;
      expect(plan).not.toBeNull();
      angles.push(plan.angle);
      const simulation = simulateShot(reflected, plan, { record: false });
      expect(simulation.firstContact).toBe(1);
      expect(simulation.cueBanksBeforeContact).toBe(3);
      expect(simulation.potted).toContain(1);
    }
    expect(angles[1]).toBeCloseTo(Math.PI - angles[0], 9);
    expect(angles[2]).toBeCloseTo(-angles[0], 9);
    expect(angles[3]).toBeCloseTo(angles[0] - Math.PI, 9);
  });
});
