import { useState, useCallback, useRef, DragEvent } from "react";

interface UseFileDropzoneOptions {
  onFilesDropped: (files: File[]) => void;
  accept?: string;
  disabled?: boolean;
}

export function useFileDropzone({
  onFilesDropped,
  accept = "image/*",
  disabled = false,
}: UseFileDropzoneOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounterRef.current += 1;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      e.dataTransfer.dropEffect = "copy";
      if (!isDragging) {
        setIsDragging(true);
      }
    },
    [disabled, isDragging]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        setIsDragging(false);
        dragCounterRef.current = 0;
      }
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const validFiles = accept.includes("image")
        ? files.filter(
            (f) =>
              f.type.startsWith("image/") ||
              /\.(jpe?g|png|webp|gif|svg|bmp)$/i.test(f.name)
          )
        : files;

      if (validFiles.length > 0) {
        onFilesDropped(validFiles);
      }
    },
    [disabled, accept, onFilesDropped]
  );

  return {
    isDragging,
    dropzoneProps: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
}
