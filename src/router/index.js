import { createRouter, createWebHistory } from "vue-router";

import { useUserStore } from "@/stores/user";
import { useMuninStore } from "@/stores/munin";
import { panels } from "@/configs/access";

import Home from "../views/Home/index.vue";
import rv_builds from "../views/Builder/index.vue";
import Builds from "../views/Builder/Builds.vue";
import Builder from "../views/Builder/Builder.vue";

const routes = [
  {
    path: "/",
    name: "Home",
    component: Home,
    meta: {
      requiresAuth: true,
      titleKey: "nav.home",
    },
  },
  {
    path: "/playground",
    name: "Playground",
    component: () =>
      import(/* webpackChunkName: "about" */ "../views/Playground.vue"),
    meta: {
      requiresAuth: true,
      titleKey: "nav.home",
      panel: "pages",
    },
  },
  {
    path: "/pages/gallery",
    name: "Gallery",
    component: () =>
      import(/* webpackChunkName: "about" */ "../views/Gallery.vue"),
    meta: {
      requiresAuth: true,
      titleKey: "nav.gallery",
      panel: "pages",
    },
  },
  {
    path: "/pages/content-sets",
    name: "ContentSets",
    component: () =>
      import(/* webpackChunkName: "about" */ "../views/ContentSets/index.vue"),
    meta: {
      requiresAuth: true,
      titleKey: "nav.content_sets",
      panel: "pages",
    },
  },
  {
    path: "/pages/doc",
    name: "Doc",
    component: () =>
      import(/* webpackChunkName: "about" */ "../views/Docs/index.vue"),
    meta: {
      requiresAuth: true,
      titleKey: "nav.docs",
      panel: "pages",
    },
  },
  // Authors (must be before /pages/:content_type wildcard)
  {
    path: "/pages/authors",
    component: () => import("../views/Authors/index.vue"),
    meta: { requiresAuth: true, panel: "pages" },
    children: [
      {
        path: "",
        name: "AuthorList",
        component: () => import("../views/Authors/AuthorList.vue"),
        meta: { requiresAuth: true, titleKey: "authors.title", panel: "pages" },
      },
      {
        path: "create",
        name: "AuthorCreate",
        component: () => import("../views/Authors/AuthorEdit.vue"),
        meta: { requiresAuth: true, titleKey: "authors.create", panel: "pages" },
      },
      {
        path: ":uid",
        name: "AuthorDetail",
        component: () => import("../views/Authors/AuthorEdit.vue"),
        meta: { requiresAuth: true, titleKey: "authors.edit", panel: "pages" },
      },
    ],
  },

  // Layout Extenders (must be before /pages/:content_type wildcard)
  {
    path: "/pages/layout-extender",
    component: () => import("../views/LayoutExtenders/index.vue"),
    meta: { requiresAuth: true, panel: "pages" },
    children: [
      {
        path: "",
        name: "LayoutExtenders",
        component: () => import("../views/LayoutExtenders/LayoutExtenderList.vue"),
        meta: { requiresAuth: true, titleKey: "layout_extender.list_title", panel: "pages" },
      },
      {
        path: ":type/:uid?",
        name: "NavigationEditor",
        component: () => import("../views/LayoutExtenders/NavigationEditor.vue"),
        meta: { requiresAuth: true, titleKey: "layout_extender.title", panel: "pages" },
      },
    ],
  },

  {
    path: "/pages/:content_type",
    component: rv_builds,
    meta: {
      panel: "pages",
    },
    children: [
      {
        path: "",
        name: "Builds",
        component: Builds,
        params: true,
        meta: {
          requiresAuth: true,
          titleKey: "nav.content_list",
          panel: "pages",
        },
      },
      {
        path: ":type/:uid?",
        name: "Builder",
        component: Builder,
        params: true,
        meta: {
          requiresAuth: true,
          titleKey: "nav.content_list",
          panel: "pages",
        },
      },
    ],
  },

  // PIM panel
  {
    path: "/pim",
    component: () =>
      import(/* webpackChunkName: "pim" */ "../views/Pim/index.vue"),
    meta: {
      requiresAuth: true,
      panel: "pim",
    },
    children: [
      {
        path: "",
        redirect: "/pim/products",
      },
      {
        path: "products",
        name: "PimProducts",
        component: () =>
          import(/* webpackChunkName: "pim" */ "../views/Pim/ProductList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "pim.products",
          panel: "pim",
        },
      },
      {
        path: "products/create",
        name: "PimProductCreate",
        component: () =>
          import(/* webpackChunkName: "pim" */ "../views/Pim/ProductCreate.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "pim.create_product",
          panel: "pim",
        },
      },
      {
        path: "products/:sku(.*)",
        name: "PimProductDetail",
        component: () =>
          import(/* webpackChunkName: "pim" */ "../views/Pim/ProductDetail.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "pim.product_detail",
          panel: "pim",
        },
      },
      {
        path: "categories",
        name: "PimCategories",
        component: () =>
          import(/* webpackChunkName: "pim" */ "../views/Pim/CategoryList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "pim.categories",
          panel: "pim",
        },
      },
      {
        path: "categories/create",
        name: "PimCategoryCreate",
        component: () =>
          import(/* webpackChunkName: "pim" */ "../views/Pim/CategoryCreate.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "pim.create_category",
          panel: "pim",
        },
      },
      {
        path: "categories/:idx",
        name: "PimCategoryDetail",
        component: () =>
          import(/* webpackChunkName: "pim" */ "../views/Pim/CategoryDetail.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "pim.category_detail",
          panel: "pim",
        },
      },
      {
        path: "feature-sets",
        name: "PimFeatureSets",
        component: () =>
          import(/* webpackChunkName: "pim" */ "../views/Pim/FeatureSetList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "pim.feature_sets",
          panel: "pim",
        },
      },
      {
        path: "feature-sets/:idx",
        name: "PimFeatureSetDetail",
        component: () =>
          import(/* webpackChunkName: "pim" */ "../views/Pim/FeatureSetEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "pim.feature_set_detail",
          panel: "pim",
        },
      },
      {
        path: "features",
        name: "PimFeatures",
        component: () =>
          import(/* webpackChunkName: "pim" */ "../views/Pim/FeatureList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "pim.features",
          panel: "pim",
        },
      },
      // Quality rules (etap-06) — soft-compat: the views self-guard when the backend
      // lacks the gaps API (404 → redirect to products).
      {
        path: "gap-definitions",
        name: "PimGapDefinitions",
        component: () =>
          import(/* webpackChunkName: "pim" */ "../views/Pim/GapDefinitionList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "pim.gap_definitions",
          panel: "pim",
        },
      },
      {
        path: "gap-definitions/create",
        name: "PimGapDefinitionCreate",
        component: () =>
          import(/* webpackChunkName: "pim" */ "../views/Pim/GapDefinitionEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "pim.create_gap_definition",
          panel: "pim",
        },
      },
      {
        path: "gap-definitions/:key",
        name: "PimGapDefinitionDetail",
        component: () =>
          import(/* webpackChunkName: "pim" */ "../views/Pim/GapDefinitionEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "pim.gap_definition_detail",
          panel: "pim",
        },
      },
      {
        path: "features/:idx",
        name: "PimFeatureDetail",
        component: () =>
          import(/* webpackChunkName: "pim" */ "../views/Pim/FeatureEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "pim.feature_detail",
          panel: "pim",
        },
      },
    ],
  },

  // Points panel
  {
    path: "/points",
    component: () =>
      import(/* webpackChunkName: "points" */ "../views/Points/index.vue"),
    meta: {
      requiresAuth: true,
      panel: "points",
    },
    children: [
      {
        path: "",
        redirect: "/points/list",
      },
      {
        path: "list",
        name: "PointsList",
        component: () =>
          import(/* webpackChunkName: "points" */ "../views/Points/PointList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "dp.points",
          panel: "points",
        },
      },
      {
        path: "create",
        name: "PointCreate",
        component: () =>
          import(/* webpackChunkName: "points" */ "../views/Points/PointEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "dp.create_point",
          panel: "points",
        },
      },
      {
        path: "types",
        name: "PointTypes",
        component: () =>
          import(/* webpackChunkName: "points" */ "../views/Points/TypeList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "dp.types",
          panel: "points",
        },
      },
      // Import disabled — use manage.py import_deliverypoints instead
      // {
      //   path: "import",
      //   name: "PointImport",
      //   component: () =>
      //     import(/* webpackChunkName: "points" */ "../views/Points/ImportDialog.vue"),
      //   meta: {
      //     requiresAuth: true,
      //     titleKey: "dp.import",
      //     panel: "points",
      //   },
      // },
      {
        path: ":id",
        name: "PointDetail",
        component: () =>
          import(/* webpackChunkName: "points" */ "../views/Points/PointEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "dp.point_detail",
          panel: "points",
        },
      },
    ],
  },

  // Contact Forms panel
  {
    path: "/forms",
    component: () =>
      import(/* webpackChunkName: "forms" */ "../views/ContactForms/index.vue"),
    meta: {
      requiresAuth: true,
      panel: "forms",
    },
    children: [
      {
        path: "",
        redirect: "/forms/list",
      },
      {
        path: "list",
        name: "ContactFormList",
        component: () =>
          import(/* webpackChunkName: "forms" */ "../views/ContactForms/ContactFormList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "cf.submissions",
          panel: "forms",
        },
      },
      {
        path: "bookings",
        name: "BookingList",
        component: () =>
          import(/* webpackChunkName: "forms" */ "../views/ContactForms/BookingList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "cf.bookings",
          panel: "forms",
        },
      },
      {
        path: "bookings/:id",
        name: "BookingDetail",
        component: () =>
          import(/* webpackChunkName: "forms" */ "../views/ContactForms/BookingDetail.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "cf.booking_detail",
          panel: "forms",
        },
      },
      {
        path: "leads",
        name: "LeadList",
        component: () =>
          import(/* webpackChunkName: "forms" */ "../views/ContactForms/LeadList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "cf.leads",
          panel: "forms",
        },
      },
      {
        path: "leads/:id",
        name: "LeadDetail",
        component: () =>
          import(/* webpackChunkName: "forms" */ "../views/ContactForms/LeadDetail.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "cf.lead_detail",
          panel: "forms",
        },
      },
      {
        path: ":id",
        name: "ContactFormDetail",
        component: () =>
          import(/* webpackChunkName: "forms" */ "../views/ContactForms/ContactFormDetail.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "cf.submission_detail",
          panel: "forms",
        },
      },
    ],
  },

  // Agreements panel
  {
    path: "/agreements",
    component: () =>
      import(/* webpackChunkName: "agreements" */ "../views/Agreements/index.vue"),
    meta: {
      requiresAuth: true,
      panel: "agreements",
    },
    children: [
      {
        path: "",
        redirect: "/agreements/list",
      },
      {
        path: "list",
        name: "AgreementList",
        component: () =>
          import(/* webpackChunkName: "agreements" */ "../views/Agreements/AgreementList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "agm.definitions",
          panel: "agreements",
        },
      },
      {
        path: "create",
        name: "AgreementCreate",
        component: () =>
          import(/* webpackChunkName: "agreements" */ "../views/Agreements/AgreementEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "agm.create_definition",
          panel: "agreements",
        },
      },
      {
        path: "consents",
        name: "ConsentPeople",
        component: () =>
          import(/* webpackChunkName: "agreements" */ "../views/Agreements/ConsentPeople.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "agm.people_list",
          panel: "agreements",
        },
      },
      {
        path: "consents/:email",
        name: "ConsentPersonDetail",
        component: () =>
          import(/* webpackChunkName: "agreements" */ "../views/Agreements/ConsentPersonDetail.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "agm.person_detail",
          panel: "agreements",
        },
      },
      {
        path: ":slug",
        name: "AgreementDetail",
        component: () =>
          import(/* webpackChunkName: "agreements" */ "../views/Agreements/AgreementEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "agm.definition_detail",
          panel: "agreements",
        },
      },
    ],
  },

  // Accounts panel
  {
    path: "/accounts",
    component: () =>
      import(/* webpackChunkName: "accounts" */ "../views/Accounts/index.vue"),
    meta: {
      requiresAuth: true,
      panel: "accounts",
    },
    children: [
      {
        path: "",
        redirect: "/accounts/customers",
      },
      {
        path: "customers",
        name: "CustomerList",
        component: () =>
          import(/* webpackChunkName: "accounts" */ "../views/Accounts/CustomerList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "accounts.customers",
          panel: "accounts",
        },
      },
      {
        path: "customers/:uid",
        name: "CustomerDetail",
        component: () =>
          import(/* webpackChunkName: "accounts" */ "../views/Accounts/CustomerDetail.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "accounts.customer_detail",
          panel: "accounts",
        },
      },
    ],
  },

  // Checkout Orders panel
  {
    path: "/checkout-orders",
    component: () =>
      import(/* webpackChunkName: "checkout-orders" */ "../views/CheckoutOrders/index.vue"),
    meta: {
      requiresAuth: true,
      panel: "checkout",
    },
    children: [
      {
        path: "",
        redirect: "/checkout-orders/orders",
      },
      {
        path: "orders",
        name: "OrderList",
        component: () =>
          import(/* webpackChunkName: "checkout-orders" */ "../views/CheckoutOrders/OrderList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "checkout_orders.orders",
          panel: "checkout",
        },
      },
      {
        path: "orders/:uid",
        name: "OrderDetail",
        component: () =>
          import(/* webpackChunkName: "checkout-orders" */ "../views/CheckoutOrders/OrderDetail.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "checkout_orders.order_detail",
          panel: "checkout",
        },
      },
    ],
  },

  // Emails panel
  {
    path: "/emails",
    component: () =>
      import(/* webpackChunkName: "emails" */ "../views/Emails/index.vue"),
    meta: {
      requiresAuth: true,
      panel: "emails",
    },
    children: [
      {
        path: "",
        name: "EmailsDashboard",
        component: () =>
          import(/* webpackChunkName: "emails" */ "../views/Emails/EmailsDashboard.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "emails.dashboard",
          panel: "emails",
        },
      },
      {
        path: "channels/:channelPk",
        name: "EmailChannelEdit",
        component: () =>
          import(/* webpackChunkName: "emails" */ "../views/Emails/EmailChannelEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "emails.channel",
          panel: "emails",
        },
      },
      {
        path: "lang-configs/:pk",
        name: "EmailLangConfigEdit",
        component: () =>
          import(/* webpackChunkName: "emails" */ "../views/Emails/EmailLangConfigEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "emails.lang_config",
          panel: "emails",
        },
      },
      {
        path: "templates/:emailType",
        name: "EmailTemplateList",
        component: () =>
          import(/* webpackChunkName: "emails" */ "../views/Emails/EmailTemplateList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "emails.template_types",
          panel: "emails",
        },
      },
      {
        path: "templates/:emailType/:pk",
        name: "EmailTemplateEdit",
        component: () =>
          import(/* webpackChunkName: "emails" */ "../views/Emails/EmailTemplateEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "emails.edit_template",
          panel: "emails",
        },
      },
    ],
  },

  // FAQ panel
  {
    path: "/reviews",
    component: () =>
      import(/* webpackChunkName: "reviews" */ "../views/Reviews/index.vue"),
    meta: {
      requiresAuth: true,
      panel: "reviews",
    },
    children: [
      {
        path: "",
        redirect: "/reviews/queue",
      },
      {
        path: "queue",
        name: "ReviewsQueue",
        component: () =>
          import(/* webpackChunkName: "reviews" */ "../views/Reviews/ReviewQueue.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "reviews.queue",
          panel: "reviews",
        },
      },
      {
        path: "products",
        name: "ReviewsProducts",
        component: () =>
          import(/* webpackChunkName: "reviews" */ "../views/Reviews/ReviewProducts.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "reviews.products",
          panel: "reviews",
        },
      },
      {
        path: ":id",
        name: "ReviewDetail",
        component: () =>
          import(/* webpackChunkName: "reviews" */ "../views/Reviews/ReviewDetail.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "reviews.detail",
          panel: "reviews",
        },
      },
    ],
  },
  {
    path: "/faq",
    component: () =>
      import(/* webpackChunkName: "faq" */ "../views/Faq/index.vue"),
    meta: {
      requiresAuth: true,
      panel: "faq",
    },
    children: [
      {
        path: "",
        redirect: "/faq/groups",
      },
      {
        path: "groups",
        name: "FaqGroups",
        component: () =>
          import(/* webpackChunkName: "faq" */ "../views/Faq/GroupList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "faq.groups",
          panel: "faq",
        },
      },
      {
        path: "groups/create",
        name: "FaqGroupCreate",
        component: () =>
          import(/* webpackChunkName: "faq" */ "../views/Faq/GroupEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "faq.create_group",
          panel: "faq",
        },
      },
      {
        path: "groups/:id",
        name: "FaqGroupDetail",
        component: () =>
          import(/* webpackChunkName: "faq" */ "../views/Faq/GroupEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "faq.group_detail",
          panel: "faq",
        },
      },
      {
        path: "items",
        name: "FaqItems",
        component: () =>
          import(/* webpackChunkName: "faq" */ "../views/Faq/ItemList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "faq.items",
          panel: "faq",
        },
      },
      {
        path: "items/create",
        name: "FaqItemCreate",
        component: () =>
          import(/* webpackChunkName: "faq" */ "../views/Faq/ItemEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "faq.create_item",
          panel: "faq",
        },
      },
      {
        path: "items/:id",
        name: "FaqItemDetail",
        component: () =>
          import(/* webpackChunkName: "faq" */ "../views/Faq/ItemEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "faq.item_detail",
          panel: "faq",
        },
      },
    ],
  },

  // Pricing panel
  {
    path: "/pricing",
    component: () => import(/* webpackChunkName: "pricing" */ "../views/PriceManager/index.vue"),
    meta: { requiresAuth: true, panel: "pricing" },
    children: [
      { path: "", redirect: "/pricing/prices" },
      {
        path: "prices",
        name: "PmPriceList",
        component: () => import(/* webpackChunkName: "pricing" */ "../views/PriceManager/PriceList.vue"),
        meta: { requiresAuth: true, titleKey: "pm.prices", panel: "pricing" },
      },
      {
        path: "prices/:sku",
        name: "PmPriceDetail",
        component: () => import(/* webpackChunkName: "pricing" */ "../views/PriceManager/PriceDetail.vue"),
        meta: { requiresAuth: true, titleKey: "pm.price_detail", panel: "pricing" },
      },
      {
        path: "tax-classes",
        name: "PmTaxClassList",
        component: () => import(/* webpackChunkName: "pricing" */ "../views/PriceManager/TaxClassList.vue"),
        meta: { requiresAuth: true, titleKey: "pm.tax_classes", panel: "pricing" },
      },
      {
        path: "tax-classes/create",
        name: "PmTaxClassCreate",
        component: () => import(/* webpackChunkName: "pricing" */ "../views/PriceManager/TaxClassDetail.vue"),
        meta: { requiresAuth: true, titleKey: "pm.create_tax_class", panel: "pricing" },
      },
      {
        path: "tax-classes/:idx",
        name: "PmTaxClassDetail",
        component: () => import(/* webpackChunkName: "pricing" */ "../views/PriceManager/TaxClassDetail.vue"),
        meta: { requiresAuth: true, titleKey: "pm.tax_class_detail", panel: "pricing" },
      },
      {
        path: "channels",
        name: "PmChannelList",
        component: () => import(/* webpackChunkName: "pricing" */ "../views/PriceManager/ChannelList.vue"),
        meta: { requiresAuth: true, titleKey: "pm.channels", panel: "pricing" },
      },
      {
        path: "channels/create",
        name: "PmChannelCreate",
        component: () => import(/* webpackChunkName: "pricing" */ "../views/PriceManager/ChannelDetail.vue"),
        meta: { requiresAuth: true, titleKey: "pm.create_channel", panel: "pricing" },
      },
      {
        path: "channels/:idx",
        name: "PmChannelDetail",
        component: () => import(/* webpackChunkName: "pricing" */ "../views/PriceManager/ChannelDetail.vue"),
        meta: { requiresAuth: true, titleKey: "pm.channel_detail", panel: "pricing" },
      },
    ],
  },

  // PriceFighter panel
  {
    path: "/pricefighter",
    component: () => import(/* webpackChunkName: "pricefighter" */ "../views/PriceFighter/index.vue"),
    meta: { requiresAuth: true, panel: "pricefighter" },
    children: [
      { path: "", redirect: "/pricefighter/gap" },
      {
        path: "gap",
        name: "PfGapTable",
        component: () => import(/* webpackChunkName: "pricefighter" */ "../views/PriceFighter/GapTable.vue"),
        meta: { requiresAuth: true, titleKey: "pricefighter.gap_table", panel: "pricefighter" },
      },
      {
        path: "strategies",
        name: "PfStrategies",
        component: () => import(/* webpackChunkName: "pricefighter" */ "../views/PriceFighter/Strategies.vue"),
        meta: { requiresAuth: true, titleKey: "pricefighter.strategies", panel: "pricefighter" },
      },
      {
        path: "history",
        name: "PfDecisionHistory",
        component: () => import(/* webpackChunkName: "pricefighter" */ "../views/PriceFighter/DecisionHistory.vue"),
        meta: { requiresAuth: true, titleKey: "pricefighter.history", panel: "pricefighter" },
      },
    ],
  },

  // Atlas panel (formerly Suppliers — django-atlas replaces django-suppliers)
  {
    path: "/atlas",
    component: () =>
      import(/* webpackChunkName: "atlas" */ "../views/Atlas/index.vue"),
    meta: {
      requiresAuth: true,
      panel: "atlas",
    },
    children: [
      {
        path: "",
        redirect: "/atlas/list",
      },
      {
        path: "list",
        name: "SourceList",
        component: () =>
          import(/* webpackChunkName: "atlas" */ "../views/Atlas/SourceList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "atlas.list_title",
          panel: "atlas",
        },
      },
      {
        // Cross-source dashboard (RealProducts with auto-EAN link history)
        path: "auto-matched",
        name: "SuppliersAutoMatched",
        component: () =>
          import(/* webpackChunkName: "atlas" */ "../views/Atlas/AutoMatched.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "atlas.auto_matched.title",
          panel: "atlas",
        },
      },
      {
        // Operator triage UI for find_duplicates_by_ean groups
        path: "duplicates",
        name: "SuppliersDuplicates",
        component: () =>
          import(/* webpackChunkName: "atlas" */ "../views/Atlas/Duplicates.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "atlas.duplicates.title",
          panel: "atlas",
        },
      },
      {
        // Cross-source review queue — folded in from the former standalone Supplier Review panel
        path: "review",
        name: "SupplierReview",
        component: () =>
          import(/* webpackChunkName: "atlas" */ "../views/Atlas/Review/SupplierReview.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "atlas.review.title",
          panel: "atlas",
        },
      },
      {
        // Single-box text/image search across PIM + atlas fingerprints
        path: "find",
        name: "AtlasFind",
        component: () =>
          import(/* webpackChunkName: "atlas" */ "../views/Atlas/Find.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "lookup.find.title",
          panel: "atlas",
          // Optional django-lookup backend module — the view calls its
          // search/check API and must stay dormant without it.
          module: "lookup",
        },
      },
      {
        path: ":idx",
        name: "SourceDetail",
        component: () =>
          import(/* webpackChunkName: "atlas" */ "../views/Atlas/SourceDetail.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "atlas.detail_title",
          panel: "atlas",
        },
      },
    ],
  },

  // Legacy redirect: Supplier Review was folded into the Suppliers/Atlas panel.
  // Function form preserves query params (e.g. ?mode=, ?sp_id=) across the redirect.
  {
    path: "/supplier-review",
    redirect: (to) => ({ path: "/atlas/review", query: to.query }),
  },

  // Legacy redirect: Suppliers panel was renamed to Atlas (django-suppliers -> django-atlas).
  // Function form preserves the sub-path and query params (e.g. /suppliers/list -> /atlas/list).
  {
    path: "/suppliers/:pathMatch(.*)*",
    redirect: (to) => ({
      path: `/atlas/${to.params.pathMatch.join("/")}`,
      query: to.query,
    }),
  },

  // Enrichment review panel (etap-06 / etap-06b)
  {
    path: "/enrichment",
    name: "EnrichmentReview",
    component: () =>
      import(/* webpackChunkName: "enrichment" */ "../views/EnrichmentReview/index.vue"),
    meta: {
      requiresAuth: true,
      titleKey: "enrichment.review.title",
      panel: "enricher",
    },
  },

  // Enrichment spawn rules (etap-13)
  {
    path: "/enrichment/spawn-rules",
    name: "EnrichmentSpawnRules",
    component: () =>
      import(/* webpackChunkName: "enrichment" */ "../views/EnrichmentSpawnRules/SpawnRuleList.vue"),
    meta: {
      requiresAuth: true,
      titleKey: "enrichment.spawn_rules.title",
      panel: "enricher",
    },
  },
  {
    path: "/enrichment/spawn-rules/new",
    name: "EnrichmentSpawnRuleCreate",
    component: () =>
      import(/* webpackChunkName: "enrichment" */ "../views/EnrichmentSpawnRules/SpawnRuleEdit.vue"),
    meta: {
      requiresAuth: true,
      titleKey: "enrichment.spawn_rules.create",
      panel: "enricher",
    },
  },
  {
    path: "/enrichment/spawn-rules/:key",
    name: "EnrichmentSpawnRuleEdit",
    component: () =>
      import(/* webpackChunkName: "enrichment" */ "../views/EnrichmentSpawnRules/SpawnRuleEdit.vue"),
    meta: {
      requiresAuth: true,
      titleKey: "enrichment.spawn_rules.title",
      panel: "enricher",
    },
  },

  // Enrichment tasks (read-only queue view)
  {
    path: "/enrichment/tasks",
    name: "EnrichmentTasks",
    component: () =>
      import(/* webpackChunkName: "enrichment" */ "../views/EnrichmentTasks/TaskList.vue"),
    meta: {
      requiresAuth: true,
      titleKey: "enrichment.tasks.title",
      panel: "enricher",
    },
  },

  // Translation Jobs
  {
    path: "/translation-jobs",
    component: () =>
      import(/* webpackChunkName: "translation" */ "../views/TranslationDashboard/index.vue"),
    meta: {
      requiresAuth: true,
      panel: "translation",
    },
    children: [
      {
        path: "",
        name: "TranslationDashboard",
        component: () =>
          import(/* webpackChunkName: "translation" */ "../views/TranslationDashboard/Dashboard.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "translation.jobs",
          panel: "translation",
        },
      },
    ],
  },

  // Promo panel
  {
    path: "/promo",
    component: () =>
      import(/* webpackChunkName: "promo" */ "../views/Promo/index.vue"),
    meta: {
      requiresAuth: true,
      panel: "promo",
    },
    children: [
      {
        path: "",
        redirect: "/promo/list",
      },
      {
        path: "list",
        name: "PromoList",
        component: () =>
          import(/* webpackChunkName: "promo" */ "../views/Promo/PromoList.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "nav.promo_list",
          panel: "promo",
        },
      },
      {
        path: "create",
        name: "PromoCreate",
        component: () =>
          import(/* webpackChunkName: "promo" */ "../views/Promo/PromoEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "nav.promo_list",
          panel: "promo",
        },
      },
      {
        path: "voucher/:pk",
        name: "VoucherDetail",
        component: () =>
          import(/* webpackChunkName: "promo" */ "../views/Promo/VoucherDetail.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "nav.promo_list",
          panel: "promo",
          // The view fetches /api/checkout-voucher/* on mount — without the
          // module the route must not resolve even when the panel is enabled.
          module: "checkout_voucher",
        },
      },
      {
        path: ":id",
        name: "PromoDetail",
        component: () =>
          import(/* webpackChunkName: "promo" */ "../views/Promo/PromoEdit.vue"),
        meta: {
          requiresAuth: true,
          titleKey: "nav.promo_list",
          panel: "promo",
        },
      },
    ],
  },

  // Stock Management
  {
    path: "/stock",
    component: () => import(/* webpackChunkName: "stock" */ "../views/Stock/index.vue"),
    meta: { requiresAuth: true, panel: "stock" },
    children: [
      { path: "", redirect: "/stock/manage" },
      {
        path: "manage",
        name: "StockManage",
        component: () => import(/* webpackChunkName: "stock" */ "../views/Stock/WarehouseStockTable.vue"),
        meta: { requiresAuth: true, titleKey: "stock.manage", panel: "stock" },
      },
    ],
  },

  // Change password (authenticated)
  {
    path: "/change-password",
    name: "ChangePassword",
    component: () =>
      import(/* webpackChunkName: "auth" */ "../views/ChangePassword/ChangePassword.vue"),
    meta: {
      requiresAuth: true,
      fullscreen: true,
    },
  },

  // Password reset (from email link — no auth required)
  {
    path: "/password-reset",
    name: "PasswordReset",
    component: () =>
      import(/* webpackChunkName: "auth" */ "../views/PasswordReset/PasswordReset.vue"),
    meta: {
      requiresAuth: false,
    },
  },

  // Redirects for old paths
  { path: "/gallery", redirect: "/pages/gallery" },
  { path: "/content-sets", redirect: "/pages/content-sets" },
  { path: "/doc", redirect: "/pages/doc" },
  { path: "/docs", redirect: "/pages/doc" },
  { path: "/content", redirect: "/pages/content" },
  { path: "/layout-extender", redirect: "/pages/layout-extender" },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

router.beforeEach(async (to, from, next) => {
  // Allow unauthenticated routes (password reset)
  if (to.meta?.requiresAuth === false) {
    next();
    return;
  }

  const panel = to.meta?.panel;
  if (panel) {
    const munin = useMuninStore();
    const userStore = useUserStore();

    // Wait for Munin data if user is authenticated but modules not yet loaded
    if (userStore.isAuth && !munin.loaded) {
      await munin.ensureLoaded();
    }

    if (!munin.isPanelEnabled(panel)) {
      next('/');
      return;
    }
    // Routes tied to an optional backend module (meta.module) stay dormant
    // when the module is absent, even if their panel is enabled.
    const module = to.meta?.module;
    if (module && !munin.isModuleEnabled(module)) {
      next(panels.find((p) => p.idx === panel)?.root || "/");
      return;
    }
    userStore.activeApp = panel;
  }
  next();
});

export default router;
