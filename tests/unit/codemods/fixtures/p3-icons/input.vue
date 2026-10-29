<template>
  <div class="toolbar">
    <FontAwesomeIcon icon="pen" class="t-muted" />
    <font-awesome-icon icon="pencil" />
    <FontAwesomeIcon icon="fa-solid fa-circle-question" />
    <FontAwesomeIcon
      :icon="open ? 'chevron-up' : 'chevron-down'"
      class="fs-200"
    />
    <FontAwesomeIcon :icon="mode === 'trash' ? 'trash' : open || 'pen'" />
    <FontAwesomeIcon :icon="$icons.close" />
    <FontAwesomeIcon icon="grip" />
    <FontAwesomeIcon icon="upload" />
    <FontAwesomeIcon icon="rocket" />
    <BasicButton icon="trash-can" />
  </div>
</template>

<script>
export default { data: () => ({ open: false, mode: "", icon: "pen" }) };
</script>
