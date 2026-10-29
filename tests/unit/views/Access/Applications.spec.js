import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";

// Access plan 22 + FIX-04 (D31): the token dialogs' payloads and refusals ("No expiry" by default, no cap), the row
// actions' calls, legacy rows (source, last use, "No expiry" without a warning), the age column and the rotation
// recommendation, and the publishable revoke warning. A fake value shorter than a real token.
const api = vi.hoisted(() => ({
  GET_AccessApplication: vi.fn(),
  GET_AccessAllApplications: vi.fn(),
  GET_AccessCatalogue: vi.fn(),
  GET_AccessAllTokens: vi.fn(),
  POST_AccessApplication: vi.fn(),
  PATCH_AccessApplication: vi.fn(),
  POST_AccessToken: vi.fn(),
  POST_AccessTokenRotate: vi.fn(),
  POST_AccessTokenRevoke: vi.fn(),
  POST_AccessTokenExpiry: vi.fn(),
}));
const notify = vi.hoisted(() => ({ spawnNotification: vi.fn() }));
const revealShow = vi.hoisted(() => vi.fn());
vi.mock("@/api/access/api", () => api);
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => notify }));
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart: vi.fn(), loaderFinish: vi.fn() }) }));
vi.mock("@/stores/checkoutChannel", () => ({
  useCheckoutChannelStore: () => ({ channels: [{ idx: "emporium", label: "Emporium" }], fetchChannels: vi.fn() }),
}));

import { t } from "@/i18n";
import ApplicationDetail from "@/views/Access/ApplicationDetail.vue";
import ApplicationList from "@/views/Access/ApplicationList.vue";
import TokenCreateDialog from "@/views/Access/TokenCreateDialog.vue";
import TokenRotateDialog from "@/views/Access/TokenRotateDialog.vue";
import TokenExpiryDialog from "@/views/Access/TokenExpiryDialog.vue";
import ExpiryField from "@/views/Access/ExpiryField.vue";
import { ageText, dateString, expiryInstant, expiryIssue, minExpiryDate, refusedExpiryIssue, tokenKey } from "@/views/Access/tokens";
import en from "@/i18n/locales/en.json";
import pl from "@/i18n/locales/pl.json";

const FAKE = "ent_api_EXAMPLE-not-a-token";
const SCOPES = [
  { key: "checkout.storefront", label: "Storefront carts and orders", publishable: true },
  { key: "contact_forms.submit", label: "Contact form submissions", publishable: true },
  { key: "vault.api", label: "Vault", publishable: false },
];
const TOKEN = {
  id: 7, name: "Shop", prefix: "ent_api_Ab3d", last_four: "x9Q2", scopes: ["checkout.storefront"], channel_idx: null,
  expires_at: null, last_used_at: "2026-10-01T10:00:00Z", revoked_at: null, legacy: false, legacy_source: "", state: "active",
  age_days: 0, rotation_due: false,
};
const LEGACY = {
  ...TOKEN, id: 9, name: "", prefix: "legacy", last_four: "", legacy: true,
  legacy_source: "django_checkout.ChannelApiKey#1", last_used_at: null, age_days: 412, rotation_due: true,
};
const SECRET_TOKEN = { ...TOKEN, id: 8, name: "Vault sync", scopes: ["vault.api"], expires_at: "2027-06-01T00:00:00Z", age_days: 1 };
const FAR = "2027-11-07"; // 400 days after the test's "now" and beyond any cap
const refusal = (issue) => ({
  response: { status: 400, data: { error: "VALIDATION_ERROR", message: "Invalid", details: [{ field: "expires_at", issue, description: "x" }] } },
});

// Renders every slot, so the dialog bodies and the header actions are in the tree.
const slots = (name) =>
  defineComponent({ name, inheritAttrs: false, setup: (_, ctx) => () => h("div", Object.values(ctx.slots).map((s) => s())) });
const stubs = {
  BasicModal: slots("BasicModal"), FormField: slots("FormField"), PageHeader: slots("PageHeader"), BasicCard: slots("BasicCard"),
  ConfirmDialog: slots("ConfirmDialog"), BasicCheckbox: true, BasicSelect: true, BasicInput: true, BasicTextarea: true,
  BasicRadioGroup: true, BasicDatePicker: true, NumberInput: true, BasicSwitch: true, DataTable: true, ActionBar: true,
  SecretReveal: defineComponent({ name: "SecretReveal", setup: (_, { expose }) => (expose({ show: revealShow }), () => null) }),
  Tag: true, EmptyState: true, Loader: true, FloatingActions: true, StatusBadge: true, BasicTooltip: slots("BasicTooltip"),
};
const mountWith = (component, props = {}, route = {}) =>
  mount(component, {
    props,
    global: { mocks: { $t: t, $route: { params: {}, query: {}, ...route }, $router: { push: vi.fn() } }, stubs },
  });

describe("token rules", () => {
  const now = new Date(2026, 9, 3, 15, 0);

  it("refuses only a past day: no date and a far date pass, whatever the scope", () => {
    expect(expiryIssue({ date: "" }, now)).toBeNull();
    expect(expiryIssue({ date: FAR }, now)).toBeNull();
    expect(expiryIssue({ date: "2026-10-03" }, now)).toBe("EXPIRY_IN_PAST");
    expect(expiryIssue({ date: "", pending: true }, now)).toBe("DATE_MISSING");
    expect(minExpiryDate(now)).toBe("2026-10-04");
  });

  it("an age reads 'today', then whole days, in the UI language", () => {
    expect(ageText(0, "en")).toBe("today");
    expect(ageText(1, "en")).toBe("1 day");
    expect(ageText(412, "en")).toBe("412 days");
    expect(ageText(0, "pl")).toBe("dzisiaj");
    expect(ageText(5, "pl")).toBe("5 dni");
    expect(ageText(undefined, "en")).toBe("—");
  });

  it("no token string mentions a lifetime cap any more", () => {
    for (const locale of [en, pl]) {
      const tokens = JSON.stringify(locale.access.tokens);
      expect(tokens).not.toMatch(/365/);
      expect(Object.keys(locale.access.tokens.expiry_errors)).toEqual(["EXPIRY_IN_PAST", "DATE_MISSING"]);
    }
  });

  it("a date is the start of that local day; a token is known by prefix and last four", () => {
    expect(expiryInstant("2027-10-03")).toBe(new Date(2027, 9, 3).toISOString());
    expect(expiryInstant("")).toBeNull();
    expect(dateString(new Date(2027, 0, 5))).toBe("2027-01-05");
    expect(tokenKey(TOKEN)).toBe("ent_api_Ab3d…x9Q2");
    expect(tokenKey(LEGACY)).toBe("legacy");
    expect(refusedExpiryIssue(refusal("EXPIRY_IN_PAST"))).toBe("EXPIRY_IN_PAST");
    expect(refusedExpiryIssue(refusal("INVALID"))).toBeNull();
  });
});

describe("TokenCreateDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  const openDialog = async (submit = vi.fn().mockResolvedValue(), extra = {}) => {
    const wrapper = mountWith(TokenCreateDialog, { open: true, scopes: SCOPES, channels: [], submit, ...extra });
    await nextTick();
    return { wrapper, vm: wrapper.vm, submit };
  };

  it("sends name, scopes, channel and no expiry for a publishable token", async () => {
    const { wrapper, vm, submit } = await openDialog();
    Object.assign(vm.form, { name: "Shop", channel_idx: "emporium" });
    vm.toggleScope("checkout.storefront", true);
    vm.save();
    await flushPromises();
    expect(submit).toHaveBeenCalledWith({ name: "Shop", scopes: ["checkout.storefront"], channel_idx: "emporium", expires_at: null });
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("never mixes the groups: a publishable pick disables the secret scopes, and the other way round", async () => {
    const { wrapper, vm } = await openDialog();
    vm.toggleScope("contact_forms.submit", true);
    await nextTick();
    const disabled = (key) => wrapper.find(`[data-testid="token-scope-${key}"]`).attributes("disabled");
    expect(disabled("vault.api")).toBe("true");
    expect(disabled("checkout.storefront")).toBe("false");
    vm.toggleScope("contact_forms.submit", false);
    vm.toggleScope("vault.api", true);
    await nextTick();
    expect(disabled("checkout.storefront")).toBe("true");
  });

  it("a secret token goes out with no expiry or a date 400 days ahead; a past day is a field error", async () => {
    const { wrapper, vm, submit } = await openDialog();
    expect(wrapper.findComponent(ExpiryField).vm.mode).toBe("none");
    vm.toggleScope("vault.api", true);
    await flushPromises();
    expect(vm.form.date).toBe("");
    vm.save();
    await flushPromises();
    expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({ scopes: ["vault.api"], expires_at: null }));
    vm.form.date = "2020-01-01";
    vm.save();
    expect(vm.expiryError()).toBe(t("access.tokens.expiry_errors.EXPIRY_IN_PAST"));
    expect(submit).toHaveBeenCalledTimes(1);
    vm.form.date = dateString(new Date(Date.now() + 400 * 86400000));
    vm.save();
    await flushPromises();
    expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({ expires_at: expiryInstant(vm.form.date) }));
  });

  it("one hint line names the catalogue's rotation period; none without it", async () => {
    const { wrapper } = await openDialog(undefined, { rotationDays: 90 });
    const hint = wrapper.find('[data-testid="token-rotation-hint"]');
    expect(hint.text()).toBe(t("access.tokens.rotation_hint", { days: 90 }));
    expect(hint.text()).toContain("90");
    expect((await openDialog()).wrapper.find('[data-testid="token-rotation-hint"]').exists()).toBe(false);
  });

  it("no scope is a field error; the server's EXPIRY_IN_PAST stays open as a field error, other refusals close with a toast", async () => {
    const submit = vi.fn().mockRejectedValueOnce(refusal("EXPIRY_IN_PAST"));
    const { wrapper, vm } = await openDialog(submit);
    vm.save();
    expect(vm.formErrors.getFieldError("scopes").msg).toBe(t("access.tokens.scopes_required"));
    vm.toggleScope("vault.api", true);
    await flushPromises();
    vm.save();
    await flushPromises();
    expect(vm.expiryError()).toBe(t("access.tokens.expiry_errors.EXPIRY_IN_PAST"));
    expect(wrapper.emitted("update:open")).toBeUndefined();

    submit.mockRejectedValueOnce({ response: { status: 400, data: { error: "VALIDATION_ERROR", message: "Mixed", details: [{ field: "non_field_errors", issue: "INVALID", description: "Mixed" }] } } });
    vm.save();
    await flushPromises();
    expect(notify.spawnNotification).toHaveBeenCalledWith({ type: "negative", msg: "Mixed" });
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });
});

describe("TokenRotateDialog and TokenExpiryDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rotate sends the overlap (24 by default) and no expiry by default, for a publishable and a secret token", async () => {
    const submit = vi.fn().mockResolvedValue();
    const publishable = mountWith(TokenRotateDialog, { open: true, token: TOKEN, submit });
    expect(publishable.findComponent(ExpiryField).vm.mode).toBe("none");
    publishable.vm.save();
    await flushPromises();
    expect(submit).toHaveBeenLastCalledWith({ overlap_hours: 24, expires_at: null });

    const secret = mountWith(TokenRotateDialog, { open: true, token: SECRET_TOKEN, submit }).vm;
    secret.overlap = "200";
    secret.save();
    expect(secret.formErrors.getFieldError("overlap_hours").msg).toBe(t("access.tokens.overlap_invalid"));
    secret.overlap = "0";
    secret.save();
    await flushPromises();
    expect(submit).toHaveBeenLastCalledWith({ overlap_hours: 0, expires_at: null });
    secret.date = "2020-01-01";
    secret.save();
    expect(secret.expiryError()).toBe(t("access.tokens.expiry_errors.EXPIRY_IN_PAST"));
    expect(submit).toHaveBeenCalledTimes(2);
    secret.date = dateString(new Date(Date.now() + 400 * 86400000));
    secret.save();
    await flushPromises();
    expect(submit).toHaveBeenLastCalledWith({ overlap_hours: 0, expires_at: expiryInstant(secret.date) });
  });

  it("'On a date' without a day is a field error, never a silent 'No expiry'", async () => {
    const submit = vi.fn().mockResolvedValue();
    const wrapper = mountWith(TokenRotateDialog, { open: true, token: TOKEN, submit });
    wrapper.findComponent(ExpiryField).vm.mode = "date";
    await nextTick();
    wrapper.vm.save();
    expect(wrapper.vm.expiryError()).toBe(t("access.tokens.expiry_errors.DATE_MISSING"));
    expect(submit).not.toHaveBeenCalled();
    wrapper.findComponent(ExpiryField).vm.mode = "none";
    await nextTick();
    wrapper.vm.save();
    await flushPromises();
    expect(submit).toHaveBeenLastCalledWith({ overlap_hours: 24, expires_at: null });
  });

  it("set expiry: every token takes a date or no expiry, a token without one opens on 'No expiry'", async () => {
    const submit = vi.fn().mockResolvedValue();
    const legacy = mountWith(TokenExpiryDialog, { open: true, token: LEGACY, submit });
    expect(legacy.findComponent(ExpiryField).vm.mode).toBe("none");
    legacy.vm.save();
    await flushPromises();
    expect(submit).toHaveBeenLastCalledWith({ expires_at: null });

    const secret = mountWith(TokenExpiryDialog, { open: true, token: SECRET_TOKEN, submit });
    expect(secret.findComponent(ExpiryField).vm.mode).toBe("date");
    secret.findComponent(ExpiryField).vm.mode = "none";
    await nextTick();
    expect(secret.vm.date).toBe("");
    secret.vm.save();
    await flushPromises();
    expect(submit).toHaveBeenLastCalledWith({ expires_at: null });
    secret.findComponent(ExpiryField).vm.mode = "date";
    secret.vm.date = dateString(new Date(Date.now() + 400 * 86400000));
    await nextTick();
    secret.vm.save();
    await flushPromises();
    expect(submit).toHaveBeenLastCalledWith({ expires_at: expiryInstant(secret.vm.date) });
  });
});

describe("ApplicationDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.GET_AccessApplication.mockResolvedValue({ data: { id: 3, name: "Legacy keys: checkout", description: "", is_active: true } });
    api.GET_AccessCatalogue.mockResolvedValue({ data: { modules: [], roles: [], scopes: SCOPES, token_rotation_days: 90 } });
    api.GET_AccessAllTokens.mockResolvedValue([TOKEN, LEGACY, SECRET_TOKEN]);
  });
  const openDetail = async () => {
    const wrapper = mountWith(ApplicationDetail, {}, { params: { id: "3" } });
    await flushPromises();
    return wrapper;
  };

  it("legacy rows read their source, 'Never' for no use and 'No expiry' with no warning", async () => {
    const { vm } = await openDetail();
    expect(api.GET_AccessAllTokens).toHaveBeenCalledWith(3);
    expect(vm.expiryText(LEGACY)).toBe("No expiry");
    expect(vm.expiryText(SECRET_TOKEN)).toMatch(/^in \d+ days · /);
    expect(vm.rowName(LEGACY)).toBe("legacy");
    expect(vm.lastUsedText(LEGACY.last_used_at)).toBe(t("access.tokens.never_used"));
    expect(vm.lastUsedText(TOKEN.last_used_at)).not.toBe(t("access.tokens.never_used"));
    expect(vm.tokenMenu(LEGACY).map((item) => item.key)).toEqual(["rotate", "expiry", "revoke"]);
  });

  it("each row shows its age; a rotation-due row adds the badge whose tooltip names the catalogue's period", async () => {
    // A DataTable that renders the name cell (the badge) and the age cell of every row.
    const DataTable = defineComponent({
      props: { rows: { type: Array, default: () => [] } },
      setup: (props, { slots }) => () =>
        h("div", props.rows.map((row) => h("div", [slots["cell-name"]({ row }), slots["cell-age_days"]({ row })]))),
    });
    const BasicTooltip = defineComponent({ props: { text: String }, setup: (props, { slots }) => () => h("span", { title: props.text }, slots.default()) });
    const wrapper = mount(ApplicationDetail, {
      global: {
        mocks: { $t: t, $route: { params: { id: "3" }, query: {} }, $router: { push: vi.fn() } },
        stubs: { ...stubs, DataTable, BasicTooltip },
      },
    });
    await flushPromises();
    expect(wrapper.vm.tokenColumns.map((column) => column.key)).toContain("age_days");
    expect(wrapper.findAll('[data-testid="token-age"]').map((cell) => cell.text())).toEqual(["today", "412 days", "1 day"]);
    const due = wrapper.findAll('[data-testid="token-rotation-due"]');
    expect(due).toHaveLength(1);
    expect(due[0].element.parentElement.getAttribute("title")).toBe(t("access.tokens.rotation_due_tip", { days: 90 }));
    expect(due[0].element.parentElement.getAttribute("title")).toContain("90 days");
    expect(due[0].findComponent({ name: "StatusBadge" }).attributes("label")).toBe(t("access.tokens.rotation_due"));
  });

  it("revoking a publishable key warns; a legacy key's dialog names its source; the call goes by id", async () => {
    api.POST_AccessTokenRevoke.mockResolvedValue({ data: {} });
    const wrapper = await openDetail();
    wrapper.vm.revoking = LEGACY;
    await nextTick();
    expect(wrapper.find('[data-testid="token-revoke-publishable"]').text()).toBe(t("access.tokens.revoke_publishable"));
    expect(wrapper.find('[data-testid="token-revoke-legacy"]').text()).toContain("django_checkout.ChannelApiKey#1");
    wrapper.vm.revoking = SECRET_TOKEN;
    await nextTick();
    expect(wrapper.find('[data-testid="token-revoke-publishable"]').exists()).toBe(false);
    await wrapper.vm.revokeToken();
    expect(api.POST_AccessTokenRevoke).toHaveBeenCalledWith(8);
    expect(notify.spawnNotification).toHaveBeenCalledWith({ type: "positive", msg: t("access.tokens.revoked") });
  });

  it("create and rotate hand the value to SecretReveal only; set expiry posts by id", async () => {
    api.POST_AccessToken.mockResolvedValue({ data: { ...TOKEN, raw: FAKE } });
    api.POST_AccessTokenRotate.mockResolvedValue({ data: { ...SECRET_TOKEN, id: 10, raw: FAKE } });
    api.POST_AccessTokenExpiry.mockResolvedValue({ data: LEGACY });
    const { vm } = await openDetail();
    await vm.createToken({ name: "Shop", scopes: ["checkout.storefront"], channel_idx: null, expires_at: null });
    expect(api.POST_AccessToken).toHaveBeenCalledWith(3, expect.objectContaining({ name: "Shop" }));
    expect(revealShow).toHaveBeenCalledWith(FAKE);
    expect(vm.reveal).toEqual({ open: true, title: t("access.tokens.created_title") });
    expect(JSON.stringify(vm.$data)).not.toContain(FAKE);
    expect(notify.spawnNotification).not.toHaveBeenCalled();

    vm.rotating = SECRET_TOKEN;
    await vm.rotateToken({ overlap_hours: 24, expires_at: null });
    expect(api.POST_AccessTokenRotate).toHaveBeenCalledWith(8, { overlap_hours: 24, expires_at: null });
    expect(vm.rotating).toBeNull();

    vm.expiring = LEGACY;
    await vm.setExpiry({ expires_at: null });
    expect(api.POST_AccessTokenExpiry).toHaveBeenCalledWith(9, { expires_at: null });
    expect(JSON.stringify(notify.spawnNotification.mock.calls)).not.toContain("ent_api_");
  });

  it("does not leave the page while a shown-once value is open", async () => {
    const wrapper = await openDetail();
    const next = vi.fn();
    wrapper.vm.reveal = { open: true, title: "" };
    ApplicationDetail.beforeRouteLeave.call(wrapper.vm, {}, {}, next);
    expect(next).toHaveBeenCalledWith(false);
    wrapper.vm.reveal = { open: false, title: "" };
    ApplicationDetail.beforeRouteLeave.call(wrapper.vm, {}, {}, next);
    expect(next).toHaveBeenLastCalledWith();
  });

  it("a new application posts name and description and opens its page", async () => {
    api.POST_AccessApplication.mockResolvedValue({ data: { id: 12, name: "Widget", description: "", is_active: true } });
    const wrapper = mountWith(ApplicationDetail, {}, {});
    await flushPromises();
    Object.assign(wrapper.vm.form, { name: "Widget", description: "" });
    expect(await wrapper.vm.save()).toBe(true);
    expect(api.POST_AccessApplication).toHaveBeenCalledWith({ name: "Widget", description: "" });
    expect(wrapper.vm.$router.push).toHaveBeenCalledWith("/access/applications/12");
  });
});

describe("ApplicationList", () => {
  it("counts each application's tokens and marks the ones holding legacy keys", async () => {
    vi.clearAllMocks();
    api.GET_AccessAllApplications.mockResolvedValue([
      { id: 3, name: "Legacy keys: checkout", is_active: true },
      { id: 4, name: "Shop", is_active: false },
    ]);
    api.GET_AccessAllTokens.mockImplementation((id) => (id === 3 ? Promise.resolve([LEGACY]) : Promise.reject(new Error("down"))));
    const wrapper = mountWith(ApplicationList);
    await flushPromises();
    expect(wrapper.vm.applications.map(({ id, token_count, legacy }) => ({ id, token_count, legacy }))).toEqual([
      { id: 3, token_count: 1, legacy: true },
      { id: 4, token_count: null, legacy: false },
    ]);
  });

  it("shows the list before the summaries and reads at most four applications' tokens at a time", async () => {
    vi.clearAllMocks();
    api.GET_AccessAllApplications.mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `App ${i}`, is_active: true })));
    const pending = [];
    api.GET_AccessAllTokens.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const wrapper = mountWith(ApplicationList);
    await flushPromises();
    expect(wrapper.vm.loading).toBe(false);
    expect(wrapper.vm.applications).toHaveLength(10);
    expect(api.GET_AccessAllTokens).toHaveBeenCalledTimes(4);
    pending.shift()([TOKEN, LEGACY]);
    await flushPromises();
    expect(api.GET_AccessAllTokens).toHaveBeenCalledTimes(5);
    expect(wrapper.vm.applications[0]).toMatchObject({ token_count: 2, legacy: true });
    while (pending.length) {
      pending.shift()([]);
      await flushPromises();
    }
    expect(api.GET_AccessAllTokens).toHaveBeenCalledTimes(10);
  });

  it("stops reading token lists once the page is left", async () => {
    vi.clearAllMocks();
    api.GET_AccessAllApplications.mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `App ${i}`, is_active: true })));
    const pending = [];
    api.GET_AccessAllTokens.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const wrapper = mountWith(ApplicationList);
    await flushPromises();
    wrapper.unmount();
    pending.splice(0).forEach((resolve) => resolve([]));
    await flushPromises();
    expect(api.GET_AccessAllTokens).toHaveBeenCalledTimes(4);
  });
});
