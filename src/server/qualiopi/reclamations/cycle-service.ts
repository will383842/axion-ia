/**
 * 🔴 CHANTIER QNC, LOT L09 — LE CYCLE D'UNE RÉCLAMATION (indicateur 31).
 *
 * Exigence orale de l'auditeur (O6) : « un système professionnel, pas une
 * boîte mail ». Ce service porte le cycle complet, sur le modèle
 * `Reclamation` existant et le journal `reclamation_etapes` du socle (ajout
 * seul, déclencheur en base) :
 *
 *   réception → accusé (automatique, immédiat) → analyse → réponse écrite
 *   signée (corbeille de validation, puis envoi) → réexamen possible → clôture
 *
 * Chaque étape est datée par le SERVEUR et signée de son auteur réel. Le
 * statut de la réclamation n'est plus qu'un résumé de la dernière étape.
 *
 * Interrupteur `qualiopi.reclamations.actif` (`interrupteur.ts`) : éteint, rien
 * de ce module n'est appelé et le registre se comporte comme avant.
 *
 * Numérotation AXI-REC : celle du service existant (`creerReclamation`), qui
 * reste le seul allocateur de la série.
 */

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { EMAIL_LEGAL } from "@/lib/email/legal-footer";
import type { ReclamationSource } from "../../../../prisma/generated/client";
import { creerReclamation } from "@/server/qualiopi/registres/reclamations-service";
import type { AuteurRegistre } from "@/server/qualiopi/registres/incidents-service";
import { AUTEUR_ENVOI_AUTOMATIQUE } from "@/server/qualiopi/registres/auteur";
import { CONTENU_MIN, verifierEtape } from "./cycle";
import { dateLisibleParis, echeancesReclamation, type EtapeCode } from "./echeances";

// ─────────────────────────────────────────────────────────────────────────────
// Vocabulaire
// ─────────────────────────────────────────────────────────────────────────────

/** QUI dépose : les quatre parties prenantes de l'indicateur 31, plus « autre ». */
export const QUALITES_RECLAMANT = [
  "stagiaire",
  "entreprise",
  "formateur",
  "financeur",
  "autre",
] as const;
export type QualiteReclamant = (typeof QUALITES_RECLAMANT)[number];

export const LIBELLE_QUALITE: Readonly<Record<QualiteReclamant, string>> = {
  stagiaire: "stagiaire",
  entreprise: "entreprise",
  formateur: "formateur",
  financeur: "financeur",
  autre: "autre",
};

/**
 * ⚠️ « Besoin de schéma » — `reclamations.source` ne connaît que quatre
 * valeurs (stagiaire / client / financeur / autre). Le formateur n'y a pas de
 * case : il est rangé en `autre`, et sa qualité EXACTE est écrite dans l'étape
 * de réception, qui fait foi. Une colonne `declarant` (énumération
 * `partie_prenante_qualiopi`, déjà posée par le socle) lèverait l'ambiguïté :
 * demande portée dans la PR, aucune migration ici.
 */
export function sourceDepuisQualite(q: QualiteReclamant): ReclamationSource {
  switch (q) {
    case "stagiaire":
      return "stagiaire";
    case "entreprise":
      return "client";
    case "financeur":
      return "financeur";
    case "formateur":
    case "autre":
      return "autre";
  }
}

/** PAR OÙ la réclamation est arrivée. */
export const CANAUX_DEPOT = [
  "formulaire_public",
  "espace_stagiaire",
  "console",
  "telephone",
  "courrier",
  "email",
] as const;
export type CanalDepot = (typeof CANAUX_DEPOT)[number];

const LIBELLE_CANAL: Readonly<Record<CanalDepot, string>> = {
  formulaire_public: "le formulaire de réclamation du site",
  espace_stagiaire: "le formulaire de réclamation, depuis l'espace stagiaire",
  console: "une saisie dans la console",
  telephone: "un appel téléphonique, saisi dans la console",
  courrier: "un courrier, saisi dans la console",
  email: "un e-mail, saisi dans la console",
};

function interditAuBuild(): void {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("reclamations/cycle-service : mutations interdites en mode stub.invalid");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dépôt
// ─────────────────────────────────────────────────────────────────────────────

export interface DepotReclamation {
  readonly qualite: QualiteReclamant;
  readonly reclamantNom: string;
  readonly reclamantEmail?: string;
  readonly objet: string;
  readonly description: string;
  readonly gravite?: string;
  /** Date de réception : celle du SERVEUR pour un dépôt en ligne. */
  readonly dateReception: Date;
  readonly enrollmentId?: string;
  readonly canal: CanalDepot;
  readonly auteur: AuteurRegistre;
}

/** Ce qu'il est advenu de l'accusé automatique. */
export type IssueAccuse = "envoye" | "en_validation" | "sans_adresse" | "echec";

export interface ReclamationDeposee {
  readonly id: string;
  readonly numero: string;
  readonly accuse: IssueAccuse;
}

/** Texte de l'étape de réception. Aucune donnée de la personne : elle est sur `reclamations`. */
export function contenuReception(
  depot: Pick<DepotReclamation, "qualite" | "canal" | "dateReception">,
): string {
  return (
    `Réclamation reçue le ${dateLisibleParis(depot.dateReception)} par ${LIBELLE_CANAL[depot.canal]}, ` +
    `déposée en qualité de ${LIBELLE_QUALITE[depot.qualite]}.`
  );
}

/**
 * Enregistre une réclamation et son étape de réception (une seule écriture),
 * puis envoie l'accusé AUTOMATIQUE quand une adresse est connue. L'accusé est
 * consigné en étape « accusé » s'il part ; garé ou en échec, il ne l'est pas,
 * et l'échéance de 5 jours ouvrés reste ouverte (alerte).
 */
export async function deposerReclamation(depot: DepotReclamation): Promise<ReclamationDeposee> {
  interditAuBuild();
  const reclamation = await creerReclamation({
    source: sourceDepuisQualite(depot.qualite),
    reclamantNom: depot.reclamantNom,
    ...(depot.reclamantEmail !== undefined ? { reclamantEmail: depot.reclamantEmail } : {}),
    objet: depot.objet,
    description: depot.description,
    ...(depot.gravite !== undefined ? { gravite: depot.gravite } : {}),
    dateReception: depot.dateReception,
    ...(depot.enrollmentId !== undefined ? { enrollmentId: depot.enrollmentId } : {}),
    ...(depot.auteur.id !== null ? { traiteeParId: depot.auteur.id } : {}),
    etapesInitiales: [
      {
        etape: "reception",
        contenu: contenuReception(depot),
        auteurId: depot.auteur.id,
        auteurNom: depot.auteur.nom,
      },
    ],
  });

  const accuse = await envoyerAccuse(reclamation);
  return { id: reclamation.id, numero: reclamation.numero, accuse };
}

async function envoyerAccuse(r: {
  id: string;
  numero: string;
  reclamantEmail: string | null;
  dateReception: Date;
}): Promise<IssueAccuse> {
  if (r.reclamantEmail === null || r.reclamantEmail.trim() === "") return "sans_adresse";
  const { reponseAvant } = echeancesReclamation(r.dateReception);
  let envoi: Awaited<ReturnType<typeof enqueueEmail>>;
  try {
    envoi = await enqueueEmail(
      "reclamation-accuse",
      r.reclamantEmail,
      "fr",
      {
        numero: r.numero,
        recueLe: dateLisibleParis(r.dateReception),
        reponseAvant: dateLisibleParis(reponseAvant),
      },
      {
        entityType: "Reclamation",
        entityId: r.id,
        jobId: `reclamation-accuse-${r.id}`,
        sujet: `Réclamation ${r.numero} reçue`,
      },
    );
  } catch (err) {
    console.error(
      `[reclamations] accusé de ${r.numero} non mis en file :`,
      err instanceof Error ? err.message : String(err),
    );
    return "echec";
  }
  if (envoi.garePourValidation === true) return "en_validation";
  if (!envoi.enqueued) return "echec";
  try {
    await prisma.reclamationEtape.create({
      data: {
        reclamationId: r.id,
        etape: "accuse",
        contenu:
          "Accusé de réception envoyé automatiquement à l'adresse indiquée, à l'instant du dépôt.",
        auteurId: AUTEUR_ENVOI_AUTOMATIQUE.id,
        auteurNom: AUTEUR_ENVOI_AUTOMATIQUE.nom,
      },
    });
  } catch (err) {
    // L'e-mail est parti : seule sa trace manque. L'échéance reste ouverte et
    // l'alerte le dira — mieux qu'un dépôt refusé à la personne.
    console.error(
      `[reclamations] accusé de ${r.numero} envoyé mais non consigné :`,
      err instanceof Error ? err.message : String(err),
    );
  }
  return "envoye";
}

// ─────────────────────────────────────────────────────────────────────────────
// Étapes
// ─────────────────────────────────────────────────────────────────────────────

export interface EntreeEtape {
  readonly reclamationId: string;
  readonly etape: Exclude<EtapeCode, "reception">;
  readonly contenu: string;
  readonly auteur: AuteurRegistre;
  /** Pour une réponse : la qualité de la personne qui signe pour l'organisme. */
  readonly signataireQualite?: string;
}

export type ResultatEtape =
  | {
      ok: true;
      /** Pour une réponse : l'e-mail attend sa validation, ou il n'y a pas d'adresse. */
      email: "a_valider" | "sans_adresse" | "echec" | null;
    }
  | { ok: false; erreur: string };

/**
 * Ajoute une étape au journal, dans une transaction qui relit les étapes sous
 * verrou : deux décisions croisées ne peuvent pas s'enchaîner à tort.
 */
export async function ajouterEtapeReclamation(entree: EntreeEtape): Promise<ResultatEtape> {
  interditAuBuild();
  const contenu = entree.contenu.trim();
  if (contenu.length < CONTENU_MIN) {
    return { ok: false, erreur: `Écrivez au moins ${CONTENU_MIN} caractères.` };
  }
  const qualite = entree.signataireQualite?.trim() ?? "";
  if (entree.etape === "reponse" && qualite.length < 3) {
    return { ok: false, erreur: "Une réponse est signée : indiquez la qualité du signataire." };
  }

  const resultat = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reclamation:${entree.reclamationId}`}))`;
    const reclamation = await tx.reclamation.findUnique({
      where: { id: entree.reclamationId },
      select: {
        id: true,
        numero: true,
        reclamantEmail: true,
        reponse: true,
        dateReponse: true,
        etapes: { select: { etape: true }, orderBy: { creeLe: "asc" } },
      },
    });
    if (reclamation === null) return { ok: false as const, erreur: "Réclamation introuvable" };

    const verdict = verifierEtape(
      reclamation.etapes.map((e) => e.etape),
      entree.etape,
    );
    if (!verdict.ok) return { ok: false as const, erreur: verdict.erreur };

    const texte =
      entree.etape === "reponse"
        ? `${contenu}\n\nPour ${EMAIL_LEGAL.legalName}, ${entree.auteur.nom}, ${qualite}.`
        : contenu;
    await tx.reclamationEtape.create({
      data: {
        reclamationId: reclamation.id,
        etape: entree.etape,
        contenu: texte,
        auteurId: entree.auteur.id,
        auteurNom: entree.auteur.nom,
      },
    });

    const maintenant = new Date();
    const data = {
      ...(verdict.statut !== null ? { statut: verdict.statut } : {}),
      // La première réponse reste dans les colonnes historiques (registre PDF,
      // alerte J+15) ; les suivantes vivent dans le journal. Rien n'est réécrit.
      ...(entree.etape === "reponse" && reclamation.reponse === null ? { reponse: contenu } : {}),
      ...(entree.etape === "reponse" && reclamation.dateReponse === null
        ? { dateReponse: maintenant }
        : {}),
      ...(entree.auteur.id !== null ? { traiteeParId: entree.auteur.id } : {}),
    };
    await tx.reclamation.update({ where: { id: reclamation.id }, data });
    return {
      ok: true as const,
      numero: reclamation.numero,
      reclamantEmail: reclamation.reclamantEmail,
    };
  });

  if (!resultat.ok) return resultat;
  if (entree.etape !== "reponse") return { ok: true, email: null };
  if (resultat.reclamantEmail === null || resultat.reclamantEmail.trim() === "") {
    return { ok: true, email: "sans_adresse" };
  }

  // 🔴 La réponse ne part JAMAIS seule : corbeille « E-mails à valider ».
  let preparation: Awaited<ReturnType<typeof enqueueEmail>>;
  try {
    preparation = await enqueueEmail(
      "reclamation-reponse",
      resultat.reclamantEmail,
      "fr",
      {
        numero: resultat.numero,
        reponse: contenu,
        signataireNom: entree.auteur.nom,
        signataireQualite: qualite,
        organisme: EMAIL_LEGAL.legalName,
      },
      {
        entityType: "Reclamation",
        entityId: entree.reclamationId,
        sujet: `Réclamation ${resultat.numero} : notre réponse`,
        exigerValidation: true,
      },
    );
  } catch (err) {
    console.error(
      `[reclamations] réponse à ${resultat.numero} non préparée :`,
      err instanceof Error ? err.message : String(err),
    );
    return { ok: true, email: "echec" };
  }
  // `exigerValidation` gare toujours : un retour sans garage est une anomalie
  // (corbeille indisponible), à dire plutôt qu'à taire.
  return { ok: true, email: preparation.garePourValidation === true ? "a_valider" : "echec" };
}
