/**
 * Plan 19 — read-only mode: PageLayout decides it once from the route's area (else its panel's first area) and the
 * access store; ActionBar, FloatingActions, BulkActionBar, FormField and `mutates` buttons honour it. Without the
 * access module a page is never read-only.
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, reactive, ref } from "vue";
import { routeLocationKey } from "vue-router";
import PageLayout from "@/boots/PageLayout/index.vue";
import ActionBar from "@/boots/ActionBar/index.vue";
import FloatingActions from "@/boots/FloatingActions/index.vue";
import BulkActionBar from "@/boots/BulkActionBar/index.vue";
import FormField from "@/boots/FormField/index.vue";
import BasicInput from "@/boots/BasicInput/index.vue";
import BasicButton from "@/boots/BasicButton/index.vue";
import IconButton from "@/boots/IconButton/index.vue";
import Tag from "@/boots/Tag/index.vue";
import PageHeader from "@/boots/PageHeader/index.vue";
import {
  ACCESS_STORE,
  READONLY,
  ReadonlyArea,
  isAreaReadonly,
  routeArea,
  usePageReadonly,
  useReadonly,
} from "@/composables/useReadonly";

// The access store's surface PageLayout reads: `available` and `can(area, level)`.
const accessWith = (permissions, available = true) => ({
  available,
  can: (area, level) => permissions[area] === "write" || (level === "read" && permissions[area] === "read"),
});

// A child that shows the flag it injects.
const Probe = defineComponent({
  setup: () => ({ readonly: useReadonly() }),
  render() {
    return h("i", { class: "probe" }, String(this.readonly));
  },
});

function mountPage({ meta, access, readonly = false, slots = {} }) {
  return mount(PageLayout, {
    props: { readonly },
    slots: { default: () => h(Probe), ...slots },
    global: { provide: { [routeLocationKey]: reactive({ meta }), [ACCESS_STORE]: access } },
  });
}

const inReadonly = (on) => ({
  global: { provide: { [READONLY]: ref(on) }, stubs: { BasicButton: false }, components: { BasicButton } },
});

describe("useReadonly", () => {
  it("is false outside a PageLayout", () => {
    expect(mount(Probe).text()).toBe("false");
  });

  it("takes the route's area, else its panel's first area, else none", () => {
    expect(routeArea({ meta: { area: "faq.faq", panel: "pim" } })).toBe("faq.faq");
    expect(routeArea({ meta: { panel: "pim" } })).toBe("pim.products");
    expect(routeArea({ meta: {} })).toBeNull();
    expect(routeArea(null)).toBeNull();
  });

  it("is never read-only without the access module, whatever `can` says", () => {
    expect(isAreaReadonly(accessWith({}, false), "faq.faq")).toBe(false);
    expect(isAreaReadonly(accessWith({ "faq.faq": "read" }), "faq.faq")).toBe(true);
    expect(isAreaReadonly(accessWith({ "faq.faq": "write" }), "faq.faq")).toBe(false);
    expect(isAreaReadonly(accessWith({}), null)).toBe(false);
  });
});

// FIX-09 #8: a product's prices, stock and supplier tabs work on their own areas, not on `pim.products`.
describe("ReadonlyArea", () => {
  const region = (area, permissions) =>
    mountPage({
      meta: { area: "pim.products" },
      access: accessWith(permissions),
      slots: { default: () => h(ReadonlyArea, { area }, { default: () => h(Probe) }) },
    }).find(".probe").text();

  it("decides by its own area alone, whatever the page decided", () => {
    expect(region("pricemanager.prices", { "pim.products": "write", "pricemanager.prices": "read" })).toBe("true");
    expect(region("qms.stock", { "pim.products": "read", "qms.stock": "write" })).toBe("false");
  });
});

describe("usePageReadonly in the view that renders the PageLayout", () => {
  it("reads the same decision as its PageLayout, without a `force`", () => {
    let flag;
    const View = defineComponent({
      setup() {
        flag = usePageReadonly();
        return () => h("i");
      },
    });
    const access = accessWith({ "faq.faq": "read" });
    mount(View, { global: { provide: { [routeLocationKey]: reactive({ meta: { area: "faq.faq" } }), [ACCESS_STORE]: access } } });
    expect(flag.value).toBe(true);
  });
});

describe("PageLayout read-only decision", () => {
  it("is read-only with read on the route's area and says why once", () => {
    const wrapper = mountPage({ meta: { area: "faq.faq" }, access: accessWith({ "faq.faq": "read" }) });
    expect(wrapper.find(".probe").text()).toBe("true");
    expect(wrapper.findAll('[data-testid="readonly-notice"]')).toHaveLength(1);
    expect(wrapper.text()).toContain("access.readonly_notice");
  });

  it("is not read-only with write on the route's area", () => {
    const wrapper = mountPage({ meta: { area: "faq.faq" }, access: accessWith({ "faq.faq": "write" }) });
    expect(wrapper.find(".probe").text()).toBe("false");
    expect(wrapper.find('[data-testid="readonly-notice"]').exists()).toBe(false);
  });

  it("falls back to the panel's first area when the route carries none", () => {
    const meta = { panel: "pim" };
    expect(mountPage({ meta, access: accessWith({ "pim.products": "read" }) }).find(".probe").text()).toBe("true");
    expect(mountPage({ meta, access: accessWith({ "pim.products": "write" }) }).find(".probe").text()).toBe("false");
  });

  it("is never read-only when the access module is unavailable", () => {
    const wrapper = mountPage({ meta: { area: "faq.faq" }, access: accessWith({}, false) });
    expect(wrapper.find(".probe").text()).toBe("false");
  });

  it("is forced on by the view's prop, which never lifts it", () => {
    const forced = mountPage({ meta: { area: "faq.faq" }, access: accessWith({ "faq.faq": "write" }), readonly: true });
    expect(forced.find(".probe").text()).toBe("true");
  });

  it("keeps the toolbar and the header's meta (filters, channel picker) writable", () => {
    const header = () => h(PageHeader, { title: "FAQ" }, { meta: () => h(Probe, { class: "meta" }) });
    const wrapper = mountPage({
      meta: { area: "faq.faq" },
      access: accessWith({ "faq.faq": "read" }),
      slots: { header, toolbar: () => h(Probe) },
    });
    expect(wrapper.findAll(".probe").map((probe) => probe.text())).toEqual(["false", "false", "true"]);
  });

  it("is not read-only without the access store (unit tests, no shell)", () => {
    expect(mountPage({ meta: { area: "faq.faq" }, access: null }).find(".probe").text()).toBe("false");
  });
});

describe("boots under the read-only flag", () => {
  const noop = () => {};
  const actions = [
    { key: "save", label: "Zapisz", role: "primary", onClick: noop },
    { key: "draft", label: "Szkic", role: "secondary", onClick: noop },
    { key: "delete", label: "Usuń", role: "danger", onClick: noop },
    { key: "export", label: "Eksport", role: "utility", icon: "download", onClick: noop },
    { key: "trash", label: "Kosz", role: "utility", icon: "delete", variant: "danger", onClick: noop },
    { key: "copy", label: "Kopiuj", role: "utility", icon: "duplicate", mutates: true, onClick: noop },
    { key: "cancel", label: "Anuluj", role: "secondary", mutates: false, onClick: noop },
  ];
  const labels = (wrapper) => wrapper.findAll("button").map((b) => b.attributes("aria-label") || b.text());

  it("ActionBar keeps non-mutating utilities and actions marked `mutates: false`", () => {
    expect(labels(mount(ActionBar, { props: { actions }, ...inReadonly(true) }))).toEqual(["Eksport", "Anuluj"]);
  });

  it("ActionBar shows every action without it", () => {
    expect(labels(mount(ActionBar, { props: { actions }, ...inReadonly(false) }))).toHaveLength(7);
  });

  it("FloatingActions hides the FAB and its menu, not the back button", () => {
    const fab = { actions: [{ icon: "add", label: "Dodaj", handler: noop }], backHandler: noop };
    const on = mount(FloatingActions, { props: fab, ...inReadonly(true) });
    expect(on.find('[data-fid="fab"]').exists()).toBe(false);
    expect(on.find(".floating-actions__menu").exists()).toBe(false);
    expect(on.find(".floating-actions__back").exists()).toBe(true);
    expect(mount(FloatingActions, { props: fab, ...inReadonly(false) }).find('[data-fid="fab"]').exists()).toBe(true);
  });

  it("BulkActionBar is hidden", () => {
    const bulk = { count: 2, actions: [{ key: "enable", labelKey: "pim.enable_all" }] };
    expect(mount(BulkActionBar, { props: bulk, ...inReadonly(true) }).find(".bulk-bar").exists()).toBe(false);
    expect(mount(BulkActionBar, { props: bulk, ...inReadonly(false) }).find(".bulk-bar").exists()).toBe(true);
  });

  it("FormField disables its control", () => {
    const Field = defineComponent({
      components: { FormField, BasicInput },
      template: `<FormField label="Nazwa"><BasicInput model-value="x" /></FormField>`,
    });
    const global = (on) => ({ provide: { [READONLY]: ref(on) }, stubs: { FormField: false, BasicInput: false } });
    expect(mount(Field, { global: global(true) }).find("input").attributes("disabled")).toBeDefined();
    expect(mount(Field, { global: global(false) }).find("input").attributes("disabled")).toBeUndefined();
  });

  it("a `mutates` BasicButton or IconButton is hidden, an ordinary one stays", () => {
    const Buttons = defineComponent({
      components: { BasicButton, IconButton },
      template: `<div>
        <BasicButton mutates>Usuń</BasicButton><BasicButton>Podgląd</BasicButton>
        <IconButton mutates icon="delete" label="Usuń wiersz" /><IconButton icon="preview" label="Otwórz" />
      </div>`,
    });
    expect(labels(mount(Buttons, inReadonly(true)))).toEqual(["Podgląd", "Otwórz"]);
    expect(labels(mount(Buttons, inReadonly(false)))).toEqual(["Usuń", "Podgląd", "Usuń wiersz", "Otwórz"]);
  });

  // A role chip's remove (GroupList, StaffDetail) revokes a grant: Tag passes `mutates` to its IconButton.
  it("a removable Tag marked `mutates` loses its remove, a picked-value Tag keeps it", () => {
    const Tags = defineComponent({
      components: { Tag },
      template: `<div><Tag label="Editor" removable mutates /><Tag label="Red" removable /></div>`,
    });
    const removes = (wrapper) => wrapper.findAll(".tag").map((tag) => tag.find("button").exists());
    expect(removes(mount(Tags, inReadonly(true)))).toEqual([false, true]);
    expect(removes(mount(Tags, inReadonly(false)))).toEqual([true, true]);
  });
});
