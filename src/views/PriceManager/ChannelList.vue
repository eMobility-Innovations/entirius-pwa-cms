<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('pm.channels')">
        <template #actions>
          <ActionBar :actions="headerActions" />
        </template>
      </PageHeader>
    </template>
      <Loader block v-show="loading" />

      <div v-show="!loading">
        <DataTable
          :columns="columns"
          :rows="channels"
          :empty-text="$t('pm.no_channels')"
          empty-size="md"
          @row-click="onRowClick"
        >
          <template #cell-idx="{ row }">
            <router-link :to="`/pricing/channels/${encodeURIComponent(row.idx)}`" class="fw-600 t-accent" @click.stop>
              {{ row.idx }}
            </router-link>
          </template>
          <template #cell-calculate_direction="{ row }">
            <StatusBadge tone="neutral" :dot="false" :label="directionLabel(row)" />
          </template>
          <template #cell-country_count="{ row }">
            <StatusBadge tone="accent" :dot="false" :label="`${row.country_count ?? 0} ${$t('pm.country_count')}`" />
          </template>
        </DataTable>
      </div>

      <FloatingActions :actions="fabActions" />
  </PageLayout>
</template>

<script>
import { useLoaderStore } from '@/stores/loader'
import { useNotifyStore } from '@/stores/notify'
import { GET_PmChannels, POST_PmSyncChannels } from '@/api/pricemanager/api'
import { extractApiMessage } from '@/composables/useFormErrors'

export default {
  name: 'PmChannelList',
  setup() {
    const loader = useLoaderStore()
    const notify = useNotifyStore()
    return { loader, notify }
  },
  data() {
    return {
      channels: [],
      loading: false,
    }
  },
  computed: {
    headerActions() {
      return [{ key: 'sync', role: 'secondary', label: this.$t('pm.sync_channels'), onClick: this.syncChannels }]
    },
    columns() {
      return [
        { key: 'idx', label: 'IDX', width: '200px' },
        { key: 'name', label: this.$t('pm.name'), width: '1fr' },
        { key: 'calculate_direction', label: this.$t('pm.direction'), width: '180px' },
        { key: 'country_count', label: this.$t('pm.country_count'), width: '130px' },
      ]
    },
    fabActions() {
      return [
        {
          icon: 'add',
          label: this.$t('pm.create_channel'),
          handler: () => this.$router.push('/pricing/channels/create'),
        },
      ]
    },
  },
  mounted() {
    this.fetch()
  },
  methods: {
    directionLabel(row) {
      return row.calculate_direction === 'from_net_to_gross' ? this.$t('pm.from_net_to_gross') : this.$t('pm.from_gross_to_net')
    },
    async fetch() {
      this.loading = true
      try {
        const { data } = await GET_PmChannels()
        this.channels = Array.isArray(data) ? data : data.results || []
      } catch (err) {
        this.notify.spawnNotification({
          type: 'negative',
          msg: extractApiMessage(err, this.$t('notifications.error')),
        })
      } finally {
        this.loading = false
      }
    },
    async syncChannels() {
      this.loader.loaderStart()
      try {
        const { data } = await POST_PmSyncChannels()
        this.notify.spawnNotification({
          type: 'positive',
          msg: this.$t('pm.sync_result', {
            synced: data.synced ?? 0,
            created: data.created ?? 0,
            updated: data.updated ?? 0,
          }),
        })
        await this.fetch()
      } catch (err) {
        this.notify.spawnNotification({
          type: 'negative',
          msg: extractApiMessage(err, this.$t('notifications.error')),
        })
      } finally {
        this.loader.loaderFinish()
      }
    },
    onRowClick(row) {
      this.$router.push(`/pricing/channels/${row.idx}`)
    },
  },
}
</script>

<style lang="scss" scoped>
</style>
