<template>
  <div>
    <ConfirmDialog
      tone="danger"
      :open="deleteVisible"
      @confirm="submitDelete"
      @cancel="deleteVisible = false"
      :title="$t('atlas.delete.modal_title')"
    >
      <template #default>
        <p>{{ $t("atlas.delete.modal_body") }}</p>
      </template>
    </ConfirmDialog>
    <ConfirmDialog :open="confirmVisible" :tone="(pendingAction === 'reject') ? 'danger' : 'default'" @confirm="bulkExecute" @cancel="confirmVisible = false">
      <template #title>
        <h2 class="t-warning"><FontAwesomeIcon :icon="$icons.warning" /> {{ title }}</h2>
      </template>
      <template #default><p>{{ body }}</p></template>
    </ConfirmDialog>
    <ConfirmDialog :open="copyVisible" @confirm="copy" @cancel="copyVisible = false" title="Kopiuj układ">
      <template #default><p>Na pewno?</p></template>
    </ConfirmDialog>
    <Confirmation-modal :visible="true" @reject="$emit('close')">
      <template #description><p>Import</p></template>
      <template #footer><BasicButton text="OK" /></template>
    </Confirmation-modal>
    <ConfirmDialog v-if="ready" tone="danger" :open="removeVisible" @confirm="remove" @cancel="removeVisible = false" @close="log">
      <template #default><p>Usunąć autora?</p></template>
    </ConfirmDialog>
    <ConfirmDialog
      :open="!!pendingNav"
      @confirm="saveAndLeave"
      @discard="discardAndLeave"
      @cancel="cancelLeave"
      :title="$t('unsaved.title')"
      :message="$t('unsaved.message')"
      :confirm-label="$t('unsaved.save_and_leave')"
      :discard-label="$t('unsaved.discard')"
    />
    <BasicTooltip class="t-accent fs-200" :text="$t('controllers.rtl_tip')" variant="help" />
    <BasicTooltip :text="$t('content_sets.set_ready_tip')">
      <BasicButton variant="primary" disabled>Zapisz</BasicButton>
    </BasicTooltip>
    <ToolTip :tip="summary" :is_wrapper="wrapped"><span>x</span></ToolTip>
    <BasicTooltip :text="$t('pim.index_help')" variant="help" />
    <BasicTooltip :text="fileName" class="absolute w-100 h-100">
      <BasicImage :set="set" />
    </BasicTooltip>
  </div>
</template>

<script>
import ConfirmationModal from "@/functionals/Confirmation-modal/index.vue";
import draggable from "vuedraggable";

export default {
  components: { draggable, ConfirmationModal },
};
</script>
