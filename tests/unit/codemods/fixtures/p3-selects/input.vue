<template>
  <div>
    <Dropdown :values="languages" :selected="language ? [language] : []" @onSelect="(v) => (language = v)" />
    <Dropdown
      class="w-100"
      data-testid="visibility-select"
      :values="visibilityOptions"
      :selected="[form.visibility]"
      :isDisabled="readonly"
      icon="arrow-right-2"
      @onSelect="(val) => form.visibility = val"
    />
    <Dropdown :values="sortOptions" :selected="[sort_by]" :placeholder="$t('common.sort')" @onSelect="sort_by = $event"></Dropdown>
    <Dropdown v-if="ready" :values="limits" :selected="[limit]" @onSelect="onLimit" />
    <Dropdown :values="channels" :selected="[channelFilter]" aria-labelledby="channel-label" @onSelect="onChannelFilter" />
    <Dropdown :values="statuses" :selected="[status]" @onSelect="onWrongTarget" />
    <Dropdown :values="scopes" :selected="[scopeChannel]" is-disabled />
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
