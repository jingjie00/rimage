export type OutputFormat = 'image/jpeg' | 'image/webp' | 'image/png';
export type Priority = 'pixels' | 'size';
export type CropShape = 'rect' | 'circle';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessOptions {
  crop: CropRect;
  targetBytes: number;
  format: OutputFormat;
  priority: Priority;
  cropShape?: CropShape;
  outputWidth?: number;
  outputHeight?: number;
  maxDimension?: number;
}

export interface ProcessResult {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  quality: number | null;
  format: OutputFormat;
  requestedWidth: number;
  requestedHeight: number;
  pixelsLocked: boolean;
  overTargetSize: boolean;
  pixelsReduced: boolean;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const tryFormat = format;
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        if (tryFormat === 'image/webp') {
          canvas.toBlob(
            (jpegBlob) =>
              jpegBlob ? resolve(jpegBlob) : reject(new Error('Failed to encode image')),
            'image/jpeg',
            quality ?? 0.92,
          );
          return;
        }
        reject(new Error('Failed to encode image'));
      },
      tryFormat,
      quality,
    );
  });
}

function drawCropped(
  img: HTMLImageElement,
  crop: CropRect,
  outW: number,
  outH: number,
  cropShape: CropShape = 'rect',
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (cropShape === 'circle') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
  }

  ctx.drawImage(
    img,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outW,
    outH,
  );

  if (cropShape === 'circle') {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    const r = Math.min(outW, outH) / 2;
    ctx.arc(outW / 2, outH / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  return canvas;
}

async function encodeWithQuality(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  if (format === 'image/png') {
    return canvasToBlob(canvas, format);
  }
  return canvasToBlob(canvas, format, quality);
}

async function findBestQuality(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  targetBytes: number,
): Promise<{ blob: Blob; quality: number }> {
  let lo = 0.05;
  let hi = 1.0;
  let best: { blob: Blob; quality: number } | null = null;

  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const blob = await encodeWithQuality(canvas, format, mid);
    if (blob.size <= targetBytes) {
      best = { blob, quality: mid };
      lo = mid;
    } else {
      hi = mid;
    }
  }

  if (best) return best;

  const blob = await encodeWithQuality(canvas, format, lo);
  return { blob, quality: lo };
}

function makeResult(
  blob: Blob,
  outW: number,
  outH: number,
  format: OutputFormat,
  quality: number | null,
  requestedW: number,
  requestedH: number,
  targetBytes: number,
  pixelsLocked: boolean,
): ProcessResult {
  return {
    blob,
    width: outW,
    height: outH,
    bytes: blob.size,
    quality,
    format,
    requestedWidth: requestedW,
    requestedHeight: requestedH,
    pixelsLocked,
    overTargetSize: blob.size > targetBytes,
    pixelsReduced: outW < requestedW || outH < requestedH,
  };
}

async function encodeAtFixedPixels(
  img: HTMLImageElement,
  crop: CropRect,
  outW: number,
  outH: number,
  targetBytes: number,
  format: OutputFormat,
  requestedW: number,
  requestedH: number,
  cropShape: CropShape,
): Promise<ProcessResult> {
  const canvas = drawCropped(img, crop, outW, outH, cropShape);

  if (format === 'image/png') {
    const blob = await canvasToBlob(canvas, format);
    return makeResult(blob, outW, outH, format, null, requestedW, requestedH, targetBytes, true);
  }

  const { blob, quality } = await findBestQuality(canvas, format, targetBytes);
  return makeResult(blob, outW, outH, format, quality, requestedW, requestedH, targetBytes, true);
}

async function optimizeForSize(
  img: HTMLImageElement,
  crop: CropRect,
  requestedW: number,
  requestedH: number,
  targetBytes: number,
  format: OutputFormat,
  maxDimension: number,
  cropShape: CropShape,
): Promise<ProcessResult> {
  if (format === 'image/png') {
    let scale = 1;
    let result: ProcessResult | null = null;

    for (let attempt = 0; attempt < 20; attempt++) {
      const outW = Math.max(1, Math.round(requestedW * scale));
      const outH = Math.max(1, Math.round(requestedH * scale));
      const canvas = drawCropped(img, crop, outW, outH, cropShape);
      const blob = await canvasToBlob(canvas, format);

      result = makeResult(blob, outW, outH, format, null, requestedW, requestedH, targetBytes, false);

      if (blob.size <= targetBytes || scale <= 0.05) break;
      scale *= Math.sqrt(targetBytes / blob.size) * 0.92;
    }

    return result!;
  }

  let scale = Math.min(1, maxDimension / Math.max(requestedW, requestedH));
  let result: ProcessResult | null = null;

  for (let attempt = 0; attempt < 24; attempt++) {
    const outW = Math.max(1, Math.round(requestedW * scale));
    const outH = Math.max(1, Math.round(requestedH * scale));
    const canvas = drawCropped(img, crop, outW, outH, cropShape);
    const { blob, quality } = await findBestQuality(canvas, format, targetBytes);

    result = makeResult(blob, outW, outH, format, quality, requestedW, requestedH, targetBytes, false);

    if (blob.size <= targetBytes || scale <= 0.05) break;

    const ratio = targetBytes / blob.size;
    scale *= Math.sqrt(ratio) * 0.94;
  }

  return result!;
}

export async function processImage(
  imageSrc: string,
  options: ProcessOptions,
): Promise<ProcessResult> {
  const img = await loadImage(imageSrc);
  const cropW = Math.max(1, Math.round(options.crop.width));
  const cropH = Math.max(1, Math.round(options.crop.height));
  const requestedW =
    options.outputWidth != null
      ? Math.max(1, Math.round(options.outputWidth))
      : cropW;
  const requestedH =
    options.outputHeight != null
      ? Math.max(1, Math.round(options.outputHeight))
      : cropH;
  const maxDim = options.maxDimension ?? 4096;
  const cropShape = options.cropShape ?? 'rect';

  if (options.priority === 'pixels') {
    return encodeAtFixedPixels(
      img,
      options.crop,
      requestedW,
      requestedH,
      options.targetBytes,
      options.format,
      requestedW,
      requestedH,
      cropShape,
    );
  }

  return optimizeForSize(
    img,
    options.crop,
    requestedW,
    requestedH,
    options.targetBytes,
    options.format,
    maxDim,
    cropShape,
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function parseSizeInput(value: string, unit: 'KB' | 'MB'): number {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return 200 * 1024;
  return unit === 'MB' ? num * 1024 * 1024 : num * 1024;
}
