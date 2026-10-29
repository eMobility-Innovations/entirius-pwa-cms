import { afterEach, describe, expect, it } from "vitest";
import en from "@/i18n/locales/en.json";
import pl from "@/i18n/locales/pl.json";
import { setLang, t } from "@/i18n";

afterEach(() => setLang("EN"));

describe("matrix labels coexist with upstream access dictionaries", () => {
  it.each([
    ["EN", en, { grants: "Grants", roles: "Roles", audit: "History" }],
    ["PL", pl, { grants: "Nadania", roles: "Role", audit: "Historia" }],
  ])("%s preserves both contracts", (lang, locale, labels) => {
    setLang(lang);
    for (const key of ["grants", "roles", "audit"]) {
      expect(locale.access[key]).toBeTypeOf("object");
      expect(t(`access.matrix_labels.${key}`)).toBe(labels[key]);
    }
    expect(t("access.roles.title")).toBe(locale.access.roles.title);
    expect(t("access.roles.title")).toBeTypeOf("string");
    expect(t("access.audit.title")).toBe(locale.access.audit.title);
    expect(t("access.audit.title")).toBeTypeOf("string");
    expect(t("access.grants.role")).toBe(locale.access.grants.role);
    expect(t("access.grants.role")).toBeTypeOf("string");
  });
});
