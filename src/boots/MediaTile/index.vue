<template>
  <figure
    class="media-tile flex-column"
    :class="{ 'media-tile--selected': selected }"
    :tabindex="$slots.actions ? 0 : undefined"
    :role="$slots.actions ? 'group' : undefined"
    :aria-label="$slots.actions ? caption || alt || undefined : undefined"
  >
    <div class="media-tile__image flex jc-ct ai-ct">
      <img v-if="src" :src="src" :alt="alt" loading="lazy" />
      <FontAwesomeIcon
        v-else
        :icon="video ? $icons.video : $icons.image"
        class="media-tile__placeholder"
        aria-hidden="true"
      />
      <span v-if="video" class="media-tile__play flex jc-ct ai-ct" aria-hidden="true">
        <FontAwesomeIcon :icon="$icons.play" />
      </span>
      <div v-if="$slots.overlay" class="media-tile__overlay media-tile__reveal flex flex-wrap gap-1">
        <slot name="overlay" />
      </div>
    </div>
    <figcaption v-if="caption || $slots.actions" class="media-tile__footer flex ai-ct jc-sb gap-2">
      <span class="media-tile__caption" :title="caption || undefined">{{ caption }}</span>
      <span v-if="$slots.actions" class="media-tile__reveal media-tile__actions flex gap-1">
        <slot name="actions" />
      </span>
    </figcaption>
  </figure>
</template>

<script setup>
// An image tile of a media grid: 188 wide (150 below tablet) around a square image; the footer adds its own height.
// Figma S9/S10 drew it 188 × 276 — the portrait image read too tall in a grid. No `src` = the image
// placeholder. `selected` draws the accent border. The `actions` slot takes IconButtons (`sm`), the `overlay` slot
// value chips (`Tag`) over the bottom of the image; both show on hover, keyboard focus inside the tile, when selected
// and always on a touch screen (no hover there). Hidden actions are `visibility: hidden` (no invisible clickable
// button; the chips stay readable to a screen reader); a tile with actions takes keyboard focus itself, so Tab
// reveals them before it reaches them. `video` marks a video: a play badge over the image, the video icon as the
// placeholder.
defineProps({
  src: { type: String, default: "" },
  alt: { type: String, default: "" },
  caption: { type: String, default: "" },
  selected: { type: Boolean, default: false },
  video: { type: Boolean, default: false },
});
</script>

<style lang="scss">
@import "@/assets/scss/utils/media-query";

.media-tile {
  box-sizing: border-box;
  width: 188px;
  margin: 0;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 2px solid transparent;
  border-radius: var(--radius-base);
  background: var(--surface-raised);

  @include max-tablet {
    width: 150px;
    max-width: 100%;
  }

  &__image {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: var(--radius-base);
    background: var(--surface-sunken);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &__overlay {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    padding: var(--space-1);
  }

  &__reveal {
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  &__actions {
    visibility: hidden;
    transition: opacity 0.15s ease, visibility 0s linear 0.15s;
  }

  &:hover &__reveal,
  &:focus-within &__reveal,
  &--selected &__reveal {
    visibility: visible;
    opacity: 1;
    transition-delay: 0s;
  }

  @media (hover: none) {
    &__reveal {
      visibility: visible;
      opacity: 1;
    }
  }

  &__play {
    position: absolute;
    top: 50%;
    left: 50%;
    width: var(--space-10);
    height: var(--space-10);
    transform: translate(-50%, -50%);
    border-radius: var(--radius-full);
    background: var(--overlay-backdrop);
    color: var(--text-on-accent-fill);
    pointer-events: none;
  }

  &__placeholder {
    font-size: var(--fs-700);
    color: var(--text-muted);
  }

  &__caption {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--fs-200);
    color: var(--text-secondary);
  }
}

.media-tile--selected {
  border-color: var(--accent);
}
</style>
