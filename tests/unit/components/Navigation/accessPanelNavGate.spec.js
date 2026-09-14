/**
 * The Access entry is drawn for exactly the people the matrix grants `page:access`.
 *
 * FOUND BY DEPLOYING, NOT BY TESTING. The panel registry entry carries
 * `access: ["admin"]`, which LOOKS like a gate and is not one: `grantAccess()` in
 * configs/access.js has no call sites, and both renderers decide with
 * `munin.isPanelEnabled(idx)` alone. That value is derived from the HOST's environment,
 * so it is identical for every user — with the flag on, everyone logged into the CMS
 * saw an Access button and only learned it was not theirs after clicking it.
 *
 * `page:access` is per-user and overridable, so it is the only correct question; a role
 * name is a different one. The entry must be ABSENT, not merely disabled: these hosts
 * run with VUE_APP_HIDE_DISABLED_PANELS unset, which renders a disabled panel as a
 * greyed <div> that is still plainly visible.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";

const ensureLoaded = vi.fn();
let canRead = false;

vi.mock("@/api/contentDB/api", () => ({ POST_Logout: vi.fn() }));
vi.mock("@/stores/user", () => ({
  useUserStore: () => ({
    user: { username: "someone", first_name: "", last_name: "", email: "" },
    refresh: "r",
    isAuth: true,
    theme: "default",
    lang: "EN",
    activeApp: "pim",
    isSidebarCollapsed: false,
    clearAuth: vi.fn(),
    setTheme: vi.fn(),
    setLanguage: vi.fn(),
  }),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
// A real host's answer: Munin reports every panel enabled, including `access`, which PR #5
// adds to the env panel set. This is exactly the state in which the entry used to leak.
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ isPanelEnabled: () => true, loaded: true, ensureLoaded: vi.fn() }),
}));
vi.mock("@/stores/accessMatrix", () => ({
  useAccessMatrixStore: () => ({
    get canRead() {
      return canRead;
    },
    ensureLoaded,
  }),
}));

const loadPanelRenderers = async () => {
  vi.resetModules();
  process.env.VUE_APP_ACCESS_PANEL_ENABLED = "true";
  const HeaderControls = (await import("@/components/Navigation/HeaderControls.vue")).default;
  const Home = (await import("@/views/Home/index.vue")).default;
  return { HeaderControls, Home };
};

const originalFlag = process.env.VUE_APP_ACCESS_PANEL_ENABLED;

beforeEach(() => {
  ensureLoaded.mockClear();
  canRead = false;
});
afterEach(() => {
  process.env.VUE_APP_ACCESS_PANEL_ENABLED = originalFlag;
});

const idxOf = (wrapper) => wrapper.vm.panels.map((p) => p.idx);

describe("the Access panel entry is gated on page:access, not on the host flag", () => {
  it("is absent from the header for somebody who does not hold page:access", async () => {
    const { HeaderControls } = await loadPanelRenderers();
    canRead = false;

    const wrapper = mount(HeaderControls, { global: { stubs: { RouterLink: true } } });

    expect(idxOf(wrapper)).not.toContain("access");
  });

  it("is offered in the header to somebody who does hold it", async () => {
    const { HeaderControls } = await loadPanelRenderers();
    canRead = true;

    const wrapper = mount(HeaderControls, { global: { stubs: { RouterLink: true } } });

    expect(idxOf(wrapper)).toContain("access");
  });

  it("is absent from the home screen for somebody who does not hold page:access", async () => {
    const { Home } = await loadPanelRenderers();
    canRead = false;

    const wrapper = mount(Home, { global: { stubs: { RouterLink: true } } });

    expect(idxOf(wrapper)).not.toContain("access");
  });

  it("is offered on the home screen to somebody who does hold it", async () => {
    const { Home } = await loadPanelRenderers();
    canRead = true;

    const wrapper = mount(Home, { global: { stubs: { RouterLink: true } } });

    expect(idxOf(wrapper)).toContain("access");
  });

  it("leaves every other panel exactly as Munin reported it", async () => {
    const { HeaderControls } = await loadPanelRenderers();
    canRead = false;

    const wrapper = mount(HeaderControls, { global: { stubs: { RouterLink: true } } });

    // Only `access` is filtered. Anything else Munin enabled is still offered, so this
    // gate cannot quietly hide somebody else's panel.
    const drawn = idxOf(wrapper);
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.every((i) => i !== "access")).toBe(true);
  });

  it("asks the matrix who this is, rather than assuming the flag answers it", async () => {
    const { HeaderControls } = await loadPanelRenderers();

    mount(HeaderControls, { global: { stubs: { RouterLink: true } } });

    // Without this the store never loads on the nav's path and canRead is false for
    // everyone — the entry would be hidden from its rightful holder instead.
    expect(ensureLoaded).toHaveBeenCalled();
  });
});
