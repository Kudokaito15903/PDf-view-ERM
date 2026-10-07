import React, { useState, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ArrowLeftRight,
  ArrowUpDown,
  RotateCcw,
  RotateCw,
  Search,
  Download,
  Loader2,
  Printer,
} from 'lucide-react';
import type { ResolvedPdf, ViewerState } from '../types/pdf.types';
import logoLispro from '../assets/logo_lispro.png';

interface HeaderToolbarProps {
  resolvedPdf: ResolvedPdf;
  pdfBlob?: Blob | null;
  state: ViewerState;
  fitMode?: 'fit-width' | 'fit-page' | 'original' | 'custom';
  onPageChange: (page: number) => void;
  onZoomChange: (deltaOrValue: number, isAbsolute?: boolean) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onRotateChange: (delta: number) => void;
  onSearchQueryChange: (query: string) => void;
}

export const HeaderToolbar: React.FC<HeaderToolbarProps> = ({
  resolvedPdf,
  pdfBlob,
  state,
  fitMode,
  onPageChange,
  onZoomChange,
  onFitWidth,
  onFitPage,
  onRotateChange,
  onSearchQueryChange,
}) => {
  const [pageInputVal, setPageInputVal] = useState<string>(String(state.currentPage));
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Đồng bộ ô input trang khi state thay đổi từ bên ngoài
  React.useEffect(() => {
    setPageInputVal(String(state.currentPage));
  }, [state.currentPage]);

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(pageInputVal, 10);
    if (!isNaN(parsed) && parsed >= 1 && state.numPages && parsed <= state.numPages) {
      onPageChange(parsed);
    } else {
      setPageInputVal(String(state.currentPage));
    }
  };

  // Theo dõi trạng thái in của trình duyệt
  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // In 100% file gốc: nạp Blob vào iframe ẩn rồi gọi print() -> hiện hộp thoại in ngay, không mở tab mới
  const handlePrint = useCallback(async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if ((!resolvedPdf.url && !pdfBlob) || isPrinting) return;

    try {
      setIsPrinting(true);

      let blob: Blob;
      if (pdfBlob && pdfBlob.size > 0) {
        blob = pdfBlob;
      } else if (resolvedPdf.url) {
        const response = await fetch(resolvedPdf.url);
        if (!response.ok) throw new Error('Network response was not ok');
        blob = await response.blob();
      } else {
        setIsPrinting(false);
        return;
      }

      // Blob URL nội bộ (blob:http://localhost:5173/uuid) – không lộ IP/token của API gốc
      const blobUrl = window.URL.createObjectURL(blob);

      // Dọn iframe cũ (nếu có)
      const oldFrame = document.getElementById('native-pdf-print-frame');
      if (oldFrame && oldFrame.parentNode) {
        oldFrame.parentNode.removeChild(oldFrame);
      }

      // Iframe ẩn nhưng vẫn có kích thước thật (tránh bản in trắng do display:none / 0px)
      const printFrame = document.createElement('iframe');
      printFrame.id = 'native-pdf-print-frame';
      printFrame.setAttribute('aria-hidden', 'true');
      printFrame.style.cssText =
        'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;';

      let printed = false;
      const cleanup = () => {
        setTimeout(() => {
          try {
            if (printFrame.parentNode) printFrame.parentNode.removeChild(printFrame);
            window.URL.revokeObjectURL(blobUrl);
          } catch {}
        }, 60000);
      };

      const executePrint = () => {
        if (printed) return;
        printed = true;
        try {
          const win = printFrame.contentWindow;
          if (!win) throw new Error('Iframe không truy cập được');
          win.focus();
          win.print();
        } catch (err) {
          console.warn('Không in được qua iframe, mở tab xem in:', err);
          window.open(blobUrl, '_blank');
        } finally {
          setIsPrinting(false);
          cleanup();
        }
      };

      printFrame.onload = () => setTimeout(executePrint, 500);
      // Dự phòng nếu trình duyệt không phát sự kiện onload cho PDF
      setTimeout(executePrint, 2500);

      printFrame.src = blobUrl;
      document.body.appendChild(printFrame);
    } catch (err) {
      console.error('Lỗi khi chuẩn bị in:', err);
      setIsPrinting(false);
      window.print();
    }
  }, [resolvedPdf.url, pdfBlob, isPrinting]);

  // Hỗ trợ phím tắt Ctrl+P / Cmd+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrint]);

  // Tải file gốc 100%
  const handleForceDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    if ((!resolvedPdf.url && !pdfBlob) || isDownloading) return;

    try {
      setIsDownloading(true);
      let blob: Blob;
      if (pdfBlob && pdfBlob.size > 0) {
        blob = pdfBlob;
      } else if (resolvedPdf.url) {
        const response = await fetch(resolvedPdf.url);
        if (!response.ok) throw new Error('Network response was not ok');
        blob = await response.blob();
      } else {
        return;
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.style.display = 'none';
      tempLink.href = blobUrl;
      const downloadName = resolvedPdf.name?.toLowerCase().endsWith('.pdf')
        ? resolvedPdf.name
        : `${resolvedPdf.name || 'ket-qua-xet-nghiem'}.pdf`;
      tempLink.download = downloadName;
      document.body.appendChild(tempLink);
      tempLink.click();

      setTimeout(() => {
        try {
          if (tempLink.parentNode) {
            document.body.removeChild(tempLink);
          }
          window.URL.revokeObjectURL(blobUrl);
        } catch {}
      }, 15000);
    } catch (err) {
      console.error('Lỗi khi tải file:', err);
      alert('Không thể tải file trực tiếp. Vui lòng kiểm tra lại kết nối mạng.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <header className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-x-2 gap-y-2 lg:gap-3 min-h-14 lg:h-16 py-2 lg:py-0 px-2 sm:px-4 md:px-6 bg-slate-900 text-slate-100 border-b border-cyan-500/30 shadow-md z-20 flex-shrink-0 w-full lg:overflow-hidden">
      {/* Logo & Tiêu đề */}
      <div className="flex items-center gap-2 sm:gap-3 pr-2 sm:pr-4 border-r border-slate-700/80 flex-shrink-0">
        <div className="bg-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl shadow-md flex items-center justify-center transition-all hover:shadow-cyan-500/20 border border-slate-200/30 flex-shrink-0">
          <img src={logoLispro} alt="LIS PRO Logo" className="h-7 sm:h-8 md:h-9 w-auto object-contain" />
        </div>
        <div className="hidden xl:flex flex-col justify-center">
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 tracking-wide w-fit">
            LIS / EMR
          </span>
          <p className="hidden 2xl:block text-[11px] text-slate-400 font-medium mt-0.5 whitespace-nowrap">
            Hệ thống lưu trữ kết quả bệnh nhân
          </p>
        </div>
      </div>

      {/* Điều hướng trang */}
      <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 flex-shrink-0">
        <button
          onClick={() => onPageChange(state.currentPage - 1)}
          disabled={state.currentPage <= 1}
          className="btn-tool cursor-pointer"
          title="Trang trước (←)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1 px-1 font-mono text-[13px]">
          <input
            type="text"
            value={pageInputVal}
            onChange={(e) => setPageInputVal(e.target.value)}
            className="w-10 bg-slate-800/80 border border-slate-600/60 text-white text-[13px] font-mono text-center rounded-md py-1 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all"
            inputMode="numeric"
          />
          <span className="text-slate-400 font-sans text-xs hidden sm:inline">trên</span>
          <span className="text-slate-400 font-sans text-xs sm:hidden">/</span>
          <span className="text-slate-200 font-semibold">{state.numPages || '–'}</span>
        </form>
        <button
          onClick={() => onPageChange(state.currentPage + 1)}
          disabled={!state.numPages || state.currentPage >= state.numPages}
          className="btn-tool cursor-pointer"
          title="Trang sau (→)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Công cụ Zoom Stepper */}
      <div className="hidden sm:flex items-center gap-1 bg-slate-800/60 p-1 rounded-xl border border-slate-700/60 flex-shrink-0">
        <button onClick={() => onZoomChange(-0.15)} className="btn-tool cursor-pointer" title="Thu nhỏ (-)">
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="font-mono text-[12px] font-semibold w-12 text-center text-cyan-300 flex-shrink-0">
          {Math.round(state.scale * 100)}%
        </div>
        <button onClick={() => onZoomChange(0.15)} className="btn-tool cursor-pointer" title="Phóng to (+)">
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* 3 Nút Căn chỉnh trang hiện rõ ràng chữ & icon */}
      <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-800/80 p-1 rounded-xl border border-cyan-500/30 flex-shrink-0 shadow-sm">
        {/* Nút 1: Vừa chiều rộng */}
        <button
          type="button"
          onClick={onFitWidth}
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap active:scale-95 ${
            fitMode === 'fit-width'
              ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/60 font-semibold shadow-sm shadow-cyan-900/40'
              : 'text-slate-200 hover:text-white hover:bg-slate-700/80 border border-transparent'
          }`}
          title="↔️ Vừa chiều rộng (Fit Width): Phóng to trang PDF chiếm tối đa chiều ngang cửa sổ đọc"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          <span className="hidden xl:inline">Vừa chiều rộng</span>
          <span className="hidden sm:inline xl:hidden">Rộng</span>
        </button>

        {/* Nút 2: Vừa toàn trang */}
        <button
          type="button"
          onClick={onFitPage}
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap active:scale-95 ${
            fitMode === 'fit-page'
              ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/60 font-semibold shadow-sm shadow-cyan-900/40'
              : 'text-slate-200 hover:text-white hover:bg-slate-700/80 border border-transparent'
          }`}
          title="↕️ Vừa toàn trang (Fit Page): Thu gọn để nhìn trọn vẹn cả chiều cao của 1 trang trên màn hình mà không cần cuộn chuột"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          <span className="hidden xl:inline">Vừa toàn trang</span>
          <span className="hidden sm:inline xl:hidden">Trang</span>
        </button>

        {/* Nút 3: Kích thước gốc 100% */}
        <button
          type="button"
          onClick={() => onZoomChange(1.0, true)}
          className={`flex items-center gap-1.5 h-8 px-2 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap active:scale-95 ${
            fitMode === 'original' || Math.round(state.scale * 100) === 100
              ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/60 font-semibold shadow-sm shadow-cyan-900/40'
              : 'text-slate-200 hover:text-white hover:bg-slate-700/80 border border-transparent'
          }`}
          title="🔲 Kích thước gốc (100%): Khôi phục về kích thước chuẩn ban đầu"
        >
          <Maximize2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          <span>100%</span>
        </button>
      </div>

      {/* Xoay */}
      <div className="hidden 2xl:flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 flex-shrink-0">
        <button onClick={() => onRotateChange(-90)} className="btn-tool cursor-pointer" title="Xoay trái 90°">
          <RotateCcw className="w-4 h-4" />
        </button>
        <button onClick={() => onRotateChange(90)} className="btn-tool cursor-pointer" title="Xoay phải 90°">
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tìm kiếm co giãn tự động theo tỉ lệ màn hình */}
      <div
        className="flex items-center gap-1.5 h-9 px-2 sm:px-3 rounded-lg bg-slate-800/80 border border-slate-600/60 transition-all duration-200 focus-within:border-cyan-400 focus-within:bg-slate-800 ml-auto flex-1 min-w-[120px] sm:min-w-[36px] max-w-full sm:max-w-[130px] md:max-w-[180px] lg:max-w-[240px] sm:focus-within:min-w-[110px] sm:focus-within:max-w-[260px]"
        title="Tìm trong bệnh án"
      >
        <Search className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <input
          type="text"
          value={state.searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Tìm trong bệnh án…"
          className="w-full min-w-0 bg-transparent border-none text-white text-[13px] outline-none placeholder:text-slate-400 placeholder:truncate"
        />
        {state.searchQuery && (
          <button
            type="button"
            onClick={() => onSearchQueryChange('')}
            className="text-slate-400 hover:text-white text-xs px-1 flex-shrink-0 cursor-pointer"
            title="Xóa tìm kiếm"
          >
            ✕
          </button>
        )}
      </div>

      {/* Nhóm nút In, File gốc API & Tải về máy */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {/* Nút Xem in / In tài liệu */}
        <button
          type="button"
          onClick={handlePrint}
          disabled={!resolvedPdf.url && !pdfBlob}
          className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3.5 rounded-lg bg-cyan-600 text-white font-semibold text-[13px] whitespace-nowrap transition-all duration-150 hover:bg-cyan-500 hover:shadow-lg hover:shadow-cyan-900/30 active:scale-[0.98] disabled:opacity-50 cursor-pointer flex-shrink-0"
          title="In tài liệu trực tiếp (Ctrl+P)"
        >
          {isPrinting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              <span className="hidden sm:inline">Đang chuẩn bị...</span>
            </>
          ) : (
            <>
              <Printer className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Xem in</span>
            </>
          )}
        </button>



        {/* Nút Tải về máy */}
        <button
          type="button"
          onClick={handleForceDownload}
          disabled={isDownloading || (!resolvedPdf.url && !pdfBlob)}
          className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3.5 rounded-lg bg-emerald-600 text-white font-semibold text-[13px] whitespace-nowrap transition-all duration-150 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-900/20 active:scale-[0.98] disabled:opacity-50 cursor-pointer flex-shrink-0"
          title="Tải file về máy"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              <span className="hidden sm:inline">Đang tải...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Tải về máy</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
