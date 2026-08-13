function pluralCopy(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

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
    recommendations: "Recommendations",
    personalRanking: "My ranking",
    library: "Library",
    settings: "Account & Security",
    leaderboards: "Leaderboards",
    global: "Global",
    profile: (name: string) => `${name} profile`,
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
  },
  routes: {
    compare: "Compare games",
    recommendations: "Recommendations",
    personalRanking: "My ranking",
    library: "Steam library",
    settings: "Account & Security",
    signedIn: "Signed in",
    globalEyebrow: "Public",
    globalTitle: "Global leaderboard",
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
      "Choose the game you prefer, record a draw, skip this pair, or exclude a game from future comparisons.",
    irreversible: "Choices are final. A retry repeats the same choice.",
    details: "Comparison details",
    loading: "Finding your current comparison…",
    retry: (outcome: string) => `Retry ${outcome}`,
    status: {
      ready: "Choose an outcome or exclude either game.",
      submitting: (outcome: string) => `Submitting ${outcome}…`,
      uncertain: (outcome: string) =>
        `The result is uncertain. Only the identical ${outcome} can be retried.`,
      recorded: (outcome: string) =>
        `Recorded ${outcome}. Loading the next comparison.`,
      skipped:
        "Skipped. No rating change is claimed. Loading the next comparison.",
    },
    exclusion: {
      action: "Exclude",
      label: (name: string) => `Exclude ${name} from comparisons`,
      excluding: (name: string) => `Excluding ${name} from comparisons…`,
      rejected: (name: string) =>
        `${name} was not excluded. This pair remains available.`,
      uncertain: (name: string) =>
        `Excluding ${name} is uncertain. Only the identical exclusion can be retried.`,
      retiring: (name: string) =>
        `${name} was excluded. Retiring this pair without a rating change…`,
      retirementUncertain: (name: string) =>
        `${name} was excluded, but retiring this pair is uncertain. Only the identical skip can be retried.`,
      excluded: (name: string) =>
        `Excluded ${name}. No rating change was recorded. Loading the next comparison.`,
      retry: (name: string) => `Retry excluding ${name}`,
      retryRetirement: (name: string) =>
        `Retry finishing exclusion for ${name}`,
    },
    steam: {
      action: "View on Steam",
      label: (name: string) => `View ${name} on Steam (opens in a new tab)`,
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
        "Press A for the left game, D for the right game, W for draw, or S to skip. Shortcuts pause while another control or text field has focus.",
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
  recommendations: {
    eyebrow: "Personal discovery",
    introduction:
      "Suggestions use your ratings and anonymous community patterns. They include only games absent from your current and historical Steam library.",
    loading: "Finding recommendations...",
    compare: "Open Compare",
    sources: {
      item: "Similar games",
      user: "Similar players",
      blended: "Similar games and players",
    },
    predictedRank: (percentile: number) =>
      `Predicted to rank above ${percentile}% of your rated games.`,
    supportLabel: "Recommendation support",
    playerSupport: (count: number) =>
      `Supported by ${pluralCopy(count, "similar player")}`,
    gameSupport: (count: number) =>
      `Supported by ${pluralCopy(count, "rated game")}`,
    becauseOf: "Because you rated",
    similarity: (similarity: number) =>
      `${Math.round(similarity * 100)}% similar`,
    more: (count: number) => `and ${count} more`,
    steamLink: "Open on Steam",
    steamLinkLabel: (name: string) =>
      `Open ${name} on Steam (opens in a new tab)`,
    rateLimited:
      "Recommendation requests are temporarily rate limited. Wait before trying again.",
    empty: {
      NOT_ENOUGH_PERSONAL_RATINGS: {
        title: "Rank more games first",
        detail:
          "Recommendations need more ranked, non-excluded games from your library.",
        compare: true,
      },
      NO_RATING_VARIATION: {
        title: "Show more of your preferences",
        detail:
          "Your ratings need clearer differentiation before LibTaste can make useful suggestions. Keep comparing games to shape a more distinct ranking.",
        compare: true,
      },
      NOT_ENOUGH_COMMUNITY_DATA: {
        title: "Community evidence is still growing",
        detail:
          "There is not enough matching community evidence yet. Please return later.",
        compare: false,
      },
      exhausted: {
        title: "You have seen every eligible candidate",
        detail:
          "Every otherwise eligible community-rated candidate is already in your current or historical Steam library.",
      },
      unknown: {
        title: "Recommendations are not available yet",
        detail:
          "LibTaste does not yet have enough usable evidence. Please return later.",
        compare: false,
      },
      none: {
        title: "No recommendations returned",
        detail: "LibTaste has no recommendation results to show right now.",
      },
    },
  },
  leaderboards: {
    loadMore: "Load more",
    retryMore: "Retry loading more",
    scoringInfo: "How scoring works",
    rateLimited:
      "Leaderboard requests are temporarily rate limited. Wait for the API cooldown before trying again.",
    columns: {
      rank: "Rank",
      artwork: "Artwork",
      game: "Game",
      status: "Status",
      contributors: "Contributors",
      comparisons: "Comparisons",
      ownership: "Ownership",
      eligibility: "Eligibility",
      globalScore: "Global score",
      personalScore: "Personal score",
    },
    status: {
      provisional: "Provisional",
      provisionalMeaning:
        "the game does not yet have enough evidence for ranked status.",
      ranked: "Ranked",
      rankedMeaning:
        "the API has enough evidence to classify the game as ranked.",
    },
    global: {
      summary:
        "Browse the public contributed-games ranking in the API's server-provided order.",
      scoreSummary:
        "Global score summarizes contributor ratings; it is not comparable with personal score.",
      scoreHelp:
        "Global score is the API's capped precision-weighted mean across contributors. Personal and global scores have different meanings and must not be directly compared.",
      tableLabel: "Global game rankings",
      loading: "Loading global leaderboard…",
      loadingMore: "Loading more global rankings…",
      empty: "No games have entered the global leaderboard yet.",
      end: "End of global leaderboard",
      contributors: (count: number) =>
        `${count} ${count === 1 ? "contributor" : "contributors"}`,
    },
    personal: {
      eyebrow: "Your ordered library",
      summary:
        "Browse your personal game order using current ownership by default.",
      scoreSummary:
        "Personal score reflects your ranking; it is not comparable with global score.",
      scoreHelp:
        "Personal score is the API's conservative rating (mu minus three sigma). Personal and global scores have different meanings and must not be directly compared.",
      tableLabel: "Personal game rankings",
      includeHistorical: "Include historical games",
      loading: "Loading personal leaderboard…",
      loadingMore: "Loading more personal rankings…",
      empty: "No games are available in this personal leaderboard view.",
      end: "End of personal leaderboard",
      unscored: "Not yet scored",
      current: "Currently owned",
      historical: "Historical ownership",
      eligible: "Eligible",
      ineligible: "Not eligible",
      comparisons: (count: number) =>
        `${count} ${count === 1 ? "comparison" : "comparisons"}`,
    },
  },
  library: {
    eyebrow: "Steam collection",
    summary:
      "Browse imported games, review ownership and playtime, and choose which currently owned games can enter comparisons.",
    profileStatus: "Steam profile and library synchronization",
    synchronizationStatus: "Library synchronization status",
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
    noMatches: "No games match these filters.",
    filters: {
      name: "Game name",
      namePlaceholder: "Search imported games",
      effectiveEligibility: "Effective eligibility",
      eligibilityOverride: "Eligibility override",
      all: "All",
      eligible: "Eligible",
      notEligible: "Not eligible",
      clear: "Clear filters",
    },
    notSynchronized:
      "Your Steam library has not been synchronized yet. Request synchronization to import it.",
    privateTitle: "Steam game details are private or unavailable",
    privateDetail:
      "You remain signed in. Make Steam game details public, then synchronize again. LibTaste cannot change Steam privacy settings for you.",
    privacyGuidance: "Open Steam privacy guidance",
    steamLinkLabel: (name: string) =>
      `Open ${name} on Steam (opens in a new tab)`,
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
  settings: {
    eyebrow: "Account and session controls",
    summary:
      "Control this browser session, revoke every LibTaste session, or permanently delete your LibTaste account.",
    cancel: "Cancel",
    current: {
      title: "This device",
      detail:
        "End the LibTaste session in this browser. Other signed-in devices remain active.",
      action: "Log out this device",
      pending: "Logging out this device…",
    },
    all: {
      title: "Every device",
      detail:
        "Revoke all LibTaste sessions, including the session in this browser.",
      action: "Log out all devices",
      dialogTitle: "Log out all devices",
      confirmation:
        "This ends every current LibTaste session. You will need to sign in again on each device.",
      confirmAction: "Confirm log out all devices",
      pending: "Logging out all devices…",
    },
    deletion: {
      title: "Delete account",
      detail:
        "Permanently remove your LibTaste account and all data tied to your identity.",
      action: "Delete account",
      dialogTitle: "Permanently delete account",
      consequences:
        "This permanently removes your identity, profile, library, synchronization, sessions, comparisons, personal ratings, and current global contributions. Shared non-user-specific game catalog data remains.",
      steamBoundary:
        "Your Steam account is not deleted or modified. Deleted LibTaste data cannot be restored.",
      confirmationLabel: "Type DELETE to confirm",
      confirmAction: "Permanently delete account",
      pending: "Deleting your LibTaste account…",
    },
    uncertain: {
      authenticated:
        "The connection ended after submission, but your account still appears available. LibTaste did not automatically repeat the deletion. You may explicitly retry.",
      unknown:
        "The connection ended after submission and LibTaste could not verify the result. The deletion was not automatically repeated. Restore connectivity before explicitly retrying.",
    },
    messages: {
      loggedOutCurrent: "You have been logged out on this device.",
      loggedOutAll: "You have been logged out on every device.",
      deleted:
        "Your LibTaste account and user-specific data were deleted permanently.",
      deletionNotConfirmed:
        "Your session ended before account deletion could be confirmed.",
      deletionAppearsComplete:
        "Account deletion appears complete because your LibTaste session is no longer valid.",
    },
  },
  config: {
    title: "LibTaste is not configured",
    summary:
      "Required runtime settings are missing or invalid. Ask the site operator to check the web configuration.",
  },
} as const;
