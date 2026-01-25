'use client';

import { useRef, useEffect, useState } from 'react';
import { getAccomplish } from '../../lib/accomplish';
import { analytics } from '../../lib/analytics';
import { CornerDownLeft, Loader2, X, FileText, FileCode, FileImage, File } from 'lucide-react';
import type { FileAttachment } from '@accomplish/shared';

interface TaskInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  isLoading?: boolean;
  disabled?: boolean;
  large?: boolean;
  autoFocus?: boolean;
  onAttachmentsChange?: (attachments: FileAttachment[]) => void;
}

export default function TaskInputBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Assign a task or ask anything',
  isLoading = false,
  disabled = false,
  large = false,
  autoFocus = false,
  onAttachmentsChange,
}: TaskInputBarProps) {
  const isDisabled = disabled || isLoading;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const accomplish = getAccomplish();
  
  const [dragOver, setDragOver] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  // Notify parent of attachment changes
  useEffect(() => {
    if (onAttachmentsChange) {
      onAttachmentsChange(attachments);
    }
  }, [attachments, onAttachmentsChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ignore Enter during IME composition (Chinese/Japanese input)
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  // File type detection
  const getFileType = (fileName: string): FileAttachment['type'] => {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
      return 'image';
    }
    if (['txt', 'md', 'markdown'].includes(ext)) {
      return 'text';
    }
    if (['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'rb', 'go', 'rs', 'php', 'swift', 'kt'].includes(ext)) {
      return 'code';
    }
    if (ext === 'pdf') {
      return 'pdf';
    }
    return 'other';
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Process files
  const processFiles = async (files: File[]) => {
    setError(null);

    const newAttachments: FileAttachment[] = [];

    for (const file of files) {
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds 10MB limit`);
        continue;
      }

      const fileType = getFileType(file.name);
      let preview: string | undefined;

      // Generate preview for images
      if (fileType === 'image') {
        try {
          preview = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        } catch (err) {
          console.error('Failed to generate image preview:', err);
        }
      }

      // Generate preview for text files
      if (fileType === 'text' || fileType === 'code') {
        try {
          preview = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });
          // Limit preview to first 500 characters
          if (preview && preview.length > 500) {
            preview = preview.substring(0, 500) + '...';
          }
        } catch (err) {
          console.error('Failed to read text file:', err);
        }
      }

      newAttachments.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        path: file.name, // In browser context, we use name as path
        type: fileType,
        preview,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
      });
    }

    // Validate total file count after filtering invalid files
    setAttachments(prev => {
      if (prev.length + newAttachments.length > 5) {
        setError('Maximum 5 files allowed');
        return prev;
      }
      return [...prev, ...newAttachments];
    });
  };

  // Drag handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragOver to false if we're leaving the container itself
    if (e.currentTarget === e.target) {
      setDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  // Remove attachment
  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter(att => att.id !== id));
    setError(null);
  };

  // Get icon for file type
  const getFileIcon = (type: FileAttachment['type']) => {
    switch (type) {
      case 'image':
        return <FileImage className="h-4 w-4" />;
      case 'code':
        return <FileCode className="h-4 w-4" />;
      case 'text':
      case 'pdf':
        return <FileText className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-2">
      <div
        className={`relative flex flex-col gap-2 rounded-xl border bg-background px-3 py-2.5 shadow-sm transition-all duration-200 ease-accomplish focus-within:border-ring focus-within:ring-1 focus-within:ring-ring ${
          dragOver
            ? 'border-dashed border-2 border-primary bg-primary/5'
            : 'border-border'
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Text input and submit button row */}
        <div className="flex items-center gap-2">
          {/* Text input */}
          <textarea
            data-testid="task-input-textarea"
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isDisabled}
            rows={1}
            className={`max-h-[200px] flex-1 resize-none bg-transparent text-foreground placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${large ? 'text-[20px]' : 'text-sm'}`}
          />

          {/* Submit button */}
          <button
            data-testid="task-input-submit"
            type="button"
            onClick={() => {
              analytics.trackSubmitTask();
              accomplish.logEvent({
                level: 'info',
                message: 'Task input submit clicked',
                context: { prompt: value, attachmentCount: attachments.length },
              });
              onSubmit();
            }}
            disabled={!value.trim() || isDisabled}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all duration-200 ease-accomplish hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            title="Submit"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CornerDownLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* File attachments */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="group relative flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-1.5 text-sm transition-all hover:border-primary/50 hover:bg-background"
                title={`${attachment.name} (${formatFileSize(attachment.size)})`}
              >
                {getFileIcon(attachment.type)}
                <span className="max-w-[150px] truncate">{attachment.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)}
                </span>
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="ml-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Remove file"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
