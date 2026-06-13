"use client";
// use-client: upload de fichiers vers R2 + état d'envoi (useState/useTransition/useRouter).

// Uploader d'un slot de document : dépôt d'une nouvelle version (source
// éditable .docx/.pptx + PDF figé), upload DIRECT navigateur → R2 (presigned
// PUT, gros fichiers OK), puis publication avec note « Quoi de neuf ».

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  prepareUploadAction,
  attachFileAction,
  publishVersionAction,
} from "@/server/actions/intervention-documents/documents.actions";

type Famille = "formation" | "un_a_un" | "audit";

interface CurrentView {
  version: number;
  sourceUrl: string | null;
  pdfUrl: string | null;
  publishedAt: string | null;
  changeNote: string | null;
}
interface HistoryRow {
  version: number;
  statut: string;
  changeNote: string | null;
  publishedAt: string | null;
}

interface Props {
  interventionSlug: string;
  famille: Famille;
  slot: string;
  current: CurrentView | null;
  history: HistoryRow[];
}

const MIME: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

function extOf(name: string): string {
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "bin";
}
function mimeOf(file: File): string {
  return file.type || MIME[extOf(file.name)] || "application/octet-stream";
}

export function SlotUploader({
  interventionSlug,
  famille,
  slot,
  current,
  history,
}: Props): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sourceRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  async function uploadOne(kind: "source" | "pdf", file: File): Promise<string> {
    const contentType = mimeOf(file);
    const prep = await prepareUploadAction({
      interventionSlug,
      famille,
      slot,
      kind,
      filename: file.name,
      contentType,
    });
    if (!prep.ok) throw new Error(prep.error);
    const put = await fetch(prep.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!put.ok) throw new Error(`Upload R2 échoué (${put.status}).`);
    const attached = await attachFileAction({
      versionId: prep.versionId,
      kind,
      key: prep.key,
      sizeBytes: file.size,
      sourceFormat: kind === "source" ? extOf(file.name) : undefined,
    });
    if (!attached.ok) throw new Error(attached.error ?? "Enregistrement échoué.");
    return prep.versionId;
  }

  function handlePublish() {
    setError(null);
    const sourceFile = sourceRef.current?.files?.[0] ?? null;
    const pdfFile = pdfRef.current?.files?.[0] ?? null;
    if (!sourceFile && !pdfFile) {
      setError("Sélectionnez au moins un fichier (source ou PDF).");
      return;
    }
    startTransition(async () => {
      try {
        let versionId: string | null = null;
        if (sourceFile) {
          setStatus("Envoi de la source…");
          versionId = await uploadOne("source", sourceFile);
        }
        if (pdfFile) {
          setStatus("Envoi du PDF…");
          versionId = await uploadOne("pdf", pdfFile);
        }
        if (!versionId) throw new Error("Aucune version créée.");
        setStatus("Publication…");
        const pub = await publishVersionAction({
          versionId,
          changeNote: changeNote.trim() || undefined,
        });
        if (!pub.ok) throw new Error(pub.error ?? "Publication échouée.");
        setStatus(null);
        setOpen(false);
        setChangeNote("");
        if (sourceRef.current) sourceRef.current.value = "";
        if (pdfRef.current) pdfRef.current.value = "";
        router.refresh();
      } catch (e) {
        setStatus(null);
        setError(e instanceof Error ? e.message : "Erreur inconnue.");
      }
    });
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {current ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="bg-sage-soft text-success rounded px-1.5 py-0.5 font-medium">
              v{current.version} publiée
            </span>
            {current.sourceUrl ? (
              <a href={current.sourceUrl} className="text-terracotta hover:underline">
                Source
              </a>
            ) : null}
            {current.pdfUrl ? (
              <a href={current.pdfUrl} className="text-terracotta hover:underline">
                PDF
              </a>
            ) : null}
          </div>
        ) : (
          <span className="text-fg-muted text-xs">Aucun document déposé.</span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="border-terracotta text-terracotta hover:bg-terracotta-soft rounded-md border px-3 py-1.5 text-xs font-medium"
        >
          {open ? "Annuler" : current ? "Nouvelle version" : "Déposer"}
        </button>
      </div>

      {open ? (
        <div className="border-border bg-bg mt-3 space-y-2 rounded-lg border p-3">
          <label className="text-mocha block text-xs font-medium">
            Source éditable (.docx / .pptx)
            <input ref={sourceRef} type="file" className="mt-1 block w-full text-xs" />
          </label>
          <label className="text-mocha block text-xs font-medium">
            PDF figé (optionnel)
            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf,.pdf"
              className="mt-1 block w-full text-xs"
            />
          </label>
          <label className="text-mocha block text-xs font-medium">
            Quoi de neuf (note de version)
            <input
              type="text"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="Ex. mise à jour des prompts, correction page 4…"
              className="border-border mt-1 block w-full rounded border px-2 py-1 text-xs"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={handlePublish}
              className="bg-terracotta rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {pending ? "En cours…" : "Publier la version"}
            </button>
            {status ? <span className="text-fg-muted text-xs">{status}</span> : null}
          </div>
          {error ? <p className="text-error text-xs">{error}</p> : null}
        </div>
      ) : null}

      {history.length > 1 ? (
        <details className="mt-2">
          <summary className="text-fg-muted cursor-pointer text-xs">
            Historique ({history.length} versions)
          </summary>
          <ul className="mt-1 space-y-1">
            {history.map((h) => (
              <li key={h.version} className="text-fg-muted text-xs">
                v{h.version} · {h.statut}
                {h.publishedAt ? ` · ${h.publishedAt.slice(0, 10)}` : ""}
                {h.changeNote ? ` — ${h.changeNote}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
