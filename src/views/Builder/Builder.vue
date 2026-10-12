<template>
  <PageLayout class="builder-wrap fs-300 t-body">
    <template #header>
      <PageHeader
        :title="custom_doc_name || $t('builder.set_name')"
        :back="`/pages/${content_type}`"
        sticky
      >
        <template #meta>
          <ChannelMultiSelect
            v-if="!loading"
            v-model="channels"
            :channels="available_channels"
            :label="$t('builder.channels')"
            :all-label="$t('builder.all')"
          />
          <HomeVariantSwitcher
            v-if="!loading && isHomeDoc"
            ref="homeVariantSwitcher"
            :content-type="content_type"
            :type="type"
            :current-uid="uid"
            :current-channel="channels && channels.length === 1 ? channels[0] : null"
            :available-channels="available_channels"
            @switch="onHomeVariantSwitch"
          />
        </template>
        <template #actions>
          <div v-if="!loading" class="builder-actions flex ai-ct jc-fe wrap gap-3">
            <StatusBadge v-if="isDirty" tone="warning" :dot="false" :label="$t('unsaved.changes')" />
            <ActionBar :actions="editorActions" />
          </div>
        </template>
      </PageHeader>
    </template>
    <ConfirmDialog
      tone="danger"
      :open="confirmation_modal"
      @confirm="
        () => {
          on_delete(section_to_delete);

          confirmation_modal = false;
          section_to_delete = null;
        }
      "
      @cancel="
        () => {
          confirmation_modal = false;
          section_to_delete = null;
        }
      "
      :title="$t('builder.confirm_title')"
    >
      <template #default>
        <p>{{ $t("builder.confirm_msg") }}</p>
      </template>
    </ConfirmDialog>
    <ConfirmDialog
      tone="danger"
      :open="tile_confirmation_modal"
      @confirm="
        () => {
          on_tile_delete(tile_to_delete.tile_uid, tile_to_delete.section_uid);
          tile_confirmation_modal = false;
          tile_to_delete = { tile_uid: null, section_uid: null };
        }
      "
      @cancel="
        () => {
          tile_confirmation_modal = false;
          tile_to_delete = { tile_uid: null, section_uid: null };
        }
      "
      :title="$t('builder.confirm_title')"
    >
      <template #default>
        <p>{{ $t("builder.confirm_msg") }}</p>
      </template>
    </ConfirmDialog>
    <RenameModal
      :visible="rename_modal"
      @reject="rename_modal = false"
      @accept="
        () => {
          if (!copy_doc_label) {
            return;
          }
          if (copy_doc_label === custom_doc_name) {
            return;
          }
          copy_content();
          rename_modal = false;
        }
      "
    >
      <template #header>
        <p class="mb-8">{{ $t("builder.enter_new_doc_name") }}</p>
      </template>

      <template #description>
        <FormField :label="$t('builder.document_name')" :key="`copy-name-label`">
          <BasicInput
            class="bg-base lh-base-elem"
            v-model="copy_doc_label"
          />
        </FormField>
      </template>
    </RenameModal>

    <!-- Advanced options row (collapsible, below the header) -->
    <div
      v-if="advanced_options && !loading"
      class="builder-advanced-row flex ai-ct gap-2"
    >
      <NoticeMe
        :stroke_color_class="'t-secondary'"
        :active="Boolean(!custom_doc_name)"
        :style="[!custom_doc_name ? { padding: '1px' } : {}]"
        class="lh-base-elem"
      >
        <BasicInput
          :placeholder="$t('builder.custom_doc_name')"
          class="fs-200 t-secondary h-100"
          v-model="custom_doc_name"
        />
      </NoticeMe>
      <SubscriberSetter
        v-if="content_type !== 'layout-extender'"
        :is_disabled="isHomeDoc"
        @on_AssetPass="routes = $event"
        :handyType="{ id: 'routes-kit', label: $t('routes.title') }"
        :defaults="{ type, routes }"
      >
        <NoticeMe
          :active="!routes || !routes.length"
          :stroke_color_class="'t-secondary'"
        >
          <BasicButton :stop="false" :disabled="isHomeDoc">
            {{
              !routes || !routes.length
                ? $t("builder.set_url")
                : $t("builder.edit_url")
            }}
          </BasicButton>
        </NoticeMe>
      </SubscriberSetter>
      <SubscriberSetter
        v-if="content_type !== 'layout-extender'"
        @on_AssetPass="meta = $event"
        :handyType="{ id: 'meta-kit', label: $t('builder.meta') }"
        :defaults="{ meta }"
      >
        <BasicButton :stop="false">{{ $t("builder.meta") }}</BasicButton>
      </SubscriberSetter>
      <SubscriberSetter
        v-if="content_type !== 'layout-extender'"
        @on_AssetPass="category = $event"
        :handyType="{ id: 'categories-kit', label: $t('builder.categories') }"
        :defaults="{ category }"
      >
        <BasicButton :stop="false">{{ $t("builder.categories") }}</BasicButton>
      </SubscriberSetter>
    </div>

    <!-- Author picker (shown when content type supports authors) -->
    <div
      v-if="advanced_options && supportsAuthors && !loading"
      class="builder-author-panel"
    >
      <div
        class="builder-author-panel__header"
        @click="authorPanelOpen = !authorPanelOpen"
      >
        <FontAwesomeIcon :icon="$icons.author" />
        <span>{{ $t('authors.title') }}</span>
        <span class="builder-author-panel__count">
          {{ authors.length + co_authors.length }}
        </span>
        <FontAwesomeIcon
          :icon="authorPanelOpen ? $icons.collapse : $icons.expand"
          class="builder-author-panel__chevron"
        />
      </div>
      <div v-if="authorPanelOpen" class="builder-author-panel__body">
        <FormField
          v-for="field in authorFields"
          :key="field.key"
          :label="field.label"
          class="builder-author-panel__col flex-1"
        >
          <draggable
            v-if="$data[field.key].length"
            v-model="$data[field.key]"
            :item-key="(uid) => uid"
            handle=".drag-handle"
            ghost-class="bg-accent-subtle"
            :force-fallback="true"
            fallback-class="drag-ghost"
            class="flex wrap gap-2 mb-2"
          >
            <template #item="{ element }">
              <div class="builder-author-panel__tag flex ai-ct gap-1">
                <FontAwesomeIcon :icon="$icons.drag" class="drag-handle t-muted" />
                <Tag
                  :label="authorLabel(element)"
                  removable
                  @remove="removeAuthor(field.key, element)"
                />
              </div>
            </template>
          </draggable>
          <p v-else class="fs-200 t-muted mb-2">{{ $t("authors.no_authors") }}</p>
          <EntitySearchPicker
            :model-value="null"
            :fetch-fn="searchAuthors"
            :placeholder="$t('authors.search_authors')"
            @update:model-value="addAuthor(field.key, $event)"
          />
        </FormField>
      </div>
    </div>

    <ConfirmDialog
      :open="!!pendingNav"
      @confirm="saveAndLeave"
      @discard="confirmLeave"
      @cancel="cancelLeave"
      :title="$t('unsaved.title')"
      :message="$t('unsaved.message')"
      :confirm-label="$t('unsaved.save_and_leave')"
      :discard-label="$t('unsaved.discard')"
    />

    <!-- Hidden SubscriberSetters triggered by the ActionBar and the FAB -->
    <div style="display: none">
      <SubscriberSetter
        v-if="has_options('document_configs')"
        ref="documentConfigSetter"
        @on_AssetPass="
          ({ reset, ...config }) => {
            document_configs = config;
          }
        "
        :handyType="{
          id: 'configs-kit',
          label: 'Document configurator',
        }"
        :options="{ config_type: 'document_configs' }"
        :defaults="{
          doc_type: type,
          ...document_configs,
          __channels: channels,
        }"
      />
      <SubscriberSetter
        ref="newSectionSetter"
        @on_AssetPass="set_section"
        :handyType="{ id: 'configs-kit', label: $t('builder.new_section') }"
        :options="{ config_type: 'section_configs' }"
        :defaults="{ doc_type: type, __channels: channels }"
        :is_disabled="isSectionLimitReached"
      />
      <SubscriberSetter
        ref="manageOrderSetter"
        @on_AssetPass="sections_order = $event"
        :handyType="{ id: 'order-kit', label: $t('builder.manage_order') }"
        :options="{ config_type: 'section_configs' }"
        :defaults="{
          order: sections_order,
          inserts: sections_order.reduce((o, uid) => {
            const s = sections[uid] || {};
            o[uid] = { title: s.title || null, core_type: s.core_type || null };
            return o;
          }, {}),
        }"
      />
    </div>

    <FloatingActions
      v-if="!handyKitOpen"
      :actions="fabActions"
      :pill="orderPill"
    />

    <div
      class="builder-blog-bar flex ai-ct jc-fe gap-2 mb-16"
      v-if="type === 'blog-post'"
    >
      <BasicTooltip :text="$t('builder.blog_repr_tip')">
        <SubscriberSetter
          @on_AssetPass="blog_extension = $event"
          :handyType="{ id: 'configs-kit', label: 'Blog tile repr.' }"
          :options="{
            config_type: 'tile_configs',
            prevent_configuration: ['core_type'],
          }"
          :defaults="
            blog_extension
              ? { doc_type: type, ...blog_extension, __channels: channels }
              : { doc_type: type, core_type: 'blog-extension-tile', __channels: channels }
          "
        >
          <NoticeMe
            :active="!blog_extension"
            :stroke_color_class="'t-warning'"
          >
            <BasicButton
              size="sm"
              :icon="blog_extension ? null : 'warning'"
              :stop="false"
            >
              {{ $t("builder.blog_repr_tile") }}
            </BasicButton>
          </NoticeMe>
        </SubscriberSetter>
      </BasicTooltip>
      <IconButton
        v-if="blog_extension"
        icon="close"
        size="sm"
        :label="`${$t('common.delete')}: ${$t('builder.blog_repr_tile')}`"
        @click="blog_extension = null"
      />
    </div>
    <div class="grid grid-col-12 pb-30">
      <div class="grid gap-10 gc-s-1 gc-e-13">
        <EmptyState
          v-if="!loading && !sections_order.length"
          icon="add"
          :title="$t('builder.empty_title')"
          :message="$t('builder.empty_message')"
        >
          <BasicButton
            variant="secondary"
            @click="$refs.newSectionSetter?.$el?.click()"
          >
            {{ $t('builder.new_section') }}
          </BasicButton>
        </EmptyState>
        <div
          class="fs-300 grid b-subtle rounded ov-h"
          v-for="(s_uid, s_idx) in sections_order"
          :key="s_idx"
        >
          <div class="grid grid-col-4 t-secondary">
            <div class="gc-s-1 gc-e-5 rounded bb-default">
              <div class="pt-5 pb-5 pl-12 pr-12 bg-base">
                <div class="section-header-row flex jc-sb mb-5">
                  <div class="section-title-wrap">
                    <p class="section-title fs-600 fw-600 t-body">
                      {{ formatCoreType(sections[s_uid]["core_type"]) }}
                      <span class="fs-200 t-muted fw-400 ml-2"
                        >· {{ tileCountLabel(s_uid) }}</span
                      >
                    </p>
                    <p
                      v-if="sections[s_uid].title"
                      class="fs-200 t-secondary lc-1"
                    >
                      {{ sections[s_uid].title }}
                    </p>
                    <p
                      class="section-uid fs-200 t-muted pointer"
                      role="button"
                      tabindex="0"
                      @click="copyToClipboard(s_uid)"
                      @keydown.enter="copyToClipboard(s_uid)"
                      @keydown.space.prevent="copyToClipboard(s_uid)"
                      :title="s_uid"
                    >
                      {{ s_uid.substring(0, 8) }}
                    </p>
                    <!-- Two lines at most, so many props never push the header; the full text is the title. -->
                    <p
                      class="section-config fs-200 t-muted lc-2"
                      data-testid="builder-section-config"
                      :title="sectionConfigSummary(s_uid)"
                    >
                      {{ $t('builder.setted_config') }}: {{ sectionConfigSummary(s_uid) }}
                    </p>
                  </div>
                  <div class="section-actions flex gap-1 as-s ai-ct" data-testid="builder-section-actions">
                    <SubscriberSetter
                      @onSet="edited_section_uid = s_uid"
                      @on_AssetPass="set_section"
                      :handyType="{
                        id: 'configs-kit',
                        label: $t('builder.section'),
                      }"
                      :options="{ config_type: 'section_configs' }"
                      :defaults="{ ...sections[s_uid], __channels: channels }"
                    >
                      <IconButton variant="outline" icon="edit" :label="$t('common.edit')" :stop="false" />
                    </SubscriberSetter>
                    <IconButton
                      variant="outline"
                      icon="duplicate"
                      :label="$t('common.copy')"
                      @click="
                        copy_elem({
                          _to: [`sections_order`, 'sections'],
                          _after: s_idx,
                          copy: sections[s_uid],
                        })
                      "
                    />
                    <IconButton
                      variant="danger"
                      icon="delete"
                      :label="$t('common.delete')"
                      @click="
                        () => {
                          confirmation_modal = true;
                          section_to_delete = s_uid;
                        }
                      "
                    />
                  </div>
                </div>
                <div>
                  <div
                    v-for="(
                      { prop = null, __value, type = null }, i
                    ) in core_properties"
                  >
                    <div v-if="sections[s_uid][prop]" class="mb-5">
                      <p class="t-muted fs-200 mb-1">
                        {{ props_dictionary[prop] }}:
                      </p>
                      <p v-if="type === 'text'" class="fs-200">
                        {{ sections[s_uid][prop] }}
                      </p>
                      <div
                        v-if="type === 'wysiwyg'"
                        v-html="sanitizeHtml(sections[s_uid][prop])"
                        class="wysiwyg-container-preview lc-3 fs-200"
                      ></div>
                      <ImagesControllPreview
                        v-if="type === 'images'"
                        :value="sections[s_uid][prop]"
                      />
                      <GroupFieldsControllerPreview
                        class="w-50 w-100-m"
                        v-if="type === 'group-fields'"
                        :value="sections[s_uid][prop]"
                      />
                      <div v-if="type === 'buttons'" class="flex wrap gap-1">
                        <Tag
                          v-for="(link, idx) in sections[s_uid][prop]"
                          :key="idx"
                          :label="link.link_label || link.link_url || '—'"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="gc-s-1 gc-e-5 bg-raised pt-5 pb-5 pl-12 pr-12">
              <div
                class="t-body rounded"
                v-if="
                  sections[s_uid]['core_type'] !== 'section-slider' ||
                  sections[s_uid]['slider_type'] === 'tiles'
                "
              >
                <template
                  v-if="
                    Boolean(
                      section_options(sections[s_uid]['core_type']) ===
                        'no_options' ||
                        section_options(
                          sections[s_uid]['core_type'],
                          'max_tiles'
                        ) > 0
                    )
                  "
                >
                  <div class="tiles-header flex jc-sb ai-ct">
                    <p class="fs-300 fw-500">
                      {{ $t("builder.tiles") }} ({{
                        `${
                          tiles_order && tiles_order[s_uid]
                            ? tiles_order[s_uid].length
                            : "0"
                        }/${
                          section_options(sections[s_uid]["core_type"]) ===
                          "no_options"
                            ? "~"
                            : section_options(
                                sections[s_uid]["core_type"],
                                "max_tiles"
                              )
                        }`
                      }})
                    </p>
                    <div class="flex gap-1 ai-ct">
                      <SubscriberSetter
                        @onSet="
                          () => {
                            edited_section_uid = s_uid;
                          }
                        "
                        @on_AssetPass="set_tile"
                        :handyType="{
                          id: 'configs-kit',
                          label: $t('builder.add_tile'),
                        }"
                        :options="{ config_type: 'tile_configs' }"
                        :defaults="{
                          doc_type: type,
                          section_core_type: sections[s_uid]['core_type'],
                          __channels: channels,
                        }"
                        :is_disabled="isTileLimitReached(s_uid)"
                      >
                        <IconButton
                          variant="primary"
                          icon="add"
                          :label="$t('builder.add_tile')"
                          :disabled="isTileLimitReached(s_uid)"
                          :stop="false"
                        />
                      </SubscriberSetter>

                      <SubscriberSetter
                        v-if="tiles_order[s_uid] && tiles_order[s_uid].length"
                        @on_AssetPass="tiles_order[s_uid] = $event"
                        :handyType="{
                          id: 'order-kit',
                          label: $t('builder.manage_tile_order'),
                        }"
                        :options="{ config_type: 'tiles_configs' }"
                        :defaults="{
                          order: tiles_order[s_uid],
                          inserts: tiles_order[s_uid].reduce((o, uid) => {
                            const t = tiles[uid] || {};
                            o[uid] = {
                              title: t.title || null,
                              core_type: t.core_type || null,
                              sku: t.sku || null,
                              product_sku: t.product_sku || null,
                            };
                            return o;
                          }, {}),
                        }"
                      >
                        <IconButton
                          variant="outline"
                          icon="reorder"
                          :label="$t('builder.manage_tile_order')"
                          :stop="false"
                        />
                      </SubscriberSetter>
                      <IconButton
                        v-if="tiles_order[s_uid] && tiles_order[s_uid].length"
                        variant="outline"
                        icon="preview"
                        :label="$t('builder.preview')"
                        :pressed="section_tiles_details === s_uid"
                        @click="
                          section_tiles_details &&
                          section_tiles_details == s_uid
                            ? (section_tiles_details = null)
                            : (section_tiles_details = s_uid)
                        "
                      />
                    </div>
                  </div>
                </template>
              </div>
              <div class="mt-5">
                <div
                  class="tile-swiper-wrap"
                  v-if="
                    tiles_order[s_uid] &&
                    tiles_order[s_uid].length &&
                    section_tiles_details !== s_uid
                  "
                >
                  <BasicSwiper
                    :key="`${tiles_order[s_uid].length}-${belowTablet}`"
                    :uid_class="`tiles-slider-${s_uid}`"
                    :options="{
                      cssMode: belowTablet,
                      slidesPerView: 1.25,
                      spaceBetween: 10,
                      breakpoints: {
                        480: {
                          slidesPerView: 2.15,
                        },
                        768: {
                          slidesPerView: 3.25,
                        },
                        1200: {
                          slidesPerView: 4.25,
                        },
                        1700: {
                          slidesPerView: 5.15,
                        },
                      },
                    }"
                  >
                    <template
                      v-for="(t_uid, index) in tiles_order[s_uid]"
                      :key="t_uid"
                    >
                      <div v-if="tiles[t_uid] && tiles[t_uid].core_type" class="swiper-slide">
                        <div
                          class="bg-hover t-body rounded pl-2 pr-2 pt-2 pb-2 ai-ct grid gap-1"
                        >
                          <div class="flex-column ai-fe">
                            <p class="fs-200 t-body fw-600 txt-right lc-1">
                              {{ formatCoreType(tiles[t_uid]["core_type"]) }}
                            </p>
                            <p
                              v-if="tiles[t_uid].title"
                              class="fs-200 t-muted lc-1 txt-right"
                            >
                              {{ tiles[t_uid].title }}
                            </p>
                            <p
                              v-else-if="
                                tiles[t_uid].product_sku || tiles[t_uid].sku
                              "
                              class="fs-200 t-accent lc-1 txt-right"
                            >
                              SKU:
                              {{ tiles[t_uid].product_sku || tiles[t_uid].sku }}
                            </p>
                            <div
                              v-if="tileFirstImage(t_uid)"
                              class="tile-card-thumb mt-1"
                            >
                              <img
                                :src="tileFirstImage(t_uid)"
                                alt=""
                                class="tile-card-thumb__img"
                                @error="
                                  (e) => (e.target.style.display = 'none')
                                "
                              />
                            </div>
                          </div>

                          <div class="tile-actions flex gap-1 jc-fe mt-5">
                            <IconButton
                              variant="outline"
                              icon="duplicate"
                              :label="$t('common.copy')"
                              :disabled="isTileLimitReached(s_uid)"
                              @click="
                                copy_elem({
                                  _to: [`tiles_order:${s_uid}`, 'tiles'],
                                  _after: index,
                                  copy: tiles[t_uid],
                                })
                              "
                            />
                            <SubscriberSetter
                              @onSet="
                                () => {
                                  edited_section_uid = s_uid;
                                  edited_tile_uid = t_uid;
                                }
                              "
                              @on_AssetPass="set_tile"
                              :handyType="{
                                id: 'configs-kit',
                                label: $t('builder.tile'),
                              }"
                              :options="{ config_type: 'tile_configs' }"
                              :defaults="{
                                doc_type: type,
                                section_core_type: sections[s_uid]['core_type'],
                                ...tiles[t_uid],
                                __channels: channels,
                              }"
                            >
                              <IconButton variant="outline" icon="edit" :label="$t('common.edit')" :stop="false" />
                            </SubscriberSetter>
                            <IconButton
                              variant="danger"
                              icon="delete"
                              :label="$t('common.delete')"
                              @click="
                                () => {
                                  tile_confirmation_modal = true;
                                  tile_to_delete = {
                                    tile_uid: t_uid,
                                    section_uid: s_uid,
                                  };
                                }
                              "
                            />
                          </div>
                        </div>
                      </div>
                    </template>
                  </BasicSwiper>
                </div>
                <div
                  class="grid grid-col-4 gap-2 bg-raised"
                  v-if="section_tiles_details === s_uid"
                >
                  <template
                    v-for="(t_uid, index) in tiles_order[s_uid]"
                    :key="t_uid"
                  >
                    <div v-if="tiles[t_uid] && tiles[t_uid].core_type">
                      <div
                        class="rounded p-2 bg-hover grid gap-2 b-default"
                      >
                        <div class="">
                          <div class="mb-5">
                            <div class="flex jc-sb ai-st">
                              <div>
                                <p class="fs-200 fw-500 t-secondary">
                                  {{
                                    formatCoreType(tiles[t_uid]["core_type"])
                                  }}
                                </p>
                                <p
                                  class="fs-200 t-muted pointer mt-1"
                                  role="button"
                                  tabindex="0"
                                  @click="copyToClipboard(t_uid)"
                                  @keydown.enter="copyToClipboard(t_uid)"
                                  @keydown.space.prevent="copyToClipboard(t_uid)"
                                  :title="t_uid"
                                >
                                  {{ t_uid.substring(0, 8) }}
                                </p>
                              </div>
                            </div>
                          </div>

                          <template
                            v-for="(
                              { prop = null, type = null }, i
                            ) in core_properties"
                          >
                            <div
                              v-if="tiles[t_uid][prop]"
                              class="mb-2 fs-200"
                            >
                              <p
                                class="t-muted fw-600 underline fs-200 mb-1"
                              >
                                {{ props_dictionary[prop] }}:
                              </p>
                              <p v-if="type === 'text'">
                                {{ tiles[t_uid][prop] }}
                              </p>
                              <p
                                v-if="type === 'wysiwyg'"
                                v-html="sanitizeHtml(tiles[t_uid][prop])"
                                class="lc-3 fs-200"
                              ></p>
                              <ImagesControllPreview
                                v-if="type === 'images'"
                                :value="tiles[t_uid][prop]"
                              />
                              <GroupFieldsControllerPreview
                                class=""
                                v-if="type === 'group-fields'"
                                :value="tiles[t_uid][prop]"
                              />
                              <div
                                v-if="type === 'buttons'"
                                class="flex wrap gap-1"
                              >
                                <Tag
                                  v-for="(link, idx) in tiles[t_uid][prop]"
                                  :key="idx"
                                  :label="link.link_label || link.link_url || '—'"
                                />
                              </div>
                            </div>
                          </template>
                        </div>

                        <div class="tile-actions flex jc-fe gap-1 as-fe">
                          <IconButton
                            variant="outline"
                            icon="duplicate"
                            :label="$t('common.copy')"
                            :disabled="isTileLimitReached(s_uid)"
                            @click="
                              copy_elem({
                                _to: [`tiles_order:${s_uid}`, 'tiles'],
                                _after: index,
                                copy: tiles[t_uid],
                              })
                            "
                          />
                          <SubscriberSetter
                            @onSet="
                              () => {
                                edited_section_uid = s_uid;
                                edited_tile_uid = t_uid;
                              }
                            "
                            @on_AssetPass="set_tile"
                            :handyType="{
                              id: 'configs-kit',
                              label: $t('builder.tile'),
                            }"
                            :options="{ config_type: 'tile_configs' }"
                            :defaults="{
                              doc_type: type,
                              section_core_type: sections[s_uid]['core_type'],
                              ...tiles[t_uid],
                              __channels: channels,
                            }"
                          >
                            <IconButton variant="outline" icon="edit" :label="$t('common.edit')" :stop="false" />
                          </SubscriberSetter>
                          <IconButton
                            variant="danger"
                            icon="delete"
                            :label="$t('common.delete')"
                            @click="
                              () => {
                                tile_confirmation_modal = true;
                                tile_to_delete = {
                                  tile_uid: t_uid,
                                  section_uid: s_uid,
                                };
                              }
                            "
                          />
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script>
import { computed } from "vue";
import { cloneDeep } from "lodash";
import { useNotifyStore } from "@/stores/notify";
import { useUserStore } from "@/stores/user";
import { useHandyStore } from "@/stores/handy";
import { useAccessStore } from "@/stores/access";
import { AREAS } from "@/configs/areas";
import { v4 as uuidv4 } from "uuid";

import { _METHOD_content, GET_Authors, GET_ContentTypes } from "@/api/contentDB/api";
import draggable from "vuedraggable";
import { useContentDBChannelStore } from "@/stores/contentDBChannel";

import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import ImagesControllPreview from "@/configs/builder/components/ImagesController/_preview.vue";
import GroupFieldsControllerPreview from "@/configs/builder/components/GroupFieldsController/_preview.vue";
import RenameModal from "@/functionals/Rename-modal/index.vue";
import HomeVariantSwitcher from "@/views/Builder/HomeVariantSwitcher.vue";
import { pluralKey } from "@/utils/plural";
import { useMediaQuery } from "@/composables/useMediaQuery";
import { MAX_TABLET_QUERY } from "@/utils/breakpoints";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

export default {
  components: {
    ImagesControllPreview,
    GroupFieldsControllerPreview,
    RenameModal,
    draggable,
    HomeVariantSwitcher,
  },
  beforeRouteLeave(to, from, next) {
    this.guardNavigation(to, from, next);
  },
  setup() {
    const notify = useNotifyStore();
    const userStore = useUserStore();
    const handy = useHandyStore();
    const unsaved = useUnsavedChanges();
    const contentDBChannel = useContentDBChannelStore();
    // Below tablet the tile row scrolls natively (a real sideways scroller); wider screens keep Swiper's drag.
    const belowTablet = useMediaQuery(MAX_TABLET_QUERY);
    // Publishing is its own area: a role that edits pages but does not publish keeps the draft only. UX only.
    const access = useAccessStore();
    const canPublish = computed(() => access.can(AREAS.CONTENT_PUBLISH, "write"));
    return { notify, userStore, handy, ...unsaved, contentDBChannel, belowTablet, canPublish };
  },
  computed: {
    authorFields() {
      return [
        { key: "authors", label: this.$t("authors.primary") },
        { key: "co_authors", label: this.$t("authors.co_authors") },
      ];
    },
    user() {
      return this.userStore.user;
    },
    handyKitOpen() {
      return this.handy.handyType;
    },
    available_channels() {
      return this.contentDBChannel.channels;
    },
    isHomeDoc() {
      return Array.isArray(this.routes) && this.routes.includes("home");
    },
    isSectionLimitReached() {
      return (
        !Boolean(this.section_options(this.type) === "no_options") &&
        Boolean(
          this.sections_order &&
            this.sections_order.length ==
              this.section_options(this.type, "max_sections")
        )
      );
    },
    // The closed advanced row holds the name and URL: while either is missing its toggle asks for attention.
    advancedNeedsAttention() {
      const urlMissing = this.content_type !== "layout-extender" && !this.routes?.length;
      return !this.advanced_options && (urlMissing || !this.custom_doc_name);
    },
    // R5 order comes from the roles (ActionBar): copy · advanced · document options · draft · publish.
    editorActions() {
      const utility = (key, icon, label, onClick) => ({ key, role: "utility", icon, label, onClick });
      return [
        utility("copy", "duplicate", this.$t("builder.copy"), () => (this.rename_modal = true)),
        {
          ...utility("advanced", this.advanced_options ? "close" : "settings", this.$t("builder.advanced"), () =>
            (this.advanced_options = !this.advanced_options)),
          // The cue is the warning icon and the name, not the accent fill: that stays Publish's (R5). A layout extender
          // has no URL, so its name asks for the document name only.
          ...(this.advancedNeedsAttention
            ? { icon: "warning", label: this.$t(this.content_type === "layout-extender" ? "builder.advanced_missing_name" : "builder.advanced_missing") }
            : {}),
          testid: "builder-advanced-toggle",
        },
        ...(this.has_options("document_configs")
          ? [utility("document-options", "edit", this.$t("builder.document_options"), () =>
              this.$refs.documentConfigSetter?.$el?.click())]
          : []),
        { key: "draft", role: "secondary", icon: "saveDraft", onClick: this.saveDraft,
          label: this.uid ? this.$t("builder.save_draw") : this.$t("builder.post_draw") },
        this.canPublish && { key: "publish", role: "primary", icon: "publish", onClick: this.saveAndPublish,
          label: this.$t("builder.publish_document"), disabled: !this.uid },
      ].filter(Boolean);
    },
    // R6, R7: the section order is an important action, so it gets a visible label next to the FAB.
    orderPill() {
      return {
        icon: "reorder",
        label: this.$t("builder.manage_order"),
        handler: () => this.$refs.manageOrderSetter?.$el?.click(),
        testid: "builder-order-pill",
      };
    },
    fabActions() {
      return [
        {
          icon: "add",
          label: this.$t("builder.new_section"),
          handler: () => this.$refs.newSectionSetter?.$el?.click(),
          disabled: this.isSectionLimitReached,
        },
      ];
    },
  },
  data() {
    return {
      loading: false,
      config_options: null,
      props_dictionary: {},
      core_config: null,
      optional_config: null,
      core_properties: null,
      languages: null,
      // ------------------
      asset: null,
      param: null,

      language: null,
      custom_doc_name: "",
      content_type: null,
      type: null,
      uid: null,
      // -------------------------------
      blog_extension: null,
      // -------------------------------
      attributes: {},
      category: null,
      document_configs: {},
      content: {},
      sections: {},
      sections_order: [],
      tiles: {},
      tiles_order: {},
      access_rights: [],
      channels: [],
      //----------------------
      processing_section: null,
      // ----------------------
      meta: null,
      // ----------------------
      routes: null,
      // ----------------------
      mode: null,
      edited_section_uid: null,
      edited_tile_uid: null,
      section_tiles_details: null,
      //
      advanced_options: false,
      authors: [],
      co_authors: [],
      authorNames: {},
      authorRoles: {},
      supportsAuthors: false,
      authorPanelOpen: false,
      rename_modal: false,
      copy_doc_label: "",
      confirmation_modal: false,
      section_to_delete: null,
      tile_confirmation_modal: false,
      tile_to_delete: { tile_uid: null, section_uid: null },
    };
  },
  methods: {
    sanitizeHtml,
    // The author fields (EntitySearchPicker): the picker adds one author to a list, the Tags above it remove and
    // reorder; an author already in either list is not offered again.
    async searchAuthors(search) {
      const params = { is_active: true, page_size: 20, ...(search ? { search } : {}) };
      const { data } = await GET_Authors(params);
      const picked = [...this.authors, ...this.co_authors];
      const found = (data.results || []).filter((a) => !picked.includes(a.uid));
      this.rememberAuthorNames(found);
      return found.map((a) => ({ label: a.name, value: a.uid, secondary: Object.values(a.role_t9n || {})[0] || "" }));
    },
    rememberAuthorNames(list) {
      list.forEach((a) => {
        this.authorNames[a.uid] = a.name;
        this.authorRoles[a.uid] = Object.values(a.role_t9n || {})[0] || "";
      });
    },
    authorLabel(uid) {
      const role = this.authorRoles[uid];
      const name = this.authorNames[uid] || uid;
      return role ? `${name} — ${role}` : name;
    },
    addAuthor(key, uid) {
      if (uid && !this[key].includes(uid)) this[key] = [...this[key], uid];
    },
    removeAuthor(key, uid) {
      this[key] = this[key].filter((u) => u !== uid);
    },
    formatCoreType(coreType) {
      if (!coreType) return "";
      return coreType
        .replace(/^(section|tile)-/, "")
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    },
    tileCountLabel(s_uid) {
      const count = this.tiles_order[s_uid]?.length || 0;
      return this.$t(`builder.tiles_${pluralKey(count)}`, { count });
    },
    copyToClipboard(text) {
      navigator.clipboard.writeText(text);
      this.notify.spawnNotification({
        title: "Copied",
        msg: text.substring(0, 8) + "...",
        type: "informative",
      });
    },
    tileFirstImage(t_uid) {
      const imageSet = this.tiles[t_uid]?.images_set;
      if (!imageSet) return null;
      const first = Object.values(imageSet)[0];
      const url = first?.image;
      if (!url) return null;
      return url.startsWith("http")
        ? url
        : (process.env.VUE_APP_API_URL || "") + url;
    },
    async load_configs() {
      try {
        const client = process.env.VUE_APP_CLIENT || "__client";

        const [configOptions, coreConfig, optionalConfig, coreProps] =
          await Promise.all([
            import(`@/../${client}/configs/__config_options`),
            import(`@/../${client}/configs/__core_config`),
            import(`@/../${client}/configs/__optional_config`),
            import(`@/../${client}/props/__props`),
          ]);

        this.config_options = configOptions.default;
        this.core_config = coreConfig.default;
        this.optional_config = optionalConfig.default;
        this.core_properties = coreProps.default;

        // Build props dictionary after loading configs
        this.props_dictionary = [
          ...this.optional_config,
          ...this.core_config,
          ...this.core_properties,
        ].reduce((d, { prop = null, label = null }) => {
          const propVal = this.$t("prop." + prop);
          const configVal = this.$t("config." + prop);
          d[prop] =
            propVal !== "prop." + prop
              ? propVal
              : configVal !== "config." + prop
              ? configVal
              : label;
          return d;
        }, {});
      } catch (error) {
        console.error("Failed to load configs:", error);
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          msg: this.$t("notifications.config_load_error"),
          type: "negative",
        });
      }
    },
    has_options(NAME) {
      if (!this.core_config || !this.optional_config) return false;
      const configs = [...this.core_config, ...this.optional_config];
      const _options = configs.some(({ _for = null }) => {
        if (!_for) return false;
        if (_for[NAME]) return true;
        return false;
      });
      return _options;
    },
    sectionConfigSummary(s_uid) {
      if (!this.core_config || !this.optional_config) return "—";
      return (
        [...this.core_config, ...this.optional_config]
          .filter(({ prop }) => this.sections[s_uid]?.[prop])
          .map(
            ({ prop }) =>
              `${this.props_dictionary[prop]}: ${this.sections[s_uid][prop]}`
          )
          .join(" · ") || "—"
      );
    },
    // A section whose type caps its tiles takes no more once the cap is reached (tile add and copy).
    isTileLimitReached(s_uid) {
      const coreType = this.sections[s_uid]?.core_type;
      if (this.section_options(coreType) === "no_options") return false;
      const order = this.tiles_order[s_uid];
      return Boolean(order) && order.length == this.section_options(coreType, "max_tiles");
    },
    section_options(value, look_for = null) {
      if (!this.config_options || !this.config_options[value])
        return "no_options";
      if (look_for) return this.config_options[value][look_for];
      return this.config_options[value];
    },
    set_section({ reset, ...section }) {
      if (reset) {
        this.edited_section_uid = null;
        return;
      }

      delete section["reset"];

      const uid = this.edited_section_uid ?? uuidv4();
      const _sections = { ...this.sections };
      const _sections_order = [...this.sections_order];
      _sections[uid] = section;

      const _index = this.sections_order.indexOf(uid);

      _index === -1
        ? _sections_order.push(uid)
        : _sections_order.splice(_index, 1, uid);

      this.sections = _sections;
      this.sections_order = _sections_order;

      this.edited_section_uid = null;
    },
    copy_elem({ _to = null, _after = null, copy = null }) {
      const uid = uuidv4();
      const _copy = cloneDeep(copy);
      const [order, group] = _to;
      const [context, param] = order.split(":");

      !param
        ? this[context].splice(_after + 1, 0, uid)
        : this[context][param].splice(_after + 1, 0, uid);

      this[group][uid] = _copy;
      // this.sections_order.splice(_after + 1, 0, uid);
      // this[_from][uid] = _copy;
    },
    set_tile(tile, type = "add") {
      const _relared = this.edited_section_uid;
      const uid = this.edited_tile_uid ?? uuidv4();
      const _tiles = { ...this.tiles };
      const _tiles_order = { ...this.tiles_order };

      if (!_tiles_order[_relared]) _tiles_order[_relared] = [];

      const _index = _tiles_order[_relared].indexOf(uid);

      _tiles[uid] = tile;

      _index === -1
        ? _tiles_order[_relared].push(uid)
        : _tiles_order[_relared].splice(_index, 1, uid);

      this.tiles = _tiles;
      this.tiles_order = _tiles_order;

      this.edited_section_uid = null;
      this.edited_tile_uid = null;
    },
    on_delete(uid) {
      const _sections = { ...this.sections };
      let _sections_order = [...this.sections_order];

      delete _sections[uid];
      _sections_order = _sections_order.filter((_uid) => _uid !== uid);

      this.sections = _sections;
      this.sections_order = _sections_order;

      // clear tiles if need
      //const _tiles = { ...this.tiles };
      let _tiles_order = { ...this.tiles_order };

      if (_tiles_order[uid]) {
        const relative_ids = _tiles_order[uid];
        const _tiles = { ...this.tiles };
        relative_ids.forEach((relative_id) => delete _tiles[relative_id]);

        delete _tiles_order[uid];

        this.tiles = _tiles;
        this.tiles_order = _tiles_order;
      }
    },
    on_tile_delete(tile_uid, relation) {
      const _tiles = { ...this.tiles };
      let _tiles_order = [...this.tiles_order[relation]];

      delete _tiles[tile_uid];
      _tiles_order = _tiles_order.filter((_uid) => _uid !== tile_uid);

      this.tiles = _tiles;

      _tiles_order.length
        ? (this.tiles_order[relation] = _tiles_order)
        : delete this.tiles_order[relation];
    },
    async copy_content() {
      this.Modify_content({
        method: "post",
        url: `/${this.content_type}/${this.type}/`,
        payload: {
          attributes: this.attributes,
          category: this.category,
          content: {
            document_configs: this.document_configs,
            sections: this.sections,
            sections_order: this.sections_order,
            tiles: this.tiles,
            tiles_order: this.tiles_order,
          },
          extension: this.blog_extension,
          language: this.language,
          meta: this.meta,
          routes: [],
          name: this.copy_doc_label,
          access_rights: this.access_rights,
          channels: this.channels,
        },
      });
      this.custom_doc_name = this.copy_doc_label;
      this.routes = [];
    },
    getPayload() {
      return {
        attributes: this.attributes,
        category: this.category,
        content: {
          document_configs: this.document_configs,
          sections: this.sections,
          sections_order: this.sections_order,
          tiles: this.tiles,
          tiles_order: this.tiles_order,
        },
        extension: this.blog_extension,
        language: this.language,
        meta: this.meta,
        routes:
          this.content_type !== "layout-extender"
            ? this.routes ?? []
            : [`${this.content_type}-${this.type}`],
        name: this.custom_doc_name,
        access_rights: this.access_rights,
        channels: this.channels,
        ...(this.supportsAuthors
          ? {
              author_uids: this.authors,
              co_author_uids: this.co_authors,
            }
          : {}),
      };
    },
    async validateHomeRules({ channels, exclude_uid } = {}) {
      if (!this.isHomeDoc) return null;
      const ch = channels ?? this.channels ?? [];
      if (ch.length === 0) return this.$t("builder.home_no_channel_error");
      if (ch.length > 1) return this.$t("builder.home_multi_channel_error");
      const channel_idx = ch[0];
      try {
        const { data: response } = await _METHOD_content({
          method: "get",
          url: `/${this.content_type}/${this.type}/`,
          params: { routes: ["home"], channel: channel_idx },
        });
        const list = response?.data || [];
        const exclude = exclude_uid === undefined ? this.uid : exclude_uid;
        const conflict = list.find(
          (d) => d.uid !== exclude && (d.channels || []).includes(channel_idx)
        );
        if (conflict) {
          return this.$t("builder.home_duplicate_error", { channel: channel_idx });
        }
      } catch (error) {
        console.warn("validateHomeRules: API check failed", error);
      }
      return null;
    },
    notifyHomeError(msg) {
      this.notify.spawnNotification({
        type: "negative",
        title: this.$t("notifications.error"),
        msg,
      });
    },
    async saveDraft() {
      const error = await this.validateHomeRules();
      if (error) {
        this.notifyHomeError(error);
        return;
      }
      this.Modify_content({
        method: this.uid ? "put" : "post",
        url: `/${this.content_type}/${this.type}/${
          this.uid ? `${this.uid}/` : ""
        }`,
        payload: this.getPayload(),
      });
    },
    async saveAndPublish() {
      if (!this.uid) return;
      const error = await this.validateHomeRules();
      if (error) {
        this.notifyHomeError(error);
        return;
      }
      await this.Modify_content({
        method: "put",
        url: `/${this.content_type}/${this.type}/${this.uid}/`,
        payload: this.getPayload(),
        silent: true,
      });
      await this.Modify_content({
        method: "post",
        url: `/${this.content_type}/${this.type}/${this.uid}/published/`,
        payload: this.getPayload(),
      });
    },
    async saveAndLeave() {
      await this.saveDraft();
      this.confirmLeave();
    },
    async onHomeVariantSwitch({ channel_idx, target_uid }) {
      if (target_uid) {
        this.$router.push(`/pages/${this.content_type}/${target_uid}`);
        return;
      }
      if (this.isDirty) {
        const ok = window.confirm(
          this.$t("builder.home_create_confirm_dirty", { channel: channel_idx })
        );
        if (!ok) return;
      }
      await this.createHomeForChannel(channel_idx);
    },
    async createHomeForChannel(channel_idx) {
      const error = await this.validateHomeRules({
        channels: [channel_idx],
        exclude_uid: null,
      });
      if (error) {
        this.notifyHomeError(error);
        return;
      }
      const default_lang = (
        this.contentDBChannel.defaultLanguage || "en"
      ).toUpperCase();
      const clone = JSON.parse(
        JSON.stringify({
          attributes: this.attributes ?? {},
          category: this.category ?? null,
          content: {
            document_configs: this.document_configs ?? {},
            sections: this.sections ?? {},
            sections_order: this.sections_order ?? [],
            tiles: this.tiles ?? {},
            tiles_order: this.tiles_order ?? {},
          },
          extension: this.blog_extension ?? null,
          meta: this.meta ?? { title: "Home", description: "" },
          access_rights: this.access_rights?.length ? this.access_rights : [1],
        })
      );
      const payload = {
        ...clone,
        language: this.language || default_lang,
        routes: ["home"],
        name: `Home (${channel_idx})`,
        channels: [channel_idx],
      };
      try {
        const { data: response } = await _METHOD_content({
          method: "post",
          url: `/${this.content_type}/${this.type}/`,
          payload,
        });
        const new_uid = response?.data?.uid;
        if (new_uid) {
          this.notify.spawnNotification({
            type: "informative",
            title: this.$t("notifications.success"),
            msg: this.$t("builder.home_created"),
          });
          this.$router.push(`/pages/${this.content_type}/${new_uid}`);
        }
      } catch (error) {
        this.notify.spawnNotification({
          type: "negative",
          title: this.$t("notifications.error"),
          msg: this.$t("notifications.save_error"),
        });
      }
    },
    snapshotFormState() {
      const state = {
        custom_doc_name: this.custom_doc_name,
        routes: this.routes,
        meta: this.meta,
        category: this.category,
        access_rights: this.access_rights,
        channels: this.channels,
        document_configs: this.document_configs,
        sections: this.sections,
        sections_order: this.sections_order,
        tiles: this.tiles,
        tiles_order: this.tiles_order,
        blog_extension: this.blog_extension,
        attributes: this.attributes,
      };
      this.snapshot(state);
      this.track(state);
    },
    async Modify_content({
      method = "post",
      url = null,
      param = null,
      payload = null,
      silent = false,
      ...options
    }) {
      try {
        const { data: response } = await _METHOD_content({
          method,
          url,
          param,
          payload,
          ...options,
        });

        if (!silent) {
          this.notify.spawnNotification({
            title: this.$t("notifications.success"),
            msg: this.$t("notifications.doc_saved"),
            type: "informative",
          });
        }

        this.$nextTick(() => this.snapshotFormState());

        if (method === "post") {
          const { data = {} } = response;
          const { content = [], uid = null } = data;
          // check if PUBLISH
          const is_publishing = url.split("/").includes("published");
          if (is_publishing) return;
          // -------------------------
          this.uid = uid;
          this.$router.replace({
            name: "Builder",
            params: { type: this.type, uid: uid },
            query: { lg: this.language },
          });
        }
      } catch (error) {
        console.log("Error!", error);
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          msg: this.$t("notifications.save_error"),
          type: "negative",
        });
      }
    },
    async GET_content({ url = null, method = "get" }) {
      try {
        const { data: response } = await _METHOD_content({
          method,
          url,
        });
        const { data = null, meta: r_meta = null } = response;

        if (![data, r_meta].every(Boolean)) return;

        const {
          attributes = {},
          category = null,
          content = {},
          meta = null,
          language = this.contentDBChannel.defaultLanguage.toUpperCase(),
          name = null,
          routes = null,
          extension = null,
          access_rights = [],
          channels = [],
          authors: authorsData = [],
          co_authors: coAuthorsData = [],
          content_type: contentTypeSlug = "",
        } = data;
        const {
          document_configs = {},
          sections = {},
          sections_order = [],
          tiles = {},
          tiles_order = {},
        } = content;
        this.attributes = attributes;
        this.document_configs = document_configs;
        this.category = category;
        this.sections = sections;
        this.sections_order = sections_order;
        this.tiles = tiles;
        this.tiles_order = tiles_order;
        this.meta = meta;
        this.routes = routes;
        this.language = language;
        this.custom_doc_name = name;
        this.blog_extension = extension;
        this.access_rights = !access_rights.length ? [1] : access_rights;
        this.channels = channels;
        this.authors = (authorsData || []).map((a) => a.uid);
        this.co_authors = (coAuthorsData || []).map((a) => a.uid);
        this.rememberAuthorNames([...(authorsData || []), ...(coAuthorsData || [])]);

        // Check if content type supports authors
        try {
          const { data: ctRes } = await GET_ContentTypes({ CDB_TYPE: "content" });
          const cts = ctRes?.data || [];
          const ct = cts.find((t) => t.slug === contentTypeSlug);
          this.supportsAuthors = Boolean(ct && ct.supports_authors);
        } catch {
          this.supportsAuthors = false;
        }
      } catch (error) {
        console.log("error ", error);
      }
    },

    async SET_PREVIEW() {
      let _uid = this.uid;
      // REMOVE ALL OTHER PREVIEWS
      // -----
      // -----
      try {
        const { data: response } = await _METHOD_content({
          method: "get",
          url: `/${this.content_type}/${this.type}/`,
          params: { routes: ["preview"] },
        });
        const { data = [] } = response;
        const _data = data.filter(({ uid }) => uid !== _uid);

        if (Array.isArray(_data) && _data.length) {
          _data.forEach(({ uid = null, routes = [], ...doc }) => {
            // remove PREVIEW ROUTE FROM OTHERS
            // this.Modify_content({
            //   method: "put",
            //   url: `/${this.content_type}/${this.type}/${uid}/`,
            //   payload: {
            //     ...doc,
            //     routes: routes.filter((r) => r !== "preview"),
            //   },
            // });

            _METHOD_content({
              method: "put",
              url: `/${this.content_type}/${this.type}/${uid}/`,
              payload: {
                ...doc,
                routes: routes.filter((r) => r !== "preview"),
              },
            });
            _METHOD_content({
              method: "post",
              url: `/${this.content_type}/${this.type}/${uid}/published/`,
              payload: {
                ...doc,
                routes: routes.filter((r) => r !== "preview"),
              },
            });
            // TODO check if not need to remove from published
          });
        }
      } catch (error) {
        console.log("Error");
        console.log(error);
      }
      // return;
      // SAVE DRAFT
      // -----
      // -----
      try {
        await this.Modify_content({
          method: _uid ? "put" : "post",
          url: `/${this.content_type}/${this.type}/${_uid ? `${_uid}/` : ""}`,
          payload: {
            attributes: this.attributes,
            category: this.category,
            content: {
              sections: this.sections,
              sections_order: this.sections_order,
              tiles: this.tile,
              tiles_order: this.tiles_order,
            },
            extension: this.blog_extension,
            language: this.language,
            meta: this.meta,
            routes: this.routes ? [...this.routes, "preview"] : ["preview"],
            name: this.custom_doc_name,
          },
        });

        this.notify.spawnNotification({
          title: this.$t("notifications.preview_generated"),
          msg: this.$t("notifications.preview_available"),
          type: "positive",
        });
      } catch (error) {
        console.log(error);
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          msg: this.$t("notifications.save_error"),
          type: "negative",
        });
      }
      // POST Publish
      try {
        const { data: response } = await _METHOD_content({
          method: "post",
          url: `/${this.content_type}/${this.type}/${this.uid}/published/`,
          payload: {
            attributes: this.attributes,
            category: this.category,
            content: {
              sections: this.sections,
              sections_order: this.sections_order,
              tiles: this.tile,
              tiles_order: this.tiles_order,
            },
            extension: this.blog_extension,
            language: this.language,
            meta: this.meta,
            routes: this.routes ? [...this.routes, "preview"] : ["preview"],
            name: this.custom_doc_name,
          },
        });
      } catch (error) {
        console.log(error);
        this.notify.spawnNotification({
          title: this.$t("notifications.error"),
          msg: this.$t("notifications.save_error"),
          type: "negative",
        });
      }
    },
    async init() {
      const {
        content_type = "content",
        type = "static-page",
        uid = null,
      } = this.$route.params;
      const { lg = null } = this.$route.query;
      this.content_type = content_type;
      this.type = type;
      this.uid = uid;
      this.language = lg ? lg.toUpperCase() : null;
      try {
        this.loading = true;
        // Load configs first
        await this.load_configs();
        await this.contentDBChannel.fetchChannelsAndLanguages();

        // Use store's default language when no ?lg= query param
        if (!this.language) {
          this.language = this.contentDBChannel.defaultLanguage.toUpperCase();
        }

        if (uid) {
          await this.GET_content({
            method: "get",
            url: `/${content_type}/${type}/${uid}/`,
          });
        }

        // await this.GET_languages();
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        this.loading = false;
        this.$nextTick(() => this.snapshotFormState());
      }
    },
  },
  created() {
    this.init();
  },
};
</script>

<style lang="scss">
.builder-wrap {
  flex: 1;
  min-height: 0;

  @media screen and (max-width: 40rem) {
    .grid {
      display: flex;
      flex-direction: column;
    }
    .pl-12 {
      padding-left: var(--space-4);
    }
    .pr-12 {
      padding-right: var(--space-4);
    }
  }
}

[data-theme="dark"] .wysiwyg-container-preview span[style*="color"] {
  color: var(--text-body) !important;
}

.wysiwyg-container-preview {
  line-height: 1.7;

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
      text-align: center;
      padding: var(--space-2);
    }

    tbody > tr:nth-child(n + 3) {
      display: none;
    }
    tbody tr:first-of-type {
      vertical-align: middle;
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
</style>
<style lang="scss" scoped>
@import "@/assets/scss/utils/media-query";

// On a phone the sticky page head holds the top edge: the blog bar scrolls with the content there.
.builder-blog-bar {
  @include min-tablet {
    position: sticky;
    top: 0;
    z-index: 2;
  }
}
.builder-advanced-row {
  flex-wrap: wrap;
}
.builder-author-panel {
  flex-shrink: 0;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-base);
  background: var(--surface-base);

  &__header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    font-size: var(--fs-200);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-accent);
    cursor: pointer;
    user-select: none;
    transition: background-color 0.15s;
    &:hover {
      background: var(--surface-raised);
    }
  }

  &__chevron {
    margin-left: auto;
    font-size: var(--fs-200);
    color: var(--text-muted);
  }

  &__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 var(--space-1);
    font-size: var(--fs-200);
    font-weight: 600;
    border-radius: var(--radius-full);
    background: var(--accent-subtle);
    color: var(--text-strong);
  }

  &__col {
    min-width: 15rem;
  }

  &__tag {
    .drag-handle {
      cursor: grab;
      flex-shrink: 0;

      &:active {
        cursor: grabbing;
      }
    }
  }

  &__body {
    display: flex;
    gap: var(--space-10);
    flex-wrap: wrap;
    padding: var(--space-4);
    border-top: 1px solid var(--border-subtle);
  }

  @media only screen and (max-width: 768px) {
    &__body {
      gap: var(--space-5);
    }
  }
}

.section-title-wrap {
  min-width: 0;
}
.section-config {
  overflow-wrap: anywhere;
}
.tile-card-thumb {
  max-width: 100%;
  &__img {
    display: block;
    height: 40px;
    max-width: 100%;
    object-fit: cover;
    border-radius: var(--radius-base);
  }
}
@include max-tablet {
  // The ActionBar takes a left-aligned row of its own: the unsaved badge sits left above it, not across the page.
  .builder-actions {
    justify-content: flex-start;
  }
  // The C9 action rows take 36 px buttons on a phone (Figma S7), 32 above.
  .section-actions,
  .tiles-header,
  .tile-actions {
    :deep(.icon-button) {
      --icon-button-size: calc(var(--space-8) + var(--space-1));
    }
  }
  .section-header-row {
    flex-direction: column;
    gap: var(--space-1);
  }
  .section-title-wrap {
    width: 100%;
    min-width: unset;
  }
  .section-title {
    font-size: var(--fs-200);
    font-weight: 600;
    word-break: break-word;
  }
  .section-actions {
    gap: var(--space-1);
    flex-shrink: 0;
    align-self: flex-start;
  }
  .section-uid {
    display: none;
  }
  .tiles-header {
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .tile-swiper-wrap {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }
  .tile-swiper-wrap :deep(.swiper) {
    max-width: 100%;
  }
  // cssMode (below tablet, as `belowTablet`): the tiles scroll natively; a thin bar shows that the row scrolls sideways.
  .tile-swiper-wrap :deep(.swiper-wrapper) {
    scrollbar-width: thin;
  }
}
</style>
