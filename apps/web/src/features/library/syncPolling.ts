import type { LibrarySyncJob } from "./libraryApi";

const terminalStatuses = new Set<LibrarySyncJob["status"]>([
  "SUCCEEDED",
  "FAILED",
]);

export function isActiveSync(job?: LibrarySyncJob | null): boolean {
  return Boolean(job && !terminalStatuses.has(job.status));
}

export function syncPollDelay(attemptCount: number): number {
  return Math.min(15_000, 1_000 * 2 ** Math.max(0, attemptCount));
}

interface SyncPollingOptions {
  initialJob: LibrarySyncJob;
  request: (signal: AbortSignal) => Promise<LibrarySyncJob>;
  onUpdate: (job: LibrarySyncJob) => void;
  isVisible?: () => boolean;
  subscribeToVisibility?: (listener: () => void) => () => void;
}

function browserVisibility(listener: () => void): () => void {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}

export function startSyncPolling({
  initialJob,
  request,
  onUpdate,
  isVisible = () => document.visibilityState === "visible",
  subscribeToVisibility = browserVisibility,
}: SyncPollingOptions): () => void {
  let job = initialJob;
  let stopped = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let delay = syncPollDelay(job.attemptCount);

  const schedule = () => {
    if (stopped || inFlight || timer || !isActiveSync(job) || !isVisible()) {
      return;
    }
    timer = setTimeout(() => {
      timer = undefined;
      void poll();
    }, delay);
  };

  const poll = async () => {
    if (stopped || inFlight || !isVisible() || !isActiveSync(job)) return;
    inFlight = true;
    controller = new AbortController();
    try {
      job = await request(controller.signal);
      if (stopped) return;
      delay = Math.min(
        15_000,
        Math.max(delay * 2, syncPollDelay(job.attemptCount)),
      );
      onUpdate(job);
    } catch {
      if (!stopped) delay = Math.min(15_000, delay * 2);
    } finally {
      inFlight = false;
      controller = undefined;
      schedule();
    }
  };

  const visibilityChanged = () => {
    if (!isVisible() && timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    schedule();
  };
  const unsubscribe = subscribeToVisibility(visibilityChanged);
  schedule();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    controller?.abort();
    unsubscribe();
  };
}
