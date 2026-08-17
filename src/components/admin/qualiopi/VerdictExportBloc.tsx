"use client";
// use-client: bloc de résultat d'un export de dossier. Rendu pur, aucun appel.

/**
 * Le résultat d'un export de dossier, rendu dans la page — et qui RESTE.
 *
 * 🔴 Remplace un `window.alert`. Le message nommait un fichier à ouvrir dans le
 * ZIP et énumérait des manques : dans une boîte modale, il n'est ni copiable,
 * ni relisible, et il disparaît au premier clic — alors que le ZIP, lui, est
 * déjà téléchargé. Le dossier partait chez l'auditeur avec son anomalie, et
 * l'avertissement n'existait plus nulle part.
 *
 * ⚠️ `role="alert"` sur le cas grave, `role="status"` sinon : « alert »
 * interrompt le lecteur d'écran, ce qui se justifie pour une anomalie
 * d'intégrité et pas pour un téléchargement réussi. Interrompre à chaque
 * succès apprend à ignorer l'interruption.
 */

import type { VerdictExport } from "@/server/qualiopi/documents/verdict-export";

const TON_CLS: Record<VerdictExport["ton"], string> = {
  succes: "border-[color:var(--color-admin-success)] text-[color:var(--color-admin-success)]",
  attention: "border-[color:var(--color-admin-warning)] text-[color:var(--color-admin-warning)]",
  danger: "border-[color:var(--color-admin-danger)] text-[color:var(--color-admin-danger)]",
};

/** Intitulé de la gravité, lu par les lecteurs d'écran — la couleur ne suffit pas. */
const TON_LIBELLE: Record<VerdictExport["ton"], string> = {
  succes: "Succès",
  attention: "Attention",
  danger: "Anomalie",
};

export function VerdictExportBloc({ verdict }: { readonly verdict: VerdictExport | null }) {
  if (verdict === null) return null;

  return (
    <div
      role={verdict.ton === "danger" ? "alert" : "status"}
      className={`mt-[var(--space-admin-3)] rounded-[var(--radius-admin-sm)] border p-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] ${TON_CLS[verdict.ton]}`}
    >
      <p className="font-semibold">
        {/* L'état est dans le TEXTE, jamais dans la seule couleur (WCAG 1.4.1). */}
        <span className="sr-only">{TON_LIBELLE[verdict.ton]} — </span>
        {verdict.titre}
      </p>
      {verdict.details.length > 0 && (
        <ul className="mt-[var(--space-admin-2)] list-disc pl-[var(--space-admin-5)] text-[color:var(--color-admin-fg)]">
          {verdict.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
      {verdict.fichierAConsulter !== null && (
        <p className="mt-[var(--space-admin-2)] text-[color:var(--color-admin-fg)]">
          Fichier à ouvrir dans le ZIP :{" "}
          {/* Sélectionnable et copiable — c'était impossible dans une boîte modale. */}
          <code className="font-mono">{verdict.fichierAConsulter}</code>
        </p>
      )}
    </div>
  );
}
