/// <reference lib="webworker" />
import { analyzeRound } from './analysis';
import type { AnalyzeOptions, Scenario, Selection } from './types';

self.onmessage = (event: MessageEvent<{ scenario: Scenario; selection: Selection; options: AnalyzeOptions }>) => {
  try {
    self.postMessage({ result: analyzeRound(event.data.scenario, event.data.selection, event.data.options) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'The ensemble could not be calculated.' });
  }
};
