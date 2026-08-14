import { AppError } from '@hanzo/esign-lib/errors/app-error';
import type { TImportSource } from '@hanzo/esign-lib/universal/import';
import { ImportError } from '@hanzo/esign-lib/universal/import';

/** The name the server gave the document it resolved. */
const filename = (response: Response): string => {
  const header = response.headers.get('content-disposition') ?? '';

  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);

  if (encoded) {
    return decodeURIComponent(encoded[1]);
  }

  return /filename="?([^";]+)"?/i.exec(header)?.[1] ?? 'document.pdf';
};

/**
 * Read an import source as a PDF.
 *
 * The server resolves it — a link is fetched there, so no address the browser
 * cannot reach is a problem and no source needs the browser's permission. What
 * comes back is a File, which is what the upload path already knows how to
 * create an envelope from.
 */
export const importPdf = async (source: TImportSource): Promise<File> => {
  const response = await fetch('/api/files/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(source),
  }).catch(() => null);

  if (!response) {
    throw new AppError(ImportError.fetch);
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);

    throw AppError.parseFromJSON(body) ?? new AppError(ImportError.fetch);
  }

  return new File([await response.blob()], filename(response), { type: 'application/pdf' });
};
