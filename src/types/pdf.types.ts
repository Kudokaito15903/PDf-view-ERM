export interface ResolvedPdf {
  url: string | null;
  name: string;
  error: string | null;
}

export interface ViewerState {
  currentPage: number;
  numPages: number | null;
  scale: number;
  rotation: number;
  isDownloading: boolean;
  searchQuery: string;
}
