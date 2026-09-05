/**
 * Admin — La fiche d'une personne.
 *
 * ## Ce qu'elle montre
 *
 * Tout ce que le site sait d'un humain, rassemblé par l'empreinte de son
 * adresse e-mail : premier contact apporteur, dossier, candidature à une offre,
 * message reçu. Chacun de ces objets vit dans son propre écran ; ici on les
 * voit ENSEMBLE, pour la première fois.
 *
 * ## Ce qu'elle ne fait pas, et pourquoi
 *
 * Elle RAPPROCHE, elle ne FUSIONNE pas. « A candidaté en mars » et « est
 * apporteur depuis juin » restent deux faits distincts, dans leur vocabulaire
 * respectif.
 *
 * 🔴 Contrainte de droit, pas d'architecture : la boîte recrutement impose un
 * vocabulaire de sélection — présélectionné, écarté, embauché — dont l'emploi
 * sur un apporteur d'affaires écrirait dans la base la preuve d'un lien de
 * subordination. Cette fiche est donc une VUE, en lecture seule : aucun statut
 * commun, aucune file commune, aucune alerte de dormance commune.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { formatDateFr } from "@/lib/format-date-fr";
import { adminPath } from "@/lib/admin-path";
import { lireFichePersonne, type MondeTrace } from "@/features/personne/fiche-personne";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fiche personne | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string; empreinte: string }>;
}

/** Libellé du monde. Deux mots distincts pour deux réalités distinctes. */
const LIBELLE_MONDE: Record<MondeTrace, string> = {
  apporteur: "Apporteur d'affaires",
  emploi: "Candidature emploi",
  autre: "Autre",
};

export default async function FichePersonnePage({ params }: PageProps) {
  const { adminPrefix, empreinte } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const fiche = await lireFichePersonne(empreinte);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={fiche.nom ?? "Personne sans nom connu"}
        description="Tout ce que le site sait de cette personne, rassemblé par son adresse e-mail. Lecture seule."
      />

      {fiche.desDeuxCotes ? (
        <AdminCard>
          <h2 className="admin-h2">Cette personne existe des deux côtés</h2>
          <p className="admin-help">
            Elle a <strong>{fiche.compte.emploi}</strong> trace(s) côté candidature emploi et{" "}
            <strong>{fiche.compte.apporteur}</strong> côté apporteur d&apos;affaires.
          </p>
          <p className="admin-help mt-[var(--space-admin-2)]">
            ⛔ Les deux restent <strong>distincts</strong>. Un apporteur d&apos;affaires n&apos;est
            pas un candidat à un poste : lui appliquer un statut de sélection — présélectionné,
            écarté, embauché — écrirait dans la base la preuve d&apos;un lien de subordination.
            Cette fiche les montre côte à côte ; elle ne les confond jamais.
          </p>
        </AdminCard>
      ) : null}

      <AdminCard>
        <h2 className="admin-h2">Ses traces, de la plus récente à la plus ancienne</h2>
        <p className="admin-help mb-[var(--space-admin-3)]">
          Chaque ligne s&apos;ouvre dans son écran d&apos;origine, avec ses propres outils. Rien ne
          se modifie ici.
        </p>

        {fiche.traces.length === 0 ? (
          <AdminEmptyState
            title="Aucune trace pour cette empreinte"
            description="Soit cette personne n'a jamais rien envoyé, soit ses lignes ont été effacées à sa demande — l'effacement remet l'empreinte à zéro, volontairement."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table w-full min-w-[42rem]">
              <thead>
                <tr>
                  <th scope="col">Monde</th>
                  <th scope="col">Ce que c&apos;est</th>
                  <th scope="col">Précision</th>
                  <th scope="col">Quand</th>
                  <th scope="col">
                    <span className="sr-only">Ouvrir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {fiche.traces.map((t) => (
                  <tr key={`${t.monde}-${t.id}`}>
                    <td className="whitespace-nowrap">{LIBELLE_MONDE[t.monde]}</td>
                    <td className="font-medium">{t.intitule}</td>
                    <td>{t.detail ?? <span className="admin-help">—</span>}</td>
                    <td className="whitespace-nowrap">{formatDateFr(t.quand)}</td>
                    <td>
                      <a className="admin-link" href={`${adminPath("fr", t.chemin)}`}>
                        Ouvrir
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
