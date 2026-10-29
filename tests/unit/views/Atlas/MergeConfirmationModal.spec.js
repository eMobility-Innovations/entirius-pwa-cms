import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockPostMergeByEan = vi.fn();

vi.mock("@/api/atlas/api", () => ({
  POST_MergeByEan: (...args) => mockPostMergeByEan(...args),
}));

import MergeConfirmationModal from "@/views/Atlas/components/MergeConfirmationModal.vue";

const globalStubs = {
  BasicModal: {
    name: "BasicModal",
    props: ["open"],
    template: "<div class='stub-modal'><slot name='title' /><slot /><slot name='footer' /></div>",
  },
  FormField: {
    name: "FormField",
    props: ["label"],
    template: "<div class='stub-field' :data-label='label'><slot /></div>",
  },
  BasicTextarea: {
    name: "BasicTextarea",
    props: ["modelValue", "disabled"],
    emits: ["update:modelValue"],
    template:
      "<textarea :value='modelValue' :disabled='disabled' @input=\"$emit('update:modelValue', $event.target.value)\"></textarea>",
  },
  BasicButton: {
    name: "BasicButton",
    props: ["text", "disabled"],
    emits: ["click"],
    template:
      "<button :disabled='disabled' @click=\"$emit('click')\">{{ text }}</button>",
  },
  FontAwesomeIcon: true,
};

function mountModal(props = {}) {
  return mount(MergeConfirmationModal, {
    props: { winnerSku: "FT-A", loserSku: "KH-B", ...props },
    global: { stubs: globalStubs },
  });
}

describe("MergeConfirmationModal.vue", () => {
  beforeEach(() => {
    mockPostMergeByEan.mockReset();
  });

  it("disables Confirm until reason has at least 3 chars", async () => {
    const wrapper = mountModal();
    const confirmBtn = wrapper.find("[data-test='merge-confirm-submit']");
    expect(confirmBtn.attributes("disabled")).toBeDefined();
    await wrapper.find("textarea").setValue("ok");
    expect(confirmBtn.attributes("disabled")).toBeDefined();
    await wrapper.find("textarea").setValue("real reason");
    expect(confirmBtn.attributes("disabled")).toBeUndefined();
  });

  it("emits cancelled when Cancel is clicked", async () => {
    const wrapper = mountModal();
    await wrapper.find("[data-test='merge-confirm-cancel']").trigger("click");
    expect(wrapper.emitted("cancelled")).toBeTruthy();
  });

  it("posts to merge-by-ean and emits confirmed on success", async () => {
    mockPostMergeByEan.mockResolvedValue({
      data: {
        winner_sku: "FT-A",
        loser_sku: "KH-B",
        links_redirected: 2,
        supplier_products_repointed: 2,
        audit_id: 42,
      },
    });
    const wrapper = mountModal();
    await wrapper.find("textarea").setValue("merge for E2E");
    await wrapper.find("[data-test='merge-confirm-submit']").trigger("click");
    await flushPromises();
    expect(mockPostMergeByEan).toHaveBeenCalledWith({
      winner_sku: "FT-A",
      loser_sku: "KH-B",
      reason: "merge for E2E",
    });
    expect(wrapper.emitted("confirmed")).toBeTruthy();
    expect(wrapper.emitted("confirmed")[0][0].winner_sku).toBe("FT-A");
  });

  it("shows error text and does not emit confirmed on API failure", async () => {
    mockPostMergeByEan.mockRejectedValue({
      response: { data: { message: "EAN mismatch" } },
    });
    const wrapper = mountModal();
    await wrapper.find("textarea").setValue("trigger error");
    await wrapper.find("[data-test='merge-confirm-submit']").trigger("click");
    await flushPromises();
    expect(wrapper.vm.errorText).toContain("EAN mismatch");
    expect(wrapper.emitted("confirmed")).toBeFalsy();
  });

  it("blocks Cancel while loading", async () => {
    let resolveFn;
    mockPostMergeByEan.mockReturnValue(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );
    const wrapper = mountModal();
    await wrapper.find("textarea").setValue("long enough reason");
    await wrapper.find("[data-test='merge-confirm-submit']").trigger("click");
    // While loading, cancel should not emit
    await wrapper.find("[data-test='merge-confirm-cancel']").trigger("click");
    expect(wrapper.emitted("cancelled")).toBeFalsy();
    resolveFn({ data: { winner_sku: "FT-A", loser_sku: "KH-B", links_redirected: 1 } });
    await flushPromises();
  });
});
