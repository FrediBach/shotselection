import type { AnalyzeOptions, PreparedRound, RoundAnalysis, Scenario, Selection, ShotPlan, ShotTolerance } from './types';
import type { SandboxRequest } from './sandbox';
import type { LabRequest, LabResult } from './lab';
import type { LabAutoRequest, LabAutoResult } from './lab-auto';

function runWorker<Result>(request: object, signal?: AbortSignal): Promise<Result> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Analysis cancelled', 'AbortError')); return; }
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { worker.terminate(); signal?.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Analysis cancelled', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: Result; error?: string }>) => {
      cleanup();
      if (event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error ?? 'The simulation could not be calculated.'));
    };
    worker.onerror = event => { cleanup(); reject(new Error(event.message || 'The simulation worker stopped unexpectedly.')); };
    worker.postMessage(request);
  });
}

export function prepareRoundAsync(scenario: Scenario, options: { signal?: AbortSignal } = {}): Promise<PreparedRound> {
  return runWorker({ method: 'prepare', scenario }, options.signal);
}

export function prepareSandboxRoundAsync(request: SandboxRequest, options: { signal?: AbortSignal } = {}): Promise<PreparedRound> {
  return runWorker({ method: 'sandbox', request }, options.signal);
}

export function analyzeLabAsync(request: LabRequest, options: { signal?: AbortSignal } = {}): Promise<LabResult> {
  return runWorker({ method: 'lab', request }, options.signal);
}

export function fitLabShotAsync(request: LabAutoRequest, options: { signal?: AbortSignal } = {}): Promise<LabAutoResult> {
  return runWorker({ method: 'lab-auto', request }, options.signal);
}

export function analyzeRoundAsync(prepared: PreparedRound, selection: Selection, options: AnalyzeOptions & { signal?: AbortSignal } = {}): Promise<RoundAnalysis> {
  return runWorker({ method: 'analyze', prepared, selection, options: { samples: options.samples, talents: options.talents } }, options.signal);
}

/** A separate worker keeps sensitivity calculations independent of round scores. */
export function analyzeShotToleranceAsync(scenario: Scenario, plan: ShotPlan, options: { signal?: AbortSignal } = {}): Promise<ShotTolerance> {
  return runWorker({ method: 'tolerance', scenario, plan }, options.signal);
}
