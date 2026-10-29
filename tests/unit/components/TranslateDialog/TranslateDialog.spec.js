// Plan 50: the one translate dialog of Pim product, Pim store and Pages. The dialog builds the request per scope and
// hands it to the caller's estimateFn / submitFn; these specs pin those calls and how each estimate reads.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const spawnNotification = vi.fn();
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification }) }));

import TranslateDialog from "@/components/TranslateDialog/index.vue";
import RealBasicSelect from "@/boots/BasicSelect/index.vue";
import { t } from "@/i18n";
import { useConfigHealthStore } from "@/stores/configHealth";
import { DescribedFormField, FIELD_DESCRIPTION } from "../../helpers/describedFormField";

const BasicModal = { name: "BasicModal", props: ["open", "actions", "title"], template: "<div v-if='open'><slot /></div>" };
const BasicSelect = { name: "BasicSelect", props: ["modelValue", "options", "multiple"], template: "<div />" };
const BasicCheckbox = { name: "BasicCheckbox", props: ["modelValue"], template: "<label><slot /></label>" };
const DataTable = { name: "DataTable", props: ["columns", "rows"], template: "<div />" };
const stubs = { BasicModal, BasicSelect, BasicCheckbox, DataTable, Tag: true, FormField: { template: "<div><slot /></div>" } };

const LANGUAGES = ["pl", "en", "de"].map((value) => ({ label: value.toUpperCase(), value }));

function build(scope, fns = {}) {
  const estimateFn = fns.estimateFn || vi.fn().mockResolvedValue({ per_language: [], estimated_cost_usd: 0 });
  const submitFn = fns.submitFn || vi.fn().mockResolvedValue(2);
  const wrapper = mount(TranslateDialog, {
    props: { open: true, scope, languages: LANGUAGES, sourceLanguage: "pl", estimateFn, submitFn },
    global: { stubs },
  });
  return { wrapper, estimateFn, submitFn };
}

const action = (wrapper, key) => wrapper.findComponent(BasicModal).props("actions").find((a) => a.key === key);
const pickTargets = async (wrapper, targets) => {
  wrapper.findAllComponents(BasicSelect)[1].vm.$emit("update:modelValue", targets);
  await wrapper.vm.$nextTick();
};
async function estimateThenConfirm(wrapper) {
  await action(wrapper, "estimate").onClick();
  await flushPromises();
  await action(wrapper, "confirm").onClick();
  await flushPromises();
}

beforeEach(() => {
  setActivePinia(createPinia());
  spawnNotification.mockClear();
});

describe("TranslateDialog — AI toolbox state", () => {
  const toolbox = (state) => (useConfigHealthStore().checks = [{ code: "toolbox.status", state, scope: "" }]);

  it.each(["disabled", "unconfigured"])("%s: the hint shows and Estimate stays off with the languages picked", async (state) => {
    toolbox(state);
    const { wrapper } = build("product");
    await pickTargets(wrapper, ["en"]);
    expect(wrapper.get('[data-testid="ai-toolbox-hint"]').attributes("data-state")).toBe(state);
    expect(action(wrapper, "estimate").disabled).toBe(true);
  });

  it("unreachable: the hint warns and Estimate stays available", async () => {
    toolbox("unreachable");
    const { wrapper } = build("product");
    await pickTargets(wrapper, ["en"]);
    expect(wrapper.get('[data-testid="ai-toolbox-hint"]').attributes("data-state")).toBe("unreachable");
    expect(action(wrapper, "estimate").disabled).toBe(false);
  });
});

describe("TranslateDialog — product scope", () => {
  it("estimates, then submits the same request with the estimate", async () => {
    const estimate = { per_language: [{ language: "en", items: 3, chars: 1200, cost_usd: 0.5 }], estimated_cost_usd: 0.5 };
    const { wrapper, estimateFn, submitFn } = build("product", { estimateFn: vi.fn().mockResolvedValue(estimate) });
    await pickTargets(wrapper, ["en"]);
    await estimateThenConfirm(wrapper);

    const request = { source_language: "pl", target_languages: ["en"], force: false };
    expect(estimateFn).toHaveBeenCalledWith(request);
    expect(submitFn).toHaveBeenCalledWith(request, estimate);
    expect(spawnNotification).toHaveBeenCalledWith({ type: "positive", msg: t("translate_dialog.jobs_created", { count: 2 }) });
    expect(wrapper.emitted("translated")).toHaveLength(1);
    expect(wrapper.emitted("update:open").at(-1)).toEqual([false]);
  });

  it("reads the estimate per language with the total row last", async () => {
    const estimate = { per_language: [{ language: "en", items: 3, chars: 1200, cost_usd: 0.5 }], estimated_cost_usd: 0.5 };
    const { wrapper } = build("product", { estimateFn: vi.fn().mockResolvedValue(estimate) });
    await pickTargets(wrapper, ["en"]);
    await action(wrapper, "estimate").onClick();
    await flushPromises();

    const rows = wrapper.findComponent(DataTable).props("rows");
    expect(rows.map((row) => [row.label, row.items, row.cost])).toEqual([
      ["EN", 3, "$0.5000"],
      [t("translate_dialog.total"), null, "$0.5000"],
    ]);
  });

  it("drops an estimate that answers after the dialog closed", async () => {
    let answer;
    const estimateFn = vi.fn(() => new Promise((resolve) => (answer = resolve)));
    const { wrapper } = build("product", { estimateFn });
    await pickTargets(wrapper, ["en"]);
    action(wrapper, "estimate").onClick();
    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });
    answer({ per_language: [], estimated_cost_usd: 0 });
    await flushPromises();

    expect(wrapper.find('[data-testid="translate-dialog-config"]').exists()).toBe(true);
    expect(action(wrapper, "estimate").loading).toBe(false);
  });

  it("offers no target equal to the source and drops it when the source changes", async () => {
    const { wrapper } = build("product");
    await pickTargets(wrapper, ["en", "de"]);
    expect(wrapper.findAllComponents(BasicSelect)[1].props("options").map((o) => o.value)).toEqual(["en", "de"]);
    wrapper.findAllComponents(BasicSelect)[0].vm.$emit("update:modelValue", "en");
    await wrapper.vm.$nextTick();
    expect(wrapper.findAllComponents(BasicSelect)[1].props("modelValue")).toEqual(["de"]);
  });

  it("cannot estimate without a target and keeps the config step when the estimate fails", async () => {
    const { wrapper } = build("product", { estimateFn: vi.fn().mockRejectedValue(new Error("down")) });
    expect(action(wrapper, "estimate").disabled).toBe(true);
    await pickTargets(wrapper, ["en"]);
    await action(wrapper, "estimate").onClick();
    await flushPromises();
    expect(spawnNotification).toHaveBeenCalledWith(expect.objectContaining({ type: "negative" }));
    expect(action(wrapper, "estimate")).toBeTruthy();
  });
});

describe("TranslateDialog — store scope", () => {
  const estimates = [
    { entity_type: "product", estimated_items: 4, total_chars: 1000, estimated_cost_usd: "0.2" },
    { entity_type: "category", estimated_items: 1, total_chars: 200, estimated_cost_usd: "0.1" },
  ];

  it("sends the content types left on and sums the estimate per type", async () => {
    const { wrapper, estimateFn, submitFn } = build("store", { estimateFn: vi.fn().mockResolvedValue(estimates) });
    await pickTargets(wrapper, ["en"]);
    const [feature, attribute] = wrapper.findAllComponents(BasicCheckbox).slice(2, 4);
    feature.vm.$emit("update:modelValue", false);
    attribute.vm.$emit("update:modelValue", false);
    await estimateThenConfirm(wrapper);

    const request = { source_language: "pl", target_languages: ["en"], force: false, entity_types: ["product", "category"] };
    expect(estimateFn).toHaveBeenCalledWith(request);
    expect(submitFn).toHaveBeenCalledWith(request, estimates);
  });

  it("totals items, characters and cost over the types", async () => {
    const { wrapper } = build("store", { estimateFn: vi.fn().mockResolvedValue(estimates) });
    await pickTargets(wrapper, ["en"]);
    await action(wrapper, "estimate").onClick();
    await flushPromises();
    const total = wrapper.findComponent(DataTable).props("rows").at(-1);
    expect([total.items, total.chars, total.cost]).toEqual([5, (1200).toLocaleString(), "$0.3000"]);
  });

  it("cannot estimate with every content type off", async () => {
    const { wrapper } = build("store");
    await pickTargets(wrapper, ["en"]);
    for (const box of wrapper.findAllComponents(BasicCheckbox).slice(0, 4)) box.vm.$emit("update:modelValue", false);
    await wrapper.vm.$nextTick();
    expect(action(wrapper, "estimate").disabled).toBe(true);
  });
});

describe("TranslateDialog — content scope", () => {
  it("sends publish and lists the pages of the estimate", async () => {
    const estimate = { per_language: [], estimated_cost_usd: 0, per_draft: [{ draft_name: "Home", items: 2, chars: 90 }] };
    const { wrapper, estimateFn, submitFn } = build("content", { estimateFn: vi.fn().mockResolvedValue(estimate) });
    await pickTargets(wrapper, ["en", "de"]);
    const publish = wrapper.findAllComponents(BasicCheckbox).at(-1);
    publish.vm.$emit("update:modelValue", true);
    await estimateThenConfirm(wrapper);

    const request = { source_language: "pl", target_languages: ["en", "de"], force: false, publish: true };
    expect(estimateFn).toHaveBeenCalledWith(request);
    expect(submitFn).toHaveBeenCalledWith(request, estimate);
  });

  it("shows the per-page table only for content", async () => {
    const estimate = { per_language: [], estimated_cost_usd: 0, per_draft: [{ draft_name: "Home", items: 2, chars: 90 }] };
    const { wrapper } = build("content", { estimateFn: vi.fn().mockResolvedValue(estimate) });
    await pickTargets(wrapper, ["en"]);
    await action(wrapper, "estimate").onClick();
    await flushPromises();
    const tables = wrapper.findAllComponents(DataTable);
    expect(tables).toHaveLength(2);
    expect(tables[1].props("rows")).toEqual([{ key: "Home", name: "Home", items: 2, chars: "90" }]);
  });
});

describe("TranslateDialog — no target language", () => {
  it("shows why the list is empty and links the note to the select", () => {
    const wrapper = mount(TranslateDialog, {
      props: { open: true, scope: "product", languages: LANGUAGES.slice(0, 1), sourceLanguage: "pl", estimateFn: vi.fn(), submitFn: vi.fn() },
      global: { stubs },
    });
    const note = wrapper.find("p[id]");
    expect(note.text()).toBe(t("translate_dialog.no_languages"));
    expect(wrapper.findAllComponents(BasicSelect)[1].attributes("aria-describedby")).toBe(note.attributes("id"));
  });

  // Plan 61e: the note joins the field's own description on the rendered control, never replaces it.
  it("keeps the field's description next to the note's id", () => {
    const wrapper = mount(TranslateDialog, {
      props: { open: true, scope: "product", languages: LANGUAGES.slice(0, 1), sourceLanguage: "pl", estimateFn: vi.fn(), submitFn: vi.fn() },
      global: { stubs: { ...stubs, BasicSelect: false, FormField: DescribedFormField }, components: { BasicSelect: RealBasicSelect } },
    });
    const noteId = wrapper.get("p[id]").attributes("id");
    const targets = wrapper.findAll('[role="combobox"]')[1];
    expect(targets.attributes("aria-describedby")).toBe(`${FIELD_DESCRIPTION} ${noteId}`);
  });
});

describe("TranslateDialog — target languages available", () => {
  it("adds no description of its own to the select", () => {
    const { wrapper } = build("product");
    expect(wrapper.find("p[id]").exists()).toBe(false);
    expect(wrapper.findAllComponents(BasicSelect)[1].attributes("aria-describedby")).toBeUndefined();
  });
});
