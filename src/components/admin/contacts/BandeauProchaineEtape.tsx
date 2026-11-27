// Fiche d'un candidat apporteur — LE BANDEAU « PROCHAINE ÉTAPE » (en tête).
//
// Une phrase, UN bouton principal : où en est la personne, et le seul geste
// utile maintenant. Avant ce bandeau, après « Retenu » enregistré sans e-mail,
// la fiche disait juste « Retenu » : aucun dossier, aucun contrat, et rien ne
// le signalait.
//
// Aucune règle nouvelle : `etapeDuSuivi` (la même que la liste), le suivi de
// l'invitation et le dossier du réseau, lus par leurs lectures existantes.
// Composant SERVEUR ; seul le bouton d'envoi du contrat est client (il montre
// l'aperçu avant d'envoyer). Information accessoire : si une lecture échoue, la
// fiche s'affiche sans le bandeau.

import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

import { lireSuiviInvitationListe } from "@/features/commercial-application/invitation-apporteur";
import { lireDossiersApporteurListe } from "@/features/commercial-application/etape-apporteur-liste";
import { listRendezVousDeFiche } from "@/features/admin-rendezvous/queries";
import { peutVoirLesAppels } from "@/features/admin-calendly/acces";
import { peutEngager } from "@/server/auth/habilitations";
import {
  etapeDuSuivi,
  motifSansLien,
  tonEtapeSuivi,
} from "@/lib/commercial-application/etape-suivi-apporteur";
import {
  ANCRE_REPONSES,
  prochaineEtape,
} from "@/lib/commercial-application/prochaine-etape-apporteur";
import { formatDateFrShort } from "@/lib/format-date-fr";

import { BoutonOuvrirDossierContrat } from "./BoutonOuvrirDossierContrat";

export async function BandeauProchaineEtape({
  submissionId,
  adminPrefix,
  role,
  details,
}: {
  submissionId: string;
  adminPrefix: string;
  role: string | null | undefined;
  details: Record<string, unknown> | null;
}) {
  let suivi = null;
  let dossier = null;
  try {
    const [suivis, dossiers] = await Promise.all([
      lireSuiviInvitationListe([submissionId]),
      lireDossiersApporteurListe([submissionId]),
    ]);
    suivi = suivis.get(submissionId) ?? null;
    dossier = dossiers.get(submissionId) ?? null;
  } catch (err) {
    Sentry.captureException(err, { tags: { ecran: "fiche-apporteur", etape: "bandeau" } });
    return null;
  }

  // Même horloge que la liste : lue une fois par rendu.
  const maintenant = new Date();
  const etape = etapeDuSuivi(
    {
      suivi,
      dossier,
      sansSuite: typeof details?.["sansSuiteAt"] === "string",
      motifSansLien: motifSansLien({ details, opposee: false }),
    },
    maintenant,
  );

  const admin = peutEngager(role, "contresigner") && peutVoirLesAppels(role);
  // L'action d'ouverture part d'un échange rattaché : on ne le cherche que si le geste est possible.
  let echangeId: string | null = null;
  if (etape.type === "retenu-sans-contrat" && admin) {
    try {
      const rdvs = await listRendezVousDeFiche(submissionId);
      echangeId =
        rdvs.find((r) => r.source === "calendly" && r.status !== "canceled")?.sourceRecordId ??
        null;
    } catch (err) {
      Sentry.captureException(err, { tags: { ecran: "fiche-apporteur", etape: "bandeau-rdv" } });
    }
  }

  const suite = prochaineEtape(etape, {
    suivi,
    dossier,
    peutEngager: admin,
    aUnEchange: echangeId !== null,
    maintenant,
  });
  // Orange : l'étape demande un geste (retenu sans contrat, échange à noter…).
  const alerteEtape = tonEtapeSuivi(etape) === "warning";

  return (
    <div
      className="admin-card admin-card-wide"
      id="prochaine-etape"
      style={
        alerteEtape ? { borderLeft: "4px solid var(--color-admin-warning, #b45309)" } : undefined
      }
    >
      <h2 className="admin-h2">Prochaine étape</h2>
      <p>{suite.phrase}</p>
      {suite.alerte ? (
        <p className="text-[color:var(--color-admin-warning,#b45309)]" role="status">
          ⚠️ {suite.alerte}
        </p>
      ) : null}
      {suite.reponseLe ? (
        <p>
          A répondu le {formatDateFrShort(suite.reponseLe)} :{" "}
          <a href={ANCRE_REPONSES} className="admin-link">
            lire
          </a>
        </p>
      ) : null}
      {suite.bouton?.type === "ancre" ? (
        <a href={suite.bouton.href} className="admin-button">
          {suite.bouton.libelle}
        </a>
      ) : null}
      {suite.bouton?.type === "dossier" && dossier ? (
        <Link href={`/fr/${adminPrefix}/apporteurs/${dossier.id}`} className="admin-button">
          {suite.bouton.libelle}
        </Link>
      ) : null}
      {suite.bouton?.type === "ouvrir-contrat" && echangeId ? (
        <BoutonOuvrirDossierContrat calendlyEventId={echangeId} />
      ) : null}
    </div>
  );
}
