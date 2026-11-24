export const landingCopy = {
  brand: {
    short: "FLC",
    academy: "Forough Mah Taban Academy",
  },
  header: {
    signIn: "Sign in",
  },
  scrollHint: "Scroll",
  sound: {
    mute: "Mute",
    unmute: "Unmute",
  },
  cta: {
    title: "Your class, always with you.",
    features: [
      {
        id: "sessions",
        title: "Sessions & Topics",
        description: "Browse class sessions and topics in a clear, calm structure.",
        icon: "bookOpen" as const,
      },
      {
        id: "listen",
        title: "Listen on repeat",
        description: "Queue lessons, loop tracks, and keep listening with the lock screen.",
        icon: "headphones" as const,
      },
      {
        id: "chat",
        title: "Class chat",
        description: "Stay in touch with teachers and classmates in one place.",
        icon: "messages" as const,
      },
    ],
    join: "Join your class",
    signIn: "Sign in",
    footer: "© Forough Mah Taban Academy",
  },
  installSection: {
    title: "Get FLC on your phone",
    body: "Add FLC to your Home Screen from Safari or Chrome, or install the Android app.",
    webApp: {
      kicker: "Safari & Chrome",
      title: "Home screen app",
      body: "Install FLC from your browser for one-tap access, lock-screen playback, and a full-screen class.",
      cta: "How to add",
      sheetTitle: "Add FLC to Home Screen",
      safari: {
        title: "Safari",
        steps: [
          "Open this page in Safari.",
          "Tap the Share button.",
          "Tap Add to Home Screen.",
          "Tap Add.",
        ],
      },
      chrome: {
        title: "Chrome",
        steps: [
          "Open this page in Chrome.",
          "Tap the menu (⋮).",
          "Tap Add to Home screen or Install app.",
          "Confirm Add / Install.",
        ],
      },
    },
    android: {
      kicker: "Android",
      title: "FLC app",
      body: "Download the Android APK and install it for one-tap access and lock-screen playback.",
      cta: "Download Android APK",
    },
  },
} as const;
