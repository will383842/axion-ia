"use client";
// use-client: état interactif local (résultat + erreur) + useTransition pour la server action genererAttestationAction.
/**
 * GenererAttestationButton — Bouton de génération d'attestation d'un stagiaire.
 *
 * Déclenche `genererAttestationAction` et affiche le résultat :
 * complète / partielle / aucune. Propose un bouton « Forcer la regénération »
 * si une attestation existe déjà.
 *
 * "use client" : appel Server Action + feedback interactif.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  MOTIF_PREUVES_MIN,
  refusEstRattrapableParMotif,
} from "@/server/qualiopi/evaluations/refus-attestation";
import { useDossierFige } from "@/features/admin-qualiopi/session-hub/DossierVerrouProvider";

/**
 * Seuil du motif de RECTIFICATION — le même que le schéma serveur
 * (`genererAttestationSchema.rectificationMotif`, 10 caractères après `trim`).
 */
export const MOTIF_RECTIFICATION_ATTESTATION_MIN = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Types props
// ─────────────────────────────────────────────────────────────────────────────

type AttestationResultat = "complete" | "partielle" | "aucune";

export interface GenererAttestationButtonProps {
  enrollmentId: string;
  /** True si une attestation a déjà été générée (affiche le bouton "Forcer"). */
  dejaGeneree: boolean;
  /** Server Action AGENT B. */
  genererAction: (input: {
    enrollmentId: string;
    force?: boolean;
    /**
     * 🔴 ADR 0060 (D7) — une régénération forcée est une RECTIFICATION : le
     * serveur refuse `force` sans ce motif. Il est porté au registre.
     */
    rectificationMotif?: string;
    /**
     * 🔴 La SOUPAPE. Sans elle, ce bouton ne pouvait plus rien produire dès que
     * la garde des preuves refusait — et l'attestation est DUE au stagiaire.
     */
    motifPreuvesManquantes?: string;
  }) => Promise<
    { data: { resultat: AttestationResultat; documentId: string | null } } | { error: string }
  >;
}

// ─────────────────────────────────────────────────────────────────────────────
// Libellés
// ─────────────────────────────────────────────────────────────────────────────

const RESULTAT_LABELS: Record<AttestationResultat, string> = {
  complete: "Attestation complète générée",
  partielle: "Attestation partielle générée",
  // Depuis l'audit initial 2026-09-14, présence faible, exclus et abandons
  // reçoivent tous une pièce (L.6313-7, dern. al.) : « aucune » ne sort plus que d'une
  // génération concurrente, ou d'un ancien résultat « aucune » resté en base.
  aucune:
    "Aucune pièce produite (génération déjà en cours ou ancien résultat « aucune ») : actualisez, puis régénérez si besoin",
};

function resultatCouleur(resultat: AttestationResultat): string {
  if (resultat === "complete") return "text-[color:var(--color-admin-success)]";
  if (resultat === "partielle") return "text-[color:var(--color-admin-warning)]";
  return "text-[color:var(--color-admin-error)]";
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function GenererAttestationButton({
  enrollmentId,
  dejaGeneree,
  genererAction,
}: GenererAttestationButtonProps): React.ReactElement {
  // ADR 0060 — dossier clos : régénérer est refusé (écriture VERROU). La
  // première émission reste possible, mais un dossier clos n'en attend plus.
  const fige = useDossierFige();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resultat, setResultat] = useState<AttestationResultat | null>(null);
  // Révélé UNIQUEMENT quand le serveur a refusé pour un manque rattrapable. On
  // ne le montre jamais d'emblée : sur un dossier complet, réclamer un motif
  // transformerait une génération ordinaire en cérémonie.
  const [motifOuvert, setMotifOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  // D7 — « Regénérer (forcer) » ne part JAMAIS sans son motif de rectification.
  const [rectificationOuverte, setRectificationOuverte] = useState(false);
  const [motifRectification, setMotifRectification] = useState("");
  const motifRectificationValide =
    motifRectification.trim().length >= MOTIF_RECTIFICATION_ATTESTATION_MIN;

  /**
   * @param regenerer vrai pour RECTIFIER une attestation déjà émise : `force` ne
   *        part alors qu'accompagné du motif de rectification. Faux pour une
   *        première émission — la soupape des preuves n'est pas une
   *        régénération et ne doit pas se faire refuser comme telle.
   */
  function handleGenerer(regenerer: boolean) {
    setError(null);
    setResultat(null);
    if (regenerer && !motifRectificationValide) {
      setRectificationOuverte(true);
      return;
    }

    startTransition(async () => {
      const result = await genererAction({
        enrollmentId,
        ...(regenerer ? { force: true, rectificationMotif: motifRectification.trim() } : {}),
        ...(motif.trim().length >= MOTIF_PREUVES_MIN
          ? { motifPreuvesManquantes: motif.trim() }
          : {}),
      });
      if ("error" in result) {
        setError(result.error);
        // 🔴 On ne teste PAS le texte du refus ici : le prédicat vit à côté du
        // message qu'il reconnaît (`refus-attestation.ts`), pour qu'aucune
        // recopie ne puisse diverger. Une chaîne recopiée d'un fichier à
        // l'autre finit toujours par diverger, et la divergence ne se signale
        // pas — le champ cesserait simplement d'apparaître.
        //
        // ⚠️ Le refus DUR (taux non mesuré) ne l'ouvre PAS : proposer d'écrire
        // un motif qui ne lèvera rien fait croire qu'on a agi.
        if (refusEstRattrapableParMotif(result.error)) setMotifOuvert(true);
      } else {
        setResultat(result.data.resultat);
        setRectificationOuverte(false);
        setMotifRectification("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-[var(--space-admin-2)]">
      {/* Bouton principal */}
      {!dejaGeneree && (
        <button
          type="button"
          onClick={() => handleGenerer(false)}
          disabled={isPending}
          className="admin-button"
        >
          {isPending ? "Génération…" : "Générer l'attestation"}
        </button>
      )}

      {/* Bouton forcer si déjà générée — il OUVRE le motif, il ne part pas seul. */}
      {dejaGeneree && !fige && !rectificationOuverte && (
        <button
          type="button"
          onClick={() => setRectificationOuverte(true)}
          disabled={isPending}
          className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] hover:border-[color:var(--color-admin-accent)] hover:text-[color:var(--color-admin-accent)] disabled:opacity-50"
        >
          {isPending ? "Génération…" : "Regénérer (forcer)"}
        </button>
      )}

      {dejaGeneree && !fige && rectificationOuverte && (
        <div className="flex w-full flex-col gap-[var(--space-admin-1)]">
          <label
            className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
            htmlFor={`motif-rectification-${enrollmentId}`}
          >
            Motif de la rectification (obligatoire) : l&apos;attestation déjà émise sera remplacée,
            et ce motif est porté au registre, lu par l&apos;auditeur.
          </label>
          <textarea
            id={`motif-rectification-${enrollmentId}`}
            value={motifRectification}
            onChange={(e) => setMotifRectification(e.target.value)}
            rows={2}
            required
            minLength={MOTIF_RECTIFICATION_ATTESTATION_MIN}
            maxLength={500}
            disabled={isPending}
            placeholder="Ex. : taux de présence corrigé après import du relevé de connexion du 12/09."
            className="admin-input"
          />
          <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {motifRectification.trim().length} / {MOTIF_RECTIFICATION_ATTESTATION_MIN} caractères au
            minimum
          </p>
          <div className="flex gap-[var(--space-admin-2)] self-end">
            <button
              type="button"
              onClick={() => {
                setRectificationOuverte(false);
                setMotifRectification("");
              }}
              disabled={isPending}
              className="admin-button-ghost"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => handleGenerer(true)}
              disabled={isPending || !motifRectificationValide}
              className="admin-button"
            >
              {isPending ? "Génération…" : "Regénérer avec ce motif"}
            </button>
          </div>
        </div>
      )}

      {/* Résultat */}
      {resultat !== null && (
        <p
          role="status"
          className={`text-[length:var(--text-admin-xs)] ${resultatCouleur(resultat)}`}
        >
          {RESULTAT_LABELS[resultat]}
        </p>
      )}

      {/* 🔴 La SOUPAPE, révélée par le refus lui-même. */}
      {motifOuvert && (
        <div className="flex w-full flex-col gap-[var(--space-admin-1)]">
          <label
            className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
            htmlFor={`motif-preuves-${enrollmentId}`}
          >
            Pourquoi attester malgré ces manques ? Le motif est porté au registre et lu par
            l&apos;auditeur.
          </label>
          <textarea
            id={`motif-preuves-${enrollmentId}`}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
            required
            minLength={MOTIF_PREUVES_MIN}
            disabled={isPending}
            placeholder="Émargement papier de 2024 archivé hors logiciel, retrouvé au dossier client."
            className="admin-input"
          />
          <button
            type="button"
            onClick={() => handleGenerer(dejaGeneree)}
            disabled={
              isPending ||
              motif.trim().length < MOTIF_PREUVES_MIN ||
              (dejaGeneree && !motifRectificationValide)
            }
            className="admin-button self-end"
          >
            {isPending ? "Génération…" : "Attester en assumant les manques"}
          </button>
        </div>
      )}

      {/* Erreur */}
      {error !== null && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
    </div>
  );
}
