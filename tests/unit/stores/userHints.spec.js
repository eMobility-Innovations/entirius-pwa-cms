import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const patchProfile = vi.fn(async () => ({}));
vi.mock("@/api/contentDB/api", () => ({ PATCH_UserProfile: (...args) => patchProfile(...args), POST_Logout: vi.fn() }));

import { useUserStore } from "@/stores/user";
import { hintsOn } from "@/composables/fieldHints";

// Plan 60: the field-hints switch is a preference like the theme — profile `extra.cms_hints`, mirrored in
// localStorage, applied on sign-in. The boots read the same state (`hintsOn`).
describe("user store — field hints preference", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    patchProfile.mockClear();
  });

  afterEach(() => {
    hintsOn.value = true;
    useUserStore().clearAuth();
  });

  it("is on by default", () => {
    useUserStore().appInit();
    expect(useUserStore().hints).toBe(true);
    expect(hintsOn.value).toBe(true);
  });

  it("saves: the shared state, localStorage and, signed in, the profile extra", () => {
    const store = useUserStore();
    store.setAuth({ token: "t", refresh: "r", customer_id: "cust-1", expiryDate: null });
    store.markAuthenticated();
    store.setHints(false);
    expect(hintsOn.value).toBe(false);
    expect(localStorage.getItem("cms_hints")).toBe("false");
    expect(patchProfile).toHaveBeenCalledWith({ uid: "cust-1", payload: { extra: { cms_hints: false } } });
  });

  it("restores from localStorage on app start, without writing the profile", () => {
    localStorage.setItem("cms_hints", "false");
    useUserStore().appInit();
    expect(useUserStore().hints).toBe(false);
    expect(patchProfile).not.toHaveBeenCalled();
  });

  it("applies the profile's choice on sign-in and mirrors it locally", () => {
    const store = useUserStore();
    store.loadPreferences({ cms_hints: false });
    expect(hintsOn.value).toBe(false);
    expect(localStorage.getItem("cms_hints")).toBe("false");
    expect(patchProfile).not.toHaveBeenCalled();
  });

  it("a profile without a choice gets hints on, never the previous user's local one", () => {
    localStorage.setItem("cms_hints", "false");
    const store = useUserStore();
    store.appInit();
    store.loadPreferences({ cms_theme: "dark" });
    expect(hintsOn.value).toBe(true);
    expect(localStorage.getItem("cms_hints")).toBe("true");
  });

  it("sign-out clears the choice; the next user without a profile extra gets hints on", () => {
    const store = useUserStore();
    store.loadPreferences({ cms_hints: false });
    store.clearAuth();
    expect(hintsOn.value).toBe(true);
    expect(localStorage.getItem("cms_hints")).toBeNull();

    hintsOn.value = false;
    store.loadPreferences({});
    expect(hintsOn.value).toBe(true);
  });

  // Plan 61e: a failed profile call (`extra` null) is no profile — it must not turn the user's hints back on.
  it("a failed profile call keeps the user's stored choice", () => {
    localStorage.setItem("cms_hints", "false");
    const store = useUserStore();
    store.appInit();
    store.loadPreferences(null);
    expect(hintsOn.value).toBe(false);
    expect(localStorage.getItem("cms_hints")).toBe("false");
  });
});
