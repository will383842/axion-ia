/**
 * Admin — Formateurs freelance › Contrats à mettre à niveau (lots L9b, L7d).
 *
 *   - « Indépendants actifs à mettre à niveau » (L9b) : les indépendants actifs sans
 *     contrat-cadre v3 en vigueur, les onze éléments à reprendre, la liste figée, la
 *     date d'envoi du dossier et la fin du délai de grâce de 30 jours ;
 *   - « À faire re-signer » (L7d) : un contrat v3+ en vigueur, antérieur à la dernière
 *     version arrêtée.
 *
 * 🔴 LIVRÉ ÉTEINT : chaque partie a son interrupteur (`formateurs.mise_a_niveau`,
 * `formateurs.nouvelle_version_contrat`). Les deux coupés ou absents : la page l'annonce
 * et ne lit rien. Aucun formateur n'est désactivé d'ici.
 */

import type { Metadata } from "next";

import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { MiseANiveauListe } from "@/components/admin/qualiopi/MiseANiveauListe";
import { gardePage } from "@/server/auth/garde-page";
import { peutEngager } from "@/server/auth/habilitations";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import { lireEcranMiseANiveau } from "@/server/qualiopi/formateurs-independants/mise-a-niveau-lecture";
import { ELEMENTS_MISE_A_NIVEAU } from "@/server/qualiopi/formateurs-independants/mise-a-niveau-regles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Formateurs — Contrats à mettre à niveau | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

const JOUR = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });
const jour = (d: Date | null) => (d === null ? null : JOUR.format(d));

export default async function MiseANiveauPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  const [miseANiveau, nouvelleVersion] = await Promise.all([
    interrupteurAllume("mise_a_niveau"),
    interrupteurAllume("nouvelle_version_contrat"),
  ]);
  if (!miseANiveau && !nouvelleVersion) {
    return (
      <AdminPageShell>
        <AdminPageHeader title="Contrats à mettre à niveau" />
        <AdminCard>
          <p>Cet écran n&apos;est pas encore ouvert.</p>
        </AdminCard>
      </AdminPageShell>
    );
  }

  const ecran = await lireEcranMiseANiveau(new Date());
  const base = `/${locale}/${adminPrefix}/qualiopi/formateurs`;
  return (
    <AdminPageShell>
      <AdminPageHeader title="Contrats à mettre à niveau" description="Formateurs freelance" />
      {ecran.tronque ? (
        <p role="status" className="admin-alert admin-alert-warning">
          Plus de 500 formateurs actifs : seuls les 500 premiers sont lus.
        </p>
      ) : null}
      <MiseANiveauListe
        base={base}
        versionArretee={ecran.versionArretee}
        elements={ELEMENTS_MISE_A_NIVEAU.map((e) => ({ cle: e.cle, libelle: e.libelle }))}
        miseANiveau={
          miseANiveau
            ? {
                peutAgir: peutEngager(acces.role, "habiliter_formateur"),
                lignes: ecran.aMettreANiveau.map((l) => ({
                  trainerId: l.trainerId,
                  nom: l.nom,
                  manquants: ELEMENTS_MISE_A_NIVEAU.filter((e) => !l.elements[e.cle]).map(
                    (e) => e.cle,
                  ),
                  listeeLe: jour(l.listeeLe),
                  premierEnvoi: jour(l.premierEnvoi),
                  finGrace: jour(l.finGrace),
                  dossierStatut: l.dossierStatut,
                })),
              }
            : null
        }
        nouvelleVersion={
          nouvelleVersion
            ? {
                peutAgir: peutEngager(acces.role, "contresigner"),
                lignes: ecran.aResigner.map((l) => ({
                  trainerId: l.trainerId,
                  nom: l.nom,
                  versionEnVigueur: l.versionEnVigueur,
                })),
              }
            : null
        }
      />
    </AdminPageShell>
  );
}
