<template>
  <div class="gap-detail">
    <Loader v-if="loading" />

    <template v-else>
      <div class="gap-detail__grid">
        <!-- Recommendation components -->
        <div class="gap-detail__block">
          <h4 class="gap-detail__heading">{{ $t('pricefighter.detail_components') }}</h4>
          <dl class="gap-detail__facts">
            <dt>{{ $t('pricefighter.reference_price') }} (R)</dt>
            <dd>{{ fmt(row.reference_price) }} <span class="t-muted fs-200">({{ row.estimator }})</span></dd>
            <dt>{{ $t('pricefighter.baseline') }} (B)</dt>
            <dd>{{ fmt(bounds ? bounds.baseline : row.baseline) }}</dd>
            <dt>{{ $t('pricefighter.floor') }} (F)</dt>
            <dd>{{ fmt(bounds ? bounds.floor : row.floor) }}</dd>
            <dt>{{ $t('pricefighter.current_price') }} (P)</dt>
            <dd>{{ fmt(row.current_price) }}</dd>
            <dt>{{ $t('pricefighter.gap') }} ({{ $t('pricefighter.gap_baseline_short') }})</dt>
            <dd>{{ fmt(row.gap_baseline) }}</dd>
            <dt>{{ $t('pricefighter.gap_current') }}</dt>
            <dd>{{ fmt(row.gap_current) }}</dd>
            <dt>{{ $t('pricefighter.margin') }}</dt>
            <dd>{{ row.margin != null ? `${row.margin}%` : '—' }}</dd>
            <dt>{{ $t('pricefighter.reason') }}</dt>
            <dd>{{ row.reason }}</dd>
            <dt>{{ $t('pricefighter.strategy') }} / {{ $t('pricefighter.mode') }}</dt>
            <dd>{{ row.strategy }} / {{ row.mode }}<span v-if="row.price_war" class="t-negative"> · {{ $t('pricefighter.price_war') }}</span></dd>
          </dl>
        </div>

        <!-- Observations -->
        <div class="gap-detail__block gap-detail__block--wide">
          <h4 class="gap-detail__heading">
            {{ $t('pricefighter.observations') }}
            <StatusBadge :label="`${validCount}/${observations.length} ${$t('pricefighter.valid')}`" tone="info" />
          </h4>
          <p v-if="loadError" class="t-negative fs-200">{{ loadError }}</p>
          <ObservationsTable v-else :observations="observations" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { t } from '@/i18n'
import { GET_PfDecisionDetail, GET_PfBounds } from '@/api/pricefighter/api'
import { extractApiMessage } from '@/composables/useFormErrors'
import { pfFormat } from '../constants'
import ObservationsTable from './ObservationsTable.vue'

const props = defineProps({
  row: {
    type: Object,
    required: true,
  },
})

const loading = ref(true)
const observations = ref([])
const bounds = ref(null)
const loadError = ref('')

const validCount = computed(() => observations.value.filter((o) => o.flag === 'valid').length)

const fmt = pfFormat

onMounted(async () => {
  const market = { channel: props.row.channel_idx, country: props.row.country, currency: props.row.currency }
  try {
    const [detailRes, boundsRes] = await Promise.all([
      GET_PfDecisionDetail(props.row.sku, market),
      GET_PfBounds({ sku: props.row.sku, channel: props.row.channel_idx, country: props.row.country }),
    ])
    observations.value = detailRes.data.observations || []
    bounds.value = boundsRes.data
  } catch (err) {
    observations.value = []
    bounds.value = null
    loadError.value = extractApiMessage(err, t('notifications.error'))
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.gap-detail {
  padding: var(--space-5) 0;
}

.gap-detail__grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-12);
}

.gap-detail__block {
  flex: 1 1 240px;
  min-width: 240px;
}

.gap-detail__block--wide {
  flex: 2 1 420px;
}

.gap-detail__heading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--fs-200);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
  margin: 0 0 var(--space-5) 0;
}

.gap-detail__facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-1) var(--space-5);
  margin: 0;
  font-size: var(--fs-300);

  dt {
    color: var(--text-muted);
  }

  dd {
    margin: 0;
    color: var(--text-body);
    font-weight: 600;
  }
}
</style>
