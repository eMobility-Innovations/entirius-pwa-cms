import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { applyPolicy, channelTimeZone } from "@/utils/leadsTime";
import ThreadTimeline from "@/views/Leads/ThreadTimeline.vue";

const messages = [
  { kind: "reply", at: "2026-09-21T09:00:00Z", direction: "in", status: "", subject: "Re: audit", body_text: "Thanks" },
  { kind: "message", at: "2026-09-21T08:00:00Z", direction: "out", status: "sent", subject: "Audit", body_text: "Hello" },
  { kind: "message", message_id: 7, at: "2026-09-24T08:00:00Z", direction: "out", status: "scheduled", subject: "Follow", body_text: "Ping" },
];

describe("ThreadTimeline", () => {
  it("renders the thread's messages and replies in the order the API gives", () => {
    const wrapper = mount(ThreadTimeline, { props: { messages: [messages[1], messages[0], messages[2]] } });
    const sides = wrapper.findAll(".tl__entry").map((li) => li.attributes("data-testid"));
    expect(sides).toEqual(["timeline-out", "timeline-in", "timeline-out"]);
  });

  it("badges outbound status and tags later outbound messages as follow-ups", () => {
    const wrapper = mount(ThreadTimeline, { props: { messages: [messages[1], messages[0], messages[2]] } });
    expect(wrapper.find('[data-testid="status-sent"]').exists()).toBe(true);
    expect(wrapper.findAll(".tl__tag")).toHaveLength(1);
  });

  // FIX-17b item 15: a waiting bubble says what the Inbox says — the shared send state of its own `next_slot`.
  it("two waiting follow-ups with the same subject each state their own next_slot by message id", () => {
    channelTimeZone.value = "UTC";
    const first = { ...messages[2], message_id: 11 };
    const second = { ...messages[2], message_id: 12 };
    const waiting = [
      { id: 12, subject: "Follow", next_slot: "2099-01-02T08:00:00Z" },
      { id: 11, subject: "Follow", next_slot: new Date(Date.now() - 7 * 60000).toISOString() },
    ];
    const wrapper = mount(ThreadTimeline, { props: { messages: [first, second], waiting } });
    const states = wrapper.findAll('[data-testid="status-scheduled"]').map((node) => node.text());
    expect(states[0]).toContain("goes out within minutes — the send window is open");
    expect(states[1]).toContain("goes out at 02.01 08:00");
    expect(wrapper.find('[data-testid="timeline-time"]').exists()).toBe(false);
    channelTimeZone.value = undefined;
  });

  it("a waiting mail with the cap used up says so, whatever its slot", () => {
    applyPolicy({ timezone: "UTC", sent_today: 5, daily_cap: 5 });
    const wrapper = mount(ThreadTimeline, { props: { messages: [messages[2]], waiting: [{ id: 7, next_slot: "2099-01-02T08:00:00Z" }] } });
    expect(wrapper.get('[data-testid="status-scheduled"]').text()).toContain("daily cap reached");
    applyPolicy(null);
  });

  it("a sent message keeps its own time", () => {
    const wrapper = mount(ThreadTimeline, { props: { messages: [messages[1]] } });
    expect(wrapper.find('[data-testid="timeline-time"]').exists()).toBe(true);
  });

  // FIX-17b item 3: a reply's quoted history is folded behind a toggle.
  it("folds the quoted history of a reply behind a toggle", async () => {
    const body = "Hello,\n\nthanks.\n\n> On Mon, 14 Sep 2026 at 09:00, Outreach wrote:\n> Here is what we found.";
    const reply = { ...messages[0], body_text: body };
    const wrapper = mount(ThreadTimeline, { props: { messages: [reply] } });
    expect(wrapper.get(".tl__body").text()).toBe("Hello,\n\nthanks.");
    expect(wrapper.find('[data-testid="timeline-quote"]').exists()).toBe(false);
    await wrapper.get('[data-testid="timeline-quote-toggle"]').trigger("click");
    expect(wrapper.get('[data-testid="timeline-quote"]').text()).toContain("Here is what we found.");
  });

  it("offers opt-out confirmation on a suspected opt-out reply", async () => {
    const optouts = [{ id: 3, received_at: "2026-09-21T09:00:00Z", optout_confirmed_at: null }];
    const wrapper = mount(ThreadTimeline, { props: { messages, optouts } });
    await wrapper.get('[data-testid="confirm-optout"]').trigger("click");
    expect(wrapper.emitted("confirm-optout")[0]).toEqual([3]);
  });
});
