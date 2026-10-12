/**
 * Formateurs indépendants — CHANGEMENT DE COMPTE BANCAIRE ET DE COORDONNÉES (lot E, M12 ;
 * décision 72, ADR 0066 (e), écran W-7, e-mails F43 et F44).
 *
 * 🔴 Protection contre la fraude au changement de compte :
 *  - le formateur DEMANDE depuis son espace ; rien n'est écrit sur la fiche avant
 *    l'accord d'un administrateur — l'ancien IBAN reste celui des virements ;
 *  - un DÉLAI d'attente (48 h, annoncé par F43) précède toute validation ;
 *  - F43 part à l'adresse connue de la fiche (« vous n'êtes pas à l'origine de cette
 *    demande ? répondez immédiatement »), et l'équipe reçoit une alerte interne à
 *    CHAQUE demande ;
 *  - l'IBAN demandé est chiffré `enc:v2:` (AAD `demande:<id>:iban`, CHECK en base),
 *    puis rechiffré pour la fiche (AAD `trainer:<id>:iban`) à la validation. Il n'est
 *    jamais réaffiché, ni journalisé, ni envoyé dans une alerte ou un e-mail.
 *
 * Natures traitées ici : `iban` et `adresse` (adresse professionnelle). Le régime de TVA
 * et l'adresse e-mail restent hors de ce lot (TVA : calcul d'argent ; e-mail : identité
 * de connexion).
 *
 * 🔴 ÉTEINT : interrupteur `formateurs.changement_coordonnees` coupé = rien n'est lu ni
 * écrit. Salariés et dirigeants : hors périmètre. Aucune suppression : une demande
 * refusée garde sa ligne.
 *
 * Sans `server-only` : aucun import Next.
 */

import { randomUUID } from "node:crypto";

import { ibanValide } from "@/lib/iban";
import { empreinteIban, ibanNormalise } from "@/lib/iban-empreinte";
import { decryptPii, encryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";

import { envoyer } from "./envois";
import { interrupteurAllume } from "./interrupteur-allume";

/** Délai minimal entre la demande et sa validation (annoncé par F43 : « au plus tôt dans 48 heures »). */
export const DELAI_VALIDATION_CHANGEMENT_MS = 48 * 60 * 60 * 1000;

export const NATURES_CHANGEMENT = ["iban", "adresse"] as const;
export type NatureChangement = (typeof NATURES_CHANGEMENT)[number];

export const LIBELLES_NATURE: Readonly<Record<NatureChangement, string>> = {
  iban: "votre compte bancaire",
  adresse: "votre adresse",
};

/** Le crochet à choix du texte F44, tel qu'il est écrit. */
const CROCHET_NATURE_F44 = "nature : votre adresse / votre régime de TVA / votre compte bancaire";

export const MESSAGES_CHANGEMENT = {
  indisponible: "Cette demande n'est pas ouverte pour le moment.",
  ibanInvalide: "Cet IBAN n'est pas valide. Vérifiez-le, espaces compris.",
  identique: "Ce compte est déjà celui que nous utilisons pour vos virements.",
  adresseInvalide: "Indiquez votre nouvelle adresse professionnelle (500 caractères au plus).",
  dejaEnCours: "Une demande du même type est déjà en cours de vérification.",
  erreur: "La demande n'a pas pu s'enregistrer. Réessayez dans quelques minutes.",
} as const;

export type ResultatDemande = { ok: true } | { ok: false; message: string };

const JOUR_FR = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

async function ficheIndependante(trainerId: string) {
  const t = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      statut: true,
      actif: true,
      finCollaborationAt: true,
      prenom: true,
      email: true,
      ibanEmpreinte: true,
    },
  });
  if (t === null || t.statut !== "sous_traitant" || !t.actif || t.finCollaborationAt !== null) {
    return null;
  }
  return t;
}

function estDoublon(e: unknown): boolean {
  return (e as { code?: unknown } | null)?.code === "P2002";
}

/** Alerte interne à CHAQUE demande : identifiants seuls, ni IBAN ni adresse. */
async function alerterDemande(trainerId: string, demandeId: string, nature: NatureChangement) {
  try {
    const { notify } = await import("@/server/notifications");
    await notify({
      category: "TRAINER_CHANGEMENT_DEMANDE",
      payload: { trainerId, demandeId, nature },
    });
  } catch {
    // Observabilité : jamais bloquante.
  }
}

/**
 * Demande de changement d'IBAN, depuis l'espace (la fiche est celle de la SESSION).
 * L'IBAN de la fiche n'est PAS touché : il le sera à la validation.
 */
export async function demanderChangementIban(
  trainerId: string,
  ibanSaisi: string,
  maintenant: Date,
): Promise<ResultatDemande> {
  if (!(await interrupteurAllume("changement_coordonnees"))) {
    return { ok: false, message: MESSAGES_CHANGEMENT.indisponible };
  }
  const iban = ibanNormalise(ibanSaisi);
  if (!ibanValide(iban)) return { ok: false, message: MESSAGES_CHANGEMENT.ibanInvalide };
  const empreinte = empreinteIban(iban);
  if (empreinte === null) return { ok: false, message: MESSAGES_CHANGEMENT.erreur };

  let t: Awaited<ReturnType<typeof ficheIndependante>>;
  try {
    t = await ficheIndependante(trainerId);
  } catch {
    return { ok: false, message: MESSAGES_CHANGEMENT.erreur };
  }
  if (t === null) return { ok: false, message: MESSAGES_CHANGEMENT.indisponible };
  if (t.ibanEmpreinte === empreinte) return { ok: false, message: MESSAGES_CHANGEMENT.identique };

  const id = randomUUID();
  const nature: NatureChangement = "iban";
  let valeur: string;
  try {
    // Chiffré HORS transaction : sans clé, `encryptPii` lève et rien n'est écrit.
    valeur = encryptPii(iban, { aad: `demande:${id}:iban`, cleExigee: true });
  } catch {
    return { ok: false, message: MESSAGES_CHANGEMENT.erreur };
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.demandeChangementFormateur.create({
        data: { id, trainerId, nature, valeur, valeurEmpreinte: empreinte },
      });
      await journaliser(
        tx,
        {
          action: "qualiopi.formateur.changement_demande",
          targetType: "DemandeChangementFormateur",
          targetId: id,
          // La nature seule : jamais la valeur demandée.
          changes: { trainerId, nature },
          session: null,
        },
        { exiger: true },
      );
    });
  } catch (e) {
    return {
      ok: false,
      message: estDoublon(e) ? MESSAGES_CHANGEMENT.dejaEnCours : MESSAGES_CHANGEMENT.erreur,
    };
  }

  await alerterDemande(trainerId, id, nature);
  // F43 — à l'adresse CONNUE de la fiche : si la demande n'est pas de lui, il le dit.
  try {
    const issue = await envoyer({
      gabarit: "formateur-iban-changement",
      destinataire: t.email,
      entityType: "Trainer",
      entityId: trainerId,
      jobId: `fi-changement-${id}`,
      payload: { prenom: t.prenom, valeurs: { date: JOUR_FR.format(maintenant) } },
    });
    if (issue === "envoye" || issue === "en-validation") {
      await prisma.demandeChangementFormateur.updateMany({
        where: { id, ancienneAdresseAviseeAt: null },
        data: { ancienneAdresseAviseeAt: maintenant },
      });
    }
  } catch {
    // La demande est enregistrée ; l'alerte interne est partie.
  }
  return { ok: true };
}

/** Demande de changement d'adresse professionnelle, depuis l'espace. */
export async function demanderChangementAdresse(
  trainerId: string,
  adresseSaisie: string,
): Promise<ResultatDemande> {
  if (!(await interrupteurAllume("changement_coordonnees"))) {
    return { ok: false, message: MESSAGES_CHANGEMENT.indisponible };
  }
  const adresse = adresseSaisie.trim();
  if (adresse.length < 5 || adresse.length > 500) {
    return { ok: false, message: MESSAGES_CHANGEMENT.adresseInvalide };
  }
  try {
    const t = await ficheIndependante(trainerId);
    if (t === null) return { ok: false, message: MESSAGES_CHANGEMENT.indisponible };
    const id = randomUUID();
    await prisma.$transaction(async (tx) => {
      await tx.demandeChangementFormateur.create({
        data: { id, trainerId, nature: "adresse" as const, valeur: adresse },
      });
      await journaliser(
        tx,
        {
          action: "qualiopi.formateur.changement_demande",
          targetType: "DemandeChangementFormateur",
          targetId: id,
          changes: { trainerId, nature: "adresse" },
          session: null,
        },
        { exiger: true },
      );
    });
    await alerterDemande(trainerId, id, "adresse");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: estDoublon(e) ? MESSAGES_CHANGEMENT.dejaEnCours : MESSAGES_CHANGEMENT.erreur,
    };
  }
}

/** Ce que l'espace montre : la nature et la date des demandes en cours. Jamais la valeur. */
export async function lireDemandesEnCours(
  trainerId: string,
): Promise<ReadonlyArray<{ nature: NatureChangement; createdAt: Date }> | null> {
  // `null` = pas de section : interrupteur coupé, ou fiche hors périmètre (salarié,
  // inactive, close) — la page ne montre alors aucun formulaire.
  if (!(await interrupteurAllume("changement_coordonnees"))) return null;
  try {
    if ((await ficheIndependante(trainerId)) === null) return null;
    const l = await prisma.demandeChangementFormateur.findMany({
      where: { trainerId, statut: "en_attente", nature: { in: [...NATURES_CHANGEMENT] } },
      select: { nature: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return l as Array<{ nature: NatureChangement; createdAt: Date }>;
  } catch {
    return null;
  }
}

// ── Console (écran W-7) ──────────────────────────────────────────────────

export interface DemandeConsole {
  readonly id: string;
  readonly trainerId: string;
  readonly formateur: string;
  readonly nature: NatureChangement;
  readonly createdAt: Date;
  /** Instant à partir duquel la validation est possible. */
  readonly validableAt: Date;
  /** Le délai est écoulé à `maintenant`. */
  readonly validable: boolean;
  /** Adresse demandée (l'IBAN, lui, n'est jamais rendu). */
  readonly adresse: string | null;
}

export async function lireDemandesAValider(
  maintenant: Date,
): Promise<ReadonlyArray<DemandeConsole>> {
  if (!(await interrupteurAllume("changement_coordonnees"))) return [];
  const l = await prisma.demandeChangementFormateur.findMany({
    where: { statut: "en_attente", nature: { in: [...NATURES_CHANGEMENT] } },
    select: {
      id: true,
      trainerId: true,
      nature: true,
      createdAt: true,
      valeur: true,
      trainer: { select: { prenom: true, nom: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return l.map((d) => ({
    id: d.id,
    trainerId: d.trainerId,
    formateur: `${d.trainer.prenom} ${d.trainer.nom}`.trim(),
    nature: d.nature as NatureChangement,
    createdAt: d.createdAt,
    validableAt: new Date(d.createdAt.getTime() + DELAI_VALIDATION_CHANGEMENT_MS),
    validable: maintenant.getTime() - d.createdAt.getTime() >= DELAI_VALIDATION_CHANGEMENT_MS,
    adresse: d.nature === "adresse" ? d.valeur : null,
  }));
}

export type ResultatTraitement =
  | { ok: true }
  | {
      ok: false;
      raison: "coupe" | "introuvable" | "trop_tot" | "deja_traitee" | "motif" | "erreur";
    };

class DejaTraitee extends Error {}

/**
 * Validation par un administrateur (l'action a vérifié l'habilitation). Après le délai
 * seulement. La fiche reçoit la nouvelle valeur dans la même transaction que la
 * décision ; F44 confirme au formateur.
 */
export async function validerDemandeChangement(p: {
  readonly demandeId: string;
  readonly adminId: string;
  readonly maintenant: Date;
}): Promise<ResultatTraitement> {
  if (!(await interrupteurAllume("changement_coordonnees"))) return { ok: false, raison: "coupe" };
  try {
    const d = await prisma.demandeChangementFormateur.findUnique({
      where: { id: p.demandeId },
      select: {
        id: true,
        trainerId: true,
        nature: true,
        statut: true,
        valeur: true,
        valeurEmpreinte: true,
        createdAt: true,
        trainer: { select: { statut: true, prenom: true, email: true } },
      },
    });
    if (
      d === null ||
      d.trainer.statut !== "sous_traitant" ||
      !(NATURES_CHANGEMENT as readonly string[]).includes(d.nature)
    ) {
      return { ok: false, raison: "introuvable" };
    }
    if (d.statut !== "en_attente") return { ok: false, raison: "deja_traitee" };
    if (p.maintenant.getTime() - d.createdAt.getTime() < DELAI_VALIDATION_CHANGEMENT_MS) {
      return { ok: false, raison: "trop_tot" };
    }
    const nature = d.nature as NatureChangement;

    let ecriture: { iban: string; ibanEmpreinte: string } | { adresseProfessionnelle: string };
    if (nature === "iban") {
      if (d.valeurEmpreinte === null) return { ok: false, raison: "erreur" };
      const clair = decryptPii(d.valeur, { aad: `demande:${d.id}:iban`, cleExigee: true });
      ecriture = {
        iban: encryptPii(clair, { aad: `trainer:${d.trainerId}:iban`, cleExigee: true }),
        ibanEmpreinte: d.valeurEmpreinte,
      };
    } else {
      ecriture = { adresseProfessionnelle: d.valeur };
    }

    await prisma.$transaction(async (tx) => {
      const r = await tx.demandeChangementFormateur.updateMany({
        where: { id: d.id, statut: "en_attente" },
        data: { statut: "acceptee", traiteParId: p.adminId, traiteAt: p.maintenant },
      });
      if (r.count !== 1) throw new DejaTraitee();
      await tx.trainer.update({ where: { id: d.trainerId }, data: ecriture });
      await journaliser(
        tx,
        {
          action: "qualiopi.formateur.changement_valide",
          targetType: "DemandeChangementFormateur",
          targetId: d.id,
          changes: { trainerId: d.trainerId, nature },
          session: { userId: p.adminId },
        },
        { exiger: true },
      );
    });

    // F44 — la confirmation ; une panne n'annule pas la décision.
    try {
      const libelle = LIBELLES_NATURE[nature];
      await envoyer({
        gabarit: "formateur-iban-valide",
        destinataire: d.trainer.email,
        entityType: "Trainer",
        entityId: d.trainerId,
        jobId: `fi-changement-valide-${d.id}`,
        payload: {
          prenom: d.trainer.prenom,
          valeurs: {
            nature: libelle,
            [CROCHET_NATURE_F44]: libelle,
            date: JOUR_FR.format(p.maintenant),
          },
        },
      });
    } catch {
      // La fiche est à jour ; la confirmation peut être renvoyée à la main.
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof DejaTraitee) return { ok: false, raison: "deja_traitee" };
    return { ok: false, raison: "erreur" };
  }
}

/** Refus par un administrateur : la demande reste en base, la fiche n'est pas touchée. */
export async function refuserDemandeChangement(p: {
  readonly demandeId: string;
  readonly adminId: string;
  readonly motif: string;
  readonly maintenant: Date;
}): Promise<ResultatTraitement> {
  if (!(await interrupteurAllume("changement_coordonnees"))) return { ok: false, raison: "coupe" };
  // Le CHECK `demandes_changement_formateur_traitement_coherent` exige un motif non vide.
  const motif = p.motif.trim().slice(0, 500);
  if (motif === "") return { ok: false, raison: "motif" };
  try {
    const r = await prisma.demandeChangementFormateur.updateMany({
      where: { id: p.demandeId, statut: "en_attente" },
      data: {
        statut: "refusee",
        traiteParId: p.adminId,
        traiteAt: p.maintenant,
        motifRefus: motif,
      },
    });
    if (r.count !== 1) return { ok: false, raison: "deja_traitee" };
    await journaliser(prisma, {
      action: "qualiopi.formateur.changement_refuse",
      targetType: "DemandeChangementFormateur",
      targetId: p.demandeId,
      changes: {},
      session: { userId: p.adminId },
    });
    return { ok: true };
  } catch {
    return { ok: false, raison: "erreur" };
  }
}
