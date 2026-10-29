import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const route = vi.hoisted(() => ({ name: "LeadsInbox", params: {} }));
vi.mock("vue-router", () => ({ useRoute: () => route }));

// `conversations/` answers per `state`; counts come with every page (UX-002c, UX-009: one row per conversation).
const server = vi.hoisted(() => ({ rows: [], counts: { all: 0, draft: 0, waiting: 0, replied: 0 }, waiting: [] }));
const holds = {
  draft: (row) => Boolean(row.draft),
  waiting: (row) => Boolean(row.waiting),
  replied: (row) => row.replied,
};
const threadsFromServer = ({ state }) => {
  const results = state ? server.rows.filter((row) => holds[state](row)) : server.rows;
  return Promise.resolve({ data: { results, next: null, counts: server.counts } });
};
const GET_Conversations = vi.hoisted(() => vi.fn());
const GET_WaitingMessages = vi.hoisted(() => vi.fn(() => Promise.resolve(server.waiting)));
const POST_SendNow = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })));
vi.mock("@/api/communicator/api", () => ({ GET_Conversations, GET_WaitingMessages, POST_SendNow }));
const GET_Company = vi.hoisted(() => vi.fn((id) => Promise.resolve({ data: { id, name: `Example Shop ${id}` } })));
vi.mock("@/api/leads/api", () => ({ GET_Company }));
const modules = vi.hoisted(() => new Set());
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isModuleEnabled: (key) => modules.has(key) }) }));

import Inbox from "@/views/Leads/Inbox.vue";
import { useLeadsReviewStore } from "@/stores/leadsReview";
import { applyPolicy, formatTime } from "@/utils/leadsTime";
import { clearCompanyNames } from "@/utils/leadsCompanyNames";
import { useLeadsThreadStore } from "@/stores/leadsThread";

const inMinutes = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();
const base = (id, extra) => ({
  id,
  subject_ref: `leads.Company:${id}`,
  recipient_name: "",
  recipient_email: `anna@example-shop-${id}.test`,
  status: "open",
  activity_at: "2026-09-26T08:00:00Z",
  subject: "Your shop audit",
  last_text: "",
  draft: null,
  waiting: null,
  replied: false,
  thread_count: 1,
  ...extra,
});
const draftRow = base(5, { draft: { id: 51, subject: "Draft for shop 5", recipient_email: "anna@example-shop-5.test" }, last_text: "Hello" });
const waitingAt = inMinutes(90);
const waitingRow = base(6, { waiting: { id: 61, status: "scheduled", scheduled_at: waitingAt, next_slot: waitingAt } });
const repliedRow = base(7, { status: "replied", replied: true, subject_ref: "bdd:toolbox-down", recipient_name: "Jan", last_text: "Yes, call me\n\n> Hi" });

const RouterLink = { props: ["to"], template: "<a :data-to='JSON.stringify(to)'><slot /></a>" };
const mountInbox = () =>
  mount(Inbox, {
    global: {
      stubs: {
        RouterLink,
        Loader: true,
        FontAwesomeIcon: true,
        FilterChip: { props: ["label", "count", "active"], emits: ["click"], template: "<button :class='{ on: active }' @click=\"$emit('click')\">{{ label }} {{ count }}</button>" },
        EmptyState: { props: ["title", "message"], template: "<div data-testid='inbox-empty'>{{ title }} {{ message }}<slot /></div>" },
      },
    },
  });
const ids = (wrapper) => wrapper.findAll('[data-testid="inbox-item"]').map((row) => Number(row.attributes("data-thread")));
const chip = (wrapper, key) => wrapper.get(`[data-testid="inbox-filter-${key}"]`);

describe("Leads Inbox (one list: drafts, waiting mails, conversations)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    GET_Conversations.mockImplementation(threadsFromServer); // a test may swap in its own answers
    route.name = "LeadsInbox";
    route.params = {};
    server.rows = [draftRow, waitingRow, repliedRow];
    server.counts = { all: 3, draft: 1, waiting: 1, replied: 1 };
    server.waiting = [];
    modules.clear();
    modules.add("leads");
    modules.add("communicator");
    clearCompanyNames();
  });
  afterEach(() => {
    applyPolicy(null);
    vi.useRealTimers();
  });

  it("opens on Drafts when drafts wait, with counts on the chips, and publishes the draft count", async () => {
    const wrapper = mountInbox();
    await flushPromises();
    expect(chip(wrapper, "draft").classes()).toContain("on");
    expect(chip(wrapper, "draft").text()).toBe("leads.inbox.filter.draft 1");
    expect(ids(wrapper)).toEqual([5]);
    expect(GET_Conversations).toHaveBeenCalledWith({ page: 1, page_size: 20, state: "draft" });
    expect(useLeadsReviewStore().count).toBe(1);
  });

  it("opens on All when no draft waits; a chip with 0 stays, dimmed", async () => {
    server.rows = [waitingRow, repliedRow];
    server.counts = { all: 2, draft: 0, waiting: 1, replied: 1 };
    const wrapper = mountInbox();
    await flushPromises();
    expect(chip(wrapper, "all").classes()).toContain("on");
    expect(chip(wrapper, "draft").classes()).toContain("inbox__chip--empty");
    expect(ids(wrapper)).toEqual([6, 7]);
  });

  it("each row carries one marker: a draft opens Review, a waiting mail says when it leaves, a reply its first line", async () => {
    const wrapper = mountInbox();
    await flushPromises();
    await chip(wrapper, "all").trigger("click");
    await flushPromises();
    const [draft, waiting, replied] = wrapper.findAll('[data-testid="inbox-item"]');
    expect(draft.find('[data-testid="inbox-marker-draft"]').exists()).toBe(true);
    expect(draft.get('[data-testid="inbox-item-subject"]').text()).toBe("Draft for shop 5");
    expect(draft.get('[data-testid="inbox-item-to"]').text()).toContain("anna@example-shop-5.test");
    expect(JSON.parse(draft.get("a").attributes("data-to"))).toEqual({ name: "LeadsReview", params: { id: 51 } });
    expect(waiting.get('[data-testid="inbox-marker-waiting"]').text()).toContain(`goes out at ${formatTime(waitingAt)}`);
    expect(JSON.parse(waiting.get("a").attributes("data-to"))).toEqual({ name: "LeadsThread", params: { id: 6 }, query: { tab: "timeline" } });
    expect(replied.get('[data-testid="inbox-item-state"]').text()).toContain("Yes, call me");
    expect(replied.text()).not.toContain("> Hi");
    expect(replied.get('[data-testid="inbox-item-name"]').text()).toBe("Jan");
    expect(JSON.parse(replied.get("a").attributes("data-to"))).toEqual({ name: "LeadsConversation", params: { id: 7 } });
    expect(wrapper.get('[data-thread="6"] [data-testid="inbox-item-name"]').text()).toBe("Example Shop 6");
  });

  it("a waiting mail says why it waits and offers Send now only while it can still move", async () => {
    applyPolicy({ sent_today: 5, daily_cap: 5 });
    server.rows = [waitingRow, base(8, { waiting: { id: 81, status: "approved", scheduled_at: inMinutes(-5), next_slot: inMinutes(-1) } })];
    server.counts = { all: 2, draft: 0, waiting: 2, replied: 0 };
    const wrapper = mountInbox();
    await flushPromises();
    const rows = wrapper.findAll('[data-testid="inbox-item"]');
    expect(rows[0].text()).toContain("daily cap reached");
    expect(rows[1].find('[data-testid="inbox-item-send-now"]').exists()).toBe(false);
    await rows[0].get('[data-testid="inbox-item-send-now"]').trigger("click");
    await flushPromises();
    expect(POST_SendNow).toHaveBeenCalledWith(61);
    expect(GET_Conversations).toHaveBeenCalledTimes(3); // all (no drafts) → again after Send now
  });

  it("an accepted draft moves from Drafts to Waiting without a reload of the page", async () => {
    const wrapper = mountInbox();
    await flushPromises();
    server.rows = [base(5, { waiting: { id: 51, status: "approved", scheduled_at: null, next_slot: waitingAt } }), repliedRow];
    server.counts = { all: 2, draft: 0, waiting: 1, replied: 1 };
    server.waiting = [{ id: 51, next_slot: waitingAt }];
    useLeadsReviewStore().queueChanged();
    await flushPromises();
    // the user stays on Drafts: empty, it says what waits and when it leaves — the e2e contract (inbox-empty)
    expect(wrapper.get('[data-testid="inbox-empty"]').text()).toContain(`1 scheduled, goes out at ${formatTime(waitingAt)}`);
    expect(chip(wrapper, "waiting").text()).toBe("leads.inbox.filter.waiting 1");
    expect(useLeadsReviewStore().count).toBe(0);
  });

  it("the chips are always there (inbox-summary) and other empty filters say one quiet sentence", async () => {
    server.rows = [];
    server.counts = { all: 0, draft: 0, waiting: 0, replied: 0 };
    const wrapper = mountInbox();
    await flushPromises();
    expect(wrapper.find('[data-testid="inbox-summary"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="inbox-empty"]').text()).toBe("No conversation yet");
    await chip(wrapper, "replied").trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="inbox-empty"]').text()).toBe("No replies yet");
  });

  it("polls every 30 s while the tab is visible, so a new reply shows up under Replies", async () => {
    vi.useFakeTimers();
    const wrapper = mountInbox();
    await flushPromises();
    const calls = GET_Conversations.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30000);
    expect(GET_Conversations.mock.calls.length).toBe(calls + 1);
    wrapper.unmount();
    vi.useRealTimers();
  });

  it("the open draft or thread is highlighted in the list", async () => {
    route.name = "LeadsReview";
    route.params = { id: "51" };
    const wrapper = mountInbox();
    await flushPromises();
    expect(wrapper.get('[data-thread="5"]').classes()).toContain("inbox-row--active");
  });

  it("a company with several threads is one row: highlighted on its card, with a quiet thread count", async () => {
    const company = base(21, { subject_ref: "leads.Company:9", status: "open", replied: true, thread_count: 3 });
    server.rows = [company, repliedRow];
    server.counts = { all: 2, draft: 0, waiting: 0, replied: 2 };
    route.name = "LeadsThread";
    route.params = { id: "9" };
    useLeadsThreadStore().shownId = 21; // the card shows the company's newest thread — the row's thread
    const wrapper = mountInbox();
    await flushPromises();
    expect(ids(wrapper)).toEqual([21, 7]);
    const row = wrapper.get('[data-thread="21"]');
    expect(row.classes()).toContain("inbox-row--active");
    expect(row.get('[data-testid="inbox-item-threads"]').text()).toBe("3 threads ·");
    expect(row.find('[data-testid="inbox-marker-replied"]').exists()).toBe(true); // a reply in an older thread counts
    expect(JSON.parse(row.get("a").attributes("data-to"))).toEqual({ name: "LeadsThread", params: { id: 9 }, query: { tab: "timeline" } });
    expect(wrapper.find('[data-thread="7"] [data-testid="inbox-item-threads"]').exists()).toBe(false);
  });

  it("a draft that sits in an older thread opens Review with that draft and names its own recipient", async () => {
    const older = { id: 90, subject: "Answer draft", recipient_email: "owner@shop-9.test" };
    server.rows = [base(22, { subject_ref: "bdd:shop-9", recipient_email: "sales@shop-9.test", thread_count: 2, draft: older })];
    server.counts = { all: 1, draft: 1, waiting: 0, replied: 0 };
    const wrapper = mountInbox();
    await flushPromises();
    const row = wrapper.get('[data-thread="22"]');
    expect(JSON.parse(row.get("a").attributes("data-to"))).toEqual({ name: "LeadsReview", params: { id: 90 } });
    expect(row.get('[data-testid="inbox-item-to"]').text()).toContain("owner@shop-9.test");
  });

  it("with leads off (communicator alone) a company's thread opens by id and no company is looked up", async () => {
    modules.delete("leads");
    server.rows = [waitingRow];
    server.counts = { all: 1, draft: 0, waiting: 1, replied: 0 };
    const wrapper = mountInbox();
    await flushPromises();
    expect(JSON.parse(wrapper.get('[data-thread="6"] a').attributes("data-to"))).toEqual({ name: "LeadsConversation", params: { id: 6 } });
    expect(wrapper.get('[data-thread="6"] [data-testid="inbox-item-name"]').text()).toBe("anna@example-shop-6.test");
    expect(GET_Company).not.toHaveBeenCalled();
  });

  it("a late answer to an older request never overwrites the newer one; loading follows the latest", async () => {
    const wrapper = mountInbox();
    await flushPromises();
    const answers = [];
    GET_Conversations.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
    const reply = (rows) => ({ data: { results: rows, next: null, counts: server.counts } });
    const loaderHidden = () => wrapper.get("loader-stub").attributes("style")?.includes("display: none");
    await chip(wrapper, "replied").trigger("click");
    await chip(wrapper, "waiting").trigger("click");
    answers[0](reply([repliedRow])); // the older request answers first
    await flushPromises();
    expect(ids(wrapper)).toEqual([]);
    expect(loaderHidden()).toBeFalsy(); // the newer one still runs
    answers[1](reply([waitingRow]));
    await flushPromises();
    expect(ids(wrapper)).toEqual([6]);
    expect(loaderHidden()).toBe(true);
    expect(chip(wrapper, "waiting").classes()).toContain("on");
  });

  it("the poll refreshes every page Show more opened instead of collapsing the list to page one", async () => {
    vi.useFakeTimers();
    const pageOf = { 1: [waitingRow], 2: [repliedRow] };
    server.counts = { all: 2, draft: 0, waiting: 1, replied: 1 };
    GET_Conversations.mockImplementation(({ page }) => Promise.resolve({ data: { results: pageOf[page], next: page === 1 ? "p2" : null, counts: server.counts } }));
    const wrapper = mountInbox();
    await flushPromises();
    await wrapper.get('[data-testid="inbox-more"]').trigger("click");
    await flushPromises();
    expect(ids(wrapper)).toEqual([6, 7]);
    GET_Conversations.mockClear();
    await vi.advanceTimersByTimeAsync(30000);
    expect(GET_Conversations.mock.calls.map(([params]) => params.page)).toEqual([1, 2]);
    expect(ids(wrapper)).toEqual([6, 7]);
    wrapper.unmount();
  });

  it("a failed first load says so and falls back to All, without an unhandled rejection", async () => {
    GET_Conversations.mockRejectedValueOnce({ status: 500 });
    const wrapper = mountInbox();
    await flushPromises();
    expect(chip(wrapper, "all").classes()).toContain("on");
    expect(wrapper.get('[role="alert"]').text()).toBe("Could not load the inbox — it tries again on the next refresh");
  });
});
