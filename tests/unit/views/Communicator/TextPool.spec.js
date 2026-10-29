import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({ PATCH_SequenceText: vi.fn(), DELETE_SequenceText: vi.fn() }));
vi.mock("@/api/communicator/api", () => api);

import TextPool from "@/views/Communicator/TextPool.vue";
import { mountOptions } from "./communicatorFrame";

const texts = [
  { id: 1, body: "TEST follow-up 1/6", is_active: true },
  { id: 2, body: "TEST follow-up 2/6", is_active: false },
];
const mountPool = () => mount(TextPool, { props: { sequenceId: 4, texts }, ...mountOptions() });
const row = (wrapper, id) => wrapper.get(`[data-text="${id}"]`);

// UX-005: follow-up texts edit in place and are removed — a used text is deactivated, not deleted.
// C-33 (plan 55): a row is the text with its edit and remove squares.
describe("Communicator text pool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("the edit square opens the text for edit; Save sends the body and asks for a reload", async () => {
    api.PATCH_SequenceText.mockResolvedValue({ status: 200, data: {} });
    const wrapper = mountPool();
    await row(wrapper, 1).get('[data-testid="pool-text-edit"]').trigger("click");
    await row(wrapper, 1).get('[data-testid="pool-text-input"] textarea').setValue("Edited text");
    await row(wrapper, 1).get("form").trigger("submit");
    await flushPromises();
    expect(api.PATCH_SequenceText).toHaveBeenCalledWith(4, 1, { body: "Edited text" });
    expect(wrapper.emitted("changed")).toHaveLength(1);
    expect(wrapper.find('[data-testid="pool-text-input"]').exists()).toBe(false);
  });

  it("Cancel leaves the text as it was", async () => {
    const wrapper = mountPool();
    await row(wrapper, 1).get('[data-testid="pool-text-edit"]').trigger("click");
    await row(wrapper, 1).get('[data-testid="pool-text-cancel"]').trigger("click");
    expect(api.PATCH_SequenceText).not.toHaveBeenCalled();
    expect(row(wrapper, 1).text()).toContain("TEST follow-up 1/6");
  });

  it.each([
    [204, "Text removed"],
    [200, "Text was already used — deactivated"],
  ])("remove asks first, then a %s says what happened", async (code, message) => {
    api.DELETE_SequenceText.mockResolvedValue({ status: code, data: {} });
    const wrapper = mountPool();
    await row(wrapper, 1).get('[data-testid="pool-text-remove"]').trigger("click");
    expect(api.DELETE_SequenceText).not.toHaveBeenCalled();
    await wrapper.get('[data-testid="confirm-dialog-confirm"]').trigger("click");
    await flushPromises();
    expect(api.DELETE_SequenceText).toHaveBeenCalledWith(4, 1);
    expect(wrapper.get('[data-testid="pool-status"]').text()).toBe(message);
  });

  it("an inactive text stays listed, dimmed, not editable, with Restore", async () => {
    api.PATCH_SequenceText.mockResolvedValue({ status: 200, data: {} });
    const wrapper = mountPool();
    const inactive = row(wrapper, 2);
    expect(inactive.classes()).toContain("pool__item--inactive");
    expect(inactive.find('[data-testid="pool-text-edit"]').exists()).toBe(false);
    expect(inactive.find('[data-testid="pool-text-remove"]').exists()).toBe(false);
    await inactive.get('[data-testid="pool-text-restore"]').trigger("click");
    await flushPromises();
    expect(api.PATCH_SequenceText).toHaveBeenCalledWith(4, 2, { is_active: true });
  });

  it("a refused edit shows the API message", async () => {
    api.PATCH_SequenceText.mockRejectedValue({ error: "VALIDATION_ERROR", message: "Body too long" });
    const wrapper = mountPool();
    await row(wrapper, 1).get('[data-testid="pool-text-edit"]').trigger("click");
    await row(wrapper, 1).get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('[data-testid="pool-error"]').text()).toBe("Body too long");
  });
});
