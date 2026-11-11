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
// 'clear')", and specs that never mention storage time out when a navigation guard reads it.
// On Node 26 that was 107 tests in 15 files.
//
// GUARDED, so a runtime that really does provide storage keeps its own implementation.
// It is installed on `globalThis` and on `window` because specs reach for both spellings.

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

export function installWebStorage(target) {
  for (const name of ["localStorage", "sessionStorage"]) {
    if (typeof target[name] !== "undefined" && target[name] !== null) continue;
    const storage = createMemoryStorage();
    Object.defineProperty(target, name, { value: storage, configurable: true, writable: true });
    if (typeof target.window !== "undefined") {
      Object.defineProperty(target.window, name, { value: storage, configurable: true, writable: true });
    }
  }
}
