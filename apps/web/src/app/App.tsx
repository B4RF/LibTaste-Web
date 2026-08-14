import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { SessionManager } from "../api/client";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import { CallbackPage } from "../auth/CallbackPage";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { Artwork } from "../components/Artwork";
import type { RuntimeConfig } from "../config";
import { copy } from "../content/copy";
import { ComparePage } from "../features/comparisons/ComparePage";
import {
  FriendLeaderboardPage,
  FriendsLeaderboardPage,
  GlobalLeaderboardPage,
  PersonalLeaderboardPage,
} from "../features/leaderboards/LeaderboardPage";
import { LibraryPage } from "../features/library/LibraryPage";
import {
  ProfileSyncStatus,
  useProfileQuery,
} from "../features/library/ProfileSyncStatus";
import { RecommendationsPage } from "../features/recommendations/RecommendationsPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import styles from "../styles/App.module.css";
import { LandingPage } from "./LandingPage";

const protectedPages = [
  {
    path: "/compare",
    label: copy.navigation.compare,
  },
  {
    path: "/recommendations",
    label: copy.navigation.recommendations,
  },
  {
    path: "/leaderboard/me",
    label: copy.navigation.personalRanking,
  },
  {
    path: "/leaderboard/friends",
    label: copy.navigation.friends,
  },
  {
    path: "/library",
    label: copy.navigation.library,
  },
  {
    path: "/settings",
    label: copy.navigation.settings,
  },
] as const;

const directNavigationPages = protectedPages.filter(({ path }) =>
  ["/compare", "/recommendations"].includes(path),
);

function NavigationDisclosure({
  label,
  active = false,
  buttonContent,
  children,
}: {
  label: string;
  active?: boolean;
  buttonContent?: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const lastPointerType = useRef("");
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const dismissPointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) close();
    };
    const dismissFocus = (event: FocusEvent) => {
      if (!container.current?.contains(event.target as Node)) close();
    };
    const dismissKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", dismissPointer);
    document.addEventListener("focusin", dismissFocus);
    document.addEventListener("keydown", dismissKeyboard);
    return () => {
      document.removeEventListener("pointerdown", dismissPointer);
      document.removeEventListener("focusin", dismissFocus);
      document.removeEventListener("keydown", dismissKeyboard);
    };
  }, [open]);

  return (
    <div
      className={styles.navDisclosure}
      ref={container}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={active ? styles.navDisclosureActive : undefined}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onPointerDown={(event) => {
          lastPointerType.current = event.pointerType;
        }}
        onClick={(event) => {
          if (event.detail > 0 && lastPointerType.current === "mouse")
            setOpen(true);
          else setOpen((current) => !current);
        }}
      >
        {buttonContent ?? label}
        <span aria-hidden="true">⌄</span>
      </button>
      {open ? (
        <ul id={id} className={styles.navDisclosurePanel}>
          {children(close)}
        </ul>
      ) : null}
    </div>
  );
}

function ProfileNavigationItem() {
  const { status } = useAuth();
  if (status !== "authenticated") return null;
  return <AuthenticatedProfileNavigationItem />;
}

function AuthenticatedProfileNavigationItem() {
  const location = useLocation();
  const profileQuery = useProfileQuery();
  const profile = profileQuery.data;
  const name = profile?.displayName ?? copy.library.steamPlayer;
  return (
    <li>
      <NavigationDisclosure
        label={copy.navigation.profile(name)}
        active={["/library", "/settings"].includes(location.pathname)}
        buttonContent={
          <span className={styles.profileMenuTrigger}>
            <Artwork kind="avatar" src={profile?.avatarUrl} name={name} />
            <span>{name}</span>
          </span>
        }
      >
        {(close) => (
          <>
            {profile?.profileUrl ? (
              <li>
                <a
                  href={profile.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={close}
                >
                  {copy.library.openSteamProfile} ↗
                </a>
              </li>
            ) : null}
            <li>
              <NavLink to="/library" onClick={close}>
                {copy.navigation.library}
              </NavLink>
            </li>
            <li>
              <NavLink to="/settings" onClick={close}>
                {copy.navigation.settings}
              </NavLink>
            </li>
          </>
        )}
      </NavigationDisclosure>
    </li>
  );
}

function Shell({
  children,
  config,
}: {
  children: ReactNode;
  config: RuntimeConfig;
}) {
  const location = useLocation();
  return (
    <div className={styles.app}>
      <a className={styles.skipLink} href="#main-content">
        {copy.shell.skip}
      </a>
      <header className={styles.header}>
        <Link className={styles.brand} to="/" aria-label={copy.shell.home}>
          <span aria-hidden="true">L/T</span> {copy.brand}
        </Link>
        <nav aria-label={copy.shell.navigation}>
          <ul>
            {directNavigationPages.map((page) => (
              <li key={page.path}>
                <NavLink to={page.path}>{page.label}</NavLink>
              </li>
            ))}
            <li>
              <NavigationDisclosure
                label={copy.navigation.leaderboards}
                active={location.pathname.startsWith("/leaderboard/")}
              >
                {(close) => (
                  <>
                    <li>
                      <NavLink to="/leaderboard/me" onClick={close}>
                        {copy.navigation.personalRanking}
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/leaderboard/friends" onClick={close}>
                        {copy.navigation.friends}
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/leaderboard/global" onClick={close}>
                        {copy.navigation.global}
                      </NavLink>
                    </li>
                  </>
                )}
              </NavigationDisclosure>
            </li>
            <ProfileNavigationItem />
          </ul>
        </nav>
        {config.environmentLabel ? (
          <span className={styles.environment}>{config.environmentLabel}</span>
        ) : null}
      </header>
      <ProfileSyncStatus />
      <main id="main-content" className={styles.main} tabIndex={-1}>
        {children}
      </main>
      <footer className={styles.footer}>{copy.shell.footer}</footer>
    </div>
  );
}

function NotFound() {
  return (
    <section className={styles.centeredPanel}>
      <p className={styles.eyebrow}>{copy.routes.notFoundEyebrow}</p>
      <h1>{copy.routes.notFoundTitle}</h1>
      <Link className={styles.secondaryButton} to="/">
        {copy.routes.notFoundAction}
      </Link>
    </section>
  );
}

export function ApplicationRoutes({ config }: { config: RuntimeConfig }) {
  return (
    <Shell config={config}>
      <Routes>
        <Route path="/" element={<LandingPage config={config} />} />
        <Route
          path="/auth/callback"
          element={<CallbackPage config={config} />}
        />
        <Route path="/leaderboard/global" element={<GlobalLeaderboardPage />} />
        {protectedPages.map((page) => (
          <Route
            key={page.path}
            path={page.path}
            element={
              <ProtectedRoute config={config}>
                {page.path === "/compare" ? (
                  <ComparePage />
                ) : page.path === "/recommendations" ? (
                  <RecommendationsPage />
                ) : page.path === "/leaderboard/me" ? (
                  <PersonalLeaderboardPage />
                ) : page.path === "/leaderboard/friends" ? (
                  <FriendsLeaderboardPage />
                ) : page.path === "/library" ? (
                  <LibraryPage />
                ) : (
                  <SettingsPage />
                )}
              </ProtectedRoute>
            }
          />
        ))}
        <Route
          path="/leaderboard/friends/:friendId"
          element={
            <ProtectedRoute config={config}>
              <FriendLeaderboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Shell>
  );
}

export function ApplicationProviders({
  config,
  children,
  session: suppliedSession,
  queryClient: suppliedQueryClient,
}: {
  config: RuntimeConfig;
  children: ReactNode;
  session?: SessionManager;
  queryClient?: QueryClient;
}) {
  const createdQueryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
      }),
    [],
  );
  const queryClient = suppliedQueryClient ?? createdQueryClient;
  const session = useMemo(
    () => suppliedSession ?? new SessionManager(config),
    [config, suppliedSession],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider session={session}>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

export function App({ config }: { config: RuntimeConfig }) {
  return (
    <ApplicationProviders config={config}>
      <BrowserRouter>
        <ApplicationRoutes config={config} />
      </BrowserRouter>
    </ApplicationProviders>
  );
}
