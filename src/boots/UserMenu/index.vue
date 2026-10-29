<template>
  <BasicMenu :items="items" :label="userName" :inline="inline" placement="bottom-end" @select="choose">
    <template #trigger>
      <IconButton size="lg" icon="user" :label="userName" data-fid="user-button" />
    </template>
  </BasicMenu>
</template>

<script setup>
import { isSsoOnly } from "@/configs/sso";
// The user menu of the header (r05 §8.6, Q3): the user's name, the theme item that names its target state
// ("Tryb jasny" / "Tryb ciemny"), the field-hints switch (a checkbox item, on by default, plan 60), the languages
// (radio items, the current one checked), configuration health (with the munin module, as the header icon), change
// password, logout (danger). On BasicMenu: the trigger gets
// `aria-haspopup="menu"`, arrows move, Esc closes and returns focus. `inline` renders it open (catalogue).
import { computed } from "vue";
import { t } from "@/i18n";
import BasicMenu from "@/boots/BasicMenu/index.vue";
import IconButton from "@/boots/IconButton/index.vue";
import { useUserStore } from "@/stores/user";
import { useMuninStore } from "@/stores/munin";
import { useConfigHealthStore } from "@/stores/configHealth";

defineProps({ inline: { type: Boolean, default: false } });

const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "PL", label: "Polski" },
];
const userStore = useUserStore();
const munin = useMuninStore();
const configHealth = useConfigHealthStore();

const userName = computed(() => userStore.user?.username || userStore.user?.email || t("shell.user"));
const isDark = computed(() => userStore.theme === "dark");

const languageItems = () =>
  LANGUAGES.map(({ code, label }) => ({
    key: `lang-${code}`,
    label,
    icon: userStore.lang === code ? "check" : undefined,
    checked: userStore.lang === code,
  }));

const items = computed(() => [
  { key: "name", heading: true, label: userName.value },
  { key: "theme", label: t(isDark.value ? "app.light_mode" : "app.dark_mode"), icon: isDark.value ? "themeLight" : "themeDark" },
  {
    key: "hints",
    label: t("shell.field_hints"),
    icon: userStore.hints ? "check" : undefined,
    checkbox: true,
    checked: userStore.hints,
    testid: "field-hints-toggle",
  },
  { key: "sep-lang", separator: true },
  { key: "lang", heading: true, label: t("shell.language") },
  ...languageItems(),
  { key: "sep-account", separator: true },
  ...(munin.healthAvailable
    ? [{ key: "health", label: t("config_health.title"), icon: "success", testid: "config-health-menu" }]
    : []),
  ...(!isSsoOnly() ? [{ key: "password", label: t("user.change_password"), icon: "password", to: "/change-password" }] : []),
  { key: "logout", label: t("app.log_out"), icon: "logout", danger: true },
]);

const ACTIONS = {
  theme: () => userStore.setTheme(isDark.value ? "default" : "dark"),
  hints: () => userStore.setHints(!userStore.hints),
  health: () => (configHealth.panelOpen = true),
  logout: () => userStore.logout(),
};

function choose(item) {
  const lang = item.key.startsWith("lang-") && item.key.slice("lang-".length);
  if (lang) {
    if (lang !== userStore.lang) userStore.setLanguage(lang);
    return;
  }
  ACTIONS[item.key]?.();
}
</script>
