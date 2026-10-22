import type { AnalyzeOptions, RoundAnalysis, Scenario, Selection } from './types';

export function analyzeRoundAsync(scenario: Scenario, selection: Selection, options: AnalyzeOptions & { signal?: AbortSignal } = {}): Promise<RoundAnalysis> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) { reject(new DOMException('Analysis cancelled', 'AbortError')); return; }
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { worker.terminate(); options.signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Analysis cancelled', 'AbortError')); };
    options.signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: RoundAnalysis; error?: string }>) => {
      cleanup();
      if (event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error ?? 'The ensemble could not be calculated.'));
    };
    worker.onerror = event => { cleanup(); reject(new Error(event.message || 'The simulation worker stopped unexpectedly.')); };
    worker.postMessage({ scenario, selection, options: { samples: options.samples } });
  });
}
