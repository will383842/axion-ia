// use-client: useState + useTransition pour lancer le rapport et le remplacement unitaire.
"use client";

import { useState, useTransition } from "react";
import { AdminBadge } from "@/components/admin/ui";
import {
  replaceDuplicateHero,
  reportDuplicateImages,
} from "@/server/actions/content-gen/hero-backfill";
import type { DuplicateArticle } from "@/server/content-gen/images/duplicate-report";

export function ImageDuplicatesReport() {
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<DuplicateArticle[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function scan() {
    setMessage(null);
    startTransition(async () => {
      const res = await reportDuplicateImages();
      if ("error" in res) {
        setMessage(`Erreur : ${res.error}`);
        return;
      }
      setRows(res.duplicates);
      setMessage(
        res.duplicates.length === 0
          ? "Aucun doublon d'image parmi les articles publiés."
          : `${res.duplicates.length} article(s) avec une photo en doublon.`,
      );
    });
  }

  function replace(articleId: string, slug: string) {
    startTransition(async () => {
      const res = await replaceDuplicateHero({ articleId });
      if ("error" in res) {
        setMessage(`Erreur : ${res.error}`);
        return;
      }
      setMessage(
        res.replaced
          ? `Image de « ${slug} » remplacée. Relancez l'analyse pour mettre à jour la liste.`
          : `« ${slug} » inchangé : ${res.reason ?? "aucune photo adaptée"}.`,
      );
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Photos en doublon</h2>
      <p className="admin-meta">
        Analyse en lecture seule. Le remplacement se fait article par article, jamais en masse.
      </p>
      <div>
        <button type="button" className="admin-button" onClick={scan} disabled={pending}>
          {pending ? "…" : "Analyser les doublons"}
        </button>
      </div>
      {message ? (
        <p className="admin-meta" role="status">
          {message}
        </p>
      ) : null}
      {rows && rows.length > 0 ? (
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map((r) => (
            <li key={r.articleId} className="admin-card flex flex-wrap items-center gap-2">
              <code>{r.slug}</code>
              {r.duplicates.map((d) => (
                <AdminBadge key={`${d.key}-${d.where}`} tone="neutral">
                  {d.where === "hero" ? "image principale" : "corps"}
                  {d.repeatedInArticle ? " (répétée)" : ""}
                  {d.sharedWith.length > 0 ? ` · avec ${d.sharedWith.slice(0, 3).join(", ")}` : ""}
                </AdminBadge>
              ))}
              {r.heroDuplicate ? (
                <button
                  type="button"
                  className="admin-button"
                  onClick={() => replace(r.articleId, r.slug)}
                  disabled={pending}
                >
                  Remplacer
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
