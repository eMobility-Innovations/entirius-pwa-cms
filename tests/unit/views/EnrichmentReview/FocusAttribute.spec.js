import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushPromises, mount, enableAutoUnmount } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  GET_ProposalRevisions: vi.fn(() => Promise.resolve({ data: [] })),
  PATCH_Proposal: vi.fn((id, body) =>
    Promise.resolve({ data: { id, ...body } }),
  ),
}));
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/api/integrator/review", () => ({
  getReviewProduct: vi.fn(),
  sendBack: vi.fn(),
  getMissing: vi.fn(),
  fillMissing: vi.fn(),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: vi.fn() }),
}));
vi.mock("@/api/pim/api", () => ({
  GET_Features: () => Promise.resolve({ data: { results: [], next: null } }),
}));

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
const Button = {
  props: ["type"],
  emits: ["click"],
  template:
    "<button :type='type || \"button\"' @click=\"$emit('click')\"><slot /></button>",
};
const Input = {
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: "<input />",
};

const render = (value, props = {}) =>
  mount(FocusAttribute, {
    props: { proposal: value, ...props },
    global: {
      stubs: {
        BasicButton: Button,
        BasicInput: Input,
        TagChanges: { name: "TagChanges", template: "<i />" },
      },
    },
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
    expect(api.PATCH_Proposal).toHaveBeenCalledWith(5, {
      proposed_value: { value: "41" },
    });
    expect(w.emitted("updated")).toHaveLength(1);
  });

  it("has no Reject action", () => {
    const w = render(proposal());
    expect(find(w, "focus-attribute-reject").exists()).toBe(false);
    expect(w.text()).not.toMatch(/reject/i);
  });

  it("labels different round values separately and shows the AI verdict and rationale", async () => {
    const w = render(proposal(), {
      reviewItem: {
        ai_value: { value: "40" },
        ecom_value: { value: "41" },
        verdict: "ecom",
        rationale: "The label confirms 41 Ah.",
      },
    });
    await flushPromises();
    expect(find(w, "focus-attribute-ai").text()).toContain("ai_label");
    expect(find(w, "focus-attribute-ai").text()).toContain("40 Ah");
    expect(find(w, "focus-attribute-ecom").text()).toContain("ecom_label");
    expect(find(w, "focus-attribute-ecom").text()).toContain("41 Ah");
    expect(find(w, "focus-attribute-verdict").text()).toContain("verdict_ecom");
    expect(find(w, "focus-attribute-verdict").text()).toContain(
      "The label confirms 41 Ah.",
    );
  });

  it("does not split identical AI and Ecom values", async () => {
    const w = render(proposal(), {
      reviewItem: { ai_value: { value: "40" }, ecom_value: { value: "40" } },
    });
    await flushPromises();
    expect(find(w, "focus-attribute-ai").exists()).toBe(false);
    expect(find(w, "focus-attribute-ecom").exists()).toBe(false);
    expect(find(w, "focus-attribute-value").text()).toBe("40 Ah");
  });

  it("uses revisions for unsent edits instead of an older round", async () => {
    api.GET_ProposalRevisions.mockResolvedValueOnce({
      data: [
        { author_kind: "ai", value: { value: "42" } },
        { author_kind: "user", value: { value: "43" } },
      ],
    });
    const w = render(proposal({ proposed_value: { value: "43" } }), {
      reviewItem: {
        ai_value: { value: "40" },
        ecom_value: { value: "41" },
      },
    });
    await flushPromises();
    expect(api.GET_ProposalRevisions).toHaveBeenCalledWith(5);
    expect(find(w, "focus-attribute-ai").text()).toContain("42 Ah");
    expect(find(w, "focus-attribute-ecom").text()).toContain("43 Ah");
  });

  it("shows both values immediately after saving an edit", async () => {
    api.GET_ProposalRevisions.mockResolvedValueOnce({
      data: [{ author_kind: "ai", value: { value: "40" } }],
    });
    const w = render(proposal());
    await flushPromises();
    await find(w, "focus-attribute-edit").trigger("click");
    w.vm.draft = "41";
    await w.find("form").trigger("submit");
    await flushPromises();
    expect(find(w, "focus-attribute-ai").text()).toContain("40 Ah");
    expect(find(w, "focus-attribute-ecom").text()).toContain("41 Ah");
  });

  it("has no Save or Cancel button: it saves on Enter or when the field loses focus", async () => {
    const w = render(proposal());
    await find(w, "focus-attribute-edit").trigger("click");
    expect(find(w, "focus-attribute-save").exists()).toBe(false);
    expect(w.text()).not.toContain("common.cancel");
    w.vm.draft = "41";
    w.findComponent(Input).vm.$emit("onFocusout", "41");
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenCalledTimes(1);
  });

  it("closes an unchanged edit without saving, and Esc cancels", async () => {
    const w = render(proposal());
    await find(w, "focus-attribute-edit").trigger("click");
    w.findComponent(Input).vm.$emit("onFocusout", "");
    await flushPromises();
    expect(api.PATCH_Proposal).not.toHaveBeenCalled();
    expect(find(w, "focus-attribute-input").exists()).toBe(false);
    await find(w, "focus-attribute-edit").trigger("click");
    w.vm.draft = "99";
    await w.find("form").trigger("keydown", { key: "Escape" });
    expect(find(w, "focus-attribute-input").exists()).toBe(false);
    expect(api.PATCH_Proposal).not.toHaveBeenCalled();
  });

  it("does not save an open edit form after the card becomes busy", async () => {
    const w = render(proposal());
    await find(w, "focus-attribute-edit").trigger("click");
    await w.setProps({ busy: true });
    expect(
      find(w, "focus-attribute-input").attributes("disabled"),
    ).toBeDefined();
    await w.find("form").trigger("submit");
    expect(api.PATCH_Proposal).not.toHaveBeenCalled();
    expect(w.emitted("saving")).toBeUndefined();
  });

  it("prevents duplicate saves and tells the product when saving starts and ends", async () => {
    let resolve;
    api.PATCH_Proposal.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const w = render(proposal());
    await find(w, "focus-attribute-edit").trigger("click");
    w.vm.draft = "41";
    await w.find("form").trigger("submit");
    expect(w.emitted("saving")).toEqual([[true]]);
    await w.find("form").trigger("submit");
    expect(api.PATCH_Proposal).toHaveBeenCalledTimes(1);
    resolve({ data: { id: 5, proposed_value: { value: "41" } } });
    await flushPromises();
    expect(w.emitted("saving")).toEqual([[true], [false]]);
  });
});
