import { CATEGORY_RULES } from "./constants.js";

/**
 * @param {string} name
 * @returns {string}
 */
export function inferCategory(name) {
  const lower = (name || "").toLowerCase();
  if (!lower) return "";
  for (const rule of CATEGORY_RULES) {
    if (rule.kw.some((k) => lower.includes(k.toLowerCase()))) return rule.cat;
  }
  return "";
}
