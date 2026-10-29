import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setLang } from "@/i18n";

const GET_UsageMonth = vi.hoisted(() => vi.fn());
vi.mock("@/api/enrichment/api", () => ({ GET_UsageMonth }));
const gate = vi.hoisted(() => ({ modules: ["enrichment"], areas: ["enrichment.proposals"] }));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isModuleEnabled: (key) => gate.modules.includes(key) }) }));
vi.mock("@/stores/access", () => ({ useAccessStore: () => ({ can: (area) => gate.areas.includes(area) }) }));

import AiUsageButton from "@/components/AiUsage/AiUsageButton.vue";
import AiUsageLine from "@/components/AiUsage/AiUsageLine.vue";
import { useAiUsageVisible } from "@/components/AiUsage/useAiUsage";
import { REFRESH_MS, costNote, formatCost, formatTokens, summary } from "@/components/AiUsage/aiUsage";

const USAGE = { period: "2026-10", tokens: 3827328, cost_usd: "3.40", cost_since: null, currency: "USD" };

// BasicButton renders for real (its slot is the summary); the panel opens in place, no teleport.
const mountIt = (props = {}) =>
  mount(AiUsageButton, { props, global: { stubs: { teleport: true, BasicButton: false } } });
const button = (wrapper) => wrapper.find('[data-testid="ai-usage-button"]');

describe("AI usage formats", () => {
  afterEach(() => setLang("EN"));

  it("shortens tokens and formats the cost by the UI language", () => {
    expect(formatTokens(3827328)).toBe("3.8M");
    expect(formatTokens(12400)).toBe("12.4K");
    expect(formatCost("3.40", "USD")).toBe("$3.40");
    setLang("PL");
    expect(formatTokens(3827328)).toMatch(/^3,8\smln$/);
    expect(formatCost("3.40", "USD")).toMatch(/^3,40\s\$$/);
  });

  it("shows a dash for what is unknown", () => {
    expect(formatTokens(null)).toBe("—");
    expect(formatCost(null)).toBe("—");
  });

  it("summarises tokens and cost, without a cost part while the cost is unknown", () => {
    expect(summary(USAGE)).toBe("AI this month: 3.8M tokens · $3.40");
    expect(summary({ ...USAGE, cost_usd: null })).toBe("AI this month: 3.8M tokens");
    expect(summary(null)).toBe("AI this month: — tokens");
  });

  it("explains a missing or partial cost", () => {
    expect(costNote(null)).toMatch(/can't be read/);
    expect(costNote({ ...USAGE, cost_usd: null })).toMatch(/billing is not switched on/);
    expect(costNote({ ...USAGE, cost_since: "2026-10-15" })).toMatch(/since 15 Oct/);
    expect(costNote(USAGE)).toMatch(/margin included/);
  });
});

describe("AiUsageButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    GET_UsageMonth.mockReset();
    GET_UsageMonth.mockResolvedValue({ data: USAGE });
  });
  afterEach(() => vi.useRealTimers());

  it("loads on mount and shows this month's usage", async () => {
    const wrapper = mountIt();
    await flushPromises();

    expect(GET_UsageMonth).toHaveBeenCalledTimes(1);
    expect(button(wrapper).text()).toBe("AI this month: 3.8M tokens · $3.40");
    expect(button(wrapper).attributes("aria-label")).toBe("AI usage this month: 3.8M tokens, cost $3.40");
  });

  it("opens a panel with the month, the exact numbers and what the cost includes", async () => {
    const wrapper = mountIt();
    await flushPromises();
    await button(wrapper).trigger("click");

    expect(wrapper.text()).toContain("October 2026");
    expect(wrapper.find('[data-testid="ai-usage-tokens"]').text()).toBe("3,827,328");
    expect(wrapper.find('[data-testid="ai-usage-cost"]').text()).toBe("$3.40");
    expect(wrapper.find('[data-testid="ai-usage-note"]').text()).toMatch(/margin included/);
  });

  it("refreshes every few minutes and stops when unmounted", async () => {
    const wrapper = mountIt();
    await flushPromises();
    vi.advanceTimersByTime(REFRESH_MS);
    await flushPromises();
    expect(GET_UsageMonth).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    vi.advanceTimersByTime(REFRESH_MS);
    expect(GET_UsageMonth).toHaveBeenCalledTimes(2);
  });

  it("stays quiet when the toolbox is down and keeps the last numbers", async () => {
    const wrapper = mountIt();
    await flushPromises();
    GET_UsageMonth.mockRejectedValue({ error: "AI_USAGE_UNAVAILABLE" });
    vi.advanceTimersByTime(REFRESH_MS);
    await flushPromises();

    expect(button(wrapper).text()).toBe("AI this month: 3.8M tokens · $3.40");
  });

  it("shows dashes when nothing could be read", async () => {
    GET_UsageMonth.mockRejectedValue({ error: "AI_USAGE_UNAVAILABLE" });
    const wrapper = mountIt();
    await flushPromises();

    expect(button(wrapper).text()).toBe("AI this month: — tokens");
  });
});

describe("AI usage on a phone and its visibility", () => {
  beforeEach(() => {
    GET_UsageMonth.mockReset();
    GET_UsageMonth.mockResolvedValue({ data: USAGE });
    Object.assign(gate, { modules: ["enrichment"], areas: ["enrichment.proposals"] });
  });

  it("the phone menu line shows the same summary", async () => {
    const wrapper = mount(AiUsageLine);
    await flushPromises();

    expect(wrapper.text()).toBe("AI this month: 3.8M tokens · $3.40");
  });

  it("shows only with the enrichment module and its proposals area", () => {
    expect(useAiUsageVisible().value).toBe(true);
    gate.areas = [];
    expect(useAiUsageVisible().value).toBe(false);
    Object.assign(gate, { modules: [], areas: ["enrichment.proposals"] });
    expect(useAiUsageVisible().value).toBe(false);
  });
});
