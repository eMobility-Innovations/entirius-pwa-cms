<template>
  <div class="home-glow" aria-hidden="true">
    <svg class="home-glow__sign" viewBox="0 0 24.5625 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="home-glow-gradient" x1="12.28" y1="0" x2="12.28" y2="24" gradientUnits="userSpaceOnUse">
          <stop class="home-glow__from" />
          <stop class="home-glow__to" offset="1" />
        </linearGradient>
      </defs>
      <path
        fill="url(#home-glow-gradient)"
        d="M12.2812 0C5.4985 0 0 5.50054 0 12.2858C0 17.6831 3.47908 22.2675 8.31618 23.9172L7.59939 22.1036C4.18791 20.387 1.8468 16.8486 1.8468 12.768C1.8468 7.00309 6.51846 2.3297 12.2812 2.3297C18.044 2.3297 22.7157 7.00309 22.7157 12.768C22.7157 16.9458 20.2622 20.5504 16.718 22.2184L15.9946 24C20.9623 22.4255 24.5625 17.7763 24.5625 12.2858C24.5625 5.50054 19.064 0 12.2812 0Z"
      />
    </svg>
    <div class="home-glow__fade" />
  </div>
</template>

<script setup>
// The Home background (Figma S1/S2 `visual`): the Entirius sign, 1340 px wide, blurred 120 px at opacity .10, in a
// 600 px band at the bottom of the content region that fades into the page background. Decoration only: out of the
// layout, the accessibility tree and the pointer path.
</script>

<style lang="scss" scoped>
.home-glow {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 600px;
  overflow: hidden;
  pointer-events: none;
}

.home-glow__sign {
  position: absolute;
  top: 51px;
  left: 50%;
  width: 1340px;
  height: 1306px;
  opacity: 0.1;
  filter: blur(120px);
  transform: translateX(-50%);
}

.home-glow__from {
  stop-color: var(--brand-gradient-accent-from);
}

.home-glow__to {
  stop-color: var(--brand-gradient-accent-to);
}

.home-glow__fade {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 158px;
  background: linear-gradient(to bottom, transparent, var(--surface-page) 65%);
}
</style>
