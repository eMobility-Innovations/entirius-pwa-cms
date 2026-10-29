import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { BREAKPOINT_MOBILE, SHELL_BREAKPOINT } from "@/utils/breakpoints";

// One number per breakpoint: the SCSS variables and the script constants never drift apart.
const scss = readFileSync(resolve(__dirname, "../../../src/assets/scss/utils/_media-query.scss"), "utf8");
const scssPx = (name) => Number(scss.match(new RegExp(`\\$${name}:\\s*(\\d+)px`))?.[1]);

describe("breakpoints", () => {
  it("the shell breakpoint is $breakpoint-shell", () => {
    expect(scssPx("breakpoint-shell")).toBe(SHELL_BREAKPOINT);
  });

  it("the mobile breakpoint is $breakpoint-mobile", () => {
    expect(scssPx("breakpoint-mobile")).toBe(BREAKPOINT_MOBILE);
  });
});
