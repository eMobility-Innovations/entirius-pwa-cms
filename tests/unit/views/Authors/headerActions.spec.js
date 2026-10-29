import { describe, it, expect, vi } from "vitest";
import AuthorEdit from "@/views/Authors/AuthorEdit.vue";

// The author form's actions moved from the panel toolbar into the PageHeader ActionBar (plan 35): the same handlers,
// shown on the same conditions as before.
const actionsOf = (state) => AuthorEdit.computed.headerActions.call(Object.assign(state, { $t: (key) => key }));

describe("AuthorEdit header actions", () => {
  it("a new author offers Save only", () => {
    expect(actionsOf({ isEdit: false, save: vi.fn() }).map((a) => a.key)).toEqual(["save"]);
  });

  it("a saved author: danger Delete opens the confirm, primary Save saves", () => {
    const state = { isEdit: true, save: vi.fn() };
    const actions = actionsOf(state);
    expect(actions.map(({ key, role, icon, variant }) => ({ key, role, icon, variant }))).toEqual([
      { key: "delete", role: "utility", icon: "delete", variant: "danger" },
      { key: "save", role: "primary", icon: undefined, variant: undefined },
    ]);
    actions[0].onClick();
    expect(state.showDeleteConfirm).toBe(true);
    expect(actions[1].onClick).toBe(state.save);
  });
});
