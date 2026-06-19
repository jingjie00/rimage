import type { ReactNode } from 'react';
import type { OutputFormat, Priority } from '../lib/imageProcess';
import { formatBytes } from '../lib/imageProcess';
import { useCompileFlash } from '../hooks/useCompileFlash';

type PixelMode = 'crop' | 'custom';

interface ControlsProps {
  targetSize: string;
  targetUnit: 'KB' | 'MB';
  format: OutputFormat;
  pixelMode: PixelMode;
  targetPixelW: string;
  targetPixelH: string;
  cropWidth: number;
  cropHeight: number;
  onTargetSizeChange: (v: string) => void;
  onTargetUnitChange: (u: 'KB' | 'MB') => void;
  onFormatChange: (f: OutputFormat) => void;
  onPixelModeChange: (m: PixelMode) => void;
  onTargetPixelWChange: (v: string) => void;
  onTargetPixelHChange: (v: string) => void;
  priority: Priority;
  onPriorityChange: (p: Priority) => void;
  onDownload: () => void;
  onCompile: () => void;
  realtimeCompile: boolean;
  canCompile: boolean;
  hasImage: boolean;
  processing: boolean;
  compileGeneration: number;
  resultBytes: number | null;
  resultWidth: number | null;
  resultHeight: number | null;
  resultQuality: number | null;
  pixelsLocked: boolean;
  overTargetSize: boolean;
  pixelsReduced: boolean;
  requestedWidth: number | null;
  requestedHeight: number | null;
  originalBytes: number | null;
}

const MB_PRESETS = ['1', '2', '3', '4', '5'] as const;

function isPresetActive(targetSize: string, targetUnit: 'KB' | 'MB', mb: string): boolean {
  return targetUnit === 'MB' && targetSize === mb;
}

function StatValue({
  processing,
  hasOutput,
  children,
  placeholder = '…',
  compileKey,
}: {
  processing: boolean;
  hasOutput: boolean;
  children: ReactNode;
  placeholder?: string;
  compileKey?: number;
}) {
  if (processing) {
    return (
      <span className="stat-loading" aria-live="polite" key={compileKey}>
        <span className="stat-spinner" aria-hidden />
        <span className="stat-loading-text">Compiling</span>
      </span>
    );
  }
  if (!hasOutput) {
    return <span className="stat-pending">{placeholder}</span>;
  }
  return <>{children}</>;
}

export function Controls({
  targetSize,
  targetUnit,
  format,
  pixelMode,
  targetPixelW,
  targetPixelH,
  cropWidth,
  cropHeight,
  onTargetSizeChange,
  onTargetUnitChange,
  onFormatChange,
  onPixelModeChange,
  onTargetPixelWChange,
  onTargetPixelHChange,
  priority,
  onPriorityChange,
  onDownload,
  onCompile,
  realtimeCompile,
  canCompile,
  hasImage,
  processing,
  compileGeneration,
  resultBytes,
  resultWidth,
  resultHeight,
  resultQuality,
  pixelsLocked,
  overTargetSize,
  pixelsReduced,
  requestedWidth,
  requestedHeight,
  originalBytes,
}: ControlsProps) {
  const targetBytes =
    parseFloat(targetSize) > 0
      ? (targetUnit === 'MB' ? parseFloat(targetSize) * 1024 * 1024 : parseFloat(targetSize) * 1024)
      : 0;

  const savings =
    originalBytes && resultBytes
      ? Math.max(0, ((originalBytes - resultBytes) / originalBytes) * 100)
      : null;

  const hasOutput = !processing && resultWidth != null && resultHeight != null && resultBytes != null;
  const compileFlash = useCompileFlash(compileGeneration, realtimeCompile);
  const showCompileActivity = realtimeCompile && processing && compileGeneration > 0;
  const isCompileRestart = compileGeneration > 1;
  const isDownloadMode = realtimeCompile || hasOutput;
  const buttonLabel = processing ? 'Compiling…' : isDownloadMode ? 'Download' : 'Compile';
  const buttonDisabled = processing || (isDownloadMode ? !hasOutput : !canCompile);
  const buttonClass = `btn btn-block ${hasOutput ? 'btn-download' : 'btn-primary'}`;

  const onFooterAction = () => {
    if (hasOutput) onDownload();
    else if (!realtimeCompile) onCompile();
  };

  const onPresetClick = (mb: string) => {
    onTargetSizeChange(mb);
    onTargetUnitChange('MB');
  };

  const onCustomPixelMode = () => {
    onPixelModeChange('custom');
    if (!targetPixelW && cropWidth > 0) onTargetPixelWChange(String(cropWidth));
    if (!targetPixelH && cropHeight > 0) onTargetPixelHChange(String(cropHeight));
  };

  const cropLabel =
    cropWidth > 0 && cropHeight > 0 ? `${cropWidth} × ${cropHeight}` : '—';

  return (
    <aside className="controls">
      <div className="controls-body">
        <section className="control-section">
          <h3>Priority</h3>
          <div className="priority-options">
            <button
              type="button"
              className={`btn btn-ghost btn-sm ${priority === 'pixels' ? 'active' : ''}`}
              onClick={() => onPriorityChange('pixels')}
            >
              Pixels
            </button>
            <button
              type="button"
              className={`btn btn-ghost btn-sm ${priority === 'size' ? 'active' : ''}`}
              onClick={() => onPriorityChange('size')}
            >
              File size
            </button>
          </div>
          <p className="control-desc">
            {priority === 'pixels'
              ? 'Keeps your target pixels. May exceed file size limit.'
              : 'Hits file size limit. May shrink pixels if quality alone is not enough.'}
          </p>
        </section>

        <section className="control-section">
          <h3>Target pixels</h3>
          <div className="pixel-mode-options">
            <button
              type="button"
              className={`btn btn-ghost btn-sm ${pixelMode === 'crop' ? 'active' : ''}`}
              onClick={() => onPixelModeChange('crop')}
            >
              Same as crop
            </button>
            <button
              type="button"
              className={`btn btn-ghost btn-sm ${pixelMode === 'custom' ? 'active' : ''}`}
              onClick={onCustomPixelMode}
            >
              Custom
            </button>
          </div>

          {pixelMode === 'crop' ? (
            <p className="control-desc pixel-crop-hint">Crop size: {cropLabel}</p>
          ) : (
            <div className="pixel-input-row">
              <input
                type="number"
                className="input"
                min="1"
                step="1"
                placeholder="Width"
                value={targetPixelW}
                onChange={(e) => onTargetPixelWChange(e.target.value)}
              />
              <span className="pixel-input-sep">×</span>
              <input
                type="number"
                className="input"
                min="1"
                step="1"
                placeholder="Height"
                value={targetPixelH}
                onChange={(e) => onTargetPixelHChange(e.target.value)}
              />
            </div>
          )}
        </section>

        <section className="control-section">
          <h3>Target file size</h3>
          <p className="control-desc">
            {priority === 'pixels'
              ? 'Used as a quality target when pixels are prioritized.'
              : 'Output will stay at or under this limit.'}
          </p>
          <div className="size-presets">
            {MB_PRESETS.map((mb) => (
              <button
                key={mb}
                type="button"
                className={`btn btn-ghost btn-sm ${isPresetActive(targetSize, targetUnit, mb) ? 'active' : ''}`}
                onClick={() => onPresetClick(mb)}
              >
                {mb} MB
              </button>
            ))}
          </div>
          <div className="size-custom">
            <span className="size-custom-label">Custom</span>
            <div className="size-input-row">
              <input
                type="number"
                className="input"
                min="1"
                step="1"
                value={targetSize}
                onChange={(e) => onTargetSizeChange(e.target.value)}
              />
              <div className="unit-toggle">
                <button
                  type="button"
                  className={`btn btn-ghost btn-sm ${targetUnit === 'KB' ? 'active' : ''}`}
                  onClick={() => onTargetUnitChange('KB')}
                >
                  KB
                </button>
                <button
                  type="button"
                  className={`btn btn-ghost btn-sm ${targetUnit === 'MB' ? 'active' : ''}`}
                  onClick={() => onTargetUnitChange('MB')}
                >
                  MB
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="control-section">
          <h3>Format</h3>
          <div className="format-options">
            {([
              ['image/webp', 'WebP'],
              ['image/jpeg', 'JPEG'],
              ['image/png', 'PNG'],
            ] as [OutputFormat, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`btn btn-ghost ${format === value ? 'active' : ''}`}
                onClick={() => onFormatChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className={`controls-footer${hasImage ? '' : ' controls-footer-inactive'}`}>
        {showCompileActivity && (
          <div className={`compile-activity${compileFlash ? ' compile-activity-flash' : ''}`}>
            <span className="stat-spinner" aria-hidden />
            <span className="compile-activity-label">
              Compile <span className="compile-activity-num">#{compileGeneration}</span>
            </span>
            {isCompileRestart && compileFlash && (
              <span className="compile-activity-restart">Updated</span>
            )}
          </div>
        )}

        <div
          className={[
            'output-summary',
            processing ? 'output-summary-processing' : '',
            hasOutput ? '' : 'output-summary-pending',
            compileFlash ? 'output-summary-flash' : '',
          ].filter(Boolean).join(' ')}
        >
          <div className="output-summary-row">
            <span className="output-summary-label">Pixels</span>
            <span className="output-pixels output-pixels-compact">
              <StatValue
                processing={processing}
                hasOutput={hasOutput}
                placeholder="… × …"
                compileKey={compileGeneration}
              >
                {resultWidth} <span className="output-pixels-sep">×</span> {resultHeight}
              </StatValue>
            </span>
          </div>
          <div className="output-summary-row">
            <span className="output-summary-label">File size</span>
            <span className={hasOutput && resultBytes! <= targetBytes ? 'stat-good' : hasOutput ? 'stat-warn' : undefined}>
              <StatValue processing={processing} hasOutput={hasOutput} compileKey={compileGeneration}>
                {resultBytes != null ? formatBytes(resultBytes) : '—'}
              </StatValue>
              {targetBytes > 0 && (
                <span className="stat-target"> / {formatBytes(targetBytes)}</span>
              )}
            </span>
          </div>
          <div className="output-summary-row">
            <span className="output-summary-label">Quality</span>
            <StatValue
              processing={processing}
              hasOutput={hasOutput && resultQuality != null}
              compileKey={compileGeneration}
            >
              {resultQuality != null ? `${Math.round(resultQuality * 100)}%` : '—'}
            </StatValue>
          </div>
          <div className="output-summary-row">
            <span className="output-summary-label">Saved</span>
            <StatValue
              processing={processing}
              hasOutput={hasOutput && savings != null}
              compileKey={compileGeneration}
            >
              {savings != null ? (
                <span className={savings > 0 ? 'stat-good' : undefined}>{savings.toFixed(0)}%</span>
              ) : (
                '—'
              )}
            </StatValue>
          </div>
        </div>

        {(hasOutput && pixelsLocked) ||
        (hasOutput && pixelsReduced && requestedWidth && requestedHeight) ||
        (hasOutput && overTargetSize && pixelsLocked) ? (
          <div className="output-notices">
            {hasOutput && pixelsLocked && (
              <p className="output-notice output-notice-info">Pixels hard-forced</p>
            )}
            {hasOutput && pixelsReduced && requestedWidth && requestedHeight && (
              <p className="output-notice output-notice-warn">
                Pixels reduced from {requestedWidth} × {requestedHeight}
              </p>
            )}
            {hasOutput && overTargetSize && pixelsLocked && (
              <p className="output-notice output-notice-warn">File size over target</p>
            )}
          </div>
        ) : null}

        <button
          type="button"
          className={buttonClass}
          onClick={onFooterAction}
          disabled={buttonDisabled}
        >
          {buttonLabel}
        </button>
      </div>
    </aside>
  );
}
