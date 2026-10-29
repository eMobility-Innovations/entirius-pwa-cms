import { describe, it, expect } from "vitest";
import en from "@/i18n/locales/en.json";
import pl from "@/i18n/locales/pl.json";
import catalogue from "../../fixtures/access-catalogue.json";

// Access plan 23: every access string exists in both locales — the panel, its nav, the read-only notice, the non-staff
// wall, SecretReveal — plus one label per catalogue area and token scope (`access.areas.<key>`, `access.scopes.<key>`).
// The area and scope keys come from the committed catalogue snapshot (`tests/fixtures/access-catalogue.json`, the keys
// of `GET /api/access/v2/admin/catalogue/`), shared with `tests/unit/configs/areas.spec.js`; the e2e
// `access-catalogue.spec.js` diffs the live catalogue against it and against these labels, so a new catalogue area
// fails there until the snapshot and both locales carry it.

const { areas: AREAS, scopes: SCOPES } = catalogue;

// The namespaces the access work owns; `panels` is shared, so only its two access keys count.
const NAMESPACES = ["access", "nav.access", "secret_reveal"];
const PANEL_KEYS = ["panels.access", "panels.access_desc"];

const resolve = (locale, key) => key.split(".").reduce((node, part) => node?.[part], locale);
const leaves = (node, prefix) =>
  Object.entries(node ?? {}).flatMap(([key, value]) =>
    typeof value === "object" ? leaves(value, `${prefix}.${key}`) : [`${prefix}.${key}`]
  );
const missingIn = (locale, keys) => keys.filter((key) => !String(resolve(locale, key) ?? "").trim());

describe("access i18n keys", () => {
  it.each(NAMESPACES)("%s has the same keys in EN and PL", (namespace) => {
    const enKeys = leaves(resolve(en, namespace), namespace);
    expect(enKeys.length).toBeGreaterThan(0);
    expect(missingIn(pl, enKeys)).toEqual([]);
    expect(missingIn(en, leaves(resolve(pl, namespace), namespace))).toEqual([]);
  });

  it("names the Access panel in both locales", () => {
    expect(missingIn(en, PANEL_KEYS)).toEqual([]);
    expect(missingIn(pl, PANEL_KEYS)).toEqual([]);
  });

  it("labels every catalogue area in both locales", () => {
    const keys = AREAS.map((area) => `access.areas.${area}`);
    expect(new Set(AREAS).size).toBe(AREAS.length);
    expect(missingIn(en, keys)).toEqual([]);
    expect(missingIn(pl, keys)).toEqual([]);
  });

  it("labels every token scope in both locales", () => {
    const keys = SCOPES.map((scope) => `access.scopes.${scope}`);
    expect(missingIn(en, keys)).toEqual([]);
    expect(missingIn(pl, keys)).toEqual([]);
  });

  it("keeps no area or scope label the catalogue does not have", () => {
    expect(leaves(en.access.areas, "areas").map((key) => key.slice(6)).sort()).toEqual([...AREAS].sort());
    expect(leaves(en.access.scopes, "scopes").map((key) => key.slice(7)).sort()).toEqual([...SCOPES].sort());
  });
});
