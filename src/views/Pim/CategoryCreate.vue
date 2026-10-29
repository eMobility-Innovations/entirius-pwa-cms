<template>
  <PageLayout class="fs-300 t-body">
    <template #header>
      <PageHeader :title="$t('pim.create_category')" back="/pim/categories">
        <template #meta>
          <PimChannelSelect />
        </template>
        <template #actions>
          <ActionBar :actions="headerActions" />
        </template>
      </PageHeader>
    </template>

    <BasicCard :title="$t('pim.basic_info')" gap class="mb-8">
      <div class="form-grid">
        <FormField
          label="IDX"
          required
          hint-level="important"
          :hint="$t('pim.category_idx_hint')"
          :error="formErrors.getFieldError('idx')?.msg || ''"
        >
          <BasicInput v-model="form.idx" format="key" :maxlength="128" />
        </FormField>
        <FormField :label="$t('pim.parent')">
          <BasicSelect
            v-model="form.parent_category_idx"
            :options="parentOptions"
            :placeholder="$t('pim.select_parent')"
          />
        </FormField>
        <FormField :label="$t('pim.position')">
          <BasicInput v-model="form.position" type="number" />
        </FormField>
        <FormField :label="$t('pim.status')">
          <BasicSwitch v-model="form.is_active" :label="$t('pim.active')" />
        </FormField>
        <FormField :label="$t('pim.in_menu')">
          <BasicSwitch v-model="form.is_in_menu" :label="$t('pim.show_in_menu')" />
        </FormField>
      </div>
    </BasicCard>

    <BasicCard :title="$t('pim.name')" gap class="mb-8">
      <div class="form-grid">
        <FormField
          v-for="(lang, index) in formLanguages"
          :key="`name-${lang}`"
          :label="langLabel('pim.name', lang)"
          :required="index === 0"
        >
          <BasicInput
            :model-value="form.name_t9n[lang] || ''"
            @update:model-value="(val) => setT9n('name_t9n', lang, val)"
          />
        </FormField>
      </div>
    </BasicCard>

    <BasicCard :title="$t('pim.description')" gap class="mb-8">
      <div class="form-grid">
        <FormField
          v-for="lang in formLanguages"
          :key="`desc-${lang}`"
          :label="langLabel('pim.description', lang)"
        >
          <BasicTextarea
            :model-value="form.description_t9n[lang] || ''"
            @update:model-value="(val) => setT9n('description_t9n', lang, val)"
          />
        </FormField>
      </div>
    </BasicCard>

    <BasicCard :title="$t('pim.seo')" gap class="mb-8">
      <div class="form-grid">
        <FormField
          v-for="lang in formLanguages"
          :key="`meta-title-${lang}`"
          :label="langLabel('meta.meta_title', lang)"
        >
          <BasicInput
            :model-value="form.meta_title_t9n[lang] || ''"
            @update:model-value="(val) => setT9n('meta_title_t9n', lang, val)"
          />
        </FormField>
        <FormField
          v-for="lang in formLanguages"
          :key="`meta-desc-${lang}`"
          :label="langLabel('meta.meta_description', lang)"
        >
          <BasicTextarea
            :model-value="form.meta_description_t9n[lang] || ''"
            @update:model-value="(val) => setT9n('meta_description_t9n', lang, val)"
          />
        </FormField>
      </div>
    </BasicCard>
  </PageLayout>
</template>

<script>
import { useLoaderStore } from "@/stores/loader";

import { useNotifyStore } from "@/stores/notify";
import { usePimChannelStore } from "@/stores/pimChannel";
import { POST_Category, GET_Categories } from "@/api/pim/api";
import { extractApiMessage, useFormErrors } from "@/composables/useFormErrors";
import PimChannelSelect from "./components/PimChannelSelect.vue";

export default {
  name: "CategoryCreate",
  components: { PimChannelSelect },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const pimChannel = usePimChannelStore();
    const formErrors = useFormErrors();
    return { loader, notify, pimChannel, formErrors };
  },
  data() {
    return {
      form: {
        idx: "",
        parent_category_idx: null,
        position: 0,
        is_active: true,
        is_in_menu: true,
        name_t9n: {},
        description_t9n: {},
        meta_title_t9n: {},
        meta_description_t9n: {},
      },
      parentOptions: [],
    };
  },
  computed: {
    channelIdx() {
      return this.pimChannel.activeChannelIdx;
    },
    formLanguages() {
      return this.pimChannel.activeChannelLanguages.length > 0
        ? this.pimChannel.activeChannelLanguages
        : ["en"];
    },
    headerActions() {
      return [{ key: "save", role: "primary", label: this.$t("common.save"), onClick: this.createCategory }];
    },
  },
  watch: {
    "pimChannel.activeChannelIdx"() {
      this.fetchParentCategories();
    },
  },
  mounted() {
    this.fetchParentCategories();
  },
  methods: {
    async fetchParentCategories() {
      try {
        const { data } = await GET_Categories(this.channelIdx, {
          page_size: 100,
        });
        this.parentOptions = [
          { label: this.$t("pim.root_category"), value: null },
          ...(data.results || []).map((cat) => ({
            label: `${cat.name} (${cat.idx})`,
            value: cat.idx,
          })),
        ];
      } catch {
        // Categories may not exist yet
      }
    },
    langLabel(key, lang) {
      return `${this.$t(key)} (${lang.toUpperCase()})`;
    },
    setT9n(field, lang, value) {
      this.form[field] = { ...this.form[field], [lang]: value };
    },
    hasAnyValue(t9nObj) {
      return Object.values(t9nObj || {}).some((v) => !!v);
    },
    async createCategory() {
      const firstLang = this.formLanguages[0];
      if (!this.form.idx || !this.form.name_t9n[firstLang]) {
        this.notify.spawnNotification({
          type: "warning",
          msg: this.$t("pim.idx_and_name_required"),
        });
        return;
      }
      if (!this.formErrors.validateFormats(this.form, { idx: { format: "key" } })) return;

      this.loader.loaderStart();
      try {
        const payload = {
          idx: this.form.idx,
          name_t9n: this.form.name_t9n,
          is_active: this.form.is_active,
          is_in_menu: this.form.is_in_menu,
        };
        if (this.form.parent_category_idx)
          payload.parent_category_idx = this.form.parent_category_idx;
        if (this.form.position)
          payload.position = parseInt(this.form.position, 10);
        if (this.hasAnyValue(this.form.description_t9n)) {
          payload.description_t9n = this.form.description_t9n;
        }
        if (this.hasAnyValue(this.form.meta_title_t9n)) {
          payload.meta_title_t9n = this.form.meta_title_t9n;
        }
        if (this.hasAnyValue(this.form.meta_description_t9n)) {
          payload.meta_description_t9n = this.form.meta_description_t9n;
        }

        const { data } = await POST_Category(this.channelIdx, payload);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.category_created"),
        });
        this.$router.push(`/pim/categories/${data.idx}`);
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.save_error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
  },
};
</script>
