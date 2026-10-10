import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { mount, flushPromises } from "@vue/test-utils";

// Three threads of the company, newest first (the list order of the API).
const summaries = [
  { id: 9, status: "open", recipient_name: "Anna", recipient_email: "anna@shop.test", last_message_at: "2026-09-23T08:00:00Z" },
  { id: 8, status: "closed", recipient_name: "Anna", recipient_email: "jan@shop.test", last_message_at: "2026-09-22T08:00:00Z" },
  { id: 7, status: "closed", recipient_name: "Anna", recipient_email: "jan@shop.test", last_message_at: "2026-09-21T08:00:00Z" },
];
const detail = (id) => ({
  id,
  // Threads from the next list page are not in `summaries` — they are closed like every older thread.
  status: (summaries.find((s) => s.id === id) || { status: "closed" }).status,
  timeline: [{ at: "2026-09-21T08:00:00Z", direction: "out", status: "sent", subject: `Subject ${id}`, body_text: "Hi" }],
  optouts: [],
});

const api = vi.hoisted(() => ({
  GET_Threads: vi.fn(),
  GET_ThreadWithOptouts: vi.fn(),
  GET_Replies: vi.fn(),
  GET_WaitingMessages: vi.fn(),
  POST_ConfirmOptout: vi.fn(),
}));
vi.mock("@/api/communicator/api", () => api);
const leadsApi = vi.hoisted(() => ({ GET_Company: vi.fn() }));
vi.mock("@/api/leads/api", () => ({
  GET_Company: leadsApi.GET_Company,
  GET_CompanyActivities: () => Promise.resolve({ data: { results: [{ id: 1, created_at: "2026-09-21T08:00:00Z", message: "stage new -> contacted" }] } }),
}));
const modules = vi.hoisted(() => new Set());
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isModuleEnabled: (key) => modules.has(key) }) }));
const spawnNotification = vi.hoisted(() => vi.fn());
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification }) }));
vi.mock("vue-router", () => ({ useRoute: () => ({ params: { id: "42" } }), useRouter: () => ({}) }));

import Thread from "@/views/Leads/Thread.vue";
import { useConfigHealthStore } from "@/stores/configHealth";
import BasicButton from "@/boots/BasicButton/index.vue";

const stubs = { Loader: true, ConfigBanner: true, BasicButton };
const mountThread = (props = {}) => mount(Thread, { props, global: { stubs } });

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  modules.clear();
  modules.add("leads").add("communicator");
  leadsApi.GET_Company.mockResolvedValue({ data: { id: 42, name: "Example Shop 5" } });
  api.GET_Threads.mockResolvedValue({ data: { count: 3, next: null, results: summaries } });
  api.GET_ThreadWithOptouts.mockImplementation((id) => Promise.resolve(detail(id)));
  api.GET_Replies.mockResolvedValue({ data: { results: [] } });
  api.GET_WaitingMessages.mockResolvedValue([]);
});

describe("Leads Thread", () => {
  it("the phone card renders the AI toolbox hint with the company; the desktop timeline tab leaves it to the card", async () => {
    useConfigHealthStore().checks = [{ code: "toolbox.status", state: "disabled", severity: "", scope: "" }];
    const phone = mountThread({ desktopHint: true });
    const tab = mountThread();
    await flushPromises();
    expect(phone.get('[data-testid="ai-toolbox-hint"]').attributes("data-state")).toBe("disabled");
    expect(tab.find('[data-testid="ai-toolbox-hint"]').exists()).toBe(false);
  });

  it("renders only the newest thread under its subject header", async () => {
    const wrapper = mountThread();
    await flushPromises();
    expect(api.GET_Threads).toHaveBeenCalledWith({ subject_ref: "leads.Company:42", page_size: 20 });
    expect(api.GET_ThreadWithOptouts).toHaveBeenCalledTimes(1);
    expect(api.GET_ThreadWithOptouts).toHaveBeenCalledWith(9);
    expect(wrapper.get('[data-testid="thread-subject"]').text()).toContain("Subject 9");
    expect(wrapper.findAll('[data-testid="timeline-out"]')).toHaveLength(1);
    expect(wrapper.get('[data-testid="earlier-toggle"]').text()).toContain('leads.thread.earlier::{"count":2}');
    expect(wrapper.find('[data-testid="earlier-thread"]').exists()).toBe(false);
  });

  // FIX-17 item 2: a collapsed row is told apart by its subject and recipient, without opening it.
  it("the expander lists older threads by subject and recipient; opening one shows its conversation", async () => {
    const wrapper = mountThread();
    await flushPromises();
    await wrapper.get('[data-testid="earlier-toggle"]').trigger("click");
    await flushPromises();
    const groups = wrapper.findAll('[data-testid="earlier-thread"]');
    expect(groups).toHaveLength(2);
    expect(api.GET_ThreadWithOptouts.mock.calls.map(([id]) => id)).toEqual([9, 8, 7]);
    expect(groups[1].get('[data-testid="earlier-thread-subject"]').text()).toBe("Subject 7");
    expect(groups[1].get('[data-testid="earlier-thread-to"]').text()).toContain("jan@shop.test");
    expect(groups[1].find('[data-testid="thread-timeline"]').exists()).toBe(false);

    await groups[1].get('[data-testid="earlier-thread-toggle"]').trigger("click");
    expect(groups[1].findAll('[data-testid="timeline-out"]')).toHaveLength(1);
    expect(groups[0].find('[data-testid="thread-timeline"]').exists()).toBe(false);
  });

  // FIX-17 item 1: the reply is in an older thread — the card opens that thread, the bell never lands on our own mail.
  it("a reply in an older thread expands the section and opens that thread", async () => {
    const replied = summaries.map((thread) => (thread.id === 8 ? { ...thread, status: "replied" } : thread));
    api.GET_Threads.mockResolvedValue({ data: { count: 3, next: null, results: replied } });
    const scrolled = [];
    Element.prototype.scrollIntoView = function () {
      scrolled.push(this);
    };
    const wrapper = mountThread();
    await flushPromises();
    const groups = wrapper.findAll('[data-testid="earlier-thread"]');
    expect(groups).toHaveLength(2);
    expect(groups[0].find('[data-testid="thread-timeline"]').exists()).toBe(true);
    expect(groups[1].find('[data-testid="thread-timeline"]').exists()).toBe(false);
    // FIX-17b item 2: the thread holding the reply is marked.
    expect(groups[0].find('[data-testid="earlier-thread-reply"]').exists()).toBe(true);
    expect(groups[1].find('[data-testid="earlier-thread-reply"]').exists()).toBe(false);
    // FIX-17c item 5: nothing scrolls past the newest thread; it says the reply is opened below.
    expect(scrolled).toEqual([]);
    expect(wrapper.get('[data-testid="thread-reply-below"]').exists()).toBe(true);
  });

  it("the older threads stay collapsed when the newest one holds the reply itself", async () => {
    const replied = summaries.map((thread) => (thread.id === 8 ? { ...thread, status: "replied" } : thread));
    api.GET_Threads.mockResolvedValue({ data: { count: 3, next: null, results: replied } });
    api.GET_ThreadWithOptouts.mockImplementation((id) =>
      Promise.resolve({ ...detail(id), timeline: [{ at: "2026-09-23T08:00:00Z", direction: "in", body_text: "yes" }] })
    );
    const wrapper = mountThread();
    await flushPromises();
    expect(wrapper.findAll('[data-testid="earlier-thread"]')).toHaveLength(0);
    expect(wrapper.find('[data-testid="thread-reply-below"]').exists()).toBe(false);
  });

  // FIX-17 item 6: no "No messages with this company yet" before the first response.
  it("shows no empty state while the thread loads", async () => {
    const wrapper = mountThread();
    expect(wrapper.find('[data-testid="thread-timeline"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("leads.thread.empty");
    await flushPromises();
    expect(wrapper.find('[data-testid="thread-timeline"]').exists()).toBe(true);
  });

  it("further older threads load with one request for the next list page", async () => {
    api.GET_Threads.mockResolvedValueOnce({ data: { count: 23, next: "page2", results: summaries } });
    api.GET_Threads.mockResolvedValueOnce({ data: { count: 23, next: null, results: [{ ...summaries[2], id: 30 }] } });
    const wrapper = mountThread();
    await flushPromises();
    await wrapper.get('[data-testid="earlier-toggle"]').trigger("click");
    await wrapper.get('[data-testid="earlier-more"]').trigger("click");
    await flushPromises();
    expect(api.GET_Threads).toHaveBeenCalledTimes(2);
    expect(api.GET_Threads).toHaveBeenLastCalledWith({ subject_ref: "leads.Company:42", page: 2, page_size: 20 });
    expect(wrapper.findAll('[data-testid="earlier-thread"]')).toHaveLength(3);
    expect(wrapper.find('[data-testid="earlier-more"]').exists()).toBe(false);
  });

  it("an undecided opt-out in an older thread badges the expander", async () => {
    api.GET_Replies.mockResolvedValue({
      data: { results: [{ id: 5, thread_id: 8, optout_confirmed_at: null }, { id: 6, thread_id: 7, optout_confirmed_at: "x" }] },
    });
    const wrapper = mountThread();
    await flushPromises();
    expect(wrapper.get('[data-testid="earlier-optout-badge"]').attributes("label")).toContain('"count":1');
  });

  it("the phone card keeps activities apart from the mail, the desktop timeline tab has none", async () => {
    const phone = mountThread({ desktopHint: true });
    const desktop = mountThread();
    await flushPromises();
    expect(phone.get('[data-testid="thread-activity"]').text()).toContain("Stage: new → contacted");
    expect(phone.get('[data-testid="thread-timeline"]').text()).not.toContain("stage new");
    expect(desktop.find('[data-testid="thread-activity"]').exists()).toBe(false);
    expect(phone.get('[data-testid="thread-desktop-hint"]').text()).toBe("leads.thread.desktop_hint");
  });

  it("leads-only: the company renders with a mail notice and no communicator call", async () => {
    modules.delete("communicator");
    const wrapper = mountThread({ desktopHint: true });
    await flushPromises();
    expect(wrapper.get('[data-testid="thread-company"]').text()).toBe("Example Shop 5");
    expect(wrapper.find('[data-testid="thread-mail-missing"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="thread-timeline"]').exists()).toBe(false);
    expect(api.GET_Threads).not.toHaveBeenCalled();
    expect(api.GET_WaitingMessages).not.toHaveBeenCalled();
  });

  it("a communicator 404 does not hide the company", async () => {
    api.GET_Threads.mockRejectedValue({ error: "NOT_FOUND" });
    const wrapper = mountThread({ desktopHint: true });
    await flushPromises();
    expect(wrapper.get('[data-testid="thread-company"]').text()).toBe("Example Shop 5");
    expect(wrapper.find('[data-testid="thread-mail-missing"]').exists()).toBe(true);
  });

  it("a failing company call still shows the conversation with a company notice", async () => {
    leadsApi.GET_Company.mockRejectedValue({ error: "INTERNAL_ERROR" });
    const wrapper = mountThread();
    await flushPromises();
    expect(wrapper.find('[data-testid="thread-company-missing"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="thread-subject"]').text()).toContain("Subject 9");
  });

  it("Confirm opt-out is single-flight: a double tap posts once and the button is busy meanwhile", async () => {
    let resolve;
    api.POST_ConfirmOptout.mockReturnValue(new Promise((r) => (resolve = r)));
    api.GET_ThreadWithOptouts.mockImplementation((id) =>
      Promise.resolve({
        ...detail(id),
        timeline: [{ at: "2026-09-22T08:00:00Z", direction: "in", body_text: "stop" }],
        optouts: [{ id: 3, received_at: "2026-09-22T08:00:00Z", optout_confirmed_at: null }],
      })
    );
    const wrapper = mountThread();
    await flushPromises();
    const button = wrapper.get('[data-testid="confirm-optout"]');
    await button.trigger("click");
    await button.trigger("click");
    expect(api.POST_ConfirmOptout).toHaveBeenCalledTimes(1);
    expect(button.attributes("disabled")).toBeDefined();
    resolve({ data: {} });
    await flushPromises();
    expect(wrapper.get('[data-testid="confirm-optout"]').attributes("disabled")).toBeUndefined();
  });
});
