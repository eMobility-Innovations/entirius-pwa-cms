import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, enableAutoUnmount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createApiClient } from "@/api/createClient";
import { useConfigHealthStore } from "@/stores/configHealth";
import { useLeadsReviewStore } from "@/stores/leadsReview";
import { applyPolicy, channelTimeZone } from "@/utils/leadsTime";

const draft = { id: 5, subject: "Audit", body_text: "Hello", thread: { subject_ref: "leads.Company:153", recipient_email: "anna@example-shop-1.test" }, render_context: { company_name: "Example Shop 1", hooks: [] } };
const api = vi.hoisted(() => ({
  GET_ReviewList: vi.fn(),
  GET_ReviewMessage: vi.fn(),
  GET_ReviewNext: vi.fn(),
  POST_ReviewAccept: vi.fn(),
  POST_ReviewSkip: vi.fn(),
  POST_ReviewSkipCompany: vi.fn(),
  POST_ReviewRewrite: vi.fn(),
  POST_ReviewEdit: vi.fn(),
  GET_WaitingMessages: vi.fn(),
}));
vi.mock("@/api/communicator/api", () => api);
const munin = vi.hoisted(() => ({ isModuleEnabled: () => true }));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => munin }));
const spawnNotification = vi.fn();
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification }) }));
const route = vi.hoisted(() => ({ current: null }));
const replace = vi.fn();
const guards = vi.hoisted(() => ({ leave: null }));
vi.mock("vue-router", async () => {
  const { reactive } = await import("vue");
  route.current = reactive({ params: { id: "5" } });
  return {
    useRoute: () => route.current,
    useRouter: () => ({ replace }),
    onBeforeRouteLeave: (guard) => (guards.leave = guard),
    onBeforeRouteUpdate: () => {},
  };
});

import Review from "@/views/Leads/Review.vue";
import BasicButton from "@/boots/BasicButton/index.vue";
import BasicInput from "@/boots/BasicInput/index.vue";
import BasicMenu from "@/boots/BasicMenu/index.vue";
import RealBasicModal from "@/boots/BasicModal/index.vue";
import BasicTextarea from "@/boots/BasicTextarea/index.vue";
import { leadsFrame } from "./leadsFrame";

enableAutoUnmount(afterEach);
import ReviewActions from "@/views/Leads/ReviewActions.vue";

const ok = (data = {}) => Promise.resolve({ data });
// A request through the real token-refresh client, answered by the service's 409 body with the given code.
const conflictClient = (error, message) => {
  const client = createApiClient("http://service.test", { tokenRefresh: true });
  client.defaults.adapter = (config) =>
    Promise.reject(
      Object.assign(new Error("409"), {
        config,
        response: { status: 409, config, data: { error, message, debug_id: "a08a83ef", details: [] } },
      })
    );
  return client;
};
// The rewrite dialog renders its body and actions in place while open (no Teleport); buttons and fields are real.
const BasicModal = { name: "BasicModal", props: ["open", "title", "actions"], template: '<div v-if="open"><slot /><ActionBar :actions="actions" /></div>' };
const mountReview = async () => {
  const wrapper = mount(Review, {
    global: {
      components: { ...leadsFrame.components, BasicMenu },
      stubs: {
        ...leadsFrame.stubs,
        BasicButton,
        BasicInput,
        BasicTextarea,
        BasicModal,
        IntelCard: true,
        RouterLink: { template: "<a><slot /></a>" },
      },
    },
  });
  await flushPromises();
  return wrapper;
};

describe("Leads Review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    api.GET_ReviewMessage.mockResolvedValue(draft);
    api.GET_ReviewList.mockResolvedValue({ data: { results: [{ id: 5 }] } });
    api.GET_ReviewNext.mockRejectedValue({ response: { status: 404 } });
    api.GET_WaitingMessages.mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  // FIX-17 item 5: the confirmation stays readable (>= 4 s), it is not gone before the eye reaches it.
  // FIX-17a item 2: it confirms the slot the send run will use — never a time that has already passed.
  // FIX-17b item 13: that slot is the waiting list's `next_slot`, the one the Inbox reads, not `scheduled_at`.
  it("after Send the screen confirms the send state for 4 s before it moves on", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T06:00:00Z"));
    channelTimeZone.value = "UTC";
    api.POST_ReviewAccept.mockReturnValue(ok({ id: 5, status: "approved", scheduled_at: "2026-09-21T07:00:00Z" }));
    api.GET_WaitingMessages.mockResolvedValue([{ id: 5, next_slot: "2026-09-21T08:07:00Z" }]);
    const wrapper = await mountReview();
    await wrapper.get('[data-testid="review-send"]').trigger("click");
    await flushPromises();
    expect(api.POST_ReviewAccept).toHaveBeenCalledWith(5);
    expect(wrapper.get('[data-testid="review-scheduled"]').text()).toBe("Accepted — goes out at 08:07");
    vi.advanceTimersByTime(3900);
    await flushPromises();
    expect(api.GET_ReviewNext).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="review-scheduled"]').exists()).toBe(true);
    vi.advanceTimersByTime(100);
    await flushPromises();
    expect(api.GET_ReviewNext).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith({ name: "LeadsInbox" });
  });

  // FIX-17c item 1: a closed window says so with its hours and the real next slot, in one sentence.
  it("after Send a held mail names the window and the next slot", async () => {
    vi.setSystemTime(new Date("2026-09-16T20:00:00Z"));
    applyPolicy({ timezone: "UTC", sent_today: 0, daily_cap: 10, windows: [{ start_time: "08:00:00", end_time: "17:00:00" }] });
    api.POST_ReviewAccept.mockReturnValue(ok({ id: 5, status: "approved" }));
    api.GET_WaitingMessages.mockResolvedValue([{ id: 5, next_slot: "2026-09-17T08:00:00Z" }]);
    const wrapper = await mountReview();
    await wrapper.get('[data-testid="review-send"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="review-scheduled"]').text()).toBe(
      "Accepted — waiting for the send window (08:00–17:00), next slot 17.09 08:00"
    );
    applyPolicy(null);
  });

  // FIX-17c item 2: a schedule the screen could not fetch is not stated as a fact.
  it.each([
    ["the waiting list fails", () => api.GET_WaitingMessages.mockRejectedValue(new Error("500"))],
    ["the mail is not in the waiting list", () => api.GET_WaitingMessages.mockResolvedValue([{ id: 99, next_slot: "" }])],
  ])("after Send, when %s, the confirmation says the schedule is unknown", async (_, arrange) => {
    arrange();
    api.POST_ReviewAccept.mockReturnValue(ok({ id: 5, status: "approved" }));
    const wrapper = await mountReview();
    await wrapper.get('[data-testid="review-send"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="review-scheduled"]').text()).toBe("Accepted — could not check when it goes out");
  });

  it("Not now skips and moves to the next draft", async () => {
    api.POST_ReviewSkip.mockReturnValue(ok());
    api.GET_ReviewNext.mockResolvedValue({ data: { id: 6 } });
    const wrapper = await mountReview();
    await wrapper.get('[data-testid="review-skip"]').trigger("click");
    await flushPromises();
    expect(api.POST_ReviewSkip).toHaveBeenCalledWith(5);
    expect(replace).toHaveBeenCalledWith({ name: "LeadsReview", params: { id: 6 } });
  });

  it("rewrite with a note calls rewrite/ and opens the new version", async () => {
    api.POST_ReviewRewrite.mockReturnValue(ok({ id: 9 }));
    const wrapper = await mountReview();
    wrapper.findComponent(ReviewActions).vm.$emit("rewrite");
    await flushPromises();
    await wrapper.get('[data-testid="rewrite-notes"] textarea').setValue("shorter");
    await wrapper.get('[data-testid="rewrite-submit"]').trigger("click");
    await flushPromises();
    expect(api.POST_ReviewRewrite).toHaveBeenCalledWith(5, { notes: "shorter" });
    expect(replace).toHaveBeenCalledWith({ name: "LeadsReview", params: { id: 9 } });
  });

  it("a new version beyond the first review page is shown from the action's answer, not looked up", async () => {
    api.POST_ReviewRewrite.mockReturnValue(ok({ ...draft, id: 9, subject: "Rewritten", status: "review_required" }));
    const wrapper = await mountReview();
    wrapper.findComponent(ReviewActions).vm.$emit("rewrite");
    await flushPromises();
    await wrapper.get('[data-testid="rewrite-notes"] textarea').setValue("shorter");
    await wrapper.get('[data-testid="rewrite-submit"]').trigger("click");
    route.current.params.id = "9";
    await flushPromises();
    expect(api.GET_ReviewMessage).toHaveBeenCalledTimes(1);
    expect(api.GET_ReviewNext).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="review-subject"]').text()).toBe("Rewritten");
    route.current.params.id = "5";
  });

  // Plan 56b: the dialog stays mounted (its leave transition runs) and focus goes back to the more button.
  // Plan 61c: the real BasicMenu and BasicModal, in the order a user meets them — the pick hands focus back to the menu
  // trigger, the dialog's focus trap takes it as its opener and restores it on close.
  it("the rewrite dialog closes through v-model:open and hands focus back to the more button", async () => {
    const wrapper = mount(Review, {
      attachTo: document.body,
      global: {
        components: { ...leadsFrame.components, BasicMenu, BasicModal: RealBasicModal },
        stubs: { ...leadsFrame.stubs, BasicButton, BasicInput, BasicTextarea, IntelCard: true, RouterLink: true },
      },
    });
    await flushPromises();
    await wrapper.get('[data-testid="review-more"]').trigger("click");
    await flushPromises();
    const item = document.querySelector('[data-testid="review-rewrite"]');
    item.focus();
    item.click();
    await flushPromises();
    const modal = wrapper.findComponent(RealBasicModal);
    expect(modal.props("open")).toBe(true);
    expect(document.querySelector('[data-testid="rewrite-modal"]').contains(document.activeElement)).toBe(true);
    document.querySelector('[data-testid="rewrite-cancel"]').click();
    await flushPromises();
    expect(wrapper.findComponent(RealBasicModal).exists()).toBe(true);
    expect(wrapper.findComponent(RealBasicModal).props("open")).toBe(false);
    expect(document.activeElement.getAttribute("data-testid")).toBe("review-more");
    wrapper.unmount();
  });

  it("a failed rewrite shows its reason with Retry and Back, never another draft", async () => {
    api.POST_ReviewRewrite.mockReturnValue(ok({ ...draft, id: 9, status: "failed", failure_code: "upstream", failure_detail: "ToolboxError: 503" }));
    const wrapper = await mountReview();
    wrapper.findComponent(ReviewActions).vm.$emit("rewrite");
    await flushPromises();
    await wrapper.get('[data-testid="rewrite-notes"] textarea').setValue("shorter");
    await wrapper.get('[data-testid="rewrite-submit"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="review-failed"]').text()).toContain("ToolboxError: 503");
    expect(replace).not.toHaveBeenCalled();
    expect(api.GET_ReviewNext).not.toHaveBeenCalled();
    await wrapper.get('[data-testid="failed-retry"]').trigger("click");
    expect(wrapper.find('[data-testid="rewrite-notes"]').exists()).toBe(true);
    await wrapper.get('[data-testid="rewrite-cancel"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="review-subject"]').text()).toBe("Audit");
  });

  it("edit saves subject and body through edit/", async () => {
    api.POST_ReviewEdit.mockReturnValue(ok({ id: 10 }));
    const wrapper = await mountReview();
    wrapper.findComponent(ReviewActions).vm.$emit("edit");
    await flushPromises();
    await wrapper.get('[data-testid="edit-subject"] input').setValue("New subject");
    await wrapper.get('[data-testid="edit-save"]').trigger("click");
    await flushPromises();
    expect(api.POST_ReviewEdit).toHaveBeenCalledWith(5, { subject: "New subject", body_text: "Hello" });
  });

  it("skip company calls skip-company/", async () => {
    api.POST_ReviewSkipCompany.mockReturnValue(ok());
    const wrapper = await mountReview();
    wrapper.findComponent(ReviewActions).vm.$emit("skip-company");
    await flushPromises();
    expect(api.POST_ReviewSkipCompany).toHaveBeenCalledWith(5);
  });

  it("more menu holds rewrite, edit and skip company; rewrite is disabled without a toolbox", async () => {
    useConfigHealthStore().checks = [{ code: "toolbox.status", state: "unconfigured", severity: "medium", scope: "" }];
    const wrapper = await mountReview();
    await wrapper.get('[data-testid="review-more"]').trigger("click");
    expect(wrapper.get('[data-testid="review-rewrite"]').attributes("disabled")).toBeDefined();
    expect(wrapper.find('[data-testid="review-edit"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="ai-toolbox-hint"]').attributes("data-state")).toBe("unconfigured");
  });

  it.each([
    ["disabled", true],
    ["unreachable", false],
  ])("toolbox %s: the hint shows and rewrite disabled is %s", async (state, blocked) => {
    useConfigHealthStore().checks = [{ code: "toolbox.status", state, severity: "", scope: "" }];
    const wrapper = await mountReview();
    await wrapper.get('[data-testid="review-more"]').trigger("click");
    expect(wrapper.get('[data-testid="review-rewrite"]').attributes("disabled") !== undefined).toBe(blocked);
    expect(wrapper.get('[data-testid="ai-toolbox-hint"]').attributes("data-state")).toBe(state);
  });

  it("a more-menu item runs its action: Edit opens the edit form", async () => {
    const wrapper = await mountReview();
    await wrapper.get('[data-testid="review-more"]').trigger("click");
    await wrapper.get('[data-testid="review-edit"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="edit-subject"] input').element.value).toBe("Audit");
    expect(wrapper.find('[data-testid="review-actions"]').exists()).toBe(false);
  });

  it("a channel without outgoing mail is named on the Review screen before any send", async () => {
    useConfigHealthStore().checks = [
      { code: "communicator.smtp", state: "unconfigured", severity: "high", scope: "default-europe", fix_url: "https://docs.test/smtp" },
    ];
    const wrapper = await mountReview();
    const banner = wrapper.get('[data-code="communicator.smtp"]');
    expect(banner.text()).toContain("default-europe");
    expect(banner.get("a").attributes("href")).toBe("https://docs.test/smtp");
    expect(wrapper.get('[data-testid="review-send"]').attributes("disabled")).toBeUndefined();
  });

  it("409 ALREADY_REVIEWED from the real client shape moves to next", async () => {
    api.POST_ReviewAccept.mockImplementation(() => conflictClient("ALREADY_REVIEWED", "Message is approved.").post("/accept/"));
    api.GET_ReviewNext.mockResolvedValue({ data: { id: 6 } });
    const wrapper = await mountReview();
    await wrapper.get('[data-testid="review-send"]').trigger("click");
    await flushPromises();
    expect(spawnNotification).toHaveBeenCalledWith({ msg: "This draft was already handled — loading the next one", type: "warning" });
    expect(useLeadsReviewStore().changes).toBe(1);
    expect(replace).toHaveBeenCalledWith({ name: "LeadsReview", params: { id: 6 } });
  });

  it("409 REVIEW_REFUSED shows the service's message and keeps the reviewer on the draft", async () => {
    api.POST_ReviewRewrite.mockImplementation(() => conflictClient("REVIEW_REFUSED", "Only AI drafts can be rewritten.").post("/rewrite/"));
    const wrapper = await mountReview();
    wrapper.findComponent(ReviewActions).vm.$emit("rewrite");
    await flushPromises();
    await wrapper.get('[data-testid="rewrite-notes"] textarea').setValue("shorter");
    await wrapper.get('[data-testid="rewrite-submit"]').trigger("click");
    await flushPromises();
    expect(api.GET_ReviewMessage).toHaveBeenCalledTimes(1);
    expect(spawnNotification).toHaveBeenCalledWith({ msg: "Only AI drafts can be rewritten.", type: "negative" });
    expect(api.GET_ReviewNext).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(useLeadsReviewStore().changes).toBe(0);
    expect(wrapper.get('[data-testid="review-subject"]').text()).toBe("Audit");
  });

  it("the action buttons are disabled while a request is in flight", async () => {
    let resolve;
    api.POST_ReviewSkip.mockReturnValue(new Promise((r) => (resolve = r)));
    const wrapper = await mountReview();
    await wrapper.get('[data-testid="review-skip"]').trigger("click");
    expect(wrapper.get('[data-testid="review-send"]').attributes("disabled")).toBeDefined();
    await wrapper.get('[data-testid="review-skip"]').trigger("click");
    expect(api.POST_ReviewSkip).toHaveBeenCalledTimes(1);
    resolve({ data: {} });
    await flushPromises();
  });

  it("swipe right on the draft sends", async () => {
    api.POST_ReviewAccept.mockReturnValue(ok({ scheduled_at: null }));
    const wrapper = await mountReview();
    const card = wrapper.get('[data-testid="review-draft"]');
    await card.trigger("pointerdown", { pointerType: "touch", clientX: 0, clientY: 0 });
    await card.trigger("pointermove", { pointerType: "touch", clientX: 120, clientY: 0 });
    await card.trigger("pointerup", { pointerType: "touch", clientX: 120, clientY: 0 });
    await flushPromises();
    expect(api.POST_ReviewAccept).toHaveBeenCalledWith(5);
  });

  it("a mouse drag across the draft text does not send", async () => {
    const wrapper = await mountReview();
    const card = wrapper.get('[data-testid="review-draft"]');
    await card.trigger("pointerdown", { pointerType: "mouse", clientX: 0, clientY: 0 });
    await card.trigger("pointermove", { pointerType: "mouse", clientX: 300, clientY: 0 });
    await card.trigger("pointerup", { pointerType: "mouse", clientX: 300, clientY: 0 });
    await flushPromises();
    expect(api.POST_ReviewAccept).not.toHaveBeenCalled();
  });

  // FIX-17 item 9: the in-app sheet asks, never the browser's confirm().
  it("leaving Edit with unsaved changes asks in the app sheet before discarding", async () => {
    // happy-dom has no window.confirm: stub it so a call would be seen.
    const confirm = vi.fn();
    vi.stubGlobal("confirm", confirm);
    const wrapper = await mountReview();
    wrapper.findComponent(ReviewActions).vm.$emit("edit");
    await flushPromises();
    await expect(guards.leave()).resolves.toBe(true);
    expect(wrapper.find('[data-testid="confirm-dialog-cancel"]').exists()).toBe(false);

    await wrapper.get('[data-testid="edit-body"] textarea').setValue("Changed");
    await wrapper.get('[data-testid="edit-cancel"]').trigger("click");
    await wrapper.get('[data-testid="confirm-dialog-cancel"]').trigger("click");
    expect(wrapper.find('[data-testid="edit-body"]').exists()).toBe(true);

    await wrapper.get('[data-testid="edit-cancel"]').trigger("click");
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="edit-body"]').exists()).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  // FIX-17 item 7: a draft that is already scheduled or sent says so instead of a silent redirect.
  it("an already handled draft says so before the Inbox takes over", async () => {
    api.GET_ReviewMessage.mockResolvedValue(null);
    await mountReview();
    expect(spawnNotification).toHaveBeenCalledWith({
      msg: "That draft is already scheduled or sent.",
      type: "warning",
    });
    expect(replace).toHaveBeenCalledWith({ name: "LeadsInbox" });
  });

  // FIX-17 item 4: after a send the next draft is visibly another one.
  it("the draft header says where it sits in the review queue", async () => {
    api.GET_ReviewList.mockResolvedValue({ data: { results: [{ id: 4 }, { id: 5 }, { id: 6 }] } });
    const wrapper = await mountReview();
    expect(api.GET_ReviewList).toHaveBeenCalledWith({ status: "review_required", page_size: 100 });
    expect(wrapper.get('[data-testid="review-position"]').text()).toContain('{"index":2,"count":3}');
  });

  it("the disabled Rewrite button renders disabled", async () => {
    const wrapper = await mountReview();
    wrapper.findComponent(ReviewActions).vm.$emit("rewrite");
    await flushPromises();
    const submit = wrapper.get('[data-testid="rewrite-submit"]');
    expect(submit.attributes("disabled")).toBeDefined();
    await submit.trigger("click");
    expect(api.POST_ReviewRewrite).not.toHaveBeenCalled();
  });
});
