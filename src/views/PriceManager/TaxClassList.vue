<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('pm.tax_classes')" />
    </template>
      <Loader block v-show="loading" />

      <div v-show="!loading">
        <DataTable
          :columns="columns"
          :rows="taxClasses"
          :empty-text="$t('pm.no_tax_classes')"
          empty-size="md"
          @row-click="onRowClick"
        >
          <template #cell-idx="{ row }">
            <router-link :to="`/pricing/tax-classes/${encodeURIComponent(row.idx)}`" class="fw-600 t-accent" @click.stop>
              {{ row.idx }}
            </router-link>
          </template>
          <template #cell-name="{ row }">
            <span class="fw-600">{{ row.name }}</span>
          </template>
          <template #cell-rate_count="{ row }">
            <StatusBadge tone="accent" :dot="false" :label="`${row.rate_count ?? 0} ${$t('pm.rate_count')}`" />
          </template>
        </DataTable>
      </div>

      <FloatingActions :actions="fabActions" />
  </PageLayout>
</template>

<script>
import { useLoaderStore } from '@/stores/loader'
import { useNotifyStore } from '@/stores/notify'
import { GET_PmTaxClasses } from '@/api/pricemanager/api'
import { extractApiMessage } from '@/composables/useFormErrors'

export default {
  name: 'PmTaxClassList',
  setup() {
    const loader = useLoaderStore()
    const notify = useNotifyStore()
    return { loader, notify }
  },
  data() {
    return {
      taxClasses: [],
      loading: false,
    }
  },
  computed: {
    columns() {
      return [
        { key: 'idx', label: 'IDX', width: '180px' },
        { key: 'name', label: this.$t('pm.name'), width: '1fr' },
        { key: 'rate_count', label: this.$t('pm.rate_count'), width: '120px' },
      ]
    },
    fabActions() {
      return [
        {
          icon: 'add',
          label: this.$t('pm.create_tax_class'),
          handler: () => this.$router.push('/pricing/tax-classes/create'),
        },
      ]
    },
  },
  mounted() {
    this.fetch()
  },
  methods: {
    async fetch() {
      this.loading = true
      try {
        const { data } = await GET_PmTaxClasses()
        this.taxClasses = Array.isArray(data) ? data : data.results || []
      } catch (err) {
        this.notify.spawnNotification({
          type: 'negative',
          msg: extractApiMessage(err, this.$t('notifications.error')),
        })
      } finally {
        this.loading = false
      }
    },
    onRowClick(row) {
      this.$router.push(`/pricing/tax-classes/${row.idx}`)
    },
  },
}
</script>

<style lang="scss" scoped>
</style>
