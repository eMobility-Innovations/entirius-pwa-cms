import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { useNotifyStore } from "@/stores/notify";
import Notifications from "@/components/Notifications/Notifications.vue";
import notificationsSource from "@/components/Notifications/Notifications.vue?raw";
import ReviewActions from "@/views/Leads/ReviewActions.vue";

// FIX-17c item 6: a tap on a phone never pins the toast over the page — only a hovering mouse holds it.
describe("toasts", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  const showToast = () => {
    useNotifyStore().spawnNotification({ msg: "That draft is already scheduled or sent.", type: "warning" });
    return mount(Notifications, { global: { stubs: { "transition-group": { template: "<ul><slot /></ul>" } } } });
  };

  it("a touch on the toast does not stop it from hiding", async () => {
    const wrapper = showToast();
    await wrapper.vm.$nextTick();
    await wrapper.get(".notification").trigger("pointerenter", { pointerType: "touch" });
    vi.advanceTimersByTime(5000);
    expect(useNotifyStore().notifications).toHaveLength(0);
  });

  it("a hovering mouse holds the toast until it leaves", async () => {
    const wrapper = showToast();
    await wrapper.vm.$nextTick();
    await wrapper.get(".notification").trigger("pointerenter", { pointerType: "mouse" });
    vi.advanceTimersByTime(10000);
    expect(useNotifyStore().notifications).toHaveLength(1);
    await wrapper.get(".notification").trigger("pointerleave", { pointerType: "mouse" });
    vi.advanceTimersByTime(5000);
    expect(useNotifyStore().notifications).toHaveLength(0);
  });

  // FIX-17d item 1: happy-dom lays nothing out, so the geometry is the stylesheet's — the phone toast's bottom edge
  // is lifted by the measured bar height, which leaves the whole Send / Not now bar outside the toast.
  it("at 390 px a toast leaves the Review action bar hit-testable", async () => {
    window.innerWidth = 390;
    const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(81);
    const bar = mount(ReviewActions, { global: { directives: { out: {} } } });
    const wrapper = showToast();
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".notification").exists()).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--action-bar-height")).toBe("81px");
    const phoneRule = notificationsSource.slice(notificationsSource.indexOf("@media screen and (max-width: 768px)"));
    expect(phoneRule).toMatch(/\.notifications \{[^}]*bottom: calc\([^;]*\+ var\(--action-bar-height, 0px\)\);/);
    bar.unmount();
    expect(document.documentElement.style.getPropertyValue("--action-bar-height")).toBe("");
    height.mockRestore();
  });

  // FIX-17e item 2: the bar height changes after mount (orientation, wrap, font, language) — the offset follows it.
  it("the toast offset follows the Review action bar height after a resize", async () => {
    const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(81);
    const bar = mount(ReviewActions, { global: { directives: { out: {} } } });
    height.mockReturnValue(122);
    window.dispatchEvent(new Event("resize"));
    expect(document.documentElement.style.getPropertyValue("--action-bar-height")).toBe("122px");
    bar.unmount();
    height.mockReturnValue(40);
    window.dispatchEvent(new Event("resize"));
    expect(document.documentElement.style.getPropertyValue("--action-bar-height")).toBe("");
    height.mockRestore();
  });
});
