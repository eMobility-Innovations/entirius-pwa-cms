import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import { accessApi } from "@/api/access/client";
import { useAccessMatrixStore } from "@/stores/accessMatrix";
import Overview from "@/views/Access/AccessOverview.vue";
import Shell from "@/views/Access/index.vue";
import { setLang, t } from "@/i18n";

afterEach(() => setLang("EN"));

vi.mock("@/api/access/client", () => ({
  accessApi: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
let overrides, grants, groupsError, unassignedError;
const catalog = {
  roles: ["USER", "ADMIN", "SYSADMIN"],
  pages: ["page:access"],
  features: ["feature:edit_role_mappings"],
  role_defaults: { USER: [] },
  effective: {
    USER: ["page:access"],
    ADMIN: [],
    SYSADMIN: ["page:access", "feature:edit_role_mappings"],
  },
};
beforeEach(() => {
  setLang("EN");
  setActivePinia(createPinia());
  vi.clearAllMocks();
  groupsError = null;
  unassignedError = null;
  overrides = {
    roles: [],
    users: [{ kc_username: "alice", permissions: ["page:access"] }],
  };
  grants = [
    {
      id: 7,
      role: "ADMIN",
      grantee_type: "group",
      grantee: "grp-uuid",
      group_name: "Display label",
      name_resolved: true,
    },
  ];
  accessApi.get.mockImplementation(async (url) => {
    if (url.endsWith("/me/"))
      return {
        data: {
          kc_username: "operator",
          django_username: "operator_1",
          permissions: ["page:access", "feature:edit_role_mappings"],
        },
      };
    if (url.endsWith("/catalog/")) return { data: structuredClone(catalog) };
    if (url.endsWith("/overrides/"))
      return { data: structuredClone(overrides) };
    if (url.endsWith("/grants/")) return { data: structuredClone(grants) };
    if (url.endsWith("/groups/")) {
      if (groupsError) throw groupsError;
      return {
        data: [
          { name: "buyers", grantable: true },
          { name: "blocked", grantable: false },
        ],
      };
    }
    if (url.endsWith("/users/"))
      return {
        data: [
          {
            kc_username: "bob",
            first_name: "Bob",
            last_name: "Smith",
            email: "bob@example.com",
          },
        ],
      };
    if (url.endsWith("/unassigned/")) {
      if (unassignedError) throw unassignedError;
      return {
        data: { users: [{ username: "bob" }], groups: [{ name: "buyers" }] },
      };
    }
    throw new Error(`Unexpected GET ${url}`);
  });
  accessApi.put.mockResolvedValue({ status: 204 });
  accessApi.delete.mockResolvedValue({ status: 204 });
  accessApi.post.mockResolvedValue({ data: {} });
});
async function render(write = true) {
  const store = useAccessMatrixStore();
  store.me = (await accessApi.get("/api/escaccess/v2/me/")).data;
  if (!write) store.me.permissions = ["page:access"];
  store.catalog = structuredClone(catalog);
  const wrapper = mount(Overview, { global: { mocks: { $t: t } } });
  await flushPromises();
  return wrapper;
}
const row = (w, scope, name) => w.get(`[data-test="row-${scope}-${name}"]`);

describe("fleet access overview", () => {
  it.each([
    ["EN", ["Grants", "Permission matrix", "Unassigned"]],
    ["PL", ["Nadania", "Macierz uprawnień", "Bez przypisanej roli"]],
  ])("orders and translates the overview sections in %s", async (lang, headings) => {
    setLang(lang);
    const w = await render();
    expect(w.findAll("h2").map((h) => h.text())).toEqual(headings);
    expect(w.text()).toContain(t("access.empty_override"));
    expect(w.findAll(".access-role-grid h3").map((h) => h.text())).toEqual([
      "SYSADMIN",
      "ADMIN",
      "USER",
    ]);
    expect(w.findAll("table")).toHaveLength(1);
    expect(w.findAll(".access-vertical").map((h) => h.text())).toEqual(
      catalog.pages.concat(catalog.features)
    );
    expect(w.findAll('[data-test^="save-"]')).toHaveLength(0);
    expect(row(w, "role", "USER").text()).toContain(t("access.default"));
    expect(row(w, "user", "alice").text()).toContain(t("access.user_override"));
  });
  it.each([
    ["role", "USER", "roles"],
    ["user", "alice", "users"],
  ])(
    "saves an unticked %s row as an empty PUT, separately from Reset",
    async (scope, name, path) => {
      const w = await render();
      const r = row(w, scope, name);
      await r.findAll("input")[0].setValue(false);
      await r.get(`[data-test="save-${name}"]`).trigger("click");
      await flushPromises();
      expect(accessApi.put).toHaveBeenCalledWith(
        `/api/escaccess/v2/overrides/${path}/${name}/`,
        { permissions: [] }
      );
      expect(accessApi.delete).not.toHaveBeenCalled();
      expect(r.find(`[data-test="save-${name}"]`).exists()).toBe(false);
      await r.get(`[data-test="reset-${name}"]`).trigger("click");
      await flushPromises();
      expect(accessApi.delete).toHaveBeenCalledWith(
        `/api/escaccess/v2/overrides/${path}/${name}/`
      );
      if (scope === "user")
        expect(w.find('[data-test="row-user-alice"]').exists()).toBe(false);
    }
  );
  it("keeps a stored empty role override empty and labels it customised", async () => {
    overrides.roles = [{ role: "USER", permissions: [] }];
    const w = await render();
    expect(row(w, "role", "USER").text()).toContain("customised");
    expect(
      row(w, "role", "USER")
        .findAll("input")
        .every((i) => !i.element.checked)
    ).toBe(true);
  });
  it("hides Save again when the draft returns to its saved set", async () => {
    const w = await render();
    const r = row(w, "role", "USER");
    await r.findAll("input")[0].setValue(false);
    await r.findAll("input")[0].setValue(true);
    expect(r.find('[data-test="save-USER"]').exists()).toBe(false);
  });
  it("preserves other drafts after saving one row", async () => {
    const w = await render();
    await row(w, "role", "USER").findAll("input")[0].setValue(false);
    await row(w, "user", "alice").findAll("input")[0].setValue(false);
    await w.get('[data-test="save-USER"]').trigger("click");
    await flushPromises();
    expect(w.find('[data-test="save-alice"]').exists()).toBe(true);
  });
  it("adds a username draft via datalist and can save it genuinely empty", async () => {
    const w = await render();
    const form = w.get(".access-add-override");
    await form.get("input").setValue("bob");
    await flushPromises();
    expect(w.get("#access-override-users option").attributes("value")).toBe(
      "bob"
    );
    await form.trigger("submit");
    await row(w, "user", "bob").get('[data-test="save-bob"]').trigger("click");
    await flushPromises();
    expect(accessApi.put).toHaveBeenCalledWith(
      "/api/escaccess/v2/overrides/users/bob/",
      { permissions: [] }
    );
  });
  it("posts the selected directory group name, never the displayed label or stored UUID", async () => {
    const w = await render();
    expect(w.text()).toContain("Display label");
    await w.get('[data-test="add-group-ADMIN"]').trigger("click");
    const form = w.get(".access-role--ADMIN form");
    await form.get("input").setValue("buyers");
    await form.trigger("submit");
    await flushPromises();
    expect(accessApi.post).toHaveBeenCalledWith("/api/escaccess/v2/grants/", {
      role: "ADMIN",
      group_name: "buyers",
    });
    await w.get('[data-test="revoke-7"]').trigger("click");
    await flushPromises();
    expect(accessApi.delete).toHaveBeenCalledWith(
      "/api/escaccess/v2/grants/7/"
    );
  });
  it("does not submit a non-grantable group", async () => {
    const w = await render();
    await w.get('[data-test="add-group-USER"]').trigger("click");
    const form = w.get(".access-role--USER form");
    await form.get("input").setValue("blocked");
    await form.trigger("submit");
    expect(accessApi.post).not.toHaveBeenCalled();
  });
  it("has no write controls when /me grants only page:access", async () => {
    const w = await render(false);
    expect(w.findAll("button")).toHaveLength(0);
    expect(
      w.findAll('input[type="checkbox"]').every((i) => i.element.disabled)
    ).toBe(true);
    expect(w.text()).toContain("Display label");
  });
  it("reports a 503 directory failure and disables group writes", async () => {
    groupsError = { response: { status: 503 } };
    const w = await render();
    expect(w.text()).toContain(t("access.directory_unavailable"));
    expect(w.get('[data-test="add-group-USER"]').element.disabled).toBe(true);
    expect(w.get('[aria-label="Grant USER to buyers"]').element.disabled).toBe(
      true
    );
  });
  it("renders empty unassigned lists with a note on 404 and retains the matrix", async () => {
    unassignedError = { response: { status: 404 } };
    const w = await render();
    expect(w.text()).toContain(
      "Unassigned lists are not available on this backend yet."
    );
    expect(w.findAll(".access-unassigned-row")).toHaveLength(0);
    expect(w.find("table").exists()).toBe(true);
  });
  it.each([
    ["bob", "user"],
    ["buyers", "group_name"],
  ])("assigns unassigned %s using the API identity", async (name, key) => {
    const w = await render();
    await w.get(`[aria-label="Grant SYSADMIN to ${name}"]`).trigger("click");
    await flushPromises();
    expect(accessApi.post).toHaveBeenCalledWith("/api/escaccess/v2/grants/", {
      role: "SYSADMIN",
      [key]: name,
    });
  });
  it("keeps the shell no-grant behaviour without reading access content", async () => {
    const store = useAccessMatrixStore();
    store.loaded = true;
    store.me = { permissions: [] };
    const w = mount(Shell, {
      global: { stubs: { RouterLink: true, RouterView: true } },
    });
    await flushPromises();
    expect(w.find('[data-test="no-grant"]').exists()).toBe(true);
    expect(w.find("table").exists()).toBe(false);
    expect(accessApi.get).not.toHaveBeenCalled();
  });
  it("renders the full overview on the existing grants route through the shell", async () => {
    const store = useAccessMatrixStore();
    store.loaded = true;
    store.me = { permissions: ["page:access"] };
    store.catalog = catalog;
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: "/access",
          component: Shell,
          children: [
            { path: "grants", component: { template: "<div>old view</div>" } },
          ],
        },
      ],
    });
    await router.push("/access/grants");
    await router.isReady();
    const w = mount(
      { template: "<router-view />" },
      { global: { plugins: [router] } }
    );
    await flushPromises();
    expect(w.findAll("h2")).toHaveLength(3);
    expect(w.text()).not.toContain("old view");
  });
});
