import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { MAX_PDF_BYTES, validateResumeFile } from "~/lib/validation";
import { formatSize } from "../lib/utils";

interface FileUploaderProps {
  onFileSelect?: (file: File | null) => void;
}

const FileUploader = ({ onFileSelect }: FileUploaderProps) => {
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0] || null;

      const error = file
        ? validateResumeFile(file)
        : "Choose one PDF, up to 10 MB.";
      setError(error ?? "");
      if (error) {
        setFile(null);
        onFileSelect?.(null);
        return;
      }
      setFile(file);
      onFileSelect?.(file);
    },
    [onFileSelect],
  );

  const maxFileSize = MAX_PDF_BYTES;

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    multiple: false,
    accept: { "application/pdf": [".pdf"] },
    maxSize: maxFileSize,
  });

  return (
    <div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <div
        {...getRootProps({
          role: "button",
          "aria-label": "Choose resume PDF",
          className: "upload-area",
        })}
      >
        <input {...getInputProps()} />
        {file ? (
          <div
            className="uploader-selected-file"
            onClick={(e) => e.stopPropagation()}
          >
            <svg
              width="30"
              height="40"
              viewBox="0 0 30 40"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path d="M5 1h14l9 9v29H5zM19 1v10h9M10 21h13M10 26h13M10 31h8" />
            </svg>
            <div className="selected-file-info">
              <p className="selected-file-name">{file.name}</p>
              <p className="field-help">{formatSize(file.size)} · PDF</p>
            </div>
            <button
              type="button"
              aria-label="Remove selected PDF"
              className="icon-button"
              onClick={() => {
                setFile(null);
                onFileSelect?.(null);
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ) : (
          <>
            <span className="upload-symbol" aria-hidden="true">
              <svg
                width="42"
                height="52"
                viewBox="0 0 42 52"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              >
                <path d="M7 1h18l10 10v40H7zM25 1v11h10M21 38V22m-6 6 6-6 6 6" />
              </svg>
            </span>
            <p className="upload-title">A place for your experience.</p>
            <p className="field-help">
              <span className="text-link">Choose a PDF</span> or drag it here
            </p>
            <p className="field-help">PDF · up to {formatSize(maxFileSize)}</p>
          </>
        )}
      </div>
    </div>
  );
};
export default FileUploader;
