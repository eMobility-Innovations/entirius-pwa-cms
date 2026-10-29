import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ GET_ThreadWithOptouts: vi.fn(), POST_ConfirmOptout: vi.fn() }));
vi.mock("@/api/communicator/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));

import ThreadGroup from "@/views/Leads/ThreadGroup.vue";

const thread = { id: 8, status: "replied", recipient_name: "Anna", recipient_email: "anna@shop.test", last_message_at: "2026-09-22T08:00:00Z" };
const timeline = [
  { at: "2026-09-21T08:00:00Z", direction: "out", status: "sent", subject: "Your shop audit", body_text: "Hi" },
  { at: "2026-09-22T08:00:00Z", direction: "in", body_text: "Yes, call me" },
];

const scrolled = [];
const scrollIntoView = Element.prototype.scrollIntoView;

// FIX-17b item 2 / FIX-17c items 5 + 7: the thread holding the reply the bell announced.
describe("Leads ThreadGroup", () => {
  beforeEach(() => {
    scrolled.length = 0;
    Element.prototype.scrollIntoView = function () {
      scrolled.push(this);
    };
    api.GET_ThreadWithOptouts.mockResolvedValue({ id: 8, timeline, optouts: [] });
  });
  afterEach(() => {
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  it("the reply thread opens with its marker and never scrolls the newest thread off the screen", async () => {
    const wrapper = mount(ThreadGroup, { props: { thread, holdsReply: true }, global: { stubs: { Loader: true } } });
    await flushPromises();
    expect(wrapper.get('[data-testid="earlier-thread-reply"]').exists()).toBe(true);
    expect(wrapper.classes()).toContain("tg--reply");
    expect(wrapper.findAll('[data-testid="timeline-in"]')).toHaveLength(1);
    expect(scrolled).toEqual([]);
  });

  it("any other older thread stays collapsed, unmarked, under its subject", async () => {
    const wrapper = mount(ThreadGroup, { props: { thread }, global: { stubs: { Loader: true } } });
    await flushPromises();
    expect(wrapper.find('[data-testid="earlier-thread-reply"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="thread-timeline"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="earlier-thread-subject"]').text()).toBe("Your shop audit");
  });

  // Plan 56b: a phone tap on the subject opens the thread; the IconButton keeps its state for the keyboard.
  it("a tap on the summary toggles the thread, the toggle button follows", async () => {
    const IconButton = { name: "IconButton", props: ["icon", "label"], template: "<button />" };
    const wrapper = mount(ThreadGroup, { props: { thread }, global: { stubs: { Loader: true, IconButton } } });
    await flushPromises();
    await wrapper.get('[data-testid="earlier-thread-subject"]').trigger("click");
    expect(wrapper.find('[data-testid="thread-timeline"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="earlier-thread-toggle"]').attributes("aria-expanded")).toBe("true");
    await wrapper.get('[data-testid="earlier-thread-toggle"]').trigger("click");
    expect(wrapper.find('[data-testid="thread-timeline"]').exists()).toBe(false);
  });

  // Plan 61c: only a selection inside this summary blocks the tap; text selected elsewhere does not.
  it.each([
    ["over the summary", false, (wrapper) => wrapper.get('[data-testid="earlier-thread-subject"]').element],
    ["elsewhere on the page", true, () => document.getElementById("outside")],
  ])("a text selection %s → the tap toggles: %s", async (_, toggles, target) => {
    document.body.innerHTML = '<p id="outside">Draft body</p><div id="app"></div>';
    const wrapper = mount(ThreadGroup, { props: { thread }, attachTo: "#app", global: { stubs: { Loader: true } } });
    await flushPromises();
    window.getSelection().selectAllChildren(target(wrapper));
    await wrapper.get('[data-testid="earlier-thread-summary"]').trigger("click");
    window.getSelection().removeAllRanges();
    expect(wrapper.find('[data-testid="thread-timeline"]').exists()).toBe(toggles);
    wrapper.unmount();
  });
});
