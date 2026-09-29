/**
 * Admin — « À classer » : les rendez-vous du dossier client qui ne sont
 * encore rangés chez aucun client (chantier visio, PR 4 ; plan V-06, V-07b).
 *
 * Décision A4 : la machine PROPOSE une fiche, Will valide d'un clic
 * (« Confirmer le client proposé »), ou ouvre « Après l'appel » pour choisir
 * une autre fiche ou créer la fiche prospect.
 *
 * Deux listes : les rendez-vous récents (ils font le badge), et
 * « Historique » — les rendez-vous d'avant la mise en service, repris par le
 * script de reprise : ni badge ni alerte, Will les range quand un prospect
 * revient, pas avant.
 *
 * Régime REFUS (décision A2) : `gardeLectureEchanges` est la PREMIÈRE instruction.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminFilterTabs } from "@/components/admin/ui/AdminFilterTabs";
import { AdminEmptyState } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardeLectureEchanges } from "@/features/dossier-client/acces";
import { rangerRencontreAction } from "@/features/dossier-client/actions-rencontres";
import { lireRencontresAClasser } from "@/features/dossier-client/queries-rencontres";
import { formatDateFrShort } from "@/lib/format-date-fr";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Rendez-vous à classer | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const mutedCls = "text-[color:var(--color-admin-fg-muted)]";
const lienCls = "text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";

export default async function AClasserPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  // 🔴 Première instruction : la garde, AVANT toute lecture.
  const acces = await gardeLectureEchanges(`/${locale}/${adminPrefix}/login`);
  const rdvBase = `/${locale}/${adminPrefix}/rendez-vous`;
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={rdvBase} />;
  }
  const sp = await searchParams;
  const historique = sp.filtre === "historique";
  const erreur = typeof sp.erreur === "string" && sp.erreur !== "" ? sp.erreur.slice(0, 300) : null;
  const liste = await lireRencontresAClasser(historique);

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <Link href={rdvBase} className={`text-[length:var(--text-admin-xs)] ${lienCls}`}>
          ← Rendez-vous
        </Link>
      </div>
      <AdminPageHeader
        title="Rendez-vous à classer"
        description="Les rendez-vous rangés chez aucun client. Une fiche est proposée quand elle ressemble ; rien n'est rangé sans votre clic."
      />
      <AdminFilterTabs
        className="mb-[var(--space-admin-5)]"
        label="Liste"
        current={historique ? "historique" : "recents"}
        options={[
          { value: "recents", label: "Récents", href: `${rdvBase}/a-classer` },
          {
            value: "historique",
            label: "Historique (avant la mise en service)",
            href: `${rdvBase}/a-classer?filtre=historique`,
          },
        ]}
      />
      {erreur !== null ? (
        <p role="alert" className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)]">
          {erreur}
        </p>
      ) : null}
      {liste.length === 0 ? (
        <AdminEmptyState
          title="Rien à classer"
          description={
            historique
              ? "Aucun rendez-vous d'avant la mise en service n'attend."
              : "Tous les rendez-vous récents sont rangés chez un client."
          }
        />
      ) : (
        <ul className="flex flex-col gap-[var(--space-admin-3)]">
          {liste.map((r) => (
            <li key={r.id} className="admin-card flex flex-col gap-[var(--space-admin-2)]">
              <p className="font-semibold">
                {r.titulaire ?? "Invité à compléter"}
                <span className={`font-normal ${mutedCls}`}>
                  {" "}
                  · {r.titre}
                  {r.debutPrevu ? ` · ${formatDateFrShort(r.debutPrevu)}` : ""}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
                {r.clientPropose ? (
                  <form action={rangerRencontreAction}>
                    <input type="hidden" name="rencontreId" value={r.id} />
                    <input type="hidden" name="clientId" value={r.clientPropose.id} />
                    <input type="hidden" name="retour" value="a-classer" />
                    <button type="submit" className="admin-button">
                      Confirmer : {r.clientPropose.raisonSociale}
                    </button>
                  </form>
                ) : (
                  <span className={`text-[length:var(--text-admin-sm)] ${mutedCls}`}>
                    Aucune fiche proposée
                  </span>
                )}
                <Link href={`${rdvBase}/${r.id}/apres-l-appel`} className={lienCls}>
                  Choisir ou créer la fiche →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminPageShell>
  );
}
