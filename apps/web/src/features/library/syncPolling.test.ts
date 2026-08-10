import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { components } from "../../api/generated";
import { startSyncPolling, syncPollDelay } from "./syncPolling";

type LibrarySyncJob = components["schemas"]["LibrarySyncJob"];

const runningJob: LibrarySyncJob = {
  jobId: "11111111-1111-4111-8111-111111111111",
  trigger: "MANUAL",
  status: "RUNNING",
  attemptCount: 0,
  requestedAt: "2026-08-10T08:00:00Z",
  runAfter: "2026-08-10T08:00:00Z",
};

afterEach(() => vi.useRealTimers());

describe("synchronization polling", () => {
  it("uses bounded backoff intervals", () => {
    expect(syncPollDelay(0)).toBe(1_000);
    expect(syncPollDelay(3)).toBe(8_000);
    expect(syncPollDelay(99)).toBe(15_000);
  });

  it("pauses while hidden, never overlaps, and stops at a terminal state", async () => {
    vi.useFakeTimers();
    let visible = true;
    let notifyVisibility: (() => void) | undefined;
    let resolveRequest: ((job: LibrarySyncJob) => void) | undefined;
    const request = vi.fn(
      () =>
        new Promise<LibrarySyncJob>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const updates: LibrarySyncJob[] = [];
    const stop = startSyncPolling({
      initialJob: runningJob,
      request,
      onUpdate: (job) => updates.push(job),
      isVisible: () => visible,
      subscribeToVisibility: (listener) => {
        notifyVisibility = listener;
        return () => {
          notifyVisibility = undefined;
        };
      },
    });

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(request).toHaveBeenCalledTimes(1);

    visible = false;
    notifyVisibility?.();
    resolveRequest?.({ ...runningJob, attemptCount: 1 });
    await act(async () => Promise.resolve());
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(request).toHaveBeenCalledTimes(1);

    visible = true;
    notifyVisibility?.();
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(request).toHaveBeenCalledTimes(2);
    resolveRequest?.({
      ...runningJob,
      status: "SUCCEEDED",
      completedAt: "2026-08-10T08:01:00Z",
    });
    await act(async () => Promise.resolve());
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(request).toHaveBeenCalledTimes(2);
    expect(updates.at(-1)?.status).toBe("SUCCEEDED");
    stop();
  });
});
