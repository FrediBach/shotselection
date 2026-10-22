import { describe, expect, it } from 'vitest';
import { pointsFor, scoreSelection } from './scoring';

const shot = (score: number, successRate = score) => ({ score, successRate });

describe('round scoring', () => {
  it('combines ensemble quality and placement into whole ten-point awards', () => {
    const candidates = [shot(0.9), shot(0.6), shot(0.3)];
    expect(scoreSelection(candidates[0], candidates)).toMatchObject({ points: 100, qualityPoints: 70, rankPoints: 30, rank: 1 });
    expect(scoreSelection(candidates[1], candidates)).toMatchObject({ points: 70, qualityPoints: 50, rankPoints: 20, rank: 2 });
    expect(scoreSelection(candidates[2], candidates)).toMatchObject({ points: 20, qualityPoints: 20, rankPoints: 0, rank: 3 });
    expect(pointsFor(candidates[1], candidates)).toBe(70);
  });

  it('shares competition ranks between equal and near-equal ensembles', () => {
    const candidates = [shot(0.9), shot(0.9), shot(0.88), shot(0.6)];
    for (const candidate of candidates.slice(0, 3)) {
      expect(scoreSelection(candidate, candidates)).toMatchObject({ points: 100, rank: 1, tiedCount: 3, rankPoints: 30, candidateCount: 4 });
    }
    expect(scoreSelection(candidates[3], candidates)).toMatchObject({ rank: 4, tiedCount: 1, rankPoints: 0 });
  });

  it('includes the tolerance boundary without merging a chain of close results', () => {
    const candidates = [shot(0.9), shot(0.855), shot(0.854999), shot(0.82)];
    expect(scoreSelection(candidates[1], candidates)).toMatchObject({ rank: 1, tiedCount: 2 });
    expect(scoreSelection(candidates[2], candidates)).toMatchObject({ rank: 3, tiedCount: 2 });
    expect(scoreSelection(candidates[3], candidates)).toMatchObject({ rank: 3, tiedCount: 2 });
  });

  it('keeps quality relative to the best even when all utilities are low', () => {
    const candidates = [shot(0.05), shot(0.01)];
    const result = scoreSelection(candidates[1], candidates);
    expect(result).toMatchObject({
      points: 40, qualityPoints: 10, rankPoints: 30, rank: 1, tiedCount: 2,
    });
    expect(result.relativeQuality).toBeCloseTo(0.2);
  });

  it('awards no points without a successful pot and finish, even with positive utility', () => {
    const candidates = [shot(0.2, 0), shot(0.1, 0.05)];
    expect(scoreSelection(candidates[0], candidates)).toMatchObject({
      points: 0, qualityPoints: 0, rankPoints: 0, rank: 1, noSuccessfulTrials: true,
    });
  });

  it('awards zero when every ensemble fails, including zero-utility ties', () => {
    for (const candidates of [[shot(0.2, 0), shot(0.1, 0)], [shot(0), shot(0), shot(0)]]) {
      for (const candidate of candidates) {
        expect(scoreSelection(candidate, candidates)).toMatchObject({ points: 0, qualityPoints: 0, rankPoints: 0, noSuccessfulTrials: true });
      }
    }
  });

  it('handles a single offered shot and a non-positive best utility', () => {
    const candidate = shot(0.6);
    expect(scoreSelection(candidate, [candidate])).toMatchObject({ points: 100, rankPoints: 30, rank: 1, tiedCount: 1, candidateCount: 1 });
    expect(scoreSelection(shot(0, 0.1), [shot(0, 0.1)])).toMatchObject({ points: 0, qualityPoints: 0, rankPoints: 0, relativeQuality: 0 });
  });

  it('does not mutate candidates or depend on their ordering', () => {
    const candidates = [shot(0.82), shot(0.9), shot(0.6), shot(0.86)];
    const original = [...candidates];
    const reversed = [...candidates].reverse();
    for (const candidate of candidates) expect(scoreSelection(candidate, candidates)).toEqual(scoreSelection(candidate, reversed));
    expect(candidates).toEqual(original);
  });

  it('is monotonic within a fixed pool of successful choices and stays in ten-point steps', () => {
    const candidates = Array.from({ length: 101 }, (_, index) => shot(index / 100, Math.max(0.01, index / 100)));
    let previous = 0;
    for (const candidate of candidates) {
      const result = scoreSelection(candidate, candidates);
      expect(result.points).toBeGreaterThanOrEqual(previous);
      expect(result.points).toBeGreaterThanOrEqual(0);
      expect(result.points).toBeLessThanOrEqual(100);
      expect(result.points % 10).toBe(0);
      expect(result.qualityPoints + result.rankPoints).toBe(result.points);
      previous = result.points;
    }
  });

  it('requires an offered candidate score', () => {
    expect(() => scoreSelection(shot(0.5), [])).toThrow('at least one offered shot');
    expect(() => scoreSelection(shot(0.5), [shot(0.6)])).toThrow('among the offered scores');
  });
});
