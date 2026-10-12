import { describe, it, expect, vi, afterEach } from "vitest";
import { createRequire } from "module";
import { mount } from "@vue/test-utils";

const require = createRequire(import.meta.url);

vi.mock("@/api/contentDB/api", () => ({ POST_Login: vi.fn(), POST_PasswordReset: vi.fn() }));
vi.mock("@/composables/useLoginSession", () => ({
  useLoginSession: () => ({ completeLogin: vi.fn() }),
  consumeReturnRoute: () => null,
}));

// VUE_APP_* values are compiled into the bundle. The dev auto-login pair is for `npm run serve` only: a production
// build refuses to start with either set, the app reads them only in development, and no source map ships.
const PAIR = { VUE_APP_USERNAME: "dev-user", VUE_APP_PASSWORD: "dev-example-not-a-secret" };

describe("production build", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("refuses to build with a dev auto-login variable set, naming it and never its value", () => {
    const { assertNoDevCredentials } = require("../../../scripts/build-env.js");
    for (const key of Object.keys(PAIR)) {
      const build = () => assertNoDevCredentials({ NODE_ENV: "production", [key]: PAIR[key] });
      expect(build).toThrow(key);
      expect(build).not.toThrow(PAIR[key]);
    }
  });

  it("builds without them, and development may set them", () => {
    const { assertNoDevCredentials } = require("../../../scripts/build-env.js");
    expect(() => assertNoDevCredentials({ NODE_ENV: "production", VUE_APP_USERNAME: "" })).not.toThrow();
    expect(() => assertNoDevCredentials({ NODE_ENV: "development", ...PAIR })).not.toThrow();
  });

  it("ships no source map", () => {
    expect(require("../../../vue.config.js").productionSourceMap).toBe(false);
  });

  const loginWall = async (env) => {
    Object.entries({ ...PAIR, ...env }).forEach(([key, value]) => vi.stubEnv(key, value));
    vi.resetModules();
    const { default: LoginWall } = await import("@/functionals/Login-wall/Login-wall.vue");
    return mount(LoginWall).vm;
  };

  it("the login wall prefills the pair in development only, debug mode or not", async () => {
    expect(await loginWall({ NODE_ENV: "development" })).toMatchObject({ username: "dev-user", password: PAIR.VUE_APP_PASSWORD });
    expect(await loginWall({ NODE_ENV: "production", VUE_APP_DEBUG: "true" })).toMatchObject({ username: "", password: "" });
  });

  const envKeys = async (env) => {
    Object.entries({ ...env, VUE_APP_USERNAME: "", VUE_APP_PASSWORD: "" }).forEach(([key, value]) => vi.stubEnv(key, value));
    vi.resetModules();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "group").mockImplementation(() => {});
    const { envStatus } = await import("@/utils/env-check");
    vi.restoreAllMocks();
    return envStatus.warnings.map((entry) => entry.key);
  };

  it("the runtime env check lists the pair in development only", async () => {
    expect(await envKeys({ NODE_ENV: "development" })).toEqual(expect.arrayContaining(Object.keys(PAIR)));
    const production = await envKeys({ NODE_ENV: "production" });
    expect(production).not.toContain("VUE_APP_USERNAME");
    expect(production).not.toContain("VUE_APP_PASSWORD");
  });
});
