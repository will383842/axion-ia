/**
 * Réseau d'apporteurs (démarrage manuel) — la DÉCLARATION D'ENTREPRISE par formulaire.
 *
 * L'apporteur au contrat SIGNÉ déclare une entreprise sur son lien personnel
 * (`/apporteur/dossier/<id>/<jeton>`, contrat v2 art. 3.2). Cette déclaration :
 *   · crée une `PresentationEntreprise` dans l'état « à traiter » EXISTANT
 *     (`reservee`, sans prise de contact : `estATraiter`), `recueAt` = l'instant de
 *     réception, via `creerPresentation` (même validation que la saisie de la console) ;
 *   · n'envoie RIEN à l'entreprise : Williams répond ensuite d'un clic « Bien reçu »
 *     (`appliquerReponse`), seul chemin qui contacte l'entreprise ;
 *   · prévient Williams par un e-mail INTERNE sans aucune donnée sur la personne.
 *
 * Doublons : une entreprise que l'apporteur a DÉJÀ déclarée et qui occupe encore son
 * SIREN (`presentationOccupe`) n'est pas redéclarée. Une entreprise déjà attribuée à un
 * AUTRE apporteur est reçue comme les autres : Williams voit l'indication
 * (`lireSignalements`) et tranche ; l'apporteur n'apprend jamais rien sur un autre.
 *
 * Aucune donnée personnelle dans les logs ni dans Sentry.
 */

import "server-only";

import * as Sentry from "@sentry/nextjs";

import { adminPath } from "@/lib/admin-path";
import { ADRESSE_INTERNE_PAR_DEFAUT } from "@/lib/destinataires-internes";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-url";
import { enqueueEmail } from "@/server/queue/queues";

import { etatPourApporteur, validerDeclaration, type EtatDeclaration } from "./declaration-regles";
import { creerPresentation, nomComplet, presentationOccupe } from "./presentations";

export type ResultatDeclaration = { ok: true } | { ok: false; message: string };

export const MESSAGE_NEUTRE = "Cette déclaration n'a pas pu être enregistrée.";
export const MESSAGE_DEJA = "Vous avez déjà déclaré cette entreprise.";

/** Une déclaration de l'apporteur, telle qu'il la voit. */
export interface DeclarationVue {
  id: string;
  denomination: string;
  recueAt: Date;
  etat: EtatDeclaration;
}

/** Les déclarations d'UN apporteur (jamais celles des autres), de la plus récente. */
export async function lireDeclarationsDe(apporteurId: string): Promise<DeclarationVue[]> {
  const l = await prisma.presentationEntreprise.findMany({
    where: { apporteurId },
    orderBy: { recueAt: "desc" },
    take: 100,
    select: {
      id: true,
      denomination: true,
      recueAt: true,
      statut: true,
      contactEnvoyeAt: true,
    },
  });
  const out: DeclarationVue[] = [];
  for (const p of l) {
    const etat = etatPourApporteur(p);
    if (etat) out.push({ id: p.id, denomination: p.denomination, recueAt: p.recueAt, etat });
  }
  return out;
}

export async function declarerEntreprise(
  apporteurId: string,
  brut: Record<string, unknown>,
  maintenant: Date = new Date(),
): Promise<ResultatDeclaration> {
  const v = validerDeclaration(brut, maintenant);
  if (!v.ok) return { ok: false, message: v.message };
  const d = v.valeur;

  const apporteur = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { statut: true, prenom: true, nom: true },
  });
  if (!apporteur || apporteur.statut !== "signe") return { ok: false, message: MESSAGE_NEUTRE };

  // Aucun plafond par apporteur (contrat art. 3.7 : « aucun seuil ») ; la limite par adresse IP
  // hachée, anti-robot, vit côté route.

  // Doublon de l'apporteur lui-même : la déclaration occupe déjà ce SIREN.
  const siennes = await prisma.presentationEntreprise.findMany({
    where: { apporteurId, siren: d.siren, statut: { in: ["reservee", "confirmee"] } },
    select: { statut: true, protegeeJusquAt: true },
  });
  if (siennes.some((p) => presentationOccupe(p, maintenant))) {
    return { ok: false, message: MESSAGE_DEJA };
  }

  const r = await creerPresentation(
    {
      apporteurId,
      siren: d.siren,
      denomination: d.denomination,
      personneNom: d.personneNom,
      personneFonction: d.personneFonction,
      personneEmail: d.personneEmail,
      personneTelephone: d.personneTelephone,
      besoin: null,
      dateEchange: d.dateContact,
      recueAt: maintenant,
    },
    maintenant,
  );
  if (!r.ok) return { ok: false, message: MESSAGE_NEUTRE };

  await prevenirWilliams(r.id, d.denomination, nomComplet(apporteur.prenom, apporteur.nom));
  return { ok: true };
}

/**
 * Alerte interne. Une panne de file ne fait pas échouer une déclaration déjà écrite :
 * elle part chez Sentry, sans valeur saisie. Enfilée SANS `clientId`.
 */
async function prevenirWilliams(
  presentationId: string,
  entreprise: string,
  apporteur: string,
): Promise<void> {
  try {
    const consoleUrl = `${SITE_URL.replace(/\/+$/, "")}${adminPath("fr", "apporteurs/entreprises?onglet=a-traiter")}`;
    await enqueueEmail(
      "apporteur-declaration-recue",
      ADRESSE_INTERNE_PAR_DEFAUT,
      "fr",
      { entreprise, apporteur, consoleUrl },
      {
        jobId: `apporteur-declaration-recue-${presentationId}`,
        entityType: "PresentationEntreprise",
        entityId: presentationId,
        clientId: null,
      },
    );
  } catch (e) {
    const nom = e instanceof Error ? e.name : "inconnue";
    Sentry.captureException(new Error(`apporteur-declaration : alerte non enfilée (${nom})`), {
      tags: { service: "apporteur-declaration", etape: "alerte" },
      extra: { presentationId },
    });
  }
}
