/**
 * ForgeDoc — the intermediate representation produced by @forge/react's reconciler.
 * Each node has a type (component name), props, children, and a unique key.
 */
export interface ForgeDoc {
  type: string;
  props: Record<string, any>;
  children: ForgeDoc[];
  key: string;
  forgeReactMajorVersion?: number;
}
