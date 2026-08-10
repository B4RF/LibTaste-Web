import type { SessionManager } from "../../api/client";

export async function logoutCurrentSession(
  session: SessionManager,
): Promise<void> {
  await session.requestOnce("/auth/logout", { method: "POST" });
}

export async function logoutAllSessions(
  session: SessionManager,
): Promise<void> {
  await session.requestOnce("/auth/logout-all", { method: "POST" });
}

export async function deleteAccount(session: SessionManager): Promise<void> {
  await session.requestOnce("/me", { method: "DELETE" });
}
