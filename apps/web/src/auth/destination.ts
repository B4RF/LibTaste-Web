export const DEFAULT_PROTECTED_DESTINATION = "/compare";

const protectedRoots = [
  "/compare",
  "/recommendations",
  "/leaderboard/me",
  "/leaderboard/friends",
  "/library",
  "/settings",
];

export function safeProtectedDestination(
  value: string | null | undefined,
  origin = window.location.origin,
): string {
  if (!value) return DEFAULT_PROTECTED_DESTINATION;

  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return DEFAULT_PROTECTED_DESTINATION;
    if (
      !protectedRoots.some(
        (root) => url.pathname === root || url.pathname.startsWith(`${root}/`),
      )
    ) {
      return DEFAULT_PROTECTED_DESTINATION;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_PROTECTED_DESTINATION;
  }
}
