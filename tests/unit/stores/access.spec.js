import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// Plan 18: the access store — `me` drives `can`; allow-all only without the access module; a failed `me` denies
// until a retry; one request at a time; at most one refresh per 5 s; memory only.
const GET_Me = vi.fn();
vi.mock("@/api/access/api", () => ({ GET_Me: (...a) => GET_Me(...a) }));

const munin = { loaded: true, installed: true };
vi.mock("@/stores/munin", () => ({
  useMuninStore: () => ({
    get loaded() {
      return munin.loaded;
    },
    ensureLoaded: () => Promise.resolve(),
    isModuleInstalled: (key) => key === "access" && munin.installed,
  }),
}));

import { useAccessStore, REFRESH_INTERVAL_MS } from "@/stores/access";

const ME = {
  user: { id: 7, username: "viewer", is_staff: true, is_superuser: false },
  gate_mode: "enforce",
  manages_access: false,
  roles: [{ key: "viewer", name: "Viewer" }],
  permissions: { "pim.products": "read", "faq.faq": "write" },
};
const answer = (body) => GET_Me.mockResolvedValue({ data: body });
const notFound = () => Object.defineProperty({ error: "NOT_FOUND" }, "httpStatus", { value: 404 });

describe("access store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    GET_Me.mockReset();
    munin.loaded = true;
    munin.installed = true;
  });
  afterEach(() => vi.useRealTimers());

  it("reads and writes by the level `me` grants; write implies read", async () => {
    answer(ME);
    const access = useAccessStore();
    await access.ensureLoaded();
    expect(access.status).toBe("ready");
    expect(access.can("pim.products")).toBe(true);
    expect(access.can("pim.products", "write")).toBe(false);
    expect(access.can("faq.faq", "write")).toBe(true);
    expect(access.can("faq.faq")).toBe(true);
    expect(access.can("checkout.orders")).toBe(false);
    expect(access.canAny(["checkout.orders", "pim.products"])).toBe(true);
    expect(access.canAny(["checkout.orders"])).toBe(false);
  });

  it("without the access module everything is allowed and `me` is never asked", async () => {
    munin.installed = false;
    const access = useAccessStore();
    await access.ensureLoaded();
    expect(access.status).toBe("absent");
    expect(access.available).toBe(false);
    expect(access.can("checkout.orders", "write")).toBe(true);
    expect(GET_Me).not.toHaveBeenCalled();
  });

  it("a failing `me` with the module installed denies everything, and a retry loads it", async () => {
    GET_Me.mockRejectedValueOnce(new Error("Network Error"));
    const access = useAccessStore();
    await access.ensureLoaded();
    expect(access.status).toBe("error");
    expect(access.available).toBe(true);
    expect(access.can("faq.faq")).toBe(false);

    answer(ME);
    await access.ensureLoaded();
    expect(access.status).toBe("ready");
    expect(access.can("faq.faq")).toBe(true);
  });

  it("a 404 is a missing module only when munin could not say (a customer token); with munin it is an error", async () => {
    GET_Me.mockRejectedValue(notFound());
    const access = useAccessStore();
    await access.ensureLoaded();
    expect(access.status).toBe("error");

    setActivePinia(createPinia());
    munin.loaded = false;
    const unknown = useAccessStore();
    await unknown.ensureLoaded();
    expect(unknown.status).toBe("absent");
  });

  it("a non-staff `me` is no staff and can nothing", async () => {
    answer({ user: { id: 2, is_staff: false, is_superuser: false }, gate_mode: null, permissions: {} });
    const access = useAccessStore();
    await access.ensureLoaded();
    expect(access.isStaff).toBe(false);
    expect(access.can("pim.products")).toBe(false);
  });

  it("is single-flight: concurrent loads share one request", async () => {
    answer(ME);
    const access = useAccessStore();
    await Promise.all([access.ensureLoaded(), access.ensureLoaded(), access.refresh()]);
    expect(GET_Me).toHaveBeenCalledTimes(1);
  });

  it("refreshes at most once per interval, however many refusals arrive", async () => {
    vi.useFakeTimers();
    answer(ME);
    const access = useAccessStore();
    await access.ensureLoaded();
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
    await Promise.all(Array.from({ length: 20 }, () => access.refresh()));
    expect(GET_Me).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS - 1);
    await access.refresh();
    expect(GET_Me).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1);
    await access.refresh();
    expect(GET_Me).toHaveBeenCalledTimes(3);
  });

  it("a refresh that fails keeps the `me` it had; only a first load denies", async () => {
    vi.useFakeTimers();
    answer(ME);
    const access = useAccessStore();
    await access.ensureLoaded();
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
    GET_Me.mockRejectedValueOnce(new Error("502"));
    await access.refresh();
    expect(access.status).toBe("ready");
    expect(access.can("faq.faq")).toBe(true);
  });

  it("before the first answer `can` is true for rendering; the guard waits for ensureLoaded", () => {
    expect(useAccessStore().can("checkout.orders")).toBe(true);
  });

  it("an answer that lands after reset (logout) is dropped", async () => {
    let resolve;
    GET_Me.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const access = useAccessStore();
    const pending = access.ensureLoaded();
    await Promise.resolve();
    access.reset();
    resolve({ data: ME });
    await pending;
    expect(access.me).toBeNull();
    expect(access.status).toBe("idle");
  });

  // FIX-09 #17: the old request's `finally` must not clear the newer request in flight (a second `me` call).
  it("a request outdated by reset does not clear the newer one in flight when it settles", async () => {
    let resolveOld;
    let resolveNew;
    GET_Me.mockReturnValueOnce(new Promise((r) => (resolveOld = r)));
    GET_Me.mockReturnValueOnce(new Promise((r) => (resolveNew = r)));
    const access = useAccessStore();
    const old = access.ensureLoaded();
    await Promise.resolve();
    access.reset();
    const current = access.ensureLoaded();
    await vi.waitFor(() => expect(GET_Me).toHaveBeenCalledTimes(2));
    resolveOld({ data: { ...ME, permissions: {} } });
    await old;
    // Still the newer request: a caller joins it instead of starting a third.
    access.ensureLoaded();
    expect(GET_Me).toHaveBeenCalledTimes(2);
    resolveNew({ data: ME });
    await current;
    expect(access.can("faq.faq", "write")).toBe(true);
  });

  it("a forced refresh asks again now and drops the answer already on its way", async () => {
    vi.useFakeTimers();
    answer(ME);
    const access = useAccessStore();
    await access.ensureLoaded();
    let resolveStale;
    GET_Me.mockReturnValueOnce(new Promise((r) => (resolveStale = r)));
    vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
    const stale = access.refresh();
    await vi.waitFor(() => expect(GET_Me).toHaveBeenCalledTimes(2));
    GET_Me.mockResolvedValueOnce({ data: { ...ME, permissions: { "faq.faq": "read" } } });
    await access.refresh(true);
    expect(GET_Me).toHaveBeenCalledTimes(3);
    resolveStale({ data: ME });
    await stale;
    expect(access.can("faq.faq", "write")).toBe(false);
    expect(access.can("faq.faq")).toBe(true);
  });

  it("reset forgets `me` and the refused panel", async () => {
    answer(ME);
    const access = useAccessStore();
    await access.ensureLoaded();
    access.deniedPanel = "pim";
    access.reset();
    expect(access.me).toBeNull();
    expect(access.status).toBe("idle");
    expect(access.deniedPanel).toBeNull();
  });

  it("keeps `me` in memory only: no cookie, localStorage or sessionStorage write", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const cookieBefore = document.cookie;
    answer({ ...ME, manages_access: true });
    const access = useAccessStore();
    await access.ensureLoaded();
    await access.refresh();
    access.reset();
    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookieBefore);
    setItem.mockRestore();
  });
});
