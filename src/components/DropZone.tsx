import { useCallback, useRef } from 'react';

interface DropZoneProps {
  onImage: (dataUrl: string, name: string) => void;
  onBrowse?: () => void;
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export function DropZone({ onImage, onBrowse }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onImage(reader.result, file.name);
        }
      };
      reader.readAsDataURL(file);
    },
    [onImage],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) readFile(file);
    },
    [readFile],
  );

  const openPicker = useCallback(() => {
    if (onBrowse) {
      onBrowse();
      return;
    }
    inputRef.current?.click();
  }, [onBrowse]);

  return (
    <div
      className="editor-empty"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Upload or drop an image"
    >
      <div className="editor-empty-inner">
        <div className="editor-empty-icon">
          <UploadIcon />
        </div>
        <h2>Drop an image here</h2>
        <p>or click to browse · paste with <kbd>⌘V</kbd></p>
      </div>
      {!onBrowse && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
            e.target.value = '';
          }}
        />
      )}
    </div>
  );
}
