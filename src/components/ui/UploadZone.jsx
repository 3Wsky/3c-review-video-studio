/** @param {{ id: string; label: string; compact?: boolean; accept?: string; onFile?: (file: File) => void; className?: string }} props */
export function UploadZone({ id, label, compact = false, accept, onFile, className = "" }) {
  return (
    <label
      className={`ds-upload ${compact ? "ds-upload--compact" : ""} ${className}`.trim()}
      htmlFor={id}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file && onFile) onFile(file);
        }}
      />
      <span>{label}</span>
    </label>
  );
}
