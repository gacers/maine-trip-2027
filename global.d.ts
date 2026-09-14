// Ambient typing for CSS Module imports (`import styles from "./X.module.css"`)
// — TypeScript has no built-in knowledge of what a .css import resolves to.
declare module "*.module.css" {
  const classes: { readonly [className: string]: string };
  export default classes;
}
