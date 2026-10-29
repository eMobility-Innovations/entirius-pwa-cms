import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises, RouterLinkStub } from "@vue/test-utils";

const mockGetChannel = vi.fn();
const mockGetLangConfigs = vi.fn();
// Every export any of the three Emails edit views pulls from the client: unused ones are never called here.
vi.mock("@/api/emails/api", () => ({
  GET_EmailChannel: (...a) => mockGetChannel(...a),
  GET_EmailLangConfigs: (...a) => mockGetLangConfigs(...a),
  PATCH_EmailChannel: vi.fn(),
  GET_EmailChannels: vi.fn(),
  GET_EmailTemplates: vi.fn(),
  GET_EmailTemplate: vi.fn(),
  PATCH_EmailTemplate: vi.fn(),
  GET_EmailLangConfig: vi.fn(),
  PATCH_EmailLangConfig: vi.fn(),
}));
vi.mock("@/stores/loader", () => ({
  useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }),
}));
vi.mock("@/stores/notify", () => ({
  useNotifyStore: () => ({ spawnNotification: vi.fn() }),
}));

import ActionBar from "@/boots/ActionBar/index.vue";
import EmailCard from "@/views/Emails/EmailCard.vue";
import EmailChannelEdit from "@/views/Emails/EmailChannelEdit.vue";
import EmailTemplateEdit from "@/views/Emails/EmailTemplateEdit.vue";
import EmailLangConfigEdit from "@/views/Emails/EmailLangConfigEdit.vue";

// Save moved from the bottom of each form into the PageHeader ActionBar (plan 34): the same handler, primary.
const actionsOf = (component, state) => component.computed.headerActions.call({ ...state, $t: (key) => key });

describe("Emails header actions", () => {
  it.each([
    ["channel", EmailChannelEdit, "saveChannel"],
    ["template", EmailTemplateEdit, "save"],
    ["language config", EmailLangConfigEdit, "save"],
  ])("%s: one primary Save calling the view's save", (_, component, handler) => {
    const state = { [handler]: vi.fn() };
    const [save, ...rest] = actionsOf(component, state);
    expect(rest).toEqual([]);
    expect(save).toMatchObject({ key: "save", role: "primary", label: "common.save", testid: "emails-save" });
    expect(save.onClick).toBe(state[handler]);
  });
});

describe("EmailCard", () => {
  const mountCard = (props = {}) =>
    mount(EmailCard, {
      props: { to: "/emails/channels/7", title: "Default Europe", testid: "emails-channel-card", ...props },
      slots: { default: "<p>default-europe</p>" },
      global: { stubs: { RouterLink: RouterLinkStub, BasicCard: { template: "<section><slot /></section>" } } },
    });

  it("the title is the one link to the record, carrying the test id", () => {
    const link = mountCard().findComponent(RouterLinkStub);
    expect(link.props("to")).toBe("/emails/channels/7");
    expect(link.text()).toBe("Default Europe");
    expect(link.attributes("data-testid")).toBe("emails-channel-card");
  });

  it("the title is an h3 by default, the given level otherwise", () => {
    expect(mountCard().find("h3").exists()).toBe(true);
    expect(mountCard({ level: 2 }).find("h2 a").exists()).toBe(true);
  });

  it("renders the lines under the title", () => {
    expect(mountCard().text()).toContain("default-europe");
  });
});

describe("EmailChannelEdit failed load", () => {
  it("shows a retry, no Save and no form after a failed load", async () => {
    mockGetChannel.mockReset().mockRejectedValue(new Error("offline"));
    mockGetLangConfigs.mockReset().mockResolvedValue({ data: { results: [] } });
    const wrapper = mount(EmailChannelEdit, {
      global: { mocks: { $route: { params: { channelPk: "7" }, query: {}, path: "/emails/channels/7" } } },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="emails-save"]').exists()).toBe(false);
    expect(wrapper.find(".form-grid").exists()).toBe(false);
    expect(wrapper.findComponent({ name: "EmptyState" }).exists()).toBe(true);
  });

  it("recovers the form and Save when the retry loads", async () => {
    mockGetChannel.mockReset().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ data: { idx: "c7" } });
    mockGetLangConfigs.mockReset().mockResolvedValue({ data: { results: [] } });
    const wrapper = mount(EmailChannelEdit, {
      global: {
        mocks: { $route: { params: { channelPk: "7" }, query: {}, path: "/emails/channels/7" } },
        components: { ActionBar },
        stubs: {
          PageHeader: { template: '<div><slot name="actions" /></div>' },
          IconButton: true,
          EmptyState: { name: "EmptyState", template: "<div><slot /></div>" },
          BasicButton: { template: "<button @click=\"$emit('click')\"><slot /></button>" },
        },
      },
    });
    await flushPromises();

    await wrapper.findComponent({ name: "EmptyState" }).find("button").trigger("click");
    await flushPromises();

    expect(wrapper.findComponent({ name: "EmptyState" }).exists()).toBe(false);
    expect(wrapper.find(".form-grid").exists()).toBe(true);
    expect(wrapper.find('[data-testid="emails-save"]').exists()).toBe(true);
  });
});
