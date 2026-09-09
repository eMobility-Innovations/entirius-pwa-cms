const accesses = {
  builderTypes: [
    /* comes from backend*/
  ],
  routes: [
    {
      route: "/",
      label: "Home",
      access: ["admin", "moderator", "user"],
      app: ["pages", "pim", "points", "forms", "agreements", "accounts", "checkout", "emails", "faq", "translation", "promo"],
    },
    {
      route: "/pages/content",
      label: "List of content",
      access: ["admin", "moderator"],
      app: ["pages"],
    },
    {
      route: "/pages/gallery",
      label: "Gallery",
      access: ["admin", "moderator"],
      app: ["pages"],
    },
    {
      route: "/pages/doc",
      label: "Docs",
      access: ["admin", "moderator", "user"],
      app: ["pages"],
    },
    {
      route: "/accounts/customers",
      label: "Customers",
      access: ["admin"],
      app: ["accounts"],
    },
    {
      route: "/checkout-orders/orders",
      label: "Orders",
      access: ["admin"],
      app: ["checkout"],
    },
    {
      route: "/agreements/list",
      label: "Agreements",
      access: ["admin"],
      app: ["agreements"],
    },
    {
      route: "/agreements/consents",
      label: "Consent Log",
      access: ["admin"],
      app: ["agreements"],
    },
  ],
  apps: [
    {
      name: "Pages",
      idx: "pages",
      icon: "file-code",
      root: "/pages/content",
      labelKey: "panels.pages",
      descriptionKey: "panels.pages_desc",
      access: ["admin", "moderator"],
    },
    {
      name: "PIM",
      idx: "pim",
      icon: "boxes-stacked",
      root: "/pim/products",
      labelKey: "panels.pim",
      descriptionKey: "panels.pim_desc",
      access: ["admin", "moderator"],
    },
    {
      name: "Points",
      idx: "points",
      icon: "location-dot",
      root: "/points/list",
      labelKey: "panels.points",
      descriptionKey: "panels.points_desc",
      access: ["admin"],
    },
    {
      name: "Forms",
      idx: "forms",
      icon: "envelope",
      root: "/forms/list",
      labelKey: "panels.forms",
      descriptionKey: "panels.forms_desc",
      access: ["admin"],
    },
    {
      name: "Accounts",
      idx: "accounts",
      icon: "users",
      root: "/accounts/customers",
      labelKey: "panels.accounts",
      descriptionKey: "panels.accounts_desc",
      access: ["admin"],
    },
    {
      name: "Orders",
      idx: "checkout",
      icon: "shopping-cart",
      root: "/checkout-orders/orders",
      labelKey: "panels.checkout_orders",
      descriptionKey: "panels.checkout_orders_desc",
      access: ["admin"],
    },
    {
      name: "Agreements",
      idx: "agreements",
      icon: "file-contract",
      root: "/agreements/list",
      labelKey: "panels.agreements",
      descriptionKey: "panels.agreements_desc",
      access: ["admin"],
    },
    {
      name: "Emails",
      idx: "emails",
      icon: "at",
      root: "/emails",
      labelKey: "panels.emails",
      descriptionKey: "panels.emails_desc",
      access: ["admin"],
    },
    {
      name: "FAQ",
      idx: "faq",
      icon: "circle-question",
      root: "/faq/groups",
      labelKey: "panels.faq",
      descriptionKey: "panels.faq_desc",
      access: ["admin"],
    },
    {
      name: "Reviews",
      idx: "reviews",
      icon: "star",
      root: "/reviews/queue",
      labelKey: "panels.reviews",
      descriptionKey: "panels.reviews_desc",
      access: ["admin"],
    },
    {
      name: "Pricing",
      idx: "pricing",
      icon: "money-bill-wave",
      root: "/pricing/prices",
      labelKey: "panels.pricing",
      descriptionKey: "panels.pricing_desc",
      access: ["admin"],
    },
    {
      name: "Stock",
      idx: "stock",
      icon: "warehouse",
      root: "/stock/manage",
      labelKey: "panels.stock",
      descriptionKey: "panels.stock_desc",
      access: ["admin"],
    },
    {
      name: "Translation",
      idx: "translation",
      icon: "language",
      root: "/translation-jobs",
      labelKey: "panels.translation",
      descriptionKey: "panels.translation_desc",
      access: ["admin"],
    },
    {
      name: "Atlas",
      idx: "atlas",
      icon: "globe",
      root: "/atlas/list",
      labelKey: "panels.atlas",
      descriptionKey: "panels.atlas_desc",
      access: ["admin"],
    },
    {
      name: "Enricher",
      idx: "enricher",
      icon: "wand-magic-sparkles",
      root: "/enrichment",
      labelKey: "panels.enricher",
      descriptionKey: "panels.enricher_desc",
      access: ["admin"],
    },
    {
      name: "Promo",
      idx: "promo",
      icon: "tags",
      root: "/promo/list",
      labelKey: "panels.promo",
      descriptionKey: "panels.promo_desc",
      access: ["admin"],
    },
    {
      name: "PriceFighter",
      idx: "pricefighter",
      icon: "scale-balanced",
      root: "/pricefighter/gap",
      labelKey: "panels.pricefighter",
      descriptionKey: "panels.pricefighter_desc",
      access: ["admin"],
    },
  ],
};

const grantAccess = (obj, role = "user", builderTypes) => {
  const result = Object.fromEntries(
    Object.entries(obj).map(([key, val]) => {
      const accessibleValues = val.reduce((acc, values) => {
        const hasAccess = values.access.indexOf(role) > -1;
        delete values.access;
        return hasAccess ? [...acc, values] : acc;
      }, []);

      return [key, accessibleValues];
    })
  );
  const bt = builderTypes.map((type) => {
    return {
      label: type.label,
      v: type.slug,
    };
  });
  result.builderTypes = [...bt];

  return result;
};

export const panels = accesses.apps;

export const User = class {
  constructor({
    username = "namelessking",
    first_name = "",
    last_name = "",
    email = "",
    buildTypes = [],
  }) {
    this.username = username;
    this.first_name = first_name;
    this.last_name = last_name;
    this.email = email;
    this.buildTypes = buildTypes;
  }
};
