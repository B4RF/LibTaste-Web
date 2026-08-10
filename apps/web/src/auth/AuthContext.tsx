import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { SessionManager, type SessionEvent } from "../api/client";

export type AuthStatus =
  "unknown" | "checking" | "authenticated" | "signed-out";

interface AuthValue {
  status: AuthStatus;
  session: SessionManager;
  restore: () => Promise<boolean>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({
  session,
  children,
}: {
  session: SessionManager;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("unknown");

  useEffect(
    () =>
      session.subscribe((event: SessionEvent) => {
        setStatus(event === "authenticated" ? "authenticated" : "signed-out");
        if (event === "signed-out") {
          queryClient.removeQueries({
            predicate: (query) => query.meta?.scope !== "public",
          });
        }
      }),
    [queryClient, session],
  );

  const restore = useCallback(async () => {
    setStatus("checking");
    try {
      await session.refresh();
      return true;
    } catch {
      return false;
    }
  }, [session]);

  const value = useMemo(
    () => ({ status, session, restore }),
    [restore, session, status],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
