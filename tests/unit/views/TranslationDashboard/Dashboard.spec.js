// The Translation panel is the one home of the store-wide translation: its header offers Translate Store (primary,
// after Refresh) when the pim_translator module is installed, and the button opens the store-scope dialog on the
// picked channel. The Pim views have none (PimChannelSelect.spec.js).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";

const munin = { isModuleInstalled: vi.fn() };
const jobsStore = {
  loading: false,
  statusFilter: "all",
  filteredJobs: [],
  stats: { total: 0, pending: 0, running: 0, completed: 0, failed: 0 },
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
  fetchJobs: vi.fn(),
  setStatusFilter: vi.fn(),
};
vi.mock("@/stores/munin", () => ({ useMuninStore: () => munin }));
vi.mock("@/stores/translationJobs", () => ({ useTranslationJobsStore: () => jobsStore }));
vi.mock("@/stores/pimChannel", () => ({ usePimChannelStore: () => ({ activeChannelIdx: "default" }) }));

import Dashboard from "@/views/TranslationDashboard/Dashboard.vue";

const install = (modules) => munin.isModuleInstalled.mockImplementation((key) => modules.includes(key));
const mountDashboard = () =>
  mount(Dashboard, { global: { stubs: { PimChannelSelect: true, PimTranslateDialog: true, PageHeader: true } } });
const dialogOf = (wrapper) => wrapper.findComponent({ name: "PimTranslateDialog" });

describe("TranslationDashboard Translate Store", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is a primary action after Refresh when the translator is installed", () => {
    install(["pim_translator"]);
    const actions = mountDashboard().vm.headerActions;

    expect(actions.map(({ key, role }) => ({ key, role }))).toEqual([
      { key: "refresh", role: "secondary" },
      { key: "translate-store", role: "primary" },
    ]);
    expect(actions[1].label).toBe("pim.translate_store");
    expect(actions[1].testid).toBe("translation-translate-store");
  });

  it("is absent, with its dialog, without the translator module", () => {
    install(["contentdb_translator"]);
    const wrapper = mountDashboard();

    expect(wrapper.vm.headerActions.map((action) => action.key)).toEqual(["refresh"]);
    expect(dialogOf(wrapper).exists()).toBe(false);
  });

  it("opens the store-scope dialog on the picked channel", async () => {
    install(["pim_translator"]);
    const wrapper = mountDashboard();
    expect(dialogOf(wrapper).props()).toMatchObject({ open: false, scope: "store", channelIdx: "default" });

    wrapper.vm.headerActions.find((action) => action.key === "translate-store").onClick();
    await wrapper.vm.$nextTick();

    expect(dialogOf(wrapper).props("open")).toBe(true);
  });

  it("polls the jobs again once the dialog created some", async () => {
    install(["pim_translator"]);
    const wrapper = mountDashboard();
    jobsStore.startPolling.mockClear();

    dialogOf(wrapper).vm.$emit("translated");

    expect(jobsStore.startPolling).toHaveBeenCalledWith("default");
  });
});
