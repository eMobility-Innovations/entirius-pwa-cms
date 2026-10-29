import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Loader from "@/boots/Loader/index.vue";

describe("Loader boot", () => {
  it("is inline by default so a modal, side panel or button keeps its layout", () => {
    expect(mount(Loader).classes()).not.toContain("loader-element--block");
  });

  it("centres in the content area with block", () => {
    expect(mount(Loader, { props: { block: true } }).classes()).toContain("loader-element--block");
  });
});

describe("Loader sizes and overlay", () => {
  it("is a status with a hidden loading text", () => {
    const wrapper = mount(Loader);
    expect(wrapper.attributes("role")).toBe("status");
    expect(wrapper.find(".loader-hidden-text").text()).toBe("common.loading");
  });

  it("takes size 32 or 64, 64 by default", () => {
    expect(mount(Loader, { props: { size: 32 } }).attributes("style")).toContain("width: 32px");
    expect(mount(Loader).attributes("style")).toContain("width: 64px");
  });

  it("overlay veils the screen with a 64 px loader; contained keeps it in its box", () => {
    const overlay = mount(Loader, { props: { overlay: true } });
    expect(overlay.classes()).toContain("loader-overlay");
    expect(overlay.classes()).not.toContain("loader-overlay--contained");
    expect(overlay.attributes("role")).toBe("status");
    expect(overlay.find(".loader-element").attributes("style")).toContain("width: 64px");
    expect(mount(Loader, { props: { overlay: true, contained: true } }).classes()).toContain("loader-overlay--contained");
  });
});
