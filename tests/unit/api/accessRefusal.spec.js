import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

// Plan 18: an access-gate 403 gets one standard toast and one `me` refresh per burst; the rejection still reaches
// the view, marked handled, and the view's own toast for it is not shown twice.
const GET_Me = vi.fn(() => Promise.resolve({ data: { user: { is_staff: true }, permissions: {} } }));
vi.mock("@/api/access/api", () => ({ GET_Me: (...a) => GET_Me(...a) }));
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({ loaded: true, ensureLoaded: () => Promise.resolve(), isModuleInstalled: () => true }),
}));

import { createApiClient, isAccessRefusal } from "@/api/createClient";
import { extractApiMessage } from "@/composables/useFormErrors";
import { useNotifyStore } from "@/stores/notify";
import { t } from "@/i18n";

const refusal = (issue = "ACCESS_DENIED") => ({
  error: "PERMISSION_DENIED",
  message: "You do not have permission to perform this action.",
  debug_id: "0badc0de",
  details: [{ field: null, location: "path", issue, description: "needs pim.products:write" }],
});

const refusingClient = (status = 403, body = refusal) => {
  const client = createApiClient("http://service.test", { tokenRefresh: true });
  client.defaults.adapter = (config) =>
    Promise.reject(Object.assign(new Error(String(status)), { config, response: { status, config, data: body() } }));
  return client;
};

// The refresh resolves the access store at call time (a dynamic import): it lands a few ticks after the rejection.
const refreshLanded = () => vi.waitFor(() => expect(GET_Me).toHaveBeenCalled());

// What ~230 views do in their catch.
const viewToast = (notify) => (err) => notify.spawnNotification({ type: "negative", msg: extractApiMessage(err) });

describe("access refusal (403 from the gate)", () => {
  let notify;
  beforeEach(() => {
    setActivePinia(createPinia());
    notify = useNotifyStore();
    GET_Me.mockClear();
  });

  it("recognises only the gate's envelope", () => {
    expect(isAccessRefusal(refusal("STAFF_ONLY"))).toBe(true);
    expect(isAccessRefusal(refusal("UNMAPPED_ROUTE"))).toBe(true);
    expect(isAccessRefusal({ error: "PERMISSION_DENIED", details: [{ issue: "OTHER" }] })).toBe(false);
    expect(isAccessRefusal({ detail: "You do not have permission to perform this action." })).toBe(false);
  });

  it("rejects to the view with the body marked handled, after one standard toast", async () => {
    const err = await refusingClient().get("/api/pim/v2/admin/products/").catch((e) => e);
    expect(err.accessHandled).toBe(true);
    expect(err.httpStatus).toBe(403);
    viewToast(notify)(err);
    expect(notify.notifications.map((n) => n.msg)).toEqual([t("access.denied_action")]);
    await refreshLanded();
  });

  it("a burst of refusals shows one toast and refreshes `me` once", async () => {
    const client = refusingClient();
    await Promise.all(Array.from({ length: 20 }, () => client.get("/x/").catch(viewToast(notify))));
    await refreshLanded();
    await flushPromises();
    expect(notify.notifications.length + notify.pending.length).toBe(1);
    expect(GET_Me).toHaveBeenCalledTimes(1);
  });

  // FIX-09 #17: the view's toast of the refused request, not every negative toast that lands within a second.
  it("covers the view's own toast of the refusal, whatever its text, but not another request's error", async () => {
    await refusingClient().get("/x/").catch(() => {
      notify.spawnNotification({ type: "negative", msg: "leads.review.error" });
    });
    await new Promise((resolve) => setTimeout(resolve));
    notify.spawnNotification({ type: "negative", msg: refusal().message });
    notify.spawnNotification({ type: "negative", msg: "Stock is negative" });
    expect(notify.notifications.map((n) => n.msg)).toEqual([t("access.denied_action"), "Stock is negative"]);
    await refreshLanded();
  });

  it("a module's own 403 (not the gate) keeps today's path: no standard toast, no refresh", async () => {
    const err = await refusingClient(403, () => ({ detail: "Not your channel" }))
      .get("/x/")
      .catch((e) => e);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(err.accessHandled).toBeUndefined();
    expect(notify.notifications).toEqual([]);
    expect(GET_Me).not.toHaveBeenCalled();
  });
});
