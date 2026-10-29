import { describe, it, expect } from "vitest";
import { companyIdFromSubjectRef, routeForSubjectRef } from "@/utils/subjectRef";

describe("routeForSubjectRef", () => {
  it("maps a leads company to its thread", () => {
    expect(routeForSubjectRef("leads.Company:42")).toEqual({ name: "LeadsThread", params: { id: 42 }, query: { tab: "timeline" } });
    expect(companyIdFromSubjectRef("leads.Company:42")).toBe(42);
  });

  it.each(["", null, "bdd:inbound:1", "atlas.Product:3", "leads.Company:x"])("returns null for %s", (ref) => {
    expect(routeForSubjectRef(ref)).toBeNull();
    expect(companyIdFromSubjectRef(ref)).toBeNull();
  });
});
