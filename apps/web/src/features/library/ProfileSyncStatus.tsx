import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { Artwork } from "../../components/Artwork";
import { copy } from "../../content/copy";
import styles from "../../styles/App.module.css";
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

  if (!profileQuery.data) return null;
  const profile = profileQuery.data;
  return (
    <aside
      className={styles.profileStatus}
      aria-label={copy.library.profileStatus}
    >
      <div className={styles.profileIdentity}>
        <Artwork
          kind="avatar"
          src={profile.avatarUrl}
          name={profile.displayName ?? copy.library.steamPlayer}
        />
        <div>
          <strong>{profile.displayName ?? copy.library.steamPlayer}</strong>
          {profile.profileUrl ? (
            <a href={profile.profileUrl} rel="noreferrer" target="_blank">
              {copy.library.openSteamProfile}
            </a>
          ) : null}
        </div>
      </div>
      <div>
        <span className={styles.statusBadge}>
          {profile.libraryState.replace("_", " ")}
        </span>
        {displayedJob ? (
          <span role="status">{syncLabel(displayedJob)}</span>
        ) : null}
      </div>
    </aside>
  );
}

export function ProfileSyncStatus() {
  const { status } = useAuth();
  return status === "authenticated" ? <AuthenticatedProfileSyncStatus /> : null;
}
