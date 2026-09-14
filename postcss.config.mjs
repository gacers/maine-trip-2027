const config = {
  plugins: {
    // Flattens native CSS nesting (`.foo { &:hover { ... } }`) before
    // anything else runs — used across this project's CSS Modules.
    "postcss-nesting": {},
  },
};

export default config;
