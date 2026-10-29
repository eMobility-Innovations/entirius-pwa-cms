<template>
  <BasicCard
    class="env-missing absolute fs-300 t-body shadow-down"
  >
    <p class="fs-700 fw-600 txt-center mb-1">Configuration Required</p>
    <p class="fs-300 t-secondary txt-center mb-12">
      Required environment variables are missing. Create a
      <code>.env</code> file to get started.
    </p>

    <div v-if="status.errors.length" class="env-missing__section mb-10">
      <p class="fs-200 fw-600 t-negative mb-5">Missing required</p>
      <div
        v-for="v in status.errors"
        :key="v.key"
        class="env-missing__row p-5 mb-2 rounded bg-negative-subtle"
      >
        <code class="fw-600 t-negative">{{ v.key }}</code>
        <span class="fs-200 t-secondary ml-5">{{ v.description }}</span>
      </div>
    </div>

    <div v-if="status.warnings.length" class="env-missing__section mb-10">
      <p class="fs-200 fw-600 t-warning mb-5">Missing optional</p>
      <div
        v-for="v in status.warnings"
        :key="v.key"
        class="env-missing__row p-5 mb-2 rounded bg-warning-subtle"
      >
        <code class="fw-600 t-warning">{{ v.key }}</code>
        <span class="fs-200 t-secondary ml-5">{{ v.description }}</span>
      </div>
    </div>

    <div class="env-missing__quickstart p-8 rounded bg-raised">
      <p class="fs-200 fw-600 t-body mb-5">Quick start</p>
      <code class="fs-200 t-secondary">cp .env.example .env</code>
      <p class="fs-200 t-muted mt-5">
        Then fill in the required values and restart the dev server.
      </p>
    </div>
  </BasicCard>
</template>

<script setup>
defineProps({
  status: {
    type: Object,
    required: true,
  },
});
</script>

<style lang="scss" scoped>
.env-missing {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 340px;
  max-height: 90vh;
  overflow-y: auto;

  @media screen and (min-width: 768px) {
    width: 530px;
  }

  &__row {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--space-1);

    code {
      font-size: var(--fs-200);
    }
  }

  &__quickstart {
    code {
      display: block;
      font-size: var(--fs-200);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-base);
      background: var(--surface-hover);
      color: var(--text-body);
    }
  }
}
</style>
