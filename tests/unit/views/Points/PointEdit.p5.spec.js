/**
 * Plan 43 — PointEdit on the detail-form pattern: a create without the required fields maps the API's field errors
 * onto the FormFields (the save validates on the backend, e2e 16 holds the toast), and the header ActionBar offers
 * Delete only for an editable, saved point.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { useFormErrors } from "@/composables/useFormErrors";

const api = vi.hoisted(() => ({ POST_Point: vi.fn(), PATCH_Point: vi.fn() }));
vi.mock("@/api/deliverypoints/api", () => {
  const empty = () => vi.fn().mockResolvedValue({ data: { results: [] } });
  return {
  ...api,
  GET_Point: vi.fn(),
  DELETE_Point: vi.fn(),
  GET_Types: empty(),
  GET_DPChannels: empty(),
  GET_Countries: vi.fn().mockResolvedValue({ data: [] }),
  GET_PointT9N: empty(),
  POST_PointT9N: vi.fn(),
  PATCH_PointT9N: vi.fn(),
  DELETE_PointT9N: vi.fn(),
  POST_GeocodeSearch: vi.fn().mockResolvedValue({ data: { available: true } }),
  };
});
vi.mock("@/stores/loader", () => ({ useLoaderStore: () => ({ loaderStart() {}, loaderFinish() {} }) }));
vi.mock("@/stores/notify", () => ({ useNotifyStore: () => ({ spawnNotification() {} }) }));
vi.mock("@/stores/munin", () => ({ useMuninStore: () => ({ isModuleAtLeast: () => true }) }));

import PointEdit from "@/views/Points/PointEdit.vue";

const { headerActions } = PointEdit.computed;

function state() {
  const ctx = {
    form: { code: "", name: "", type_id: null, is_active: true },
    isEdit: false,
    isCarrier: false,
    formErrors: useFormErrors(),
    loader: { loaderStart: vi.fn(), loaderFinish: vi.fn() },
    notify: { spawnNotification: vi.fn() },
    snapshot: vi.fn(),
    $t: (key) => key,
    $router: { push: vi.fn() },
    $route: { params: {} },
  };
  ctx.buildPayload = () => PointEdit.methods.buildPayload.call(ctx);
  return ctx;
}

describe("PointEdit.savePoint — required fields on create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("puts the API's field errors on code, name and type, and toasts the message", async () => {
    api.POST_Point.mockRejectedValue({
      response: {
        status: 400,
        data: { code: ["This field is required."], name: ["This field is required."], type_id: ["Required."] },
      },
    });
    const ctx = state();
    await PointEdit.methods.savePoint.call(ctx);

    expect(ctx.formErrors.getFieldError("code")?.msg).toBe("This field is required.");
    expect(ctx.formErrors.getFieldError("name")?.msg).toBe("This field is required.");
    expect(ctx.formErrors.getFieldError("type_id")?.msg).toBe("Required.");
    expect(ctx.notify.spawnNotification).toHaveBeenCalledWith({ type: "negative", msg: "This field is required." });
    expect(ctx.$router.push).not.toHaveBeenCalled();
    expect(ctx.loader.loaderFinish).toHaveBeenCalled();
  });

  it("maps a v2 error envelope the same way", async () => {
    api.POST_Point.mockRejectedValue({
      response: {
        status: 400,
        data: { error: "validation_error", message: "Invalid", details: [{ field: "body.code", description: "Missing" }] },
      },
    });
    const ctx = state();
    await PointEdit.methods.savePoint.call(ctx);

    expect(ctx.formErrors.getFieldError("code")?.msg).toBe("Missing");
  });
});

describe("PointEdit create form — FormField errors", () => {
  it("shows the API's required-field errors on the Code, Name and Type fields", async () => {
    api.POST_Point.mockRejectedValue({ response: { status: 400, data: { code: ["Required."], type_id: ["Required."] } } });
    const wrapper = mount(PointEdit, {
      global: { stubs: { PageHeader: true, BasicCard: { template: "<section><slot /></section>" }, ConfirmDialog: true } },
    });
    await flushPromises();
    await wrapper.vm.savePoint();
    await flushPromises();

    const error = (label) => wrapper.findAllComponents({ name: "FormField" })
      .find((f) => f.attributes("label") === label)?.attributes("error");
    expect(error("dp.code")).toBe("Required.");
    expect(error("dp.type")).toBe("Required.");
    expect(error("dp.name")).toBe("");
  });
});

describe("PointEdit header actions", () => {
  const ctx = (isEdit, isCarrier) => ({ isEdit, isCarrier, $t: (key) => key, savePoint: vi.fn() });
  const keys = (c) => headerActions.call(c).map((a) => a.key);

  it("is Save only on create and on a locked carrier point", () => {
    expect(keys(ctx(false, false))).toEqual(["save"]);
    expect(keys(ctx(true, true))).toEqual(["save"]);
  });

  it("adds a danger Delete that opens the confirm dialog on a saved custom point", () => {
    const c = ctx(true, false);
    const [remove, save] = headerActions.call(c);
    expect([remove.key, remove.variant, save.role]).toEqual(["delete", "danger", "primary"]);
    remove.onClick();
    expect(c.showDeleteConfirm).toBe(true);
    save.onClick();
    expect(c.savePoint).toHaveBeenCalled();
  });
});
