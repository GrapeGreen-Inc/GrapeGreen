(() => {
  "use strict";

  const config = window.GrapeGreenTokens?.creditConfig;

  if (!config) {
    console.error("GrapeGreen shop: token catalogue was not loaded.");
    return;
  }

  function createCard(item, type) {
    const card = document.createElement("article");
    card.className = "gg-shop-card";

    const title = document.createElement("h3");
    title.textContent = item.name;

    const price = document.createElement("p");
    price.className = "gg-shop-price";
    price.textContent = type === "subscription"
      ? `${item.price} tokens per week`
      : `${item.price} tokens`;

    const status = document.createElement("p");
    status.className = "gg-shop-status";
    status.textContent = "Purchases coming soon";

    card.append(title, price, status);

    return card;
  }

  function render(items, targetId, type) {
    const container = document.getElementById(targetId);

    if (!container) return;

    container.replaceChildren();

    items.forEach(item => {
      container.appendChild(createCard(item, type));
    });
  }

  render(config.subscriptions || [], "gg-subscriptions-list", "subscription");
  render(config.themes || [], "gg-products-list", "product");
})();
