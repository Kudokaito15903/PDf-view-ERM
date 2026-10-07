import React, { useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PdfPageShell } from './PdfPageShell';

// Cấu hình web worker của PDF.js nhúng nội bộ (Local Worker), không phụ thuộc CDN bên ngoài
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface ViewerContainerProps {
  pdfUrl: string | ArrayBuffer | null;
  scale: number;
  rotation: number;
  searchQuery: string;
  onLoadSuccess: (numPages: number) => void;
  onLoadError: (error: Error) => void;
  onCurrentPageChanged: (page: number) => void;
  numPages: number | null;
  onPageDimensionsReceived?: (dims: { width: number; height: number }) => void;
}

export const ViewerContainer: React.FC<ViewerContainerProps> = ({
  pdfUrl,
  scale,
  rotation,
  searchQuery,
  onLoadSuccess,
  onLoadError,
  onCurrentPageChanged,
  numPages,
  onPageDimensionsReceived,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Custom text renderer để highlight từ khóa tìm kiếm
  const customTextRenderer = useCallback(
    ({ str }: { str: string }) => {
      if (!searchQuery || !str) return str;
      const regex = new RegExp(`(${searchQuery})`, 'gi');
      return str.replace(regex, `<mark class="bg-amber-400/80 text-slate-900 rounded-sm px-0.5 font-bold">$1</mark>`);
    },
    [searchQuery]
  );

  // Theo dõi cuộn chuột để cập nhật số trang hiện tại
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !numPages) return;

    const handleScroll = () => {
      const containerRect = el.getBoundingClientRect();
      const pageElements = el.querySelectorAll('.screen-viewer .react-pdf__Page');
      let bestPage = 1;
      let minDistance = Infinity;

      pageElements.forEach((pageEl, idx) => {
        const rect = pageEl.getBoundingClientRect();
        const dist = Math.abs(rect.top - containerRect.top - 40);
        if (dist < minDistance) {
          minDistance = dist;
          bestPage = idx + 1;
        }
      });

      onCurrentPageChanged(bestPage);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [numPages, onCurrentPageChanged]);

  if (!pdfUrl) return null;

  return (
    <main
      ref={containerRef}
      className="viewer-scroll flex-1 overflow-auto relative scroll-smooth bg-slate-200/80 p-2 sm:p-4 md:p-8"
    >
      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages }) => onLoadSuccess(numPages)}
        onLoadError={onLoadError}
        loading={null}
        error={null}
        className="flex flex-col items-center gap-10 min-h-full"
      >
        {/* VÙNG XEM MÀN HÌNH: Tùy biến Zoom/Scale/Phóng to - Ẩn hoàn toàn khi in */}
        <div className="screen-viewer flex flex-col items-center gap-10 min-h-full print:hidden">
          {numPages &&
            Array.from(new Array(numPages), (_, index) => (
              <PdfPageShell
                key={`screen_page_${index + 1}`}
                pageNumber={index + 1}
                scale={scale}
                rotation={rotation}
                customTextRenderer={customTextRenderer}
                onPageLoadSuccess={onPageDimensionsReceived}
              />
            ))}
        </div>

        {/* VÙNG IN RIÊNG BIỆT: Cố định cứng Scale 1.0 chuẩn A4 gốc - Độc lập hoàn toàn với Zoom màn hình */}
        <div className="print-viewer hidden print:block">
          {numPages &&
            Array.from(new Array(numPages), (_, index) => (
              <div key={`print_page_${index + 1}`} className="print-page-slot">
                <Page
                  pageNumber={index + 1}
                  scale={1.0}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  devicePixelRatio={2}
                />
              </div>
            ))}
        </div>
      </Document>
    </main>
  );
};
