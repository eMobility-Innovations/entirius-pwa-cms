import { describe, it, expect } from "vitest";
import { passwordErrors } from "@/utils/passwordForm";

const t = (key) => key;

describe("passwordErrors", () => {
  it("marks every empty field and sums it up once", () => {
    expect(passwordErrors(t, { oldPassword: "", newPassword: "a", confirmPassword: "" })).toEqual({
      errors: { oldPassword: "common.required", confirmPassword: "common.required" },
      summary: "user.fill_all_fields",
    });
  });

  it("marks the confirmation when it does not match", () => {
    expect(passwordErrors(t, { newPassword: "a", confirmPassword: "b" })).toEqual({
      errors: { confirmPassword: "user.passwords_dont_match" },
      summary: "user.passwords_dont_match",
    });
  });

  it("is valid when filled and matching", () => {
    expect(passwordErrors(t, { newPassword: "a", confirmPassword: "a" })).toEqual({ errors: {}, summary: "" });
  });
});
