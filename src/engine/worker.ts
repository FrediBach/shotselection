/// <reference lib="webworker" />
import { analyzeRound } from './analysis';
import { prepareRound } from './preparation';
import { analyzeShotTolerance } from './tolerance';
import type { AnalyzeOptions, PreparedRound, Scenario, Selection, ShotPlan } from './types';

type WorkerRequest = { method: 'prepare'; scenario: Scenario }
  | { method: 'analyze'; prepared: PreparedRound; selection: Selection; options: AnalyzeOptions }
  | { method: 'tolerance'; scenario: Scenario; plan: ShotPlan };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const request = event.data;
    const result = request.method === 'prepare'
      ? prepareRound(request.scenario)
      : request.method === 'tolerance'
        ? analyzeShotTolerance(request.scenario, request.plan)
        : analyzeRound(request.prepared, request.selection, request.options);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'The simulation could not be calculated.' });
  }
};
