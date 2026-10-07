import React from 'react';
import { Page } from 'react-pdf';

interface PdfPageShellProps {
  pageNumber: number;
  scale: number;
  rotation: number;
  customTextRenderer?: (textItem: { str: string }) => string;
  onPageLoadSuccess?: (dims: { width: number; height: number }) => void;
}

export const PdfPageShell: React.FC<PdfPageShellProps> = React.memo(({
  pageNumber,
  scale,
  rotation,
  customTextRenderer,
  onPageLoadSuccess,
}) => {
  return (
    <div className="pdf-page-shell flex flex-col items-center gap-2">
      <div className="pdf-page-box shadow-2xl transition-all duration-150 rounded-sm">
        <Page
          pageNumber={pageNumber}
          scale={scale}
          rotate={rotation}
          renderTextLayer={true}
          renderAnnotationLayer={true}
          customTextRenderer={customTextRenderer}
          devicePixelRatio={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1}
          onLoadSuccess={(page: any) => {
            if (pageNumber === 1 && onPageLoadSuccess) {
              const width = page.originalWidth || page.width || (page.getViewport ? page.getViewport({ scale: 1 }).width : 595.28);
              const height = page.originalHeight || page.height || (page.getViewport ? page.getViewport({ scale: 1 }).height : 841.89);
              onPageLoadSuccess({ width, height });
            }
          }}
          loading={
            <div className="w-[600px] h-[840px] max-w-full bg-white flex items-center justify-center text-slate-400 text-sm font-mono animate-pulse">
              Đang vẽ trang {pageNumber}...
            </div>
          }
        />
      </div>
      <div className="pdf-page-badge print:hidden font-mono text-xs text-slate-500 font-medium bg-white/90 px-3 py-1 rounded-full border border-slate-200 shadow-sm">
        Trang {pageNumber}
      </div>
    </div>
  );
});
