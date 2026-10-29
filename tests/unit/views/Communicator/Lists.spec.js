import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const api = vi.hoisted(() => ({
  GET_Templates: vi.fn(),
  GET_Sequences: vi.fn(),
  GET_SequenceTexts: vi.fn(),
  POST_Sequence: vi.fn(),
  POST_SequenceText: vi.fn(),
  GET_Suppressions: vi.fn(),
  POST_Suppression: vi.fn(),
  DELETE_Suppression: vi.fn(),
}));
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/api/communicator/api", () => api);
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isModuleEnabled: () => false }) }));
vi.mock("vue-router", () => ({ useRouter: () => router }));

import SequenceList from "@/views/Communicator/SequenceList.vue";
import SettingsSuppressions from "@/views/Communicator/settings/SettingsSuppressions.vue";
import TemplateList from "@/views/Communicator/TemplateList.vue";
import { control } from "../Leads/leadsFrame";
import { mountOptions } from "./communicatorFrame";

const mountView = async (view) => {
  const wrapper = mount(view, mountOptions({ RouterLink: true, TextPool: true }));
  await flushPromises();
  return wrapper;
};

// Plan 55: the Communicator lists on DataTable — rows keep their test ids, enums read as words (C-13, C-39).
describe("Communicator lists", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    api.GET_Sequences.mockResolvedValue({ data: { results: [] } });
  });

  it("a template row opens the template and names its kind", async () => {
    api.GET_Templates.mockResolvedValue({ data: { results: [{ id: 3, key: "cold", kind: "ai_prompt", language: "pl", is_active: true }] } });
    const wrapper = await mountView(TemplateList);
    const row = wrapper.get('[data-testid="template-row"]');
    expect(row.text()).toContain("AI prompt");
    await row.trigger("click");
    expect(router.push).toHaveBeenCalledWith({ name: "CommunicatorTemplateEdit", params: { id: 3 } });
  });

  it("a sequence key outside letters, digits, - and _ is refused before the create", async () => {
    const wrapper = await mountView(SequenceList);
    await wrapper.get('[data-testid="sequence-key"] input').setValue("bad key");
    await wrapper.get('[data-testid="sequence-add"] form').trigger("submit");
    expect(api.POST_Sequence).not.toHaveBeenCalled();
    // Plan 54d: the error sits on the key field (FormField error, aria-invalid), not in the card.
    const field = wrapper.get('[data-testid="sequence-key"]').element.closest(".form-field");
    expect(field.querySelector(".form-field__error").textContent).toContain("A key may hold only letters, digits, “-” and “_”");
    expect(wrapper.get('[data-testid="sequence-key"] input').attributes("aria-invalid")).toBe("true");
    expect(wrapper.find('[data-testid="sequence-error"]').exists()).toBe(false);
  });

  // Plan 56b: the key error is live after the first refusal, and an older API error does not stay next to it.
  it("the key error clears while the operator fixes the key; a refused key drops the old API error", async () => {
    api.POST_Sequence.mockRejectedValueOnce({ response: { data: { detail: "Key taken" } } });
    const wrapper = await mountView(SequenceList);
    const key = () => wrapper.get('[data-testid="sequence-key"] input');
    const submit = async () => {
      await wrapper.get('[data-testid="sequence-add"] form').trigger("submit");
      await flushPromises();
    };
    await key().setValue("taken");
    await submit();
    expect(wrapper.get('[data-testid="sequence-error"]').text()).toBe("Key taken");
    await key().setValue("bad key");
    await submit();
    expect(wrapper.find('[data-testid="sequence-error"]').exists()).toBe(false);
    expect(key().attributes("aria-invalid")).toBe("true");
    await key().setValue("good_key");
    expect(key().attributes("aria-invalid")).toBeUndefined();
    expect(wrapper.get('[data-testid="sequence-key"]').element.closest(".form-field").querySelector(".form-field__error")).toBeNull();
  });

  it("a valid sequence is created with its steps numbered", async () => {
    api.POST_Sequence.mockResolvedValue({ data: {} });
    const wrapper = await mountView(SequenceList);
    await wrapper.get('[data-testid="sequence-key"] input').setValue("follow_up-2");
    await wrapper.get('[data-testid="sequence-add"] form').trigger("submit");
    await flushPromises();
    expect(api.POST_Sequence).toHaveBeenCalledWith({
      key: "follow_up-2",
      steps: [{ days_after_previous: 3, template_key: "", number: 1 }],
    });
  });

  it("suppressions name their kind and an erased address cannot be removed", async () => {
    api.GET_Suppressions.mockResolvedValue({
      data: { results: [{ id: 1, kind: "domain", value: "shop.test" }, { id: 2, kind: "email_token", value: "x" }] },
    });
    const wrapper = await mountView(SettingsSuppressions);
    const rows = wrapper.findAll('[data-testid="suppression-row"]');
    expect(rows.map((row) => row.find('[data-column="kindText"]').text())).toEqual(["Domain", "Erased address"]);
    expect(rows.map((row) => row.findAll("button").length)).toEqual([1, 0]);
    expect(control(wrapper, "suppression-kind").props("options").map((option) => option.label)).toEqual(["Email", "Domain"]);
  });
});
