import JSZip from "jszip";

export async function filesFromDatasetZip(zipFile: File): Promise<File[]> {
  const zip = await JSZip.loadAsync(zipFile);
  const files = await Promise.all(
    Object.values(zip.files)
      .filter((entry) => !entry.dir && !isSystemFile(entry.name))
      .map(async (entry) => {
        const blob = await entry.async("blob");
        const file = new File([blob], fileName(entry.name), {
          lastModified: zipFile.lastModified,
          type: mimeType(entry.name),
        });

        Object.defineProperty(file, "webkitRelativePath", {
          value: entry.name,
        });

        return file;
      }),
  );

  return files;
}

function isSystemFile(path: string): boolean {
  const fileName = path.split("/").at(-1) ?? path;
  return path.includes("__MACOSX/") || fileName.startsWith("._") || fileName === ".DS_Store";
}

function fileName(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function mimeType(path: string): string {
  const extension = path.split(".").at(-1)?.toLowerCase();

  if (extension === "txt") {
    return "text/plain";
  }

  if (extension === "json") {
    return "application/json";
  }

  if (extension === "wav") {
    return "audio/wav";
  }

  return "";
}
