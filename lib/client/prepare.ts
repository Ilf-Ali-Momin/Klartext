import { MAX_IMAGES, MAX_UPLOAD_MB } from "@/lib/config";

// Browser-only upload preparation. Photos are resized and re-encoded as JPEG on a canvas, which also
// converts iPhone HEIC photos in Safari and keeps the request small.

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;
const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export interface PreparedImage {
  id: string;
  name: string;
  previewUrl: string;
  mediaType: "image/jpeg";
  data: string;
}

export interface PreparedPdf {
  name: string;
  size: number;
  data: string;
}

export class UploadError extends Error {}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(new UploadError("We couldn't read that file."));
    reader.readAsDataURL(blob);
  });
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
    return img;
  } catch {
    throw new UploadError(
      `Your browser can't open "${file.name}". Try a JPEG or PNG photo, or take a screenshot of it.`,
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new UploadError("Your browser can't process photos.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new UploadError("Your browser can't process photos.");
  return {
    id: crypto.randomUUID(),
    name: file.name,
    previewUrl: URL.createObjectURL(blob),
    mediaType: "image/jpeg",
    data: await blobToBase64(blob),
  };
}

export async function preparePdf(file: File): Promise<PreparedPdf> {
  if (file.size > MAX_BYTES) {
    throw new UploadError(
      `This PDF is ${(file.size / 1024 / 1024).toFixed(1)} MB. PDFs can be up to ${MAX_UPLOAD_MB} MB. Try photos of the pages instead.`,
    );
  }
  return { name: file.name, size: file.size, data: await blobToBase64(file) };
}

export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export { MAX_IMAGES };
