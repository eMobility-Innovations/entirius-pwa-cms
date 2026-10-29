<template>
  <div>
    <BasicSelect :options="languages" v-model="language" />
    <BasicSelect
      class="w-100"
      data-testid="visibility-select"
      :options="visibilityOptions"
      v-model="form.visibility"
      :disabled="readonly"
    />
    <BasicSelect :options="sortOptions" v-model="sort_by" :placeholder="$t('common.sort')"></BasicSelect>
    <BasicSelect v-if="ready" :options="limits" v-model="limit" @update:model-value="onLimit" />
    <Dropdown :values="channels" :selected="[channelFilter]" aria-labelledby="channel-label" @onSelect="onChannelFilter" />
    <Dropdown :values="statuses" :selected="[status]" @onSelect="onWrongTarget" />
    <BasicSelect :options="scopes" :model-value="scopeChannel" disabled />
    <Dropdown :values="recommendations" :selected="[recommendationFilter || ALL_OPTION]" @onSelect="(v) => (recommendationFilter = v)" />
    <Dropdown :values="kinds" :selected="[]" @onSelect="(v) => addKind(v)" />
    <Dropdown :values="attrs" :custom_droplist="true" :selected="[attr]" @onSelect="(v) => (attr = v)">
      <template #custom><p>custom</p></template>
    </Dropdown>
    <Dropdown :values="modes" :selected="[mode]" :tooltip="hint" @onSelect="(v) => (mode = v)" />
    <Switcher :selected="enabled" @onSelect="toggle" />
  </div>
</template>

<script>
export default {
  data() {
    return { language: null, limit: 20, channelFilter: "", status: "", attr: null, mode: "a" };
  },
  methods: {
    onLimit(value) {
      this.limit = value;
    },
    onChannelFilter(value) {
      this.channelFilter = value;
      this.load();
    },
    onWrongTarget(value) {
      this.other = value;
    },
  },
};
</script>
