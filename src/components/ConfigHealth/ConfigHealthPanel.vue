<template>
  <div class="cfg-panel" data-testid="config-health-panel">
    <div class="cfg-panel__head">
      <p class="cfg-panel__title">{{ $t("config_health.title") }}</p>
      <IconButton
        icon="close"
        :label="$t('config_health.close')"
        @click="emit('close', { returnFocus: true })"
      />
    </div>

    <p
      v-if="!store.failing.length"
      class="cfg-panel__ok"
      data-testid="config-health-ok"
    >
      {{ $t("config_health.all_ok") }}
    </p>
    <div
      v-for="row in store.failing"
      :key="`${row.code}:${row.scope}`"
      class="cfg-row"
      :class="`cfg-row--${row.severity}`"
      data-testid="config-health-row"
    >
      <p class="cfg-row__title">
        <template v-for="(part, i) in textTokens(checkText(row))" :key="i">
          <code v-if="part.code" class="cfg-token">{{ part.text }}</code><template v-else>{{ part.text }}</template>
        </template>
      </p>
      <p v-if="row.detail" class="cfg-row__detail">
        <template v-for="(part, i) in textTokens(row.detail)" :key="i">
          <code v-if="part.code" class="cfg-token">{{ part.text }}</code><template v-else>{{ part.text }}</template>
        </template>
      </p>
      <router-link
        v-if="isInternalFix(row.fix_url)"
        :to="row.fix_url"
        class="cfg-row__fix"
        data-testid="config-health-fix"
        @click="emit('close')"
      >
        {{ $t("config_health.fix") }}
      </router-link>
      <a
        v-else-if="row.fix_url"
        :href="safeHref(row.fix_url)"
        target="_blank"
        rel="noopener noreferrer"
        class="cfg-row__fix"
        data-testid="config-health-fix"
      >
        {{ $t("config_health.fix") }}
      </a>
    </div>

    <ul
      v-if="store.passing.length"
      class="cfg-grid"
      data-testid="config-health-passing"
    >
      <li v-for="row in store.passing" :key="row.code" class="cfg-grid__item">
        <FontAwesomeIcon :icon="$icons.success" class="cfg-grid__tick" />{{
          checkName(row.code)
        }}
        <span v-if="row.state === 'disabled'" class="cfg-grid__state" data-testid="config-health-switched-off">{{
          $t("config_health.switched_off")
        }}</span>
      </li>
    </ul>

    <div class="cfg-panel__foot">
      <span class="cfg-panel__age">{{ checkedAgo }}</span>
      <BasicButton
        variant="secondary"
        :disabled="store.checking"
        data-testid="config-health-recheck"
        @click="store.recheck()"
      >
        {{ $t("config_health.check_again") }}
      </BasicButton>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { t } from "@/i18n";
import { useConfigHealthStore } from "@/stores/configHealth";
import { checkName, checkText, isInternalFix, textTokens } from "@/utils/configHealth";
import { safeHref } from "@/utils/safeHref";

// The configuration-health panel (BasicMenu `panel` mode in ConfigHealthButton: the menu anchors it, names it and
// closes it on Esc; `sheet`: a wide popover on desktop, a bottom sheet on a phone). `close` asks the menu to close: the
// close button, and a fix link. A check reads top-down: the title, the detail, then "How to fix" under them.
const emit = defineEmits(["close"]);
const store = useConfigHealthStore();

const checkedAgo = computed(() => {
  if (!store.checkedAt) return "";
  const minutes = Math.floor(
    (Date.now() - new Date(store.checkedAt).getTime()) / 60000
  );
  return minutes < 1
    ? t("config_health.checked_now")
    : t("config_health.checked_ago", { minutes });
});
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/touch-target";

.cfg-panel {
  width: 30rem;
  max-width: 100%;
  max-height: 60vh;
  overflow-y: auto;

  @include max-tablet {
    width: 100%;
    max-height: none;
  }
}
.cfg-panel__head {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-2) var(--space-2) var(--space-4);
  background: var(--surface-raised);
  border-bottom: 1px solid var(--border-subtle);
}
.cfg-panel__title {
  margin: 0;
  font-weight: 600;
}
.cfg-panel__ok {
  margin: 0;
  padding: var(--space-4);
  color: var(--text-secondary);
}
.cfg-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  border-left: 3px solid var(--warning);
  color: var(--text-body);
}
.cfg-row--high {
  border-left-color: var(--negative);
}
// A long word that is no token (DEBUG, a hostname or a path without a scheme) still breaks when it cannot fit the line.
.cfg-row__title,
.cfg-row__detail {
  overflow-wrap: break-word;
}
.cfg-row__title {
  margin: 0;
  font-size: var(--fs-400);
  font-weight: 600;
  line-height: 1.4;
}
.cfg-row__detail {
  margin: 0;
  font-size: var(--fs-300);
  color: var(--text-secondary);
}
// Only an env-var name or a URL may break mid-word; the words around it wrap between words.
.cfg-token {
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}
// A phone opens the panel as a sheet: the link keeps a 40 px hit area there.
.cfg-row__fix {
  @include touch-target;

  display: inline-flex;
  align-items: center;
  min-height: var(--space-8);
  font-size: var(--fs-300);
  font-weight: 600;
  color: var(--text-accent);
}
.cfg-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-4);
  margin: 0;
  padding: var(--space-3) var(--space-4);
  list-style: none;
  font-size: var(--fs-200);
  color: var(--text-muted);
}
.cfg-grid__tick {
  margin-right: var(--space-1);
  color: var(--positive);
}
.cfg-grid__state {
  margin-left: var(--space-1);
  color: var(--text-secondary);
}
.cfg-panel__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-4);
  border-top: 1px solid var(--border-subtle);
}
.cfg-panel__age {
  font-size: var(--fs-200);
  color: var(--text-muted);
}
/* Phone: the close button keeps its 32 px box inside a 40 px hit area (BasicButton clips, so it stops clipping). */
.cfg-panel__head .button-basic--icon {
  @include touch-target;
  @include max-tablet {
    overflow: visible;
  }
}
</style>
