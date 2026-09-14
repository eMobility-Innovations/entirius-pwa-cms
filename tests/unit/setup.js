import { config } from "@vue/test-utils";

// WEB STORAGE, WHEN THE RUNTIME DOES NOT PROVIDE IT.
//
// Node 22 added a built-in `localStorage` global that stays UNDEFINED unless the process is
// started with `--localstorage-file`:
//
//   (node:92728) ExperimentalWarning: localStorage is not available because
//   --localstorage-file was not provided.
//
// Because the global already exists as a property, happy-dom installs none of its own, so
// every spec that touches storage dies with "Cannot read properties of undefined (reading
// 'clear')" — and specs that never mention storage fail too, as a 5s timeout, when a
// navigation guard reads it and the navigation never resolves. Measured on Node v26.7.0:
// 12 of 344 tests, across stores/pimChannel, views/Pim/ProductListQuality,
// router/ssoRoutes and router/moduleGuard.
//
// GUARDED, so a runtime that really does provide storage keeps its own implementation and
// this file changes nothing there. It is installed on `globalThis` and on `window` because
// specs reach for both spellings.
function createMemoryStorage() {
  let store = new Map();
  return {
    get length() {
      return store.size;
    },
    key: (i) => Array.from(store.keys())[i] ?? null,
    getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => {
      store.set(String(k), String(v));
    },
    removeItem: (k) => {
      store.delete(String(k));
    },
    clear: () => {
      store = new Map();
    },
  };
}

for (const name of ["localStorage", "sessionStorage"]) {
  if (typeof globalThis[name] === "undefined" || globalThis[name] === null) {
    const storage = createMemoryStorage();
    Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true });
    if (typeof globalThis.window !== "undefined") {
      Object.defineProperty(globalThis.window, name, {
        value: storage,
        configurable: true,
        writable: true,
      });
    }
  }
}


// Simple i18n stubs reused by every test
const $t = (key, params = {}) => {
  if (!params || !Object.keys(params).length) return key;
  return `${key}::${JSON.stringify(params)}`;
};
const $tc = (key, count, params = {}) => $t(key, { count, ...(params || {}) });

config.global.mocks = {
  $t,
  $tc,
  $route: { params: {}, query: {}, hash: "", path: "/" },
  $router: { push: () => {}, replace: () => {} },
};

config.global.stubs = {
  FontAwesomeIcon: true,
  Loader: true,
  EmptyState: true,
  StatusBadge: true,
  FilterChip: true,
  Dropdown: true,
  BasicButton: true,
  BasicInput: true,
  TextAreaBasic: true,
  FormField: true,
};
