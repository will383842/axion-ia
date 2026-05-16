"use client";
// use-client: useFormStatus + useRef + drag-drop event handlers (interactive form)

// Template : src/components/admin/image-bank/ImageUploadDropzone.tsx
//
// Composant client : dropzone drag-and-drop + form metadata + soumission Server Action.
//
// Doctrine Axion-IA :
//   - "use client" en tête, file séparé du Server Component parent
//   - useFormState (React 19) pour wiring Server Action
//   - useFormStatus pour disable bouton pendant submit
//   - Pas de hex hardcodé (palette tokens v3 Design.md)
//   - WCAG 2.2 AA : focus visible, drop-target accessible clavier
//   - i18n via prop `labels` (parent passe `getTranslations()`)
//
// Server Action : `templates/actions/upload.action.ts`.

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CloudUpload } from "lucide-react";

import {
  uploadImageAction,
  type UploadActionResult,
} from "@/server/actions/image-bank/upload.action";

interface ImageUploadDropzoneProps {
  labels: {
    dropzoneTitle: string;
    dropzoneSubtitle: string;
    submit: string;
    submitting: string;
    titleField: string;
    altField: string;
    captionField: string;
    descriptionField: string;
    successMessage: string;
    errorPrefix: string;
  };
}

export function ImageUploadDropzone({ labels }: ImageUploadDropzoneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<UploadActionResult | null>(null);

  async function handleSubmit(formData: FormData) {
    setResult(null);
    const res = await uploadImageAction(formData);
    setResult(res);
    if (res.success && fileRef.current) {
      fileRef.current.value = "";
      setPreviewUrl(null);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      {/* Dropzone */}
      <label
        htmlFor="image-bank-file"
        className="border-border-strong bg-paper hover:border-terracotta focus-within:border-terracotta focus-within:ring-terracotta flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition focus-within:ring-2 focus-within:ring-offset-2"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Aperçu" className="max-h-64 rounded-lg object-contain" />
        ) : (
          <>
            <CloudUpload className="text-fg-muted h-10 w-10" aria-hidden="true" />
            <p className="text-fg text-base font-medium">{labels.dropzoneTitle}</p>
            <p className="text-fg-muted text-sm">{labels.dropzoneSubtitle}</p>
          </>
        )}
        <input
          ref={fileRef}
          id="image-bank-file"
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/tiff,image/avif"
          required
          className="sr-only"
          onChange={onFileChange}
        />
      </label>

      {/* Metadata fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="title" label={labels.titleField} required maxLength={255} minLength={3} />
        <Field name="alt" label={labels.altField} required maxLength={125} minLength={30} />
        <Field
          name="caption"
          label={labels.captionField}
          maxLength={500}
          className="sm:col-span-2"
        />
        <Field
          name="description"
          label={labels.descriptionField}
          maxLength={2000}
          textarea
          className="sm:col-span-2"
        />
      </div>

      {/* Submit + feedback */}
      <div className="flex items-center gap-4">
        <SubmitButton submit={labels.submit} submitting={labels.submitting} />
        {result?.success === true && (
          <p className="text-success text-sm" role="status">
            {labels.successMessage}
          </p>
        )}
        {result?.success === false && (
          <p className="text-error text-sm" role="alert">
            {labels.errorPrefix} {result.error}
          </p>
        )}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  required,
  maxLength,
  minLength,
  textarea,
  className,
}: {
  name: string;
  label: string;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  textarea?: boolean;
  className?: string;
}) {
  const sharedProps = {
    id: `image-bank-${name}`,
    name,
    required,
    maxLength,
    minLength,
    className:
      "border-border-strong bg-paper text-fg focus:border-terracotta focus:ring-terracotta w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none",
  };

  return (
    <div className={className}>
      <label htmlFor={sharedProps.id} className="text-fg-soft mb-1 block text-sm font-medium">
        {label}
        {required && (
          <span aria-hidden="true" className="text-error ml-1">
            *
          </span>
        )}
      </label>
      {textarea ? <textarea {...sharedProps} rows={4} /> : <input type="text" {...sharedProps} />}
    </div>
  );
}

function SubmitButton({ submit, submitting }: { submit: string; submitting: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-terracotta text-paper hover:bg-terracotta-deep focus-visible:ring-terracotta inline-flex min-h-[44px] items-center justify-center rounded-full px-6 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
    >
      {pending ? submitting : submit}
    </button>
  );
}
