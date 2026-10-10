import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

const api = vi.hoisted(() => ({
  GET_ConfigHealth: vi.fn(),
  POST_ConfigHealthCheck: vi.fn(),
  GET_Modules: vi.fn(),
}));
vi.mock("@/api/munin/api", () => api);

import { useConfigHealthStore } from "@/stores/configHealth";
import ConfigHealthButton from "@/components/ConfigHealth/ConfigHealthButton.vue";
import ConfigBanner from "@/components/ConfigHealth/ConfigBanner.vue";
import AiToolboxHint from "@/components/ConfigHealth/AiToolboxHint.vue";
import { useMuninStore } from "@/stores/munin";
import { textTokens } from "@/utils/configHealth";

const SMTP = {
  code: "communicator.smtp",
  module: "communicator",
  state: "unconfigured",
  severity: "high",
  title: "SMTP not configured for channel default-europe",
  detail: "Add a complete entry.",
  fix_url: "https://docs.test/smtp",
  scope: "default-europe",
};
const GREEN = [
  { code: "communicator.smtp", state: "configured" },
  { code: "toolbox.status", state: "configured" },
];
const health = (checks) =>
  Promise.resolve({ data: { checked_at: new Date().toISOString(), checks } });
const RouterLink = { props: ["to"], template: '<a :data-to="to"><slot /></a>' };
const mountButton = () =>
  mount(ConfigHealthButton, {
    global: { stubs: { teleport: true, RouterLink } },
  });

describe("configuration health", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("all green: no header icon", async () => {
    api.GET_ConfigHealth.mockReturnValue(health(GREEN));
    await useConfigHealthStore().poll();
    expect(
      mountButton().find('[data-testid="config-health-button"]').exists()
    ).toBe(false);
  });

  it("a failing check shows the triangle with its count; the panel lists it with its fix link, green codes below", async () => {
    api.GET_ConfigHealth.mockReturnValue(
      health([SMTP, { code: "toolbox.status", state: "configured" }])
    );
    await useConfigHealthStore().poll();
    const wrapper = mountButton();
    await flushPromises();
    expect(wrapper.get('[data-testid="config-health-count"]').text()).toBe("1");
    await wrapper.get('[data-testid="config-health-button"]').trigger("click");
    const row = wrapper.get('[data-testid="config-health-row"]');
    expect(row.text()).toContain(
      "Outgoing mail is not configured for channel default-europe"
    );
    expect(
      row.get('[data-testid="config-health-fix"]').attributes()
    ).toMatchObject({ href: SMTP.fix_url, target: "_blank" });
    expect(
      wrapper.get('[data-testid="config-health-passing"]').text()
    ).toContain("AI toolbox");
  });

  it("env-var names and URLs are code tokens; the words around them stay plain text", async () => {
    api.GET_ConfigHealth.mockReturnValue(
      health([{ ...SMTP, detail: "Set EMAIL_HOST_PASSWORD, see https://docs.test/smtp-setup for the steps." }])
    );
    await useConfigHealthStore().poll();
    const wrapper = mountButton();
    await flushPromises();
    await wrapper.get('[data-testid="config-health-button"]').trigger("click");
    const detail = wrapper.get(".cfg-row__detail");
    expect(detail.findAll("code").map((code) => code.text())).toEqual([
      "EMAIL_HOST_PASSWORD",
      "https://docs.test/smtp-setup",
    ]);
    expect(detail.text()).toBe("Set EMAIL_HOST_PASSWORD, see https://docs.test/smtp-setup for the steps.");
  });

  it("textTokens splits out env-var names and URLs only", () => {
    expect(textTokens("Missing SMTP_HOST (or URL_1) at http://x.test/a, not Name_Case")).toEqual([
      { text: "Missing ", code: false },
      { text: "SMTP_HOST", code: true },
      { text: " (or ", code: false },
      { text: "URL_1", code: true },
      { text: ") at ", code: false },
      { text: "http://x.test/a", code: true },
      { text: ", not Name_Case", code: false },
    ]);
    expect(textTokens(undefined)).toEqual([]);
  });

  // Whether such a word fits a phone is measured by @ux on the health-open state (tests/visual/support/state.js).
  it("a long word that is no token stays plain text", () => {
    const words = ["DEBUG", "mail.example.test:587", "/etc/app/settings.py", "Notificationdeliveryconfiguration"];
    words.forEach((word) => expect(textTokens(word)).toEqual([{ text: word, code: false }]));
  });

  it("a CMS-path fix link is a router link", async () => {
    api.GET_ConfigHealth.mockReturnValue(
      health([{ ...SMTP, fix_url: "/communicator/settings" }])
    );
    await useConfigHealthStore().poll();
    const wrapper = mountButton();
    await flushPromises();
    await wrapper.get('[data-testid="config-health-button"]').trigger("click");
    expect(
      wrapper.get('[data-testid="config-health-fix"]').attributes("data-to")
    ).toBe("/communicator/settings");
  });

  it("an unknown code falls back to the backend title", async () => {
    api.GET_ConfigHealth.mockReturnValue(
      health([
        { ...SMTP, code: "siteintel.keys", title: "urlscan key missing" },
      ])
    );
    await useConfigHealthStore().poll();
    const wrapper = mountButton();
    await flushPromises();
    await wrapper.get('[data-testid="config-health-button"]').trigger("click");
    expect(wrapper.get('[data-testid="config-health-row"]').text()).toContain(
      "urlscan key missing"
    );
  });

  it("bad → good: the icon turns into a green 'fixed' for 10 s, then hides — no click needed", async () => {
    const store = useConfigHealthStore();
    api.GET_ConfigHealth.mockReturnValueOnce(
      health([SMTP])
    ).mockReturnValueOnce(health(GREEN));
    await store.poll();
    const wrapper = mountButton();
    await store.poll();
    await flushPromises();
    expect(
      wrapper
        .get('[data-testid="config-health-button"]')
        .attributes("aria-label")
    ).toBe("Configuration fixed");
    expect(wrapper.find('[data-testid="config-health-count"]').exists()).toBe(
      false
    );
    vi.advanceTimersByTime(10000);
    await flushPromises();
    expect(wrapper.find('[data-testid="config-health-button"]').exists()).toBe(
      false
    );
  });

  it("Check again posts the probes", async () => {
    api.POST_ConfigHealthCheck.mockReturnValue(
      health([{ ...SMTP, code: "email.smtp", state: "auth_failed" }])
    );
    const store = useConfigHealthStore();
    await store.recheck();
    expect(api.POST_ConfigHealthCheck).toHaveBeenCalledOnce();
    expect(store.stateOf("email.smtp")).toBe("auth_failed");
    expect(store.stateOf("toolbox.status")).toBe("");
  });

  it("a probe failure survives the next plain poll — no false 'fixed' — and clears on the next Check again", async () => {
    const store = useConfigHealthStore();
    const probed = {
      ...SMTP,
      code: "email.smtp",
      state: "auth_failed",
      probe: true,
    };
    api.POST_ConfigHealthCheck.mockReturnValueOnce(health([probed, GREEN[0]]));
    api.GET_ConfigHealth.mockReturnValue(
      health([{ code: "email.smtp", state: "configured" }, GREEN[0]])
    );
    await store.recheck();
    await store.poll();
    expect(store.stateOf("email.smtp")).toBe("auth_failed");
    expect(store.failing).toHaveLength(1);
    expect(store.passing.map((row) => row.code)).toEqual(["communicator.smtp"]);
    expect(store.justFixed).toBe(false);
    api.POST_ConfigHealthCheck.mockReturnValueOnce(
      health([{ code: "email.smtp", state: "configured" }, GREEN[0]])
    );
    await store.recheck();
    expect(store.stateOf("email.smtp")).toBe("configured");
    expect(store.justFixed).toBe(true);
  });

  it("stop() drops a response still in flight and the 'fixed' flash of the old session", async () => {
    const store = useConfigHealthStore();
    let answer;
    api.GET_ConfigHealth.mockReturnValueOnce(
      health([SMTP])
    ).mockReturnValueOnce(new Promise((r) => (answer = r)));
    await store.poll();
    const late = store.poll();
    store.stop();
    answer({ data: { checked_at: "x", checks: [SMTP] } });
    await late;
    expect(store.checks).toEqual([]);
    expect(store.justFixed).toBe(false);
  });

  it("the panel is reachable when everything is green", async () => {
    api.GET_ConfigHealth.mockReturnValue(health(GREEN));
    const store = useConfigHealthStore();
    await store.poll();
    store.panelOpen = true;
    const wrapper = mountButton();
    await flushPromises();
    expect(wrapper.get('[data-testid="config-health-ok"]').exists()).toBe(true);
    expect(wrapper.findAll(".cfg-grid__item")).toHaveLength(2);
  });

  it("without the icon, Esc in the panel returns focus to a named trigger", async () => {
    api.GET_ConfigHealth.mockReturnValue(health(GREEN));
    const store = useConfigHealthStore();
    await store.poll();
    store.panelOpen = true;
    const wrapper = mount(ConfigHealthButton, {
      attachTo: document.body,
      global: { stubs: { teleport: true, RouterLink, BasicButton: false } },
    });
    await flushPromises();
    await wrapper.get('[data-testid="config-health-panel"]').trigger("keydown", { key: "Escape" });
    const anchor = wrapper.get('[data-testid="config-health-anchor"]');
    expect(document.activeElement).toBe(anchor.element);
    expect(anchor.text()).toBe("config_health.title");
    expect(store.panelOpen).toBe(false);
    wrapper.unmount();
  });

  it("the banner shows only its own code", async () => {
    api.GET_ConfigHealth.mockReturnValue(
      health([
        SMTP,
        { ...SMTP, code: "toolbox.status", state: "unreachable", scope: "" },
      ])
    );
    await useConfigHealthStore().poll();
    const wrapper = mount(ConfigBanner, {
      props: { code: "toolbox.status" },
      global: { stubs: { RouterLink } },
    });
    const banners = wrapper.findAll('[data-testid="config-banner"]');
    expect(banners).toHaveLength(1);
    expect(banners[0].text()).toContain("AI Toolbox is not responding");
  });
  const TOOLBOX = { code: "toolbox.status", module: "utils", state: "disabled", severity: "", scope: "" };
  const toolboxRow = (state) => ({ ...TOOLBOX, state, fix_url: "https://docs.test/toolbox" });
  const mountHint = () => mount(AiToolboxHint, { global: { stubs: { RouterLink } } });
  const hint = (wrapper) => wrapper.find('[data-testid="ai-toolbox-hint"]');

  it("a switched-off toolbox is a passing row: no icon, no count, named \"switched off\" in the panel", async () => {
    api.GET_ConfigHealth.mockReturnValue(health([TOOLBOX]));
    const store = useConfigHealthStore();
    await store.poll();
    expect(store.failing).toEqual([]);
    expect(store.passing).toHaveLength(1);
    expect(store.stateOf("toolbox.status")).toBe("disabled");
    store.panelOpen = true;
    const wrapper = mountButton();
    await flushPromises();
    expect(wrapper.find('[data-testid="config-health-button"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="config-health-ok"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="config-health-switched-off"]').text()).toBe("config_health.switched_off");
  });

  it("a configured row carries no \"switched off\" mark", async () => {
    api.GET_ConfigHealth.mockReturnValue(health(GREEN));
    const store = useConfigHealthStore();
    await store.poll();
    store.panelOpen = true;
    const wrapper = mountButton();
    await flushPromises();
    expect(wrapper.find('[data-testid="config-health-switched-off"]').exists()).toBe(false);
  });

  it("a switched-off toolbox polled again never flashes \"fixed\"", async () => {
    api.GET_ConfigHealth.mockReturnValue(health([TOOLBOX]));
    const store = useConfigHealthStore();
    await store.poll();
    await store.poll();
    expect(store.justFixed).toBe(false);
  });

  it.each([
    ["", true],
    ["configured", true],
    ["unreachable", true],
    ["disabled", false],
    ["unconfigured", false],
  ])("health state %j: aiUsable is %s", async (state, usable) => {
    api.GET_ConfigHealth.mockReturnValue(health(state ? [{ ...TOOLBOX, state }] : [SMTP]));
    const store = useConfigHealthStore();
    await store.poll();
    expect(store.aiState).toBe(state);
    expect(store.aiUsable).toBe(usable);
  });

  it("without health rows the public registry decides: platform.toolbox.state disabled blocks AI", async () => {
    api.GET_Modules.mockResolvedValue({ data: { platform: { toolbox: { state: "disabled" } }, modules: {} } });
    await useMuninStore().fetchModules();
    const store = useConfigHealthStore();
    expect(store.checks).toEqual([]);
    expect(store.aiState).toBe("disabled");
    expect(store.aiUsable).toBe(false);
    const wrapper = mountHint();
    expect(hint(wrapper).attributes("data-state")).toBe("disabled");
    expect(wrapper.find(".ai-hint__fix").exists()).toBe(false);
  });

  it("the health row wins over the registry", async () => {
    api.GET_Modules.mockResolvedValue({ data: { platform: { toolbox: { state: "disabled" } }, modules: {} } });
    await useMuninStore().fetchModules();
    api.GET_ConfigHealth.mockReturnValue(health([{ ...TOOLBOX, state: "configured" }]));
    const store = useConfigHealthStore();
    await store.poll();
    expect(store.aiState).toBe("configured");
  });

  it.each(["", "configured"])("the hint renders nothing for state %j", async (state) => {
    api.GET_ConfigHealth.mockReturnValue(health(state ? [{ ...TOOLBOX, state }] : []));
    await useConfigHealthStore().poll();
    expect(hint(mountHint()).exists()).toBe(false);
  });

  it.each([
    ["disabled", false],
    ["unconfigured", true],
    ["unreachable", true],
  ])("the hint for %s: its own text and state, fix link %s", async (state, linked) => {
    api.GET_ConfigHealth.mockReturnValue(health([toolboxRow(state)]));
    await useConfigHealthStore().poll();
    const wrapper = mountHint();
    expect(hint(wrapper).attributes("data-state")).toBe(state);
    expect(hint(wrapper).classes()).toContain(`ai-hint--${state}`);
    expect(hint(wrapper).text()).toContain(`config_health.checks.toolbox_status.${state}`);
    expect(wrapper.find(".ai-hint__fix").exists()).toBe(linked);
    if (linked) expect(wrapper.get(".ai-hint__fix").attributes("href")).toBe("https://docs.test/toolbox");
  });

  it("an internal fix url of the hint is a router link", async () => {
    api.GET_ConfigHealth.mockReturnValue(health([{ ...toolboxRow("unconfigured"), fix_url: "/leads/settings" }]));
    await useConfigHealthStore().poll();
    expect(mountHint().get(".ai-hint__fix").attributes("data-to")).toBe("/leads/settings");
  });
});
