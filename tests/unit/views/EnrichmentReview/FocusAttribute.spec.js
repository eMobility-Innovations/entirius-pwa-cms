import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, mount, enableAutoUnmount } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  PATCH_Proposal: vi.fn((id, body) => Promise.resolve({ data: { id, ...body } })),
}));
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/api/pim/api", () => ({ GET_Features: () => Promise.resolve({ data: { results: [], next: null } }) }));

import FocusAttribute from "@/views/EnrichmentReview/FocusAttribute.vue";

enableAutoUnmount(afterEach);

const proposal = (over = {}) => ({
  id: 5,
  target_kind: "attribute_value",
  target_locator: { feature_idx: "battery_capacity" },
  proposed_value: { value: "40" },
  current_snapshot: { value: null },
  ...over,
});
const Button = { props: ["type"], emits: ["click"], template: "<button :type='type || \"button\"' @click=\"$emit('click')\"><slot /></button>" };
const Input = { props: ["modelValue"], emits: ["update:modelValue"], template: "<input />" };

const render = (value) =>
  mount(FocusAttribute, {
    props: { proposal: value },
    global: { stubs: { BasicButton: Button, BasicInput: Input, TagChanges: { name: "TagChanges", template: "<i />" } } },
  });
const find = (w, id) => w.find(`[data-testid='${id}']`);

describe("FocusAttribute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the value with its unit on one row, with no Apply of its own", () => {
    const w = render(proposal());
    expect(find(w, "focus-attribute-value").text()).toBe("40 Ah");
    expect(w.text()).not.toContain("enrichment.review.apply");
  });

  it("says what a changed value was", () => {
    const w = render(proposal({ current_snapshot: { value: "21" } }));
    expect(find(w, "focus-attribute-before").exists()).toBe(true);
  });

  it("a select shows its chips and cannot be edited as text", () => {
    const w = render(proposal({ proposed_value: { options: ["hydraulic"] } }));
    expect(w.findComponent({ name: "TagChanges" }).exists()).toBe(true);
    expect(find(w, "focus-attribute-edit").exists()).toBe(false);
  });

  it("edits the number alone: the unit never reaches the value", async () => {
    const w = render(proposal());
    await find(w, "focus-attribute-edit").trigger("click");
    expect(w.vm.draft).toBe("40");
    w.vm.draft = "41";
    await w.find("form").trigger("submit");
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenCalledWith(5, { proposed_value: { value: "41" } });
    expect(w.emitted("updated")).toHaveLength(1);
  });

  it("asks the card to reject it", async () => {
    const w = render(proposal());
    await find(w, "focus-attribute-reject").trigger("click");
    expect(w.emitted("reject")[0][0].proposal.id).toBe(5);
  });
});
