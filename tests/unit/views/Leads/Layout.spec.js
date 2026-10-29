import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick, reactive } from "vue";
import { useLeadsReviewStore } from "@/stores/leadsReview";
import SegmentedControl from "@/boots/SegmentedControl/index.vue";

const route = vi.hoisted(() => ({ current: null }));
const push = vi.hoisted(() => vi.fn());
vi.mock("vue-router", () => ({ useRoute: () => route.current, useRouter: () => ({ push }) }));
const modules = vi.hoisted(() => new Set());
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isModuleEnabled: (key) => modules.has(key) }) }));

const GET_Policy = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: { timezone: "Europe/Warsaw" } })));
vi.mock("@/api/communicator/api", () => ({ GET_Policy }));

import Layout from "@/views/Leads/index.vue";

const mountLayout = () =>
  mount(Layout, {
    global: {
      components: { SegmentedControl },
      stubs: {
        Inbox: { template: "<div data-testid='inbox' />" },
        Companies: { template: "<div data-testid='companies' />" },
        RouterView: { template: "<div data-testid='detail' />" },
      },
    },
  });
const toggle = (wrapper) => wrapper.find('[data-testid="leads-list-toggle"]');
const activeList = (wrapper) => toggle(wrapper).find(".segmented-control__option--active").attributes("data-testid");
// the Inbox stays mounted behind v-show (its poll and scroll survive a trip to Companies)
const shown = (wrapper, testid) => {
  const el = wrapper.find(`[data-testid="${testid}"]`);
  return el.exists() && !(el.attributes("style") || "").includes("display: none");
};
const enable = (...keys) => keys.forEach((key) => modules.add(key));

describe("Leads layout", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    modules.clear();
    push.mockClear();
    route.current = reactive({ name: "LeadsInbox", params: {} });
  });

  it("on the inbox route renders only the inbox column", () => {
    enable("leads", "communicator", "notifications");
    route.current.name = "LeadsInbox";
    const wrapper = mountLayout();
    expect(wrapper.find('[data-testid="inbox"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="detail"]').exists()).toBe(false);
    expect(wrapper.classes()).not.toContain("leads--detail");
  });

  // FIX-17 item 8: nothing to pick, no "Pick a draft to review" — the empty state of the Inbox says it once.
  // FIX-17b item 5: the empty right pane is not blank — it points at the pipeline instead.
  it("the desktop pane asks to pick a draft only while drafts wait, else points at the board", () => {
    enable("leads", "communicator");
    route.current.name = "LeadsInbox";
    const empty = mountLayout();
    expect(empty.text()).not.toContain("leads.inbox.pick");
    expect(empty.find('[data-testid="leads-detail-empty"]').exists()).toBe(true);
    useLeadsReviewStore().setCount(2);
    const waiting = mountLayout();
    expect(waiting.text()).toContain("leads.inbox.pick");
    expect(waiting.find('[data-testid="leads-detail-empty"]').exists()).toBe(false);
  });

  it("leads + communicator: a draft or thread open renders both columns and marks the detail state", () => {
    enable("leads", "communicator", "notifications");
    route.current.name = "LeadsReview";
    const wrapper = mountLayout();
    expect(wrapper.find('[data-testid="inbox"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="detail"]').exists()).toBe(true);
    expect(wrapper.classes()).toContain("leads--detail");
  });

  it("leads-only: the company thread takes the whole width and no Inbox mounts", () => {
    enable("leads", "notifications");
    route.current.name = "LeadsThread";
    const wrapper = mountLayout();
    expect(wrapper.find('[data-testid="inbox"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="detail"]').exists()).toBe(true);
    expect(wrapper.classes()).toContain("leads--solo");
  });

  it("notifications-absent: leads + communicator still render the inbox and the detail", () => {
    enable("leads", "communicator");
    route.current.name = "LeadsThread";
    const wrapper = mountLayout();
    expect(wrapper.find('[data-testid="inbox"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="detail"]').exists()).toBe(true);
  });

  // UX-002d: Settings and its sections take the full width in one scroller — no Inbox column, no DesktopOnly wall.
  // Plan 57: a section's way back is its PageHeader's; the layout adds no second back control.
  it("a settings page renders alone, without a back control of the layout", () => {
    enable("leads", "communicator");
    route.current.name = "LeadsSettings";
    route.current.meta = { page: true };
    const hub = mountLayout();
    expect(hub.find('[data-testid="leads-page"]').exists()).toBe(true);
    expect(hub.find('[data-testid="inbox"]').exists()).toBe(false);
    route.current.name = "CommunicatorSequences";
    const section = mountLayout().get('[data-testid="leads-page"]');
    expect([...section.element.children].map((el) => el.dataset.testid)).toEqual(["detail"]);
    route.current.meta = undefined;
  });

  // UX-010: one Inbox entry, the list above the column is Conversations | Companies.
  describe("Conversations | Companies toggle", () => {
    it("the list routes pick the column's list and nothing opens on the right", () => {
      enable("leads", "communicator");
      const inbox = mountLayout();
      expect(activeList(inbox)).toBe("leads-list-conversations");
      expect(shown(inbox, "inbox")).toBe(true);
      expect(inbox.find('[data-testid="companies"]').exists()).toBe(false);

      route.current.name = "LeadsCompanies";
      const companies = mountLayout();
      expect(activeList(companies)).toBe("leads-list-companies");
      expect(shown(companies, "companies")).toBe(true);
      expect(shown(companies, "inbox")).toBe(false);
      expect(companies.find('[data-testid="detail"]').exists()).toBe(false);
      expect(companies.classes()).not.toContain("leads--detail");
      expect(companies.text()).toContain("leads.companies.pick");
    });

    it("navigates both ways — the toggle only changes the route", async () => {
      enable("leads", "communicator");
      const wrapper = mountLayout();
      await wrapper.find('[data-testid="leads-list-companies"]').trigger("click");
      expect(push).toHaveBeenLastCalledWith({ name: "LeadsCompanies" });
      route.current.name = "LeadsCompanies";
      await nextTick();
      expect(activeList(wrapper)).toBe("leads-list-companies");
      await wrapper.find('[data-testid="leads-list-conversations"]').trigger("click");
      expect(push).toHaveBeenLastCalledWith({ name: "LeadsInbox" });
    });

    it("a company card opened from the Companies list keeps that list in the column", async () => {
      enable("leads", "communicator");
      route.current.name = "LeadsCompanies";
      const wrapper = mountLayout();
      route.current.name = "LeadsThread";
      route.current.params = { id: "5" };
      await nextTick();
      expect(shown(wrapper, "companies")).toBe(true);
      expect(wrapper.find('[data-testid="detail"]').exists()).toBe(true);
      route.current.name = "LeadsInbox";
      await nextTick();
      expect(shown(wrapper, "inbox")).toBe(true);
      expect(wrapper.find('[data-testid="companies"]').exists()).toBe(false);
    });

    it("without communicator there is no toggle: the company list takes the whole width", () => {
      enable("leads");
      route.current.name = "LeadsCompanies";
      const wrapper = mountLayout();
      expect(toggle(wrapper).exists()).toBe(false);
      expect(wrapper.find('[data-testid="detail"]').exists()).toBe(true);
      expect(wrapper.classes()).toContain("leads--solo");
    });

    it("without leads there is no toggle either: the Inbox alone", () => {
      enable("communicator");
      const wrapper = mountLayout();
      expect(toggle(wrapper).exists()).toBe(false);
      expect(shown(wrapper, "inbox")).toBe(true);
    });
  });
});
