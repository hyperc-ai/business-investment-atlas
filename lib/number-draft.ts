// Rules for numeric fields that are edited by typing. A controlled number input
// that clamps every keystroke cannot be typed into: "500000" with a minimum of
// 1000 becomes 1000 after the first digit, and "-" or "0." are rejected before
// the rest of the number arrives. The field keeps the typed text as a draft
// instead, and these two functions decide what reaches the model.

/** While typing: pass a value through only when it is complete and in range. */
export function liveValue(raw: string, min: number, max: number): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

/** On leaving the field or Enter: clamp any number into range; null reverts. */
export function settledValue(raw: string, min: number, max: number): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : null;
}
