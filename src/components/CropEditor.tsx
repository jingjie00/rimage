import { useCallback, useEffect, useRef, useState } from 'react';
import { DropZone } from './DropZone';
import { useCompileFlash } from '../hooks/useCompileFlash';
import type { CropRect, CropShape } from '../lib/imageProcess';

type Handle =
  | 'move'
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

type EditorMode = 'hand' | 'crop';

interface CropEditorProps {
  imageSrc: string | null;
  crop: CropRect;
  onCropChange: (crop: CropRect) => void;
  imageWidth: number;
  imageHeight: number;
  onUpload: () => void;
  onImage: (dataUrl: string, name: string) => void;
  realtimeCompile: boolean;
  onRealtimeCompileChange: (v: boolean) => void;
  processing: boolean;
  compileGeneration: number;
  cropShape: CropShape;
  onCropShapeChange: (shape: CropShape) => void;
}

const MIN_CROP = 4;
const HANDLE_SIZE = 10;
const CANVAS_PADDING = 48;

function clampCrop(crop: CropRect, imgW: number, imgH: number): CropRect {
  const x = Math.max(0, Math.min(crop.x, imgW - MIN_CROP));
  const y = Math.max(0, Math.min(crop.y, imgH - MIN_CROP));
  const width = Math.max(MIN_CROP, Math.min(crop.width, imgW - x));
  const height = Math.max(MIN_CROP, Math.min(crop.height, imgH - y));
  return { x, y, width, height };
}

function clampCircleCrop(crop: CropRect, imgW: number, imgH: number): CropRect {
  const clamped = clampCrop(crop, imgW, imgH);
  const size = Math.min(clamped.width, clamped.height);
  const cx = clamped.x + clamped.width / 2;
  const cy = clamped.y + clamped.height / 2;
  return clampCrop(
    { x: cx - size / 2, y: cy - size / 2, width: size, height: size },
    imgW,
    imgH,
  );
}

function applyCropClamp(crop: CropRect, imgW: number, imgH: number, shape: CropShape): CropRect {
  return shape === 'circle' ? clampCircleCrop(crop, imgW, imgH) : clampCrop(crop, imgW, imgH);
}

function CircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function RectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="1" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-4 0v5" />
      <path d="M14 10V4a2 2 0 0 0-4 0v6" />
      <path d="M10 9.5V5a2 2 0 0 0-4 0v8.5a6 6 0 0 0 6 6h1.5a4.5 4.5 0 0 0 4.5-4.5V11a2 2 0 0 0-4 0v1" />
    </svg>
  );
}

function CropIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function CropEditor({
  imageSrc,
  crop,
  onCropChange,
  imageWidth,
  imageHeight,
  onUpload,
  onImage,
  realtimeCompile,
  onRealtimeCompileChange,
  processing,
  compileGeneration,
  cropShape,
  onCropShapeChange,
}: CropEditorProps) {
  const hasImage = !!imageSrc && imageWidth > 0 && imageHeight > 0;
  const compileFlash = useCompileFlash(compileGeneration, realtimeCompile);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<EditorMode>('crop');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragRef = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    startCrop: CropRect;
  } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; startPan: { x: number; y: number } } | null>(null);

  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });

  const safeW = Math.max(imageWidth, 1);
  const safeH = Math.max(imageHeight, 1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !hasImage) {
      setDisplaySize({ w: 0, h: 0 });
      return;
    }

    const update = () => {
      const rect = el.getBoundingClientRect();
      const availW = Math.max(1, rect.width - CANVAS_PADDING * 2);
      const availH = Math.max(1, rect.height - CANVAS_PADDING * 2);
      const scale = Math.min(availW / safeW, availH / safeH) * zoom;
      setDisplaySize({ w: safeW * scale, h: safeH * scale });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasImage, safeW, safeH, zoom]);

  const scale = hasImage ? displaySize.w / safeW || 1 : 1;

  const startPan = (e: React.PointerEvent) => {
    if (!hasImage) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panRef.current = { startX: e.clientX, startY: e.clientY, startPan: { ...pan } };
    setIsPanning(true);
  };

  const startDrag = (handle: Handle, e: React.PointerEvent) => {
    if (!hasImage || mode !== 'crop') return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
    };
  };

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (dragRef.current && hasImage) {
        const { handle, startX, startY, startCrop } = dragRef.current;
        const dx = (e.clientX - startX) / scale;
        const dy = (e.clientY - startY) / scale;
        let next = { ...startCrop };

        if (handle === 'move') {
          next.x = startCrop.x + dx;
          next.y = startCrop.y + dy;
        } else {
          if (handle.includes('w')) {
            next.x = startCrop.x + dx;
            next.width = startCrop.width - dx;
          }
          if (handle.includes('e')) {
            next.width = startCrop.width + dx;
          }
          if (handle.includes('n')) {
            next.y = startCrop.y + dy;
            next.height = startCrop.height - dy;
          }
          if (handle.includes('s')) {
            next.height = startCrop.height + dy;
          }
        }

        onCropChange(applyCropClamp(next, imageWidth, imageHeight, cropShape));
      }

      if (panRef.current) {
        const { startX, startY, startPan } = panRef.current;
        setPan({
          x: startPan.x + (e.clientX - startX),
          y: startPan.y + (e.clientY - startY),
        });
      }
    },
    [scale, onCropChange, imageWidth, imageHeight, hasImage, cropShape],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    panRef.current = null;
    setIsPanning(false);
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const resetCrop = useCallback(() => {
    if (!hasImage) return;
    const base = defaultCrop(imageWidth, imageHeight);
    onCropChange(applyCropClamp(base, imageWidth, imageHeight, cropShape));
  }, [hasImage, imageWidth, imageHeight, cropShape, onCropChange]);

  const selectCropTool = useCallback(() => {
    setMode('crop');
    resetCrop();
  }, [resetCrop]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.key === 'h' || e.key === 'H') {
        setMode('hand');
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        setMode('crop');
        resetCrop();
        return;
      }

      if (!hasImage || mode !== 'crop') return;

      const step = e.shiftKey ? 10 : 1;
      let next = { ...crop };
      let handled = false;

      switch (e.key) {
        case 'ArrowLeft':
          next.x -= step;
          handled = true;
          break;
        case 'ArrowRight':
          next.x += step;
          handled = true;
          break;
        case 'ArrowUp':
          next.y -= step;
          handled = true;
          break;
        case 'ArrowDown':
          next.y += step;
          handled = true;
          break;
        case '[':
          next.width = Math.max(MIN_CROP, next.width - step);
          handled = true;
          break;
        case ']':
          next.width += step;
          handled = true;
          break;
        case '-':
          next.height = Math.max(MIN_CROP, next.height - step);
          handled = true;
          break;
        case '=':
        case '+':
          next.height += step;
          handled = true;
          break;
      }

      if (handled) {
        e.preventDefault();
        onCropChange(applyCropClamp(next, imageWidth, imageHeight, cropShape));
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, crop, onCropChange, imageWidth, imageHeight, hasImage, cropShape, resetCrop]);

  const cropStyle = {
    left: crop.x * scale,
    top: crop.y * scale,
    width: crop.width * scale,
    height: crop.height * scale,
  };

  const handles: { id: Handle; className: string }[] = [
    { id: 'nw', className: 'handle-nw' },
    { id: 'n', className: 'handle-n' },
    { id: 'ne', className: 'handle-ne' },
    { id: 'e', className: 'handle-e' },
    { id: 'se', className: 'handle-se' },
    { id: 's', className: 'handle-s' },
    { id: 'sw', className: 'handle-sw' },
    { id: 'w', className: 'handle-w' },
  ];

  const cropSizeLabel =
    hasImage && crop.width > 0 && crop.height > 0
      ? cropShape === 'circle'
        ? `Ø ${Math.round(Math.min(crop.width, crop.height))} px`
        : `${Math.round(crop.width)} × ${Math.round(crop.height)} px`
      : cropShape === 'circle' ? 'Ø —' : '— × —';

  const cropHint = !hasImage
    ? 'Upload or paste an image to start'
    : mode === 'hand'
      ? 'Drag to move image · H hand · C crop'
      : cropShape === 'circle'
        ? 'Circle crop · square selection · drag to resize'
        : 'Drag crop or handles · Arrow keys move · [ ] width · - + height';

  const setShape = (shape: CropShape) => {
    onCropShapeChange(shape);
    if (hasImage && shape === 'circle') {
      onCropChange(applyCropClamp(crop, imageWidth, imageHeight, 'circle'));
    }
  };

  return (
    <div className="crop-editor">
      <div className="crop-toolbar">
        <button
          type="button"
          className="btn btn-ghost btn-sm editor-new-btn"
          onClick={onUpload}
          title="Upload a new image"
        >
          <UploadIcon />
          <span>New image</span>
        </button>
        <div className="editor-gen-controls">
          <label className="compile-switch">
            <span className="compile-switch-label">Realtime compile</span>
            <button
              type="button"
              role="switch"
              aria-checked={realtimeCompile}
              className={`switch${realtimeCompile ? ' on' : ''}`}
              onClick={() => onRealtimeCompileChange(!realtimeCompile)}
            >
              <span className="switch-thumb" />
            </button>
          </label>
          {realtimeCompile && processing && (
            <span
              className={`compile-live-badge${compileFlash ? ' compile-live-badge-flash' : ''}`}
              title={`Compile run #${compileGeneration}`}
            >
              <span className="stat-spinner" aria-hidden />
              <span>#{compileGeneration}</span>
            </span>
          )}
        </div>
        <div className="mode-controls">
          <button
            type="button"
            className={`btn btn-ghost btn-sm btn-icon ${mode === 'hand' ? 'active' : ''}`}
            onClick={() => setMode('hand')}
            title="Hand tool (H)"
          >
            <HandIcon />
          </button>
          <button
            type="button"
            className={`btn btn-ghost btn-sm btn-icon ${mode === 'crop' ? 'active' : ''}`}
            onClick={selectCropTool}
            title="Crop tool (C) — resets to full image"
          >
            <CropIcon />
          </button>
          <button
            type="button"
            className={`btn btn-ghost btn-sm btn-icon ${cropShape === 'rect' ? 'active' : ''}`}
            onClick={() => setShape('rect')}
            title="Rectangle crop"
          >
            <RectIcon />
          </button>
          <button
            type="button"
            className={`btn btn-ghost btn-sm btn-icon ${cropShape === 'circle' ? 'active' : ''}`}
            onClick={() => setShape('circle')}
            title="Circle crop"
          >
            <CircleIcon />
          </button>
        </div>
        <div className="crop-info">
          <span className={!hasImage ? 'crop-info-placeholder' : ''}>{cropSizeLabel}</span>
          <span className="crop-hint">{cropHint}</span>
        </div>
        <div className="zoom-controls">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            disabled={!hasImage}
          >
            −
          </button>
          <span className={!hasImage ? 'crop-info-placeholder' : ''}>
            {hasImage ? `${Math.round(zoom * 100)}%` : '—%'}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            disabled={!hasImage}
          >
            +
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            disabled={!hasImage}
          >
            Fit
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`crop-canvas mode-${mode}${isPanning ? ' is-panning' : ''}${!hasImage ? ' crop-canvas-empty' : ''}`}
        onWheel={(e) => {
          if (!hasImage) return;
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.1 : 0.1;
          setZoom((z) => Math.min(4, Math.max(0.5, z + delta)));
        }}
        onPointerDown={(e) => {
          if (mode === 'hand' && e.button === 0) {
            startPan(e);
          }
        }}
      >
        {hasImage ? (
          <div
            className="crop-stage"
            style={{
              width: displaySize.w,
              height: displaySize.h,
              left: `calc(50% - ${displaySize.w / 2}px + ${pan.x}px)`,
              top: `calc(50% - ${displaySize.h / 2}px + ${pan.y}px)`,
            }}
          >
            <img src={imageSrc!} alt="Source" draggable={false} className="crop-image" />

            <div className={`crop-overlay${mode === 'hand' ? ' crop-overlay-passive' : ''}`}>
              {cropShape === 'rect' && (
                <>
                  <div className="crop-shade crop-shade-top" style={{ height: cropStyle.top }} />
                  <div
                    className="crop-shade crop-shade-bottom"
                    style={{ top: cropStyle.top + cropStyle.height, height: displaySize.h - cropStyle.top - cropStyle.height }}
                  />
                  <div
                    className="crop-shade crop-shade-left"
                    style={{ top: cropStyle.top, width: cropStyle.left, height: cropStyle.height }}
                  />
                  <div
                    className="crop-shade crop-shade-right"
                    style={{
                      top: cropStyle.top,
                      left: cropStyle.left + cropStyle.width,
                      width: displaySize.w - cropStyle.left - cropStyle.width,
                      height: cropStyle.height,
                    }}
                  />
                </>
              )}
              {cropShape === 'circle' && (
                <div
                  className="crop-shade crop-shade-circle"
                  style={{
                    WebkitMaskImage: `radial-gradient(circle ${cropStyle.width / 2}px at ${cropStyle.left + cropStyle.width / 2}px ${cropStyle.top + cropStyle.height / 2}px, transparent ${cropStyle.width / 2}px, black ${cropStyle.width / 2}px)`,
                    maskImage: `radial-gradient(circle ${cropStyle.width / 2}px at ${cropStyle.left + cropStyle.width / 2}px ${cropStyle.top + cropStyle.height / 2}px, transparent ${cropStyle.width / 2}px, black ${cropStyle.width / 2}px)`,
                  }}
                />
              )}

              <div
                className={`crop-box${cropShape === 'circle' ? ' crop-box-circle' : ''}`}
                style={cropStyle}
                onPointerDown={(e) => startDrag('move', e)}
              >
                {cropShape === 'rect' && (
                  <>
                    <div className="crop-grid" />
                    <div className="crop-crosshair-h" />
                    <div className="crop-crosshair-v" />
                  </>
                )}
                {cropShape === 'circle' && <div className="crop-circle-ring" />}
                {handles.map(({ id, className }) => (
                  <div
                    key={id}
                    className={`crop-handle ${className}`}
                    style={{ width: HANDLE_SIZE, height: HANDLE_SIZE }}
                    onPointerDown={(e) => startDrag(id, e)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <DropZone onImage={onImage} />
        )}
      </div>
    </div>
  );
}

export function defaultCrop(w: number, h: number): CropRect {
  return { x: 0, y: 0, width: w, height: h };
}
