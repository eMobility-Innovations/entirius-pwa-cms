import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const api = vi.hoisted(() => ({ GET_Template: vi.fn(), GET_Models: vi.fn(), PUT_Template: vi.fn(), POST_TestGenerate: vi.fn() }));
const leads = vi.hoisted(() => ({
  GET_Companies: vi.fn(),
  GET_Company: vi.fn(),
  GET_LeadTypes: vi.fn(() =>
    Promise.resolve({ data: { results: [{ code: "RETAILER", label: "Retailer", is_active: true }, { code: "OLD", label: "Old", is_active: false }] } })
  ),
}));
const modules = vi.hoisted(() => new Set(["leads", "communicator"]));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isModuleEnabled: (key) => modules.has(key) }) }));
vi.mock("@/api/communicator/api", () => api);
vi.mock("@/api/leads/api", () => leads);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("vue-router", () => ({ useRoute: () => ({ params: { id: "3" } }) }));

import TemplateEdit from "@/views/Communicator/TemplateEdit.vue";
import TestGenerate from "@/views/Communicator/TestGenerate.vue";
import { useConfigHealthStore } from "@/stores/configHealth";
import { control, setControl } from "../Leads/leadsFrame";
import { mountOptions } from "./communicatorFrame";

const template = { key: "cold", kind: "ai_prompt", language: "pl", subject: "Hi", body: "b", model: "fake-chat", json_schema: null, requires_legal_footer: true, auto_approve: false, is_active: true };

describe("Communicator TemplateEdit", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    api.GET_Template.mockResolvedValue({ data: template });
    api.GET_Models.mockResolvedValue({ data: { results: [{ provider: "fake", model_id: "fake-chat" }] } });
  });

  async function mountEdit() {
    // Attached: the header Save reaches the form through its `form` attribute, a document lookup.
    const wrapper = mount(TemplateEdit, { ...mountOptions({ RouterLink: true, SideDrawer: true }), attachTo: document.body });
    await flushPromises();
    return wrapper;
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("refuses invalid JSON schema and a non-object, saves a valid one parsed", async () => {
    api.PUT_Template.mockResolvedValue({ data: template });
    const wrapper = await mountEdit();
    const schema = wrapper.find('[data-testid="template-schema"] textarea');
    await schema.setValue("{oops");
    expect(wrapper.find('[data-testid="template-schema-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="template-save"]').attributes("disabled")).toBeDefined();
    expect(wrapper.find('[data-testid="template-versions"]').attributes("disabled")).toBeUndefined();
    await schema.setValue("[1]");
    expect(wrapper.find('[data-testid="template-schema-error"]').exists()).toBe(true);
    await schema.setValue('{"type": "object"}');
    await wrapper.get('[data-testid="template-save"]').trigger("click");
    await flushPromises();
    expect(api.PUT_Template).toHaveBeenCalledWith("3", expect.objectContaining({ json_schema: { type: "object" }, auto_approve: false }));
  });

  it("offers the models from GET models/", async () => {
    const wrapper = await mountEdit();
    expect(control(wrapper, "template-model").props("options").map((option) => option.label)).toEqual(["—", "fake-chat (fake)"]);
  });

  const headerAction = (wrapper, testid) => wrapper.get(`[data-testid="${testid}"]`);
  const toolbox = (state) => (useConfigHealthStore().checks = [{ code: "toolbox.status", state, scope: "" }]);

  it.each(["disabled", "unconfigured"])("toolbox %s: an AI template asks for no models and cannot be test-generated", async (state) => {
    toolbox(state);
    const wrapper = await mountEdit();
    expect(api.GET_Models).not.toHaveBeenCalled();
    expect(control(wrapper, "template-model").props("options")).toHaveLength(1);
    expect(control(wrapper, "template-model").attributes("disabled")).toBeDefined();
    expect(headerAction(wrapper, "template-test-generate").attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="ai-toolbox-hint"]').attributes("data-state")).toBe(state);
  });

  it("toolbox disabled: a static template keeps test generate and shows no hint", async () => {
    toolbox("disabled");
    api.GET_Template.mockResolvedValue({ data: { ...template, kind: "static" } });
    const wrapper = await mountEdit();
    expect(headerAction(wrapper, "template-test-generate").attributes("disabled")).toBeUndefined();
    expect(wrapper.find('[data-testid="ai-toolbox-hint"]').exists()).toBe(false);
  });

  it("toolbox unreachable: the models are asked for and test generate stays available", async () => {
    toolbox("unreachable");
    const wrapper = await mountEdit();
    expect(api.GET_Models).toHaveBeenCalledTimes(1);
    expect(headerAction(wrapper, "template-test-generate").attributes("disabled")).toBeUndefined();
  });

  it("test generate shows the preview and never saves the template", async () => {
    leads.GET_Companies.mockResolvedValue({ data: { results: [{ id: 9, domain: "shop.test" }] } });
    leads.GET_Company.mockResolvedValue({ data: { id: 9, name: "Shop", domain: "shop.test", hooks: [], contacts: [{ is_primary: true, first_name: "Anna" }] } });
    api.POST_TestGenerate.mockResolvedValue({ data: { subject: "Subj", body_text: "One\n\nTwo" } });
    const wrapper = mount(TestGenerate, { props: { templateId: "3" }, ...mountOptions() });
    await wrapper.find('[data-testid="test-generate-search"] input').setValue("shop");
    await flushPromises();
    await wrapper.find('[data-testid="test-generate-company"]').trigger("click");
    await flushPromises();
    expect(api.POST_TestGenerate).toHaveBeenCalledWith("3", expect.objectContaining({ company_name: "Shop", first_name: "Anna" }));
    expect(wrapper.find('[data-testid="test-generate-subject"]').text()).toBe("Subj");
    expect(wrapper.findAll('[data-testid="test-generate-preview"] p')).toHaveLength(3);
    expect(api.PUT_Template).not.toHaveBeenCalled();
  });

  // UX-004: a template targets a lead type; blank = every type. Without leads the select is gone and the stored
  // audience travels back unchanged; a communicator without audiences never gets the field.
  it("the Audience select lists the active lead types and saves the choice", async () => {
    api.GET_Template.mockResolvedValue({ data: { ...template, audience: "" } });
    api.PUT_Template.mockResolvedValue({ data: { ...template, audience: "RETAILER" } });
    const wrapper = await mountEdit();
    const select = control(wrapper, "template-audience");
    expect(select.props("options").map((option) => option.label)).toEqual(["All types", "Retailer"]);
    await setControl(wrapper, "template-audience", "RETAILER");
    await wrapper.get('[data-testid="template-save"]').trigger("click");
    await flushPromises();
    expect(api.PUT_Template).toHaveBeenCalledWith("3", expect.objectContaining({ audience: "RETAILER" }));
  });

  // Plan 55: Save sits in the page header, outside the form — it still runs the form's required checks first.
  it("Save refuses an empty body before any request", async () => {
    const wrapper = await mountEdit();
    await wrapper.get('[data-testid="template-body"] textarea').setValue("");
    await wrapper.get('[data-testid="template-save"]').trigger("click");
    await flushPromises();
    expect(api.PUT_Template).not.toHaveBeenCalled();
  });

  it("Enter in Language or Subject saves: the header Save is the form's submit button", async () => {
    api.PUT_Template.mockResolvedValue({ data: template });
    const wrapper = await mountEdit();
    const save = wrapper.get('[data-testid="template-save"]').element;
    expect(save.type).toBe("submit");
    expect(save.form).toBe(wrapper.get("form").element);
    wrapper.get("form").element.requestSubmit(save);
    await flushPromises();
    expect(api.PUT_Template).toHaveBeenCalledTimes(1);
  });

  it("a second submit while the save is in flight sends nothing", async () => {
    let answer;
    api.PUT_Template.mockImplementation(() => new Promise((resolve) => (answer = () => resolve({ data: template }))));
    const wrapper = await mountEdit();
    const form = wrapper.get("form").element;
    form.requestSubmit();
    form.requestSubmit();
    await flushPromises();
    expect(api.PUT_Template).toHaveBeenCalledTimes(1);
    answer();
    await flushPromises();
    form.requestSubmit();
    expect(api.PUT_Template).toHaveBeenCalledTimes(2);
  });

  // A disabled default button blocks implicit submission (HTML): with a broken schema Enter does not save either.
  it("with a broken schema the form's submit button is disabled", async () => {
    const wrapper = await mountEdit();
    await wrapper.get('[data-testid="template-schema"] textarea').setValue("{oops");
    const save = wrapper.get('[data-testid="template-save"]').element;
    expect(save.form).toBe(wrapper.get("form").element);
    expect(save.disabled).toBe(true);
  });

  // C-39 (plan 55): the kind reads as words, the raw enum is only the value.
  it("the kind select offers the kinds as labels", async () => {
    const wrapper = await mountEdit();
    const kind = control(wrapper, "template-kind");
    expect(kind.props("modelValue")).toBe("ai_prompt");
    expect(kind.props("options")).toEqual([
      { value: "static", label: "Static text" },
      { value: "ai_prompt", label: "AI prompt" },
    ]);
  });

  it("without the leads module there is no select and the audience goes back unchanged", async () => {
    modules.delete("leads");
    api.GET_Template.mockResolvedValue({ data: { ...template, audience: "OLD" } });
    api.PUT_Template.mockResolvedValue({ data: template });
    const wrapper = await mountEdit();
    expect(wrapper.find('[data-testid="template-audience"]').exists()).toBe(false);
    await wrapper.get('[data-testid="template-save"]').trigger("click");
    await flushPromises();
    expect(api.PUT_Template).toHaveBeenCalledWith("3", expect.objectContaining({ audience: "OLD" }));
    modules.add("leads");
  });

  it("a communicator without audiences never receives the field", async () => {
    api.PUT_Template.mockResolvedValue({ data: template });
    const wrapper = await mountEdit();
    expect(wrapper.find('[data-testid="template-audience"]').exists()).toBe(false);
    await wrapper.get('[data-testid="template-save"]').trigger("click");
    await flushPromises();
    expect(api.PUT_Template.mock.calls[0][1]).not.toHaveProperty("audience");
  });
});
