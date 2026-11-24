export const landingCopy = {
  brand: {
    short: "FLC",
    academy: "Forough Mah Taban Academy",
  },
  header: {
    signIn: "Sign in",
  },
  scrollHint: "Scroll",
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
    body: "iPhone adds FLC from Safari. Android installs the FLC app.",
    iphone: {
      kicker: "iPhone",
      title: "Home screen app",
      body: "Add FLC from Safari for one-tap access, lock-screen playback, and a full-screen class.",
      cta: "Add to Home Screen",
      sheetTitle: "Add FLC on iPhone",
      steps: [
        "Open this page in Safari.",
        "Tap the Share button.",
        "Tap Add to Home Screen.",
        "Tap Add.",
      ],
    },
    android: {
      kicker: "Android",
      title: "FLC app",
      body: "Download the Android APK and install it for one-tap access and lock-screen playback.",
      cta: "Download Android APK",
    },
  },
} as const;
