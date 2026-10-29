import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { provide, ref, h } from "vue";
import PermissionMatrix from "@/boots/PermissionMatrix/index.vue";
import { READONLY } from "@/composables/useReadonly";
import { clampLevel, groupLevel, setGroup, toPermissionKeys, visibleGroups } from "@/boots/PermissionMatrix/matrix";

// Access plan 20: areas × none/read/write, limited by each area's levels; "set all" per module; access.manage only on
// a built-in role's read-only matrix.
const area = (key, levels = ["read", "write"], extra = {}) => ({
  key, label: `Label ${key}`, levels, sensitive: [], assignable: true, ...extra,
});
const AREAS = [
  { module: "django_pim", areas: [area("pim.products"), area("pim.product_delete", ["write"], { sensitive: ["destructive"] })] },
  { module: "django_accounts", areas: [area("accounts.customers", ["read"], { sensitive: ["pii"] })] },
  // A group mixing a reserved area with an assignable one: "set all" must never reach the reserved one.
  { module: "django_access", areas: [area("access.manage", ["read", "write"], { assignable: false }), area("access.extra")] },
];

const mountMatrix = (props = {}) =>
  mount(PermissionMatrix, { props: { areas: AREAS, modelValue: {}, ...props } });
const radio = (wrapper, areaKey, level) => wrapper.find(`[data-area="${areaKey}"] input[value="${level}"]`);
const lastValue = (wrapper) => wrapper.emitted("update:modelValue").at(-1)[0];

describe("PermissionMatrix rules", () => {
  it("clamps a level down to what the area offers, never up", () => {
    expect(clampLevel(area("a", ["read"]), "write")).toBe("read");
    expect(clampLevel(area("a", ["write"]), "read")).toBe("none");
    expect(clampLevel(area("a"), "write")).toBe("write");
  });

  it("names the group's level only when every area holds it", () => {
    const areas = AREAS[0].areas;
    expect(groupLevel({}, areas)).toBe("none");
    expect(groupLevel(setGroup({}, areas, "write"), areas)).toBe("write");
    expect(groupLevel({ "pim.products": "read" }, areas)).toBe("read");
    expect(groupLevel({ "pim.product_delete": "write" }, areas)).toBeNull();
  });

  it("never turns access.manage into a permission key", () => {
    expect(toPermissionKeys({ "access.manage": "write", "pim.products": "read" }, AREAS)).toEqual(["pim.products:read"]);
  });

  it("drops reserved areas (and groups left empty) unless asked to show them", () => {
    const keys = (groups) => groups.flatMap((g) => g.areas.map((a) => a.key));
    expect(keys(visibleGroups(AREAS))).not.toContain("access.manage");
    expect(keys(visibleGroups(AREAS, true))).toContain("access.manage");
    expect(visibleGroups([{ module: "m", areas: [area("x", ["read"], { assignable: false })] }])).toEqual([]);
  });
});

describe("PermissionMatrix", () => {
  it("offers per area only the levels it has", () => {
    const wrapper = mountMatrix();
    expect(radio(wrapper, "pim.product_delete", "read").attributes("disabled")).toBeDefined();
    expect(radio(wrapper, "pim.product_delete", "write").attributes("disabled")).toBeUndefined();
    expect(radio(wrapper, "accounts.customers", "write").attributes("disabled")).toBeDefined();
  });

  it("is one labelled radio group per area, sensitive flags as tags", () => {
    const wrapper = mountMatrix({ modelValue: { "pim.products": "read" } });
    const labelOf = (key) => {
      const group = wrapper.find(`[data-area="${key}"] [role="radiogroup"]`);
      return wrapper.find(`[id="${group.attributes("aria-labelledby")}"]`).text();
    };
    // A translated area takes its `access.areas.<key>` label; an unknown one keeps the catalogue's.
    expect(labelOf("pim.products")).toBe("Products and media");
    expect(labelOf("access.extra")).toBe("Label access.extra");
    expect(radio(wrapper, "pim.products", "read").element.checked).toBe(true);
    expect(wrapper.find('[data-area="accounts.customers"]').text()).toContain("access.sensitive.pii");
  });

  it("emits the new value with one area changed; none removes the key", async () => {
    const wrapper = mountMatrix({ modelValue: { "pim.products": "read" } });
    await radio(wrapper, "pim.products", "write").trigger("change");
    expect(lastValue(wrapper)).toEqual({ "pim.products": "write" });
    await radio(wrapper, "pim.products", "none").trigger("change");
    expect(lastValue(wrapper)).toEqual({});
  });

  it("set all fills a module, clamped per area", async () => {
    const wrapper = mountMatrix();
    const pim = wrapper.find('[data-module="django_pim"] [data-testid="matrix-set-all"]');
    await pim.findAll("button").at(1).trigger("click"); // read
    expect(lastValue(wrapper)).toEqual({ "pim.products": "read" });
    await pim.findAll("button").at(2).trigger("click"); // write
    expect(lastValue(wrapper)).toEqual({ "pim.products": "write", "pim.product_delete": "write" });
  });

  it("set all never selects access.manage, and its row is absent for a custom role", async () => {
    const wrapper = mountMatrix();
    expect(wrapper.find('[data-area="access.manage"]').exists()).toBe(false);
    await wrapper.find('[data-module="django_access"] [data-testid="matrix-set-all"]').findAll("button").at(2).trigger("click");
    expect(lastValue(wrapper)).toEqual({ "access.extra": "write" });
  });

  it("disabled: every radio off, no set all, the reserved row shown when asked", () => {
    const wrapper = mountMatrix({ disabled: true, showReserved: true, modelValue: { "access.manage": "write" } });
    expect(wrapper.findAll("input").every((input) => input.attributes("disabled") !== undefined)).toBe(true);
    expect(wrapper.find('[data-testid="matrix-set-all"]').exists()).toBe(false);
    expect(radio(wrapper, "access.manage", "write").element.checked).toBe(true);
  });

  it("a read-only page disables it too", () => {
    const Page = { setup: () => { provide(READONLY, ref(true)); return () => h(PermissionMatrix, { areas: AREAS }); } };
    const wrapper = mount(Page);
    expect(wrapper.findAll("input").every((input) => input.attributes("disabled") !== undefined)).toBe(true);
  });
});
