<template>
  <div class="images-library">
    <h2 class="mb-sm">{{ $t("images.library") }}</h2>
    <div class="grid-col-3 gap-md">
      <div
        v-for="p in pictures"
        :key="p.uid"
        class="image-library"
        @click="addAsset(p)"
      >
        <div class="image-library__picture pointer relative">
          <img :src="p.image" alt="" />
        </div>
        <p
          class="fs-sm bg-gray-100 p-xsm break-word"
          v-text="p.meta.fileName"
        />
      </div>
    </div>
    <!-- <Pagination :data="pagination" :isAdjustable="false" @onPageChange="getImages({ page: $event, limit: pagination.limit })" /> -->
  </div>
</template>

<script>
import { GET_Images, DELETE_Image } from "@/api/contentDB/api";
import { useLoaderStore } from "@/stores/loader";
import { useNotifyStore } from "@/stores/notify";
import { useHandyStore } from "@/stores/handy";

export default {
  setup() {
    const loader = useLoaderStore();
    const notify = useNotifyStore();
    const handy = useHandyStore();
    return { loader, notify, handy };
  },
  data() {
    return {
      pictures: [],
      tags: [],
      pagination: null,
    };
  },
  methods: {
    open_Handykit(params) {
      this.handy.open_Handykit(params);
    },
    pass_Asset(asset) {
      this.handy.pass_Asset(asset);
    },

    async getImages({ page, limit }) {
      try {
        this.loader.handyLoaderStart();
        const {
          data: { data = [], meta = {}, pagination = {} },
          status,
        } = await GET_Images({
          page: page,
          limit: limit,
        });
        if (meta.status.toLowerCase() === "ok") {
          this.pictures = data;
          this.pagination = pagination;
        }
      } catch ({ response }) {
      } finally {
        this.loader.handyLoaderFinish();
      }
    },
    async deleteImage(uuid) {
      try {
        const { status } = await DELETE_Image({ uid: uuid });
        if (status === 204)
          this.pictures = this.pictures.filter(
            (picture) => picture.uid !== uuid
          );
      } catch ({ response }) {
        console.log(response);
      } finally {
      }
    },

    addAsset(pic) {
      this.pass_Asset(pic);
      this.notify.spawnNotification({
        title: "",
        msg: this.$t("notifications.success"),
        type: "informative",
      });
      this.open_Handykit({ typeId: false });
    },
  },
  created() {
    this.getImages({ page: 1, limit: 9 });
  },
};
</script>

<style lang="scss">
.image-library {
  border: 1px solid var(--border-subtle);
  aspect-ratio: 1/1;
  overflow: hidden;
  &__picture {
    &::before {
      content: "+";
      display: grid;
      place-items: center;
      position: absolute;
      width: 100%;
      height: 100%;
      background-color: var(--overlay-loading);
      font-size: var(--fs-600);
      color: var(--text-strong);
      opacity: 0;
      transition: opacity 0.1s ease-in, background-color 0.1s ease-in;
    }
    &:hover {
      &::before {
        opacity: 1;
      }
    }
  }
}
</style>
