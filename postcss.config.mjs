const config = {
  plugins: {
    // Flattens native CSS nesting (`.foo { &:hover { ... } }`) before
    // anything else runs — used across the CSS Modules this project is
    // migrating to. TODO(css-modules-migration): drop @tailwindcss/postcss
    // once every component has its own CSS Module.
    "postcss-nesting": {},
    "@tailwindcss/postcss": {},
  },
};

export default config;
