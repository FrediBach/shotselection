/// <reference lib="webworker" />
import { analyzeRound } from './analysis';
import { prepareRound } from './preparation';
import type { AnalyzeOptions, PreparedRound, Scenario, Selection } from './types';

type WorkerRequest = { method: 'prepare'; scenario: Scenario }
  | { method: 'analyze'; prepared: PreparedRound; selection: Selection; options: AnalyzeOptions };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const request = event.data;
    const result = request.method === 'prepare'
      ? prepareRound(request.scenario)
      : analyzeRound(request.prepared, request.selection, request.options);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'The simulation could not be calculated.' });
  }
};
