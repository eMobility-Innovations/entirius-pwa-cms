import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";

// Access plan 20: built-in roles open read-only with Duplicate, a copy of Administrator leaves access.manage behind
// and says so, a save never sends access.manage, and the server's ACCESS_MANAGE_RESERVED reads as a sentence.
const api = vi.hoisted(() => ({
  GET_AccessCatalogue: vi.fn(),
  GET_AccessAllRoles: vi.fn(),
  GET_AccessRole: vi.fn(),
  POST_AccessRole: vi.fn(),
  PATCH_AccessRole: vi.fn(),
  DELETE_AccessRole: vi.fn(),
}));
const notify = vi.hoisted(() => ({ spawnNotification: vi.fn() }));
vi.mock("@/api/access/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => notify }));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart: vi.fn(), loaderFinish: vi.fn() }) }));

import RoleDetail from "@/views/Access/RoleDetail.vue";

const CATALOGUE = {
  modules: [
    { module: "django_pim", areas: [{ key: "pim.products", label: "P", levels: ["read", "write"], sensitive: [], assignable: true }] },
    { module: "django_access", areas: [{ key: "access.manage", label: "A", levels: ["read", "write"], sensitive: [], assignable: false }] },
  ],
};
const ROLES = [
  { id: 1, key: "administrator", name: "Administrator", builtin: true },
  { id: 7, key: "warehouse", name: "Warehouse", builtin: false },
];
const DETAILS = {
  1: { ...ROLES[0], description: "All", permissions: { "pim.products": "write", "access.manage": "write" } },
  7: { ...ROLES[1], description: "", permissions: { "pim.products": "read" } },
};

// Renders every slot, so the header actions and the cards' content are in the tree.
const slots = (name) =>
  defineComponent({ name, inheritAttrs: false, setup: (_, ctx) => () => h("div", Object.values(ctx.slots).map((s) => s())) });
const MatrixStub = defineComponent({
  name: "PermissionMatrix",
  props: ["modelValue", "areas", "disabled", "showReserved"],
  setup: () => () => h("div"),
});
const ActionBarStub = defineComponent({ name: "ActionBar", props: ["actions"], setup: () => () => h("div") });

async function open(route) {
  const push = vi.fn();
  const wrapper = mount(RoleDetail, {
    global: {
      mocks: { $route: { params: {}, query: {}, ...route }, $router: { push } },
      components: { PermissionMatrix: MatrixStub, ActionBar: ActionBarStub },
      stubs: {
        PageHeader: slots("PageHeader"), BasicCard: slots("BasicCard"), FormField: slots("FormField"),
        BasicInput: true, BasicTextarea: true, ConfirmDialog: true, EmptyState: true,
      },
    },
  });
  await flushPromises();
  return { wrapper, push };
}
const actionKeys = (wrapper) => wrapper.findComponent(ActionBarStub).props("actions").map((a) => a.key);
const matrix = (wrapper) => wrapper.findComponent(MatrixStub);

describe("RoleDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.GET_AccessCatalogue.mockResolvedValue({ data: CATALOGUE });
    api.GET_AccessAllRoles.mockResolvedValue(ROLES);
    api.GET_AccessRole.mockImplementation((id) => Promise.resolve({ data: DETAILS[id] }));
  });

  it("a built-in role is read-only: the notice, a disabled matrix with access.manage, Duplicate only", async () => {
    const { wrapper, push } = await open({ params: { key: "administrator" } });
    expect(api.GET_AccessRole).toHaveBeenCalledWith(1);
    expect(wrapper.find('[data-testid="builtin-notice"]').exists()).toBe(true);
    expect(matrix(wrapper).props()).toMatchObject({ disabled: true, showReserved: true });
    expect(actionKeys(wrapper)).toEqual(["duplicate"]);
    wrapper.findComponent(ActionBarStub).props("actions")[0].onClick();
    expect(push).toHaveBeenCalledWith({ path: "/access/roles/new", query: { from: "administrator" } });
  });

  it("a custom role is editable: Delete and Save, no reserved row", async () => {
    const { wrapper } = await open({ params: { key: "warehouse" } });
    expect(wrapper.find('[data-testid="builtin-notice"]').exists()).toBe(false);
    expect(matrix(wrapper).props()).toMatchObject({ disabled: false, showReserved: false });
    expect(actionKeys(wrapper)).toEqual(["delete", "save"]);
  });

  it("a duplicate of Administrator drops access.manage and says so", async () => {
    const { wrapper } = await open({ query: { from: "administrator" } });
    expect(matrix(wrapper).props("modelValue")).toEqual({ "pim.products": "write" });
    expect(wrapper.find('[data-testid="reserved-dropped-notice"]').exists()).toBe(true);
    expect(wrapper.vm.form).toMatchObject({ key: "", name: "access.roles.copy_of::{\"name\":\"Administrator\"}" });
  });

  it("the save payload never holds an access.manage key", async () => {
    api.POST_AccessRole.mockResolvedValue({ data: { ...DETAILS[7], key: "ops" } });
    const { wrapper, push } = await open({});
    Object.assign(wrapper.vm.form, { key: "ops", name: "Ops", permissions: { "pim.products": "read", "access.manage": "write" } });
    await wrapper.vm.saveRole();
    expect(api.POST_AccessRole).toHaveBeenCalledWith({ key: "ops", name: "Ops", description: "", permissions: ["pim.products:read"] });
    expect(push).toHaveBeenCalledWith("/access/roles/ops");
  });

  it("ACCESS_MANAGE_RESERVED from the server reads as a plain sentence", async () => {
    api.PATCH_AccessRole.mockRejectedValue({
      error: "VALIDATION_ERROR",
      message: "Request validation failed.",
      details: [{ field: "permissions", issue: "ACCESS_MANAGE_RESERVED", description: "x" }],
    });
    const { wrapper } = await open({ params: { key: "warehouse" } });
    expect(await wrapper.vm.saveRole()).toBe(false);
    expect(notify.spawnNotification).toHaveBeenCalledWith({ type: "negative", msg: "access.roles.reserved_error" });
  });

  it("a 409 on a built-in shows the server's message", async () => {
    api.PATCH_AccessRole.mockRejectedValue({ error: "CONFLICT", message: "Built-in role 'x' cannot be changed", details: [] });
    const { wrapper } = await open({ params: { key: "warehouse" } });
    await wrapper.vm.saveRole();
    expect(notify.spawnNotification).toHaveBeenCalledWith({ type: "negative", msg: "Built-in role 'x' cannot be changed" });
  });

  it("refuses the key \"new\" (it is the create route) without calling the server", async () => {
    const { wrapper } = await open({});
    Object.assign(wrapper.vm.form, { key: "new", name: "New" });
    expect(await wrapper.vm.saveRole()).toBe(false);
    expect(api.POST_AccessRole).not.toHaveBeenCalled();
    expect(wrapper.vm.formErrors.getFieldError("key")?.msg).toBe("access.roles.key_reserved");
  });

  it("save and leave on a new role leaves to where the user was going", async () => {
    api.POST_AccessRole.mockResolvedValue({ data: { ...DETAILS[7], key: "ops" } });
    const { wrapper, push } = await open({});
    const next = vi.fn();
    Object.assign(wrapper.vm.form, { key: "ops", name: "Ops" });
    wrapper.vm.isDirty = true; // the composable's deep watcher does not run under happy-dom; live it does
    wrapper.vm.guardNavigation({ path: "/faq" }, {}, next);
    await wrapper.vm.saveAndLeave();
    expect(push).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("a failed load shows an error state with no actions, never a blank editable form", async () => {
    api.GET_AccessCatalogue.mockRejectedValue({ error: "INTERNAL_ERROR", message: "boom", httpStatus: 500 });
    const { wrapper } = await open({ params: { key: "warehouse" } });
    expect(wrapper.vm.loadFailed).toBe(true);
    expect(matrix(wrapper).exists()).toBe(false);
    expect(actionKeys(wrapper)).toEqual([]);
  });

  it("a role gone between the list and its detail (unwrapped 404) is not found", async () => {
    api.GET_AccessRole.mockRejectedValue({ error: "NOT_FOUND", httpStatus: 404 });
    const { wrapper } = await open({ params: { key: "warehouse" } });
    expect(wrapper.vm.notFound).toBe(true);
    expect(notify.spawnNotification).not.toHaveBeenCalled();
  });

  it("an unknown key shows the empty state, not a blank form", async () => {
    const { wrapper } = await open({ params: { key: "nope" } });
    expect(wrapper.vm.notFound).toBe(true);
    expect(matrix(wrapper).exists()).toBe(false);
  });
});
