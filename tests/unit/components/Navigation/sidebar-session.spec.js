import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import Cookies from "universal-cookie";
import { setActivePinia, createPinia } from "pinia";
import { useUserStore } from "@/stores/user";
import { useLoginSession } from "@/composables/useLoginSession";
import SidebarNav from "@/boots/SidebarNav/index.vue";
import { jwtExpiringIn } from "../../helpers/jwt";

// r04 §9 defect 3: isAuth flipped before the profile and permissions calls resolved, so a click on a home card
// could leave before the `user` cookie was written — and the desktop sidebar rendered empty on every later reload.
const mockGetUserDetails = vi.fn();

vi.mock("@/api/contentDB/api", () => ({
  GET_User: async () => ({ data: { data: [] } }),
  GET_UserDetails: (...args) => mockGetUserDetails(...args),
  PATCH_UserProfile: async () => ({}),
}));
vi.mock("vue-router", () => ({
  useRoute: () => ({ path: "/pages/content", meta: { panel: "pages" }, params: {}, query: {}, matched: [] }),
  useRouter: () => ({
    resolve: (to) => ({ path: typeof to === "string" ? to : to.path }),
    currentRoute: { value: { path: "/", query: {}, hash: "" } },
    replace: async () => {},
  }),
}));
vi.mock("@/api/munin/api", () => ({
  GET_Modules: async () => ({ data: { modules: {} } }),
}));

const mountDesktopNav = () =>
  mount(SidebarNav, {
    global: { stubs: { RouterLink: { props: ["to"], template: "<a class='nav-link'><slot /></a>" } } },
  });

describe("sidebar after login", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }));
  });

  afterEach(() => {
    useUserStore().clearAuth();
    vi.unstubAllGlobals();
  });

  it("leaves the login wall only with the user in the store, and renders without the user cookie", async () => {
    let answerProfile;
    mockGetUserDetails.mockReturnValue(new Promise((resolve) => (answerProfile = resolve)));
    const userStore = useUserStore();

    const login = useLoginSession().completeLogin({ access: jwtExpiringIn(300), refresh: "r", customer_id: "c" });
    await flushPromises();
    expect(userStore.isAuth).toBe(false);

    answerProfile({ data: { data: { username: "ops" } } });
    await login;
    expect(userStore.isAuth).toBe(true);
    expect(userStore.user.username).toBe("ops");

    new Cookies().remove("user", { path: "/" });
    expect(mountDesktopNav().findAll(".nav-link").length).toBeGreaterThan(0);
  });
});
