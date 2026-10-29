// Plan 42: the editor's Save draft / Publish and the copy dialog's Cancel / Copy moved from raw buttons and teleported
// toolbar buttons to ActionBar actions; the handlers and their guards stay.
import { describe, it, expect, vi } from "vitest";

vi.mock("@/api/contentDB/api", () => ({}));

import NavigationEditor from "@/views/LayoutExtenders/NavigationEditor.vue";
import LayoutExtenderList from "@/views/LayoutExtenders/LayoutExtenderList.vue";

const $t = (key) => key;

describe("NavigationEditor header actions", () => {
  it("puts Publish rightmost as the primary, disabled without a document", () => {
    const ctx = { $t, uid: null, saveDraft: vi.fn(), publish: vi.fn() };
    const actions = NavigationEditor.computed.headerActions.call(ctx);
    expect(actions.map((action) => [action.key, action.role])).toEqual([
      ["save-draft", "secondary"],
      ["publish", "primary"],
    ]);
    expect(actions[1]).toMatchObject({ disabled: true, testid: "nav-editor-publish", onClick: ctx.publish });
    expect(NavigationEditor.computed.headerActions.call({ ...ctx, uid: "abc" })[1].disabled).toBe(false);
  });
});

describe("LayoutExtenderList copy dialog actions", () => {
  it("enables Copy once a target channel is picked and while no copy runs", () => {
    const ctx = { $t, copyTargetChannel: null, copying: false, closeCopy: vi.fn(), onCopyConfirm: vi.fn() };
    const copy = (over) => LayoutExtenderList.computed.copyActions.call({ ...ctx, ...over })[1];
    expect(copy({}).disabled).toBe(true);
    expect(copy({ copyTargetChannel: "shop" })).toMatchObject({ disabled: false, onClick: ctx.onCopyConfirm });
    expect(copy({ copyTargetChannel: "shop", copying: true }).disabled).toBe(true);
  });
});
