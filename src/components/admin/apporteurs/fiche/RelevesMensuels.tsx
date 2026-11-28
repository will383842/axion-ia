// Fiche apporteur : relevés mensuels de cet apporteur (LECTURE seule, lot 4b').
// L'état de remise se lit dans `EmailLog` (par `jobId`). Lot 4b : « Établir un relevé rectificatif » (crée une ligne préparée, n'envoie rien).

import Link from "next/link";

import { AdminBadge, AdminCard } from "@/components/admin/ui";
import { dateHeureParis, moisLisible } from "@/components/admin/apporteurs/releves/format";
import { BoutonRectificatif } from "./BoutonRectificatif";
import type {
  ReleveDeFiche,
  StatutReleveEcran,
} from "@/features/apporteurs-reseau/releve-mensuel/statistiques";

export type { ReleveDeFiche };

export type CodeEtatEnvoi = "prepare" | "ecarte" | "en_file" | "envoye" | "echoue";

const ETATS: Record<
  CodeEtatEnvoi,
  { libelle: string; ton: "neutral" | "info" | "success" | "warning" | "destructive" }
> = {
  prepare: { libelle: "Préparé, pas encore envoyé", ton: "info" },
  ecarte: { libelle: "Écarté", ton: "neutral" },
  en_file: { libelle: "En file", ton: "warning" },
  envoye: { libelle: "Envoyé", ton: "success" },
  echoue: { libelle: "Échec", ton: "destructive" },
};

/** État d'envoi lisible : le statut du relevé, corrigé par ce que dit le journal d'e-mails. */
export function etatEnvoiReleve(
  statut: StatutReleveEcran,
  statutEmail: string | null,
): { code: CodeEtatEnvoi; libelle: string; ton: (typeof ETATS)[CodeEtatEnvoi]["ton"] } {
  let code: CodeEtatEnvoi;
  if (statut === "prepare") code = "prepare";
  else if (statut === "ecarte") code = "ecarte";
  else if (statut === "echec") code = "echoue";
  else if (statutEmail === "failed" || statutEmail === "bounced" || statutEmail === "cancelled") {
    code = "echoue";
  } else if (statut === "envoye" && statutEmail === "sent") code = "envoye";
  else code = "en_file"; // envoi_en_cours, ou enfilé sans journal « sent » (en attente / pas encore écrit)
  return { code, ...ETATS[code] };
}

export function RelevesMensuels({
  base,
  releves,
  peutVoirPdf,
  peutRectifier = false,
}: {
  /** `/fr/<adminPrefix>` */
  base: string;
  releves: readonly ReleveDeFiche[];
  /** Droit de facturation : le PDF est une pièce financière. */
  peutVoirPdf: boolean;
  /** Droit de facturation : « Établir un relevé rectificatif » (lot 4b). Rien n'est envoyé. */
  peutRectifier?: boolean;
}) {
  return (
    <AdminCard as="section">
      <h2 className="mb-[var(--space-admin-3)] font-semibold">
        Relevés mensuels ({releves.length})
      </h2>
      {releves.length === 0 ? (
        <p className="text-[color:var(--color-admin-fg-muted)]">
          Aucun relevé pour cet apporteur pour l&apos;instant.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[length:var(--text-admin-sm)]">
            <thead>
              <tr className="text-[color:var(--color-admin-fg-muted)]">
                <th className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">Période</th>
                <th className="pr-[var(--space-admin-3)]">Numéro</th>
                <th className="pr-[var(--space-admin-3)]">Envoi</th>
                <th className="pr-[var(--space-admin-3)]">Empreinte</th>
                <th className="pr-[var(--space-admin-3)]">PDF</th>
                {peutRectifier ? <th>Rectificatif</th> : null}
              </tr>
            </thead>
            <tbody>
              {releves.map((r) => {
                const etat = etatEnvoiReleve(r.statut, r.statutEmail);
                return (
                  <tr
                    key={r.id}
                    className="border-t border-[color:var(--color-admin-border)] align-top"
                  >
                    <td className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">
                      <Link href={`${base}/apporteurs/releves/${r.periode}`} className="underline">
                        {moisLisible(r.periode)}
                      </Link>
                      {r.rang > 0 ? <span className="block">Rectificatif n° {r.rang}</span> : null}
                    </td>
                    <td className="pr-[var(--space-admin-3)] font-mono">{r.numero}</td>
                    <td className="pr-[var(--space-admin-3)]">
                      <AdminBadge tone={etat.ton}>{etat.libelle}</AdminBadge>
                      {r.envoyeAt ? (
                        <span className="block text-[color:var(--color-admin-fg-muted)]">
                          {dateHeureParis(r.envoyeAt)}
                        </span>
                      ) : null}
                      {etat.code === "echoue" && r.erreur ? (
                        <span className="block text-[color:var(--color-admin-fg-muted)]">
                          {r.erreur}
                        </span>
                      ) : null}
                    </td>
                    <td className="pr-[var(--space-admin-3)] font-mono">{r.empreinteCourte}</td>
                    <td className="pr-[var(--space-admin-3)]">
                      {r.pdfDisponible && peutVoirPdf ? (
                        <a
                          href={`${base}/apporteurs/releves/${r.periode}/pdf?numero=${r.numero}`}
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
                    {peutRectifier ? (
                      <td>
                        {(r.statut === "envoye" || r.statut === "echec") &&
                        etat.code !== "echoue" ? (
                          <BoutonRectificatif id={r.id} />
                        ) : (
                          "—"
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );
}
