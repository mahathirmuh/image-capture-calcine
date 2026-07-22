import { z } from "zod";

const GALLERY_VIEW_STATE_KEY = "capture-system:gallery-view-state:v1";
const GALLERY_SAVED_VIEW_KEY = "capture-system:gallery-saved-view:v1";

export const GALLERY_SORT_OPTIONS = ["newest", "oldest", "name-asc", "name-desc"] as const;
export type GallerySortOption = (typeof GALLERY_SORT_OPTIONS)[number];

export const GALLERY_VIEW_MODES = ["grid", "list"] as const;
export type GalleryViewMode = (typeof GALLERY_VIEW_MODES)[number];

export const GALLERY_PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const;
export type GalleryPageSize = (typeof GALLERY_PAGE_SIZE_OPTIONS)[number];

export type GalleryViewState = {
  sortOption: GallerySortOption;
  viewMode: GalleryViewMode;
  pageSize: GalleryPageSize;
  searchQuery: string;
  filterDate: string;
  filterLocation: string;
  filterBin: "" | "BIN1" | "BIN2";
};

export const DEFAULT_GALLERY_VIEW_STATE: GalleryViewState = {
  sortOption: "newest",
  viewMode: "grid",
  pageSize: 24,
  searchQuery: "",
  filterDate: "",
  filterLocation: "",
  filterBin: "",
};

export const GALLERY_SAVED_VIEW_OPTIONS = [
  "all-images",
  "bin-1-review",
  "bin-2-review",
  "compact-audit",
] as const;
export type GallerySavedViewPreference = (typeof GALLERY_SAVED_VIEW_OPTIONS)[number];

export type GallerySavedViewDefinition = {
  id: GallerySavedViewPreference;
  label: string;
  description: string;
  state: GalleryViewState;
};

export const GALLERY_SAVED_VIEWS: GallerySavedViewDefinition[] = [
  {
    id: "all-images",
    label: "All images",
    description: "Semua capture terbaru dalam tampilan grid standar.",
    state: DEFAULT_GALLERY_VIEW_STATE,
  },
  {
    id: "bin-1-review",
    label: "BIN 1 review",
    description: "Fokus audit capture dari BIN 1.",
    state: {
      ...DEFAULT_GALLERY_VIEW_STATE,
      filterBin: "BIN1",
    },
  },
  {
    id: "bin-2-review",
    label: "BIN 2 review",
    description: "Fokus audit capture dari BIN 2.",
    state: {
      ...DEFAULT_GALLERY_VIEW_STATE,
      filterBin: "BIN2",
    },
  },
  {
    id: "compact-audit",
    label: "Compact audit",
    description: "List view dengan urutan terlama untuk review kronologis.",
    state: {
      ...DEFAULT_GALLERY_VIEW_STATE,
      sortOption: "oldest",
      viewMode: "list",
      pageSize: 48,
    },
  },
];

const galleryViewStateSchema = z.object({
  sortOption: z.enum(GALLERY_SORT_OPTIONS),
  viewMode: z.enum(GALLERY_VIEW_MODES),
  pageSize: z.union(
    GALLERY_PAGE_SIZE_OPTIONS.map((size) => z.literal(size)) as [
      z.ZodLiteral<12>,
      z.ZodLiteral<24>,
      z.ZodLiteral<48>,
      z.ZodLiteral<96>,
    ],
  ),
  searchQuery: z.string(),
  filterDate: z.string(),
  filterLocation: z.string(),
  filterBin: z.enum(["", "BIN1", "BIN2"]),
});

const gallerySavedViewSchema = z.enum(GALLERY_SAVED_VIEW_OPTIONS);

export function loadGalleryViewState(): GalleryViewState {
  if (typeof window === "undefined") return DEFAULT_GALLERY_VIEW_STATE;
  try {
    const raw = window.localStorage.getItem(GALLERY_VIEW_STATE_KEY);
    if (!raw) return DEFAULT_GALLERY_VIEW_STATE;
    return galleryViewStateSchema.parse(JSON.parse(raw));
  } catch {
    return DEFAULT_GALLERY_VIEW_STATE;
  }
}

export function saveGalleryViewState(state: GalleryViewState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GALLERY_VIEW_STATE_KEY, JSON.stringify(state));
}

export function loadGallerySavedViewPreference(): GallerySavedViewPreference {
  if (typeof window === "undefined") return GALLERY_SAVED_VIEW_OPTIONS[0];
  try {
    const raw = window.localStorage.getItem(GALLERY_SAVED_VIEW_KEY);
    if (!raw) return GALLERY_SAVED_VIEW_OPTIONS[0];
    return gallerySavedViewSchema.parse(raw);
  } catch {
    return GALLERY_SAVED_VIEW_OPTIONS[0];
  }
}

export function saveGallerySavedViewPreference(savedView: GallerySavedViewPreference): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GALLERY_SAVED_VIEW_KEY, savedView);
}

export function getGallerySavedViewById(
  savedViewId: GallerySavedViewPreference,
): GallerySavedViewDefinition {
  return GALLERY_SAVED_VIEWS.find((view) => view.id === savedViewId) ?? GALLERY_SAVED_VIEWS[0];
}

export function galleryViewStateMatchesSavedView(
  state: GalleryViewState,
  savedViewId: GallerySavedViewPreference,
): boolean {
  const savedView = getGallerySavedViewById(savedViewId);
  return JSON.stringify(state) === JSON.stringify(savedView.state);
}
