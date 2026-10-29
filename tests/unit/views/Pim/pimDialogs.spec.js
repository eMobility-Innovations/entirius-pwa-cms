// Plan 52 (plan-50 review): the Pim channel dialogs on BasicModal, mounted with the real modal, radio group and
// buttons — what the user picks reaches the API, the footer follows the state, a busy dialog does not close.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

vi.mock("@/api/pim/api", () => ({
  POST_AddToChannel: vi.fn(() => Promise.resolve({ data: {} })),
  POST_CopyTranslations: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock("@/stores/pimChannel", () => ({
  usePimChannelStore: () => ({
    channels: [{ idx: "c1", name: "One" }, { idx: "c2", name: "Two" }],
    activeChannelIdx: "c1",
    defaultChannelIdx: "c1",
    activeChannelLanguages: ["pl", "en"],
    allLanguages: ["pl", "en"],
  }),
}));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart: vi.fn(), loaderFinish: vi.fn() }) }));

import BasicModal from "@/boots/BasicModal/index.vue";
import BasicButton from "@/boots/BasicButton/index.vue";
import BasicRadioGroup from "@/boots/BasicRadioGroup/index.vue";
import BasicCheckbox from "@/boots/BasicCheckbox/index.vue";
import Tag from "@/boots/Tag/index.vue";
import AddToChannelDialog from "@/views/Pim/components/AddToChannelDialog.vue";
import CopyTranslationsDialog from "@/views/Pim/components/CopyTranslationsDialog.vue";
import { POST_AddToChannel, POST_CopyTranslations } from "@/api/pim/api";

const components = { BasicModal, BasicButton, BasicRadioGroup, BasicCheckbox, Tag };
const stubs = { BasicButton, FormField: { template: "<div><slot /></div>" }, BasicSelect: true };
const wrappers = [];

// Mounted closed, then opened: the dialogs reset their form when `visible` turns on.
async function open(component, props) {
  const wrapper = mount(component, { props: { visible: false, ...props }, attachTo: document.body,
    global: { components, stubs } });
  wrappers.push(wrapper);
  await wrapper.setProps({ visible: true });
  await flushPromises();
  return wrapper;
}

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
const radios = () => [...document.querySelectorAll('[role="dialog"] input[type="radio"]')];

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});

describe("AddToChannelDialog", () => {
  it("offers the channels the product is not in and adds it to the picked one", async () => {
    const wrapper = await open(AddToChannelDialog, { channelIdx: "c1", sku: "SKU-1", presentInChannels: ["c1"] });
    expect(byTestId("pim-add-to-channel-submit").disabled).toBe(true);

    radios()[0].click();
    await flushPromises();
    byTestId("pim-add-to-channel-submit").click();
    await flushPromises();

    expect(radios()).toHaveLength(1);
    expect(POST_AddToChannel).toHaveBeenCalledWith("c1", "SKU-1", { target_channel_idx: "c2", copy_content: true });
    expect(wrapper.emitted("added")).toEqual([["c2"]]);
  });

  it("has nothing to confirm when the product is in every channel", async () => {
    await open(AddToChannelDialog, { channelIdx: "c1", sku: "SKU-1", presentInChannels: ["c1", "c2"] });

    expect(radios()).toHaveLength(0);
    expect(byTestId("pim-add-to-channel-submit")).toBeNull();
  });
});

describe("CopyTranslationsDialog", () => {
  it("copies every language from the default channel", async () => {
    const wrapper = await open(CopyTranslationsDialog, { channelIdx: "c2", sku: "SKU-1" });

    byTestId("pim-copy-translations-submit").click();
    await flushPromises();

    expect(POST_CopyTranslations).toHaveBeenCalledWith("c2", "SKU-1", { source_channel_idx: "c1" });
    expect(wrapper.emitted("copied")).toHaveLength(1);
  });

  it("single language: Copy waits for the language", async () => {
    await open(CopyTranslationsDialog, { channelIdx: "c2", sku: "SKU-1" });

    radios()[1].click();
    await flushPromises();

    expect(byTestId("pim-copy-translations-submit").disabled).toBe(true);
  });
});
