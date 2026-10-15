import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import path from "path";

// The capture projects sign in with real credentials and the docs project writes for real. Pointed at a host that is
// not this machine they would send that password there and change its data, so each entry point refuses a
// CMS_BASE_URL / CMS_API_URL off loopback unless CMS_ALLOW_REMOTE=1 says it is meant.
const ROOT = path.resolve(__dirname, "../../..");
const ENTRY_POINTS = [
  "tests/docs/playwright.docs.config.js",
  "tests/docs/support/capture.js",
  "tests/visual/playwright.visual.config.js",
  "tests/visual/support/state.js",
];
const REMOTE = "https://cms.example.test";
// Each case starts fresh node processes that load Playwright; under the full parallel suite that outgrows 5 s.
const SPAWN_TIMEOUT_MS = 30_000;

// Loads the file in a fresh node process, the way Playwright does; answers "ok" or the error it threw.
const load = (file, env) => {
  const script = `try { require(${JSON.stringify(path.join(ROOT, file))}); console.log("ok"); } catch (e) { console.log(e.message); }`;
  const clean = { ...process.env, CMS_BASE_URL: "", CMS_API_URL: "", CMS_ALLOW_REMOTE: "", ...env };
  return execFileSync(process.execPath, ["-e", script], { cwd: ROOT, env: clean, encoding: "utf8" }).trim();
};

describe("capture projects stay on loopback", () => {
  it.each(ENTRY_POINTS)("%s loads with the defaults and with loopback URLs", (file) => {
    expect(load(file, {})).toBe("ok");
    expect(load(file, { CMS_BASE_URL: "http://127.0.0.1:8181", CMS_API_URL: "http://localhost:9100" })).toBe("ok");
  }, SPAWN_TIMEOUT_MS);

  it.each(ENTRY_POINTS)("%s refuses a remote CMS_BASE_URL or CMS_API_URL", (file) => {
    const refusal = load(file, { CMS_BASE_URL: REMOTE, CMS_API_URL: REMOTE });
    expect(refusal).toMatch(/^INFRA: CMS_(BASE|API)_URL points at cms\.example\.test/);
    expect(refusal).toContain("CMS_ALLOW_REMOTE=1");
  }, SPAWN_TIMEOUT_MS);

  it.each(ENTRY_POINTS)("%s takes a remote URL with CMS_ALLOW_REMOTE=1", (file) => {
    expect(load(file, { CMS_BASE_URL: REMOTE, CMS_API_URL: REMOTE, CMS_ALLOW_REMOTE: "1" })).toBe("ok");
  }, SPAWN_TIMEOUT_MS);

  it("a URL that carries credentials is refused without printing them", () => {
    const refusal = load(ENTRY_POINTS[0], { CMS_BASE_URL: "https://ada:example-not-a-password@cms.example.test" });
    expect(refusal).toMatch(/^INFRA: CMS_BASE_URL points at cms\.example\.test/);
    expect(refusal).not.toContain("example-not-a-password");
  }, SPAWN_TIMEOUT_MS);
});
