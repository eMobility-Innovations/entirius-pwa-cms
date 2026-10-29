<template>
  <div class="feature-set-edit fs-300 t-body h-100 ov-h flex">
    <PageLayout class="flex-1">
      <template v-if="form.idx || !loading" #header>
        <PageHeader :title="form.name || featureSetIdx" back="/pim/feature-sets">
          <template #meta>
            <PimChannelSelect />
          </template>
          <template v-if="!loading" #actions>
            <div class="flex ai-ct jc-fe wrap gap-3">
              <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
              <ActionBar :actions="headerActions" />
            </div>
          </template>
        </PageHeader>
      </template>

      <BasicCard gap class="mb-8">
        <div class="form-grid">
          <FormField :label="$t('pim.currently_editing')" class="form-grid__wide">
            <BasicSelect
              :options="allSetOptions"
              :model-value="featureSetIdx"
              :placeholder="form.name || featureSetIdx"
              @update:model-value="onSwitchSet"
            />
          </FormField>
          <template v-if="!loading">
            <FormField :label="$t('pim.name')">
              <BasicInput v-model="form.name" :maxlength="256" />
            </FormField>
            <FormField
              :label="$t('pim.internal_desc_label')"
              :hint="$t('pim.internal_desc_tooltip')"
            >
              <BasicInput v-model="form.desc" />
            </FormField>
            <FormField :label="$t('pim.is_default')">
              <BasicSwitch :model-value="form.is_default" @update:model-value="onToggleDefault" />
            </FormField>
          </template>
        </div>
      </BasicCard>

      <Loader block v-if="loading" />

      <template v-else>
        <div class="flex ai-ct flex-wrap gap-5 rg-3 mb-8">
          <ReadonlyOff>
            <BasicInput
              v-model="featureSearch"
              :placeholder="$t('common.start_typing')"
              :aria-label="$t('pim.search_features')"
              icon="search"
              class="flex-1"
            />
          </ReadonlyOff>
          <BasicButton
            variant="secondary"
            :aria-expanded="String(showAddGroup)"
            @click="showAddGroup = true"
          >
            {{ $t('pim.add_attribute_group') }}
          </BasicButton>
        </div>

        <!-- Inline group creation -->
        <BasicCard v-if="showAddGroup" :title="$t('pim.add_attribute_group')" gap class="mb-8">
          <template #actions>
            <IconButton icon="close" :label="$t('common.cancel')" @click="closeAddGroup" />
          </template>
          <div class="form-grid">
            <FormField :label="$t('pim.new_group_name')">
              <div class="flex ai-ct gap-3">
                <BasicInput
                  v-model="newGroupName"
                  :placeholder="$t('pim.group_name_placeholder')"
                  class="flex-1"
                  @on-key-down="createGroup"
                />
                <BasicButton mutates variant="secondary" @click="createGroup">
                  {{ $t('pim.create_group') }}
                </BasicButton>
              </div>
            </FormField>
            <FormField v-if="availableGroupOptions.length" :label="$t('pim.or_add_existing')">
              <BasicSelect
                :options="availableGroupOptions"
                :model-value="null"
                :placeholder="$t('pim.pick_existing_group')"
                searchable
                @update:model-value="onSelectGroup"
              />
            </FormField>
          </div>
        </BasicCard>

        <!-- Default group (ungrouped features) -->
        <BasicCard class="feature-group mb-8">
          <div class="feature-group__header flex ai-ct gap-3">
            <IconButton
              :icon="isCollapsed('__default') ? 'expand' : 'collapse'"
              :label="collapseLabel('__default', $t('pim.default_group'))"
              :aria-expanded="String(!isCollapsed('__default'))"
              size="sm"
              @click="toggleCollapse('__default')"
            />
            <h2 class="feature-group__name">{{ $t("pim.default_group") }}</h2>
            <CountBadge :count="ungroupedFeatures.length" />
          </div>
          <div v-show="!isCollapsed('__default')">
            <draggable
              v-model="ungroupedFeatures"
              :disabled="readonly"
              group="features"
              ghost-class="bg-accent-subtle"
              :force-fallback="true"
              fallback-class="drag-ghost"
              :item-key="(el) => el.feature_idx"
              @change="(evt) => onGroupChange(evt, null)"
            >
              <template #item="{ element }">
                <div
                  v-if="matchesSearch(element)"
                  class="feature-row flex ai-ct jc-sb gap-3"
                >
                  <div class="flex ai-ct gap-3 min-w-0">
                    <FontAwesomeIcon :icon="$icons.drag" class="t-muted" aria-hidden="true" />
                    <span class="fw-500">{{
                      element.feature_name || element.feature_idx
                    }}</span>
                    <StatusBadge
                      :tone="featureTypeTone(element.feature_type)"
                      :dot="false"
                      :label="$t(featureTypeLabel(element.feature_type))"
                    />
                  </div>
                  <div class="flex ai-ct gap-2">
                    <RequiredOverrideControl
                      v-if="requiredPerFeatureSet"
                      :model-value="element.is_required_override ?? null"
                      :feature-required="Boolean(element.feature?.is_required)"
                      :name="element.feature_name || element.feature_idx"
                      :disabled="readonly || element.feature?.scope === 1"
                      @update:model-value="(value) => onRequiredChange(element, value)"
                    />
                    <IconButton
                      icon="edit"
                      :label="$t('common.edit')"
                      size="sm"
                      @click="$router.push(`/pim/features/${element.feature_idx}`)"
                    />
                    <IconButton mutates
                      icon="close"
                      :label="$t('pim.remove_from_set')"
                      variant="danger"
                      size="sm"
                      @click="removeFeature(element.feature_idx)"
                    />
                  </div>
                </div>
              </template>
            </draggable>
            <p v-if="!ungroupedFeatures.length" class="t-muted fs-200 pt-4">
              {{ $t("pim.drag_to_add") }}
            </p>
          </div>
        </BasicCard>

        <!-- Named groups (drag to reorder) -->
        <draggable
          v-model="groups"
          :disabled="readonly"
          ghost-class="bg-accent-subtle"
          handle=".group-drag-handle"
          :item-key="(el) => el.idx"
        >
          <template #item="{ element: group }">
            <BasicCard class="feature-group mb-8">
              <div class="feature-group__header flex ai-ct jc-sb gap-3">
                <div class="flex ai-ct gap-3 min-w-0">
                  <FontAwesomeIcon :icon="$icons.drag" class="group-drag-handle t-muted" aria-hidden="true" />
                  <IconButton
                    :icon="isCollapsed(group.idx) ? 'expand' : 'collapse'"
                    :label="collapseLabel(group.idx, group.name || group.idx)"
                    :aria-expanded="String(!isCollapsed(group.idx))"
                    size="sm"
                    @click="toggleCollapse(group.idx)"
                  />
                  <h2 v-if="renamingGroupIdx !== group.idx" class="feature-group__name">
                    {{ group.name || group.idx }}
                  </h2>
                  <FormField v-else :error="renameError">
                    <BasicInput
                      :model-value="group.name"
                      :maxlength="256"
                      :aria-label="$t('pim.rename')"
                      class="rename-input"
                      focus-on-create
                      @update:model-value="(val) => (group.name = val)"
                      @on-focusout="finishRename(group)"
                      @on-key-down="finishRename(group)"
                      @keydown.esc="cancelRename(group)"
                    />
                  </FormField>
                  <CountBadge :count="group.features.length" />
                </div>
                <BasicMenu
                  :items="groupMenuItems"
                  :label="$t('pim.group_actions', { name: group.name || group.idx })"
                  placement="bottom-end"
                  @select="(item) => onGroupMenu(group, item)"
                >
                  <template #trigger>
                    <IconButton
                      icon="more"
                      size="sm"
                      :label="$t('pim.group_actions', { name: group.name || group.idx })"
                    />
                  </template>
                </BasicMenu>
              </div>
              <div v-show="!isCollapsed(group.idx)">
                <draggable
                  v-model="group.features"
                  :disabled="readonly"
                  group="features"
                  ghost-class="bg-accent-subtle"
                  :force-fallback="true"
                  fallback-class="drag-ghost"
                  :item-key="(el) => el.feature_idx"
                  @change="(evt) => onGroupChange(evt, group.idx)"
                >
                  <template #item="{ element }">
                    <div
                      v-if="matchesSearch(element)"
                      class="feature-row flex ai-ct jc-sb gap-3"
                    >
                      <div class="flex ai-ct gap-3 min-w-0">
                        <FontAwesomeIcon :icon="$icons.drag" class="t-muted" aria-hidden="true" />
                        <span class="fw-500">{{
                          element.feature_name || element.feature_idx
                        }}</span>
                        <StatusBadge
                          :tone="featureTypeTone(element.feature_type)"
                          :dot="false"
                          :label="$t(featureTypeLabel(element.feature_type))"
                        />
                      </div>
                      <div class="flex ai-ct gap-2">
                        <RequiredOverrideControl
                          v-if="requiredPerFeatureSet"
                          :model-value="element.is_required_override ?? null"
                          :feature-required="Boolean(element.feature?.is_required)"
                          :name="element.feature_name || element.feature_idx"
                          :disabled="readonly || element.feature?.scope === 1"
                          @update:model-value="(value) => onRequiredChange(element, value)"
                        />
                        <IconButton
                          icon="edit"
                          :label="$t('common.edit')"
                          size="sm"
                          @click="$router.push(`/pim/features/${element.feature_idx}`)"
                        />
                        <IconButton mutates
                          icon="close"
                          :label="$t('pim.remove_from_set')"
                          variant="danger"
                          size="sm"
                          @click="removeFeature(element.feature_idx)"
                        />
                      </div>
                    </div>
                  </template>
                </draggable>
                <p v-if="!group.features.length" class="t-muted fs-200 pt-4">
                  {{ $t("pim.drag_to_add") }}
                </p>
              </div>
            </BasicCard>
          </template>
        </draggable>
      </template>

      <!-- Default change confirmation -->
      <ConfirmDialog
        :open="showDefaultConfirm"
        :title="$t('pim.default_feature_set')"
        :message="defaultConfirmMessage"
        :confirm-label="$t('common.confirm')"
        :cancel-label="$t('common.cancel')"
        @confirm="confirmDefaultChange"
        @cancel="showDefaultConfirm = false"
      />

      <!-- Delete confirmation -->
      <ConfirmDialog
        tone="danger"
        :open="showDeleteConfirm"
        :title="$t('pim.confirm_delete_title')"
        @confirm="deleteSet"
        @cancel="showDeleteConfirm = false"
      >
        <template #default>
          <p>{{ $t("pim.confirm_delete_feature_set") }}</p>
        </template>
      </ConfirmDialog>

      <!-- Unsaved changes modal -->
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

    <!-- Attribute Library sidebar (full height, right edge) -->
    <SideDrawer
      :visible="true"
      mode="sticky"
      :title="$t('pim.attribute_library')"
      :closable="false"
    >
      <AttributeLibrary
        ref="library"
        :feature-set-idx="featureSetIdx"
        :visible="true"
        @remove-feature="removeFeatureViaDrag"
      />
    </SideDrawer>
  </div>
</template>

<script>
import { inject, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { ReadonlyOff, usePageReadonly } from "@/composables/useReadonly";
import draggable from "vuedraggable";
import {
  GET_FeatureSetGlobal,
  GET_FeatureSetsGlobal,
  PATCH_FeatureSet,
  DELETE_FeatureSet,
  GET_FeatureSetFeaturesGlobal,
  POST_FeatureSetFeatures,
  DELETE_FeatureSetFeatures,
  PATCH_FeatureSetFeaturesReorder,
  GET_AttributesGroups,
  POST_AttributesGroup,
  PATCH_AttributesGroup,
  PATCH_FeatureSetFeature,
} from "@/api/pim/api";
import { featureTypeLabel, featureTypeTone } from "./helpers/pimEnums";
import AttributeLibrary from "./components/AttributeLibrary.vue";
import PimChannelSelect from "./components/PimChannelSelect.vue";
import RequiredOverrideControl from "./components/RequiredOverrideControl.vue";
import { usePimCapabilities, noteFeatureList } from "@/composables/usePimCapabilities";
import { extractApiMessage } from "@/composables/useFormErrors";

export default {
  name: "FeatureSetEdit",
  components: {
    ReadonlyOff,
    draggable,
    AttributeLibrary,
    PimChannelSelect,
    RequiredOverrideControl,
  },
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const unsaved = useUnsavedChanges();
    const isGlobalScope = inject("isGlobalScope", null);
    onMounted(() => {
      nextTick(() => {
        if (isGlobalScope) isGlobalScope.value = true;
      });
    });
    onBeforeUnmount(() => {
      if (isGlobalScope) isGlobalScope.value = false;
    });
    const { requiredPerFeatureSet } = usePimCapabilities();
    // The page's read-only mode reaches the drags and the per-set required control.
    return { loader, notify, requiredPerFeatureSet, ...unsaved, readonly: usePageReadonly() };
  },
  data() {
    return {
      form: { name: "", desc: "", is_default: false, idx: "" },
      featuresInSet: [],
      allGroups: [],
      allSets: [],
      loading: false,
      showDeleteConfirm: false,
      showDefaultConfirm: false,
      showAddGroup: false,
      ungroupedFeatures: [],
      groups: [],
      featureSearch: "",
      renamingGroupIdx: null,
      renameError: "",
      newGroupName: "",
      collapsedGroups: [],
    };
  },
  computed: {
    featureSetIdx() {
      return this.$route.params.idx;
    },
    usedGroupIdxs() {
      return this.groups.map((g) => g.idx);
    },
    availableGroupOptions() {
      return this.allGroups
        .filter((g) => !this.usedGroupIdxs.includes(g.idx))
        .map((g) => ({ label: g.name || g.idx, value: g.idx }));
    },
    allSetOptions() {
      return this.allSets.map((s) => ({
        label: s.name || s.idx,
        value: s.idx,
      }));
    },
    currentDefaultSet() {
      return this.allSets.find(
        (s) => s.is_default && s.idx !== this.featureSetIdx
      );
    },
    defaultConfirmMessage() {
      if (this.form.is_default && this.currentDefaultSet) {
        // Turning ON — warn about demoting the other set
        return this.$t("pim.confirm_set_default", {
          name: this.currentDefaultSet.name || this.currentDefaultSet.idx,
        });
      }
      // Turning OFF
      return this.$t("pim.confirm_unset_default");
    },
    headerActions() {
      return [
        { key: "delete", role: "utility", icon: "delete", variant: "danger", label: this.$t("common.delete"),
          onClick: () => (this.showDeleteConfirm = true) },
        { key: "save", role: "primary", label: this.$t("pim.save_set_config"), onClick: this.save },
      ];
    },
    groupMenuItems() {
      return [
        { key: "rename", label: this.$t("pim.rename"), icon: "edit" },
        { key: "remove", label: this.$t("pim.remove"), icon: "delete", danger: true },
      ];
    },
    filteredUngrouped() {
      if (!this.featureSearch) return this.ungroupedFeatures;
      return this.ungroupedFeatures.filter((f) => this.matchesSearch(f));
    },
  },
  watch: {
    "$route.params.idx"() {
      this.fetchData();
    },
  },
  beforeRouteLeave(to, from, next) {
    this.guardNavigation(to, from, next);
  },
  mounted() {
    this.fetchData();
    this.fetchAllSets();
  },
  methods: {
    featureTypeLabel,
    featureTypeTone,
    async saveAndLeave() {
      await this.save();
      this.confirmLeave();
    },
    onToggleDefault() {
      if (!this.form.is_default && this.currentDefaultSet) {
        // About to become default — warn that another set will lose default
        this.showDefaultConfirm = true;
      } else if (this.form.is_default) {
        // About to turn off default — confirm
        this.showDefaultConfirm = true;
      } else {
        // No other default exists — just toggle
        this.form.is_default = true;
      }
    },
    confirmDefaultChange() {
      this.showDefaultConfirm = false;
      this.form.is_default = !this.form.is_default;
    },
    matchesSearch(feature) {
      if (!this.featureSearch) return true;
      const q = this.featureSearch.toLowerCase();
      return (
        (feature.feature_name || "").toLowerCase().includes(q) ||
        (feature.feature_idx || "").toLowerCase().includes(q)
      );
    },
    filteredGroupFeatures(group) {
      if (!this.featureSearch) return group.features;
      return group.features.filter((f) => this.matchesSearch(f));
    },
    onGroupMenu(group, item) {
      if (item.key === "rename") this.startRename(group);
      else if (item.key === "remove") this.removeGroup(group.idx);
    },
    collapseLabel(groupIdx, name) {
      return this.$t(this.isCollapsed(groupIdx) ? "pim.expand_group" : "pim.collapse_group", { name });
    },
    closeAddGroup() {
      this.showAddGroup = false;
      this.newGroupName = "";
    },
    startRename(group) {
      // A rename still open (an empty name left with an error) gets its old name back first.
      const open = this.groups.find((g) => g.idx === this.renamingGroupIdx);
      if (open) open.name = this._oldGroupName;
      this._oldGroupName = group.name;
      this.renameError = "";
      this.renamingGroupIdx = group.idx;
    },
    cancelRename(group) {
      group.name = this._oldGroupName;
      this.renamingGroupIdx = null;
    },
    async finishRename(group) {
      // Enter and the focus leaving the field both finish; the first one wins. An empty name stays in the field.
      if (this.renamingGroupIdx !== group.idx) return;
      if (!group.name?.trim()) {
        this.renameError = this.$t("pim.required_field");
        return;
      }
      this.renamingGroupIdx = null;
      if (group.name === this._oldGroupName) return;
      const lang = this.$i18n?.locale?.toLowerCase() || "en";
      try {
        const name_t9n = { ...group.name_t9n, [lang]: group.name };
        await PATCH_AttributesGroup(group.idx, { name_t9n });
        group.name_t9n = name_t9n;
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.group_renamed"),
        });
      } catch (err) {
        group.name = this._oldGroupName;
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async createGroup() {
      const name = this.newGroupName.trim();
      if (!name) return;
      const idx = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (!idx) return;
      const lang = this.$i18n?.locale?.toLowerCase() || "en";
      try {
        const { data } = await POST_AttributesGroup({
          idx,
          name_t9n: { [lang]: name },
        });
        this.groups.push({
          idx: data.idx,
          name,
          name_t9n: data.name_t9n || { [lang]: name },
          features: [],
        });
        this.allGroups.push(data);
        this.newGroupName = "";
        this.showAddGroup = false;
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.group_created"),
        });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    toggleCollapse(groupIdx) {
      const idx = this.collapsedGroups.indexOf(groupIdx);
      if (idx >= 0) {
        this.collapsedGroups.splice(idx, 1);
      } else {
        this.collapsedGroups.push(groupIdx);
      }
    },
    isCollapsed(groupIdx) {
      return this.collapsedGroups.includes(groupIdx);
    },
    onSwitchSet(val) {
      this.$router.push(`/pim/feature-sets/${val}`);
    },
    async fetchAllSets() {
      try {
        const { data } = await GET_FeatureSetsGlobal({ page_size: 100 });
        this.allSets = data.results || data || [];
      } catch {
        // non-critical, silently ignore
      }
    },
    async fetchData({ silent = false } = {}) {
      if (!silent) this.loading = true;
      try {
        const [setRes, featRes, groupsRes] = await Promise.all([
          GET_FeatureSetGlobal(this.featureSetIdx),
          GET_FeatureSetFeaturesGlobal(this.featureSetIdx),
          GET_AttributesGroups(),
        ]);
        this.form = {
          name: setRes.data.name || "",
          desc: setRes.data.desc || "",
          is_default: setRes.data.is_default || false,
          idx: setRes.data.idx,
        };
        this.snapshot(this.form);
        this.track(this.form);
        this.featuresInSet = featRes.data.results || featRes.data || [];
        noteFeatureList(this.featuresInSet);
        this.allGroups = groupsRes.data.results || groupsRes.data || [];
        this.buildGroups();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        if (!silent) this.loading = false;
      }
    },
    buildGroups() {
      const ungrouped = [];
      const grouped = {};

      for (const f of this.featuresInSet) {
        // Flatten nested feature object for template access
        const flat = {
          ...f,
          feature_idx: f.feature?.idx || f.feature_idx,
          feature_name: f.feature?.name || f.feature_name,
          feature_type: f.feature?.feature_type ?? f.feature_type,
        };
        const gIdx = flat.attributes_group_idx;
        if (!gIdx) {
          ungrouped.push(flat);
        } else {
          if (!grouped[gIdx]) {
            const grp = this.allGroups.find((g) => g.idx === gIdx);
            grouped[gIdx] = {
              idx: gIdx,
              name: flat.attributes_group_name || (grp && grp.name) || gIdx,
              name_t9n: grp?.name_t9n || {},
              features: [],
            };
          }
          grouped[gIdx].features.push(flat);
        }
      }

      ungrouped.sort((a, b) => (a.position || 0) - (b.position || 0));
      for (const g of Object.values(grouped)) {
        g.features.sort((a, b) => (a.position || 0) - (b.position || 0));
      }

      this.ungroupedFeatures = ungrouped;

      // Preserve empty groups that were added by the user but have no features yet
      const prevGroupIdxs = this.groups.map((g) => g.idx);
      const builtGroups = Object.values(grouped);
      const builtIdxs = new Set(builtGroups.map((g) => g.idx));
      for (const idx of prevGroupIdxs) {
        if (!builtIdxs.has(idx)) {
          const grp = this.allGroups.find((g) => g.idx === idx);
          if (grp) {
            builtGroups.push({
              idx,
              name: grp.name || idx,
              name_t9n: grp.name_t9n || {},
              features: [],
            });
          }
        }
      }
      this.groups = builtGroups;
    },
    async save() {
      this.loader.loaderStart();
      try {
        await PATCH_FeatureSet(this.featureSetIdx, {
          name: this.form.name,
          desc: this.form.desc,
          is_default: this.form.is_default,
        });
        await this.saveReorder();
        this.snapshot(this.form);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.feature_set_saved"),
        });
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    // PIM >= 3.3.0: the override is saved at once (it is not part of the set's Save); a refused change snaps back.
    async onRequiredChange(element, value) {
      const before = element.is_required_override ?? null;
      element.is_required_override = value;
      try {
        const { data } = await PATCH_FeatureSetFeature(this.featureSetIdx, element.feature_idx, { is_required: value });
        element.is_required_override = data.is_required_override ?? value;
        element.is_required = data.is_required ?? element.is_required;
      } catch (err) {
        element.is_required_override = before;
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      }
    },
    async saveReorder() {
      const features = [];
      let position = 100;

      for (const f of this.ungroupedFeatures) {
        features.push({
          feature_idx: f.feature_idx,
          position,
          attributes_group_idx: null,
        });
        position += 100;
      }
      for (const g of this.groups) {
        for (const f of g.features) {
          features.push({
            feature_idx: f.feature_idx,
            position,
            attributes_group_idx: g.idx,
          });
          position += 100;
        }
      }

      if (features.length) {
        await PATCH_FeatureSetFeaturesReorder(this.featureSetIdx, { features });
      }
    },
    async onGroupChange(evt, groupIdx) {
      if (!evt.added) return;
      const el = evt.added.element;
      if (!el._from_library) return;
      // Item dragged from library — add to set, save positions, refresh
      try {
        await POST_FeatureSetFeatures(this.featureSetIdx, {
          features: [
            {
              feature_idx: el.feature_idx,
              position: (this.featuresInSet.length + 1) * 100,
            },
          ],
        });
        await this.saveReorder();
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.feature_added_to_set"),
        });
        await this.fetchData({ silent: true });
        this.$refs.library?.fetchFeatures();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
        await this.fetchData({ silent: true });
        this.$refs.library?.fetchFeatures();
      }
    },
    async removeFeatureViaDrag(featureIdx) {
      try {
        await DELETE_FeatureSetFeatures(this.featureSetIdx, {
          feature_idxs: [featureIdx],
        });
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.feature_removed_from_set"),
        });
        await this.fetchData({ silent: true });
        this.$refs.library?.fetchFeatures();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
        await this.fetchData({ silent: true });
        this.$refs.library?.fetchFeatures();
      }
    },
    async removeFeature(featureIdx) {
      this.loader.loaderStart();
      try {
        await DELETE_FeatureSetFeatures(this.featureSetIdx, {
          feature_idxs: [featureIdx],
        });
        await this.fetchData({ silent: true });
        this.$refs.library?.fetchFeatures();
      } catch (err) {
        this.notify.spawnNotification({
          type: "negative",
          msg: extractApiMessage(err, this.$t("notifications.error")),
        });
      } finally {
        this.loader.loaderFinish();
      }
    },
    onSelectGroup(val) {
      const grp = this.allGroups.find((g) => g.idx === val);
      this.groups.push({
        idx: val,
        name: (grp && grp.name) || val,
        name_t9n: grp?.name_t9n || {},
        features: [],
      });
      this.showAddGroup = false;
    },
    removeGroup(groupIdx) {
      const group = this.groups.find((g) => g.idx === groupIdx);
      if (group) {
        this.ungroupedFeatures.push(...group.features);
      }
      this.groups = this.groups.filter((g) => g.idx !== groupIdx);
    },
    async deleteSet() {
      this.showDeleteConfirm = false;
      this.loader.loaderStart();
      try {
        await DELETE_FeatureSet(this.featureSetIdx);
        this.notify.spawnNotification({
          type: "positive",
          msg: this.$t("pim.feature_set_deleted"),
        });
        this.$router.push("/pim/feature-sets");
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
.feature-group__name {
  margin: 0;
  font-size: var(--fs-300);
  font-weight: 600;
  color: var(--text-strong);
}
.feature-row {
  padding: var(--space-3) 0;
  border-top: 1px solid var(--border-subtle);
  cursor: grab;
  user-select: none;
}
.group-drag-handle {
  cursor: grab;
}
.rename-input {
  max-width: 200px;
}

@media only screen and (max-width: 768px) {
  .feature-set-edit {
    flex-direction: column;
    overflow-y: auto !important;
    overflow-x: hidden !important;

    > .flex-1 {
      overflow: visible !important;
      flex: none !important;
    }

    :deep(.side-drawer-sticky) {
      width: 100% !important;
      min-width: 100% !important;
      flex: none !important;
      overflow: visible !important;
      border-left: none;
      border-top: 1px solid var(--border-subtle);
    }
  }
}
</style>
