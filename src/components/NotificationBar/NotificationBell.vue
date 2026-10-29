<template>
  <BasicMenu :label="$t('notification_bar.title')" placement="bottom-end" @open="store.loadItems()">
    <template #trigger>
      <span class="notif-bell relative inline-flex">
        <IconButton size="lg" icon="notifications" :label="$t('notification_bar.open')" data-testid="notif-bell" />
        <span v-if="store.unread" class="notif-bell__count" data-testid="notif-count">
          {{ store.unread > 99 ? "99+" : store.unread }}
        </span>
      </span>
    </template>
    <template #panel="{ close }">
      <NotificationList @close="close" />
    </template>
  </BasicMenu>
</template>

<script setup>
// The header bell: an IconButton with the unread count; the list opens in BasicMenu's panel mode, which anchors it
// under the bell, closes it on Esc or a click outside and returns focus to the bell.
import BasicMenu from "@/boots/BasicMenu/index.vue";
import IconButton from "@/boots/IconButton/index.vue";
import { useNotificationsStore } from "@/stores/notifications";
import NotificationList from "./NotificationList.vue";

const store = useNotificationsStore();
</script>

<style scoped>
.notif-bell__count {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  background: var(--negative-fill);
  color: var(--text-on-status-fill);
  font-size: var(--fs-100);
  font-weight: 600;
  line-height: 1.1rem;
  text-align: center;
  pointer-events: none;
}
</style>
