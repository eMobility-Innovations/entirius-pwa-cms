import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";

// Access plan 21: a staff account's grants are added and revoked by id, the lockout 409 reads as a notice line in the
// card, and the audit filters reach the query string. The real English messages, so the sentences are what a user reads.
const api = vi.hoisted(() => ({
  GET_AccessStaffUser: vi.fn(),
  GET_AccessAllStaff: vi.fn(),
  GET_AccessAllRoles: vi.fn(),
  GET_AccessAudit: vi.fn(),
  POST_AccessGrant: vi.fn(),
  DELETE_AccessGrant: vi.fn(),
}));
const notify = vi.hoisted(() => ({ spawnNotification: vi.fn() }));
vi.mock("@/api/access/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => notify }));
const access = vi.hoisted(() => ({ me: { user: { id: 1 } }, refresh: vi.fn() }));
vi.mock("@/stores/access", () => ({ useAccessStore: () => access }));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart: vi.fn(), loaderFinish: vi.fn() }) }));

import { t } from "@/i18n";
import StaffDetail from "@/views/Access/StaffDetail.vue";
import AuditList from "@/views/Access/AuditList.vue";

const USER = {
  id: 5,
  username: "viewer",
  email: "viewer@example.test",
  name: "",
  is_superuser: false,
  roles: [{ key: "viewer", name: "Viewer", via_group: null }],
  groups: [{ id: 3, name: "Shop" }],
  grants: [
    { id: 11, role: { id: 4, key: "viewer", name: "Viewer" }, user: { id: 5, username: "viewer" }, group: null, created_at: "2026-10-01T10:00:00Z" },
    { id: 12, role: { id: 3, key: "editor", name: "Editor" }, user: null, group: { id: 3, name: "Shop" }, created_at: "2026-10-01T10:00:00Z" },
  ],
};
const ROLES = [
  { id: 1, key: "administrator", name: "Administrator" },
  { id: 4, key: "viewer", name: "Viewer" },
];

const slots = (name) =>
  defineComponent({ name, inheritAttrs: false, setup: (_, ctx) => () => h("div", Object.values(ctx.slots).map((s) => s())) });
const stubs = {
  PageLayout: slots("PageLayout"), PageHeader: slots("PageHeader"), BasicCard: slots("BasicCard"), FormField: slots("FormField"),
  MobileFilterPanel: slots("MobileFilterPanel"), DataTable: true, BasicSelect: true, BasicButton: true, BasicDatePicker: true,
  ConfirmDialog: true, EmptyState: true, Tag: true, Loader: true, FilterChip: true, Pagination: true, IconButton: true,
};

async function mountView(component, route = {}) {
  const wrapper = mount(component, { global: { mocks: { $t: t, $route: { params: {}, query: {}, ...route }, $router: { push: vi.fn() } }, stubs } });
  await flushPromises();
  return wrapper;
}
const lastToast = () => notify.spawnNotification.mock.calls.at(-1)[0];

describe("StaffDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.GET_AccessStaffUser.mockResolvedValue({ data: USER });
    api.GET_AccessAllRoles.mockResolvedValue(ROLES);
  });

  it("splits direct grants from group roles and offers only roles not held directly", async () => {
    const wrapper = await mountView(StaffDetail, { params: { id: "5" } });
    expect(api.GET_AccessStaffUser).toHaveBeenCalledWith("5");
    expect(wrapper.vm.directGrants.map((g) => g.id)).toEqual([11]);
    expect(wrapper.vm.groupRows).toEqual([{ id: 3, name: "Shop", grants: [USER.grants[1]] }]);
    expect(wrapper.vm.addOptions).toEqual([{ label: "Administrator", value: "administrator" }]);
  });

  it("adds a role to the user and revokes a grant by its id", async () => {
    api.POST_AccessGrant.mockResolvedValue({ data: {} });
    api.DELETE_AccessGrant.mockResolvedValue({});
    const wrapper = await mountView(StaffDetail, { params: { id: "5" } });
    wrapper.vm.newRole = "administrator";
    await wrapper.vm.addGrant();
    expect(api.POST_AccessGrant).toHaveBeenCalledWith({ role: "administrator", user_id: 5 });
    wrapper.vm.pendingRevoke = USER.grants[0];
    await wrapper.vm.revokeGrant();
    expect(api.DELETE_AccessGrant).toHaveBeenCalledWith(11);
    expect(lastToast()).toEqual({ type: "positive", msg: "Role revoked" });
  });

  // FIX-09 #17: your own grants change what the sidebar and the read-only pages may show — `me` is asked again now.
  it("a grant change on your own account refreshes `me` at once; on another account it does not", async () => {
    api.POST_AccessGrant.mockResolvedValue({ data: {} });
    const wrapper = await mountView(StaffDetail, { params: { id: "5" } });
    wrapper.vm.newRole = "administrator";
    await wrapper.vm.addGrant();
    expect(access.refresh).not.toHaveBeenCalled();
    access.me = { user: { id: 5 } };
    wrapper.vm.newRole = "administrator";
    await wrapper.vm.addGrant();
    expect(access.refresh).toHaveBeenCalledWith(true);
    access.me = { user: { id: 1 } };
  });

  it("the lockout 409 on a revoke stays as the sentence in the card, not a toast, until the next change", async () => {
    api.DELETE_AccessGrant.mockRejectedValue({ response: { status: 409, data: { error: "CONFLICT", message: "Nobody active" } } });
    api.POST_AccessGrant.mockResolvedValue({ data: {} });
    const wrapper = await mountView(StaffDetail, { params: { id: "5" } });
    wrapper.vm.pendingRevoke = USER.grants[0];
    await wrapper.vm.revokeGrant();
    await flushPromises();
    expect(notify.spawnNotification).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="grant-lockout"]').text()).toBe(
      "At least one person must keep access management — grant it to someone else first"
    );
    wrapper.vm.newRole = "administrator";
    await wrapper.vm.addGrant();
    await flushPromises();
    expect(wrapper.find('[data-testid="grant-lockout"]').exists()).toBe(false);
  });

  it("another refused revoke is a toast with the server's description", async () => {
    api.DELETE_AccessGrant.mockRejectedValue({ response: { status: 400, data: { message: "Not staff" } } });
    const wrapper = await mountView(StaffDetail, { params: { id: "5" } });
    wrapper.vm.pendingRevoke = USER.grants[0];
    await wrapper.vm.revokeGrant();
    expect(lastToast()).toEqual({ type: "negative", msg: "Not staff" });
    expect(wrapper.find('[data-testid="grant-lockout"]').exists()).toBe(false);
  });

  it("a failed role list leaves the account readable, with nothing to add", async () => {
    api.GET_AccessAllRoles.mockRejectedValue(new Error("down"));
    const wrapper = await mountView(StaffDetail, { params: { id: "5" } });
    expect(wrapper.vm.loadFailed).toBe(false);
    expect(wrapper.vm.directGrants).toHaveLength(1);
    expect(wrapper.vm.addOptions).toEqual([]);
  });

  it("an unknown account is not found, not an editable page", async () => {
    api.GET_AccessStaffUser.mockRejectedValue({ response: { status: 404, data: {} } });
    const wrapper = await mountView(StaffDetail, { params: { id: "99" } });
    expect(wrapper.vm.notFound).toBe(true);
    expect(notify.spawnNotification).not.toHaveBeenCalled();
  });
});

describe("AuditList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.GET_AccessAudit.mockResolvedValue({ data: { count: 0, results: [] } });
    api.GET_AccessAllStaff.mockResolvedValue([{ id: 7, username: "admin", name: "" }]);
  });

  it("filters reach the query and go back to the first page", async () => {
    const wrapper = await mountView(AuditList);
    expect(api.GET_AccessAudit).toHaveBeenLastCalledWith({ page: 1, page_size: 50, fold_bypass: true });
    wrapper.vm.changePage(3);
    wrapper.vm.setFilter("action", "grant.migrate");
    wrapper.vm.setFilter("actor", 7);
    expect(api.GET_AccessAudit).toHaveBeenLastCalledWith({
      page: 1,
      page_size: 50,
      action: "grant.migrate",
      actor: 7,
      fold_bypass: true,
    });
    expect(wrapper.vm.actorOptions).toEqual([{ label: "admin", value: 7 }]);
  });

  it("actions read as human labels; an unknown action shows as it is", async () => {
    const wrapper = await mountView(AuditList);
    expect(wrapper.vm.actionLabel("grant.migrate")).toBe("Role granted at install");
    expect(wrapper.vm.actionLabel("gate.bypass")).toBe("Superuser access");
    expect(wrapper.vm.actionLabel("custom.thing")).toBe("custom.thing");
  });

  const FOLDED = {
    id: 90,
    actor_id: 7,
    actor_label: "admin",
    action: "gate.bypass",
    created_at: "2026-10-02T15:00:00Z",
    first_at: "2026-10-02T06:00:00Z",
    last_at: "2026-10-02T15:00:00Z",
    folded: 120,
    detail: {},
  };
  const foldedPage = { data: { count: 61, results: [FOLDED] } };

  it("asks the API to fold; the chip off or the bypass filter asks for raw rows from the first page", async () => {
    const wrapper = await mountView(AuditList);
    wrapper.vm.changePage(2);
    wrapper.vm.toggleFold();
    expect(api.GET_AccessAudit).toHaveBeenLastCalledWith({ page: 1, page_size: 50 });
    wrapper.vm.toggleFold();
    expect(api.GET_AccessAudit).toHaveBeenLastCalledWith({ page: 1, page_size: 50, fold_bypass: true });
    wrapper.vm.setFilter("action", "gate.bypass");
    expect(api.GET_AccessAudit).toHaveBeenLastCalledWith({ page: 1, page_size: 50, action: "gate.bypass" });
  });

  it("the pager counts the folded rows and a folded row reads as its count", async () => {
    api.GET_AccessAudit.mockResolvedValue(foldedPage);
    const wrapper = await mountView(AuditList);
    expect(wrapper.vm.pages).toBe(2);
    expect(wrapper.vm.rows).toHaveLength(1);
    expect(wrapper.vm.isFolded(wrapper.vm.rows[0])).toBe(true);
    expect(wrapper.vm.rows[0].target).toBe("120 requests");
  });

  it("expanding a folded row loads its requests by the row's bounds, once", async () => {
    api.GET_AccessAudit.mockResolvedValue(foldedPage);
    const wrapper = await mountView(AuditList);
    const row = wrapper.vm.rows[0];
    api.GET_AccessAudit.mockResolvedValue({ data: { count: 120, results: [{ id: 1, detail: { path: "/a" } }] } });
    wrapper.vm.onExpandToggle({ row, expanded: true });
    expect(wrapper.vm.requestsOf(row)).toEqual({ loading: true });
    expect(api.GET_AccessAudit).toHaveBeenLastCalledWith({
      page: 1,
      page_size: 50,
      action: "gate.bypass",
      actor: 7,
      from: "2026-10-02T06:00:00Z",
      to: "2026-10-02T15:00:00Z",
    });
    await flushPromises();
    expect(wrapper.vm.requestsOf(row)).toEqual({ items: [{ path: "/a" }] });
    const calls = api.GET_AccessAudit.mock.calls.length;
    wrapper.vm.onExpandToggle({ row, expanded: false });
    wrapper.vm.onExpandToggle({ row, expanded: true });
    expect(api.GET_AccessAudit.mock.calls).toHaveLength(calls);
  });

  it("a failed load of the requests is an error state that a retry clears", async () => {
    api.GET_AccessAudit.mockResolvedValue(foldedPage);
    const wrapper = await mountView(AuditList);
    const row = wrapper.vm.rows[0];
    api.GET_AccessAudit.mockRejectedValueOnce(new Error("down"));
    wrapper.vm.onExpandToggle({ row, expanded: true });
    await flushPromises();
    expect(wrapper.vm.requestsOf(row)).toEqual({ error: true });
    expect(notify.spawnNotification).not.toHaveBeenCalled();
    api.GET_AccessAudit.mockResolvedValue({ data: { count: 0, results: [] } });
    await wrapper.vm.fetchRequests(row);
    expect(wrapper.vm.requestsOf(row)).toEqual({ items: [] });
  });

  it("an expanded folded row shows the loader, then its requests with the showing line, or the error", async () => {
    const expandRows = defineComponent({
      props: { rows: Array },
      setup: (props, ctx) => () => h("div", props.rows.map((row) => ctx.slots.expand({ row }))),
    });
    api.GET_AccessAudit.mockResolvedValue(foldedPage);
    const wrapper = mount(AuditList, { global: { mocks: { $t: t }, stubs: { ...stubs, DataTable: expandRows } } });
    await flushPromises();
    const row = wrapper.vm.rows[0];
    expect(wrapper.findComponent({ name: "Loader" }).exists()).toBe(true);
    api.GET_AccessAudit.mockResolvedValue({ data: { count: 120, results: [{ id: 1, detail: { path: "/a" } }] } });
    await wrapper.vm.fetchRequests(row);
    await flushPromises();
    expect(wrapper.find("pre").text()).toContain('"path": "/a"');
    expect(wrapper.find('[data-testid="audit-requests-partial"]').text()).toBe("Showing 1 of 120 requests");
    api.GET_AccessAudit.mockRejectedValueOnce(new Error("down"));
    await wrapper.vm.fetchRequests(row);
    await flushPromises();
    expect(wrapper.find('[data-testid="audit-requests-error"]').text()).toContain("Could not load the requests");
  });

  it("an access version without folding answers raw rows: shown unfolded, nothing loaded on expand", async () => {
    const raw = [1, 2].map((id) => ({ id, actor_id: 7, action: "gate.bypass", created_at: FOLDED.created_at, detail: { id } }));
    api.GET_AccessAudit.mockResolvedValue({ data: { count: 120, results: raw } });
    const wrapper = await mountView(AuditList);
    expect(wrapper.vm.rows).toHaveLength(2);
    expect(wrapper.vm.rows.some((row) => wrapper.vm.isFolded(row))).toBe(false);
    expect(wrapper.vm.pages).toBe(3);
    wrapper.vm.onExpandToggle({ row: wrapper.vm.rows[0], expanded: true });
    expect(api.GET_AccessAudit).toHaveBeenCalledTimes(1);
  });
});
