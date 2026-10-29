<template>
  <picture class="image__wrapper init-image relative" v-lazyload>
    <source
      class="image__item"
      v-for="(s, i) in normalizedSet"
      :media="!ommit_media_query ? `(min-width: ${s.width}px)` : null"
      :data-srcset="`${s.source}, ${s.width}w`"
      :key="`set-picture-${i}`"
    />
    <img class="image__item" alt="some desc" />

    <div class="ripple absolute">
      <div class="ripple__circle absolute" />
      <div class="ripple__circle ripple__inner-circle absolute" />
    </div>
  </picture>
</template>

<script>
const normalizeSet = ({ _set = [], hr = true, mw = null }) => {
  let newSet = [..._set];

  if (hr) {
    // SORT JUST TO MAKE IT EASIER
    const sSet = newSet.sort((a, b) => {
      return a.width - b.width;
    });

    const higher_set = sSet.flatMap((p, i) => {
      let picture_details = { ...p, higher_width: null, higher_height: null };
      const higher = _set[i + 1];

      if (!i) {
        // treat it as placeholder later - maybe.

        return picture_details === higher
          ? [
              {
                ...picture_details,
                width: picture_details.width - 1,
              },
              {
                ...picture_details,
                source: higher.source,
                higher_width: higher.width,
                higher_height: higher.height,
              },
            ]
          : {
              ...picture_details,
            };
      }

      if (higher) {
        return (picture_details = {
          ...picture_details,
          source: higher.source,
          higher_width: higher.width,
          higher_height: higher.height,
        });
      }

      return picture_details;
    });

    newSet = higher_set;
  }

  if (mw) {
    newSet = newSet.filter((s) => s.width <= mw);
  }

  const sort_to_render = newSet.sort((a, b) => {
    return b.width - a.width;
  });

  return sort_to_render;
};
export default {
  name: "BasicImage",
  props: {
    set: {
      type: [Array],
      require: true,
    },
    ommit_media_query: {
      type: Boolean,
      default: false,
    },
    maxwidth: {
      type: Number,
      default: null,
    },
    higher_rez: {
      type: [Boolean],
      default: true,
    },
  },
  data() {
    return {
      normalizedSet: [],
      isViewed: false,
    };
  },
  created() {
    this.normalizedSet = normalizeSet({
      _set: this.set,
      hr: this.higher_rez,
      mw: this.maxwidth,
    });
  },
  directives: {
    lazyload: (el, binding) => {
      const componentInstance = binding.instance;

      const loadImage = () => {
        return new Promise((resolve, reject) => {
          const SOURCE_Elements = Array.from(el.children).filter(
            (el) => el.nodeName === "SOURCE"
          );
          const IMG = Array.from(el.children).find(
            (el) => el.nodeName === "IMG"
          );
          if (SOURCE_Elements.length) {
            SOURCE_Elements.forEach((elem) => {
              IMG.addEventListener("load", () => {
                el.classList.remove("init-image");
                setTimeout(() => {
                  el.classList.add("loaded");
                }, 100);
                resolve(IMG);
              });
              elem.addEventListener("error", () => {
                console.log("load picture error");
                reject();
              });
              elem.srcset = elem.dataset.srcset;
            });
          }
        });
      };

      const handleIntersect = (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          } else {
            loadImage().then((IMG) => {
              if (componentInstance) {
                componentInstance.$emit("imgLoaded");
              }
            });
            observer.unobserve(el);
          }
        });
      };

      const createObserver = () => {
        const options = {
          root: null, // defaults to the browser viewport if not specified or if null
          threshold: "0", // the degree of intersection between the target element and its root (0 - 1)
        };
        const observer = new IntersectionObserver(handleIntersect, options);
        observer.observe(el); // target element to watch
      };

      if (!window["IntersectionObserver"]) {
        loadImage().then((IMG) => {
          if (componentInstance) {
            componentInstance.$emit("imgLoaded");
          }
        });
      } else {
        createObserver();
      }
    },
  },
};
</script>

<style lang="scss">
$base-size: 64px;
.image__wrapper {
  width: 100%;
  display: block;
  &.loaded {
    .image {
      &__item {
        display: block;
        width: 100%;
        visibility: visible;
        opacity: 1;
        border: 0;
      }
    }

    .ripple {
      display: none;
      width: 100%;
    }

    .ripple__circle {
      animation: none;
    }
  }
  .image {
    &__item {
      width: 100%;
      visibility: visible;
      opacity: 0;
    }
  }

  &.init-image {
    .image {
      &__item {
        width: 100%;
        visibility: visible;
        opacity: 0;
        border: 0;
      }
    }
    .ripple {
      display: none;
      width: 100%;
    }

    .ripple__circle {
      animation: none;
    }
  }

  &.let_loose {
    .image {
      &__item {
        display: block;
        width: initial;
        visibility: visible;
        opacity: 1;
        border: 0;
      }
    }
  }
}

.ripple {
  display: inline-block;
  width: $base-size;
  height: $base-size;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  &__circle {
    border: 14px solid var(--accent-subtle);
    width: $base-size;
    height: $base-size;
    opacity: 1;
    border-radius: var(--radius-full);
    transform-origin: 50% 50%;
    animation: ripple 1s cubic-bezier(0, 0.2, 0.8, 1) infinite;
  }

  &__inner-circle {
    animation-delay: -0.5s;
  }
}

@keyframes ripple {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
}
</style>
