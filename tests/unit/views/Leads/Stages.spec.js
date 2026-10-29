import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { t } from "@/i18n";

const api = vi.hoisted(() => ({
  GET_Stages: vi.fn(),
  GET_Rules: vi.fn(),
  GET_Companies: vi.fn(),
  PATCH_Stage: vi.fn(),
  DELETE_Stage: vi.fn(),
  POST_Stage: vi.fn(),
}));
const notify = vi.hoisted(() => ({ spawnNotification: vi.fn() }));
vi.mock("@/api/leads/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => notify }));

import Stages from "@/views/Leads/Stages.vue";
import { fieldError, leadsFrame, setControl } from "./leadsFrame";

const stubs = { ...leadsFrame.stubs, draggable: { props: ["list"], template: "<div><slot v-for='(el, i) in list' name='item' :element='el' :index='i' /></div>" } };
const stages = () => [{ id: 1, key: "new", label: "New", order: 0, kind: "open" }, { id: 2, key: "won", label: "Won", order: 10, kind: "won" }];

describe("Leads Stages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.GET_Stages.mockImplementation(() => Promise.resolve({ data: { results: stages() } }));
    api.GET_Rules.mockResolvedValue({ data: { results: [{ id: 5, stage_id: 1, is_active: true, action: "communicate", template_key: "cold" }] } });
    api.GET_Companies.mockResolvedValue({ data: { count: 0, results: [] } });
  });

  async function deleteFirstStage(wrapper) {
    await wrapper.findAll('[data-testid="stage-delete"]')[0].trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="confirm-ok"]').trigger("click");
    await flushPromises();
  }

  it("shows a 409 on delete inline, not as a toast (L-18)", async () => {
    api.DELETE_Stage.mockRejectedValue({ response: { status: 409, data: { detail: "move 3 companies first" } } });
    const wrapper = mount(Stages, { global: { components: leadsFrame.components, stubs } });
    await flushPromises();
    await deleteFirstStage(wrapper);
    expect(wrapper.find('[data-testid="stage-error"]').text()).toBe("move 3 companies first");
  });

  // FIX-17 item 16: Delete asks first and says what happens to the companies of the stage.
  it("delete asks in a sheet naming the stage and its companies", async () => {
    const wrapper = mount(Stages, { global: { components: leadsFrame.components, stubs } });
    await flushPromises();
    await wrapper.findAll('[data-testid="stage-delete"]')[0].trigger("click");
    await flushPromises();
    const sheet = wrapper.get('[data-testid="confirm-sheet"]');
    expect(sheet.text()).toContain("Delete the stage “New”? It holds no companies.");
    expect(api.DELETE_Stage).not.toHaveBeenCalled();
    await sheet.get('[data-testid="confirm-dialog-cancel"]').trigger("click");
    expect(wrapper.find('[data-testid="confirm-sheet"]').exists()).toBe(false);
    expect(api.DELETE_Stage).not.toHaveBeenCalled();
  });

  // FIX-17b item 8: the question counts the companies of the stage; the rules the Board badges show here too.
  it("delete names how many companies the stage holds, and the rows show their rules", async () => {
    api.GET_Companies.mockResolvedValue({ data: { count: 3, results: [] } });
    const wrapper = mount(Stages, { global: { components: leadsFrame.components, stubs } });
    await flushPromises();
    expect(wrapper.findAll('[data-testid="stage-row"]')[0].get('[data-testid="stage-rules"]').attributes("label")).toBe(
      t("leads.board.rules_one", { count: 1 })
    );
    await wrapper.findAll('[data-testid="stage-delete"]')[0].trigger("click");
    await flushPromises();
    expect(api.GET_Companies).toHaveBeenCalledWith({ stage: "new", page_size: 1 });
    expect(wrapper.get('[data-testid="confirm-sheet"]').text()).toContain("The stage “New” holds 3 companies.");
  });

  // FIX-17c item 3: a failed count is not "no companies" — the question says the count is unknown.
  it("a failed company count asks without claiming the stage is empty", async () => {
    api.GET_Companies.mockRejectedValue({ response: { status: 500 } });
    const wrapper = mount(Stages, { global: { components: leadsFrame.components, stubs } });
    await flushPromises();
    await wrapper.findAll('[data-testid="stage-delete"]')[0].trigger("click");
    await flushPromises();
    const text = wrapper.get('[data-testid="confirm-sheet"]').text();
    expect(text).toContain("Could not count its companies");
    expect(text).not.toContain("holds no companies");
  });

  // FIX-17 item 16: the stage kind is a word, never the raw enum value.
  it("the key tag reads the stage kind as a label", async () => {
    const wrapper = mount(Stages, { global: { components: leadsFrame.components, stubs } });
    await flushPromises();
    const tag = wrapper.findAll('[data-testid="stage-row"]')[1].findComponent({ name: "StatusBadge" });
    expect(tag.attributes("label")).toBe("won · won");
  });

  async function moveFirstDown() {
    const wrapper = mount(Stages, { global: { components: leadsFrame.components, stubs } });
    await flushPromises();
    await wrapper.findAll('[data-testid="stage-row"]')[0].findAll("button")[1].trigger("click");
    await flushPromises();
    return wrapper;
  }

  it("moving a stage down renumbers in steps of 10, one PATCH after the other", async () => {
    let pending = 0;
    api.PATCH_Stage.mockImplementation(async () => {
      expect(pending).toBe(0);
      pending += 1;
      await Promise.resolve();
      pending -= 1;
      return { data: {} };
    });
    await moveFirstDown();
    expect(api.PATCH_Stage.mock.calls).toEqual([[2, { order: 0 }], [1, { order: 10 }]]);
  });

  it("the first refused PATCH stops the renumber, toasts and reloads the list", async () => {
    api.PATCH_Stage.mockRejectedValue({ response: { data: { detail: "nope" } } });
    const wrapper = await moveFirstDown();
    expect(api.PATCH_Stage).toHaveBeenCalledTimes(1);
    expect(notify.spawnNotification).toHaveBeenCalledWith({ msg: "nope", type: "negative" });
    expect(api.GET_Stages).toHaveBeenCalledTimes(2);
    expect(wrapper.findAll('[data-testid="stage-row"]')[0].attributes("data-stage")).toBe("new");
  });

  it("a new stage goes after the highest order", async () => {
    api.POST_Stage.mockResolvedValue({ data: {} });
    const wrapper = mount(Stages, { global: { components: leadsFrame.components, stubs } });
    await flushPromises();
    await setControl(wrapper, "stage-new-key", "lost");
    await setControl(wrapper, "stage-new-label", "Lost");
    await wrapper.find('[data-testid="stage-add"]').trigger("submit");
    await flushPromises();
    expect(api.POST_Stage).toHaveBeenCalledWith({ key: "lost", label: "Lost", order: 20 });
  });

  // Plan 53: the label field (BasicInput) commits on blur and Enter like the native change did — only when it changed.
  it("a blur renames only a changed label", async () => {
    api.PATCH_Stage.mockResolvedValue({ data: {} });
    const wrapper = mount(Stages, { global: { components: leadsFrame.components, stubs } });
    await flushPromises();
    const label = () => wrapper.findAllComponents('[data-testid="stage-label"]')[0];
    label().vm.$emit("onFocusout");
    expect(api.PATCH_Stage).not.toHaveBeenCalled();
    label().vm.$emit("update:modelValue", "Fresh");
    label().vm.$emit("onKeyDown");
    label().vm.$emit("onFocusout");
    await flushPromises();
    expect(api.PATCH_Stage.mock.calls).toEqual([[1, { label: "Fresh" }]]);
  });

  it("a key outside letters, digits, - and _ is refused before the request", async () => {
    const wrapper = mount(Stages, { global: { components: leadsFrame.components, stubs } });
    await flushPromises();
    await setControl(wrapper, "stage-new-key", "lost stage");
    await setControl(wrapper, "stage-new-label", "Lost");
    await wrapper.find('[data-testid="stage-add"]').trigger("submit");
    await flushPromises();
    expect(api.POST_Stage).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="stage-add-error"]').text()).toBe(t("leads.stages.key_invalid"));
  });

  // Plan 56b: a refused rename is not remembered as saved — the next blur or Enter sends it again.
  it("a failed rename is retried by the next blur", async () => {
    api.PATCH_Stage.mockRejectedValueOnce({ response: { data: { detail: "Busy" } } }).mockResolvedValueOnce({ data: {} });
    const wrapper = mount(Stages, { global: { components: leadsFrame.components, stubs } });
    await flushPromises();
    const label = () => wrapper.findAllComponents('[data-testid="stage-label"]')[0];
    label().vm.$emit("update:modelValue", "Fresh");
    label().vm.$emit("onFocusout");
    await flushPromises();
    expect(wrapper.get('[data-testid="stage-error"]').text()).toBe("Busy");
    label().vm.$emit("onKeyDown");
    await flushPromises();
    expect(api.PATCH_Stage.mock.calls).toEqual([[1, { label: "Fresh" }], [1, { label: "Fresh" }]]);
    expect(wrapper.find('[data-testid="stage-error"]').exists()).toBe(false);
  });

  // Plan 61c: a rename that fails after a newer one was committed does not bring its old label back as saved.
  it("a failed rename keeps a label committed while it ran", async () => {
    let failFirst;
    api.PATCH_Stage.mockReturnValueOnce(new Promise((_, reject) => (failFirst = reject))).mockResolvedValue({ data: {} });
    const wrapper = mount(Stages, { global: { components: leadsFrame.components, stubs } });
    await flushPromises();
    const label = () => wrapper.findAllComponents('[data-testid="stage-label"]')[0];
    label().vm.$emit("update:modelValue", "Fresh");
    label().vm.$emit("onFocusout");
    label().vm.$emit("update:modelValue", "Newer");
    label().vm.$emit("onKeyDown");
    await flushPromises();
    failFirst({ response: { data: { detail: "Busy" } } });
    await flushPromises();
    label().vm.$emit("onFocusout");
    await flushPromises();
    expect(api.PATCH_Stage.mock.calls).toEqual([[1, { label: "Fresh" }], [1, { label: "Newer" }]]);
  });

  it("an empty label is a field error before the request", async () => {
    const wrapper = mount(Stages, { global: { components: leadsFrame.components, stubs } });
    await flushPromises();
    await setControl(wrapper, "stage-new-key", "lost");
    await setControl(wrapper, "stage-new-label", "  ");
    await wrapper.find('[data-testid="stage-add"]').trigger("submit");
    await flushPromises();
    expect(api.POST_Stage).not.toHaveBeenCalled();
    expect(fieldError(wrapper, "leads.stages.label")).toBe(t("leads.stages.label_required"));
  });
});
