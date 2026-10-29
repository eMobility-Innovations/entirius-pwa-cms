<template>
  <div>
    <div class="">
      <div class="flex jc-sb ai-ct mb-2">
        <p v-if="label">{{ label }}</p>
        <BasicTooltip
          v-if="value"
          class="t-accent fs-200"
          :text="$t('controllers.tooltip_select_group')"
          variant="help"
        >
        </BasicTooltip>
        <!-- Why the items menu is disabled: content, visible with hints off too. -->
        <p v-else class="t-muted fs-200 m-0">{{ $t('controllers.tooltip_add_group') }}</p>
      </div>
      <div class="flex gap-2">
        <BasicButton
          :variant="mode ? 'primary' : 'secondary'"
          class="rounded fs-200"
          @click="!mode ? (mode = 'add') : (mode = null)"
        >
          {{ !mode ? $t('routes.set_new') : $t('common.close') }}
        </BasicButton>

        <BasicMenu class="fg-1" :label="$t('controllers.set_items')">
          <template #trigger>
            <BasicButton variant="secondary" class="w-100 fs-200" :disabled="!Boolean(value)">
              {{
                `${$t('controllers.set_items')} (${!value ? [].length : value.length}${
                  group_rules && group_rules.max ? `/${group_rules.max}` : `/${$t('controllers.unlimited')}`
                })`
              }}
            </BasicButton>
          </template>
          <template #panel>
            <div v-if="value && value.length">
              <draggable
                v-model="value_cp"
                ghost-class="bg-accent-fill"
                handle=".dropdown-leaf-group-fields-controller"
                :item-key="(_, idx) => `custom-dropdown-leaf-${idx}`"
              >
                <template #item="{ element, index: idx }">
                  <div
                    class="ph-2 flex jc-sb"
                    @click="
                      () => {
                        on_edit(idx);
                        force_refresh += force_refresh;
                      }
                    "
                  >
                    <p>{{ $t("controllers.position") }}: {{ idx + 1 }}</p>
                    <div class="grid grid-col-2 gap-1">
                      <p
                        class="t-negative"
                        @click.stop="
                          () => {
                            editing = idx;
                            on_delete(idx);
                          }
                        "
                      >
                        {{ $t("common.delete") }}
                      </p>
                      <p
                        class="t-muted dropdown-leaf-group-fields-controller"
                      >
                        {{ $t("controllers.drag") }}
                      </p>
                    </div>
                  </div>
                </template>
              </draggable>
            </div>
          </template>
        </BasicMenu>
      </div>
    </div>
    <div v-if="group && Object.keys(group).length && mode" class="mt-5">
      <div
        class="grid gap-2 ai-fe"
        :class="{
          'grid-col-1': Object.keys(group).length === 1,
          'grid-col-2': Object.keys(group).length === 2,
          'grid-col-3': Object.keys(group).length >= 3,
        }"
      >
        <div
          v-for="(field, key, index) in config['fields']"
          :class="{
            'gc-s-1 gc-e-4': ['BasicWysiwyg'].includes(
              props_handlers[field.type]
            ),
          }"
        >
          <FormField v-if="props_handlers[field.type] === 'BasicInput'" :label="tFieldLabel(key, field.label)" :key="`${force_refresh}-${index}`">
            <BasicInput
              v-model="group[key]"
              class="rounded bg-base mt-8 lh-base-elem"
            />
          </FormField>
          <div
            v-if="props_handlers[field.type] === 'BasicWysiwyg'"
            class="gc-1 gc-4"
          >
            <p class="mb-1">{{ tFieldLabel(key, field.label) }}</p>
            <BasicWysiwyg v-model="group[key]" :key="`wysiwyg-${key}`" />
          </div>
          <FormField v-if="props_handlers[field.type] === 'Dropdown'" :label="tFieldLabel(key, field.label)">
            <BasicSelect
              :model-value="group[key]"
              :options="field.options"
              @update:model-value="
                ($event) => {
                  group[key] = $event;
                  force_refresh += force_refresh;
                }
              "
              :key="`${force_refresh}-${index}`"
            />
          </FormField>
          <div v-if="props_handlers[field.type] === 'Switcher'">
            <p class="mb-1">{{ tFieldLabel(key, field.label) }}</p>
            <BasicSwitch
              class="mv-2"
              :model-value="group[key]"
              @update:model-value="
                (on) => {
                  group[key] = on;
                  force_refresh += force_refresh;
                }
              "
              :key="`${force_refresh}-${index}`"
            />
          </div>
        </div>
      </div>
      <BasicButton
        variant="secondary"
        class="rounded mt-5"
        @click="set_group({ ...group })"
      >
        {{ mode === 'add' ? $t('controllers.add_group') : $t('common.save') }}
      </BasicButton>
    </div>
  </div>
</template>

<script>
import props_handlers from "@/../__client/props/__props_handlers";
import { useNotifyStore } from "@/stores/notify";
import draggable from "vuedraggable";
export default {
  setup() {
    const notify = useNotifyStore();
    return { notify };
  },
  props: {
    config: {
      type: [Object],
      required: true,
    },
    configName: {
      type: String,
      default: null,
    },
    value: {
      type: [Array, Object],
      default: () => [],
    },
    label: {
      type: [String],
      required: false,
    },
  },
  data() {
    return {
      props_handlers,
      mode: null,
      editing: null,
      group: null,
      group_rules: null,
      force_refresh: 1,
    };
  },
  methods: {
    tFieldLabel(key, fallback) {
      if (!this.configName) return fallback;
      const i18nKey = `prop_option.${this.configName}.${key}`;
      const translated = this.$t(i18nKey);
      return translated !== i18nKey ? translated : fallback;
    },
    on_clear() {
      const _config = { ...this.config };
      const { fields = {}, group_rules = null } = _config;
      const entries = Object.entries(fields);
      entries.forEach(([key, config]) => {
        if (!this.group) this.group = {};
        this.group[key] = null;
      });
      this.group_rules = group_rules;
      this.editing = null;
      this.force_refresh += this.force_refresh;
      this.mode = null;
    },
    set_group(group) {
      const _value = this.value ?? [];
      let allow = true;
      if (this.mode === "add" && this.group_rules) {
        const { max = null } = this.group_rules;

        if (max && _value.length === max) {
          this.notify.spawnNotification({
            title: this.$t("controllers.max_group_size"),
            type: "negative",
          });
          return;
        }
      }
      this.mode === "add" ? _value.push(group) : (_value[this.editing] = group);

      this.$emit("onChange", _value);
      this.on_clear();
    },
    on_edit(index) {
      this.editing = index;
      const _group = this.value[index];
      if (!_group) {
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          msg: this.$t("notifications.unexpected_error"),
          type: "negative",
        });
        return;
      }
      this.group = _group;
      this.mode = "edit";
      return;
    },

    on_delete(index) {
      let _value = this.value;
      const _item = _value[this.editing];

      if (!this.editing && !_item) {
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          msg: this.$t("notifications.unexpected_error"),
          type: "negative",
        });

        return;
      }

      _value.splice(this.editing, 1);
      this.$emit("onChange", _value);
      this.on_clear();
    },
  },
  created() {
    this.on_clear();
  },
  computed: {
    value_cp: {
      get: function () {
        return this.value;
      },
      set: function (changed_order) {
        this.$emit("onChange", changed_order);
      },
    },
  },
  components: {
    draggable,
  },
};
</script>
