export function normalizeGroups<T = unknown>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && data !== null && "groups" in data) {
    return (data as { groups: T[] }).groups ?? [];
  }
  return [];
}
