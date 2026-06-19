import { useCallback, useEffect, useRef, useState } from 'react';
import { CropEditor, defaultCrop } from './components/CropEditor';
import { Controls } from './components/Controls';
import { useDebouncedCrop, useDebouncedValue } from './hooks/useDebouncedValue';
import {
  processImage,
  parseSizeInput,
  type CropRect,
  type OutputFormat,
  type ProcessResult,
  type Priority,
  type CropShape,
} from './lib/imageProcess';
import './App.css';
import { GITHUB_URL, SITE_URL } from './site';

function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageName, setImageName] = useState('image');
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [originalBytes, setOriginalBytes] = useState<number | null>(null);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [targetSize, setTargetSize] = useState('1');
  const [targetUnit, setTargetUnit] = useState<'KB' | 'MB'>('MB');
  const [format, setFormat] = useState<OutputFormat>('image/webp');
  const [pixelMode, setPixelMode] = useState<'crop' | 'custom'>('crop');
  const [targetPixelW, setTargetPixelW] = useState('');
  const [targetPixelH, setTargetPixelH] = useState('');
  const [priority, setPriority] = useState<Priority>('pixels');
  const [cropShape, setCropShape] = useState<CropShape>('rect');
  const [realtimeCompile, setRealtimeCompile] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [compileGeneration, setCompileGeneration] = useState(0);
  const processIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const debouncedCrop = useDebouncedCrop(crop, 80);
  const debouncedTargetSize = useDebouncedValue(targetSize, 150);
  const debouncedTargetUnit = useDebouncedValue(targetUnit, 150);
  const debouncedFormat = useDebouncedValue(format, 150);
  const debouncedPixelMode = useDebouncedValue(pixelMode, 150);
  const debouncedTargetPixelW = useDebouncedValue(targetPixelW, 150);
  const debouncedTargetPixelH = useDebouncedValue(targetPixelH, 150);
  const debouncedPriority = useDebouncedValue(priority, 150);
  const debouncedCropShape = useDebouncedValue(cropShape, 150);

  const loadImage = useCallback((src: string, name: string) => {
    const img = new Image();
    img.onload = () => {
      setImageSrc(src);
      setImageName(name.replace(/\.[^.]+$/, ''));
      setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
      setCrop(defaultCrop(img.naturalWidth, img.naturalHeight));
      setPixelMode('crop');
      setTargetPixelW('');
      setTargetPixelH('');
      setResult(null);
      setCompileGeneration(0);

      fetch(src)
        .then((r) => r.blob())
        .then((b) => setOriginalBytes(b.size))
        .catch(() => setOriginalBytes(null));
    };
    img.src = src;
  }, []);

  const readFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          loadImage(reader.result, file.name);
        }
      };
      reader.readAsDataURL(file);
    },
    [loadImage],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            readFile(file);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [readFile]);

  const runProcess = useCallback(() => {
    if (!imageSrc || debouncedCrop.width <= 0 || debouncedCrop.height <= 0) return;

    const id = ++processIdRef.current;
    setCompileGeneration((n) => n + 1);
    setProcessing(true);

    const targetBytes = parseSizeInput(debouncedTargetSize, debouncedTargetUnit);
    const customW = parseInt(debouncedTargetPixelW, 10);
    const customH = parseInt(debouncedTargetPixelH, 10);
    const useCustomPixels =
      debouncedPixelMode === 'custom' && customW > 0 && customH > 0;

    processImage(imageSrc, {
      crop: debouncedCrop,
      targetBytes,
      format: debouncedFormat,
      priority: debouncedPriority,
      cropShape: debouncedCropShape,
      ...(useCustomPixels
        ? { outputWidth: customW, outputHeight: customH }
        : {}),
    })
      .then((res) => {
        if (id !== processIdRef.current) return;
        setResult(res);
      })
      .catch((err) => {
        console.error('Processing failed:', err);
        if (id !== processIdRef.current) return;
        setResult(null);
      })
      .finally(() => {
        if (id === processIdRef.current) setProcessing(false);
      });
  }, [
    imageSrc,
    debouncedCrop,
    debouncedTargetSize,
    debouncedTargetUnit,
    debouncedFormat,
    debouncedPixelMode,
    debouncedTargetPixelW,
    debouncedTargetPixelH,
    debouncedPriority,
    debouncedCropShape,
  ]);

  useEffect(() => {
    if (!realtimeCompile) return;
    runProcess();
  }, [realtimeCompile, runProcess]);

  useEffect(() => {
    if (realtimeCompile) return;
    setResult(null);
  }, [
    realtimeCompile,
    debouncedCrop,
    debouncedTargetSize,
    debouncedTargetUnit,
    debouncedFormat,
    debouncedPixelMode,
    debouncedTargetPixelW,
    debouncedTargetPixelH,
    debouncedPriority,
    debouncedCropShape,
  ]);

  useEffect(() => {
    if (!imageSrc) setResult(null);
  }, [imageSrc]);

  const handleDownload = () => {
    if (!result) return;
    const ext = format === 'image/webp' ? 'webp' : format === 'image/jpeg' ? 'jpg' : 'png';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(result.blob);
    a.download = `${imageName}-rimage.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const canGenerate = !!imageSrc && debouncedCrop.width > 0 && debouncedCrop.height > 0 && !processing;

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo" title="Remake + image">
            <span className="logo-mark" aria-hidden>R</span>
            <span className="logo-text">image</span>
          </div>
          <p className="tagline">
            Remake your images
            <span className="tagline-detail">crop · compress · download</span>
          </p>
        </div>

        <div className="header-right">
          <span className="header-pill" title="Processing uses Canvas in your browser — no server uploads">
            Local & offline
          </span>
          <details className="header-help">
            <summary className="header-help-trigger">How it works</summary>
            <div className="header-help-panel">
              <p className="header-help-lead">
                Everything runs in your browser. Images stay on your device — nothing is uploaded.
              </p>
              <ol className="header-help-steps">
                <li>Upload, drag, or paste an image</li>
                <li>Crop and pick target pixels, file size, and format</li>
                <li>Compile (or enable realtime compile), then download</li>
              </ol>
              <p className="header-help-tip">
                Shortcut: <kbd>H</kbd> hand · <kbd>C</kbd> crop (resets region) · paste with <kbd>⌘V</kbd>
              </p>
            </div>
          </details>
          <a
            className="header-link"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="View source on GitHub"
          >
            GitHub
          </a>
        </div>
      </header>

      <main className="main">
        <div className="workspace">
          <div className="workspace-editor">
            <CropEditor
              imageSrc={imageSrc}
              crop={crop}
              onCropChange={setCrop}
              imageWidth={imageSize.w}
              imageHeight={imageSize.h}
              onUpload={handleUpload}
              onImage={loadImage}
              realtimeCompile={realtimeCompile}
              onRealtimeCompileChange={setRealtimeCompile}
              processing={processing}
              compileGeneration={compileGeneration}
              cropShape={cropShape}
              onCropShapeChange={setCropShape}
            />
          </div>

          <div className="workspace-side">
            <Controls
              targetSize={targetSize}
              targetUnit={targetUnit}
              format={format}
              pixelMode={pixelMode}
              targetPixelW={targetPixelW}
              targetPixelH={targetPixelH}
              cropWidth={Math.round(crop.width)}
              cropHeight={Math.round(crop.height)}
              onTargetSizeChange={setTargetSize}
              onTargetUnitChange={setTargetUnit}
              onFormatChange={setFormat}
              onPixelModeChange={setPixelMode}
              onTargetPixelWChange={setTargetPixelW}
              onTargetPixelHChange={setTargetPixelH}
              priority={priority}
              onPriorityChange={setPriority}
              onDownload={handleDownload}
              onCompile={runProcess}
              realtimeCompile={realtimeCompile}
              canCompile={canGenerate}
              hasImage={!!imageSrc}
              processing={processing}
              compileGeneration={compileGeneration}
              resultBytes={result?.bytes ?? null}
              resultWidth={result?.width ?? null}
              resultHeight={result?.height ?? null}
              resultQuality={result?.quality ?? null}
              pixelsLocked={result?.pixelsLocked ?? false}
              overTargetSize={result?.overTargetSize ?? false}
              pixelsReduced={result?.pixelsReduced ?? false}
              requestedWidth={result?.requestedWidth ?? null}
              requestedHeight={result?.requestedHeight ?? null}
              originalBytes={originalBytes}
            />
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p className="app-footer-copy">
          Developed by{' '}
          <a href={SITE_URL} target="_blank" rel="noopener noreferrer">
            jingjietan.com
          </a>
        </p>
        <p className="app-footer-meta">
          100% client-side · runs locally ·{' '}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </p>
      </footer>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export default App;
