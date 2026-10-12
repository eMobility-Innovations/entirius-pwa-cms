import { describe, it, expect } from "vitest";
import { grantPayload, grantErrorMessage, roleLabel, roleOptions } from "@/views/Access/grants";
import { AUDIT_PAGE_SIZE, auditParams, foldedCount, foldedRequestsParams } from "@/views/Access/audit";

// Access plan 21: grant payloads, the "via <group>" marker, the lockout sentence and the audit query.
const t = (key, params) => (params ? `${key}::${JSON.stringify(params)}` : key);
const httpError = (status, data) => ({ response: { status, data } });

describe("grants", () => {
  it("a grant goes to one user or one group", () => {
    expect(grantPayload("viewer", { userId: 5 })).toEqual({ role: "viewer", user_id: 5 });
    expect(grantPayload("editor", { groupId: 3 })).toEqual({ role: "editor", group_id: 3 });
  });

  it("a group grant carries the via marker, a direct one is the role name", () => {
    expect(roleLabel({ key: "viewer", name: "Viewer", via_group: null }, t)).toBe("Viewer");
    expect(roleLabel({ key: "editor", name: "Editor", via_group: "Shop" }, t)).toBe(
      'Editor · access.staff.via::{"group":"Shop"}'
    );
  });

  it("roles already held directly are not offered again", () => {
    const roles = [{ key: "viewer", name: "Viewer" }, { key: "editor", name: "Editor" }];
    expect(roleOptions(roles, ["viewer"])).toEqual([{ label: "Editor", value: "editor" }]);
  });

  it("a revoke refused by the lockout guard reads as the sentence, never the code", () => {
    const lockout = httpError(409, { error: "CONFLICT", message: "Nobody active would be left to manage access" });
    expect(grantErrorMessage(lockout, t, { revoking: true })).toBe("access.grants.lockout");
  });

  it("a refused grant shows the server's message", () => {
    const notStaff = httpError(400, {
      error: "VALIDATION_ERROR",
      message: "Invalid input.",
      details: [{ field: "non_field_errors", description: "Grants go only to active staff users" }],
    });
    expect(grantErrorMessage(notStaff, t)).toBe("Grants go only to active staff users");
    expect(grantErrorMessage(httpError(409, { message: "Already granted" }), t)).toBe("Already granted");
  });
});

describe("audit", () => {
  it("filters become the query: action, actor id and the local day bounds", () => {
    const params = auditParams({ page: 2, action: "grant.migrate", actor: 7, from: "2026-10-01", to: "2026-10-02" });
    expect(params).toMatchObject({ page: 2, page_size: AUDIT_PAGE_SIZE, action: "grant.migrate", actor: 7 });
    expect(params.from).toBe(new Date(2026, 9, 1).toISOString());
    expect(params.to).toBe(new Date(new Date(2026, 9, 3).getTime() - 1).toISOString());
  });

  it("empty filters stay out of the query", () => {
    expect(auditParams({ action: null, actor: null, from: "", to: "" })).toEqual({ page: 1, page_size: AUDIT_PAGE_SIZE });
  });

  it("folding is the API's: fold_bypass goes out only when asked for", () => {
    expect(auditParams({ fold: true })).toEqual({ page: 1, page_size: AUDIT_PAGE_SIZE, fold_bypass: true });
    expect(auditParams({ fold: false })).not.toHaveProperty("fold_bypass");
  });

  it("a row stands for its folded count; a row of an API without folding stands for itself", () => {
    expect(foldedCount({ folded: 120 })).toBe(120);
    expect(foldedCount({ id: 1, action: "gate.bypass" })).toBe(1);
  });

  it("the requests of a folded row are its actor's bypass entries between the row's bounds", () => {
    const row = { id: 9, actor_id: 7, folded: 120, first_at: "2026-10-02T06:00:00Z", last_at: "2026-10-02T15:00:00Z" };
    expect(foldedRequestsParams(row)).toEqual({
      page: 1,
      page_size: AUDIT_PAGE_SIZE,
      action: "gate.bypass",
      actor: 7,
      from: "2026-10-02T06:00:00Z",
      to: "2026-10-02T15:00:00Z",
    });
    expect(foldedRequestsParams({ ...row, actor_id: null })).not.toHaveProperty("actor");
  });
});
