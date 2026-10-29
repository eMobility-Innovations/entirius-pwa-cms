<template>
  <PageLayout class="template-list fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('nav.enrichment_settings')" :description="$t('enrichment.templates.description')" :crumbs="[]">
        <template #tabs>
          <RouteTabs :tabs="ENRICHMENT_SETTINGS_TABS" />
        </template>
      </PageHeader>
    </template>

    <div v-bind="tabPanel">
      <Loader v-show="loading" block />

      <DataTable
        v-show="!loading"
        empty-size="md"
        :columns="columns"
        :rows="rows"
        row-key="key"
        :empty-text="$t('enrichment.templates.empty')"
        data-testid="templates-table"
        @row-click="open"
      >
        <template #cell-fields="{ row }">
          <span class="t-secondary">{{ row.fieldsText || "—" }}</span>
        </template>
        <!-- Plain text, not a pill: a bordered pill read as a switch. Offering is changed in the template. -->
        <template #cell-active="{ value }">
          <span class="flex ai-ct gap-2" :class="value ? 't-positive' : 't-muted'">
            <FontAwesomeIcon v-if="value" :icon="$icons.success" aria-hidden="true" />
            {{ value ? $t("enrichment.templates.on") : $t("enrichment.templates.off") }}
          </span>
        </template>
        <template #cell-actions="{ row, index }">
          <div class="flex gap-2">
            <IconButton
              mutates
              icon="moveUp"
              size="sm"
              :label="$t('enrichment.templates.move_up')"
              :disabled="busy || index === 0"
              :data-testid="`template-up-${row.key}`"
              @click="move(index, -1)"
            />
            <IconButton
              mutates
              icon="moveDown"
              size="sm"
              :label="$t('enrichment.templates.move_down')"
              :disabled="busy || index === rows.length - 1"
              :data-testid="`template-down-${row.key}`"
              @click="move(index, 1)"
            />
          </div>
        </template>
      </DataTable>
    </div>

    <FloatingActions :actions="fabActions" />
  </PageLayout>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { extractApiMessage } from "@/composables/useFormErrors";
import { GET_Templates, PATCH_Template } from "@/api/enrichment/api";
import { loadCatalog } from "@/views/EnrichmentReview/fieldCatalog";
import RouteTabs from "@/components/Navigation/RouteTabs.vue";
import { ENRICHMENT_SETTINGS_TABS, routeTabPanel } from "@/components/Navigation/nav-routes";
import { fieldsSummary, reorder } from "./templateList";

// The AI templates of the product catalog in the order the Run AI menu offers them: name, kind of work, fields,
// whether it is offered. Arrows move a template up or down (positions saved at once); a row opens its editor.
export default {
  name: "TemplateList",
  components: { RouteTabs },
  setup() {
    return {
      notify: useNotifyStore(), pimChannel: usePimChannelStore(), ENRICHMENT_SETTINGS_TABS,
      tabPanel: routeTabPanel(ENRICHMENT_SETTINGS_TABS, "EnrichmentTemplates"),
    };
  },
  data() {
    return { templates: [], catalogFields: [], loading: false, busy: false };
  },
  computed: {
    columns() {
      return [
        { key: "label", label: this.$t("enrichment.templates.col_label"), width: "1.5fr" },
        { key: "worker_label", label: this.$t("enrichment.templates.col_worker"), width: "1fr", priority: 2 },
        { key: "fields", label: this.$t("enrichment.templates.col_fields"), width: "1.5fr", priority: 2 },
        { key: "active", label: this.$t("enrichment.templates.col_active"), width: "110px" },
        { key: "actions", label: "", actions: true },
      ];
    },
    rows() {
      return this.templates.map((template) => ({
        ...template,
        fieldsText: fieldsSummary(template, this.catalogFields),
      }));
    },
    fabActions() {
      return [{ icon: "add", label: this.$t("enrichment.templates.create"), handler: this.create }];
    },
  },
  mounted() {
    this.fetchTemplates();
    this.loadFieldNames();
  },
  methods: {
    async fetchTemplates() {
      this.loading = true;
      try {
        const { data } = await GET_Templates({ target_module: "pim" });
        this.templates = [...data].sort((a, b) => a.position - b.position);
      } catch (err) {
        this.failed(err);
      } finally {
        this.loading = false;
      }
    },
    async loadFieldNames() {
      const { fields } = await loadCatalog(this.pimChannel.activeChannelIdx);
      this.catalogFields = fields;
    },
    async move(index, step) {
      if (this.busy) return;
      this.busy = true;
      const { order, changed } = reorder(this.templates, index, step);
      try {
        await Promise.all(changed.map((t) => PATCH_Template(t.key, { position: t.position })));
        this.templates = order;
      } catch (err) {
        this.failed(err);
        await this.fetchTemplates();
      } finally {
        this.busy = false;
      }
    },
    failed(err) {
      this.notify.spawnNotification({ type: "negative", msg: extractApiMessage(err, this.$t("notifications.error")) });
    },
    create() {
      this.$router.push({ name: "EnrichmentTemplateCreate" });
    },
    open(row) {
      this.$router.push({ name: "EnrichmentTemplateEdit", params: { key: row.key } });
    },
  },
};
</script>
