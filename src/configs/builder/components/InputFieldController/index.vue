<template>
  <div class="input-field-controller grid grid-col-3 gap-2">
    <BasicInput class="lh-base-elem" :placeholder="'label'" />
    <BasicSelect
      :floating-label="$t('controllers.field_type')"
      :model-value="null"
      :options="[
        { label: 'text', value: 'text' },
        { label: 'email', value: 'email' },
        { label: 'tel', value: 'tel' },
        { label: 'textarea', value: 'textarea' },
        { label: 'checkbox', value: 'checkbox' },
      ]"
    />
    <BasicSelect
      :floating-label="$t('controllers.field_required')"
      :model-value="null"
      :options="[
        { label: $t('common.required'), value: true },
        { label: $t('common.not_required'), value: false },
      ]"
    />
  </div>
</template>
