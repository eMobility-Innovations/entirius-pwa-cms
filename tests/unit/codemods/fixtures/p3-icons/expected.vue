<template>
  <div class="toolbar">
    <FontAwesomeIcon :icon="$icons.edit" class="t-muted" />
    <font-awesome-icon :icon="$icons.edit" />
    <FontAwesomeIcon :icon="$icons.help" />
    <FontAwesomeIcon
      :icon="open ? $icons.collapse : $icons.expand"
      class="fs-200"
    />
    <FontAwesomeIcon :icon="mode === 'trash' ? $icons.delete : open || $icons.edit" />
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
