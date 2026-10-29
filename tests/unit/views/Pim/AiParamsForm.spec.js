import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AiParamsForm from "@/views/Pim/components/enrichment/AiParamsForm.vue";
import { buildFields } from "@/views/Pim/components/enrichment/aiTaskForm";

const WRITE = {
  properties: {
    channel: { type: "string" },
    fields: { type: "array", items: { type: "string" } },
    languages: { type: "array", items: { type: "string" } },
    prompt: { type: "string", default: "" },
  },
  required: ["channel", "fields", "languages"],
};

const BasicCheckbox = {
  name: "BasicCheckbox",
  props: ["modelValue", "disabled"],
  emits: ["update:modelValue"],
  template: "<label><slot /></label>",
};
const stubs = {
  BasicCheckbox,
  BasicSelect: { name: "BasicSelect", props: ["modelValue", "options", "disabled", "placeholder"], template: "<div />" },
  BasicTextarea: true,
  BasicRadioGroup: { name: "BasicRadioGroup", props: ["modelValue", "options"], emits: ["update:modelValue"], template: "<div />" },
  FormField: { template: "<div><slot /></div>" },
};

function mountForm(props = {}) {
  return mount(AiParamsForm, {
    props: {
      fields: buildFields(WRITE, "write"),
      modelValue: { fields: [], languages: ["*"], prompt: "" },
      languages: ["pl", "en"],
      fieldChoices: [{ label: "Meta title", value: "meta_title" }],
      researchKeys: ["seo_brief"],
      research: { augment: [], seo_scope: "category" },
      ...props,
    },
    global: { stubs },
  });
}

const lastValue = (w) => w.emitted("update:modelValue").at(-1)[0];

describe("AiParamsForm", () => {
  it("All languages hides the single languages; unticking it starts from the main language", async () => {
    const w = mountForm();
    expect(w.findAllComponents(BasicCheckbox).map((c) => c.text())).toEqual([
      "enrichment.run.all_languages",
      "enrichment.run.research_seo_brief",
    ]);
    w.findComponent("[data-testid='ai-task-all-languages']").vm.$emit("update:modelValue", false);
    expect(lastValue(w).languages).toEqual(["pl"]);

    await w.setProps({ modelValue: { fields: [], languages: ["pl"], prompt: "" } });
    expect(w.findAllComponents(BasicCheckbox).map((c) => c.text())).toContain("EN");
  });

  it("the field picker offers the catalog's fields for the kind", () => {
    const w = mountForm();
    const picker = w.findComponent("[data-testid='ai-task-param-fields']");
    expect(picker.props("options")).toEqual([{ label: "Meta title", value: "meta_title" }]);
    picker.vm.$emit("update:modelValue", ["meta_title"]);
    expect(lastValue(w).fields).toEqual(["meta_title"]);
  });

  it("without fields in the catalog the picker says so and stays off", () => {
    const w = mountForm({ fieldChoices: [] });
    const picker = w.findComponent("[data-testid='ai-task-param-fields']");
    expect(picker.props()).toMatchObject({ disabled: true, placeholder: "enrichment.run.no_fields" });
  });

  it("SEO research toggles; its scope shows once it is on", async () => {
    const w = mountForm();
    expect(w.findComponent({ name: "BasicRadioGroup" }).exists()).toBe(false);
    w.findComponent("[data-testid='ai-task-research-seo_brief']").vm.$emit("update:modelValue", true);
    expect(w.emitted("update:research")[0][0]).toEqual({ augment: ["seo_brief"], seo_scope: "category" });

    await w.setProps({ research: { augment: ["seo_brief"], seo_scope: "category" } });
    const scope = w.findComponent({ name: "BasicRadioGroup" });
    expect(scope.props("options").map((o) => o.value)).toEqual(["category", "subject"]);
    scope.vm.$emit("update:modelValue", "subject");
    expect(w.emitted("update:research")[1][0]).toEqual({ augment: ["seo_brief"], seo_scope: "subject" });
  });

  it("no research for kinds that take none", () => {
    const w = mountForm({ researchKeys: [] });
    expect(w.find("[data-testid='ai-task-research']").exists()).toBe(false);
  });
});
