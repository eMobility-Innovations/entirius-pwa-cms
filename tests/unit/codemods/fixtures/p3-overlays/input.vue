<template>
  <div>
    <Confirmation-modal
      destructive
      :visible="deleteVisible"
      @accept="submitDelete"
      @reject="deleteVisible = false"
    >
      <template #header>
        <h2>{{ $t("atlas.delete.modal_title") }}</h2>
      </template>
      <template #description>
        <p>{{ $t("atlas.delete.modal_body") }}</p>
      </template>
    </Confirmation-modal>
    <ConfirmationModal :visible="confirmVisible" :destructive="pendingAction === 'reject'" @accept="bulkExecute" @reject="confirmVisible = false">
      <template #header>
        <h2 class="t-warning"><FontAwesomeIcon :icon="$icons.warning" /> {{ title }}</h2>
      </template>
      <template #description><p>{{ body }}</p></template>
    </ConfirmationModal>
    <Confirmation-modal :destructive="false" :visible="copyVisible" @accept="copy" @reject="copyVisible = false">
      <template #header><h2>Kopiuj układ</h2></template>
      <template #description><p>Na pewno?</p></template>
    </Confirmation-modal>
    <Confirmation-modal :visible="true" @reject="$emit('close')">
      <template #description><p>Import</p></template>
      <template #footer><BasicButton text="OK" /></template>
    </Confirmation-modal>
    <Confirmation-modal v-if="ready" destructive :visible="removeVisible" @accept="remove" @reject="removeVisible = false" @close="log">
      <template #description><p>Usunąć autora?</p></template>
    </Confirmation-modal>
    <UnsavedChangesModal
      :visible="!!pendingNav"
      @save="saveAndLeave"
      @discard="discardAndLeave"
      @stay="cancelLeave"
    />
    <ToolTip class="right t-accent fs-200" :tip="$t('controllers.rtl_tip')" />
    <ToolTip class="left" :tip="$t('content_sets.set_ready_tip')" :is_wrapper="true">
      <BasicButton variant="primary" disabled>Zapisz</BasicButton>
    </ToolTip>
    <ToolTip :tip="summary" :is_wrapper="wrapped"><span>x</span></ToolTip>
    <HelpTooltip :text="$t('pim.index_help')" />
    <HoverMe :text="fileName" class="absolute w-100 h-100">
      <BasicImage :set="set" />
    </HoverMe>
  </div>
</template>

<script>
import ConfirmationModal from "@/functionals/Confirmation-modal/index.vue";
import UnsavedChangesModal from "@/functionals/Unsaved-changes-modal/index.vue";
import draggable from "vuedraggable";

export default {
  components: { draggable, ConfirmationModal, UnsavedChangesModal },
};
</script>
