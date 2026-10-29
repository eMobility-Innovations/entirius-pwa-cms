import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const route = vi.hoisted(() => ({ name: "LeadsConversation", params: {} }));
const back = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("vue-router", () => ({ useRoute: () => route, useRouter: () => ({ back, push }) }));
vi.mock("@/composables/useIsDesktop", async () => {
  const { ref } = await import("vue");
  return { useIsDesktop: () => ref(false) }; // a phone: the Back bar shows
});
const api = vi.hoisted(() => ({
  GET_ThreadWithOptouts: vi.fn(),
  GET_WaitingMessages: vi.fn(() => Promise.resolve([])),
  POST_ConfirmOptout: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock("@/api/communicator/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));

import Conversation from "@/views/Leads/Conversation.vue";

const timeline = [
  { at: "2026-09-21T08:00:00Z", direction: "out", status: "sent", subject: "Your shop audit", body_text: "Hi" },
  { at: "2026-09-22T08:00:00Z", direction: "in", body_text: "Yes, call me\n\nOn Mon Anna wrote:\n> Hi" },
];

describe("Leads Conversation (a thread by id)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    route.name = "LeadsConversation";
    route.params = { id: "23" };
  });

  it("shows the whole thread of a reply that belongs to no company", async () => {
    api.GET_ThreadWithOptouts.mockResolvedValue({ id: 23, status: "replied", recipient_name: "Jan", recipient_email: "jan@shop.test", timeline, optouts: [] });
    const wrapper = mount(Conversation, { global: { stubs: { Loader: true } } });
    await flushPromises();
    expect(api.GET_ThreadWithOptouts).toHaveBeenCalledWith("23");
    expect(wrapper.get('[data-testid="conversation-recipient"]').text()).toBe("Jan · jan@shop.test");
    expect(wrapper.get('[data-testid="thread-subject"]').text()).toContain("Your shop audit");
    expect(wrapper.findAll('[data-testid="timeline-in"]')).toHaveLength(1);
  });

  it("a thread that cannot load says so", async () => {
    api.GET_ThreadWithOptouts.mockRejectedValue({ status: 404 });
    const wrapper = mount(Conversation, { global: { stubs: { Loader: true } } });
    await flushPromises();
    expect(wrapper.find('[data-testid="conversation-missing"]').exists()).toBe(true);
  });

  it("Back on a directly opened thread (no history) goes to the Inbox", async () => {
    api.GET_ThreadWithOptouts.mockResolvedValue({ id: 23, status: "open", timeline, optouts: [] });
    const length = vi.spyOn(window.history, "length", "get").mockReturnValue(1);
    const PageHeader = { props: ["title", "back"], template: "<button data-testid='back' @click='back()' />" };
    const wrapper = mount(Conversation, { global: { stubs: { Loader: true, PageHeader } } });
    await flushPromises();
    await wrapper.get('[data-testid="back"]').trigger("click");
    expect(push).toHaveBeenCalledWith({ name: "LeadsInbox" });
    expect(back).not.toHaveBeenCalled();
    length.mockRestore();
  });
});
