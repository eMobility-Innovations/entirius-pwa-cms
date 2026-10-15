import { config } from "@vue/test-utils";
import { ICONS } from "@/boots/Icons/icons";
import PageLayout from "@/boots/PageLayout/index.vue";

// Simple i18n stubs reused by every test
const $t = (key, params = {}) => {
  if (!params || !Object.keys(params).length) return key;
  return `${key}::${JSON.stringify(params)}`;
};
const $tc = (key, count, params = {}) => $t(key, { count, ...(params || {}) });

config.global.mocks = {
  $t,
  $tc,
  $icons: ICONS,
  $route: { params: {}, query: {}, hash: "", path: "/" },
  $router: { push: () => {}, replace: () => {} },
};

// The page frame of every view (plan 25): real, so the views' header, toolbar and content slots render.
config.global.components = { PageLayout };

config.global.stubs = {
  FontAwesomeIcon: true,
  Loader: true,
  EmptyState: true,
  StatusBadge: true,
  FilterChip: true,
  BasicButton: true,
  BasicInput: true,
  FormField: true,
  // A page's route tabs need the router and the access store; RouteTabs.spec mounts the real one.
  RouteTabs: true,
};
