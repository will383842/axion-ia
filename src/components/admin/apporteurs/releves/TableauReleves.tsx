// Tableau de vérification d'une période : un relevé par ligne, EN LECTURE (aucune action ici).
import Link from "next/link";

import { AdminBadge } from "@/components/admin/ui";
import type { ReleveEcran } from "@/features/apporteurs-reseau/releve-mensuel/statistiques";
import { eur } from "./format";

const LIBELLE: Record<ReleveEcran["statut"], string> = {
  prepare: "Préparé",
  envoi_en_cours: "Envoi en cours",
  envoye: "Envoyé",
  echec: "Échec",
  ecarte: "Écarté",
};
const TON: Record<
  ReleveEcran["statut"],
  "neutral" | "info" | "success" | "destructive" | "warning"
> = {
  prepare: "info",
  envoi_en_cours: "warning",
  envoye: "success",
  echec: "destructive",
  ecarte: "neutral",
};

export function TableauReleves({
  base,
  periode,
  releves,
  peutVoirPdf,
}: {
  /** `/fr/<adminPrefix>` */
  base: string;
  periode: string;
  releves: readonly ReleveEcran[];
  /** Droit de facturation : le PDF est une pièce financière. */
  peutVoirPdf: boolean;
}) {
  if (releves.length === 0) {
    return (
      <p className="text-[color:var(--color-admin-fg-muted)]">
        Aucun relevé préparé pour cette période.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[length:var(--text-admin-sm)]">
        <thead>
          <tr className="text-[color:var(--color-admin-fg-muted)]">
            <th className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">Apporteur</th>
            <th className="pr-[var(--space-admin-3)]">Numéro</th>
            <th className="pr-[var(--space-admin-3)] text-right">Lignes</th>
            <th className="pr-[var(--space-admin-3)] text-right">Facturé HT</th>
            <th className="pr-[var(--space-admin-3)] text-right">Avoirs HT</th>
            <th className="pr-[var(--space-admin-3)] text-right">TVA</th>
            <th className="pr-[var(--space-admin-3)] text-right">TTC</th>
            <th className="pr-[var(--space-admin-3)] text-right">Viré TTC</th>
            <th className="pr-[var(--space-admin-3)] text-right">En attente HT</th>
            <th className="pr-[var(--space-admin-3)]">Statut</th>
            <th className="pr-[var(--space-admin-3)]">Empreinte</th>
            <th>Aperçu</th>
          </tr>
        </thead>
        <tbody>
          {releves.map((r) => (
            <tr key={r.id} className="border-t border-[color:var(--color-admin-border)] align-top">
              <td className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">
                <Link href={`${base}/apporteurs/${r.apporteurId}`} className="underline">
                  {r.apporteurNom}
                </Link>
              </td>
              <td className="pr-[var(--space-admin-3)] font-mono">
                {r.numero}
                {r.rang > 0 ? " (rectificatif)" : ""}
              </td>
              <td className="pr-[var(--space-admin-3)] text-right">{r.nbLignes}</td>
              <td className="pr-[var(--space-admin-3)] text-right">{eur(r.facturesHtCents)}</td>
              <td className="pr-[var(--space-admin-3)] text-right">{eur(r.avoirsHtCents)}</td>
              <td className="pr-[var(--space-admin-3)] text-right">
                {r.tvaCents === null ? "—" : eur(r.tvaCents)}
              </td>
              <td className="pr-[var(--space-admin-3)] text-right">
                {r.ttcCents === null ? "—" : eur(r.ttcCents)}
              </td>
              <td className="pr-[var(--space-admin-3)] text-right">{eur(r.viresTtcCents)}</td>
              <td className="pr-[var(--space-admin-3)] text-right">{eur(r.enAttenteHtCents)}</td>
              <td className="pr-[var(--space-admin-3)]">
                <AdminBadge tone={TON[r.statut]}>{LIBELLE[r.statut]}</AdminBadge>
                {r.motifEcart ? (
                  <span className="block text-[color:var(--color-admin-fg-muted)]">
                    {r.motifEcart}
                  </span>
                ) : null}
              </td>
              <td className="pr-[var(--space-admin-3)] font-mono">{r.empreinteCourte}</td>
              <td>
                {r.pdfDisponible && peutVoirPdf ? (
                  <a
                    href={`${base}/apporteurs/releves/${periode}/pdf?numero=${r.numero}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    PDF
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
