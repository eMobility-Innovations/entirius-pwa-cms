<template>
  <div class="auth-layout">
    <div class="auth-layout__stage" data-theme="dark" aria-hidden="true">
      <div class="auth-layout__light">
        <span class="auth-layout__field auth-layout__field--a" />
        <span class="auth-layout__field auth-layout__field--b" />
        <span class="auth-layout__field auth-layout__field--c" />
      </div>
      <BasicLogo class="auth-layout__logo" variant="full" :size="isDesktop ? 32 : 24" on-dark />
      <div v-if="isDesktop" class="auth-layout__copy">
        <p class="type-overline t-body">{{ $t("login.stage_overline") }}</p>
        <p class="auth-layout__line type-display">{{ $t("login.stage_line") }}</p>
      </div>
      <div v-if="isDesktop" class="auth-layout__foot fs-200 t-body">
        <span>{{ $t("login.stage_rights", { year }) }}</span>
      </div>
    </div>
    <main class="auth-layout__sheet">
      <div class="auth-layout__column">
        <h1 class="auth-layout__title">{{ title }}</h1>
        <p v-if="subtitle" class="auth-layout__subtitle">{{ subtitle }}</p>
        <div class="auth-layout__live" aria-live="polite">
          <p v-if="$slots.status" class="auth-layout__status" :class="`auth-layout__status--${statusTone}`">
            <slot name="status" />
          </p>
        </div>
        <div class="auth-layout__body"><slot /></div>
      </div>
    </main>
  </div>
</template>

<script setup>
// The frame of the sign-in screens (login wall, password reset, change password, SSO callback), plan 59 "quiet light".
// Desktop (from the shell breakpoint): a brand stage (always dark, decorative, aria-hidden) beside the form column;
// below it the stage is a top band and the form a sheet over it. The stage's light fields drift on transform only,
// pause while focus is in the form and stay still under reduced motion. `title` is the screen's one H1, `subtitle` a
// line under it; the `status` slot is the one live summary (session expired, form errors, link sent) in `statusTone`.
import { useIsDesktop } from "@/composables/useIsDesktop";

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: "" },
  statusTone: {
    type: String,
    default: "negative",
    validator: (value) => ["negative", "positive", "warning"].includes(value),
  },
});

const isDesktop = useIsDesktop();
const year = new Date().getFullYear();
</script>

<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

// Fine grain over the stage: SVG turbulence, grey only, drawn at 4 % opacity.
$grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");

// A light field: a radial falloff eased over four stops, so no disc edge shows.
@function light($color) {
  @return radial-gradient(
    closest-side,
    $color,
    color-mix(in srgb, #{$color} 55%, transparent) 30%,
    color-mix(in srgb, #{$color} 18%, transparent) 62%,
    transparent
  );
}

.auth-layout {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 56fr 44fr;
}

.auth-layout__stage {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: var(--space-12);
  background-color: var(--surface-page);
  color: var(--text-strong);

  // A barely visible dot grid that fades out toward the edges.
  &::before,
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  &::before {
    background-image: radial-gradient(color-mix(in srgb, var(--text-strong) 10%, transparent) 1px, transparent 1.5px);
    background-size: var(--space-6) var(--space-6);
    mask-image: radial-gradient(ellipse at 40% 45%, var(--surface-page) 20%, transparent 70%);
  }

  &::after {
    background-image: $grain;
    opacity: 0.04;
  }
}

.auth-layout__light {
  position: absolute;
  inset: 0;
}

.auth-layout__field {
  position: absolute;
  aspect-ratio: 1;
  border-radius: var(--radius-full);
  animation: auth-drift 38s ease-in-out infinite alternate;

  &--a {
    top: -18%;
    left: -12%;
    width: 80%;
    opacity: 0.36;
    background: light(var(--brand-gradient-accent-from));
  }

  &--b {
    right: -26%;
    bottom: -30%;
    width: 86%;
    opacity: 0.45;
    background: light(var(--brand-gradient-accent-to));
    animation-duration: 45s;
    animation-direction: alternate-reverse;
  }

  &--c {
    top: 28%;
    left: 34%;
    width: 52%;
    opacity: 0.35;
    background: light(var(--brand-tertiary-100));
    animation-duration: 31s;
    animation-delay: -12s;
  }
}

// Typing keeps the attention on the form: the light holds still while a control has focus.
.auth-layout:focus-within .auth-layout__field {
  animation-play-state: paused;
}

@keyframes auth-drift {
  from {
    transform: translate3d(0, 0, 0) scale(1);
  }

  to {
    transform: translate3d(9%, 7%, 0) scale(1.12);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-layout__field {
    animation: none;
  }
}

.auth-layout__logo,
.auth-layout__copy,
.auth-layout__foot {
  position: relative;
}

.auth-layout__copy {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 34rem;
  margin-top: auto;
}

// The editorial line: Lexend Deca light at the largest step of the type scale (a display size is a handoff request).
.auth-layout__line {
  text-wrap: balance;
}

.auth-layout__foot {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-top: var(--space-16);
}

.auth-layout__sheet {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-10);
  border-left: 1px solid var(--border-hairline);
  background-color: var(--surface-page);
}

.auth-layout__column {
  width: 100%;
  max-width: 23.75rem;
}

.auth-layout__title {
  margin: 0;
  font-family: var(--font-brand);
  font-size: var(--fs-600);
  font-weight: 400;
  line-height: 1.2;
  letter-spacing: var(--brand-font-tracking-brand);
  color: var(--text-strong);
}

.auth-layout__subtitle {
  margin: var(--space-2) 0 0;
  font-size: var(--fs-300);
  color: var(--text-secondary);
}

.auth-layout__status {
  margin: var(--space-6) 0 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--fs-300);
  font-weight: 500;

  &--negative {
    background-color: var(--negative-subtle);
    color: var(--negative);
  }

  &--positive {
    background-color: var(--positive-subtle);
    color: var(--positive);
  }

  &--warning {
    background-color: var(--warning-subtle);
    color: var(--warning);
  }
}

.auth-layout__body {
  margin-top: var(--space-8);
}

// Below the shell breakpoint: the stage is a band on top, the form a sheet that rises over it.
@include max-shell {
  .auth-layout {
    display: block;
  }

  .auth-layout__stage {
    height: 32vh;
    padding: var(--space-5);
  }

  .auth-layout__sheet {
    position: relative;
    align-items: flex-start;
    min-height: calc(68vh + var(--space-6));
    margin-top: calc(-1 * var(--space-6));
    padding: var(--space-8) var(--space-5) var(--space-10);
    border-left: 0;
    border-radius: var(--radius-3xl) var(--radius-3xl) 0 0;
  }
}

// Tablet: the same band, a wider sheet column.
@include max-shell {
  @include min-tablet {
    .auth-layout__sheet {
      padding-top: var(--space-12);
    }

    .auth-layout__column {
      max-width: 30rem;
    }
  }
}
</style>
