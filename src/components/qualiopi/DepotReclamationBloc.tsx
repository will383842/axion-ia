/**
 * Bloc serveur du dépôt public de réclamation (chantier QNC, L09).
 *
 * Lit l'interrupteur `qualiopi.reclamations.actif` et, quand une personne est
 * connectée à son espace stagiaire, ses formations — pour qu'elle désigne la
 * sienne sans qu'aucun identifiant ne transite par l'URL.
 *
 *   - éteint : `notFound()` — la page n'existe pas, le site est inchangé ;
 *   - essai  : ouvert seulement à un stagiaire connecté inscrit au banc d'essai ;
 *   - actif  : ouvert à tous.
 *
 * Le contrôle définitif est refait par l'action serveur : ce bloc n'ouvre
 * qu'une porte d'affichage.
 *
 * ⚠️ Ce module importe le formulaire CLIENT : toute page qui l'importe embarque
 * ce formulaire et Turnstile dans son JavaScript, même sans le rendre. Le lien
 * et le bandeau, posés sur d'autres pages, vivent donc dans
 * `LienDepotReclamation.tsx`, qui n'importe aucun composant client.
 */

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LEGAL_IDENTITY_DEFAULTS } from "@/lib/legal-identity";
import { getPortailToken } from "@/server/qualiopi/portail/cookie";
import { verifierToken } from "@/server/qualiopi/portail/portail-service";
import { deposerReclamationPubliqueAction } from "@/server/actions/qualiopi/reclamation-publique";
import { lireInterrupteurReclamations } from "@/server/qualiopi/reclamations/interrupteur";
import { formulaireOuvert } from "@/server/qualiopi/reclamations/depot-public";
import { buttonVariants } from "@/components/ui/button";
import { FormulaireReclamation } from "./FormulaireReclamation";
import { ChampsReclamation } from "./ChampsReclamation";

const DATE_PARIS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "numeric",
  month: "long",
  year: "numeric",
});

async function formationsDuStagiaireConnecte(): Promise<
  Array<{ enrollmentId: string; libelle: string; deTest: boolean }>
> {
  const cookie = await getPortailToken();
  if (!cookie) return [];
  const acces = await verifierToken(cookie).catch(() => null);
  if (!acces) return [];
  const inscriptions = await prisma.enrollment
    .findMany({
      where: { traineeId: acces.traineeId },
      select: {
        id: true,
        estTestInterne: true,
        session: { select: { titreSession: true, dateDebut: true, estTestInterne: true } },
      },
      orderBy: { session: { dateDebut: "desc" } },
      take: 20,
    })
    .catch(() => []);
  return inscriptions.map((i) => ({
    enrollmentId: i.id,
    libelle: `${i.session.titreSession} — ${DATE_PARIS.format(i.session.dateDebut)}`,
    deTest: i.estTestInterne || i.session.estTestInterne,
  }));
}

export async function DepotReclamationBloc() {
  const etat = await lireInterrupteurReclamations();
  if (etat === "eteint") notFound();
  const formations = await formationsDuStagiaireConnecte();
  if (!formulaireOuvert(etat, { inscriptionDeTest: formations.some((f) => f.deTest) })) {
    notFound();
  }
  return (
    <FormulaireReclamation
      action={deposerReclamationPubliqueAction}
      adresseContact={LEGAL_IDENTITY_DEFAULTS.contactEmail}
      classeBouton={buttonVariants()}
    >
      <ChampsReclamation
        formations={(etat === "essai" ? formations.filter((f) => f.deTest) : formations).map(
          ({ enrollmentId, libelle }) => ({ enrollmentId, libelle }),
        )}
      />
    </FormulaireReclamation>
  );
}
