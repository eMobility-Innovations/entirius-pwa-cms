import { ref, watch, onBeforeUnmount } from 'vue'

export function useUnsavedChanges() {
  const original = ref(null)
  const current = ref(null)
  const isDirty = ref(false)
  const pendingNav = ref(null)

  function snapshot(data) {
    original.value = JSON.parse(JSON.stringify(data))
  }

  function track(formData) {
    current.value = formData
  }

  watch([current, original], () => {
    if (!original.value) return
    isDirty.value = JSON.stringify(current.value) !== JSON.stringify(original.value)
  }, { deep: true })

  const beforeUnloadHandler = (e) => { e.preventDefault() }

  watch(isDirty, (dirty) => {
    if (dirty) {
      window.addEventListener('beforeunload', beforeUnloadHandler)
    } else {
      window.removeEventListener('beforeunload', beforeUnloadHandler)
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', beforeUnloadHandler)
  })

  // A dirty form holds the navigation: the guard's promise settles on the dialog's answer (true = leave,
  // false = stay), so the original router.push finishes either way. A newer navigation replaces the held one.
  function guardNavigation(to) {
    if (!isDirty.value) return true
    pendingNav.value?.settle(false)
    return new Promise((settle) => {
      pendingNav.value = { to, settle }
    })
  }

  function confirmLeave() {
    const nav = pendingNav.value
    pendingNav.value = null
    isDirty.value = false
    nav?.settle(true)
  }

  function cancelLeave() {
    const nav = pendingNav.value
    pendingNav.value = null
    nav?.settle(false)
  }

  return { isDirty, pendingNav, snapshot, track, guardNavigation, confirmLeave, cancelLeave }
}
