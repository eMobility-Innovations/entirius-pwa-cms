<template>
  <div class="toolbar">
    <!-- r02 §3.1 combos on their P2 names, and the polish role classes -->
    <BasicButton variant="primary" @click="save">{{ $t('a.save') }}</BasicButton>
    <BasicButton variant="primary" class="rounded" @click="create">{{ $t('a.create') }}</BasicButton>
    <BasicButton variant="primary" @click="confirm">{{ $t('a.confirm') }}</BasicButton>
    <BasicButton variant="secondary" @click="cancel">{{ $t('a.cancel') }}</BasicButton>
    <BasicButton variant="secondary" class="ml-2" @click="more">{{ $t('a.more') }}</BasicButton>
    <BasicButton variant="secondary" @click="back">{{ $t('a.back') }}</BasicButton>
    <BasicButton variant="ghost" @click="edit">{{ $t('a.edit') }}</BasicButton>
    <BasicButton variant="ghost" @click="open">{{ $t('a.open') }}</BasicButton>
    <BasicButton variant="danger" @click="remove">{{ $t('a.remove') }}</BasicButton>
    <BasicButton variant="danger" @click="reject">{{ $t('a.reject') }}</BasicButton>
    <BasicButton variant="danger" @click="purge">{{ $t('a.purge') }}</BasicButton>
    <BasicButton variant="danger-solid" @click="flush">{{ $t('a.flush') }}</BasicButton>

    <!-- text → slot, isDisabled → disabled, a labelled button drops its icon -->
    <BasicButton
      :disabled="busy"
      variant="secondary"
      data-testid="save-btn"
      @click="save"
    >
      {{ busy ? $t('a.saving') : $t('a.save') }}
    </BasicButton>
    <BasicButton disabled variant="primary" @click="save">Zapisz</BasicButton>
    <BasicButton :disabled="!ready" variant="secondary">{{ label }}</BasicButton>

    <!-- icon-only → IconButton -->
    <IconButton
      v-if="canDelete"
      icon="delete"
      :label="$t('a.delete')"
      variant="danger"
      size="sm"
      :data-testid="`row-delete-${row.id}`"
      @click="remove(row)"
    />
    <IconButton icon="edit" label="Edytuj" @click="edit" />
    <ToolTip :tip="$t('a.settings')" :is_wrapper="true">
      <IconButton icon="settings" :label="$t('a.settings')" variant="outline" :disabled="locked" @click="settings" />
    </ToolTip>
    <IconButton icon="close" label="Zamknij" @click="close" />
    <BasicButton variant="ghost">{{ $t('a.add') }}</BasicButton>
    <BasicButton variant="secondary" icon="saveDraft" @click="draft">Zapisz szkic</BasicButton>

    <!-- flagged -->
    <BasicButton class="bg-inverse bg-accent-fill t-on-accent-fill" @click="toggle">{{ $t('a.dark') }}</BasicButton>
    <BasicButton class="bg-warning-fill t-on-status-fill" @click="warn">{{ $t('a.warn') }}</BasicButton>
    <BasicButton :class="active ? 'bg-accent-fill' : 'bg-hover'" @click="mode">{{ $t('a.mode') }}</BasicButton>
    <BasicButton :text="open ? $t('a.close') : false" class="btn-ghost" @click="toggle" />
    <BasicButton custom class="btn-ghost" @click="nameless"><template #custom><FontAwesomeIcon icon="pen" /></template></BasicButton>
    <BasicButton custom label="Pogrubienie" class="b-subtle"><template #custom><span class="wi-bold" /></template></BasicButton>
    <BasicButton custom label="Menu" @click="menu"><template #custom><FontAwesomeIcon icon="grip" /></template></BasicButton>
    <BasicButton :icon="'close-mini'" label="Usuń" @click="clear" />
    <BasicButton custom label="Wyczyść" class="btn-danger-fill" @click="flush"><template #custom><FontAwesomeIcon icon="broom" /></template></BasicButton>
    <BasicButton :text="ready && $t('a.go')" class="btn-primary" @click="go" />
    <BasicButton :text="name || false" class="btn-ghost" @click="go" />
    <BasicButton text="a &lt; b" class="btn-ghost" @click="go" />
    <BasicButton variant="primary" @click="save">{{ $t("a.done") }}</BasicButton>
  </div>
</template>

<script>
export default {
  computed: {
    bulkActions() {
      return [
        { key: "enable", labelKey: "pim.enable", variant: "primary" },
        { key: "disable", labelKey: "pim.disable", variant: 'danger' },
        { key: "apply", labelKey: "pim.apply", variant: "primary" },
        { key: "review", labelKey: "pim.review", buttonClass: "bg-warning-subtle t-warning" },
      ];
    },
  },
};
</script>
