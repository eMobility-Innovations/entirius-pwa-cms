<template>
  <div class="group-fields-preview">
    <BasicSelect
      :model-value="null"
      :placeholder="`groups (${value.length})`"
      :options="
        value.map((obj, index) => {
          const entries = Object.entries(obj);
          return {
            label: entries.reduce((str, [_key, _value]) => {
              return `${str}${_key}: ${
                _value && _value.length > 10 ? _value.substring(0, 10) : _value
              } | `;
            }, ''),
            value: index,
          };
        })
      "
    />
  </div>
</template>

<script>
export default {
  props: {
    value: {
      type: [Array],
      required: true,
    },
  },
};
</script>
