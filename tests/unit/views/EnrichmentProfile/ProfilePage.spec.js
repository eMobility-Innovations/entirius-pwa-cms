import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import schema from "../../../fixtures/profile-schema.json";

const api = vi.hoisted(() => ({
  GET_Profile: vi.fn(),
  PUT_Profile: vi.fn(),
  GET_ProfileStatus: vi.fn(),
  GET_ProfileVersions: vi.fn(),
  GET_ProfileSchema: vi.fn(),
  POST_RestoreProfileVersion: vi.fn(),
}));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/api/enrichment/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification: vi.fn() }) }));
vi.mock("@/stores/enrichmentProfile", () => ({ useEnrichmentProfileStore: () => ({ refresh }) }));
vi.mock("@/views/EnrichmentProfile/useProfileChannels", () => ({
  useProfileChannels: () => ({ options: [{ value: "", label: "Whole company" }], load: vi.fn() }),
}));

import ProfilePage from "@/views/EnrichmentProfile/ProfilePage.vue";

const ProfileSection = { name: "ProfileSection", props: ["section", "modelValue", "status", "errors"], template: "<div />" };
const ActionBar = { name: "ActionBar", props: ["actions"], template: "<div />" };
const ProfileHistory = { name: "ProfileHistory", props: ["visible", "versions", "busy"], emits: ["restore", "close"], template: "<div />" };
const stubs = {
  PageHeader: { template: "<div><slot name='meta' /><slot name='actions' /></div>" },
  BasicSelect: true, BasicCard: { template: "<section><slot /></section>" }, BasicTextarea: true,
  ProfileCompleteness: true, ProfileSection, ActionBar, ProfileHistory,
};
const STATUS = { channel: "", complete: false, sections: [{ key: "brand", complete: true, minimum: "" }, { key: "facts", complete: false, minimum: "" }] };
const PROFILE = { channel: "", version: 2, data: { brand: { text: "We make sofas.", differentiators: ["Made to order"] } } };
const VERSIONS = [{ version: 2, note: "", data: PROFILE.data }, { version: 1, note: "", data: {} }];

function mountPage() {
  return mount(ProfilePage, { global: { stubs, mocks: { $route: { query: {} }, $router: { replace: vi.fn() } } } });
}
const action = (w, key) => w.findComponent(ActionBar).props("actions").find((a) => a.key === key);
const section = (w, key) => w.findAllComponents(ProfileSection).find((s) => s.props("section").key === key);

describe("ProfilePage", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    refresh.mockReset();
    api.GET_ProfileSchema.mockResolvedValue({ data: { schema_version: 1, json_schema: schema } });
    api.GET_Profile.mockResolvedValue({ data: PROFILE });
    api.GET_ProfileStatus.mockResolvedValue({ data: STATUS });
    api.GET_ProfileVersions.mockResolvedValue({ data: VERSIONS });
  });

  it("builds one section per schema section with its data and completeness", async () => {
    const w = mountPage();
    await flushPromises();
    expect(w.findAllComponents(ProfileSection)).toHaveLength(12);
    expect(section(w, "brand").props("modelValue")).toEqual(PROFILE.data.brand);
    expect(section(w, "facts").props("status")).toEqual(STATUS.sections[1]);
    expect(api.GET_Profile).toHaveBeenCalledWith({ channel: "" });
  });

  it("saves the edited data without empty values, with the note, as a new version", async () => {
    api.PUT_Profile.mockResolvedValue({ data: { ...PROFILE, version: 3 } });
    const w = mountPage();
    await flushPromises();
    section(w, "tone").vm.$emit("update:modelValue", { text: "Calm and direct.", ai_patterns: [] });
    await w.vm.$nextTick();
    expect(w.find("[data-testid='profile-unsaved']").exists()).toBe(true);
    w.vm.note = " tone added ";
    await action(w, "save").onClick();
    await flushPromises();
    expect(api.PUT_Profile).toHaveBeenCalledWith(
      { channel: "" },
      { data: { brand: PROFILE.data.brand, tone: { text: "Calm and direct." } }, note: "tone added" }
    );
    expect(refresh).toHaveBeenCalled();
    expect(api.GET_ProfileVersions).toHaveBeenCalledTimes(2);
  });

  it("a refused save shows each error at its section", async () => {
    api.PUT_Profile.mockRejectedValue({
      response: { data: { details: [{ field: "data.brand.differentiators.0", description: "Too long" }] } },
    });
    const w = mountPage();
    await flushPromises();
    await action(w, "save").onClick();
    await flushPromises();
    expect(section(w, "brand").props("errors")).toEqual({ "differentiators.0": "Too long" });
    expect(section(w, "tone").props("errors")).toEqual({});
  });

  it("Edit JSON: invalid text is shown at its paths and never sent", async () => {
    const w = mountPage();
    await flushPromises();
    action(w, "json").onClick();
    await w.vm.$nextTick();
    expect(JSON.parse(w.vm.jsonText)).toEqual(PROFILE.data);
    w.vm.jsonText = JSON.stringify({ brand: { differentiators: [1] } });
    await w.vm.$nextTick();
    expect(w.find("[data-testid='profile-json-errors']").text()).toContain("brand.differentiators.0");
    await action(w, "save").onClick();
    expect(api.PUT_Profile).not.toHaveBeenCalled();
    action(w, "json").onClick();
    expect(w.vm.jsonMode).toBe(true);
  });

  it("Edit JSON: valid text goes back to the form", async () => {
    const w = mountPage();
    await flushPromises();
    action(w, "json").onClick();
    w.vm.jsonText = JSON.stringify({ tone: { text: "Warm." } });
    action(w, "json").onClick();
    await w.vm.$nextTick();
    expect(w.vm.jsonMode).toBe(false);
    expect(section(w, "tone").props("modelValue")).toEqual({ text: "Warm." });
  });

  it("restores a version from the history", async () => {
    api.POST_RestoreProfileVersion.mockResolvedValue({ data: { ...PROFILE, version: 3, data: {} } });
    const w = mountPage();
    await flushPromises();
    w.findComponent(ProfileHistory).vm.$emit("restore", 1);
    await flushPromises();
    expect(api.POST_RestoreProfileVersion).toHaveBeenCalledWith(1, { channel: "" });
    expect(section(w, "brand").props("modelValue")).toBeUndefined();
  });
});
