import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { ApiProblem } from "../../api/problem";
import { useAuth } from "../../auth/AuthContext";
import { ProblemNotice } from "../../components/ProblemNotice";
import { copy } from "../../content/copy";
import styles from "../../styles/App.module.css";
import {
  friendLeaderboardDataQueryKey,
  friendLeaderboardSharingQueryKey,
  getFriendLeaderboardSharing,
  updateFriendLeaderboardSharing,
} from "../leaderboards/leaderboardApi";
import {
  deleteAccount,
  logoutAllSessions,
  logoutCurrentSession,
} from "./settingsApi";

type DialogKind = "logout-all" | "delete";
type PendingAction = "logout-current" | "logout-all" | "delete" | null;

function ConfirmationDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const focusTarget = panelRef.current?.querySelector<HTMLElement>(
      "[data-autofocus], button, input",
    );
    focusTarget?.focus();
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className={styles.dialogBackdrop}>
      <div
        ref={panelRef}
        className={styles.dialogPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { clearSession, session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<unknown>();
  const [confirmation, setConfirmation] = useState("");
  const [uncertain, setUncertain] = useState<string>();
  const logoutAllOpener = useRef<HTMLButtonElement>(null);
  const deleteOpener = useRef<HTMLButtonElement>(null);
  const sharingPending = useRef(false);
  const sharingQuery = useQuery({
    queryKey: friendLeaderboardSharingQueryKey,
    queryFn: ({ signal }) => getFriendLeaderboardSharing(session, signal),
    meta: { scope: "user" },
  });
  const sharingMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      updateFriendLeaderboardSharing(session, enabled),
    onMutate: () => {
      sharingPending.current = true;
    },
    onSuccess: async (sharing) => {
      if (!sharing.enabled) {
        await queryClient.cancelQueries({
          queryKey: friendLeaderboardDataQueryKey,
        });
        queryClient.removeQueries({ queryKey: friendLeaderboardDataQueryKey });
      }
      queryClient.setQueryData(friendLeaderboardSharingQueryKey, sharing);
    },
    onSettled: () => {
      sharingPending.current = false;
    },
  });

  function openDialog(kind: DialogKind) {
    setError(undefined);
    setUncertain(undefined);
    setDialog(kind);
  }

  function closeDialog() {
    if (pending) return;
    const opener =
      dialog === "delete" ? deleteOpener.current : logoutAllOpener.current;
    setDialog(null);
    setConfirmation("");
    setError(undefined);
    setUncertain(undefined);
    opener?.focus();
  }

  async function finishSession(message: string) {
    await clearSession();
    navigate("/", { replace: true, state: { sessionMessage: message } });
  }

  async function runLogout(kind: "current" | "all") {
    setPending(kind === "current" ? "logout-current" : "logout-all");
    setError(undefined);
    try {
      if (kind === "current") await logoutCurrentSession(session);
      else await logoutAllSessions(session);
      await finishSession(
        kind === "current"
          ? copy.settings.messages.loggedOutCurrent
          : copy.settings.messages.loggedOutAll,
      );
    } catch (nextError) {
      if (nextError instanceof ApiProblem && nextError.status === 401) {
        await finishSession(
          kind === "current"
            ? copy.settings.messages.loggedOutCurrent
            : copy.settings.messages.loggedOutAll,
        );
      } else {
        setError(nextError);
      }
    } finally {
      setPending(null);
    }
  }

  async function runDeletion() {
    if (confirmation !== "DELETE" || pending) return;
    setPending("delete");
    setError(undefined);
    setUncertain(undefined);
    try {
      await deleteAccount(session);
      await finishSession(copy.settings.messages.deleted);
    } catch (nextError) {
      if (nextError instanceof ApiProblem) {
        if (nextError.status === 401) {
          setConfirmation("");
          await finishSession(copy.settings.messages.deletionNotConfirmed);
        } else {
          setError(nextError);
        }
      } else {
        const recovery = await session.recoverSession();
        if (recovery === "signed-out") {
          setConfirmation("");
          await finishSession(copy.settings.messages.deletionAppearsComplete);
        } else {
          setUncertain(
            recovery === "authenticated"
              ? copy.settings.uncertain.authenticated
              : copy.settings.uncertain.unknown,
          );
        }
      }
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;
  return (
    <section className={styles.settingsPage} aria-labelledby="settings-title">
      <header className={styles.settingsHeader}>
        <p className={styles.eyebrow}>{copy.settings.eyebrow}</p>
        <h1 id="settings-title">{copy.routes.settings}</h1>
        <p className={styles.lede}>{copy.settings.summary}</p>
      </header>

      <article className={`${styles.settingsCard} ${styles.sharingCard}`}>
        <h2>{copy.settings.sharing.title}</h2>
        <p>{copy.settings.sharing.detail}</p>
        <p>{copy.settings.sharing.privacy}</p>
        {sharingQuery.isPending ? (
          <p role="status">{copy.settings.sharing.loading}</p>
        ) : sharingQuery.isError ? (
          <ProblemNotice
            error={sharingQuery.error}
            onRetry={() => void sharingQuery.refetch()}
          />
        ) : (
          <>
            <p role="status">
              {sharingQuery.data.enabled
                ? copy.settings.sharing.enabled
                : copy.settings.sharing.disabled}
            </p>
            {sharingMutation.isError ? (
              <ProblemNotice error={sharingMutation.error} />
            ) : null}
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={busy || sharingMutation.isPending}
              onClick={() => {
                if (sharingPending.current) return;
                sharingMutation.mutate(!sharingQuery.data.enabled);
              }}
            >
              {sharingQuery.data.enabled
                ? copy.settings.sharing.disable
                : copy.settings.sharing.enable}
            </button>
            {sharingMutation.isPending ? (
              <p role="status">
                {sharingQuery.data.enabled
                  ? copy.settings.sharing.disabling
                  : copy.settings.sharing.enabling}
              </p>
            ) : null}
          </>
        )}
      </article>

      {error && dialog === null ? <ProblemNotice error={error} /> : null}

      <div className={styles.settingsActions}>
        <article className={styles.settingsCard}>
          <h2>{copy.settings.current.title}</h2>
          <p>{copy.settings.current.detail}</p>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={busy}
            onClick={() => void runLogout("current")}
          >
            {copy.settings.current.action}
          </button>
          {pending === "logout-current" ? (
            <p role="status">{copy.settings.current.pending}</p>
          ) : null}
        </article>

        <article className={styles.settingsCard}>
          <h2>{copy.settings.all.title}</h2>
          <p>{copy.settings.all.detail}</p>
          <button
            ref={logoutAllOpener}
            className={styles.secondaryButton}
            type="button"
            disabled={busy}
            onClick={() => openDialog("logout-all")}
          >
            {copy.settings.all.action}
          </button>
        </article>

        <article className={`${styles.settingsCard} ${styles.dangerCard}`}>
          <h2>{copy.settings.deletion.title}</h2>
          <p>{copy.settings.deletion.detail}</p>
          <button
            ref={deleteOpener}
            className={styles.dangerButton}
            type="button"
            disabled={busy}
            onClick={() => openDialog("delete")}
          >
            {copy.settings.deletion.action}
          </button>
        </article>
      </div>

      {dialog === "logout-all" ? (
        <ConfirmationDialog
          title={copy.settings.all.dialogTitle}
          onClose={closeDialog}
        >
          <p>{copy.settings.all.confirmation}</p>
          {error ? <ProblemNotice error={error} /> : null}
          {pending === "logout-all" ? (
            <p role="status">{copy.settings.all.pending}</p>
          ) : null}
          <div className={styles.dialogActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={busy}
              onClick={closeDialog}
            >
              {copy.settings.cancel}
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={busy}
              onClick={() => void runLogout("all")}
            >
              {copy.settings.all.confirmAction}
            </button>
          </div>
        </ConfirmationDialog>
      ) : null}

      {dialog === "delete" ? (
        <ConfirmationDialog
          title={copy.settings.deletion.dialogTitle}
          onClose={closeDialog}
        >
          <p>{copy.settings.deletion.consequences}</p>
          <p>{copy.settings.deletion.steamBoundary}</p>
          <label className={styles.confirmationField}>
            <span>{copy.settings.deletion.confirmationLabel}</span>
            <input
              data-autofocus
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={confirmation}
              disabled={busy}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          {error ? <ProblemNotice error={error} /> : null}
          {uncertain ? (
            <p className={styles.uncertainNotice} role="alert">
              {uncertain}
            </p>
          ) : null}
          {pending === "delete" ? (
            <p role="status">{copy.settings.deletion.pending}</p>
          ) : null}
          <div className={styles.dialogActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={busy}
              onClick={closeDialog}
            >
              {copy.settings.cancel}
            </button>
            <button
              className={styles.dangerButton}
              type="button"
              disabled={busy || confirmation !== "DELETE"}
              onClick={() => void runDeletion()}
            >
              {copy.settings.deletion.confirmAction}
            </button>
          </div>
        </ConfirmationDialog>
      ) : null}
    </section>
  );
}
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
