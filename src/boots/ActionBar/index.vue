<template>
  <div class="action-bar flex ai-ct" role="group" :aria-label="$t('common.actions')">
    <span v-if="labelled" class="action-bar__label fs-200 t-muted" aria-hidden="true">{{ $t("common.actions") }}</span>
    <div class="action-bar__actions flex ai-ct wrap">
      <template v-for="action in shown" :key="action.key">
        <IconButton
          v-if="action.role === 'utility'"
          :icon="action.icon"
          :label="action.label"
          :variant="action.variant || 'outline'"
          :disabled="action.disabled"
          :data-testid="action.testid"
          @click="action.onClick"
        />
        <BasicButton
          v-else
          :variant="action.role"
          :type="action.form ? 'submit' : 'button'"
          :form="action.form"
          :icon="action.icon"
          :disabled="action.disabled"
          :loading="action.loading"
          :aria-expanded="action.expanded === undefined ? undefined : String(action.expanded)"
          :data-testid="action.testid"
          @click="action.onClick"
        >
          {{ action.label }}
        </BasicButton>
      </template>
      <slot />
    </div>
  </div>
</template>

<script>
// R5 order, left to right; module scope so defineProps can read it. A non-utility role is its BasicButton variant.
const ROLES = ["utility", "secondary", "danger", "primary"];
</script>

<script setup>
// Page and dialog actions in R5 order (docs/ui-rules.md): icon utilities · secondary · danger · primary, right-aligned,
// the one primary rightmost. `actions` = [{ key, label, role, onClick?, form?, icon?, variant?, disabled?, loading?,
// expanded?, testid? }] (`onClick` or `form`) (`variant` = the IconButton variant of a utility, `outline` by default; `danger` for an icon-only delete;
// `expanded` = aria-expanded of a text button that shows or hides a section; `form` = the id of a form the button
// submits from outside it — native checks, the form's own submit handler, and Enter in a field presses it); a
// caller with its own controls passes them in the default slot, already in R5 order. Below the shell breakpoint the
// bar takes its own row with the visible label "Akcje" (Figma S7). On a read-only page (useReadonly, plan 19) only the
// utilities stay — and of those not a `danger` one; `mutates` (true/false) overrides the role. The default slot is the
// caller's. `labelled` false drops the "Akcje" caption where the actions already sit in their own footer (a dialog).
import { computed, watchEffect } from "vue";
import IconButton from "@/boots/IconButton/index.vue";
import { useReadonly } from "@/composables/useReadonly";

const props = defineProps({
  actions: {
    type: Array,
    default: () => [],
    // A utility is an IconButton: it needs its icon.
    validator: (value) =>
      value.every(
        (action) =>
          action.key && action.label && ROLES.includes(action.role) && (action.role !== "utility" || action.icon)
      ),
  },
  labelled: { type: Boolean, default: true },
});

const readonly = useReadonly();
// `mutates` decides when the caller sets it (`false` keeps a Cancel or a section toggle on a read-only page).
const writes = (action) => action.mutates ?? (action.role !== "utility" || action.variant === "danger");

const shown = computed(() =>
  props.actions
    .filter((action) => !(readonly.value && writes(action)))
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role))
);

watchEffect(() => {
  const primaries = props.actions.filter((action) => action.role === "primary").length;
  if (process.env.NODE_ENV !== "production" && primaries > 1) {
    console.warn(`ActionBar: ${primaries} primary actions, one at most (docs/ui-rules.md R5).`);
  }
});
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

.action-bar {
  justify-content: flex-end;
}

.action-bar__actions {
  justify-content: flex-end;
  gap: var(--space-3);
}

.action-bar__label {
  display: none;
}

// Figma S7: the label on its own line, 12 px above one left-aligned row of actions 8 px apart.
@include max-tablet {
  .action-bar {
    flex-basis: 100%;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    gap: var(--space-3);
  }

  .action-bar__label {
    display: inline;
  }

  .action-bar__actions {
    justify-content: flex-start;
    gap: var(--space-2);
  }
}
</style>
