<template>
  <div class="form">
    <!-- Switcher → BasicSwitch: the toggle handler becomes v-model; prevent → disabled -->
    <BasicSwitch :label="$t('pim.active')" v-model="form.is_active" />
    <BasicSwitch
      :label="$t('promo.field_is_active')"
      :hint="$t('promo.hint_is_active')"
      v-model="form.is_active"
      data-testid="promo-active"
    />
    <BasicSwitch v-model="settings.skip" :disabled="saving" />
    <BasicSwitch :label="$t('pf.mode')" :model-value="false" disabled />
    <BasicSwitch v-model="flag"></BasicSwitch>

    <!-- flagged: another handler, a negated model, an unknown attribute -->
    <Switcher :label="$t('pim.is_default')" :selected="form.is_default" @onSelect="onToggleDefault" />
    <Switcher :selected="!form.noindex" @onSelect="form.noindex = !form.noindex" />
    <BasicSwitch v-model="on" :tooltip="tip" />

    <!-- TextAreaBasic → BasicTextarea: limit → maxlength, isDisabled → disabled -->
    <BasicTextarea v-model="form.hint" rows="3" :disabled="isCarrier" />
    <BasicTextarea v-model="form.desc" :maxlength="200" class="mt-2" />

    <!-- flagged: the old value/input API, validate -->
    <BasicTextarea :value="note" @input="(v) => (note = v)" :validate="rules.note" />

    <!-- LockedField → BasicInput readonly -->
    <FormField :label="$t('pim.idx')">
      <BasicInput v-else :model-value="form.idx" readonly />
    </FormField>

    <!-- disabled spellings on BasicInput and NumberInput -->
    <BasicInput v-model="form.name" :disabled="readonly" />
    <BasicInput v-model="form.sku" disabled />
    <BasicInput v-model="form.ean" :disabled="locked" />
    <NumberInput v-model="form.qty" :min="0" :disabled="readonly" />

    <!-- flagged: two disabled spellings, validate, the checkbox array API -->
    <BasicInput v-model="form.x" :isDisabled="a" :disabled="b" />
    <BasicInput v-model="form.email" :validate="rules.email" />
    <BasicCheckbox :values="[{ label: 'A', value: 'a' }]" @onSelect="pick" />

    <!-- a floating label → FormField around the control, with its structure, id and layout -->
    <FormField :label="$t('pim.name')">
      <BasicInput v-model="form.title" class="mb-4" />
    </FormField>
    <FormField v-for="lang in langs" :label="lang" :key="lang" id="title">
      <BasicInput
        v-model="form.title_t9n[lang]"
        data-testid="title-input"
      />
    </FormField>
    <FormField v-if="showMeta" label="Opis meta">
      <BasicTextarea v-model="form.meta" />
    </FormField>
    <FormField v-show="advanced" :label="$t('pim.ean')">
      <BasicInput v-model="form.ean2" style="max-width: 20rem" />
    </FormField>
    <FormField :label="$t('pim.scope')">
      <BasicInput :model-value="scope" readonly />
    </FormField>

    <!-- a label in a FormField: dropped when the field has one, flagged when it has none -->
    <FormField :label="$t('pim.code')">
      <BasicInput v-model="form.code" />
    </FormField>
    <FormField :error="errors.code">
      <BasicInput :label="$t('pim.code')" v-model="form.code2" />
    </FormField>
    <FormField :label="$t('pim.code')">
      <BasicInput id="code" v-model="form.code3" />
    </FormField>

    <!-- a label in a FormField through a wrapper: the field is found, no nested FormField; a static limit binds a number -->
    <FormField :label="$t('pim.code')">
      <div class="flex">
        <BasicInput v-model="form.code4" />
      </div>
    </FormField>
    <BasicTextarea v-model="form.note" :maxlength="120" />

    <!-- untouched: the new API -->
    <BasicSwitch v-model="form.on" :label="$t('pim.active')" />
    <BasicTextarea v-model="form.body" :maxlength="500" />
    <BasicInput v-model="form.plain" disabled />
  </div>
</template>
