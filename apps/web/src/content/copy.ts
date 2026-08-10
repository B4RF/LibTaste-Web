export const copy = {
  brand: "LibTaste",
  shell: {
    home: "LibTaste home",
    skip: "Skip to content",
    navigation: "Primary navigation",
    footer: "Pairwise choices. Personal rankings. No tracking.",
  },
  navigation: {
    compare: "Compare",
    personalRanking: "My Ranking",
    library: "Library",
    settings: "Settings",
    global: "Global",
  },
  landing: {
    eyebrow: "Your library, in your order",
    title: "Find the games you truly love.",
    summary:
      "Choose between two Steam games at a time. LibTaste turns those quick decisions into a ranking that reflects your taste.",
    signIn: "Sign in through Steam",
    leaderboard: "Open global leaderboard",
    privacy:
      "Steam confirms your identity. LibTaste never asks for your Steam password.",
  },
  protected: {
    eyebrow: "Protected area",
    title: "Sign in to continue",
    summary: "This area uses your Steam library and personal LibTaste ranking.",
    checking: "Checking your LibTaste session…",
    ready: "This protected route is ready for its feature implementation.",
  },
  routes: {
    compare: "Compare games",
    personalRanking: "My ranking",
    library: "Steam library",
    settings: "Settings",
    signedIn: "Signed in",
    globalEyebrow: "Public",
    globalTitle: "Global leaderboard",
    globalSummary:
      "The public leaderboard route is available without a Steam session.",
    notFoundEyebrow: "404",
    notFoundTitle: "That page is not here.",
    notFoundAction: "Return home",
  },
  errors: {
    fallbackTitle: "Something went wrong",
    fallbackDetail:
      "LibTaste could not complete the request. Please try again.",
    retry: "Try again",
    support: "Support details",
    requestId: "Request ID",
  },
  callback: {
    working: "Completing Steam sign-in…",
    invalidTitle: "Steam sign-in could not be completed",
    invalidDetail:
      "The sign-in link is missing, expired, or has already been used. Start a fresh sign-in to try again.",
  },
  config: {
    title: "LibTaste is not configured",
    summary:
      "Required runtime settings are missing or invalid. Ask the site operator to check the web configuration.",
  },
} as const;
