<template>
  <PageLayout data-testid="communicator-settings">
    <template #header>
      <PageHeader :title="$t('communicator.settings.title')" :back="{ name: 'LeadsSettings' }" />
    </template>
    <div class="flex-column gap-8">
      <SettingsPolicy />
      <SettingsChannel />
      <SettingsFooter />
      <SettingsScheduled />
      <SettingsSuppressions />
    </div>
  </PageLayout>
</template>

<script setup>
import SettingsChannel from "./settings/SettingsChannel.vue";
import SettingsFooter from "./settings/SettingsFooter.vue";
import SettingsPolicy from "./settings/SettingsPolicy.vue";
import SettingsScheduled from "./settings/SettingsScheduled.vue";
import SettingsSuppressions from "./settings/SettingsSuppressions.vue";
</script>
