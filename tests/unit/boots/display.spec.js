import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

import StatusBadge from "@/boots/StatusBadge/index.vue";
import CountBadge from "@/boots/CountBadge/index.vue";
import Tag from "@/boots/Tag/index.vue";
import BasicTabs from "@/boots/BasicTabs/index.vue";
import BasicCard from "@/boots/BasicCard/index.vue";
import PanelCard from "@/boots/PanelCard/index.vue";
import MediaTile from "@/boots/MediaTile/index.vue";
import { ICONS } from "@/boots/Icons/icons";

const badge = (props) => mount(StatusBadge, { props: { label: "Opublikowany", ...props } });

describe("StatusBadge", () => {
  it("is a neutral md badge with a dot and the label as title", () => {
    const wrapper = badge();
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(["status-badge--neutral", "status-badge--md", "status-badge--dot"])
    );
    expect(wrapper.attributes("title")).toBe("Opublikowany");
  });

  it("takes a tone, a size and drops the dot on request", () => {
    const wrapper = badge({ tone: "accent", size: "sm", dot: false });
    expect(wrapper.classes()).toEqual(expect.arrayContaining(["status-badge--accent", "status-badge--sm"]));
    expect(wrapper.classes()).not.toContain("status-badge--dot");
  });

  it("paints its tone, neutral without one", () => {
    expect(badge({ tone: "info" }).classes()).toContain("status-badge--info");
    expect(badge({}).classes()).toContain("status-badge--neutral");
  });
});

describe("CountBadge", () => {
  it("shows the number, 999+ above 999", () => {
    expect(mount(CountBadge, { props: { count: 12 } }).text()).toBe("12");
    expect(mount(CountBadge, { props: { count: 999 } }).text()).toBe("999");
    expect(mount(CountBadge, { props: { count: 1200 } }).text()).toBe("999+");
  });
});

describe("Tag", () => {
  it("is a plain value chip without a remove button", () => {
    const wrapper = mount(Tag, { props: { label: "lato" } });
    expect(wrapper.text()).toBe("lato");
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("removable: a close IconButton named by the value emits remove", async () => {
    const wrapper = mount(Tag, { props: { label: "lato", removable: true } });
    const button = wrapper.find("button");
    expect(button.attributes("aria-label")).toBe("common.delete: lato");
    await button.trigger("click");
    expect(wrapper.emitted("remove")).toHaveLength(1);
  });

  it("to: the label links to the entity, the remove button stays", () => {
    const wrapper = mount(Tag, {
      props: { label: "Rowery", to: "/pim/categories/bikes", removable: true },
      global: { stubs: { RouterLink: { props: ["to"], template: "<a :href='to'><slot /></a>" } } },
    });
    expect(wrapper.find("a").attributes("href")).toBe("/pim/categories/bikes");
    expect(wrapper.find("a").text()).toBe("Rowery");
    expect(wrapper.find("button").exists()).toBe(true);
  });
});

const TABS = [
  { label: "Opis", value: "desc" },
  { label: "Warianty", value: "variants", count: 3 },
  { label: "Media", value: "media" },
];
const tabs = (modelValue = "desc") => mount(BasicTabs, { props: { options: TABS, modelValue }, attachTo: document.body });

describe("BasicTabs", () => {
  it("names each tab's panel and renders nothing without options", () => {
    const wrapper = mount(BasicTabs, { props: { options: TABS, modelValue: "desc", idPrefix: "p" } });
    const first = wrapper.find('[role="tab"]');
    expect(first.attributes("id")).toBe(`p-tab-${TABS[0].value}`);
    expect(first.attributes("aria-controls")).toBe(`p-panel-${TABS[0].value}`);
    expect(mount(BasicTabs, { props: { options: [] } }).find('[role="tablist"]').exists()).toBe(false);
  });

  it("is a tablist; the active tab is selected and the one Tab stop", () => {
    const wrapper = tabs("variants");
    expect(wrapper.attributes("role")).toBe("tablist");
    const all = wrapper.findAll('[role="tab"]');
    expect(all.map((t) => t.attributes("aria-selected"))).toEqual(["false", "true", "false"]);
    expect(all.map((t) => t.attributes("tabindex"))).toEqual(["-1", "0", "-1"]);
    expect(all[1].classes()).toContain("basic-tabs__tab--active");
    wrapper.unmount();
  });

  it("shows counts as CountBadge", () => {
    const wrapper = tabs();
    expect(wrapper.findAllComponents(CountBadge).map((c) => c.text())).toEqual(["3"]);
    wrapper.unmount();
  });

  it("emits the clicked tab (API unchanged)", async () => {
    const wrapper = tabs();
    await wrapper.findAll('[role="tab"]')[2].trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([["media"]]);
    wrapper.unmount();
  });

  it("arrow keys, Home and End select and focus a tab, wrapping around", async () => {
    const wrapper = tabs("desc");
    await wrapper.trigger("keydown", { key: "ArrowLeft" });
    await wrapper.trigger("keydown", { key: "ArrowRight" });
    await wrapper.trigger("keydown", { key: "End" });
    await wrapper.trigger("keydown", { key: "Home" });
    await wrapper.trigger("keydown", { key: "a" });
    expect(wrapper.emitted("update:modelValue")).toEqual([["media"], ["variants"], ["media"], ["desc"]]);
    expect(document.activeElement.textContent.trim()).toBe("Opis");
    wrapper.unmount();
  });

  it("renders a disabled tab that neither a click nor the arrow keys select", async () => {
    const options = TABS.map((tab) => ({ ...tab, disabled: tab.value === "variants" }));
    const wrapper = mount(BasicTabs, { props: { options, modelValue: "desc" }, attachTo: document.body });
    const all = wrapper.findAll('[role="tab"]');
    expect(all.map((t) => t.attributes("disabled"))).toEqual([undefined, "", undefined]);
    await all[1].trigger("click");
    await wrapper.trigger("keydown", { key: "ArrowRight" });
    expect(wrapper.emitted("update:modelValue")).toEqual([["media"]]);
    wrapper.unmount();
  });

  it("gives the first tab the Tab stop when none is selected", () => {
    const wrapper = tabs(null);
    expect(wrapper.findAll('[role="tab"]').map((t) => t.attributes("tabindex"))).toEqual(["0", "-1", "-1"]);
    wrapper.unmount();
  });

  it("never puts the one Tab stop on a disabled tab: the first enabled one takes it", () => {
    const stops = (options, modelValue) =>
      mount(BasicTabs, { props: { options, modelValue } }).findAll('[role="tab"]').map((t) => t.attributes("tabindex"));
    const firstOff = TABS.map((tab, i) => ({ ...tab, disabled: i === 0 }));
    expect(stops(firstOff, null)).toEqual(["-1", "0", "-1"]);
    expect(stops(firstOff, TABS[0].value)).toEqual(["-1", "0", "-1"]);
  });
});

describe("BasicCard", () => {
  it("is the polish card with a title and an actions slot", () => {
    const wrapper = mount(BasicCard, {
      props: { title: "Dane" },
      slots: { default: "<p>treść</p>", actions: "<button>Zapisz</button>" },
    });
    expect(wrapper.classes()).toContain("page-card");
    expect(wrapper.find("h2").text()).toBe("Dane");
    expect(wrapper.find("header button").text()).toBe("Zapisz");
    expect(wrapper.find("p").text()).toBe("treść");
  });

  it("has no header without title and actions", () => {
    expect(mount(BasicCard, { slots: { default: "x" } }).find("header").exists()).toBe(false);
  });

  it("drops the frame when flat (a card inside a drawer or a modal)", () => {
    const wrapper = mount(BasicCard, { props: { flat: true }, slots: { default: "x" } });
    expect(wrapper.classes()).toContain("basic-card--flat");
    expect(wrapper.classes()).not.toContain("page-card");
  });
});

const panel = (props) =>
  mount(PanelCard, { props: { icon: "file-lines", title: "Strony", description: "Treści", ...props } });

describe("PanelCard", () => {
  it("is a button with the e2e hook that emits click", async () => {
    const wrapper = panel();
    expect(wrapper.element.tagName).toBe("BUTTON");
    expect(wrapper.classes()).toContain("panel-card");
    expect(wrapper.text()).toContain("Treści");
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
  });

  it("locked: not focusable, no click, the replacement text instead of the description", async () => {
    const wrapper = panel({ locked: true, lockedText: "Skontaktuj się z administratorem" });
    expect(wrapper.element.tagName).toBe("DIV");
    expect(wrapper.attributes("tabindex")).toBeUndefined();
    expect(wrapper.attributes("aria-disabled")).toBeUndefined();
    expect(wrapper.classes()).toContain("panel-card--locked");
    expect(wrapper.text()).toContain("Skontaktuj się z administratorem");
    expect(wrapper.text()).not.toContain("Treści");
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeUndefined();
  });
});

describe("MediaTile", () => {
  it("shows the image, or the placeholder without one", () => {
    const image = mount(MediaTile, { props: { src: "/a.jpg", alt: "Baner" } });
    expect(image.find("img").attributes()).toMatchObject({ src: "/a.jpg", alt: "Baner" });
    const empty = mount(MediaTile);
    expect(empty.find("img").exists()).toBe(false);
    expect(empty.find(".media-tile__placeholder").exists()).toBe(true);
  });

  it("video: a play badge over the image and the video icon as the placeholder", () => {
    const withThumb = mount(MediaTile, { props: { src: "/v.jpg", video: true } });
    expect(withThumb.find(".media-tile__image .media-tile__play").exists()).toBe(true);
    const noThumb = mount(MediaTile, { props: { video: true } });
    expect(noThumb.find(".media-tile__placeholder").attributes("icon")).toBe(String(ICONS.video));
    expect(mount(MediaTile, { props: { src: "/a.jpg" } }).find(".media-tile__play").exists()).toBe(false);
  });

  it("marks the selected tile and renders the actions slot", () => {
    const wrapper = mount(MediaTile, { props: { selected: true, caption: "baner.jpg" }, slots: { actions: "<i>a</i>" } });
    expect(wrapper.classes()).toContain("media-tile--selected");
    expect(wrapper.find(".media-tile__footer i").exists()).toBe(true);
    expect(wrapper.text()).toContain("baner.jpg");
  });

  it("puts the overlay slot over the image; overlay and actions share the reveal class", () => {
    const wrapper = mount(MediaTile, { props: { src: "/a.jpg" }, slots: { overlay: "<b>lato</b>", actions: "<i>a</i>" } });
    expect(wrapper.find(".media-tile__image .media-tile__overlay b").text()).toBe("lato");
    expect(wrapper.findAll(".media-tile__reveal")).toHaveLength(2);
    expect(mount(MediaTile).find(".media-tile__overlay").exists()).toBe(false);
  });
});

describe("display boots registry", () => {
  it("registers the plan-13 boots", async () => {
    const { default: register } = await import("@/boots/register-elems.js");
    const app = { component: vi.fn() };
    register(app);
    const names = app.component.mock.calls.map(([name]) => name);
    expect(names).toEqual(expect.arrayContaining(["CountBadge", "Tag", "BasicCard", "PanelCard", "MediaTile"]));
  });
});
