module.exports = {
  presets: [
    '@vue/cli-plugin-babel/preset'
  ],
  // marked >= 18.1 uses private class methods; transpileDependencies pushes it through Babel
  plugins: ['@babel/plugin-transform-private-methods']
}
