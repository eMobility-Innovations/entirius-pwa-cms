import { describe, it, expect } from "vitest";
import { AREAS } from "@/configs/areas";
import { panels } from "@/configs/access";
import catalogue from "../../fixtures/access-catalogue.json";

// BG-24: the area constants are the one place the CMS spells an area key; each one is a key of the django-access
// catalogue snapshot (the same file the i18n key test reads), and every panel works on catalogue areas only.
describe("area constants", () => {
  it("are all catalogue areas, named after their key", () => {
    Object.entries(AREAS).forEach(([name, key]) => {
      expect(catalogue.areas).toContain(key);
      expect(name).toBe(key.toUpperCase().replace(".", "_"));
    });
  });

  it("are the only areas the panel registry uses", () => {
    const values = Object.values(AREAS);
    panels.flatMap((panel) => panel.areas).forEach((area) => expect(values).toContain(area));
  });
});
