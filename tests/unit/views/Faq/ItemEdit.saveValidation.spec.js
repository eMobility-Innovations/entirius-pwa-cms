/**
 * plan-33 review item — ItemEdit.vue saveItem(): the required answer is validated before the request
 * (a field error on an empty answer, no API call).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useFormErrors } from "@/composables/useFormErrors";

const api = vi.hoisted(() => ({
  POST_FaqItem: vi.fn(),
  PATCH_FaqItem: vi.fn(),
}));
vi.mock("@/api/faq/api", () => ({
  ...api,
  DELETE_FaqItem: vi.fn(),
  GET_FaqItem: vi.fn(),
  GET_FaqItemTranslations: vi.fn(),
  POST_FaqItemTranslation: vi.fn(),
  PATCH_FaqItemTranslation: vi.fn(),
  GET_FaqGroups: vi.fn(),
  GET_FaqChannels: vi.fn(),
}));

import ItemEdit from "@/views/Faq/ItemEdit.vue";

function state(form) {
  return {
    form,
    isEdit: false,
    channel: "default-europe",
    formErrors: useFormErrors(),
    loader: { loaderStart: vi.fn(), loaderFinish: vi.fn() },
    notify: { spawnNotification: vi.fn() },
    $t: (key) => key,
    $router: { push: vi.fn() },
    $route: { params: {} },
  };
}

describe("FaqItemEdit.saveItem — required answer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks the request and sets a field error when the answer is empty", async () => {
    const ctx = state({ url_key: "shipping", question: "How long?", answer: "", short_answer: "" });
    await ItemEdit.methods.saveItem.call(ctx);

    expect(ctx.formErrors.getFieldError("answer")).toBeTruthy();
    expect(api.POST_FaqItem).not.toHaveBeenCalled();
    expect(api.PATCH_FaqItem).not.toHaveBeenCalled();
  });

  it("treats the editor's empty document (<p></p>, whitespace, &nbsp;) as an empty answer", async () => {
    for (const answer of ["<p></p>", "<p> </p>", "<p>&nbsp;</p><p><br></p>"]) {
      const ctx = state({ url_key: "shipping", question: "How long?", answer, short_answer: "" });
      await ItemEdit.methods.saveItem.call(ctx);
      expect(ctx.formErrors.getFieldError("answer")).toBeTruthy();
    }
    expect(api.POST_FaqItem).not.toHaveBeenCalled();
  });

  it("sends the request once every required field is filled", async () => {
    api.POST_FaqItem.mockResolvedValue({ data: { id: 7 } });
    const ctx = state({
      url_key: "shipping",
      question: "How long?",
      answer: "<p>2 days</p>",
      short_answer: "",
    });
    await ItemEdit.methods.saveItem.call(ctx);

    expect(ctx.formErrors.getFieldError("answer")).toBeFalsy();
    expect(api.POST_FaqItem).toHaveBeenCalledTimes(1);
  });
});
