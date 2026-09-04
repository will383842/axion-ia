/**
 * Admin — Fabrique de liens de campagne.
 *
 * ## Le problème
 *
 * Un lien de publicité s'écrit à la main dans le gestionnaire, une fois, puis
 * se perd. À la campagne suivante on le réécrit de mémoire — et une faute de
 * frappe dans `utm_content` ne casse RIEN : la page s'affiche, le visiteur
 * candidate, et la seule chose détruite est la comparaison entre deux visuels,
 * c'est-à-dire la décision de remettre ou non de l'argent dans une publicité.
 *
 * ## Le parti pris — on ne stocke pas les liens
 *
 * Un lien est entièrement déterminé par quatre choix. « Retrouver » un lien,
 * c'est donc le REFAIRE, à l'identique, en quatre clics. Une table de liens
 * créerait une seconde vérité : celle des liens qu'on a pensé enregistrer, à
 * côté de celle des liens réellement diffusés — et elle mentirait dans les deux
 * sens, en gardant des liens jamais utilisés et en manquant ceux collés à la
 * main dans le gestionnaire.
 *
 * Ce que l'écran montre en regard, ce sont les campagnes qui ont RÉELLEMENT
 * amené quelqu'un, lues dans les candidatures. Une campagne absente de cette
 * liste n'a pas été perdue : elle n'a rien rapporté.
 *
 * Lecture seule. Aucune écriture, aucune table.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { FabriqueLienCampagne } from "@/components/admin/campagnes/FabriqueLienCampagne";
import { lireCampagnesVues } from "@/features/campagnes/campagnes-vues";
import { formatDateFr } from "@/lib/format-date-fr";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Liens de campagne | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function LiensDeCampagnePage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const { campagnes, plafondAtteint, lignesLues } = await lireCampagnesVues();

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Liens de campagne"
        description="Fabrique le lien à coller dans le gestionnaire de publicités, et vois lesquels ont réellement amené quelqu'un."
      />

      <AdminCard>
        <h2 className="admin-h2">Fabriquer un lien</h2>
        <p className="admin-help mb-[var(--space-admin-3)]">
          Quatre choix suffisent. Les mêmes choix donnent toujours le même lien — il n&apos;y a donc
          rien à conserver : pour retrouver un lien, refais-le.
        </p>
        <FabriqueLienCampagne origine={SITE_URL} />
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Ce qui a réellement amené quelqu&apos;un</h2>
        <p className="admin-help mb-[var(--space-admin-3)]">
          Lu dans les candidatures reçues sur les douze derniers mois, pas dans une liste de liens
          créés. Une campagne absente d&apos;ici n&apos;a rien rapporté — ce n&apos;est pas un oubli
          d&apos;enregistrement.
          {plafondAtteint ? (
            <>
              {" "}
              <strong>
                Plafond de {lignesLues} candidatures atteint : les plus anciennes ne sont pas
                comptées.
              </strong>
            </>
          ) : null}
        </p>

        {campagnes.length === 0 ? (
          <AdminEmptyState
            title="Aucune campagne n'a encore amené de candidature"
            description="Le tableau se remplira à la première candidature arrivée par un lien portant des paramètres de campagne."
          />
        ) : (
          // 5 colonnes ne tiennent pas sur un écran étroit : le tableau défile
          // dans SON conteneur, jamais la page.
          <div className="overflow-x-auto">
            <table className="admin-table w-full min-w-[46rem]">
              <thead>
                <tr>
                  <th scope="col">Canal</th>
                  <th scope="col">Campagne</th>
                  <th scope="col">Visuel</th>
                  <th scope="col" className="text-right">
                    Arrivées
                  </th>
                  <th scope="col">Dernière</th>
                </tr>
              </thead>
              <tbody>
                {campagnes.map((c) => (
                  <tr key={`${c.source}|${c.medium}|${c.campagne}|${c.visuel}`}>
                    <td className="font-medium">{c.source}</td>
                    <td>{c.campagne ?? <span className="admin-help">— non renseignée</span>}</td>
                    <td>{c.visuel ?? <span className="admin-help">— non renseigné</span>}</td>
                    <td className="text-right tabular-nums">{c.arrivees}</td>
                    <td className="whitespace-nowrap">{formatDateFr(c.derniereArrivee)}</td>
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
