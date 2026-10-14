"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  MAX_IMAGES,
  UploadError,
  isPdf,
  prepareImage,
  preparePdf,
  type PreparedImage,
  type PreparedPdf,
} from "@/lib/client/prepare";

export type UploadPayload =
  | { images: { mediaType: "image/jpeg"; data: string }[] }
  | { pdf: string };

export function Uploader({ busy, onSubmit }: { busy: boolean; onSubmit: (payload: UploadPayload) => void }) {
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [pdf, setPdf] = useState<PreparedPdf | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Free the preview blobs when the uploader goes away.
  useEffect(() => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl)), []);

  async function addFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    setError(null);
    const pdfs = files.filter(isPdf);
    const photos = files.filter((file) => !isPdf(file));

    if (pdfs.length > 0 && (photos.length > 0 || pdfs.length > 1)) {
      setError("Upload either photos of the pages or one PDF, not both.");
      return;
    }

    setPreparing(true);
    try {
      if (pdfs.length === 1) {
        const prepared = await preparePdf(pdfs[0]);
        images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        setImages([]);
        setPdf(prepared);
        return;
      }
      const room = MAX_IMAGES - (pdf ? 0 : images.length);
      if (photos.length > room) {
        setError(`A letter can have up to ${MAX_IMAGES} photos.`);
        return;
      }
      const prepared: PreparedImage[] = [];
      for (const photo of photos) prepared.push(await prepareImage(photo));
      setPdf(null);
      setImages((current) => [...(pdf ? [] : current), ...prepared]);
    } catch (err) {
      setError(err instanceof UploadError ? err.message : "We couldn't read that file. Please try another one.");
    } finally {
      setPreparing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function move(index: number, delta: -1 | 1) {
    setImages((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
  }

  function remove(index: number) {
    setImages((current) => {
      URL.revokeObjectURL(current[index].previewUrl);
      return current.filter((_, i) => i !== index);
    });
  }

  function submit() {
    if (pdf) onSubmit({ pdf: pdf.data });
    else if (images.length > 0) {
      onSubmit({ images: images.map((image) => ({ mediaType: image.mediaType, data: image.data })) });
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void addFiles(event.dataTransfer.files);
  }

  const hasFiles = images.length > 0 || pdf !== null;
  const disabled = busy || preparing;

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          dragging ? "border-accent bg-accent/5" : "border-line bg-surface"
        }`}
      >
        <input
          ref={inputRef}
          id="letter-upload"
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="sr-only"
          onChange={(event) => void addFiles(event.target.files)}
          disabled={disabled}
        />
        <label
          htmlFor="letter-upload"
          className={`inline-block cursor-pointer rounded-xl bg-accent px-5 py-3 font-semibold text-on-accent hover:bg-accent/90 ${
            disabled ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {hasFiles ? "Add more pages" : "Choose photos or a PDF"}
        </label>
        <p className="mt-3 text-sm text-muted">
          Up to {MAX_IMAGES} photos, one per page, or one PDF. Lay the letter flat in good light.
        </p>
        {preparing && <p className="mt-2 text-sm">Preparing your pages…</p>}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {images.length > 0 && (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image, i) => (
            <li key={image.id} className="overflow-hidden rounded-xl border border-line bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={image.previewUrl} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
              <div className="flex items-center justify-between px-1.5 py-1 text-sm">
                <span className="whitespace-nowrap pl-1 font-medium">Page {i + 1}</span>
                <span className="flex">
                  <IconButton label={`Move page ${i + 1} earlier`} disabled={disabled || i === 0} onClick={() => move(i, -1)}>
                    ←
                  </IconButton>
                  <IconButton
                    label={`Move page ${i + 1} later`}
                    disabled={disabled || i === images.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    →
                  </IconButton>
                  <IconButton label={`Remove page ${i + 1}`} disabled={disabled} onClick={() => remove(i)}>
                    ✕
                  </IconButton>
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {pdf && (
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
          <span className="min-w-0 truncate">
            {pdf.name} <span className="text-muted">({(pdf.size / 1024 / 1024).toFixed(1)} MB)</span>
          </span>
          <IconButton label="Remove PDF" disabled={disabled} onClick={() => setPdf(null)}>
            ✕
          </IconButton>
        </div>
      )}

      {hasFiles && (
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className="w-full rounded-xl bg-accent px-5 py-3.5 text-lg font-semibold text-on-accent hover:bg-accent/90 disabled:opacity-60"
        >
          {busy ? "Reading your letter…" : "Explain my letter"}
        </button>
      )}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-lg hover:bg-subtle disabled:opacity-30"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
