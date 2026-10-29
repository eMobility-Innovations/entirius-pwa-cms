import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

const api = vi.hoisted(() => ({
  GET_UnreadCount: vi.fn(() => Promise.resolve({ data: { unread: 2 } })),
  GET_Notifications: vi.fn(() =>
    Promise.resolve({
      data: {
        results: [
          { id: 1, title: "Reply from Example Shop 1", severity: "high", subject_ref: "leads.Company:153", created_at: "2026-09-14T08:00:00Z" },
          { id: 2, title: "Budget", severity: "low", subject_ref: "toolbox:budget", created_at: "2026-09-14T08:01:00Z" },
        ],
      },
    })
  ),
  POST_MarkRead: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock("@/api/notifications/api", () => api);
const push = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));
const spawnNotification = vi.hoisted(() => vi.fn());
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification }) }));

const GET_Company = vi.hoisted(() => vi.fn((id) => Promise.resolve({ data: { id, name: `Example Shop ${id}` } })));
vi.mock("@/api/leads/api", () => ({ GET_Company }));
const GET_Threads = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: { results: [] } })));
vi.mock("@/api/communicator/api", () => ({ GET_Threads }));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isModuleEnabled: (key) => key === "leads" }) }));

import { useNotificationsStore } from "@/stores/notifications";
import NotificationBell from "@/components/NotificationBar/NotificationBell.vue";

// The rows are BasicButtons whose slot holds the title and preview: render the real boot, not the global stub.
const mountBell = () => mount(NotificationBell, { global: { stubs: { teleport: true, BasicButton: false } } });

describe("notification bar", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("polls the unread count every 30 s and stops on logout", async () => {
    const store = useNotificationsStore();
    store.start();
    await flushPromises();
    expect(store.unread).toBe(2);
    vi.advanceTimersByTime(30000);
    expect(api.GET_UnreadCount).toHaveBeenCalledTimes(2);
    store.stop();
    vi.advanceTimersByTime(60000);
    expect(api.GET_UnreadCount).toHaveBeenCalledTimes(2);
    expect(store.unread).toBe(0);
  });

  it("skips polling while the tab is hidden", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await useNotificationsStore().poll();
    expect(api.GET_UnreadCount).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("shows the badge and opens the list", async () => {
    useNotificationsStore().unread = 2;
    const wrapper = mountBell();
    expect(wrapper.get('[data-testid="notif-count"]').text()).toBe("2");
    await wrapper.get('[data-testid="notif-bell"]').trigger("click");
    await flushPromises();
    expect(wrapper.findAll('[data-testid="notif-row"]')).toHaveLength(2);
  });

  it("opens in a menu panel named by the list title; the bell announces it", async () => {
    const wrapper = mountBell();
    const bell = wrapper.get('[data-testid="notif-bell"]');
    await flushPromises();
    expect(bell.attributes("aria-haspopup")).toBe("dialog");
    await bell.trigger("click");
    await flushPromises();
    const panel = wrapper.get('[role="dialog"]');
    expect(panel.attributes("aria-label")).toBe("notification_bar.title");
    expect(panel.find('[data-testid="notif-list"]').exists()).toBe(true);
    expect(bell.attributes("aria-expanded")).toBe("true");
  });

  it("one tap on a row marks it read and jumps to the thread", async () => {
    useNotificationsStore().unread = 2;
    const wrapper = mountBell();
    await wrapper.get('[data-testid="notif-bell"]').trigger("click");
    await flushPromises();
    await wrapper.findAll('[data-testid="notif-row"]')[0].trigger("click");
    await flushPromises();
    expect(api.POST_MarkRead).toHaveBeenCalledWith(1);
    expect(push).toHaveBeenCalledWith({ name: "LeadsThread", params: { id: 153 }, query: { tab: "timeline" } });
    expect(wrapper.get('[data-testid="notif-count"]').text()).toBe("1");
  });

  it("an unknown subject_ref is marked read without a jump", async () => {
    const wrapper = mountBell();
    await wrapper.get('[data-testid="notif-bell"]').trigger("click");
    await flushPromises();
    await wrapper.findAll('[data-testid="notif-row"]')[1].trigger("click");
    await flushPromises();
    expect(api.POST_MarkRead).toHaveBeenCalledWith(2);
    expect(push).not.toHaveBeenCalled();
  });

  // UX-002: a reply about something that is not a company opens its thread by id — never a dead tap.
  it("a reply outside any company opens its newest thread", async () => {
    api.GET_Notifications.mockResolvedValueOnce({
      data: { results: [{ id: 9, title: "Reply from jan@example-shop-1.test", severity: "high", subject_ref: "bdd:toolbox-down", created_at: "2026-09-26T07:08:00Z" }] },
    });
    GET_Threads.mockResolvedValueOnce({ data: { results: [{ id: 23 }] } });
    const wrapper = mountBell();
    await wrapper.get('[data-testid="notif-bell"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="notif-row"]').trigger("click");
    await flushPromises();
    expect(GET_Threads).toHaveBeenCalledWith({ subject_ref: "bdd:toolbox-down", page_size: 1 });
    expect(push).toHaveBeenCalledWith({ name: "LeadsConversation", params: { id: 23 } });
  });

  it("a tab becoming visible polls at once", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const store = useNotificationsStore();
    store.start();
    await flushPromises();
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(api.GET_UnreadCount).toHaveBeenCalledTimes(2);
    store.stop();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(api.GET_UnreadCount).toHaveBeenCalledTimes(2);
    visibility.mockRestore();
  });

  it("a double tap on a row reads once and drops the badge by one", async () => {
    useNotificationsStore().unread = 2;
    const wrapper = mountBell();
    await wrapper.get('[data-testid="notif-bell"]').trigger("click");
    await flushPromises();
    // The second tap lands while the first read is still in flight.
    let finishRead;
    api.POST_MarkRead.mockImplementationOnce(() => new Promise((resolve) => (finishRead = resolve)));
    const row = wrapper.findAll('[data-testid="notif-row"]')[0];
    await row.trigger("click");
    await row.trigger("click");
    finishRead({ data: {} });
    await flushPromises();
    expect(api.POST_MarkRead).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-testid="notif-count"]').text()).toBe("1");
  });

  it("a failed read shows a toast and keeps the badge", async () => {
    api.POST_MarkRead.mockRejectedValueOnce({ error: "INTERNAL_ERROR" });
    useNotificationsStore().unread = 2;
    const wrapper = mountBell();
    await wrapper.get('[data-testid="notif-bell"]').trigger("click");
    await flushPromises();
    await wrapper.findAll('[data-testid="notif-row"]')[0].trigger("click");
    await flushPromises();
    expect(spawnNotification).toHaveBeenCalledWith(expect.objectContaining({ type: "negative" }));
    expect(push).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="notif-count"]').text()).toBe("2");
  });

  it("a failing list load is caught and leaves the list empty", async () => {
    api.GET_Notifications.mockRejectedValueOnce({ error: "INTERNAL_ERROR" });
    const wrapper = mountBell();
    await wrapper.get('[data-testid="notif-bell"]').trigger("click");
    await flushPromises();
    expect(wrapper.findAll('[data-testid="notif-row"]')).toHaveLength(0);
  });

  it("notification rows carry the company name (and the company for Possible opt-out), not the raw address", async () => {
    api.GET_Notifications.mockResolvedValueOnce({
      data: {
        results: [
          { id: 3, title: "Reply from anna@example-shop-5.test", severity: "medium", subject_ref: "leads.Company:5", created_at: "2026-09-14T08:00:00Z" },
          { id: 4, title: "Possible opt-out", severity: "medium", subject_ref: "leads.Company:6", created_at: "2026-09-14T08:01:00Z" },
        ],
      },
    });
    const wrapper = mountBell();
    await wrapper.get('[data-testid="notif-bell"]').trigger("click");
    await flushPromises();
    const titles = wrapper.findAll(".notif-row__title").map((row) => row.text());
    expect(titles).toEqual(["Reply from Example Shop 5", "Possible opt-out · Example Shop 6"]);
  });

  // FIX-17c item 4: three replies from one company are three different rows — the reply's words and its day.
  it("rows with the same title differ by a preview of the body and a day-and-time", async () => {
    const reply = (id, body, created_at) => ({ id, title: "Reply from Example Shop 5", severity: "high", subject_ref: "leads.Company:5", body, created_at });
    api.GET_Notifications.mockResolvedValueOnce({
      data: {
        results: [
          reply(5, "Yes, call me tomorrow.\n\nOn Mon, 14 Sep 2026 Anna wrote:\n> Your shop audit", "2026-09-14T11:55:00Z"),
          reply(6, "Not interested", "2026-09-15T09:10:00Z"),
          reply(7, "", "2026-09-15T09:12:00Z"),
        ],
      },
    });
    const wrapper = mountBell();
    await wrapper.get('[data-testid="notif-bell"]').trigger("click");
    await flushPromises();
    const rows = wrapper.findAll('[data-testid="notif-row"]');
    expect(rows[0].get('[data-testid="notif-preview"]').text()).toBe("Yes, call me tomorrow.");
    expect(rows[1].get('[data-testid="notif-preview"]').text()).toBe("Not interested");
    expect(rows[2].find('[data-testid="notif-preview"]').exists()).toBe(false);
    expect(rows[0].get(".notif-row__age").text()).toMatch(/^14\.09 \d\d:55$/);
  });

  // FIX-17d item 3: a Polish or wrapped quote header is history too; the reply's own first line stays.
  it("the preview drops Polish and multi-line quote headers but keeps the reply's own words", async () => {
    const reply = (id, body) => ({ id, title: "Reply from Example Shop 5", severity: "high", subject_ref: "leads.Company:5", body, created_at: "2026-09-14T11:55:00Z" });
    api.GET_Notifications.mockResolvedValueOnce({
      data: {
        results: [
          reply(8, "Proszę o telefon.\n\nW dniu pon., 14 wrz 2026 o 10:00 Anna <anna@example-shop-5.test> napisał(a):\n> Audyt sklepu"),
          reply(9, "Send the offer.\n\nOn Mon, 14 Sep 2026 at 10:00, Anna Nowak <\nanna@example-shop-5.test> wrote:\n> Your shop audit"),
          reply(10, "On Monday I am free.\nCall me then."),
        ],
      },
    });
    const wrapper = mountBell();
    await wrapper.get('[data-testid="notif-bell"]').trigger("click");
    await flushPromises();
    const previews = wrapper.findAll('[data-testid="notif-preview"]').map((node) => node.text());
    expect(previews).toEqual(["Proszę o telefon.", "Send the offer.", "On Monday I am free. Call me then."]);
  });

  // FIX-17e item 1: a quote header must end with ":" before quoted lines; a reply opening "On …"/"W dniu …" keeps its words.
  it("a reply that begins with On or W dniu keeps its own text while the real quote is still stripped", async () => {
    const reply = (id, body) => ({ id, title: "Reply from Example Shop 5", severity: "high", subject_ref: "leads.Company:5", body, created_at: "2026-09-14T11:55:00Z" });
    api.GET_Notifications.mockResolvedValueOnce({
      data: {
        results: [
          reply(11, "On Monday we can talk.\nOn Mon, 14 Sep 2026 Anna wrote:\n> Your shop audit"),
          reply(12, "W dniu podpisania umowy zapłacimy.\n\nW dniu pon., 14 wrz 2026 Anna napisał(a):\n> Audyt sklepu"),
          reply(13, "Thanks.\nOn Friday Anna wrote: it is fine\nregards"),
        ],
      },
    });
    const wrapper = mountBell();
    await wrapper.get('[data-testid="notif-bell"]').trigger("click");
    await flushPromises();
    const previews = wrapper.findAll('[data-testid="notif-preview"]').map((node) => node.text());
    expect(previews).toEqual([
      "On Monday we can talk.",
      "W dniu podpisania umowy zapłacimy.",
      "Thanks. On Friday Anna wrote: it is fine regards",
    ]);
  });

  it("Escape in the panel closes it", async () => {
    const wrapper = mountBell();
    await wrapper.get('[data-testid="notif-bell"]').trigger("click");
    await flushPromises();
    await wrapper.get('[role="dialog"]').trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(wrapper.find('[data-testid="notif-list"]').exists()).toBe(false);
  });
});
