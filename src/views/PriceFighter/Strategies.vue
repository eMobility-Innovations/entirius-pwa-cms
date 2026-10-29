<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('pricefighter.strategies')">
        <template #actions>
          <BasicButton
            variant="primary"
            @click="openCreate"
          >
            {{ $t('pricefighter.new_rule') }}
          </BasicButton>
        </template>
      </PageHeader>
    </template>

      <Loader block v-show="loading" />

      <template v-if="!loading">
        <EmptyState
          v-if="!rules.length"
          :title="$t('pricefighter.no_rules')"
          :message="$t('pricefighter.no_rules_desc')"
          icon="pricing"
        />

        <DataTable
          empty-size="md"
          v-else
          :columns="columns"
          :rows="rules"
          row-key="id"
          :empty-text="$t('pricefighter.no_rules')"
          @row-click="openEdit"
        >
          <template #cell-scope="{ row }">
            <span class="fw-600">{{ scopeLabel(row) }}</span>
          </template>
          <template #cell-strategy="{ row }">
            <StatusBadge :label="$t(`pricefighter.recommendation_${row.strategy}`)" :tone="strategyVariant(row.strategy)" />
          </template>
          <template #cell-price_war="{ row }">
            <StatusBadge v-if="row.price_war" :label="$t('pricefighter.active')" tone="negative" />
            <span v-else class="t-muted">—</span>
          </template>
          <template #cell-mode="{ row }">
            {{ row.mode }}
          </template>
        </DataTable>
      </template>

    <BasicModal
      :open="editingRule !== null"
      :title="editingRule?.id ? $t('pricefighter.edit_rule') : $t('pricefighter.new_rule')"
      :actions="ruleActions"
      @close="closeModal"
    >
      <div class="form-grid">
        <FormField :label="$t('pricefighter.scope_type')" hint-level="important" :hint="$t('pricefighter.scope_type_tooltip')">
          <BasicSelect
            :model-value="form.scopeType"
            :options="scopeTypeOptions"
            @update:model-value="onScopeTypeSelect"
          />
        </FormField>

        <FormField
          v-if="form.scopeType === 'sku'"
          :label="$t('pricefighter.sku')"
          required
          :error="formErrors.getFieldError('sku')?.msg || ''"
        >
          <EntitySearchPicker
            :modelValue="form.scopeValue"
            :displayValue="form.scopeDisplay"
            :fetchFn="productFetch"
            :placeholder="$t('pricefighter.search_sku')"
            :manual="pickerDisabled"
            @update:modelValue="form.scopeValue = $event"
            @update:displayValue="form.scopeDisplay = $event"
            @clear="form.scopeValue = ''; form.scopeDisplay = ''"
          />
        </FormField>
        <FormField
          v-else-if="form.scopeType === 'category_idx'"
          :label="$t('pricefighter.category')"
          required
          :error="formErrors.getFieldError('category_idx')?.msg || ''"
        >
          <EntitySearchPicker
            :modelValue="form.scopeValue"
            :displayValue="form.scopeDisplay"
            :fetchFn="categoryFetch"
            :placeholder="$t('pricefighter.search_category')"
            :manual="pickerDisabled"
            @update:modelValue="form.scopeValue = $event"
            @update:displayValue="form.scopeDisplay = $event"
            @clear="form.scopeValue = ''; form.scopeDisplay = ''"
          />
        </FormField>
        <FormField
          v-else
          :label="$t('pricefighter.market')"
          :hint="$t('pricefighter.market_tooltip')"
          required
          :error="formErrors.getFieldError('channel')?.msg || ''"
        >
          <BasicSelect
            :options="channelOptions"
            v-model="form.scopeValue"
          />
        </FormField>

        <FormField
          :label="$t('pricefighter.strategy')"
          hint-level="important"
          :hint="$t('pricefighter.strategy_tooltip')"
          class="form-grid__wide"
        >
          <BasicSelect
            :options="strategyOptions"
            v-model="form.strategy"
          />
        </FormField>

        <div class="form-grid__wide flex ai-ct wrap gap-8">
          <BasicSwitch
            :label="$t('pricefighter.price_war')"
            v-model="form.price_war"
          />
          <BasicSwitch
            :label="$t('pricefighter.mode_authoritative')"
            :hint="$t('pricefighter.mode_v2_note')"
            hint-level="important"
            :model-value="false"
            disabled
          />
        </div>
      </div>
    </BasicModal>

    <ConfirmDialog
      tone="danger"
      :open="showDeleteConfirm"
      @confirm="deleteRule"
      @cancel="showDeleteConfirm = false"
      :title="$t('pricefighter.confirm_delete_title')"
    >
      <template #default><p>{{ $t('pricefighter.confirm_delete_rule') }}</p></template>
    </ConfirmDialog>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from '@/stores/loader'
import { useNotifyStore } from '@/stores/notify'
import { useFormErrors, extractApiMessage } from '@/composables/useFormErrors'
import { usePfChannels } from '@/composables/usePfChannels'
import { useProductFetch, useCategoryFetch } from '@/composables/useEntityFetch'
import { useMuninStore } from '@/stores/munin'
import { GET_PfRules, POST_PfRule, PATCH_PfRule, DELETE_PfRule } from '@/api/pricefighter/api'
import { STRATEGIES, RECOMMENDATION_VARIANTS } from './constants'

const SCOPE_TYPES = ['sku', 'category_idx', 'channel']

function emptyForm() {
  return { scopeType: 'sku', scopeValue: '', scopeDisplay: '', strategy: 'hold', price_war: false }
}

export default {
  name: 'PfStrategies',
  components: {},
  setup() {
    const loader = useLoaderStore()
    const notify = useNotifyStore()
    const formErrors = useFormErrors()
    const { channelOptions, fetchChannels } = usePfChannels()
    const munin = useMuninStore()
    return { loader, notify, formErrors, channelOptions, fetchChannels, munin }
  },
  data() {
    return {
      rules: [],
      loading: false,
      editingRule: null,
      showDeleteConfirm: false,
      form: emptyForm(),
    }
  },
  computed: {
    columns() {
      return [
        { key: 'scope', label: this.$t('pricefighter.scope'), sortable: false, width: '1.6fr' },
        { key: 'strategy', label: this.$t('pricefighter.strategy'), sortable: false, width: '1fr' },
        { key: 'price_war', label: this.$t('pricefighter.price_war'), sortable: false, width: '1fr' },
        { key: 'mode', label: this.$t('pricefighter.mode'), sortable: false, width: '0.8fr' },
      ]
    },
    strategyOptions() {
      return STRATEGIES.map((s) => ({
        value: s,
        label: this.$t(`pricefighter.recommendation_${s}`),
        description: this.$t(`pricefighter.recommendation_${s}_desc`),
      }))
    },
    ruleActions() {
      const actions = [
        { key: 'cancel', label: this.$t('common.cancel'), role: 'secondary', onClick: this.closeModal },
        { key: 'save', label: this.$t('common.save'), role: 'primary', onClick: this.saveRule },
      ]
      if (!this.editingRule?.id) return actions
      const remove = { key: 'delete', label: this.$t('common.delete'), role: 'utility', icon: 'delete', variant: 'danger' }
      return [{ ...remove, onClick: () => (this.showDeleteConfirm = true) }, ...actions]
    },
    scopeTypeOptions() {
      return SCOPE_TYPES.map((s) => ({ value: s, label: this.$t(`pricefighter.scope_${s}`) }))
    },
    // PIM channel to search products/categories in (SKUs are shared across channels,
    // so any synced channel works). Null when no channel is available.
    searchChannelIdx() {
      return this.channelOptions[0]?.value || null
    },
    // Graceful fallback: no PIM panel or no channel to query → EntitySearchPicker
    // renders a plain free-text input instead of a searchable list.
    pickerDisabled() {
      return !this.searchChannelIdx || !this.munin.isPanelEnabled('pim')
    },
    productFetch() {
      return useProductFetch(this.searchChannelIdx)
    },
    categoryFetch() {
      return useCategoryFetch(this.searchChannelIdx)
    },
  },
  async mounted() {
    await Promise.all([this.fetchRules(), this.fetchChannels()])
  },
  methods: {
    strategyVariant(strategy) {
      return RECOMMENDATION_VARIANTS[strategy] || 'neutral'
    },
    scopeLabel(row) {
      if (row.sku) return `${this.$t('pricefighter.scope_sku')}: ${row.sku}`
      if (row.category_idx) return `${this.$t('pricefighter.scope_category_idx')}: ${row.category_idx}`
      if (row.channel) return `${this.$t('pricefighter.scope_channel')}: ${row.channel}`
      return '—'
    },
    async fetchRules() {
      this.loading = true
      try {
        const { data } = await GET_PfRules({ page_size: 100 })
        this.rules = data.results || []
      } catch (err) {
        this.notify.spawnNotification({
          type: 'negative',
          msg: extractApiMessage(err, this.$t('notifications.error')),
        })
      } finally {
        this.loading = false
      }
    },
    onScopeTypeSelect(value) {
      this.form.scopeType = value
      this.form.scopeValue = ''
      this.form.scopeDisplay = ''
    },
    openCreate() {
      this.form = emptyForm()
      this.formErrors.clearErrors()
      this.editingRule = {}
    },
    openEdit(row) {
      this.editingRule = row
      const scopeType = row.sku ? 'sku' : row.category_idx ? 'category_idx' : 'channel'
      this.form = {
        scopeType,
        scopeValue: row[scopeType] || '',
        scopeDisplay: row[scopeType] || '',
        strategy: row.strategy,
        price_war: row.price_war,
      }
      this.formErrors.clearErrors()
    },
    closeModal() {
      this.editingRule = null
    },
    buildPayload() {
      const payload = { strategy: this.form.strategy, price_war: this.form.price_war }
      payload.sku = this.form.scopeType === 'sku' ? this.form.scopeValue : null
      payload.category_idx = this.form.scopeType === 'category_idx' ? this.form.scopeValue : null
      payload.channel = this.form.scopeType === 'channel' ? this.form.scopeValue : null
      return payload
    },
    async saveRule() {
      if (!this.form.scopeValue) {
        this.notify.spawnNotification({ type: 'negative', msg: this.$t('pricefighter.scope_value_required') })
        return
      }
      this.loader.loaderStart()
      try {
        const payload = this.buildPayload()
        if (this.editingRule.id) {
          await PATCH_PfRule(this.editingRule.id, payload)
        } else {
          await POST_PfRule(payload)
        }
        this.notify.spawnNotification({ type: 'positive', msg: this.$t('notifications.success') })
        this.editingRule = null
        await this.fetchRules()
      } catch (err) {
        this.formErrors.handleApiError(err)
        this.notify.spawnNotification({
          type: 'negative',
          msg: extractApiMessage(err, this.$t('notifications.save_error')),
        })
      } finally {
        this.loader.loaderFinish()
      }
    },
    async deleteRule() {
      this.showDeleteConfirm = false
      this.loader.loaderStart()
      try {
        await DELETE_PfRule(this.editingRule.id)
        this.notify.spawnNotification({ type: 'positive', msg: this.$t('notifications.deleted') })
        this.editingRule = null
        await this.fetchRules()
      } catch (err) {
        this.notify.spawnNotification({
          type: 'negative',
          msg: extractApiMessage(err, this.$t('notifications.error')),
        })
      } finally {
        this.loader.loaderFinish()
      }
    },
  },
}
</script>
