<template>
  <div class="stance-switcher mt-5 fs-200">
    <div class="mb-2">
      <span v-if="label" class="mr-2">{{ label }}</span>
      <span class="current-value t-accent underline">{{
        getCurrentLabel
      }}</span>
    </div>

    <div class="slider-container">
      <input
        type="range"
        :min="0"
        :max="config.values.length - 1"
        :value="local_value"
        class="range-slider"
        @input="handleInput"
      />
    </div>
  </div>
</template>

<script>
export default {
  name: "StanceSwitcher",
  props: {
    label: {
      type: String,
      required: false,
    },
    config: {
      type: Object,
      required: true,
    },
    value: {
      type: [Number, String],
      required: false,
      default: 0,
    },
  },
  data() {
    return {
      local_value: this.value,
    };
  },
  computed: {
    getCurrentLabel() {
      const option = this.config.values.find(
        (opt) => opt.value === Number(this.local_value)
      );
      return option ? option.label : "";
    },
  },
  methods: {
    handleInput(event) {
      this.local_value = Number(event.target.value);
      this.$emit("onChange", this.local_value);
    },
  },
};
</script>

<style scoped>
.stance-switcher {
  width: 100%;
}

.slider-container {
  width: 100%;
}

.range-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 1px;
  background: var(--surface-hover);
  outline: none;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 1rem;
  height: 1rem;
  background: var(--surface-inverse);
  outline: 4px solid var(--surface-base);
  border-radius: var(--radius-full);
  cursor: pointer;
}

.range-slider::-moz-range-thumb {
  width: 1rem;
  height: 1rem;
  background: var(--surface-inverse);
  border-radius: var(--radius-full);
  cursor: pointer;
}
</style>
