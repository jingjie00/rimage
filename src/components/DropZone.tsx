import { useCallback } from 'react';

interface DropZoneProps {
  onImage: (dataUrl: string, name: string) => void;
}

export function DropZone({ onImage }: DropZoneProps) {
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

  return (
    <div
      className="editor-empty"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    />
  );
}
