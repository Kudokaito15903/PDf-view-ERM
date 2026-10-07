import { useMemo } from 'react';
import type { ResolvedPdf } from '../types/pdf.types';

interface AppConfig {
  API_BASE_URL?: string;
  ALLOWED_HOSTS?: string;
}

function getAppConfig(): AppConfig {
  return (typeof window !== 'undefined' && (window as any).APP_CONFIG) || {};
}

function getAllowedHosts(): string[] {
  const config = getAppConfig();
  const hostsStr = config.ALLOWED_HOSTS || '';
  const parsedHosts = hostsStr.split(',').map((h: string) => h.trim()).filter(Boolean);
  return parsedHosts.length > 0 ? parsedHosts : ['118.70.81.222:7010'];
}

function getDefaultApiBase(): string {
  const config = getAppConfig();
  return config.API_BASE_URL || 'http://118.70.81.222:7010/api/files/view';
}

// Trạng thái khi không truyền tham số tài liệu
const NO_DOC_SELECTED: ResolvedPdf = {
  url: null,
  name: 'Chưa chọn tài liệu',
  error: 'Vui lòng cung cấp tham số liên kết tài liệu.',
};

function resolveDisplayName(params: URLSearchParams, parsedUrl: URL | null): string {
  const explicitName = params.get('name');
  if (explicitName) {
    try {
      return decodeURIComponent(explicitName);
    } catch {
      return explicitName;
    }
  }

  const topFileName = params.get('fileName');
  if (topFileName) return topFileName;

  if (parsedUrl) {
    const innerFileName = parsedUrl.searchParams.get('fileName');
    if (innerFileName) return innerFileName;
  }

  return 'Tài liệu bệnh án y khoa.pdf';
}

export function usePdfResolver(): ResolvedPdf {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search);

    // Cách 1: truyền thẳng URL đầy đủ hoặc đường dẫn tương đối
    const rawSrc = params.get('src') || params.get('url');
    if (rawSrc) {
      try {
        const candidate = decodeURIComponent(rawSrc);
        if (candidate.startsWith('http://view/') || candidate.startsWith('https://view/')) {
          const parsed = new URL(candidate);
          const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
          const allowedHosts = getAllowedHosts();
          if (!isLocal && !allowedHosts.includes(parsed.host)) {
            console.warn('[MedViewer] Từ chối host không được phép:', parsed.host);
            return {
              url: null,
              name: 'Nguồn không hợp lệ',
              error: `Nguồn tài liệu không được phép (host: ${parsed.host}).`,
            };
          }
          return {
            url: candidate,
            name: resolveDisplayName(params, parsed),
            error: null,
          };
        } else {
          return {
            url: candidate,
            name: resolveDisplayName(params, null) || candidate.split('/').pop() || 'Tài liệu PDF',
            error: null,
          };
        }
      } catch (e) {
        console.warn('[MedViewer] Tham số src/url không hợp lệ:', rawSrc, e);
        return {
          url: null,
          name: 'Tham số lỗi',
          error: 'Tham số liên kết tài liệu không hợp lệ.',
        };
      }
    }

    // Cách 2: truyền rời từng tham số của API, app tự ráp URL
    let fileName = params.get('fileName');
    if (!fileName && window.location.pathname.startsWith('/view/')) {
      const parts = window.location.pathname.split('/');
      if (parts.length >= 3 && parts[2]) {
        fileName = decodeURIComponent(parts[2]);
        params.set('fileName', fileName);
      }
    }

    if (fileName) {
      const apiParams = new URLSearchParams();
      ['fileName', 'pid', 'exp', 'sig'].forEach((key) => {
        if (params.has(key)) {
          apiParams.set(key, params.get(key) || '');
        }
      });
      const defaultApiBase = getDefaultApiBase();
      return {
        url: `${defaultApiBase}?${apiParams.toString()}`,
        name: resolveDisplayName(params, null),
        error: null,
      };
    }

    return NO_DOC_SELECTED;
  }, []);
}
