import { describe, it, expect, vi } from "vitest";

vi.mock("@/api/agreements/api", () => ({ GET_Definition: vi.fn().mockRejectedValue(new Error("offline")) }));

import AgreementEdit from "@/views/Agreements/AgreementEdit.vue";
import ConsentPeople from "@/views/Agreements/ConsentPeople.vue";

// Plan 36 moved the toolbar actions into PageHeader ActionBars and the draft edit form out of the versions table:
// the same handlers, shown on the same conditions as before. The state object is the component instance.
const call = (component, name, state) =>
  component.computed[name].call(Object.assign(state, { $t: (key) => key }));

describe("AgreementEdit header actions", () => {
  it("a new definition offers Save only", () => {
    const actions = call(AgreementEdit, "headerActions", { isEdit: false, definition: {}, saveDefinition: vi.fn() });
    expect(actions.map((a) => a.key)).toEqual(["save"]);
  });

  it("a saved definition: danger Delete (opens the confirmation), primary Save", () => {
    const state = { isEdit: true, definition: { is_system: false }, saveDefinition: vi.fn() };
    const actions = call(AgreementEdit, "headerActions", state);
    expect(actions.map(({ key, role, variant }) => ({ key, role, variant }))).toEqual([
      { key: "delete", role: "utility", variant: "danger" },
      { key: "save", role: "primary", variant: undefined },
    ]);
    actions[0].onClick();
    expect(state.showDeleteConfirm).toBe(true);
    expect(actions[1].onClick).toBe(state.saveDefinition);
  });

  it("a system definition cannot be deleted", () => {
    const actions = call(AgreementEdit, "headerActions", { isEdit: true, definition: { is_system: true } });
    expect(actions.map((a) => a.key)).toEqual(["save"]);
  });
});

describe("AgreementEdit versions card", () => {
  it("a secondary action shows and hides the new-version form, its state in aria-expanded", () => {
    const state = { showVersionForm: false };
    const [create] = call(AgreementEdit, "versionActions", state);
    expect(create).toMatchObject({ role: "secondary", label: "agm.create_version", expanded: false });
    create.onClick();
    expect(state.showVersionForm).toBe(true);
  });
});

describe("AgreementEdit draft edit form", () => {
  const versions = [
    { id: 1, published_at: null },
    { id: 2, published_at: "2026-09-10T10:00:00Z" },
  ];

  it("edits the draft being edited, never a published version", () => {
    expect(call(AgreementEdit, "editingVersion", { versions, editingVersionId: 1 })).toEqual(versions[0]);
    expect(call(AgreementEdit, "editingVersion", { versions, editingVersionId: 2 })).toBeNull();
    expect(call(AgreementEdit, "editingVersion", { versions, editingVersionId: null })).toBeNull();
  });

  it("a phone keeps version, status and actions of the versions table", () => {
    const columns = call(AgreementEdit, "versionColumns", {});
    expect(columns.filter((c) => !c.priority).map((c) => c.key)).toEqual(["version_number", "published_at", "actions"]);
  });

  it("a language chip refetches the legal page history", () => {
    const state = { contentHistoryLang: "", fetchContentHistory: vi.fn() };
    AgreementEdit.methods.setHistoryLang.call(state, "pl");
    expect(state.contentHistoryLang).toBe("pl");
    expect(state.fetchContentHistory).toHaveBeenCalledOnce();
  });
});

describe("ConsentPeople header actions", () => {
  it("the CSV download is a secondary action", () => {
    const state = { downloadCSV: vi.fn() };
    const [action] = call(ConsentPeople, "headerActions", state);
    expect(action).toMatchObject({ key: "csv", role: "secondary" });
    expect(action.onClick).toBe(state.downloadCSV);
  });
});

describe("AgreementEdit load failure", () => {
  const failingState = (definition) => ({
    definition,
    loadFailed: false,
    $route: { params: { slug: "terms" } },
    $t: (key) => key,
    notify: { spawnNotification: vi.fn() },
  });

  it("a failed first load shows the error state", async () => {
    const state = failingState({});
    await AgreementEdit.methods.fetchDefinition.call(state);
    expect(state.loadFailed).toBe(true);
  });

  it("a failed refresh after a save keeps the form", async () => {
    const state = failingState({ slug: "terms" });
    await AgreementEdit.methods.fetchDefinition.call(state);
    expect(state.loadFailed).toBe(false);
  });
});
