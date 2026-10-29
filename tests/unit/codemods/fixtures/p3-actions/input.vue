<template>
  <div class="toolbar">
    <!-- r02 §3.1 combos on their P2 names, and the polish role classes -->
    <BasicButton :text="$t('a.save')" class="btn-primary" @click="save" />
    <BasicButton :text="$t('a.create')" class="bg-accent-fill t-on-accent-fill b-accent rounded" @click="create" />
    <BasicButton :text="$t('a.confirm')" class="bg-positive-fill t-on-status-fill" @click="confirm" />
    <BasicButton :text="$t('a.cancel')" class="btn-secondary" @click="cancel" />
    <BasicButton :text="$t('a.more')" class="btn-outline ml-2" @click="more" />
    <BasicButton :text="$t('a.back')" class="bg-raised t-secondary" @click="back" />
    <BasicButton :text="$t('a.edit')" class="btn-ghost" @click="edit" />
    <BasicButton :text="$t('a.open')" @click="open" />
    <BasicButton :text="$t('a.remove')" class="btn-danger" @click="remove" />
    <BasicButton :text="$t('a.reject')" class="bg-negative-subtle t-negative" @click="reject" />
    <BasicButton :text="$t('a.purge')" class="bg-negative-fill t-on-status-fill" @click="purge" />
    <BasicButton :text="$t('a.flush')" class="btn-danger-fill" @click="flush" />

    <!-- text → slot, isDisabled → disabled, a labelled button drops its icon -->
    <BasicButton
      :text="busy ? $t('a.saving') : $t('a.save')"
      :isDisabled="busy"
      icon="language"
      class="btn-outline"
      data-testid="save-btn"
      @click="save"
    />
    <BasicButton text="Zapisz" isDisabled class="btn-primary" @click="save"></BasicButton>
    <BasicButton :text="label" :is-disabled="!ready" :icon="open ? 'plus' : false" class="btn-secondary" />

    <!-- icon-only → IconButton -->
    <BasicButton
      v-if="canDelete"
      custom
      size="sm"
      :label="$t('a.delete')"
      class="btn-danger"
      :data-testid="`row-delete-${row.id}`"
      @click="remove(row)"
    >
      <template #custom><FontAwesomeIcon icon="trash-can" /></template>
    </BasicButton>
    <BasicButton custom aria-label="Edytuj" class="btn-ghost" @click="edit"><template #custom><FontAwesomeIcon :icon="$icons.edit" /></template></BasicButton>
    <ToolTip :tip="$t('a.settings')" :is_wrapper="true">
      <BasicButton custom class="btn-outline" :isDisabled="locked" @click="settings">
        <template #custom><FontAwesomeIcon icon="gears" /></template>
      </BasicButton>
    </ToolTip>
    <BasicButton :icon="'close'" label="Zamknij" @click="close" />
    <BasicButton icon="plus" :text="$t('a.add')" />
    <BasicButton variant="secondary" icon="saveDraft" @click="draft">Zapisz szkic</BasicButton>

    <!-- flagged -->
    <BasicButton :text="$t('a.dark')" class="bg-inverse bg-accent-fill t-on-accent-fill" @click="toggle" />
    <BasicButton :text="$t('a.warn')" class="bg-warning-fill t-on-status-fill" @click="warn" />
    <BasicButton :text="$t('a.mode')" :class="active ? 'bg-accent-fill' : 'bg-hover'" @click="mode" />
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
        { key: "enable", labelKey: "pim.enable", buttonClass: "bg-positive-fill t-on-status-fill" },
        { key: "disable", labelKey: "pim.disable", buttonClass: 'bg-negative-fill t-on-status-fill' },
        { key: "apply", labelKey: "pim.apply", buttonClass: "bg-accent-fill t-on-accent-fill" },
        { key: "review", labelKey: "pim.review", buttonClass: "bg-warning-subtle t-warning" },
      ];
    },
  },
};
</script>
