import React, { useState, useCallback, useRef, useEffect } from 'react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { usePdfResolver } from './hooks/usePdfResolver';
import type { ViewerState } from './types/pdf.types';
import { HeaderToolbar } from './components/HeaderToolbar';
import { ViewerContainer } from './components/ViewerContainer';
import { StateOverlays } from './components/StateOverlays';

export const App: React.FC = () => {
  const resolvedPdf = usePdfResolver();

  const [state, setState] = useState<ViewerState>({
    currentPage: 1,
    numPages: null,
    scale: 1.0,
    rotation: 0,
    isDownloading: false,
    searchQuery: '',
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(resolvedPdf.error);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  // Bản sao Blob bất biến của file gốc dùng cho In / Tải về (vì PDF.js sẽ 'detach' ArrayBuffer khi render)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const currentPageRef = useRef<number>(1);

  useEffect(() => {
    if (resolvedPdf.error) {
      setErrorMessage(resolvedPdf.error);
      setIsLoading(false);
      return;
    }

    if (!resolvedPdf.url) {
      setPdfData(null);
      setPdfBlob(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setPdfData(null);
    setPdfBlob(null);
    autoFitCompletedRef.current = false;

    fetch(resolvedPdf.url)
      .then(async (response) => {
        if (response.status === 200) {
          const buffer = await response.arrayBuffer();
          // Tạo Blob TRƯỚC khi đưa buffer cho PDF.js (Blob sao chép dữ liệu nên không bị detach)
          setPdfBlob(new Blob([buffer], { type: 'application/pdf' }));
          setPdfData(buffer);
        } else {
          // Khi lỗi status != 200, lấy nội dung text lỗi trả về từ server
          const errText = await response.text();
          setErrorMessage(errText || `Lỗi từ hệ thống (Mã lỗi: ${response.status})`);
          setIsLoading(false);
        }
      })
      .catch((error) => {
        console.error('Lỗi kết nối tải PDF:', error);
        setErrorMessage('Không thể kết nối đến máy chủ. Kiểm tra đường dẫn hoặc kết nối CORS.');
        setIsLoading(false);
      });
  }, [resolvedPdf.url, resolvedPdf.error]);

  // Xử lý khi tải PDF thành công
  const handleLoadSuccess = useCallback((numPages: number) => {
    setIsLoading(false);
    setErrorMessage(null);
    setState((prev) => ({ ...prev, numPages, currentPage: 1 }));
  }, []);

  // Xử lý khi tải PDF thất bại (ví dụ: file PDF lỗi, không đọc được dữ liệu cấu trúc)
  const handleLoadError = useCallback((error: Error) => {
    console.error('Lỗi khi phân tích tài liệu PDF:', error);
    setIsLoading(false);
    setErrorMessage('Định dạng tài liệu không hợp lệ hoặc dữ liệu bị lỗi.');
  }, []);

  // Thay đổi số trang hiện tại khi cuộn
  const handleCurrentPageChanged = useCallback((page: number) => {
    if (page !== currentPageRef.current) {
      currentPageRef.current = page;
      setState((prev) => ({ ...prev, currentPage: page }));
    }
  }, []);

  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [fitMode, setFitMode] = useState<'fit-width' | 'fit-page' | 'original' | 'custom'>('fit-page');
  const autoFitCompletedRef = useRef<boolean>(false);

  // Điều hướng nhảy tới trang cụ thể
  const handlePageChange = useCallback((targetPage: number) => {
    setState((prev) => ({ ...prev, currentPage: targetPage }));
    // Cuộn tới DOM element của trang
    const pageShell = document.querySelector(`.react-pdf__Page[data-page-number="${targetPage}"]`);
    if (pageShell) {
      pageShell.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Nhảy nhanh nếu không dùng data-page-number
      const allPages = document.querySelectorAll('.react-pdf__Page');
      const targetEl = allPages[targetPage - 1];
      if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Điều chỉnh Fit Width (Vừa chiều rộng)
  const handleFitWidth = useCallback((customDims?: { width: number; height: number }, forceFull: boolean = false) => {
    const dims = customDims || pageDimensions;
    const container = document.querySelector('.viewer-scroll') as HTMLElement | null;
    if (!container) return;
    const containerWidth = container.clientWidth;
    const originalWidth = dims?.width || 595.28;
    const padding = containerWidth < 768 ? 24 : 64;
    const availableWidth = Math.max(containerWidth - padding, 320);

    // Màn hình desktop rộng: auto-fit đọc vừa mắt (~1050px) giống trình duyệt gốc, nút bấm ép rộng full khung
    const targetWidth = forceFull ? availableWidth : Math.min(availableWidth, 1050);
    const newScale = Math.min(Math.max(targetWidth / originalWidth, 0.4), 2.4);
    setFitMode('fit-width');
    setState((prev) => ({ ...prev, scale: Math.round(newScale * 100) / 100 }));
  }, [pageDimensions]);

  // Điều chỉnh Fit Page (Vừa toàn trang) - customDims dùng cho lần auto-fit đầu tiên khi state chưa kịp cập nhật
  const handleFitPage = useCallback((customDims?: { width: number; height: number }) => {
    const dims = customDims || pageDimensions;
    const container = document.querySelector('.viewer-scroll') as HTMLElement | null;
    if (!container) return;
    const containerHeight = container.clientHeight;
    const containerWidth = container.clientWidth;
    const originalHeight = dims?.height || 841.89;
    const originalWidth = dims?.width || 595.28;
    const verticalPadding = 80;
    const horizontalPadding = containerWidth < 768 ? 24 : 64;
    const availableHeight = Math.max(containerHeight - verticalPadding, 300);
    const availableWidth = Math.max(containerWidth - horizontalPadding, 320);
    // Vừa trọn 1 trang: không vượt quá cả chiều cao lẫn chiều rộng khung xem
    const scaleByHeight = availableHeight / originalHeight;
    const scaleByWidth = availableWidth / originalWidth;
    const newScale = Math.min(Math.max(Math.min(scaleByHeight, scaleByWidth), 0.4), 2.0);
    setFitMode('fit-page');
    setState((prev) => ({ ...prev, scale: Math.round(newScale * 100) / 100 }));
  }, [pageDimensions]);

  // Nhận kích thước trang từ trang 1 và tự động Fit Page (vừa toàn trang) lần đầu
  const handlePageDimensionsReceived = useCallback((dims: { width: number; height: number }) => {
    setPageDimensions(dims);
    if (!autoFitCompletedRef.current) {
      autoFitCompletedRef.current = true;
      handleFitPage(dims);
    }
  }, [handleFitPage]);

  // Responsive: khi đổi kích thước cửa sổ / xoay màn hình, tự co giãn lại theo chế độ đang chọn
  useEffect(() => {
    if (fitMode !== 'fit-page' && fitMode !== 'fit-width') return;
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (fitMode === 'fit-page') handleFitPage();
        else handleFitWidth(undefined, true);
      }, 150);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [fitMode, handleFitPage, handleFitWidth]);

  // Điều chỉnh Zoom
  const handleZoomChange = useCallback((deltaOrValue: number, isAbsolute: boolean = false) => {
    if (isAbsolute && deltaOrValue === 1.0) {
      setFitMode('original');
    } else {
      setFitMode('custom');
    }
    setState((prev) => {
      let newScale = isAbsolute ? deltaOrValue : prev.scale + deltaOrValue;
      if (newScale < 0.3) newScale = 0.3;
      if (newScale > 4.0) newScale = 4.0;
      return { ...prev, scale: Math.round(newScale * 100) / 100 };
    });
  }, []);

  // Điều chỉnh Xoay
  const handleRotateChange = useCallback((delta: number) => {
    setState((prev) => ({ ...prev, rotation: (prev.rotation + delta + 360) % 360 }));
  }, []);

  // Điều chỉnh từ khóa tìm kiếm
  const handleSearchQueryChange = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-100 text-slate-800 antialiased relative">
      <HeaderToolbar
        resolvedPdf={resolvedPdf}
        pdfBlob={pdfBlob}
        state={state}
        fitMode={fitMode}
        onPageChange={handlePageChange}
        onZoomChange={handleZoomChange}
        onFitWidth={() => handleFitWidth(undefined, true)}
        onFitPage={() => handleFitPage()}
        onRotateChange={handleRotateChange}
        onSearchQueryChange={handleSearchQueryChange}
      />

      <div className="flex-1 relative flex flex-col overflow-hidden">
        <StateOverlays isLoading={isLoading && !errorMessage} error={errorMessage} />

        <ViewerContainer
          pdfUrl={pdfData}
          scale={state.scale}
          rotation={state.rotation}
          searchQuery={state.searchQuery}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          onCurrentPageChanged={handleCurrentPageChanged}
          numPages={state.numPages}
          onPageDimensionsReceived={handlePageDimensionsReceived}
        />
      </div>
    </div>
  );
};

export default App;
