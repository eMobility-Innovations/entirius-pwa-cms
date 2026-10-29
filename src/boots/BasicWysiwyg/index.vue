<template>
  <section
    class="text-section input"
    :class="{ 'focus-mode-placeholder': editor_size }"
  >
    <Teleport to="body" :disabled="!editor_size">
      <div
        v-if="editor_size"
        class="focus-mode-backdrop"
        @click="editor_size = null"
      />
      <div
        v-if="editor"
        class="input-wysiwyg-wrapper flex flex-column jc-sb relative"
        :class="editor_size ? 'focus-mode-editor' : 'h-100'"
      >
        <div
          class="relative fg-1 ovy-auto"
          :class="{
            'editor-content-container': !editor_size,
            'editor-content-container--lite':
              !editor_size && variant === 'lite',
          }"
        >
          <editor-content
            :editor="editor"
            :key="'editor-stable'"
            class="h-100 pb-900 pr-2"
          />
          <button
            class="focus-mode-trigger"
            :class="{ 'is-active': editor_size }"
            type="button"
            tabindex="0"
            :aria-label="editor_size ? 'Exit focus mode' : 'Focus mode'"
            @click="editor_size = editor_size ? null : 'full'"
          >
            <font-awesome-icon
              :icon="editor_size ? $icons.exitFullscreen : $icons.fullscreen"
            />
          </button>
        </div>
        <div
          v-if="editor"
          class="wysiwyg-options bt-subtle pt-2 bg-base flex ai-ct gap-2"
        >
          <div v-if="mode == 'text'" class="wysiwyg-btn-row flex gap-2 fg-1">
            <IconButton
              v-for="tool in MARK_TOOLS"
              :key="tool.key"
              size="sm"
              variant="outline"
              :icon="tool.icon"
              :label="$t(`wysiwyg.${tool.key}`)"
              :pressed="editor.isActive(...tool.active)"
              @click="tool.run()"
            />
            <BasicButton
              v-for="level in [1, 2, 3]"
              :key="`heading_${level}`"
              size="sm"
              variant="secondary"
              :class="{ 'bg-hover t-body': editor.isActive('heading', { level }) }"
              :aria-label="$t(`wysiwyg.heading_${level}`)"
              :aria-pressed="String(editor.isActive('heading', { level }))"
              @click="editor.chain().focus().toggleHeading({ level }).run()"
            >
              H{{ level }}
            </BasicButton>
            <IconButton
              size="sm"
              variant="outline"
              icon="link"
              :label="$t('wysiwyg.link')"
              :pressed="editor.isActive('link')"
              @click="setLink"
            />

            <!-- FAQ Tooltip button + search dropdown -->
            <div v-if="faqEnabled" class="relative faq-tooltip-btn">
              <IconButton
                size="sm"
                variant="outline"
                icon="help"
                :label="editor.isActive('faqTooltip') ? $t('wysiwyg.faq_remove') : $t('wysiwyg.faq_add')"
                :pressed="editor.isActive('faqTooltip')"
                @click="editor.isActive('faqTooltip') ? removeFaqTooltip() : openFaqSearch()"
              />

              <div
                v-if="showFaqSearch"
                class="faq-tooltip-dropdown bg-base b-subtle rounded"
              >
                <div class="p-2">
                  <input
                    v-model="faqQuery"
                    class="faq-tooltip-search"
                    :placeholder="$t('wysiwyg.faq_search_placeholder')"
                    autofocus
                    @input="searchFaq"
                    @keydown.escape="closeFaqSearch"
                  />
                </div>
                <div
                  v-if="faqLoading"
                  class="p-2 t-secondary fs-200 tc"
                >
                  {{ $t('wysiwyg.faq_searching') }}
                </div>
                <div
                  v-else-if="faqResults.length === 0 && faqQuery.trim()"
                  class="p-2 t-secondary fs-200 tc"
                >
                  {{ $t('wysiwyg.faq_no_results') }}
                </div>
                <ul v-else class="faq-tooltip-results">
                  <li
                    v-for="item in faqResults"
                    :key="item.url_key"
                    class="faq-tooltip-result p-2 bb-subtle t-body fs-200"
                    @click="applyFaqTooltip(item.url_key)"
                  >
                    <div class="fw-600">{{ item.question || item.url_key }}</div>
                    <div class="t-secondary faq-tooltip-urlkey">
                      {{ item.url_key }}
                    </div>
                  </li>
                </ul>
                <div class="p-2 bt-subtle">
                  <button class="faq-tooltip-cancel" @click="closeFaqSearch">
                    {{ $t('wysiwyg.faq_cancel') }}
                  </button>
                </div>
              </div>
            </div>

            <IconButton
              v-for="tool in BLOCK_TOOLS"
              :key="tool.key"
              size="sm"
              variant="outline"
              :icon="tool.icon"
              :label="$t(`wysiwyg.${tool.key}`)"
              :pressed="editor.isActive(...tool.active)"
              @click="tool.run()"
            />
          </div>
          <div v-if="mode == 'table'" class="flex wrap gap-2 fg-1">
            <BasicButton
              v-for="tool in TABLE_TOOLS"
              :key="tool.key"
              size="sm"
              :variant="tool.danger ? 'danger' : 'secondary'"
              @click="tool.run(editor.chain().focus()).run()"
            >
              {{ $t(`wysiwyg.${tool.key}`) }}
            </BasicButton>
          </div>
          <BasicSelect
            v-if="variant !== 'lite'"
            v-model="mode"
            class="wysiwyg-mode-switcher"
            :aria-label="$t('wysiwyg.text_mode') + ' / ' + $t('wysiwyg.table_mode')"
            :options="[
              { label: $t('wysiwyg.text_mode'), value: 'text' },
              { label: $t('wysiwyg.table_mode'), value: 'table' },
            ]"
          />
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script>
import { EditorContent, useEditor } from "@tiptap/vue-3";
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { Mark } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import { useMuninStore } from "@/stores/munin";
import { GET_FaqItems } from "@/api/faq/api";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { useControlAttrs } from "@/boots/FormField/useControlAttrs";

// Defined at module level — created once, not on every component mount
const FaqTooltip = Mark.create({
  name: "faqTooltip",
  addAttributes() {
    return {
      urlKey: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-faq-tooltip"),
        renderHTML: (attrs) => ({ "data-faq-tooltip": attrs.urlKey }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-faq-tooltip]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
  addCommands() {
    return {
      setFaqTooltip:
        (urlKey) =>
        ({ commands }) =>
          commands.setMark(this.name, { urlKey }),
      unsetFaqTooltip:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

// Table tools are text buttons: four "add" and three "delete" tools cannot be told apart by an icon (R7).
const TABLE_TOOLS = [
  { key: "insert_table", run: (chain) => chain.insertTable({ rows: 2, cols: 3, withHeaderRow: true }) },
  { key: "delete_table", run: (chain) => chain.deleteTable(), danger: true },
  { key: "add_column_before", run: (chain) => chain.addColumnBefore() },
  { key: "add_column_after", run: (chain) => chain.addColumnAfter() },
  { key: "delete_column", run: (chain) => chain.deleteColumn(), danger: true },
  { key: "add_row_before", run: (chain) => chain.addRowBefore() },
  { key: "add_row_after", run: (chain) => chain.addRowAfter() },
  { key: "delete_row", run: (chain) => chain.deleteRow(), danger: true },
  { key: "merge_cells", run: (chain) => chain.mergeCells() },
  { key: "split_cell", run: (chain) => chain.splitCell() },
  { key: "header_column", run: (chain) => chain.toggleHeaderColumn() },
  { key: "header_row", run: (chain) => chain.toggleHeaderRow() },
  { key: "header_cell", run: (chain) => chain.toggleHeaderCell() },
];

export default {
  props: {
    modelValue: {
      type: String,
      default: "",
    },
    // Keep body for backwards compatibility
    body: {
      type: String,
      default: "",
    },
    placeholder: {
      type: String,
      default: "",
    },
    variant: {
      type: String,
      default: "full",
      validator: (v) => ["full", "lite"].includes(v),
    },
  },
  emits: ["update:modelValue", "input", "onFocusout"],
  components: {
    EditorContent,
  },
  setup(props, { emit }) {
    // FormField contract (docs/ui-components.md § P3 inputs): the editable ProseMirror node is not a
    // `for`-labelable element, so its accessible name/description are set directly via editorProps.attributes.
    const { field, attrs: fieldAttrs } = useControlAttrs();
    const editorAttributes = computed(() => {
      const attrs = { id: fieldAttrs.value.id };
      if (fieldAttrs.value["aria-describedby"]) attrs["aria-describedby"] = fieldAttrs.value["aria-describedby"];
      if (field.labelId.value) attrs["aria-labelledby"] = field.labelId.value;
      return attrs;
    });

    // Munin — FAQ module check
    const muninStore = useMuninStore();
    const faqEnabled = computed(() => muninStore.isPanelEnabled("faq"));

    // FAQ search state
    const showFaqSearch = ref(false);
    const faqQuery = ref("");
    const faqResults = ref([]);
    const faqLoading = ref(false);
    const faqSearchTimeout = ref(null);

    const EDITOR_LINK_COLOR = "#0089B7";
    const EDITOR_HIGHLIGHT_COLOR = "#8ce99a";

    // UI state
    const mode = ref("text");
    const editor_size = ref(null);
    const highlightColor = ref(EDITOR_HIGHLIGHT_COLOR);

    // Focus mode: escape key + body scroll lock
    const handleEscKey = (e) => {
      if (e.key === "Escape") editor_size.value = null;
    };

    watch(editor_size, (val) => {
      if (val) {
        document.addEventListener("keydown", handleEscKey);
        document.body.style.overflow = "hidden";
      } else {
        document.removeEventListener("keydown", handleEscKey);
        document.body.style.overflow = "";
      }
    });
    const emitTimeout = ref(null);
    const isInternalUpdate = ref(false);

    // Event handlers
    const handleEditorUpdate = ({ editor }) => {
      const html = editor.getHTML();

      if (emitTimeout.value) {
        clearTimeout(emitTimeout.value);
      }

      // Prevent watcher from responding to our own emit
      isInternalUpdate.value = true;

      emitTimeout.value = setTimeout(() => {
        const isBodyMode = props.body && !props.modelValue;

        if (!isBodyMode) {
          emit("update:modelValue", html);
        }
        emit("input", html);

        // Reset flag AFTER emit completes
        setTimeout(() => {
          isInternalUpdate.value = false;
        }, 0);

        emitTimeout.value = null;
      }, 50);
    };

    const handleEditorBlur = ({ editor }) => {
      emit("onFocusout", editor.getHTML());
      // Allow external updates after blur
      isInternalUpdate.value = false;
    };

    // Build extensions list based on variant
    const baseExtensions = [
      StarterKit.configure({
        // Disable extensions we're adding separately to avoid duplicates
        link: false,
        underline: false,
      }),
      Underline,
      Color,
      TextStyle,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right"],
        defaultAlignment: "left",
      }),
      Link.configure({ openOnClick: false }),
      FaqTooltip,
    ];

    const tableExtensions =
      props.variant === "full"
        ? [
            Table.configure({ handleWidth: 100 }),
            TableRow,
            TableHeader,
            TableCell,
          ]
        : [];

    function transformPastedHTML(html) {
      const div = document.createElement("div");
      div.innerHTML = html;
      div.querySelectorAll("[style]").forEach((el) => {
        el.style.color = "";
        el.style.fontFamily = "";
        el.style.fontSize = "";
        el.style.fontWeight = "";
        el.style.backgroundColor = "";
        el.style.lineHeight = "";
        el.style.letterSpacing = "";
        if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
      });
      return div.innerHTML;
    }
    const buildEditorProps = () => ({
      transformPastedHTML,
      attributes: editorAttributes.value,
    });

    // Initialize editor with TipTap's official useEditor hook
    const editor = useEditor({
      content: props.modelValue || props.body || props.placeholder,
      autofocus: false,
      editable: true,
      editorProps: buildEditorProps(),
      extensions: [...baseExtensions, ...tableExtensions],
      onUpdate: handleEditorUpdate,
      onBlur: handleEditorBlur,
    });

    // The field's id/description/label can change after mount (an error appears, a label is added); keep the
    // editable node's accessible name/description in sync.
    watch(editorAttributes, () => {
      editor.value?.setOptions({ editorProps: buildEditorProps() });
    });

    // FAQ Tooltip methods
    const openFaqSearch = () => {
      if (!editor.value?.state.selection.empty) {
        showFaqSearch.value = true;
        faqQuery.value = "";
        faqResults.value = [];
      }
    };

    const searchFaq = () => {
      clearTimeout(faqSearchTimeout.value);
      if (!faqQuery.value.trim()) {
        faqResults.value = [];
        return;
      }
      faqLoading.value = true;
      faqSearchTimeout.value = setTimeout(async () => {
        try {
          const channel = process.env.VUE_APP_CHANNEL;
          const res = await GET_FaqItems(channel, {
            search: faqQuery.value,
            page_size: 10,
          });
          faqResults.value = res.data.results || [];
        } catch {
          faqResults.value = [];
        } finally {
          faqLoading.value = false;
        }
      }, 300);
    };

    const applyFaqTooltip = (urlKey) => {
      editor.value?.chain().focus().setFaqTooltip(urlKey).run();
      showFaqSearch.value = false;
    };

    const removeFaqTooltip = () => {
      editor.value?.chain().focus().extendMarkRange("faqTooltip").unsetFaqTooltip().run();
    };

    const closeFaqSearch = () => {
      showFaqSearch.value = false;
    };

    const handleFaqOutsideClick = (e) => {
      if (
        showFaqSearch.value &&
        !e.target.closest(".faq-tooltip-dropdown") &&
        !e.target.closest(".faq-tooltip-btn")
      ) {
        showFaqSearch.value = false;
      }
    };

    watch(showFaqSearch, (val) => {
      if (val) {
        document.addEventListener("mousedown", handleFaqOutsideClick);
      } else {
        document.removeEventListener("mousedown", handleFaqOutsideClick);
      }
    });

    // Methods
    const setLink = () => {
      if (!editor.value) return;

      const previousUrl = editor.value.getAttributes("link").href;
      const url = window.prompt(
        "Enter full URL (leave empty to remove)",
        previousUrl
      );

      if (url === null) return;

      if (url === "") {
        editor.value.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }

      editor.value
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    };

    // Watch modelValue prop for external changes
    watch(
      () => props.modelValue,
      (newValue) => {
        if (!editor.value) return;

        // Skip if change came from editor itself
        if (isInternalUpdate.value) return;

        // Don't update if editor is focused (user is actively editing)
        if (editor.value.isFocused) return;

        const currentContent = editor.value.getHTML();
        const normalizedNew = (newValue || "").trim();
        const normalizedCurrent = (currentContent || "").trim();

        if (normalizedNew !== normalizedCurrent) {
          editor.value.commands.setContent(newValue || "", false);
        }
      }
    );

    // Watch body prop for backward compatibility
    watch(
      () => props.body,
      (newValue) => {
        if (!editor.value || props.modelValue) return;

        if (isInternalUpdate.value) return;

        // Don't update if editor is focused (user is actively editing)
        if (editor.value.isFocused) return;

        const currentContent = editor.value.getHTML();
        const normalizedNew = (newValue || "").trim();
        const normalizedCurrent = (currentContent || "").trim();

        if (normalizedNew !== normalizedCurrent) {
          editor.value.commands.setContent(newValue || "", false);
        }
      }
    );

    // Cleanup on unmount (editor cleanup handled by useEditor)
    onBeforeUnmount(() => {
      if (emitTimeout.value) {
        clearTimeout(emitTimeout.value);
        emitTimeout.value = null;
      }
      clearTimeout(faqSearchTimeout.value);
      document.removeEventListener("mousedown", handleFaqOutsideClick);
      document.removeEventListener("keydown", handleEscKey);
      document.body.style.overflow = "";
    });

    // Formatting toggles are icon buttons (R7); H1–H3 have no distinct glyph, so they stay text buttons.
    const chain = () => editor.value.chain().focus();
    const linkColor = { color: EDITOR_LINK_COLOR };
    const toggleLinkColor = () =>
      (editor.value.isActive("textStyle", linkColor) ? chain().unsetColor() : chain().setColor(EDITOR_LINK_COLOR)).run();
    const MARK_TOOLS = [
      { key: "bold", icon: "bold", active: ["bold"], run: () => chain().toggleBold().run() },
      { key: "italic", icon: "italic", active: ["italic"], run: () => chain().toggleItalic().run() },
      { key: "underline", icon: "underline", active: ["underline"], run: () => chain().toggleUnderline().run() },
    ];
    const BLOCK_TOOLS = [
      { key: "bullet_list", icon: "listBullet", active: ["bulletList"], run: () => chain().toggleBulletList().run() },
      { key: "ordered_list", icon: "listOrdered", active: ["orderedList"], run: () => chain().toggleOrderedList().run() },
      {
        key: "highlight",
        icon: "highlight",
        active: ["highlight"],
        run: () => editor.value.commands.toggleHighlight({ color: highlightColor.value }),
      },
      { key: "link_color", icon: "textColor", active: ["textStyle", linkColor], run: toggleLinkColor },
      ...["left", "center", "right"].map((align) => ({
        key: `align_${align}`,
        icon: `align${align[0].toUpperCase()}${align.slice(1)}`,
        active: [{ textAlign: align }],
        run: () => chain().setTextAlign(align).run(),
      })),
    ];

    return {
      MARK_TOOLS,
      BLOCK_TOOLS,
      TABLE_TOOLS,
      mode,
      editor_size,
      highlightColor,
      editor,
      setLink,
      EDITOR_LINK_COLOR,
      faqEnabled,
      showFaqSearch,
      faqQuery,
      faqResults,
      faqLoading,
      openFaqSearch,
      searchFaq,
      applyFaqTooltip,
      removeFaqTooltip,
      closeFaqSearch,
    };
  },
};
</script>

<style lang="scss">
@import "@/assets/scss/utils/media-query";

.text-section.input {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-base);
  padding: var(--space-2);
  background-color: var(--surface-base);
}

.focus-mode-backdrop {
  position: fixed;
  inset: 0;
  background: var(--overlay-backdrop);
  z-index: 200;
}
.focus-mode-editor {
  position: fixed;
  top: 5vh;
  left: 50%;
  transform: translateX(-50%);
  width: min(56rem, 92vw);
  height: 90vh;
  z-index: 201;
  background-color: var(--surface-base);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-lg);
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
}
.focus-mode-placeholder {
  min-height: 4rem;
}
.focus-mode-trigger {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  background: var(--surface-base);
  color: var(--text-muted);
  font-size: var(--fs-200);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 1;

  &:hover {
    color: var(--text-accent);
    border-color: var(--accent);
  }

  &.is-active {
    opacity: 1;
  }
}
.editor-content-container {
  min-height: 15rem;
  max-height: 30rem;

  &--lite {
    min-height: 8rem;
    max-height: 20rem;
  }

  &:hover .focus-mode-trigger {
    opacity: 1;
  }
}
.input-wysiwyg-wrapper {
  .ProseMirror {
    background-color: var(--surface-base);
    color: var(--text-body);
    cursor: text;
    line-height: 1.7;
    margin-top: var(--space-1);
    margin-bottom: var(--space-3);

    h1,
    h2,
    h3 {
      line-height: 1.3;
    }
    table td,
    table th {
      line-height: 1.4;
    }

    u {
      text-decoration: underline;
    }
    ul {
      padding-left: var(--space-2);
    }
    &:focus-visible {
      outline: none;
    }

    [data-faq-tooltip] {
      border-bottom: 2px dotted var(--accent);
      color: var(--text-accent);
      cursor: help;
    }
    > * + * {
      margin-top: 0;
    }
    table {
      table-layout: fixed;
      // border-radius: var(--radius-base);
      border: 1px solid var(--border-default);
      // overflow: hidden;
      font-size: var(--fs-200);
      font-weight: normal;

      border: none;
      border-collapse: collapse;
      min-width: 100%;
      // max-width: 100%;
      // white-space: nowrap;
      background-color: var(--surface-base);

      td,
      th {
        //text-align: center;
        padding: var(--space-2);
      }

      td {
        border-bottom: 1px solid var(--border-subtle);
        width: 1%;
      }

      th {
        color: var(--text-strong);
        background: var(--accent-subtle);
      }
      th:nth-child(odd) {
        color: var(--text-strong);
        background: var(--surface-raised);
      }
      tr {
        vertical-align: top;
      }
      tr:nth-child(even) {
        background: var(--surface-raised);
      }
    }
  }

  // .wysiwyg-options {
  //   position: absolute;
  //   bottom: 0;
  //   left: 0;
  //   right: 0;
  // }
}

[data-theme="dark"] .ProseMirror mark {
  color: var(--text-inverse) !important;
}

.wysiwyg-btn-row {
  flex-wrap: wrap;
  min-width: 0;
}

.wysiwyg-mode-switcher {
  flex-shrink: 0;
  min-width: 9rem;
}

.wysiwyg-options {
  overflow: visible;
}

// A-54: on a phone the mode select takes its own row above the tools, which get the full width. The tool row keeps
// wrapping: a sideways scroll would clip the FAQ search that opens above it.
@include max-tablet {
  .wysiwyg-options {
    flex-wrap: wrap;
  }

  .wysiwyg-mode-switcher {
    order: -1;
    flex-basis: 100%;
  }
}

.faq-tooltip-btn {
  flex-shrink: 0;
}

.faq-tooltip-dropdown {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  width: 280px;
  z-index: 200;
  box-shadow: var(--shadow-md);
}

.faq-tooltip-search {
  width: 100%;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-base);
  padding: var(--space-1) var(--space-2);
  font-size: var(--fs-200);
  background: var(--surface-base);
  color: var(--text-body);
  outline: none;

  &:focus {
    border-color: var(--accent);
  }
}

.faq-tooltip-results {
  max-height: 200px;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
}

.faq-tooltip-result {
  cursor: pointer;
  line-height: 1.4;

  &:hover {
    background: var(--surface-raised);
  }
}

.faq-tooltip-urlkey {
  font-size: var(--fs-200);
}

.faq-tooltip-cancel {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: var(--text-secondary);
  font-size: var(--fs-200);

  &:hover {
    color: var(--text-body);
  }
}
</style>
