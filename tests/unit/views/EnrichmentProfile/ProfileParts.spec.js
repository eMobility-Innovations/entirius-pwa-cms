import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import schema from "../../../fixtures/profile-schema.json";
import ChipList from "@/views/EnrichmentProfile/ChipList.vue";
import RowsTable from "@/views/EnrichmentProfile/RowsTable.vue";
import ProfileSection from "@/views/EnrichmentProfile/ProfileSection.vue";
import ProfileHistory from "@/views/EnrichmentProfile/ProfileHistory.vue";
import { sectionsFrom } from "@/views/EnrichmentProfile/profileLogic";

const sectionOf = (key) => sectionsFrom(schema).find((s) => s.key === key);
const FormField = { name: "FormField", props: ["label", "error", "required"], template: "<label><slot /></label>" };
// A $t that knows every key, so the views pick the translation over their fallback.
const $t = (key) => `T:${key}`;
const passthrough = { template: "<div><slot /><slot name='actions' /></div>" };

describe("ChipList", () => {
  const Tag = { name: "Tag", props: ["label"], emits: ["remove"], template: "<i>{{ label }}</i>" };
  const BasicInput = { name: "BasicInput", props: ["modelValue"], emits: ["update:modelValue", "onKeyDown", "onFocusout"], template: "<input />" };

  it("adds a typed line once and removes a chip", async () => {
    const w = mount(ChipList, { props: { modelValue: ["Made to order"] }, global: { stubs: { Tag, BasicInput } } });
    const input = w.findComponent(BasicInput);
    input.vm.$emit("update:modelValue", "  Ten-year frame warranty ");
    await w.vm.$nextTick();
    input.vm.$emit("onKeyDown");
    expect(w.emitted("update:modelValue")[0][0]).toEqual(["Made to order", "Ten-year frame warranty"]);
    input.vm.$emit("update:modelValue", "Made to order");
    await w.vm.$nextTick();
    input.vm.$emit("onKeyDown");
    expect(w.emitted("update:modelValue")).toHaveLength(1);
    w.findComponent(Tag).vm.$emit("remove");
    expect(w.emitted("update:modelValue")[1][0]).toEqual([]);
  });
});

describe("RowsTable", () => {
  const columns = sectionOf("rules").columns;
  const rows = [{ id: "rule-1", pattern: "cheap", message: "Avoid", do: "affordable", dont: "cheap", active: false }];
  const stubs = { FormField, BasicSwitch: true, BasicTextarea: true, BasicInput: true, IconButton: true, BasicButton: true };

  it("labels the DO / DON'T columns, never shows the id, and adds a row with the next id", () => {
    const w = mount(RowsTable, { props: { modelValue: rows, columns, section: "rules" }, global: { stubs, mocks: { $t } } });
    const labels = w.findAllComponents(FormField).map((f) => f.props("label"));
    expect(labels).toEqual(["pattern", "flags", "message", "do", "dont", "active"].map((k) => `T:enrichment.profile.columns.${k}`));
    expect(w.find("[data-testid='rows-table-row-0']").classes()).toContain("rows-table__row--off");
    w.vm.add();
    expect(w.emitted("update:modelValue")[0][0][1]).toMatchObject({ id: "rule-2", active: true });
    w.vm.remove(0);
    expect(w.emitted("update:modelValue")[1][0]).toEqual([]);
  });

  it("shows an API error at its cell", () => {
    const w = mount(RowsTable, { props: { modelValue: rows, columns, errors: { "0.pattern": "Bad pattern" } }, global: { stubs } });
    expect(w.findAllComponents(FormField)[0].props("error")).toBe("Bad pattern");
  });
});

describe("ProfileSection", () => {
  const stubs = { BasicCard: passthrough, FormField, StatusBadge: { props: ["label", "tone"], template: "<b>{{ label }}</b>" }, ProfileField: true };

  it("shows the minimum an incomplete section misses and the errors no field shows", () => {
    const w = mount(ProfileSection, {
      props: {
        section: sectionOf("brand"),
        modelValue: { text: "" },
        status: { key: "brand", complete: false, minimum: "at least 1 differentiator" },
        errors: { text: "Too long", "differentiators.0": "Not a string" },
      },
      global: { stubs, mocks: { $t } },
    });
    expect(w.find("[data-testid='profile-section-minimum-brand']").text()).toBe("T:enrichment.profile.minimum.brand");
    expect(w.findAllComponents(FormField)[0].props("error")).toBe("Too long");
    expect(w.find("[data-testid='profile-section-errors-brand']").text()).toBe("differentiators.0: Not a string");
  });

  it("a field change updates the whole section", () => {
    const w = mount(ProfileSection, { props: { section: sectionOf("tone"), modelValue: { text: "Calm" } }, global: { stubs } });
    w.findAllComponents({ name: "ProfileField" })[1].vm.$emit("update:modelValue", ["Delve"]);
    expect(w.emitted("update:modelValue")[0][0]).toEqual({ text: "Calm", ai_patterns: ["Delve"] });
  });
});

describe("ProfileHistory", () => {
  const versions = [
    { version: 3, note: "tone", created_at: "2026-10-14T10:00:00Z", data: { tone: { text: "B" } } },
    { version: 2, note: "", created_at: "2026-10-13T10:00:00Z", data: { tone: { text: "A" } } },
  ];
  const stubs = {
    SideDrawer: { template: "<div><slot /></div>" }, ReadonlyOff: passthrough, BasicSelect: true,
    TextDiff: { name: "TextDiff", props: ["before", "after"], template: "<pre />" },
    ConfirmDialog: { name: "ConfirmDialog", props: ["open", "message"], emits: ["confirm"], template: "<div />" },
  };

  it("the restore prompt warns that unsaved edits will be lost", () => {
    const clean = mount(ProfileHistory, { props: { visible: true, versions }, global: { stubs } });
    const dirty = mount(ProfileHistory, { props: { visible: true, versions, dirty: true }, global: { stubs } });
    const message = (w) => w.findComponent({ name: "ConfirmDialog" }).props("message");
    expect(message(clean)).not.toContain(dirty.vm.$t("enrichment.profile.restore_discards"));
    expect(message(dirty)).toContain(dirty.vm.$t("enrichment.profile.restore_discards"));
  });

  it("compares the previous version with the latest and restores after a confirmation", async () => {
    const w = mount(ProfileHistory, { props: { visible: true, versions }, global: { stubs } });
    // Section by section, as text: never the stored JSON.
    const diff = w.find("[data-testid='profile-diff-tone']").findComponent({ name: "TextDiff" });
    expect(diff.props("before")).toBe("text:\nA");
    expect(diff.props("after")).toBe("text:\nB");
    expect(w.find("[data-testid='profile-restore-3']").exists()).toBe(false);
    await w.find("[data-testid='profile-restore-2']").trigger("click");
    expect(w.findComponent({ name: "ConfirmDialog" }).props("open")).toBe(true);
    w.findComponent({ name: "ConfirmDialog" }).vm.$emit("confirm");
    expect(w.emitted("restore")[0]).toEqual([2]);
  });
});
