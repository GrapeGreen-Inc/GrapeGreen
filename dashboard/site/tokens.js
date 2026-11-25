window.GrapeGreenTokens = {
  firebaseProjectId: "app-iguess-39f2f",
  creditConfig: {
    startingCredits: 5,
    activeMinutesToEarnOne: 20,
    creditsPerActivePeriod: 1,

    themes: [
      {
        id: "silver-gold",
        name: "Silver & Gold Theme",
        price: 50,
        category: "theme"
      },
      {
        id: "shiny-green-purple",
        name: "Shiny Green & Purple Theme",
        price: 30,
        category: "theme"
      }
    ],

    subscriptions: [
      { id: "verified", name: "Verified", price: 30, interval: "week" },
      { id: "vip", name: "VIP", price: 50, interval: "week" },
      { id: "svip", name: "SVIP", price: 80, interval: "week" },
      { id: "mvp", name: "MVP", price: 100, interval: "week" }
    ]
  },

  generateWalletId(username) {
    const base = (username || "user")
      .toString()
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 4)
      .toLowerCase() || "user";

    const a = String(Math.floor(Math.random() * 9000) + 1000);
    const b = String(Math.floor(Math.random() * 9000) + 1000);
    const c = String(Math.floor(Math.random() * 9000) + 1000);

    return `${base}-${a}-${b}-${c}`;
  }
};
