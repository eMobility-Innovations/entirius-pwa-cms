import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ GET_Proposals: vi.fn(), POST_ReviseTask: vi.fn() }));
const notify = vi.fn();
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));

import BatchCorrection from "@/views/EnrichmentReview/BatchCorrection.vue";

// The modal renders its footer actions as buttons, off while disabled or loading — as the real one does.
const BasicModal = {
  name: "BasicModal",
  props: ["open", "actions"],
  template: "<div v-if='open'><slot /><button v-for='a in actions' :key='a.key' :data-testid='a.testid' :disabled='a.disabled || a.loading' @click='a.onClick'>{{ a.label }}</button></div>",
};
const CorrectionBar = { name: "CorrectionBar", props: ["busy", "batch"], emits: ["submit", "draft"], template: "<div />" };
const BasicButton = { props: ["disabled"], template: "<button :disabled='disabled'><slot /></button>" };
const SHORTER = { instruction: "Shorter, please", quickAction: null, ready: true };

async function openDialog(count = 12) {
  api.GET_Proposals.mockResolvedValue({ data: { count, results: [] } });
  const w = mount(BatchCorrection, { props: { taskId: 6 }, global: { stubs: { BasicModal, CorrectionBar, BasicButton } } });
  await flushPromises();
  await w.find("[data-testid='batch-correct']").trigger("click");
  await flushPromises();
  return w;
}

describe("BatchCorrection (Correct all)", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    notify.mockReset();
  });

  it("counts the whole run's pending proposals; Send waits for an instruction", async () => {
    const w = await openDialog();
    expect(api.GET_Proposals).toHaveBeenLastCalledWith({ task: 6, status: "pending", page_size: 1 });
    expect(w.find("[data-testid='batch-send']").attributes("disabled")).toBeDefined();
    w.findComponent(CorrectionBar).vm.$emit("draft", SHORTER);
    await w.vm.$nextTick();
    expect(w.find("[data-testid='batch-send']").attributes("disabled")).toBeUndefined();
  });

  it("nothing pending: Correct all is off", async () => {
    api.GET_Proposals.mockResolvedValue({ data: { count: 0, results: [] } });
    const w = mount(BatchCorrection, { props: { taskId: 6 }, global: { stubs: { BasicModal, CorrectionBar, BasicButton } } });
    await flushPromises();
    expect(w.find("[data-testid='batch-correct']").attributes("disabled")).toBeDefined();
  });

  it("a double send queues the corrections once, then closes and reports how many went", async () => {
    let answer;
    api.POST_ReviseTask.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const w = await openDialog();
    w.findComponent(CorrectionBar).vm.$emit("draft", SHORTER);
    await w.vm.$nextTick();
    await w.find("[data-testid='batch-send']").trigger("click");
    await w.find("[data-testid='batch-send']").trigger("click");
    w.findComponent(CorrectionBar).vm.$emit("submit", SHORTER); // Enter in the composer while the send is on its way
    answer({ data: { queued: 12 } });
    await flushPromises();
    expect(api.POST_ReviseTask).toHaveBeenCalledTimes(1);
    expect(api.POST_ReviseTask).toHaveBeenCalledWith(6, { instruction: "Shorter, please" });
    expect(w.emitted("queued")).toEqual([[12]]);
    expect(w.findComponent(CorrectionBar).exists()).toBe(false);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "positive" }));
  });

  it("a refused send keeps the dialog open and says why", async () => {
    api.POST_ReviseTask.mockRejectedValue({ error: "INTERNAL_ERROR", message: "boom", httpStatus: 500 });
    const w = await openDialog();
    w.findComponent(CorrectionBar).vm.$emit("draft", SHORTER);
    await w.vm.$nextTick();
    await w.find("[data-testid='batch-send']").trigger("click");
    await flushPromises();
    expect(w.findComponent(CorrectionBar).exists()).toBe(true);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "negative" }));
  });
});
