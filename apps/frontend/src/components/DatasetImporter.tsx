import { useRef } from "react";
import type { DragEvent, KeyboardEvent, ReactNode } from "react";

type DatasetImporterProps = {
  children: ReactNode;
  className?: string;
  onImport: (files: File[]) => void;
  onZipImport: (file: File) => void;
};

export function DatasetImporter({ children, className, onImport, onZipImport }: DatasetImporterProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const droppedFiles = Array.from(event.dataTransfer.files);
    const zipFile = droppedFiles.find((file) => file.name.toLowerCase().endsWith(".zip"));

    if (zipFile) {
      onZipImport(zipFile);
    } else if (droppedFiles.length > 0) {
      onImport(droppedFiles);
    }
  }

  return (
    <div
      className={className}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          inputRef.current?.click();
        }
      }}
    >
      {children}

      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => onImport(Array.from(event.target.files ?? []))}
        {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
      />
    </div>
  );
}
