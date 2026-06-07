/** Typed querySelector helper. Mirrors the prototype's `$`. */
export const $ = <T extends Element = HTMLElement>(sel: string): T =>
  document.querySelector(sel) as T;
