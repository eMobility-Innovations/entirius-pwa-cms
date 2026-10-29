import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";

const state = vi.hoisted(() => ({ matrixRead: false, upstreamRead: true, loads: vi.fn() }));
vi.mock("@/stores/accessMatrix", () => ({
  useAccessMatrixStore: () => ({ get canRead() { return state.matrixRead; }, ensureLoaded: state.loads }),
}));
vi.mock("@/stores/access", () => ({
  useAccessStore: () => ({ can: () => state.upstreamRead, canAny: () => state.upstreamRead }),
}));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ isPanelEnabled: () => true, isModuleEnabled: () => true }),
}));
vi.mock("@/stores/quality", () => ({ useQualityStore: () => ({ available: true }) }));
vi.mock("@/stores/enrichmentProfile", () => ({
  useEnrichmentProfileStore: () => ({ pendingSuggestions: 0 }),
}));
vi.mock("@/composables/useIsDesktop", () => ({ useIsDesktop: () => ({ value: true }) }));
vi.mock("vue-router", () => ({
  useRouter: () => ({ resolve: () => ({ meta: {} }) }),
  useRoute: () => ({ path: "/", meta: {} }),
}));

const wrappers = [];
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllEnvs();
  vi.resetModules();
});
beforeEach(() => {
  state.matrixRead = false;
  state.upstreamRead = true;
  state.loads.mockClear();
});

async function navigation(enabled) {
  vi.stubEnv("VUE_APP_ACCESS_PANEL_ENABLED", String(enabled));
  const { usePanels, useNavTree } = await import("@/composables/useNav");
  let panels, tree;
  wrappers.push(mount(defineComponent({
    setup() {
      panels = usePanels();
      tree = useNavTree();
      return () => h("div");
    },
  })));
  return { panels: panels.value, routes: tree.value.access.map((entry) => entry.route) };
}

describe("actual navigation composables with the organization matrix", () => {
  it("hides the panel without page:access even when upstream permits access", async () => {
    const nav = await navigation(true);
    expect(nav.panels.map((panel) => panel.idx)).not.toContain("access");
    expect(state.loads).toHaveBeenCalled();
  });

  it("offers the matrix routes to its holder independently of upstream grants", async () => {
    state.matrixRead = true;
    state.upstreamRead = false;
    const nav = await navigation(true);
    expect(nav.panels.map((panel) => panel.idx)).toContain("access");
    expect(nav.routes).toEqual(["/access/grants", "/access/audit", "/access/service-accounts"]);
    for (const dead of ["/access/staff", "/access/groups", "/access/applications"]) {
      expect(nav.routes).not.toContain(dead);
    }
  });

  it("retains upstream access navigation when the organization overlay is disabled", async () => {
    const nav = await navigation(false);
    expect(nav.panels.map((panel) => panel.idx)).toContain("access");
    expect(nav.routes).toEqual([
      "/access/roles", "/access/staff", "/access/groups", "/access/applications", "/access/audit",
    ]);
    expect(state.loads).not.toHaveBeenCalled();
  });
});
