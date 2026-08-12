import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { copy } from "../../content/copy";
import styles from "../../styles/App.module.css";
import { recommendationQueryKey } from "../recommendations/recommendationApi";
import {
  getProfile,
  getSyncJob,
  type LibrarySyncJob,
  type MeProfile,
} from "./libraryApi";
import { isActiveSync, startSyncPolling } from "./syncPolling";

export const profileQueryKey = ["me-profile"] as const;
export const libraryQueryKey = ["steam-library"] as const;

export function useProfileQuery() {
  const { session, status } = useAuth();
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: ({ signal }) => getProfile(session, signal),
    enabled: status === "authenticated",
    meta: { scope: "user" },
  });
}

function syncLabel(job: LibrarySyncJob): string {
  switch (job.status) {
    case "PENDING":
      return copy.library.sync.pending;
    case "RUNNING":
      return copy.library.sync.running;
    case "RETRY_WAIT":
      return copy.library.sync.retryWait;
    case "SUCCEEDED":
      return copy.library.sync.succeeded;
    case "FAILED":
      return job.failureCode === "LIBRARY_UNAVAILABLE"
        ? copy.library.sync.unavailable
        : copy.library.sync.failed;
  }
}

function AuthenticatedProfileSyncStatus() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const profileQuery = useProfileQuery();
  const job = profileQuery.data?.synchronization;
  const [polledJob, setPolledJob] = useState<LibrarySyncJob>();
  const displayedJob = polledJob?.jobId === job?.jobId ? polledJob : job;

  const recordUpdate = useCallback(
    (nextJob: LibrarySyncJob) => {
      setPolledJob(nextJob);
      if (nextJob.status === "SUCCEEDED" || nextJob.status === "FAILED") {
        queryClient.setQueryData<MeProfile>(profileQueryKey, (current) =>
          current ? { ...current, synchronization: nextJob } : current,
        );
      }
      if (nextJob.status === "SUCCEEDED") {
        void queryClient.invalidateQueries({ queryKey: libraryQueryKey });
        void queryClient.invalidateQueries({
          queryKey: recommendationQueryKey,
        });
      }
    },
    [queryClient],
  );

  useEffect(() => {
    if (!job || !isActiveSync(job)) return;
    return startSyncPolling({
      initialJob: job,
      request: (signal) => getSyncJob(session, signal),
      onUpdate: recordUpdate,
    });
  }, [job, recordUpdate, session]);

  if (
    !displayedJob ||
    (!isActiveSync(displayedJob) && displayedJob.status !== "FAILED")
  )
    return null;
  return (
    <aside
      className={styles.profileStatus}
      aria-label={copy.library.synchronizationStatus}
    >
      <Link to="/library">
        <span className={styles.statusBadge} role="status">
          {syncLabel(displayedJob)}
        </span>
        <span>Open Library</span>
      </Link>
    </aside>
  );
}

export function ProfileSyncStatus() {
  const { status } = useAuth();
  return status === "authenticated" ? <AuthenticatedProfileSyncStatus /> : null;
}
