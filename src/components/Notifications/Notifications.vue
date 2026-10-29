<template>
  <div class="notifications">
    <transition-group name="alert" tag="ul" appear class="notifications__list">
      <li
        v-for="notification in notifications"
        :key="notification.uuid"
        class="notification flex jc-sb ai-ct mb-2 p-5 rounded shadow-down"
        :class="[toneClasses(notification.type), `notification--${notification.type}`]"
        :role="severityRole(notification.type)"
        :aria-live="severityAriaLive(notification.type)"
        @pointerenter="onPointer($event, notify.pauseTimer, notification.uuid)"
        @pointerleave="onPointer($event, notify.resumeTimer, notification.uuid)"
      >
        <div class="notification__msg">
          <p
            v-if="notification.title"
            class="fs-300 fw-600"
            :class="notification.msg ? 'mb-1' : ''"
            v-text="notification.title"
          />
          <p v-if="notification.msg" class="fs-200" v-text="notification.msg" />
        </div>
        <IconButton
          icon="close"
          :label="$t('common.dismiss')"
          class="notification__close"
          @click="notify.hideNotification(notification.uuid)"
        />
      </li>
    </transition-group>
  </div>
</template>

<script>
import { useNotifyStore } from "@/stores/notify";

// notify type → semantic status name (the semantic layer calls informative `info`)
const TONES = { positive: "positive", negative: "negative", warning: "warning", informative: "info" };

export default {
  setup() {
    const notify = useNotifyStore();
    return { notify };
  },
  computed: {
    notifications() {
      return this.notify.notifications;
    },
  },
  methods: {
    // Only a hovering mouse holds a toast: a tap never leaves, so it would pin the toast over the page.
    onPointer(event, action, uuid) {
      if (event.pointerType === "mouse") action(uuid);
    },
    toneClasses(type) {
      const tone = TONES[type] ?? "info";
      return `bg-${tone}-subtle t-${tone}`;
    },
    severityRole(type) {
      return type === "negative" || type === "warning" ? "alert" : "status";
    },
    severityAriaLive(type) {
      return type === "negative" || type === "warning" ? "assertive" : "polite";
    },
  },
};
</script>

<style lang="scss">
.notifications {
  position: fixed;
  z-index: 101;
  top: 4rem;
  right: 4rem;
  width: 28em;
}
.notifications__list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.notification {
  width: 28em;
  border-left: 3px solid currentColor;
}
.notification--positive {
  border-left-color: var(--positive);
}
.notification--negative {
  border-left-color: var(--negative);
}
.notification--informative {
  border-left-color: var(--info);
}
.notification--warning {
  border-left-color: var(--warning);
}
.notification__close {
  margin-left: var(--space-2);
}
/* Phone: after the base rules so it wins — the toast fits the screen and sits at the bottom, clear of the header
   and the page's Back, and above a sticky action bar (`--action-bar-height`, set by ReviewActions) so it never covers
   the action it explains. */
@media screen and (max-width: 768px) {
  .notifications {
    top: auto;
    right: var(--space-5);
    bottom: calc(max(var(--space-5), env(safe-area-inset-bottom)) + var(--action-bar-height, 0px));
    left: var(--space-5);
    width: auto;
  }
  .notification {
    width: 100%;
  }
}
</style>
