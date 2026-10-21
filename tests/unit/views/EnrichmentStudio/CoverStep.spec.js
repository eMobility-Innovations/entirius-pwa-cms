import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  GET_Proposal: vi.fn(),
  GET_Run: vi.fn(),
  GET_Task: vi.fn(),
  GET_StagedFile: vi.fn(),
  PATCH_Proposal: vi.fn(),
  POST_AcceptProposal: vi.fn(),
  POST_RegenerateStep: vi.fn(),
}));
const notify = vi.fn();
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));

import CoverVariants from "@/views/EnrichmentStudio/CoverVariants.vue";
import DocumentSummary from "@/views/EnrichmentStudio/DocumentSummary.vue";
import ScenesList from "@/views/EnrichmentStudio/ScenesList.vue";
import StepPanel from "@/views/EnrichmentStudio/StepPanel.vue";
import BasicRadioGroup from "@/boots/BasicRadioGroup/index.vue";

const BasicTextarea = {
  name: "BasicTextarea",
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: "<textarea :value='modelValue' />",
};
const ActionBar = {
  name: "ActionBar",
  props: ["actions"],
  template: "<div><button v-for='a in actions' :key='a.key' :data-testid='a.testid' :disabled='a.disabled || a.loading' @click='a.onClick'>{{ a.label }}</button></div>",
};
const stubs = {
  BasicTextarea, ActionBar,
  BasicModal: { name: "BasicModal", props: ["open"], template: "<div v-if='open'><slot /></div>" },
  IconButton: { name: "IconButton", props: ["disabled", "label"], emits: ["click"], template: "<button :disabled='disabled' @click=\"$emit('click')\" />" },
  FormField: { props: ["label", "hint"], template: "<div><slot /></div>" },
  BasicCard: { template: "<div><slot /></div>" },
  BasicTooltip: true, CostLabel: true, ProposalCorrection: true, StepCallout: true,
  RouterLink: { props: ["to"], template: "<a><slot /></a>" },
};

const COVER = {
  id: 21,
  status: "pending",
  proposed_value: {
    variants: [
      { title: "Sleepy baby", prompt: "A baby sleeps in mum's arms" },
      { title: "Cot", prompt: "The soother on a knit blanket" },
    ],
    chosen: null,
    alt: "A baby asleep with a soother",
    cover_text: "",
  },
};
const blob = new Blob(["png"], { type: "image/png" });

describe("CoverVariants", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    notify.mockReset();
    api.GET_StagedFile.mockResolvedValue({ data: blob });
    globalThis.URL.createObjectURL = vi.fn(() => "blob:image");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("shows one image per variant, each fetched by its number", async () => {
    const w = mount(CoverVariants, { props: { proposal: COVER }, global: { stubs, components: { BasicRadioGroup } } });
    await flushPromises();
    expect(w.findAll("[data-testid='cover-pick']")).toHaveLength(2);
    expect(api.GET_StagedFile.mock.calls).toEqual([[21, 0], [21, 1]]);
    expect(w.findAll("img").map((img) => img.attributes("src"))).toEqual(["blob:image", "blob:image"]);
  });

  it("a pick is a radio choice saved at once with the whole value", async () => {
    api.PATCH_Proposal.mockImplementation(async (id, body) => ({ data: { ...COVER, proposed_value: body.proposed_value } }));
    const w = mount(CoverVariants, { props: { proposal: COVER }, global: { stubs, components: { BasicRadioGroup } } });
    await flushPromises();
    await w.findAll("[data-testid='cover-pick']")[1].setValue(true);
    await flushPromises();
    expect(api.PATCH_Proposal).toHaveBeenCalledWith(21, { proposed_value: { ...COVER.proposed_value, chosen: 1 } });
    expect(w.findAll("[data-testid='cover-pick']").map((input) => input.element.checked)).toEqual([false, true]);
    expect(w.emitted("updated")).toHaveLength(1);
  });

  it("a pick takes that variant's alt text, but never over one the operator wrote", async () => {
    api.PATCH_Proposal.mockImplementation(async (id, body) => ({ data: { ...COVER, proposed_value: body.proposed_value } }));
    const variants = [
      { title: "Sleepy baby", prompt: "p", alt: "A baby asleep" },
      { title: "Cot", prompt: "p", alt: "A soother on a blanket" },
    ];
    const proposal = { ...COVER, proposed_value: { ...COVER.proposed_value, variants, alt: "A baby asleep" } };
    const w = mount(CoverVariants, { props: { proposal }, global: { stubs, components: { BasicRadioGroup } } });
    await flushPromises();
    await w.findAll("[data-testid='cover-pick']")[1].setValue(true);
    await flushPromises();
    expect(w.vm.alt).toBe("A soother on a blanket");
    w.findComponent(BasicTextarea).vm.$emit("update:modelValue", "My own words");
    await w.findAll("[data-testid='cover-pick']")[0].setValue(true);
    await flushPromises();
    expect(w.vm.alt).toBe("My own words");
  });

  it("prepare refuses without a pick and saves an edited alt text with one", async () => {
    api.PATCH_Proposal.mockImplementation(async (id, body) => ({ data: { ...COVER, proposed_value: body.proposed_value } }));
    const w = mount(CoverVariants, { props: { proposal: COVER }, global: { stubs, components: { BasicRadioGroup } } });
    await flushPromises();
    expect(await w.vm.prepare()).toBe(false);
    expect(w.find("[data-testid='cover-note']").attributes("role")).toBe("alert");
    w.vm.chosen = 0;
    w.findComponent(BasicTextarea).vm.$emit("update:modelValue", " New alt ");
    expect(await w.vm.prepare()).toBe(true);
    expect(api.PATCH_Proposal).toHaveBeenCalledWith(21, { proposed_value: { ...COVER.proposed_value, chosen: 0, alt: "New alt" } });
  });

  it("an approved cover shows only the chosen image and its alt text", async () => {
    const approved = { ...COVER, status: "applied", proposed_value: { ...COVER.proposed_value, chosen: 1 } };
    const w = mount(CoverVariants, { props: { proposal: approved }, global: { stubs, components: { BasicRadioGroup } } });
    await flushPromises();
    expect(w.find("[data-testid='cover-variants']").exists()).toBe(false);
    expect(api.GET_StagedFile.mock.calls).toEqual([[21, 1]]);
    expect(w.find("[data-testid='cover-chosen']").text()).toContain("Cot");
    expect(w.find("[data-testid='cover-chosen']").text()).toContain("A baby asleep with a soother");
  });

  it("an image that cannot be read says so", async () => {
    api.GET_StagedFile.mockRejectedValue(new Error("404"));
    const w = mount(CoverVariants, { props: { proposal: COVER }, global: { stubs, components: { BasicRadioGroup } } });
    await flushPromises();
    expect(w.text()).toContain("enrichment.studio.cover.image_failed");
  });
});

describe("cover steps in the step panel", () => {
  const RUN = {
    uid: "r1",
    status: "waiting",
    steps: [
      { key: "cover_brief", label: "Cover brief", status: "review", output: "artifact", needs: [], proposal_id: 20 },
      { key: "cover", label: "Cover", status: "review", output: "image", needs: ["cover_brief"], proposal_id: 21 },
      { key: "compose", label: "Document", status: "waiting", output: "document", needs: ["cover"], proposal_id: null },
    ],
  };
  const SCENES = { id: 20, status: "pending", proposed_value: { data: { scenes: [{ title: "Sleepy baby", prompt: "A baby", alt: "Alt", must_show: ["baby semi-upright"] }] } } };
  const approve = (w) => w.findComponent(ActionBar).props("actions").find((a) => a.key === "approve");

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.GET_StagedFile.mockResolvedValue({ data: blob });
    api.GET_Proposal.mockImplementation(async (id) => ({ data: id === 20 ? SCENES : COVER }));
    globalThis.URL.createObjectURL = vi.fn(() => "blob:image");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("the cover brief reads as scene cards with the alt text", async () => {
    const w = mount(StepPanel, { props: { run: RUN, step: RUN.steps[0] }, global: { stubs, components: { BasicRadioGroup } } });
    await flushPromises();
    expect(w.findComponent(ScenesList).exists()).toBe(true);
    expect(w.find("[data-testid='scene-0']").text()).toContain("Sleepy baby");
    expect(w.find("[data-testid='scene-0-alt']").text()).toContain("Alt");
    expect(w.find("[data-testid='scene-0-must']").text()).toContain("baby semi-upright");
  });

  it.each(["review", "approved"])("the cover brief in status %s says where the picture is picked", async (status) => {
    const run = { ...RUN, steps: [{ ...RUN.steps[0], status }, ...RUN.steps.slice(1)] };
    const w = mount(StepPanel, { props: { run, step: run.steps[0] }, global: { stubs, components: { BasicRadioGroup } } });
    await flushPromises();
    expect(w.find("[data-testid='step-caption']").text()).toContain('enrichment.studio.cover.scenes_one::{"count":1,"step":"Cover"}');
  });

  it("Approve stays off until a variant is picked; the caption counts the variants, then names the pick", async () => {
    api.PATCH_Proposal.mockImplementation(async (id, body) => ({ data: { ...COVER, proposed_value: body.proposed_value } }));
    api.GET_Run.mockResolvedValue({ data: RUN });
    api.POST_AcceptProposal.mockResolvedValue({ data: {} });
    const w = mount(StepPanel, { props: { run: RUN, step: RUN.steps[1] }, global: { stubs, components: { BasicRadioGroup } } });
    await flushPromises();
    expect(w.findComponent(CoverVariants).exists()).toBe(true);
    expect(approve(w).disabled).toBe(true);
    expect(w.find("[data-testid='step-caption']").text()).toContain("enrichment.studio.cover.variants_caption");
    await w.findAll("[data-testid='cover-pick']")[0].setValue(true);
    await flushPromises();
    expect(approve(w).disabled).toBe(false);
    expect(w.find("[data-testid='step-caption']").text()).toContain('enrichment.studio.cover.chosen_caption::{"n":1}');
    await w.find("[data-testid='step-approve']").trigger("click");
    await flushPromises();
    expect(api.POST_AcceptProposal).toHaveBeenCalledWith(21);
  });
});

describe("DocumentSummary cover", () => {
  const RUN = { uid: "r1", status: "waiting", steps: [] };
  const DOC = {
    id: 30,
    status: "pending",
    proposed_value: { title: "T", slug: "t", language: "pl", body_markdown: "One two", faq: [], cover: { alt: "A baby", file_name: "t.png" } },
  };

  beforeEach(() => {
    api.GET_StagedFile.mockReset();
    api.GET_StagedFile.mockResolvedValue({ data: blob });
    globalThis.URL.createObjectURL = vi.fn(() => "blob:cover");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("shows the pending document's cover with its alt text", async () => {
    const w = mount(DocumentSummary, { props: { proposal: DOC, run: RUN }, global: { stubs, components: { BasicRadioGroup } } });
    await flushPromises();
    expect(api.GET_StagedFile).toHaveBeenCalledWith(30, null);
    expect(w.find("[data-testid='document-cover'] img").attributes("src")).toBe("blob:cover");
    expect(w.find("[data-testid='document-cover']").text()).toContain("A baby");
  });

  it("hides the cover once the draft exists or when the image is gone", async () => {
    const created = mount(DocumentSummary, { props: { proposal: { ...DOC, status: "applied" }, run: RUN }, global: { stubs, components: { BasicRadioGroup } } });
    await flushPromises();
    expect(created.find("[data-testid='document-cover']").exists()).toBe(false);
    api.GET_StagedFile.mockRejectedValue(new Error("404"));
    const gone = mount(DocumentSummary, { props: { proposal: DOC, run: RUN }, global: { stubs, components: { BasicRadioGroup } } });
    await flushPromises();
    expect(gone.find("[data-testid='document-cover']").exists()).toBe(false);
  });
});
