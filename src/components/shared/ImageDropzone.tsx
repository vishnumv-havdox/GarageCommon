import React, { useState, useRef, useCallback } from "react";
import { UploadCloud, Image as ImageIcon, FileCheck, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageDropzoneProps {
  onDropFiles: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  disabled?: boolean;
  compact?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}

export const ImageDropzone: React.FC<ImageDropzoneProps> = ({
  onDropFiles,
  multiple = true,
  accept = "image/*",
  disabled = false,
  compact = false,
  title = "Drag and drop images here",
  subtitle = "or click to browse from your device",
  className,
  children,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    e.dataTransfer.dropEffect = "copy";
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragging(false);
      dragCounterRef.current = 0;
    }
  }, [disabled]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const validFiles = accept.includes("image")
      ? files.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|svg|bmp)$/i.test(f.name))
      : files;

    if (validFiles.length > 0) {
      onDropFiles(multiple ? validFiles : [validFiles[0]]);
    }
  }, [disabled, accept, multiple, onDropFiles]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onDropFiles(multiple ? files : [files[0]]);
    }
    // Reset so same file can be selected again if needed
    e.target.value = "";
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  if (children) {
    return (
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          "relative transition-all cursor-pointer",
          isDragging && "ring-2 ring-blue-500 ring-offset-2 rounded-xl",
          className
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="hidden"
          onChange={handleFileInputChange}
        />
        {children}
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={cn(
        "relative rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center select-none group",
        compact ? "p-3 min-h-[90px]" : "p-6 min-h-[140px]",
        isDragging
          ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 shadow-inner scale-[1.01]"
          : "border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:border-slate-400 dark:hover:border-slate-600",
        disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:border-slate-300",
        className
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div
        className={cn(
          "rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-110",
          compact ? "h-8 w-8 mb-1.5" : "h-11 w-11 mb-2.5",
          isDragging
            ? "bg-blue-600 text-white animate-bounce"
            : "bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:text-primary group-hover:bg-primary/10"
        )}
      >
        {isDragging ? (
          <UploadCloud className={compact ? "h-4 w-4" : "h-6 w-6"} />
        ) : (
          <ImageIcon className={compact ? "h-4 w-4" : "h-5 w-5"} />
        )}
      </div>

      <div className="space-y-0.5 pointer-events-none">
        <p
          className={cn(
            "font-semibold tracking-tight transition-colors",
            compact ? "text-xs" : "text-sm",
            isDragging
              ? "text-blue-700 dark:text-blue-300 font-bold"
              : "text-slate-800 dark:text-slate-200 group-hover:text-primary"
          )}
        >
          {isDragging ? "Drop images now" : title}
        </p>
        {subtitle && !isDragging && (
          <p className={cn("text-slate-500 dark:text-slate-400", compact ? "text-[10px]" : "text-xs")}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
