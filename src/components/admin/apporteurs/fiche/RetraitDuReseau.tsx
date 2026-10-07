"use client";
// use-client: confirmations en deux temps et appels d'actions serveur (useTransition).

// Retirer du réseau / Remettre / Supprimer définitivement (2026-10-07).
// Composant À PART de `BlocsFiche.tsx` (une autre session y travaille). Les contrôles
// sont refaits côté serveur (`features/apporteurs-reseau/retrait.ts`) : l'écran ne fait
// que proposer.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AdminCard } from "@/components/admin/ui";
import {
  remettreDansLeReseauAction,
  retirerDuReseauAction,
  supprimerDefinitivementAction,
} from "@/features/apporteurs-reseau/actions-retrait";

interface Props {
  readonly apporteurId: string;
  /** « Prénom Nom », à retaper pour supprimer. */
  readonly nomComplet: string;
  readonly signe: boolean;
  /** Date de retrait déjà formatée, ou `null` si la fiche est dans le réseau. */
  readonly retireLe: string | null;
  /** `null` : suppression permise ; sinon la raison pour laquelle elle ne l'est pas. */
  readonly refusSuppression: string | null;
  /** Retour à la liste après une suppression. */
  readonly listeHref: string;
}

const normaliser = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function RetraitDuReseau({
  apporteurId,
  nomComplet,
  signe,
  retireLe,
  refusSuppression,
  listeHref,
}: Props) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [confirmerRetrait, setConfirmerRetrait] = useState(false);
  const [nomTape, setNomTape] = useState("");
  const [compris, setCompris] = useState(false);
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);

  const lancer = (geste: () => Promise<{ ok: boolean; message: string }>, apres?: () => void) =>
    demarrer(async () => {
      const r = await geste();
      setRetour(r);
      if (r.ok) {
        setConfirmerRetrait(false);
        if (apres) apres();
        else router.refresh();
      }
    });

  const nomCorrect = normaliser(nomTape) !== "" && normaliser(nomTape) === normaliser(nomComplet);

  return (
    <AdminCard as="section">
      <h2 className="mb-[var(--space-admin-3)] font-semibold">Place dans le réseau</h2>

      {retireLe ? (
        <div className="flex flex-col gap-[var(--space-admin-2)]">
          <p>
            Fiche <strong>retirée du réseau</strong> le {retireLe}. Le lien du dossier ne fonctionne
            plus. Rien n&apos;a été effacé.
          </p>
          <div>
            <button
              type="button"
              className="admin-button-secondary"
              disabled={enCours}
              onClick={() => lancer(() => remettreDansLeReseauAction({ apporteurId }))}
            >
              Remettre dans le réseau
            </button>
          </div>
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Un nouveau lien de dossier est créé ; il n&apos;est pas envoyé.
          </p>
        </div>
      ) : confirmerRetrait ? (
        <div
          className="flex flex-col gap-[var(--space-admin-2)]"
          role="group"
          aria-label="Confirmer le retrait"
        >
          <p>
            La fiche sortira des listes (onglet « Retirés » pour la revoir) et le lien du dossier
            sera désactivé. Rien n&apos;est effacé : contrat, pièces, commissions et autofactures
            restent.
          </p>
          {signe ? (
            <p className="admin-alert" role="note">
              Le contrat prévoit une fin avec 30 jours de préavis (art. 11.1) ; retirer la fiche ne
              résilie pas le contrat. Pour y mettre fin, utilisez{" "}
              <a href="#resiliation" className="underline">
                « Résilier le contrat »
              </a>
              . Les commissions dues restent dues.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-[var(--space-admin-2)]">
            <button
              type="button"
              className="admin-button"
              disabled={enCours}
              onClick={() => lancer(() => retirerDuReseauAction({ apporteurId }))}
            >
              Confirmer le retrait
            </button>
            <button
              type="button"
              className="admin-button-secondary"
              disabled={enCours}
              onClick={() => setConfirmerRetrait(false)}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            className="admin-button-secondary"
            disabled={enCours}
            onClick={() => setConfirmerRetrait(true)}
          >
            Retirer du réseau
          </button>
        </div>
      )}

      <div className="mt-[var(--space-admin-4)] border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-3)]">
        {refusSuppression ? (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Suppression définitive impossible — {refusSuppression}
          </p>
        ) : (
          <details>
            <summary className="cursor-pointer font-medium">
              Supprimer définitivement le dossier
            </summary>
            <div className="mt-[var(--space-admin-2)] flex flex-col gap-[var(--space-admin-2)]">
              <p>
                Le dossier d&apos;apporteur et ses pièces seront supprimés. La fiche candidat est
                conservée. Cette action ne peut pas être annulée.
              </p>
              <label className="flex flex-col gap-1">
                <span>
                  Pour confirmer, tapez le nom : <strong>{nomComplet}</strong>
                </span>
                <input
                  className="admin-input"
                  value={nomTape}
                  onChange={(e) => setNomTape(e.target.value)}
                  autoComplete="off"
                  maxLength={200}
                  disabled={enCours}
                />
              </label>
              <label className="flex items-center gap-[var(--space-admin-2)]">
                <input
                  type="checkbox"
                  checked={compris}
                  onChange={(e) => setCompris(e.target.checked)}
                  disabled={enCours}
                />
                Je comprends que la suppression est définitive.
              </label>
              <div>
                <button
                  type="button"
                  className="admin-button"
                  disabled={enCours || !nomCorrect || !compris}
                  onClick={() =>
                    lancer(
                      () => supprimerDefinitivementAction({ apporteurId, nomTape }),
                      () => router.push(listeHref),
                    )
                  }
                >
                  Supprimer définitivement
                </button>
              </div>
            </div>
          </details>
        )}
      </div>

      {retour ? (
        <p
          role={retour.ok ? "status" : "alert"}
          className={`mt-[var(--space-admin-3)] ${retour.ok ? "admin-alert admin-alert-success" : "admin-alert admin-alert-error"}`}
        >
          {retour.message}
        </p>
      ) : null}
    </AdminCard>
  );
}
