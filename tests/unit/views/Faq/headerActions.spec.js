import { describe, it, expect, vi } from "vitest";

import GroupEdit from "@/views/Faq/GroupEdit.vue";
import ItemEdit from "@/views/Faq/ItemEdit.vue";

// The header actions moved from the panel toolbar into an ActionBar (plan 33): the same handlers, shown on the same
// conditions as before.
// The state object is the component instance: the click handlers write to it.
const actionsOf = (component, state) => component.computed.headerActions.call(Object.assign(state, { $t: (key) => key }));

const summary = (actions) => actions.map(({ key, role, icon, variant }) => ({ key, role, icon, variant }));

describe("Faq header actions", () => {
  it("a new group offers Save only", () => {
    const actions = actionsOf(GroupEdit, { isEdit: false, channelLanguages: ["en"], saveGroup: vi.fn() });
    expect(actions.map((a) => a.key)).toEqual(["save"]);
  });

  it("a saved group: Translations (with channel languages), danger Delete, primary Save", () => {
    const state = { isEdit: true, channelLanguages: ["en", "pl"], saveGroup: vi.fn() };
    const actions = actionsOf(GroupEdit, state);
    expect(summary(actions)).toEqual([
      { key: "translations", role: "utility", icon: "translate", variant: undefined },
      { key: "delete", role: "utility", icon: "delete", variant: "danger" },
      { key: "save", role: "primary", icon: undefined, variant: undefined },
    ]);
    actions[0].onClick();
    actions[1].onClick();
    expect(state).toMatchObject({ showTranslationsDrawer: true, showDeleteConfirm: true });
    expect(actions[2].onClick).toBe(state.saveGroup);
  });

  it("a group without channel languages has no Translations", () => {
    const actions = actionsOf(GroupEdit, { isEdit: true, channelLanguages: [], saveGroup: vi.fn() });
    expect(actions.map((a) => a.key)).toEqual(["delete", "save"]);
  });

  it("an item: Delete once saved, Save always (translations stay per field)", () => {
    expect(actionsOf(ItemEdit, { isEdit: false, saveItem: vi.fn() }).map((a) => a.key)).toEqual(["save"]);
    const state = { isEdit: true, saveItem: vi.fn() };
    const actions = actionsOf(ItemEdit, state);
    expect(actions.map((a) => a.key)).toEqual(["delete", "save"]);
    actions[0].onClick();
    expect(state.showDeleteConfirm).toBe(true);
    expect(actions[1].onClick).toBe(state.saveItem);
  });

  it("names each per-field translations button after its field", () => {
    const $t = (key, params) => (params ? `${key}:${params.field}` : key);
    expect(ItemEdit.methods.translationsLabel.call({ $t }, "question")).toBe("faq.translations_of:faq.question");
  });
});
