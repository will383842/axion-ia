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
 */

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LEGAL_IDENTITY_DEFAULTS } from "@/lib/legal-identity";
import { getPortailToken } from "@/server/qualiopi/portail/cookie";
import { verifierToken } from "@/server/qualiopi/portail/portail-service";
import { deposerReclamationPubliqueAction } from "@/server/actions/qualiopi/reclamation-publique";
import { lireInterrupteurReclamations } from "@/server/qualiopi/reclamations/interrupteur";
import { formulaireOuvert } from "@/server/qualiopi/reclamations/depot-public";
import { Link } from "@/i18n/navigation";
import { FormulaireReclamation } from "./FormulaireReclamation";

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
      formations={(etat === "essai" ? formations.filter((f) => f.deTest) : formations).map(
        ({ enrollmentId, libelle }) => ({ enrollmentId, libelle }),
      )}
      adresseContact={LEGAL_IDENTITY_DEFAULTS.contactEmail}
    />
  );
}

/**
 * Le lien « Déposer une réclamation », rendu SEULEMENT quand le dépôt est
 * ouvert à tous (`actif`) — ou, depuis l'espace stagiaire, quand la personne
 * connectée est du banc d'essai (`essai`). Sinon `null` : les pages qui le
 * portent sont inchangées.
 */
export async function LienDepotReclamation({
  className,
  children,
  depuisEspaceDeTest = false,
}: {
  className?: string;
  children: React.ReactNode;
  /** L'espace stagiaire sait si la personne connectée est du banc d'essai. */
  depuisEspaceDeTest?: boolean;
}) {
  const etat = await lireInterrupteurReclamations();
  if (!formulaireOuvert(etat, { inscriptionDeTest: depuisEspaceDeTest })) return null;
  return (
    <Link href="/reclamations/deposer" {...(className !== undefined ? { className } : {})}>
      {children}
    </Link>
  );
}

/** Le bandeau de la page de procédure /reclamations — `null` tant que le dépôt n'est pas ouvert. */
export async function BandeauDepotReclamation() {
  const etat = await lireInterrupteurReclamations();
  if (etat !== "actif") return null;
  return (
    <div className="border-border bg-paper mx-auto mt-6 max-w-3xl rounded-lg border p-5">
      <p className="text-fg text-base leading-relaxed">
        Stagiaire, entreprise, formateur ou financeur : vous pouvez déposer votre réclamation en
        ligne. Accusé de réception immédiat, réponse écrite sous 15 jours ouvrés.
      </p>
      <Link
        href="/reclamations/deposer"
        className="text-terracotta mt-3 inline-block font-medium underline underline-offset-4"
      >
        Déposer une réclamation
      </Link>
    </div>
  );
}
