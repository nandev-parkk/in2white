export function buildContainsSearchPattern(value: string) {
  const escapedValue = value.replace(/[\\%_]/g, "\\$&");
  return `%${escapedValue}%`;
}
