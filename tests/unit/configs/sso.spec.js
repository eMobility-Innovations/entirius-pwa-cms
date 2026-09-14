/**
 * The flag itself. Every other SSO guard hangs off isSsoEnabled(), so its edges matter:
 * only the exact string "true" may arm the feature.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  allowAutoLogin,
  blockAutoLogin,
  isAutoLoginBlocked,
  isSsoOnly,
  isSsoEnabled,
  ssoLoginUrlPath,
  ssoCallbackPath,
  ssoRedirectUri,
  SSO_CALLBACK_ROUTE,
} from "@/configs/sso";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("configs/sso", () => {
  it("is disabled when the variable is unset", () => {
    vi.stubEnv("VUE_APP_SSO_ENABLED", undefined);
    expect(isSsoEnabled()).toBe(false);
  });

  it("is enabled only by the exact string true", () => {
    vi.stubEnv("VUE_APP_SSO_ENABLED", "true");
    expect(isSsoEnabled()).toBe(true);
    vi.stubEnv("VUE_APP_SSO_ENABLED", "TRUE");
    expect(isSsoEnabled()).toBe(true);
  });

  it.each(["false", "1", "yes", "on", ""])(
    "stays disabled for %s — a truthy-looking value must not arm SSO",
    (value) => {
      vi.stubEnv("VUE_APP_SSO_ENABLED", value);
      expect(isSsoEnabled()).toBe(false);
    }
  );

  it("falls back to the shipped backend paths", () => {
    vi.stubEnv("VUE_APP_SSO_LOGIN_URL_PATH", undefined);
    vi.stubEnv("VUE_APP_SSO_CALLBACK_PATH", undefined);
    expect(ssoLoginUrlPath()).toBe("/api/escootersauth/v2/staff/login-url/");
    expect(ssoCallbackPath()).toBe("/api/escootersauth/v2/staff/callback/");
  });

  it("lets a deployment point at another backend", () => {
    vi.stubEnv("VUE_APP_SSO_LOGIN_URL_PATH", "/api/other/login-url/");
    vi.stubEnv("VUE_APP_SSO_CALLBACK_PATH", "/api/other/callback/");
    expect(ssoLoginUrlPath()).toBe("/api/other/login-url/");
    expect(ssoCallbackPath()).toBe("/api/other/callback/");
  });

  it("builds the redirect URI from the browser origin and the fixed route", () => {
    // Exact-match registered with the provider — it may not drift per deployment.
    expect(ssoRedirectUri()).toBe(`${window.location.origin}${SSO_CALLBACK_ROUTE}`);
    expect(SSO_CALLBACK_ROUTE).toBe("/sso/callback");
  });
});

describe("configs/sso — SSO-only", () => {
  it("is off by default", () => {
    vi.stubEnv("VUE_APP_SSO_ENABLED", "true");
    vi.stubEnv("VUE_APP_SSO_ONLY", undefined);
    expect(isSsoOnly()).toBe(false);
  });

  it("is on when both flags say so", () => {
    vi.stubEnv("VUE_APP_SSO_ENABLED", "true");
    vi.stubEnv("VUE_APP_SSO_ONLY", "true");
    expect(isSsoOnly()).toBe(true);
  });

  it("REFUSES to be on while SSO itself is off", () => {
    // Otherwise a single typo renders a login wall with no password form and no working
    // SSO — a deployment locked out of itself.
    vi.stubEnv("VUE_APP_SSO_ENABLED", "false");
    vi.stubEnv("VUE_APP_SSO_ONLY", "true");
    expect(isSsoOnly()).toBe(false);
  });
});

describe("the auto-login block", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("does not block a first attempt", () => {
    expect(isAutoLoginBlocked()).toBe(false);
  });

  it("blocks after a failure, and clears on a deliberate retry", () => {
    blockAutoLogin();
    expect(isAutoLoginBlocked()).toBe(true);
    allowAutoLogin();
    expect(isAutoLoginBlocked()).toBe(false);
  });

  it("blocks when session storage cannot be read at all", () => {
    // A browser that cannot stash `state` cannot complete the callback either, so an
    // automatic login there is a guaranteed loop. Unreadable storage must FAIL CLOSED.
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });

    expect(isAutoLoginBlocked()).toBe(true);

    Object.defineProperty(window, "sessionStorage", original);
  });
});
