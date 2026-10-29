import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// Plan 17: the Dropdown / Switcher `@onSelect` handlers now hang on BasicSelect / BasicSwitch `@update:model-value`.
vi.mock("@/api/pricefighter/api", () => ({
  GET_PfChannels: vi.fn().mockResolvedValue({ data: [{ idx: "b2c", name: "B2C" }] }),
  GET_PfHistory: vi.fn().mockResolvedValue({ data: { results: [], count: 0 } }),
  GET_PfDecisions: vi.fn().mockResolvedValue({ data: { results: [], count: 0 } }),
  GET_PfRules: vi.fn().mockResolvedValue({ data: { results: [] } }),
  POST_PfRule: vi.fn(),
  PATCH_PfRule: vi.fn(),
  DELETE_PfRule: vi.fn(),
  POST_PfApply: vi.fn(),
}));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderEnd() {}, loaderFinish() {} }) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification() {} }) }));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isPanelEnabled: () => true }) }));

import { GET_PfHistory, GET_PfDecisions } from "@/api/pricefighter/api";
import DecisionHistory from "@/views/PriceFighter/DecisionHistory.vue";
import GapTable from "@/views/PriceFighter/GapTable.vue";
import Strategies from "@/views/PriceFighter/Strategies.vue";

const control = (name) => ({
  name,
  props: ["modelValue", "options"],
  emits: ["update:modelValue"],
  template: "<div />",
});
const stubs = {
  BasicSelect: control("BasicSelect"),
  BasicSwitch: control("BasicSwitch"),
  FormField: { template: "<div><slot /></div>" },
  MobileFilterPanel: { template: "<div><slot /></div>" },
  BasicModal: { template: "<div><slot /></div>" },
  DataTable: true,
  BulkActionBar: true,
  EntitySearchPicker: true,
  Pagination: true,
  IconButton: true,
  ConfirmDialog: true,
};
const pick = (wrapper, name, value, at = 0) =>
  wrapper.findAllComponents({ name })[at].vm.$emit("update:modelValue", value);
const lastParams = (api) => api.mock.calls.at(-1)[0];

describe("PriceFighter pickers on BasicSelect / BasicSwitch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("decision history: a picked channel filters, clearing (null) drops the filter", async () => {
    const wrapper = mount(DecisionHistory, { global: { stubs } });
    await flushPromises();
    await pick(wrapper, "BasicSelect", "b2c");
    expect(lastParams(GET_PfHistory).channel).toBe("b2c");
    await pick(wrapper, "BasicSelect", null);
    expect(lastParams(GET_PfHistory)).not.toHaveProperty("channel");
  });

  it("gap table: the 'all' option drops the filter, the switch flips competitor-only", async () => {
    const wrapper = mount(GapTable, { global: { stubs } });
    await flushPromises();
    await pick(wrapper, "BasicSelect", "b2c");
    expect(lastParams(GET_PfDecisions).channel).toBe("b2c");
    await pick(wrapper, "BasicSelect", "__all");
    expect(lastParams(GET_PfDecisions)).not.toHaveProperty("channel");
    await pick(wrapper, "BasicSelect", "compete", 1);
    expect(lastParams(GET_PfDecisions).recommendation).toBe("compete");
    await pick(wrapper, "BasicSwitch", false);
    expect(lastParams(GET_PfDecisions).competitor_only).toBe(false);
  });

  it("strategies: a new scope type resets the scope value", async () => {
    const wrapper = mount(Strategies, { global: { stubs } });
    await flushPromises();
    wrapper.vm.openCreate();
    wrapper.vm.form.scopeValue = "SKU-1";
    await flushPromises();
    await pick(wrapper, "BasicSelect", "channel");
    expect(wrapper.vm.form.scopeType).toBe("channel");
    expect(wrapper.vm.form.scopeValue).toBe("");
  });
});

// Plan 41: the rule modal is a BasicModal whose footer is an ActionBar; the gap filters sit in MobileFilterPanel.
describe("PriceFighter P5 bindings", () => {
  const keys = (actions) => actions.map((action) => action.key);

  it("rule modal: a new rule has cancel and save; an existing one adds delete, which asks first", async () => {
    const wrapper = mount(Strategies, { global: { stubs } });
    await flushPromises();
    wrapper.vm.openCreate();
    expect(keys(wrapper.vm.ruleActions)).toEqual(["cancel", "save"]);
    wrapper.vm.openEdit({ id: 3, sku: "SKU-1", strategy: "hold", price_war: false });
    const remove = wrapper.vm.ruleActions.find((action) => action.key === "delete");
    expect(remove).toMatchObject({ role: "utility", icon: "delete", variant: "danger" });
    remove.onClick();
    expect(wrapper.vm.showDeleteConfirm).toBe(true);
    wrapper.vm.ruleActions.find((action) => action.key === "cancel").onClick();
    expect(wrapper.vm.editingRule).toBeNull();
  });

  it("gap table: the filter count follows channel, recommendation and competitor-only off its default", async () => {
    const wrapper = mount(GapTable, { global: { stubs } });
    await flushPromises();
    expect(wrapper.vm.activeFilterCount).toBe(0);
    await pick(wrapper, "BasicSelect", "b2c");
    await pick(wrapper, "BasicSelect", "compete", 1);
    expect(wrapper.vm.activeFilterCount).toBe(2);
    await pick(wrapper, "BasicSwitch", false);
    expect(wrapper.vm.activeFilterCount).toBe(3);
  });
});
