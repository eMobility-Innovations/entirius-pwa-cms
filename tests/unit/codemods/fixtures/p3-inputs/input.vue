<template>
  <div class="form">
    <!-- Switcher → BasicSwitch: the toggle handler becomes v-model; prevent → disabled -->
    <Switcher :label="$t('pim.active')" :selected="form.is_active" @onSelect="form.is_active = !form.is_active" />
    <Switcher
      :label="$t('promo.field_is_active')"
      :hint="$t('promo.hint_is_active')"
      :selected="form.is_active"
      data-testid="promo-active"
      @onSelect="form.is_active = !form.is_active"
    />
    <Switcher :selected="settings.skip" :prevent="saving" @onSelect="settings.skip = !settings.skip" />
    <Switcher :label="$t('pf.mode')" :selected="false" prevent />
    <switcher :selected="flag" @onSelect="flag = !flag"></switcher>

    <!-- flagged: another handler, a negated model, an unknown attribute -->
    <Switcher :label="$t('pim.is_default')" :selected="form.is_default" @onSelect="onToggleDefault" />
    <Switcher :selected="!form.noindex" @onSelect="form.noindex = !form.noindex" />
    <Switcher :selected="on" :tooltip="tip" @onSelect="on = !on" />

    <!-- TextAreaBasic → BasicTextarea: limit → maxlength, isDisabled → disabled -->
    <TextAreaBasic v-model="form.hint" rows="3" :isDisabled="isCarrier" />
    <TextAreaBasic v-model="form.desc" :limit="200" class="mt-2" />

    <!-- flagged: the old value/input API, validate -->
    <TextAreaBasic :value="note" @input="(v) => (note = v)" :validate="rules.note" />

    <!-- LockedField → BasicInput readonly -->
    <FormField :label="$t('pim.idx')">
      <LockedField v-else :model-value="form.idx" />
    </FormField>

    <!-- disabled spellings on BasicInput and NumberInput -->
    <BasicInput v-model="form.name" :isDisabled="readonly" />
    <BasicInput v-model="form.sku" is-disabled />
    <BasicInput v-model="form.ean" :is_disabled="locked" />
    <NumberInput v-model="form.qty" :min="0" :isDisabled="readonly" />

    <!-- flagged: two disabled spellings, validate, the checkbox array API -->
    <BasicInput v-model="form.x" :isDisabled="a" :disabled="b" />
    <BasicInput v-model="form.email" :validate="rules.email" />
    <BasicCheckbox :values="[{ label: 'A', value: 'a' }]" @onSelect="pick" />

    <!-- a floating label → FormField around the control, with its structure, id and layout -->
    <BasicInput :label="$t('pim.name')" v-model="form.title" class="mb-4" />
    <BasicInput
      v-for="lang in langs"
      :key="lang"
      id="title"
      :label="lang"
      v-model="form.title_t9n[lang]"
      data-testid="title-input"
    />
    <TextAreaBasic v-if="showMeta" label="Opis meta" v-model="form.meta" />
    <BasicInput v-show="advanced" :label="$t('pim.ean')" v-model="form.ean2" style="max-width: 20rem" />
    <LockedField :label="$t('pim.scope')" :model-value="scope" />

    <!-- a label in a FormField: dropped when the field has one, flagged when it has none -->
    <FormField :label="$t('pim.code')">
      <BasicInput :label="$t('pim.code')" v-model="form.code" />
    </FormField>
    <FormField :error="errors.code">
      <BasicInput :label="$t('pim.code')" v-model="form.code2" />
    </FormField>
    <FormField :label="$t('pim.code')">
      <BasicInput label="Kod" id="code" v-model="form.code3" />
    </FormField>

    <!-- a label in a FormField through a wrapper: the field is found, no nested FormField; a static limit binds a number -->
    <FormField :label="$t('pim.code')">
      <div class="flex">
        <BasicInput :label="$t('pim.code')" v-model="form.code4" />
      </div>
    </FormField>
    <TextAreaBasic v-model="form.note" limit="120" />

    <!-- untouched: the new API -->
    <BasicSwitch v-model="form.on" :label="$t('pim.active')" />
    <BasicTextarea v-model="form.body" :maxlength="500" />
    <BasicInput v-model="form.plain" disabled />
  </div>
</template>
