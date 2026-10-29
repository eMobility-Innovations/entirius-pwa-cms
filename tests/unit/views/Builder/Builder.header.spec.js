import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useContentDBChannelStore } from "@/stores/contentDBChannel";
import Builder from "@/views/Builder/Builder.vue";
import HomeVariantSwitcher from "@/views/Builder/HomeVariantSwitcher.vue";

// Plan 28 moved the editor's toolbar into a PageHeader ActionBar and the tile-cap check out of the template.
const editor = (overrides = {}) => ({
  $t: (key) => key,
  uid: "doc-1",
  advanced_options: false,
  has_options: () => false,
  saveDraft: vi.fn(),
  saveAndPublish: vi.fn(),
  canPublish: true,
  $refs: {},
  ...overrides,
});
const actionsOf = (vm) => Builder.computed.editorActions.call(vm);

describe("Builder — header actions", () => {
  it("lists copy, settings, draft and publish in R5 order", () => {
    const actions = actionsOf(editor());
    expect(actions.map(({ key, role, icon }) => [key, role, icon])).toEqual([
      ["copy", "utility", "duplicate"],
      ["advanced", "utility", "settings"],
      ["draft", "secondary", "saveDraft"],
      ["publish", "primary", "publish"],
    ]);
    expect(actions.map(({ label }) => label)).toEqual([
      "builder.copy",
      "builder.advanced",
      "builder.save_draw",
      "builder.publish_document",
    ]);
  });

  it("creates before it can publish, and toggles the advanced row", () => {
    const vm = editor({ uid: null });
    const [copy, advanced, draft, publish] = actionsOf(vm);
    expect(draft.label).toBe("builder.post_draw");
    expect(publish.disabled).toBe(true);

    copy.onClick();
    advanced.onClick();
    expect(vm.rename_modal).toBe(true);
    expect(vm.advanced_options).toBe(true);
    expect(actionsOf(vm)[1].icon).toBe("close");
  });

  // FIX-09 #17: Publish is the `content.publish` area; a role that only edits pages keeps the draft.
  it("leaves Publish out for a role that cannot publish", () => {
    expect(actionsOf(editor({ canPublish: false })).map(({ key }) => key)).toEqual(["copy", "advanced", "draft"]);
  });

  it("adds the document options utility when the config has them, opening its kit", () => {
    const click = vi.fn();
    const vm = editor({ has_options: () => true, $refs: { documentConfigSetter: { $el: { click } } } });
    const actions = actionsOf(vm);
    expect(actions.map(({ key }) => key)).toEqual(["copy", "advanced", "document-options", "draft", "publish"]);
    actions[2].onClick();
    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe("Builder — tile cap", () => {
  const vm = (tiles_order) => ({
    sections: { s1: { core_type: "capped" }, s2: { core_type: "free" } },
    tiles_order,
    config_options: { capped: { max_tiles: 2 } },
    section_options: Builder.methods.section_options,
  });
  const reached = (tiles_order, uid) => Builder.methods.isTileLimitReached.call(vm(tiles_order), uid);

  it("blocks add and copy once a capped section is full", () => {
    expect(reached({ s1: ["a"] }, "s1")).toBe(false);
    expect(reached({ s1: ["a", "b"] }, "s1")).toBe(true);
    expect(reached({}, "s1")).toBe(false);
  });

  it("never blocks a section type without options", () => {
    expect(reached({ s2: ["a", "b", "c"] }, "s2")).toBe(false);
  });
});

describe("HomeVariantSwitcher — BasicSelect options", () => {
  const switcher = () => ({
    $t: (key) => key,
    currentChannel: "pl",
    availableChannels: [{ idx: "pl", name: "Polska" }, { idx: "de" }, { idx: "en" }],
    variants: { pl: { uid: "home-pl" }, de: { uid: "home-de" } },
    $emit: vi.fn(),
    isCurrent: HomeVariantSwitcher.methods.isCurrent,
    variantState: HomeVariantSwitcher.methods.variantState,
  });

  it("names each channel's home: this one, an existing one, or one to create", () => {
    expect(HomeVariantSwitcher.computed.options.call(switcher())).toEqual([
      { label: "Polska", value: "pl", description: "builder.home_current" },
      { label: "de", value: "de", description: "builder.home_exists" },
      { label: "en", value: "en", description: "builder.home_create" },
    ]);
  });

  it("switches to an existing home or asks for a new one, and ignores the current channel", () => {
    const vm = switcher();
    HomeVariantSwitcher.methods.onSelect.call(vm, "pl");
    expect(vm.$emit).not.toHaveBeenCalled();

    HomeVariantSwitcher.methods.onSelect.call(vm, "de");
    HomeVariantSwitcher.methods.onSelect.call(vm, "en");
    expect(vm.$emit.mock.calls).toEqual([
      ["switch", { channel_idx: "de", target_uid: "home-de" }],
      ["switch", { channel_idx: "en", target_uid: null }],
    ]);
  });
});

// Plan 54b: the header mounted — the back target, the action order, and the advanced toggle's attention cue.
describe("Builder — mounted header", () => {
  const PageLayout = { template: "<div><slot name='header' /></div>" };
  const PageHeader = { name: "PageHeader", props: { title: String, back: String, sticky: Boolean }, template: "<header><slot name='actions' /></header>" };
  const ActionBar = { name: "ActionBar", props: ["actions"], template: "<div />" };
  const BasicSelect = { name: "BasicSelect", props: ["modelValue", "options"], emits: ["update:modelValue"], template: "<div />" };

  // The state goes in before the mount: init() (API + configs) is replaced, the header renders from data alone.
  const mountHeader = (state, languages = []) => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useContentDBChannelStore().languages = languages;
    const view = {
      ...Builder,
      data() {
        return { ...Builder.data.call(this), content_type: "blog", uid: "doc-1", ...state };
      },
      methods: { ...Builder.methods, init: vi.fn() },
    };
    return mount(view, { shallow: true, global: { plugins: [pinia], stubs: { PageLayout, PageHeader, ActionBar, BasicSelect } } });
  };
  const toggle = (wrapper) =>
    wrapper.findComponent(ActionBar).props("actions").find((action) => action.key === "advanced");

  it("goes back to the content type's list and keeps the R5 action order", async () => {
    const wrapper = mountHeader({ custom_doc_name: "Home", routes: ["/"] });
    expect(wrapper.findComponent(PageHeader).props()).toMatchObject({ title: "Home", back: "/pages/blog", sticky: true });
    const keys = wrapper.findComponent(ActionBar).props("actions").map(({ key }) => key);
    expect(keys).toEqual(["copy", "advanced", "draft", "publish"]);
    expect(toggle(wrapper)).toMatchObject({ label: "builder.advanced", icon: "settings" });
  });

  it("marks the closed advanced toggle while the name or the URL is missing", async () => {
    const missingUrl = mountHeader({ custom_doc_name: "Home", routes: [] });
    expect(toggle(missingUrl)).toMatchObject({ icon: "warning", label: "builder.advanced_missing" });
    expect(toggle(missingUrl).variant).toBeUndefined();
    expect(toggle(mountHeader({ routes: ["/"] })).icon).toBe("warning");
    expect(toggle(mountHeader({ routes: [], advanced_options: true })).icon).toBe("close");
  });

  it("asks a layout extender for its name only (it has no URL)", async () => {
    const wrapper = mountHeader({ content_type: "layout-extender", custom_doc_name: "Footer", routes: [] });
    expect(toggle(wrapper).icon).toBe("settings");
    const unnamed = mountHeader({ content_type: "layout-extender", custom_doc_name: "", routes: [] });
    expect(toggle(unnamed)).toMatchObject({ icon: "warning", label: "builder.advanced_missing_name" });
  });

  describe("the content language", () => {
    const LANGUAGES = [{ iso2: "EN" }, { iso2: "pl" }];

    it("offers the ContentDB languages next to Save draft and Publish, on the page's language", () => {
      const wrapper = mountHeader({ language: "EN" }, LANGUAGES);
      const select = wrapper.find(".builder-actions").findComponent(BasicSelect);
      expect(select.props("options")).toEqual([
        { label: "EN", value: "EN" },
        { label: "PL", value: "PL" },
      ]);
      expect(select.props("modelValue")).toBe("EN");
      expect(select.attributes("aria-label")).toBe("builder.content_language");
    });

    it("a picked language goes into the saved document and marks the page unsaved", async () => {
      const wrapper = mountHeader({ language: "EN" }, LANGUAGES);
      wrapper.vm.snapshotFormState();
      await wrapper.findComponent(BasicSelect).vm.$emit("update:modelValue", "PL");
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.language).toBe("PL");
      expect(wrapper.vm.getPayload().language).toBe("PL");
      expect(wrapper.vm.isDirty).toBe(true);
    });

    it("shows no language pick without ContentDB languages", () => {
      expect(mountHeader({ language: "EN" }).findComponent(BasicSelect).exists()).toBe(false);
    });
  });
});
