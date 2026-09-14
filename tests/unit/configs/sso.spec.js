/**
 * The flag itself. Every other SSO guard hangs off isSsoEnabled(), so its edges matter:
 * only the exact string "true" may arm the feature.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
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
