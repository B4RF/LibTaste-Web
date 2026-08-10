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
  compare: {
    eyebrow: "Pairwise ranking",
    summary:
      "Choose the game you prefer, record a draw, or skip this server-selected pair.",
    irreversible:
      "Every submitted outcome is final and cannot be undone. Retrying sends the identical choice for the same comparison.",
    loading: "Finding your current comparison…",
    retry: (outcome: string) => `Retry ${outcome}`,
    status: {
      ready: "Choose an outcome. All four actions submit immediately.",
      submitting: (outcome: string) => `Submitting ${outcome}…`,
      uncertain: (outcome: string) =>
        `The result is uncertain. Only the identical ${outcome} can be retried.`,
      recorded: (outcome: string) =>
        `Recorded ${outcome}. Loading the next comparison.`,
      skipped:
        "Skipped. No rating change is claimed. Loading the next comparison.",
    },
    expiry: {
      open: (time: string) => `Submission window is open until ${time}.`,
      soon: (time: string) =>
        `Submission window expires soon at ${time}. The server remains authoritative.`,
      passed: (time: string) =>
        `The displayed submission window passed at ${time}. The server will confirm whether an outcome is still accepted.`,
    },
    shortcuts: {
      title: "Keyboard shortcuts",
      detail:
        "Press L for the left game, R for the right game, D for draw, or S to skip. Shortcuts pause while another control or text field has focus.",
    },
    stale: {
      eyebrow: "Comparison changed",
      title: "This pair is no longer interactive",
      detail:
        "It expired, was completed elsewhere, or is no longer the active server comparison.",
      action: "Get current comparison",
    },
    recovery: {
      synchronization: {
        eyebrow: "Library synchronization",
        title: "Your library is not ready for comparisons",
        detail:
          "Open Library to review synchronization or Steam availability, then try again.",
      },
      eligibility: {
        eyebrow: "Eligible population",
        title: "More eligible games are needed",
        detail:
          "Open Library to include enough currently owned games for a pair.",
      },
      "rate-limit": {
        eyebrow: "Please wait",
        title: "Comparisons are temporarily rate limited",
        detail: "Wait for the API cooldown before requesting another pair.",
      },
      "no-pair": {
        eyebrow: "No pair available",
        title: "There is no comparison to show right now",
        detail:
          "Your library may be eligible even though the ranking model cannot currently allocate a pair.",
      },
      generic: {
        eyebrow: "Comparison unavailable",
        title: "A comparison could not be loaded",
        detail: "Try retrieving the current server state again.",
      },
    },
  },
  library: {
    eyebrow: "Steam collection",
    summary:
      "Browse imported games, review ownership and playtime, and choose which currently owned games can enter comparisons.",
    profileStatus: "Steam profile and library synchronization",
    steamPlayer: "Steam player",
    openSteamProfile: "Open Steam profile",
    synchronize: "Synchronize library",
    synchronizing: "Requesting synchronizationâ€¦",
    libraryState: "Library state",
    lastSync: "Last library synchronization",
    notYet: "Not synchronized yet",
    cooldown:
      "Steam library synchronization can be requested once per hour. Your imported library remains available while you wait.",
    loadingProfile: "Loading Steam profileâ€¦",
    loading: "Loading Steam libraryâ€¦",
    loadingMore: "Loading moreâ€¦",
    loadMore: "Load more",
    end: "End of library",
    empty: "No imported Steam games are available.",
    notSynchronized:
      "Your Steam library has not been synchronized yet. Request synchronization to import it.",
    privateTitle: "Steam game details are private or unavailable",
    privateDetail:
      "You remain signed in. Make Steam game details public, then synchronize again. LibTaste cannot change Steam privacy settings for you.",
    privacyGuidance: "Open Steam privacy guidance",
    playtime: "Recorded playtime",
    neverPlayed: "No recorded playtime",
    ownership: "Ownership",
    currentOwnership: "Currently owned",
    historicalOwnership: "Historical ownership",
    eligibility: {
      label: (name: string) => `Eligibility behavior for ${name}`,
      default: "Default",
      include: "Include",
      exclude: "Exclude",
      defaultExplanation:
        "Default means currently owned games with recorded playtime are eligible unless explicitly overridden.",
      eligible: "Eligible for comparisons",
      notEligible: "Not eligible for comparisons",
      retry: (behavior: string, name: string) =>
        `Retry ${behavior === "exclude" ? "excluding" : behavior === "include" ? "including" : "default behavior for"} ${name}`,
    },
    sync: {
      pending: "Synchronization pending",
      running: "Synchronization running",
      retryWait: "Synchronization waiting to retry",
      succeeded: "Synchronization succeeded",
      failed: "Synchronization failed",
      unavailable: "Steam library unavailable",
    },
  },
  config: {
    title: "LibTaste is not configured",
    summary:
      "Required runtime settings are missing or invalid. Ask the site operator to check the web configuration.",
  },
} as const;
