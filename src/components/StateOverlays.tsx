import React from 'react';
import { AlertCircle } from 'lucide-react';

interface StateOverlaysProps {
  isLoading: boolean;
  error: string | null;
  onReload?: () => void;
}

export const StateOverlays: React.FC<StateOverlaysProps> = ({ isLoading, error, onReload }) => {
  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-100/95 backdrop-blur-sm z-30 transition-opacity duration-300">
        <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shadow-inner mb-2">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-slate-800 text-base">Không thể hiển thị tài liệu bệnh án</h3>
        <div className="text-red-600 max-w-[460px] text-center px-6 leading-relaxed font-sans text-sm">
          {error}
        </div>
        <button
          onClick={onReload || (() => window.location.reload())}
          className="mt-2 px-5 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors shadow-md cursor-pointer"
        >
          Tải lại trang
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-100/90 backdrop-blur-sm z-30 transition-opacity duration-300">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-600 animate-spin"></div>
          <div className="absolute text-cyan-600 font-bold text-xs">LIS</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-slate-800 text-sm tracking-normal">
            ĐANG TRUY XUẤT HỒ SƠ Y TẾ…
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Vui lòng chờ trong giây lát, dữ liệu đang được giải mã an toàn
          </p>
        </div>
      </div>
    );
  }

  return null;
};
