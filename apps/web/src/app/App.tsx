import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { BrowserRouter, Link, NavLink, Route, Routes } from "react-router-dom";
import { SessionManager } from "../api/client";
import { AuthProvider } from "../auth/AuthContext";
import { CallbackPage } from "../auth/CallbackPage";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import type { RuntimeConfig } from "../config";
import { copy } from "../content/copy";
import { ComparePage } from "../features/comparisons/ComparePage";
import {
  GlobalLeaderboardPage,
  PersonalLeaderboardPage,
} from "../features/leaderboards/LeaderboardPage";
import { LibraryPage } from "../features/library/LibraryPage";
import { ProfileSyncStatus } from "../features/library/ProfileSyncStatus";
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
    path: "/library",
    label: copy.navigation.library,
  },
  {
    path: "/settings",
    label: copy.navigation.settings,
  },
] as const;

function Shell({
  children,
  config,
}: {
  children: ReactNode;
  config: RuntimeConfig;
}) {
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
            {protectedPages.map((page) => (
              <li key={page.path}>
                <NavLink to={page.path}>{page.label}</NavLink>
              </li>
            ))}
            <li>
              <NavLink to="/leaderboard/global">
                {copy.navigation.global}
              </NavLink>
            </li>
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
                ) : page.path === "/library" ? (
                  <LibraryPage />
                ) : (
                  <SettingsPage />
                )}
              </ProtectedRoute>
            }
          />
        ))}
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
