<template>
  <section class="intel" data-testid="intel-card">
    <div class="intel__head">
      <BasicButton variant="ghost" :aria-expanded="String(open)" data-testid="intel-toggle" @click="open = !open">
        {{ $t("leads.intel.title") }}
        <FontAwesomeIcon :icon="open ? $icons.collapse : $icons.expand" class="ml-2" />
      </BasicButton>
    </div>
    <div v-if="open" class="intel__body" data-testid="intel-body">
      <p v-if="context.platform" class="intel__fact">
        {{ $t("leads.intel.platform") }}: <strong>{{ context.platform }}</strong>
      </p>
      <p v-if="context.industry" class="intel__fact">
        {{ $t("leads.intel.industry") }}: <strong>{{ context.industry }}</strong>
      </p>
      <ul v-if="hooks.length" class="intel__hooks">
        <li v-for="(hook, i) in hooks" :key="i">
          <strong>{{ hook.challenge }}</strong>
          <span v-if="hook.business_cost"> — {{ hook.business_cost }}</span>
        </li>
      </ul>
      <p v-else class="intel__fact" data-testid="intel-no-hooks">{{ $t("leads.intel.no_hooks") }}</p>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from "vue";

// Intel and hooks of a company (render_context of a draft or the leads company payload).
const props = defineProps({
  context: { type: Object, default: () => ({}) },
  expanded: { type: Boolean, default: false },
});
const open = ref(props.expanded);
const hooks = computed(() => props.context?.hooks || []);
</script>

<style scoped>
.intel {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface-base);
}
.intel__head {
  padding: var(--space-2) var(--space-5);
}
.intel__body {
  padding: 0 var(--space-8) var(--space-8);
}
.intel__fact {
  margin: 0 0 var(--space-2);
}
.intel__hooks {
  margin: 0;
  padding-left: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
