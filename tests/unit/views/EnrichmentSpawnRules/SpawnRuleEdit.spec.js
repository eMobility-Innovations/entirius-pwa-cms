import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockGetRule = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockGetDefs = vi.fn();
const mockNotify = vi.fn();

vi.mock("@/api/enrichment/api", () => ({
  GET_SpawnRule: (...a) => mockGetRule(...a),
  POST_SpawnRule: (...a) => mockPost(...a),
  PATCH_SpawnRule: (...a) => mockPatch(...a),
  DELETE_SpawnRule: vi.fn(),
  POST_SpawnRuleRun: vi.fn(),
}));
vi.mock("@/api/pim/api", () => ({
  GET_GapDefinitions: (...a) => mockGetDefs(...a),
}));
vi.mock("@/stores/loader", () => ({
  useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: mockNotify }),
}));
const CHANNELS = [
  { idx: "default", name: "Default", languages: ["pl", "en"] },
  { idx: "second", name: "Second", languages: ["de"] },
];
const mockStore = vi.hoisted(() => ({ channels: [], allLanguages: [] }));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({ ...mockStore, fetchChannels: vi.fn() }),
}));
vi.mock("@/functionals/Confirmation-modal/index.vue", () => ({
  default: { name: "ConfirmationModal", template: "<div />" },
}));

import SpawnRuleEdit from "@/views/EnrichmentSpawnRules/SpawnRuleEdit.vue";

const mountEdit = (params = {}, routerMock = {}) =>
  mount(SpawnRuleEdit, {
    global: {
      mocks: {
        $route: { params, query: {} },
        $router: { push() {}, replace() {}, ...routerMock },
      },
      stubs: {
        // The global FormField stub swallows slots — render them so the field inputs exist in DOM.
        FormField: { template: "<div><slot /></div>" },
        PageHeader: { template: "<div><slot name='actions' /></div>" },
      },
    },
  });

describe("SpawnRuleEdit", () => {
  beforeEach(() => {
    mockGetRule.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    mockGetDefs.mockReset();
    mockNotify.mockReset();
    mockStore.channels = CHANNELS;
    mockStore.allLanguages = ["pl", "en", "de"];
    mockGetDefs.mockResolvedValue({
      data: { results: [{ key: "pl-description" }] },
    });
  });

  it("create mode posts the full payload with key", async () => {
    mockPost.mockResolvedValueOnce({ data: {} });
    const wrapper = mountEdit();
    await flushPromises();

    wrapper.vm.form.key = "desc-pl";
    wrapper.vm.form.check_key = "pl-description";
    wrapper.vm.scopeChannel = "default";
    wrapper.vm.scopeLanguage = "PL";
    wrapper.vm.limitStr = "100";
    await wrapper.vm.save();

    expect(mockPost).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "desc-pl",
        module: "pim",
        check_key: "pl-description",
        task_type: "fix-attribute",
        scope: { channel: "default", language: "pl" },
        limit: 100,
        cooldown_days: null,
      })
    );
  });

  it("rejects an invalid key locally without calling the API", async () => {
    const wrapper = mountEdit();
    await flushPromises();

    wrapper.vm.form.key = "Bad Key!";
    wrapper.vm.form.check_key = "pl-description";
    await wrapper.vm.save();

    expect(mockPost).not.toHaveBeenCalled();
    expect(wrapper.vm.errors.key).toBeTruthy();
  });

  it("edit mode loads the rule, disables key and patches without it", async () => {
    mockGetRule.mockResolvedValueOnce({
      data: {
        key: "desc-pl",
        module: "pim",
        check_key: "pl-description",
        task_type: "translate",
        task_params: {},
        params: {},
        scope: { channel: "default" },
        limit: null,
        cooldown_days: 3,
        auto: true,
        active: true,
      },
    });
    mockPatch.mockResolvedValueOnce({ data: {} });
    const wrapper = mountEdit({ key: "desc-pl" });
    await flushPromises();

    expect(wrapper.vm.isCreate).toBe(false);
    expect(wrapper.vm.form.task_type).toBe("translate");
    expect(wrapper.vm.cooldownStr).toBe("3");

    await wrapper.vm.save();
    const payload = mockPatch.mock.calls[0][1];
    expect(mockPatch.mock.calls[0][0]).toBe("desc-pl");
    expect(payload.key).toBeUndefined();
    expect(payload.cooldown_days).toBe(3);
  });

  it("language options follow the selected channel and reset when it stops serving them", async () => {
    const wrapper = mountEdit();
    await flushPromises();

    // No channel picked → union of all channel languages (+ "all" option).
    expect(wrapper.vm.languageOptions.map((o) => o.value)).toEqual(["", "pl", "en", "de"]);

    wrapper.vm.selectChannel("default");
    await flushPromises();
    expect(wrapper.vm.languageOptions.map((o) => o.value)).toEqual(["", "pl", "en"]);

    wrapper.vm.scopeLanguage = "pl";
    wrapper.vm.selectChannel("second"); // serves only "de" → selection resets to all-languages
    await flushPromises();
    expect(wrapper.vm.scopeLanguage).toBe("");
  });

  // Plan 32 (ui-rules § Loading): Save, Run and Delete need the rule, so they render only after it loaded.
  it("shows the page actions only after the rule loaded", async () => {
    let resolveRule;
    mockGetRule.mockReturnValueOnce(new Promise((resolve) => (resolveRule = resolve)));
    const wrapper = mountEdit({ key: "desc-pl" });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-test="spawn-rule-save-btn"]').exists()).toBe(false);

    resolveRule({ data: { key: "desc-pl", module: "pim", check_key: "", task_type: "translate", scope: {} } });
    await flushPromises();

    expect(wrapper.find('[data-test="spawn-rule-save-btn"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="spawn-rule-delete-btn"]').exists()).toBe(true);
  });

  it("keeps a stored language the loaded channel list does not offer", async () => {
    mockGetRule.mockResolvedValueOnce({
      data: {
        key: "desc-fr",
        module: "pim",
        check_key: "pl-description",
        task_type: "translate",
        scope: { channel: "retired", language: "fr" },
        auto: false,
        active: true,
      },
    });
    const wrapper = mountEdit({ key: "desc-fr" });
    await flushPromises();

    expect(wrapper.vm.scopeLanguage).toBe("fr");
    expect(wrapper.vm.languageOptions.map((o) => o.value)).toContain("fr");
    expect(wrapper.vm.buildPayload().scope).toEqual({ channel: "retired", language: "fr" });
  });

  it("free-text channel fallback runs the same language check as picking a channel", async () => {
    mockStore.channels = [];
    mockStore.allLanguages = [];
    const wrapper = mountEdit();
    await flushPromises();

    wrapper.vm.scopeLanguage = "pl";
    const input = wrapper.findComponent('[data-test="spawn-rule-channel-input"]');
    input.vm.$emit("update:modelValue", "shop2");
    await flushPromises();
    expect(wrapper.vm.scopeChannel).toBe("shop2");
    expect(wrapper.vm.scopeLanguage).toBe("");
  });

  it("falls back to free-text check input when the PIM gaps API is unavailable", async () => {
    mockGetDefs.mockReset();
    mockGetDefs.mockRejectedValueOnce(new Error("404"));
    const wrapper = mountEdit();
    await flushPromises();

    expect(wrapper.vm.checkOptions).toHaveLength(0);
    expect(wrapper.find('[data-test="spawn-rule-check-input"]').exists()).toBe(true);
  });
});

describe("SpawnRuleEdit — stored values in selects", () => {
  // Renders the label the real BasicSelect would show: the selected option's, else the placeholder.
  const SelectProbe = {
    props: ["options", "modelValue", "placeholder"],
    template:
      '<span class="dd">{{ (options.find((o) => o.value === modelValue) || { label: placeholder }).label }}</span>',
  };

  beforeEach(() => {
    mockGetDefs.mockReset();
    mockGetDefs.mockResolvedValue({ data: { results: [{ key: "pl-description" }] } });
    mockGetRule.mockReset();
    mockGetRule.mockResolvedValueOnce({
      data: {
        key: "atlas-duplicate-in-pim",
        module: "atlas",
        check_key: "duplicate_in_pim",
        task_type: "lookup_link",
        task_params: {},
        params: {},
        scope: {},
        limit: 200,
        cooldown_days: 1,
        auto: false,
        active: true,
      },
    });
  });

  it("shows the rule's check, task type and channel scope instead of the placeholder", async () => {
    const wrapper = mount(SpawnRuleEdit, {
      global: {
        mocks: { $route: { params: { key: "atlas-duplicate-in-pim" }, query: {} } },
        stubs: { FormField: { template: "<div><slot /></div>" }, BasicSelect: SelectProbe },
      },
    });
    await flushPromises();

    const labels = wrapper.findAll(".dd").map((d) => d.text());
    expect(labels.slice(0, 3)).toEqual([
      "duplicate_in_pim",
      "lookup_link",
      "enrichment.spawn_rules.all_channels",
    ]);
    expect(labels).not.toContain("common.select");
  });
});
