<template>
  <div>
    <FormField :label="$t('pim.price')" required :error="formErrors.getFieldError('value')?.msg || ''">
      <BasicInput v-model="form.price_net" />
    </FormField>
    <FormField label="Stock">
      <NumberInput v-model="form.qty" :max="500" />
    </FormField>
    <FormField :label="$t('pim.ean')">
      <basic-input v-model="form.ean" maxlength="14" inputmode="numeric" />
    </FormField>
    <BasicTextarea v-model="form.description_t9n[lang]" :placeholder="$t('pim.description')" />
    <input v-model="search" type="search" placeholder="Search" />
    <input v-model="form.is_active" type="checkbox" />
  </div>
</template>

<script setup>
import { reactive } from "vue";
import { PATCH_Product, GET_Products as listProducts } from "@/api/pim/api";

const form = reactive({ price_net: "", qty: 0, ean: "", description_t9n: {}, is_active: true });

function save(formErrors) {
  if (!formErrors.validateRequired(form, { ean: "EAN" })) return;
  return PATCH_Product("default", "SKU-1", { value: form.price_net, ean: form.ean });
}
</script>
