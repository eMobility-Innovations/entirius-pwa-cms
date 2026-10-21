// The channel selector in every Pim view's header: the channel and its badge, never the store-wide translation
// (that is the Translation panel's — see tests/unit/views/TranslationDashboard/Dashboard.spec.js).
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

const munin = { isModuleInstalled: vi.fn(() => true) };
vi.mock("@/stores/munin", () => ({ useMuninStore: () => munin }));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({
    channels: [{ idx: "default", name: "Lovi" }],
    activeChannelIdx: "default",
    isDefaultChannel: true,
    setActiveChannel: vi.fn(),
  }),
}));

import PimChannelSelect from "@/views/Pim/components/PimChannelSelect.vue";

describe("PimChannelSelect", () => {
  it("shows the channel select, and no Translate Store even when the translator is installed", () => {
    const wrapper = mount(PimChannelSelect, {
      global: { stubs: { FormField: { template: "<div><slot /></div>" }, BasicSelect: true } },
    });

    expect(wrapper.find('[data-testid="pim-channel-select"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="pim-translate-store"]').exists()).toBe(false);
    expect(wrapper.findComponent({ name: "PimTranslateDialog" }).exists()).toBe(false);
    expect(wrapper.text()).not.toContain("pim.translate_store");
    expect(wrapper.html()).not.toContain("pim.translate_store");
  });
});
