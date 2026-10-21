<template>
  <div class="scenes-list flex-column gap-4" data-testid="scenes-list">
    <ol class="scenes-list__items m-0">
      <li v-for="(scene, index) in scenes" :key="index" class="scenes-list__scene flex-column gap-2" :data-testid="`scene-${index}`">
        <span class="scenes-list__title">{{ scene.title || $t("enrichment.studio.cover.variant", { n: index + 1 }) }}</span>
        <p class="scenes-list__prompt m-0">{{ scene.prompt }}</p>
        <div v-if="mustShow(scene).length" class="flex-column gap-1" :data-testid="`scene-${index}-must`">
          <span class="scenes-list__label">{{ $t("enrichment.studio.cover.must_show") }}</span>
          <ul class="scenes-list__must m-0">
            <li v-for="(condition, n) in mustShow(scene)" :key="n">{{ condition }}</li>
          </ul>
        </div>
        <dl v-if="scene.alt" class="scenes-list__alt m-0 flex-column gap-1" :data-testid="`scene-${index}-alt`">
          <dt>{{ $t("enrichment.studio.cover.alt") }}</dt>
          <dd class="m-0">{{ scene.alt }}</dd>
        </dl>
      </li>
    </ol>
  </div>
</template>

<script>
// The cover brief: the scenes the AI proposes for the cover (one image each in the next step), each with what the
// picture must get right for this article (added to its image prompt) and its alt text.
// Read-only — a scene is changed with Regenerate and an instruction, before any image is paid for.
export default {
  name: "ScenesList",
  props: {
    proposal: { type: Object, required: true },
  },
  computed: {
    data() {
      return this.proposal.proposed_value?.data || {};
    },
    scenes() {
      return Array.isArray(this.data.scenes) ? this.data.scenes : [];
    },
  },
  methods: {
    mustShow(scene) {
      return Array.isArray(scene.must_show) ? scene.must_show : [];
    },
  },
};
</script>

<style lang="scss" scoped>
.scenes-list__items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--space-4);
  padding: 0;
  list-style: none;
}
.scenes-list__scene {
  padding: var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
}
.scenes-list__title {
  font-weight: 600;
  color: var(--text-strong);
  overflow-wrap: anywhere;
}
.scenes-list__prompt {
  font-size: var(--fs-300);
  line-height: 1.6;
  color: var(--text-body);
  overflow-wrap: anywhere;
}
.scenes-list__label,
.scenes-list__alt dt {
  font-size: var(--fs-250);
  font-weight: 600;
  color: var(--text-secondary);
}
.scenes-list__alt dd {
  color: var(--text-strong);
  overflow-wrap: anywhere;
}
.scenes-list__must {
  padding-left: var(--space-5);
  font-size: var(--fs-300);
  color: var(--text-body);
}
</style>
