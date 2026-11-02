window.GrapeGreenTokens = {
  firebaseProjectId: "app-iguess-39f2f",
  creditConfig: {
    startingCredits: 5,
    activeMinutesToEarnOne: 20,
    creditsPerActivePeriod: 1,
    themes: [
      { id: "gold", name: "Gold Theme", price: 50, category: "theme" },
      { id: "silver", name: "Silver Theme", price: 50, category: "theme" },
      { id: "shiny-green", name: "Shiny Green Theme", price: 30, category: "theme" },
      { id: "shiny-purple", name: "Shiny Purple Theme", price: 30, category: "theme" }
    ],
    subscriptions: [
      { id: "verified", name: "Verified", price: 20, interval: "mo" },
      { id: "plus", name: "Plus", price: 50, interval: "mo" },
      { id: "premium", name: "Premium", price: 80, interval: "mo" }
    ]
  },
  generateWalletId(username) {
    const base = (username || "user").toString().replace(/[^a-zA-Z0-9]/g, "").slice(0, 4) || "user";
    const nums = Array.from({ length: 3 }, () => String(Math.floor(Math.random() * 9000) + 1000));
    return `${base.toLowerCase()}-${nums.join("-")}`;
  }
};
