import { describe, it, expect } from "vitest";
import { installWebStorage } from "./webStorage";

describe("installWebStorage", () => {
  it("installs working in-memory storage when the runtime has none", () => {
    const target = { localStorage: undefined, sessionStorage: null };
    target.window = target;
    installWebStorage(target);
    for (const name of ["localStorage", "sessionStorage"]) {
      target[name].setItem("a", 1);
      expect(target[name].getItem("a")).toBe("1");
      expect(target[name].length).toBe(1);
      expect(target[name].key(0)).toBe("a");
      target[name].removeItem("a");
      expect(target[name].getItem("a")).toBeNull();
    }
    expect(target.localStorage).not.toBe(target.sessionStorage);
  });

  it("keeps the storage the runtime provides", () => {
    const own = { getItem: () => "own" };
    const target = { localStorage: own, sessionStorage: own };
    installWebStorage(target);
    expect(target.localStorage).toBe(own);
    expect(target.sessionStorage).toBe(own);
  });

  it("mirrors the storage on window when it is a separate object", () => {
    const target = { window: {} };
    installWebStorage(target);
    expect(target.window.localStorage).toBe(target.localStorage);
  });
});
