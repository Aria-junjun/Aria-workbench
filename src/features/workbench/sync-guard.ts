export function hasPendingLocalWrite(value: string | null): boolean {
  return Boolean(value && /^\d+$/.test(value));
}
