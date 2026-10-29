import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Access plan 22 (security review 2026-10-01): with VUE_APP_DEBUG on, createClient logs every request and response
// body — except a request flagged `sensitive`, which every token call of the access API is. A mocked create answer
// carrying a raw value never reaches console.log. A fake shorter than a real token.
const FAKE = "ent_api_EXAMPLE-not-a-token";
const answer = (data) => async (config) => ({ data, status: 201, statusText: "Created", headers: {}, config });

describe("debug log redaction", () => {
  let log;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VUE_APP_DEBUG", "true");
    log = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    log.mockRestore();
  });

  const logged = () => JSON.stringify(log.mock.calls);

  it("token create and rotate answers are logged as [redacted], their requests too", async () => {
    const { accessApi } = await import("@/api/access/client");
    accessApi.defaults.adapter = answer({ id: 7, raw: FAKE });
    const { POST_AccessToken, POST_AccessTokenRotate } = await import("@/api/access/api");

    expect((await POST_AccessToken(3, { name: "Shop", scopes: ["checkout.storefront"] })).data.raw).toBe(FAKE);
    await POST_AccessTokenRotate(7, { overlap_hours: 24 });

    expect(logged()).not.toContain("ent_api_");
    expect(logged()).not.toContain("Shop");
    expect(log.mock.calls.filter((call) => call.includes("[redacted]"))).toHaveLength(4);
  });

  it("a request without the flag is still logged in full", async () => {
    const { createApiClient } = await import("@/api/createClient");
    const client = createApiClient("http://api.test");
    client.defaults.adapter = answer({ name: "Shop" });
    await client.post("/applications/", { name: "Shop" });
    expect(logged()).toContain("Shop");
    expect(logged()).not.toContain("[redacted]");
  });
});
