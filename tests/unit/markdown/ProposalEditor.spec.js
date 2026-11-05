// @vitest-environment jsdom
// ProposalEditor preview (enrichment review): markdown through `marked.parse`, stored HTML as it is; both through
// `sanitizeHtml` into `v-html`.
import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const api = vi.hoisted(() => ({
  GET_Proposal: vi.fn(),
  GET_Task: vi.fn(),
  GET_ProposalRevisions: vi.fn(),
  POST_ReviseProposal: vi.fn(),
  POST_RestoreRevision: vi.fn(),
  PATCH_Proposal: vi.fn(),
  PUT_ProposalRules: vi.fn(),
  POST_PromoteRule: vi.fn(),
  POST_AcceptProposal: vi.fn(),
  POST_RejectProposal: vi.fn(),
}));
const notify = vi.fn();
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/api/pim/api", () => ({ GET_Features: () => Promise.resolve({ data: { results: [] } }) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: notify }) }));

import ProposalEditor from "@/views/EnrichmentReview/ProposalEditor.vue";
import { CASES, EMPTY, FULL, HOSTILE } from "../fixtures/markdown/corpus";
import { expectRenderedCorpus, unsafeIn } from "./helpers";
import { isHtml } from "@/views/EnrichmentReview/reviewLogic";


const PROPOSAL = {
  id: 9, status: "pending", task_id: 4, subject_ref: "ENT-1", subject_label: "Orion sofa", source: "worker:pim.writer@v1",
  target_kind: "attribute_value", target_locator: { language: "pl", feature_idx: "description" },
  proposed_value: { text: "<p>A red sofa</p>" }, current_snapshot: { text: "" }, rules: [],
};

const PageLayout = { template: "<div><slot name='header' /><slot /></div>" };
const PageHeader = { name: "PageHeader", props: ["title", "crumbs", "back"], template: "<header><slot name='meta' /><slot name='actions' /></header>" };
const ActionBar = { name: "ActionBar", props: ["actions"], template: "<div />" };
const BasicTextarea = {
  name: "BasicTextarea",
  props: ["modelValue", "disabled"],
  emits: ["update:modelValue"],
  template: "<textarea :value='modelValue' @input=\"$emit('update:modelValue', $event.target.value)\" />",
};
const CorrectionBar = { name: "CorrectionBar", props: ["shape", "selection", "busy"], emits: ["submit"], template: "<div />", methods: { reset() {} } };
const SegmentedControl = { name: "SegmentedControl", props: ["modelValue", "options"], emits: ["update:modelValue"], template: "<div />" };
const ConfirmDialog = { name: "ConfirmDialog", props: ["open", "title"], emits: ["confirm", "discard", "cancel"], template: "<div />" };
const stubs = {
  ConfirmDialog,
  PageLayout, PageHeader, ActionBar, BasicTextarea, CorrectionBar, SegmentedControl,
  BasicCard: { template: "<section><slot /></section>" }, FormField: { template: "<div><slot /></div>" }, Tag: true, VariantPicker: true, RuleChips: true,
  CorrectionThread: { name: "CorrectionThread", props: ["revisions", "restorable", "landed"], template: "<div />" }, DriftModal: true, TextDiff: true,
};

async function preview(draft) {
  api.GET_Proposal.mockResolvedValue({ data: { ...PROPOSAL, proposed_value: { text: draft ?? "" } } });
  api.GET_Task.mockResolvedValue({ data: { id: 4, params: { template: "description" } } });
  api.GET_ProposalRevisions.mockResolvedValue({ data: [] });
  const w = mount(ProposalEditor, {
    global: { stubs, mocks: { $route: { params: { proposalId: "9" }, query: {} }, $router: { push: vi.fn(), back: vi.fn() } } },
  });
  await flushPromises();
  await w.setData({ view: "preview" });
  return w.find("[data-testid='editor-preview']");
}
describe("ProposalEditor preview renders the markdown corpus", () => {
  it("shows the whole corpus as the expected elements", async () => {
    // A draft with a tag outside code counts as stored HTML (isHtml), so the markdown part is rendered here.
    const markdownOnly = Object.values(CASES).filter((md) => !isHtml(md)).join("\n\n");
    expect(isHtml(markdownOnly)).toBe(false);
    const root = (await preview(markdownOnly)).element;
    expect(root.querySelector("table th")).not.toBeNull();
    expect(root.querySelector("h1").textContent).toBe("Title one");
    expect(root.querySelector("ul ul li").textContent).toContain("nested a");
    expect(root.querySelector("a[href='https://example.com/ref']")).not.toBeNull();
  });

  it("renders markdown that only mentions a tag (code span, code block, autolink) as markdown", async () => {
    const hits = Object.entries(CASES).filter(([, md]) => isHtml(md)).map(([name]) => name);
    expect(hits).toEqual(["html_script", "html_onerror", "html_other"]);
    const inline = (await preview(CASES.code_inline)).element;
    expect([...inline.querySelectorAll("code")].map((c) => c.textContent)).toEqual(["npm run build", "<div>"]);
    const block = (await preview(CASES.code_block)).element;
    expect(block.querySelectorAll("pre code").length).toBe(3);
    expect(block.querySelector("b")).toBeNull();
    const auto = (await preview(CASES.autolink)).element;
    expect(auto.querySelector("a[href='https://example.org']")).not.toBeNull();
  });

  it("keeps the HTML of every case in one file snapshot", async () => {
    const html = [];
    for (const [name, md] of Object.entries(CASES)) html.push(`<!-- ${name} -->\n${(await preview(md)).element.innerHTML}`);
    await expect(html.join("\n\n")).toMatchFileSnapshot("./__snapshots__/ProposalEditor.html");
  });

  it("drops what the sanitiser does not allow (heading ids, task checkboxes), keeps the text", async () => {
    const el = (await preview(`${CASES.headings}\n\n${CASES.tasks}`)).element;
    expect(el.querySelector("h1").getAttribute("id")).toBeNull();
    expect(el.querySelector("input")).toBeNull();
    expect(el.textContent).toContain("done");
  });

  it("shows stored HTML as it is (not run through marked), cleaned by the sanitiser", async () => {
    const el = (await preview('<h2>Stored</h2><p>one\ntwo</p><script>alert(1)</script><img src=x onerror=alert(2)>')).element;
    expect(el.querySelector("h2").textContent).toBe("Stored");
    expect(el.querySelector("p").innerHTML).toBe("one\ntwo");
    expect(unsafeIn(el)).toEqual([]);
  });

  it("does not turn single newlines into <br> (default options)", async () => {
    const el = (await preview(CASES.paragraphs)).element;
    expect(el.querySelectorAll("p")[0].innerHTML).toBe("First paragraph\nsecond line of it");
    expect(el.querySelectorAll("p")[1].querySelectorAll("br")).toHaveLength(1);
  });

  it.each(EMPTY.map((v) => [String(v), v]))("renders %s as an empty preview", async (_, value) => {
    expect((await preview(value)).element.innerHTML).toBe("");
  });

  it.each(HOSTILE)("lets no active content of %s reach the DOM", async (name) => {
    expect(unsafeIn((await preview(CASES[name])).element)).toEqual([]);
  });

  it("drops script and onerror but keeps the text around them", async () => {
    const el = (await preview(`${CASES.html_script}\n\n${CASES.html_onerror}`)).element;
    expect(el.textContent).toContain("before");
    expect(el.textContent).toContain("after");
    expect(el.textContent).not.toContain("alert('xss')");
  });

  it("keeps the link text of a javascript: link without a href", async () => {
    const link = [...(await preview(CASES.link_javascript)).element.querySelectorAll("a")].find((a) => a.textContent === "click");
    expect(link?.getAttribute("href") ?? null).toBeNull();
  });

  it("keeps the rendered corpus free of unsafe markup as a whole", async () => {
    expect(unsafeIn((await preview(FULL)).element)).toEqual([]);
  });
});
