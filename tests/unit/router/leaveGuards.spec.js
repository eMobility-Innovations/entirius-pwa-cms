import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { defineComponent, h, reactive, nextTick } from "vue";

// Characterization of every in-component guard (beforeRouteLeave / beforeRouteUpdate). Each view's own hook is lifted
// from the real component and hosted on a stand-in page that runs the real useUnsavedChanges composable, mounted
// under a real in-memory router. Assertions look only at where the navigation ends up (currentRoute) and at the
// state a user can see (the pending leave dialog), never at how the hook passes control on.
vi.mock("@/stores/access", () => ({ useAccessStore: () => ({ can: () => true, canAny: () => true, ensureLoaded: () => Promise.resolve() }) }));

import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import ApplicationDetail from "@/views/Access/ApplicationDetail.vue";
import RoleDetail from "@/views/Access/RoleDetail.vue";
import StaffList from "@/views/Access/StaffList.vue";
import Builds from "@/views/Builder/Builds.vue";
import Builder from "@/views/Builder/Builder.vue";
import ProfilePage from "@/views/EnrichmentProfile/ProfilePage.vue";
import ProposalEditor from "@/views/EnrichmentReview/ProposalEditor.vue";
import TemplateEdit from "@/views/EnrichmentTemplates/TemplateEdit.vue";
import GroupEdit from "@/views/Faq/GroupEdit.vue";
import ItemEdit from "@/views/Faq/ItemEdit.vue";
import FeatureSetEdit from "@/views/Pim/FeatureSetEdit.vue";
import ProductDetail from "@/views/Pim/ProductDetail.vue";
import CategoryDetail from "@/views/Pim/CategoryDetail.vue";
import FeatureEdit from "@/views/Pim/FeatureEdit.vue";
import PointEdit from "@/views/Points/PointEdit.vue";
import PromoEdit from "@/views/Promo/PromoEdit.vue";

let unsaved;
let initSpy;
let mounted;

// The page under test: the view's real hooks, the real unsaved-changes composable, extra state a hook reads.
function pageOf(View, extra = {}) {
  return defineComponent({
    name: "GuardedPage",
    beforeRouteLeave: View.beforeRouteLeave,
    beforeRouteUpdate: View.beforeRouteUpdate,
    setup() {
      unsaved = useUnsavedChanges();
      return { ...unsaved, ...extra, init: initSpy };
    },
    render: () => h("div", { "data-testid": "page" }),
  });
}

async function openRouter(Page) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/edit/:sku", component: Page },
      { path: "/other", component: { render: () => h("div") } },
    ],
  });
  await router.push("/edit/A");
  mounted = mount({ template: "<router-view />" }, { global: { plugins: [router] } });
  await flushPromises();
  return router;
}

// Edit the form the way a view does: snapshot, track, change.
async function makeDirty() {
  const form = reactive({ name: "a" });
  unsaved.snapshot(form);
  unsaved.track(form);
  form.name = "b";
  await nextTick();
  await nextTick();
  expect(unsaved.isDirty.value).toBe(true);
}

const settle = () => flushPromises();

beforeEach(() => {
  initSpy = vi.fn();
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

// Views whose leave hook is "ask when there are unsaved changes".
const askingViews = {
  "Access/RoleDetail": RoleDetail,
  "Access/ApplicationDetail": ApplicationDetail,
  "Builder/Builder": Builder,
  "EnrichmentProfile/ProfilePage": ProfilePage,
  "EnrichmentReview/ProposalEditor": ProposalEditor,
  "EnrichmentTemplates/TemplateEdit": TemplateEdit,
  "Faq/GroupEdit": GroupEdit,
  "Faq/ItemEdit": ItemEdit,
  "Pim/FeatureSetEdit": FeatureSetEdit,
  "Pim/ProductDetail": ProductDetail,
  "Pim/CategoryDetail": CategoryDetail,
  "Pim/FeatureEdit": FeatureEdit,
  "Points/PointEdit": PointEdit,
  "Promo/PromoEdit": PromoEdit,
};

describe.each(Object.entries(askingViews))("beforeRouteLeave: %s", (_name, View) => {
  const page = () => pageOf(View, { reveal: { open: false } });

  it("has a leave guard", () => {
    expect(typeof View.beforeRouteLeave).toBe("function");
  });

  it("a clean form leaves at once", async () => {
    const router = await openRouter(page());
    await router.push("/other");
    expect(router.currentRoute.value.path).toBe("/other");
    expect(unsaved.pendingNav.value).toBeNull();
  });

  it("unsaved changes hold the page and ask; confirming leaves for the place that was asked for", async () => {
    const router = await openRouter(page());
    await makeDirty();
    const leaving = router.push("/other");
    await settle();
    expect(router.currentRoute.value.path).toBe("/edit/A");
    expect(unsaved.pendingNav.value.to.path).toBe("/other");

    unsaved.confirmLeave();
    await leaving;
    expect(router.currentRoute.value.path).toBe("/other");
    expect(unsaved.pendingNav.value).toBeNull();
  });

  it("unsaved changes: cancelling stays on the page and drops the question", async () => {
    const router = await openRouter(page());
    await makeDirty();
    router.push("/other");
    await settle();
    expect(unsaved.pendingNav.value).not.toBeNull();

    unsaved.cancelLeave();
    await settle();
    expect(router.currentRoute.value.path).toBe("/edit/A");
    expect(unsaved.pendingNav.value).toBeNull();
    expect(unsaved.isDirty.value).toBe(true);
  });
});

describe("beforeRouteLeave: Access/ApplicationDetail (reveal open)", () => {
  it("an open one-time secret blocks leaving, clean form or not", async () => {
    const router = await openRouter(pageOf(ApplicationDetail, { reveal: { open: true } }));
    await router.push("/other").catch(() => {});
    expect(router.currentRoute.value.path).toBe("/edit/A");
  });

  it("a closed one does not", async () => {
    const router = await openRouter(pageOf(ApplicationDetail, { reveal: { open: false } }));
    await router.push("/other");
    expect(router.currentRoute.value.path).toBe("/other");
  });
});

describe("beforeRouteLeave: Access/StaffList", () => {
  it("leaves freely with no secret on screen", async () => {
    const router = await openRouter(pageOf(StaffList, { reveal: null }));
    await router.push("/other");
    expect(router.currentRoute.value.path).toBe("/other");
  });

  it("a shown one-time password blocks leaving", async () => {
    const router = await openRouter(pageOf(StaffList, { reveal: true }));
    await router.push("/other").catch(() => {});
    expect(router.currentRoute.value.path).toBe("/edit/A");
  });
});

describe("beforeRouteUpdate: Access/RoleDetail (another role, same route record)", () => {
  it("a clean form moves to the other role; a dirty one asks first", async () => {
    const router = await openRouter(pageOf(RoleDetail));
    await router.push("/edit/B");
    expect(router.currentRoute.value.path).toBe("/edit/B");

    await makeDirty();
    const switching = router.push("/edit/C");
    await settle();
    expect(router.currentRoute.value.path).toBe("/edit/B");
    unsaved.confirmLeave();
    await switching;
    expect(router.currentRoute.value.path).toBe("/edit/C");
  });

  it("a dirty form that cancels stays on its role", async () => {
    const router = await openRouter(pageOf(RoleDetail));
    await makeDirty();
    router.push("/edit/C");
    await settle();
    unsaved.cancelLeave();
    await settle();
    expect(router.currentRoute.value.path).toBe("/edit/A");
  });
});

describe("beforeRouteUpdate: Pim/ProductDetail", () => {
  // The stand-in route is /edit/:sku, so params.sku changes with the product.
  it("a hash or query change on the same SKU never asks, dirty or not", async () => {
    const router = await openRouter(pageOf(ProductDetail));
    await makeDirty();
    await router.push("/edit/A?tab=media");
    expect(router.currentRoute.value.fullPath).toBe("/edit/A?tab=media");
    await router.push("/edit/A?tab=media#seo");
    expect(router.currentRoute.value.hash).toBe("#seo");
    expect(unsaved.pendingNav.value).toBeNull();
  });

  it("another SKU with a clean form switches at once", async () => {
    const router = await openRouter(pageOf(ProductDetail));
    await router.push("/edit/B");
    expect(router.currentRoute.value.path).toBe("/edit/B");
  });

  it("another SKU with unsaved edits asks; confirming switches, cancelling stays", async () => {
    const router = await openRouter(pageOf(ProductDetail));
    await makeDirty();
    const switching = router.push("/edit/B");
    await settle();
    expect(router.currentRoute.value.path).toBe("/edit/A");
    expect(unsaved.pendingNav.value.to.params.sku).toBe("B");
    unsaved.confirmLeave();
    await switching;
    expect(router.currentRoute.value.path).toBe("/edit/B");

    await makeDirty();
    router.push("/edit/C");
    await settle();
    unsaved.cancelLeave();
    await settle();
    expect(router.currentRoute.value.path).toBe("/edit/B");
  });
});

describe("beforeRouteUpdate: Builder/Builds", () => {
  const buildsPage = () =>
    defineComponent({
      name: "BuildsPage",
      beforeRouteUpdate: Builds.beforeRouteUpdate,
      methods: { init: (...args) => initSpy(...args) },
      render: () => h("div"),
    });

  async function open() {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/builds/:content_type?", component: buildsPage() }],
    });
    await router.push("/builds/page");
    mounted = mount({ template: "<router-view />" }, { global: { plugins: [router] } });
    await flushPromises();
    initSpy.mockClear();
    return router;
  }

  it("another content type reloads the list for it and the navigation completes", async () => {
    const router = await open();
    await router.push("/builds/post?lg=pl");
    expect(router.currentRoute.value.fullPath).toBe("/builds/post?lg=pl");
    expect(initSpy).toHaveBeenCalledWith({ _content_type: "post", language: "pl" });
  });

  it("a route without type or language reloads with none and still completes", async () => {
    const router = await open();
    await router.push("/builds");
    expect(router.currentRoute.value.path).toBe("/builds");
    // An absent optional param is "" in vue-router 4: the library's call, so only "no type" is pinned.
    const [args] = initSpy.mock.calls[0];
    expect(args._content_type).toBeFalsy();
    expect(args.language).toBeNull();
  });
});
