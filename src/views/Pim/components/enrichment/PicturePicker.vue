<template>
  <FormField :label="label" required data-testid="picture-picker">
    <Loader v-if="loading" block data-testid="picture-picker-loading" />
    <p v-else-if="failed" class="fs-200 t-negative m-0" data-testid="picture-picker-failed">
      {{ $t("enrichment.picture_picker.failed") }}
    </p>
    <p v-else-if="!pictures.length" class="fs-200 t-secondary m-0" data-testid="picture-picker-empty">
      {{ $t("enrichment.picture_picker.none") }}
    </p>
    <BasicRadioGroup
      v-else
      layout="tiles"
      :model-value="modelValue"
      :options="options"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <template #option="{ option }">
        <img :src="option.url" :alt="option.label" class="picture-picker__image" loading="lazy" />
        <span v-if="option.isMain" class="picture-picker__badge">{{ $t("enrichment.picture_picker.main") }}</span>
      </template>
    </BasicRadioGroup>
  </FormField>
</template>

<script>
import { GET_SubjectPictures } from "@/api/enrichment/api";
import { resolveMediaUrl } from "@/utils/resolveMediaUrl";

// One required choice among an item's pictures (thumbnails, main marked and picked first), for an AI worker that starts
// from a picture (the `video` kind; the `image` kind next). Loads `GET subjects/pictures/` for `module` / `channel` /
// `subjectRef` and reloads when any of them changes. v-model = the picked picture's `ref` ("" = none: still loading,
// no pictures, or the list failed) — the caller sends it as `params.picture_ref` and keeps Run off while it is "".
// `label` names the choice ("Picture to animate"). `preferred` (a ref) is picked first when the list has it — the
// gallery tile the run was started from.
export default {
  name: "PicturePicker",
  props: {
    modelValue: { type: String, default: "" },
    module: { type: String, default: "pim" },
    channel: { type: String, required: true },
    subjectRef: { type: String, required: true },
    label: { type: String, required: true },
    preferred: { type: String, default: "" },
  },
  emits: ["update:modelValue"],
  data() {
    return { pictures: [], loading: false, failed: false, seq: 0 };
  },
  computed: {
    options() {
      return this.pictures.map((picture, index) => ({
        value: picture.ref,
        label: picture.label || this.$t("enrichment.picture_picker.untitled", { n: index + 1 }),
        url: resolveMediaUrl(picture.url),
        isMain: picture.is_main,
        testid: `picture-picker-item-${picture.ref}`,
      }));
    },
    query() {
      return { module: this.module, channel: this.channel, ref: this.subjectRef };
    },
  },
  watch: {
    query: { immediate: true, handler: "load" },
  },
  methods: {
    async load() {
      const mine = ++this.seq;
      this.loading = true;
      this.failed = false;
      this.$emit("update:modelValue", "");
      try {
        const { data } = await GET_SubjectPictures(this.query);
        if (mine !== this.seq) return;
        this.pictures = Array.isArray(data) ? data : [];
        this.$emit("update:modelValue", this.preselected());
      } catch {
        if (mine !== this.seq) return;
        this.pictures = [];
        this.failed = true;
      } finally {
        if (mine === this.seq) this.loading = false;
      }
    },
    preselected() {
      const pick = (test) => this.pictures.find(test);
      return (pick((picture) => picture.ref === this.preferred) || pick((picture) => picture.is_main) || this.pictures[0])?.ref || "";
    },
  },
};
</script>

<style lang="scss" scoped>
.picture-picker__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.picture-picker__badge {
  position: absolute;
  top: var(--space-1);
  left: var(--space-1);
  padding: 0 var(--space-2);
  border-radius: var(--radius-base);
  font-size: var(--fs-200);
  font-weight: 600;
  color: var(--text-on-accent-fill);
  background: var(--accent-fill);
}
</style>
