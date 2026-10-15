import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

const mockNotify = vi.fn();

vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: mockNotify }) }));
vi.mock("@/api/pim/api", () => ({
  GET_FeatureSetFeatures: () => Promise.reject(new Error("Network Error")),
  GET_FeatureAttributes: vi.fn(),
  GET_Attribute: vi.fn(),
}));

import AttributeEditor from "@/views/Pim/components/AttributeEditor.vue";

// The Attributes tab mounts while the backend restarts: the failed load is told in a toast, never an uncaught rejection.
describe("AttributeEditor — backend unreachable", () => {
  it("a failed feature-set load toasts and leaves no rejection behind", async () => {
    const wrapper = mount(AttributeEditor, {
      props: { featureSetIdx: "outdoor", channelIdx: "default-europe" },
      global: { stubs: { TranslationsDrawer: true, BasicCard: true, AttributeField: true } },
    });
    await flushPromises();

    expect(mockNotify).toHaveBeenCalledWith({ type: "negative", msg: "The attributes could not be loaded — try again in a moment" });
    wrapper.unmount();
  });
});
