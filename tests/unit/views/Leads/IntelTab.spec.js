import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { t } from "@/i18n";

const siteintel = vi.hoisted(() => ({ GET_LatestAudit: vi.fn() }));
vi.mock("@/api/siteintel/api", () => siteintel);

import IntelTab from "@/views/Leads/tabs/IntelTab.vue";
import { leadsFrame } from "./leadsFrame";

const audit = {
  status: "completed",
  reports: [
    { source: "lighthouse", status: "ok", processed: { strategies: { desktop: { scores: { performance: 0.91 } }, mobile: { scores: {} } } } },
    { source: "headers", status: "ok" },
  ],
};

async function mountTab(latest) {
  siteintel.GET_LatestAudit.mockResolvedValue(latest);
  const wrapper = mount(IntelTab, { props: { company: { domain: "shop.test" } }, global: { mocks: { $t: t }, components: leadsFrame.components } });
  await flushPromises();
  return wrapper;
}

describe("Leads Intel tab", () => {
  it("renders an audit with translated labels only", async () => {
    const wrapper = await mountTab(audit);
    expect(wrapper.find('[data-testid="intel-score-desktop"]').text()).toContain("91 / 100");
    expect(wrapper.findAll('[data-testid="intel-source"]')).toHaveLength(2);
    expect(wrapper.text()).not.toMatch(/leads\.intel\./);
  });

  it("renders the no-audit state translated", async () => {
    const wrapper = await mountTab(null);
    expect(wrapper.find('[data-testid="intel-no-audit"]').exists()).toBe(true);
    expect(wrapper.text()).not.toMatch(/leads\.intel\./);
  });
});
