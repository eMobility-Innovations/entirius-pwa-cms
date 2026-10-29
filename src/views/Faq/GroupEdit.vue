<template>
  <PageLayout class="fs-300 t-body">
    <template v-if="!loading" #header>
      <PageHeader
        :title="isEdit ? String(group.name || group.idx || '') : $t('faq.create_group')"
        back="/faq/groups"
      >
        <template #actions>
          <div class="flex ai-ct jc-fe wrap gap-3">
            <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
            <BasicSwitch
              :label="$t('faq.is_active')"
              v-model="form.is_active"
            />
            <ActionBar :actions="headerActions" />
          </div>
        </template>
      </PageHeader>
    </template>
      <Loader block v-if="loading" />

      <template v-else>
        <BasicCard :title="$t('faq.group_details')" gap class="mb-8">
          <div class="form-grid">
            <FormField
              :label="$t('faq.idx')"
              required
              hint-level="important"
              :hint="$t('faq.idx_hint')"
              :error="formErrors.getFieldError('idx')?.msg || ''"
            >
              <BasicInput
                v-model="form.idx"
                :disabled="isEdit"
              />
            </FormField>
            <FormField :label="$t('faq.name')" required :error="formErrors.getFieldError('name')?.msg || ''">
              <BasicInput
                v-model="form.name"
              />
            </FormField>
            <FormField
              :label="$t('faq.channels')"
              :hint="$t('faq.channels_hint')"
              :error="formErrors.getFieldError('channel_ids')?.msg || ''"
            >
              <BasicSelect
                v-model="form.channel_ids"
                multiple
                :options="channelOptions"
                :placeholder="$t('faq.global')"
              />
            </FormField>
          </div>
        </BasicCard>

        <!-- Items in this group — drag to reorder, add existing -->
        <BasicCard v-if="isEdit" :title="$t('faq.items_in_group')" gap class="mb-8">
          <template #actions>
            <BasicSelect
              :options="unassignedItemOptions"
              :model-value="null"
              :placeholder="$t('faq.add_existing_item')"
              :aria-label="$t('faq.add_existing_item')"
              class="add-item-select"
              @update:model-value="addItemToGroup"
            />
          </template>

          <p v-if="!groupItems.length" class="fs-200 t-muted">
            {{ $t("faq.no_items_in_group") }}
          </p>

          <draggable
            v-else
            v-model="groupItems"
            :disabled="readonly"
            item-key="id"
            handle=".drag-handle"
            ghost-class="bg-accent-subtle"
            :force-fallback="true"
            fallback-class="drag-ghost"
            @end="onReorderItems"
          >
            <template #item="{ element }">
              <div class="item-row flex ai-ct gap-5">
                <font-awesome-icon
                  :icon="$icons.drag"
                  class="drag-handle t-muted"
                />
                <router-link
                  :to="`/faq/items/${element.id}`"
                  class="flex-1 item-row__question"
                >
                  {{ element.question }}
                </router-link>
                <StatusBadge
                  :label="element.is_active ? $t('faq.active') : $t('faq.inactive')"
                  :tone="element.is_active ? 'positive' : 'negative'"
                />
                <IconButton mutates
                  icon="close"
                  :label="$t('faq.remove_from_group')"
                  variant="danger"
                  size="sm"
                  @click="removeItemFromGroup(element)"
                />
              </div>
            </template>
          </draggable>
        </BasicCard>
      </template>

    <ConfirmDialog
      tone="danger"
      :open="showDeleteConfirm"
      @confirm="deleteGroup"
      @cancel="showDeleteConfirm = false"
      :title="$t('faq.confirm_delete_title')"
    >
      <template #default>
        <p>{{ $t("faq.confirm_delete_group") }}</p>
      </template>
    </ConfirmDialog>

    <!-- Translations drawer (group has only 'name' to translate) -->
    <TranslationsDrawer
      :visible="showTranslationsDrawer"
      :title="group.name || group.idx || ''"
      :languages="channelLanguages"
      :default-language="defaultLang"
      :values="t9nValues"
      @cancel="showTranslationsDrawer = false"
      @save="onTranslationsSave"
    />

    <ConfirmDialog
      :open="!!pendingNav"
      @confirm="saveAndLeave"
      @discard="confirmLeave"
      @cancel="cancelLeave"
      :title="$t('unsaved.title')"
      :message="$t('unsaved.message')"
      :confirm-label="$t('unsaved.save_and_leave')"
      :discard-label="$t('unsaved.discard')"
    />
  </PageLayout>
</template>

<script>
import draggable from "vuedraggable";
import { usePageReadonly } from "@/composables/useReadonly";
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { useFormErrors, extractApiMessage } from "@/composables/useFormErrors";
import {
  GET_FaqGroup,
  POST_FaqGroup,
  PATCH_FaqGroup,
  DELETE_FaqGroup,
  GET_FaqGroupTranslations,
  POST_FaqGroupTranslation,
  PATCH_FaqGroupTranslation,
  GET_FaqChannels,
  GET_FaqItems,
  PATCH_FaqItem,
  PATCH_FaqItemsReorder,
} from "@/api/faq/api";

export default {
  name: "FaqGroupEdit",
  components: { draggable },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const unsaved = useUnsavedChanges();
    const formErrors = useFormErrors();
    // The page's read-only mode reaches the drag (FormField and the buttons follow it on their own).
    return { loader, notify, ...unsaved, formErrors, readonly: usePageReadonly() };
  },
  data() {
    return {
      group: {},
      channels: [],
      translations: [],
      groupItems: [],
      allItems: [],
      loading: false,
      showDeleteConfirm: false,
      showTranslationsDrawer: false,
      form: {
        idx: "",
        name: "",
        channel_ids: [],
        is_active: true,
      },
    };
  },
  computed: {
    channel() {
      return process.env.VUE_APP_CHANNEL;
    },
    isEdit() {
      return !!this.$route.params.id;
    },
    headerActions() {
      return [
        ...(this.isEdit && this.channelLanguages.length > 0
          ? [{ key: "translations", role: "utility", icon: "translate", label: this.$t("faq.translations"),
              onClick: () => (this.showTranslationsDrawer = true) }]
          : []),
        ...(this.isEdit
          ? [{ key: "delete", role: "utility", icon: "delete", variant: "danger", label: this.$t("common.delete"),
              onClick: () => (this.showDeleteConfirm = true) }]
          : []),
        { key: "save", role: "primary", label: this.$t("common.save"), onClick: this.saveGroup },
      ];
    },
    channelOptions() {
      return this.channels.map((ch) => ({
        label: ch.name || ch.idx,
        value: ch.id,
      }));
    },
    unassignedItemOptions() {
      const groupItemIds = new Set(this.groupItems.map((i) => i.id));
      return this.allItems
        .filter((i) => !groupItemIds.has(i.id))
        .map((i) => ({
          label: i.question,
          value: i.id,
        }));
    },
    channelLanguages() {
      const langs = new Set();
      for (const ch of this.channels) {
        if (ch.language_codes) {
          for (const code of ch.language_codes) langs.add(code);
        }
      }
      return Array.from(langs);
    },
    defaultLang() {
      const ch = this.channels.find((c) => c.idx === this.channel);
      return ch?.default_language || this.channelLanguages[0] || "en";
    },
    t9nValues() {
      const vals = {};
      for (const t9n of this.translations) {
        vals[t9n.language] = t9n.name || "";
      }
      return vals;
    },
  },
  watch: {
    form: {
      deep: true,
      handler() {
        if (this.formErrors.hasErrors) this.formErrors.clearErrors();
      },
    },
  },
  beforeRouteLeave(to, from, next) {
    this.guardNavigation(to, from, next);
  },
  async mounted() {
    await this.fetchChannels();
    if (this.isEdit) {
      await this.fetchGroup();
      await Promise.all([
        this.fetchTranslations(),
        this.fetchGroupItems(),
        this.fetchAllItems(),
      ]);
    } else {
      this.snapshot(this.form);
      this.track(this.form);
    }
  },
  methods: {
    async fetchChannels() {
      try {
        const { data } = await GET_FaqChannels({ page_size: 100 });
        this.channels = Array.isArray(data) ? data : data.results || [];
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async fetchGroup() {
      this.loading = true;
      try {
        const { data } = await GET_FaqGroup(this.channel, this.$route.params.id);
        this.group = data;
        this.resetForm(data);
        this.snapshot(this.form);
        this.track(this.form);
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loading = false;
      }
    },
    resetForm(data) {
      this.form = {
        idx: data.idx || "",
        name: data.name || "",
        channel_ids: data.channel_ids || [],
        is_active: data.is_active ?? true,
      };
    },
    async fetchTranslations() {
      try {
        const { data } = await GET_FaqGroupTranslations(this.channel, this.$route.params.id);
        this.translations = data.results || data || [];
      } catch {
        // Non-critical
      }
    },
    async fetchGroupItems() {
      try {
        const { data } = await GET_FaqItems(this.channel, {
          group: this.$route.params.id,
          page_size: 100,
        });
        this.groupItems = data.results || [];
      } catch {
        // Non-critical
      }
    },
    async fetchAllItems() {
      try {
        const { data } = await GET_FaqItems(this.channel, { page_size: 200 });
        this.allItems = data.results || [];
      } catch {
        // Non-critical
      }
    },
    async addItemToGroup(itemId) {
      try {
        await PATCH_FaqItem(this.channel, itemId, {
          group_idx: this.group.idx,
        });
        await this.fetchGroupItems();
        await this.fetchAllItems();
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("faq.item_added_to_group"),
        });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async removeItemFromGroup(item) {
      try {
        await PATCH_FaqItem(this.channel, item.id, { group_idx: null });
        await this.fetchGroupItems();
        await this.fetchAllItems();
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("faq.item_removed_from_group"),
        });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async onReorderItems() {
      try {
        const ordered_pks = this.groupItems.map((i) => i.id);
        await PATCH_FaqItemsReorder(this.channel, {
          ordered_pks,
          within_group: true,
        });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("faq.reorder_saved"),
        });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async onTranslationsSave({ values }) {
      this.loader.loaderStart();
      try {
        const existingLangs = new Set(this.translations.map((t) => t.language));
        for (const lang of this.channelLanguages) {
          const name = values[lang] || "";
          if (existingLangs.has(lang)) {
            await PATCH_FaqGroupTranslation(this.channel, this.$route.params.id, lang, { name });
          } else if (name) {
            await POST_FaqGroupTranslation(this.channel, this.$route.params.id, { language: lang, name });
          }
        }
        await this.fetchTranslations();
        this.showTranslationsDrawer = false;
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("faq.translations_saved"),
        });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    async saveAndLeave() {
      await this.saveGroup();
      this.confirmLeave();
    },
    async saveGroup() {
      const valid = this.formErrors.validateRequired(this.form, {
        idx: this.$t("faq.idx"),
        name: this.$t("faq.name"),
      });
      if (!valid) return;

      this.loader.loaderStart();
      try {
        const payload = {
          idx: this.form.idx,
          name: this.form.name,
          channel_ids: this.form.channel_ids,
          is_active: this.form.is_active,
        };
        if (this.isEdit) {
          await PATCH_FaqGroup(this.channel, this.$route.params.id, payload);
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("faq.group_saved"),
          });
          await this.fetchGroup();
        } else {
          const { data } = await POST_FaqGroup(this.channel, payload);
          this.notify.spawnNotification({
            type: "positive",
            msg: this.$t("faq.group_created"),
          });
          this.$router.push(`/faq/groups/${data.idx}`);
        }
      } catch (err) {
        this.formErrors.handleApiError(err);
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    async deleteGroup() {
      this.showDeleteConfirm = false;
      this.loader.loaderStart();
      try {
        await DELETE_FaqGroup(this.channel, this.$route.params.id);
        this.snapshot(this.form);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("faq.group_deleted"),
        });
        this.$router.push("/faq/groups");
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.add-item-select {
  min-width: 250px;
  max-width: 400px;
}

.item-row {
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.1s;

  &:hover {
    background: var(--surface-raised);
  }
}

.item-row__question {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drag-handle {
  cursor: grab;
  flex-shrink: 0;

  &:active {
    cursor: grabbing;
  }
}

</style>
