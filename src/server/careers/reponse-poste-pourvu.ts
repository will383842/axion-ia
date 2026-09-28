// ⚠️ PAS de `import "server-only"` : ce module tourne dans le WORKER (`tsx`,
// hors de Next). Gardé par `tests/unit/ci/aucun-module-du-worker-nimporte-server-only.spec.ts`.

/**
 * RÉPONSE AUTOMATIQUE « POSTE POURVU » — décision de Will du 2026-09-28.
 *
 * ## Ce que ça renverse, et pourquoi c'est écrit
 *
 * Jusqu'ici la doctrine du recrutement était « décider de répondre reste un
 * geste humain » (`dossiers-en-sommeil.ts` : le cron n'écrit rien au candidat).
 * Le 28/09, 200 candidatures attendaient, toutes sans réponse depuis parfois
 * deux mois. Will a choisi de GARDER les annonces en ligne (vivier) et de
 * répondre automatiquement, chaque semaine, à ceux qu'il n'a pas pris en main :
 * « poste pourvu, nous gardons votre dossier ». Ce module est ce choix, et
 * seulement lui.
 *
 * ## Ce qui protège un profil intéressant
 *
 *  · `AGE_MIN_JOURS` (7) : un dossier récent n'est jamais touché. Pendant
 *    7 jours, le passer « en revue », lui répondre ou le présélectionner le
 *    retire DÉFINITIVEMENT de ce passage — seul le statut `new` sans aucune
 *    réponse est éligible.
 *  · Les offres VIDÉO (monteur, vidéaste) sont exclues : recrutement en cours,
 *    Will compare les prix.
 *  · Une opposition au vivier exclut aussi : le texte promet de garder le dossier.
 *  · L'interrupteur `CLE_ACTIVATION` (table `settings`) : ABSENT = ARRÊTÉ.
 *    Il se bascule depuis la console (Candidatures), sans redéploiement.
 *
 * ## Le rythme
 *
 * Passage HORAIRE, au plus `PAR_PASSAGE` réponses : le plafond d'envoi de la
 * boîte est de 40/h (`email-worker.ts`), partagé avec les e-mails clients. 15
 * laisse toujours de la place aux confirmations de rendez-vous. Un stock se
 * vide donc sur quelques heures, et un redéploiement n'interrompt rien : l'état
 * vit en base, le passage suivant reprend où le précédent s'est arrêté.
 *
 * ## Le chemin d'écriture
 *
 * `ecrireEtEnfilerReponse` — le MÊME que le bouton « Répondre » de la console :
 * la réponse, sa trace au journal, `new → reviewing`, `needsAttention = false`,
 * dans une transaction. Rien n'est recopié.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { remplirModele } from "@/content/recrutement/modeles-reponse";
import { ecrireEtEnfilerReponse } from "@/features/admin-job-applications/envoyer-reponse";
import { VIDEO_FREELANCE_OFFER_SLUGS } from "@/lib/careers/video-editor-offer";
import type { Prisma } from "../../../prisma/generated/client";

export const CLE_ACTIVATION = "recrutement.reponse-poste-pourvu-auto";
export const AGE_MIN_JOURS = 7;
export const PAR_PASSAGE = 15;
const FENETRE = 300;
/** Signature dans le journal et la réponse — aucune personne n'a cliqué. */
export const AUTEUR = "Réponse automatique (poste pourvu)";

/** Offres exclues : le recrutement vidéo est en cours. */
const SLUGS_EXCLUS = [
  ...VIDEO_FREELANCE_OFFER_SLUGS,
  "monteur-video-motion",
  "videaste-content-creator",
];

export const OBJET = "Votre candidature — {poste}";
export const CORPS = [
  "Bonjour {prenom},",
  "",
  "Merci pour votre candidature au poste de {poste} et pour le temps que vous y avez consacré. Nous l'avons bien reçue et lue.",
  "",
  "Ce poste est aujourd'hui pourvu. Nos équipes continuent cependant de se développer, et votre profil nous intéresse pour la suite : nous conservons votre candidature et nous reviendrons vers vous dès qu'un besoin correspondant s'ouvrira.",
  "",
  "Si vous préférez que nous supprimions votre dossier, il suffit de répondre à ce message.",
  "",
  "Belle suite à vous, et à bientôt peut-être.",
].join("\n");

/**
 * L'intitulé tel qu'on l'écrit dans une phrase : « Développeur web — produits
 * SaaS… » → « Développeur web » ; « (F/H) » retiré ; une candidature spontanée
 * garde le poste visé, pas le mot « spontanée » ; « COMMERCIAL » → « Commercial ».
 */
export function posteCourt(titre: string | null | undefined): string | null {
  if (!titre) return null;
  const parts = titre.split(" — ").map((x) => x.trim());
  const base = /^candidature spontan/i.test(parts[0] ?? "") ? (parts[1] ?? "") : (parts[0] ?? "");
  const v = base.replace(/\s*\((?:F\/H|H\/F)\)\s*/gi, " ").trim();
  if (v && v === v.toUpperCase()) return v.charAt(0) + v.slice(1).toLowerCase();
  return v || null;
}

/** Le filtre d'éligibilité — une seule définition, lue par le passage ET l'écran. */
export function critereEligible(maintenant: Date): Prisma.JobApplicationWhereInput {
  return {
    status: "new",
    replies: { none: {} },
    vivierOpposedAt: null,
    submittedAt: { lte: new Date(maintenant.getTime() - AGE_MIN_JOURS * 86_400_000) },
    AND: [
      { OR: [{ offer: null }, { offer: { slug: { notIn: SLUGS_EXCLUS } } }] },
      { offerTitleSnap: { not: { contains: "monteur vid" }, mode: "insensitive" } },
      { offerTitleSnap: { not: { contains: "vidéaste" }, mode: "insensitive" } },
    ],
  };
}

/** Interrupteur : ABSENT ou illisible = ARRÊTÉ. */
export async function estActive(): Promise<boolean> {
  try {
    const ligne = await prisma.setting.findUnique({
      where: { key: CLE_ACTIVATION },
      select: { value: true },
    });
    return (ligne?.value as { actif?: unknown } | null)?.actif === true;
  } catch {
    return false;
  }
}

export interface BilanPassage {
  readonly actif: boolean;
  readonly envoyees: number;
  readonly ecartees: number;
  readonly echouees: number;
  readonly restantes: number;
}

export async function passerReponsePostePourvu(
  maintenant: Date = new Date(),
): Promise<BilanPassage> {
  if (!(await estActive())) {
    return { actif: false, envoyees: 0, ecartees: 0, echouees: 0, restantes: 0 };
  }
  const where = critereEligible(maintenant);
  const lot = await prisma.jobApplication.findMany({
    where,
    orderBy: { submittedAt: "asc" },
    // 🔑 Fenêtre LARGE, plafond sur les ENVOIS : un dossier écarté (prénom
    // illisible) reste éligible et resterait en tête de file ; borner la
    // fenêtre à `PAR_PASSAGE` le ferait réexaminer à chaque passage pendant que
    // les suivants attendent.
    take: FENETRE,
    select: {
      id: true,
      email: true,
      locale: true,
      status: true,
      offerTitleSnap: true,
      firstName: true,
    },
  });

  let envoyees = 0;
  let ecartees = 0;
  let echouees = 0;
  for (const c of lot) {
    if (envoyees + echouees >= PAR_PASSAGE) break;
    const prenom = prenomLisible(c.firstName);
    const poste = posteCourt(c.offerTitleSnap);
    if (!prenom || !poste) {
      // Jamais « Bonjour {prenom} » : le dossier reste à écrire à la main.
      ecartees += 1;
      continue;
    }
    const valeurs = { prenom, poste };
    const issue = await ecrireEtEnfilerReponse(
      c,
      { userId: null, nom: AUTEUR },
      {
        subject: remplirModele(OBJET, valeurs),
        bodyMarkdown: remplirModele(CORPS, valeurs),
        modele: "libre",
      },
    );
    if (issue.ecrit && issue.enfile) envoyees += 1;
    else if (issue.ecrit) echouees += 1;
    else ecartees += 1;
  }

  const restantes = await prisma.jobApplication.count({ where });
  return { actif: true, envoyees, ecartees, echouees, restantes };
}

function prenomLisible(chiffre: string | null): string | null {
  if (!chiffre) return null;
  try {
    const v = decryptPii(chiffre);
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}
