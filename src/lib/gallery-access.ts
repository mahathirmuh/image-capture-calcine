/** Gallery viewing permissions are separate from capture plant selection. */
export type GalleryScope = { allPlants: boolean; plant: string | null };

export function resolveGalleryScope(user: { role: string; plant: string | null }): GalleryScope {
  if (user.role === "admin" || user.plant === "ALL") return { allPlants: true, plant: null };
  return { allPlants: false, plant: user.plant?.trim() || null };
}

export function canViewGalleryPlant(scope: GalleryScope | null, plant: string | null | undefined) {
  return !!scope && (scope.allPlants || (!!scope.plant && plant?.trim() === scope.plant));
}

/** Registry-linked cache must have a visible record; never resurrect hidden/deleted records. */
export function filterGalleryCache<T extends { folder: string; captureRecordId?: number | null }>(
  items: T[],
  scope: GalleryScope | null,
  records: { id: number; plant: string | null }[],
): T[] {
  const visibleIds = new Set(
    records.filter((r) => canViewGalleryPlant(scope, r.plant)).map((r) => r.id),
  );
  return items.filter(
    (item) =>
      canViewGalleryPlant(scope, item.folder) &&
      (item.captureRecordId == null || visibleIds.has(item.captureRecordId)),
  );
}
