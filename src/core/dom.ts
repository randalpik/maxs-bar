/** Typed querySelector helper. */
export const $ = <T extends Element = HTMLElement>(sel: string): T =>
  document.querySelector(sel) as T;
