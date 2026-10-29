import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, nextTick, reactive } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { routeLocationKey } from "vue-router";

// FIX-14 (D1): New staff member. The dialog's payload (no `password` while "Generate a password" is on), refusals on
// their fields (every password validator message, a 409 on username or e-mail), the generated password handed to
// SecretReveal and kept nowhere after it closes, and the action gone on a read-only page. A fake shorter than a real
// generated password.
const FAKE = "EXAMPLE-not-a-password";
const api = vi.hoisted(() => ({ GET_AccessStaff: vi.fn(), GET_AccessAllRoles: vi.fn(), POST_AccessStaff: vi.fn() }));
vi.mock("@/api/access/api", () => api);

import { t } from "@/i18n";
import { ACCESS_STORE } from "@/composables/useReadonly";
import StaffCreateDialog from "@/views/Access/StaffCreateDialog.vue";
import StaffList from "@/views/Access/StaffList.vue";
import SecretReveal from "@/boots/SecretReveal/index.vue";
import ActionBar from "@/boots/ActionBar/index.vue";
import PageLayout from "@/boots/PageLayout/index.vue";
import PageHeader from "@/boots/PageHeader/index.vue";

const ROLES = [
  { id: 1, key: "administrator", name: "Administrator" },
  { id: 4, key: "viewer", name: "Viewer" },
];
const CREATED = { id: 42, username: "anna", email: "anna@example.test", name: "", is_superuser: false, roles: [], groups: [], grants: [] };
const refusal = (status, data) => ({ response: { status, data } });
const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

const slots = (name) =>
  defineComponent({ name, inheritAttrs: false, setup: (_, ctx) => () => h("div", Object.values(ctx.slots).map((s) => s())) });
const mocks = { $t: t, $route: { params: {}, query: {} }, $router: { push: vi.fn() } };

describe("StaffCreateDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  const openDialog = (submit = vi.fn().mockResolvedValue()) => {
    const stubs = { BasicModal: slots("BasicModal"), FormField: slots("FormField"), BasicInput: true, BasicSelect: true, BasicCheckbox: true };
    const wrapper = mount(StaffCreateDialog, { props: { open: true, roles: ROLES, submit }, global: { mocks, stubs } });
    Object.assign(wrapper.vm.form, { username: "anna", email: "anna@example.test", role: "viewer" });
    return { wrapper, vm: wrapper.vm, submit };
  };

  it("sends no password while Generate is on, the typed one otherwise", async () => {
    const { vm, submit } = openDialog();
    expect(vm.form.generate).toBe(true);
    expect(vm.roleOptions).toEqual([{ label: "Administrator", value: "administrator" }, { label: "Viewer", value: "viewer" }]);
    await vm.save();
    expect(submit).toHaveBeenLastCalledWith({ username: "anna", email: "anna@example.test", role: "viewer" });
    Object.assign(vm.form, { generate: false, password: "typed-by-hand-1" });
    await vm.save();
    expect(submit).toHaveBeenLastCalledWith({ username: "anna", email: "anna@example.test", role: "viewer", password: "typed-by-hand-1" });
    vm.form.generate = true;
    await nextTick();
    expect(vm.form.password).toBe("");
  });

  it("a typed password field is a new-password field; Create waits for a typed password", async () => {
    const { wrapper, vm } = openDialog();
    vm.form.generate = false;
    await nextTick();
    const field = wrapper.find('[data-testid="staff-create-password"]');
    expect(field.attributes("type")).toBe("password");
    expect(field.attributes("autocomplete")).toBe("new-password");
    expect(vm.actions.find((a) => a.key === "create").disabled).toBe(true);
  });

  it("a 400 on password lands on the field with every validator message and the dialog stays open", async () => {
    const details = ["This password is too short.", "This password is too common."].map((description) => ({
      field: "password", location: "body", issue: "INVALID", description,
    }));
    const { wrapper, vm } = openDialog(vi.fn().mockRejectedValue(refusal(400, { error: "VALIDATION_ERROR", message: "x", details })));
    vm.form.generate = false;
    vm.form.password = "123";
    await vm.save();
    expect(vm.fieldError("password")).toBe("This password is too short. This password is too common.");
    expect(wrapper.emitted("update:open")).toBeUndefined();
  });

  it("a 409 lands on username or e-mail, by the server's sentence", async () => {
    const conflict = (message) => refusal(409, { error: "CONFLICT", message, details: [] });
    const submit = vi.fn().mockRejectedValueOnce(conflict("The username is taken"));
    const { wrapper, vm } = openDialog(submit);
    await vm.save();
    expect(vm.fieldError("username")).toBe("The username is taken");
    expect(vm.fieldError("email")).toBe("");
    submit.mockRejectedValueOnce(conflict("The e-mail address is taken"));
    await vm.save();
    expect(vm.fieldError("email")).toBe("The e-mail address is taken");
    expect(vm.fieldError("username")).toBe("");
    expect(wrapper.emitted("update:open")).toBeUndefined();
  });

  it("closing empties the form, a typed password included", async () => {
    const { wrapper, vm } = openDialog();
    Object.assign(vm.form, { generate: false, password: "typed-by-hand-1" });
    await wrapper.setProps({ open: false });
    expect(vm.form).toEqual({ username: "", email: "", role: null, generate: true, password: "" });
  });
});

describe("StaffList: New staff member", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.GET_AccessStaff.mockResolvedValue({ data: { results: [], count: 0 } });
    api.GET_AccessAllRoles.mockResolvedValue(ROLES);
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("hands the generated password to SecretReveal and keeps it nowhere after close", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    api.POST_AccessStaff.mockResolvedValue({ data: { ...CREATED, password: FAKE } });
    const wrapper = mount(StaffList, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        mocks,
        components: { SecretReveal, ActionBar },
        stubs: { PageLayout: slots("PageLayout"), PageHeader: slots("PageHeader"), DataTable: true, Pagination: true, Loader: true },
      },
    });
    await flushPromises();
    await wrapper.vm.openCreate();
    expect(wrapper.vm.roles).toEqual(ROLES);
    await wrapper.vm.createStaff({ username: "anna", email: "anna@example.test", role: "viewer" });
    await nextTick();
    expect(byTestId("secret-reveal-value").value).toBe(FAKE);
    expect(wrapper.vm.creating).toBe(false);
    expect(wrapper.vm.created).toEqual({ id: 42, username: "anna" });
    expect(JSON.stringify(wrapper.vm.$data)).not.toContain(FAKE);
    expect(api.GET_AccessStaff).toHaveBeenCalledTimes(2);

    byTestId("secret-reveal-stored").querySelector("input").click();
    await nextTick();
    byTestId("secret-reveal-close").click();
    await flushPromises();
    expect(JSON.stringify(wrapper.vm.$data)).not.toContain(FAKE);
    expect(JSON.stringify(pinia.state.value)).not.toContain(FAKE);
    expect(document.body.innerHTML).not.toContain(FAKE);
    expect(wrapper.find('[data-testid="staff-created-open"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("a typed password opens no SecretReveal", async () => {
    setActivePinia(createPinia());
    api.POST_AccessStaff.mockResolvedValue({ data: { ...CREATED, password: null } });
    const show = vi.fn();
    const RevealStub = defineComponent({ name: "SecretReveal", setup: (_, { expose }) => (expose({ show }), () => null) });
    const stubs = { PageLayout: slots("PageLayout"), PageHeader: slots("PageHeader"), DataTable: true, ActionBar: true, SecretReveal: RevealStub };
    const wrapper = mount(StaffList, { global: { mocks, stubs } });
    await flushPromises();
    await wrapper.vm.createStaff({ username: "anna", email: "anna@example.test", role: "viewer", password: "typed-by-hand-1" });
    expect(show).not.toHaveBeenCalled();
    expect(wrapper.vm.reveal).toBe(false);
  });

  // The real PageLayout decides read-only from the route's area (`access.manage`) and the access store.
  const mountPage = (level) => {
    setActivePinia(createPinia());
    const access = { available: true, can: (area, want) => area === "access.manage" && (want !== "write" || level === "write") };
    return mount(StaffList, {
      global: {
        mocks,
        components: { ActionBar, PageLayout, PageHeader },
        provide: { [routeLocationKey]: reactive({ meta: { panel: "access", area: "access.manage" } }), [ACCESS_STORE]: access },
        stubs: { DataTable: true, Pagination: true, Loader: true, StaffCreateDialog: true, SecretReveal: true },
      },
    });
  };

  it("shows the action with write on access.manage and hides it on a read-only page", async () => {
    const writer = mountPage("write");
    await flushPromises();
    expect(writer.find('[data-testid="staff-create"]').exists()).toBe(true);
    const reader = mountPage("read");
    await flushPromises();
    expect(reader.find('[data-testid="staff-create"]').exists()).toBe(false);
  });
});
