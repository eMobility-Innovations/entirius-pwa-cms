import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// The flag is read at MODULE LOAD time (it builds a Set at import), so the module has to
// be re-imported after the variable changes — the pattern tests/unit/stores/pimChannel.spec.js uses.
const originalFlag = process.env.VUE_APP_ACCESS_PANEL_ENABLED;
const originalPanels = process.env.VUE_APP_PANELS;

describe("the access panel enables itself", () => {
  beforeEach(() => {
    vi.resetModules();
    setActivePinia(createPinia());
    // A REAL host's list, measured on pim-test. Note `access` is not in it and never will
    // be: nobody adds a panel to this variable for a feature that has its own flag.
    process.env.VUE_APP_PANELS = "pages,pim,stock,pricing,suppliers,emails,enricher";
  });

  afterEach(() => {
    process.env.VUE_APP_ACCESS_PANEL_ENABLED = originalFlag;
    process.env.VUE_APP_PANELS = originalPanels;
  });

  it("is hidden when its flag is off, like every other panel nobody asked for", async () => {
    delete process.env.VUE_APP_ACCESS_PANEL_ENABLED;
    const { useMuninStore } = await import("@/stores/munin");

    expect(useMuninStore().isPanelEnabled("access")).toBe(false);
  });

  it("is enabled by its OWN flag, with no second variable to remember", async () => {
    // THE DEFECT THIS PINS: without it the flag gives you the routes, the bundle and the
    // API, and then HeaderControls filters the entry out because `access` is absent from
    // VUE_APP_PANELS while VUE_APP_HIDE_DISABLED_PANELS defaults to true — a panel that is
    // switched on, built, reachable by URL, and invisible.
    process.env.VUE_APP_ACCESS_PANEL_ENABLED = "true";
    const { useMuninStore } = await import("@/stores/munin");

    expect(useMuninStore().isPanelEnabled("access")).toBe(true);
  });

  it("does not disturb the panels the host did list", async () => {
    process.env.VUE_APP_ACCESS_PANEL_ENABLED = "true";
    const { useMuninStore } = await import("@/stores/munin");
    const store = useMuninStore();

    expect(store.isPanelEnabled("pim")).toBe(true);
    expect(store.isPanelEnabled("faq")).toBe(false);
  });
});
