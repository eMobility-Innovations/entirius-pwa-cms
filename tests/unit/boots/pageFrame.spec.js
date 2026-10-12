import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";

const push = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));

import PageHeader from "@/boots/PageHeader/index.vue";
import PageLayout from "@/boots/PageLayout/index.vue";
import Breadcrumbs from "@/boots/Breadcrumbs/index.vue";
import { PAGE_HEADER_CLAIM } from "@/composables/pageHeader";

const CRUMBS = [{ label: "Pages", to: "/pages/content" }, { label: "Lista treści", to: "/pages/content" }, { label: "Product Showcase" }];
const RouterLink = { props: ["to"], template: "<a :href='to'><slot /></a>" };

const header = (props = {}, { slots, provide } = {}) =>
  mount(PageHeader, {
    props: { title: "Product Showcase", ...props },
    slots,
    global: { stubs: { RouterLink }, provide },
  });

const shell = (crumbs = []) => ({ claim: vi.fn(), release: vi.fn(), crumbs: ref(crumbs) });

beforeEach(() => push.mockClear());

describe("PageHeader", () => {
  it("renders exactly one <h1>, the title, marked for the harness", () => {
    const wrapper = header({ overline: "Home", crumbs: CRUMBS, back: "/pages/content" });
    const h1s = wrapper.findAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].text()).toBe("Product Showcase");
    expect(h1s[0].element.closest('[data-fid="page-title"]').classList).toContain("page-header__title-row");
    expect(wrapper.find(".page-header__overline").text()).toBe("Home");
  });

  it("keeps the full title on the <h1> for a title cut by the ellipsis", () => {
    const wrapper = header({ title: "Sunday Morning, Pocket Size, Amber" });
    expect(wrapper.find("h1").attributes("title")).toBe("Sunday Morning, Pocket Size, Amber");
    expect(wrapper.find("h1").text()).toBe("Sunday Morning, Pocket Size, Amber");
  });

  it("renders the description under the title row only when given", () => {
    expect(header().find(".page-header__description").exists()).toBe(false);
    const description = header({ description: "Who can sign in." }).find(".page-header__description");
    expect(description.text()).toBe("Who can sign in.");
    expect(description.element.closest(".page-header__title-row")).toBeNull();
  });

  it("shows no crumbs and no back arrow unless given (no shell)", () => {
    const wrapper = header();
    expect(wrapper.find("nav").exists()).toBe(false);
    expect(wrapper.find(".icon-button").exists()).toBe(false);
  });

  it("shows its own crumbs, else the shell's; an empty list hides the shell's", () => {
    expect(header({ crumbs: CRUMBS }).findAll("li")).toHaveLength(3);
    const provide = { [PAGE_HEADER_CLAIM]: shell(CRUMBS.slice(0, 2)) };
    expect(header({}, { provide }).findAll("li")).toHaveLength(2);
    expect(header({ crumbs: [] }, { provide }).find("nav").exists()).toBe(false);
  });

  it("back pushes a route location, or calls a handler", async () => {
    await header({ back: { name: "PagesList" } }).get(".icon-button").trigger("click");
    expect(push).toHaveBeenCalledWith({ name: "PagesList" });
    const handler = vi.fn();
    await header({ back: handler }).get(".icon-button").trigger("click");
    expect(handler).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledOnce();
  });

  it("claims the shell's header slot on mount and releases it on unmount", () => {
    const provider = shell();
    const wrapper = header({}, { provide: { [PAGE_HEADER_CLAIM]: provider } });
    expect(provider.claim).toHaveBeenCalledOnce();
    expect(provider.release).not.toHaveBeenCalled();
    wrapper.unmount();
    expect(provider.release).toHaveBeenCalledOnce();
  });

  it("follows the shell's crumbs as they change", async () => {
    const provider = shell(CRUMBS.slice(0, 1));
    const wrapper = header({}, { provide: { [PAGE_HEADER_CLAIM]: provider } });
    expect(wrapper.findAll("li")).toHaveLength(1);
    provider.crumbs.value = CRUMBS;
    await nextTick();
    expect(wrapper.findAll("li")).toHaveLength(3);
  });

  it("two headers overlapping in a route change claim and release once each", () => {
    const provider = shell();
    const provide = { [PAGE_HEADER_CLAIM]: provider };
    const leaving = header({}, { provide });
    const arriving = header({}, { provide });
    leaving.unmount();
    expect(provider.claim).toHaveBeenCalledTimes(2);
    expect(provider.release).toHaveBeenCalledOnce();
    arriving.unmount();
    expect(provider.release).toHaveBeenCalledTimes(2);
  });

  it("mounts and unmounts without a shell", () => {
    expect(() => header().unmount()).not.toThrow();
  });

  it("keeps the actions out of the title row's head, so they wrap to their own row and scroll away on a phone", () => {
    const wrapper = header({ sticky: true }, { slots: { meta: "<span class='chip' />", actions: "<button class='act' />" } });
    const head = wrapper.get('[data-fid="sticky-header"]');
    expect(head.classes()).toContain("page-header__head--sticky");
    expect(wrapper.classes()).toContain("page-header--sticky");
    expect(head.find(".page-header__title-row .chip").exists()).toBe(true);
    expect(head.find(".act").exists()).toBe(false);
    expect(wrapper.get(".page-header__actions").find(".act").exists()).toBe(true);
  });

  it("is not sticky by default", () => {
    expect(header().find('[data-fid="sticky-header"]').exists()).toBe(false);
  });
});

describe("Breadcrumbs", () => {
  const crumbs = (items, size) => mount(Breadcrumbs, { props: { items, size }, global: { stubs: { RouterLink } } });

  it("is a labelled nav list; ancestors link, the last item is the current page", () => {
    const wrapper = crumbs(CRUMBS);
    expect(wrapper.get("nav").attributes("aria-label")).toBe("common.breadcrumb");
    expect(wrapper.findAll("ol > li")).toHaveLength(3);
    expect(wrapper.findAll("a").map((a) => a.attributes("href"))).toEqual(["/pages/content", "/pages/content"]);
    const current = wrapper.get('[aria-current="page"]');
    expect(current.element.tagName).toBe("SPAN");
    expect(current.text()).toBe("Product Showcase");
  });

  it("puts a hidden separator between items and a title on every label", () => {
    const wrapper = crumbs(CRUMBS);
    expect(wrapper.findAll('[aria-hidden="true"]').map((sep) => sep.text())).toEqual(["/", "/"]);
    expect(wrapper.findAll(".breadcrumbs__label").every((label) => label.attributes("title"))).toBe(true);
  });

  it("an ancestor without `to` is plain text; sm is a size class; no items render nothing", () => {
    const wrapper = crumbs([{ label: "Pages" }, { label: "Lista treści" }], "sm");
    expect(wrapper.find("a").exists()).toBe(false);
    expect(wrapper.classes()).toContain("breadcrumbs--sm");
    expect(crumbs([]).find("nav").exists()).toBe(false);
  });
});

describe("PageLayout", () => {
  it("renders header, toolbar and body in order, the toolbar only when given", () => {
    const slots = { header: "<h1>T</h1>", toolbar: "<div class='filters' />", default: "<p class='content' />" };
    const wrapper = mount(PageLayout, { slots });
    const order = [...wrapper.element.children].map((child) => child.className || child.tagName);
    expect(order).toEqual(["H1", "page-layout__toolbar", "page-layout__body"]);
    expect(mount(PageLayout, { slots: { default: "<p />" } }).find(".page-layout__toolbar").exists()).toBe(false);
  });
});
