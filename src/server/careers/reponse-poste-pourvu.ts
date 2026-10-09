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
 *  · 🔴 LES COMMERCIAUX SONT EXCLUS (Will, 2026-09-29). Une candidature à une
 *    offre de catégorie `commercial` entre dans le TUNNEL APPORTEUR : elle
 *    reçoit une invitation à réserver un échange (`invitation-auto.ts`). Lui
 *    écrire aussi « poste pourvu » se contredit — c'est arrivé le 28/09 : cinq
 *    personnes ont reçu l'invitation PUIS « poste pourvu ». Sont donc exclues :
 *    l'offre `commercial`, toute candidature dont une fiche apporteur est née
 *    (`details.jobApplicationId`, « Proposer le réseau » compris), et les
 *    spontanées à l'intitulé commercial.
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
import { SLUG_OFFRE_FORMATEUR_FREELANCE } from "@/lib/careers/formateur-freelance";
import {
  DEBUT_PROPOSITION_RESEAU,
  envoyerProposition,
  preparerProposition,
} from "@/server/careers/proposer-reseau-auto";
import type { Prisma } from "../../../prisma/generated/client";

export const CLE_ACTIVATION = "recrutement.reponse-poste-pourvu-auto";
export const AGE_MIN_JOURS = 7;
export const PAR_PASSAGE = 15;
const FENETRE = 300;
/** Signature dans le journal et la réponse — aucune personne n'a cliqué. */
export const AUTEUR = "Réponse automatique (poste pourvu)";

/**
 * Offres exclues : le recrutement vidéo est en cours ; et l'offre « Formateur
 * IA freelance » (Will, 2026-10-09) — une mission de sous-traitance n'est
 * jamais « pourvue », et un formateur ne doit pas recevoir l'invitation au
 * réseau d'apporteurs qui suit ce message.
 */
const SLUGS_EXCLUS = [
  ...VIDEO_FREELANCE_OFFER_SLUGS,
  "monteur-video-motion",
  "videaste-content-creator",
  SLUG_OFFRE_FORMATEUR_FREELANCE,
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
 * Paragraphe ajouté pour les candidatures reçues depuis le 29/09 (Will) : le
 * réseau d'apporteurs d'affaires indépendants est proposé, et l'invitation
 * (Calendly, 15 minutes) part juste après. N'apparaît QUE si la fiche apporteur
 * a pu être préparée — on n'annonce jamais une invitation qui ne partira pas.
 */
export const PARAGRAPHE_RESEAU =
  "Par ailleurs, nous développons un réseau d'apporteurs d'affaires indépendants. Si cela vous intéresse, vous allez recevoir dans quelques minutes une invitation à en parler 15 minutes en visio, sans engagement.";

/** Le corps, avec la proposition du réseau placée avant la phrase sur la suppression du dossier. */
export function corpsAvecReseau(): string {
  const reperes = "\n\nSi vous préférez que nous supprimions";
  return CORPS.replace(reperes, `\n\n${PARAGRAPHE_RESEAU}${reperes}`);
}

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

/** Catégorie d'offre dont les candidats basculent dans le tunnel apporteur. */
export const CATEGORIE_TUNNEL = "commercial" as const;

/** Intitulés exclus : vidéo (recrutement en cours), commercial (tunnel apporteur), formateur freelance. */
const INTITULES_EXCLUS = [
  "monteur vid",
  "vidéaste",
  "commercial",
  "business dev",
  "apporteur",
  "formateur ia freelance",
];

/**
 * Le filtre d'éligibilité — une seule définition, lue par le passage ET l'écran.
 * `idsTunnel` : les candidatures dont une fiche apporteur est née (lu par
 * `idsBasculesAuTunnel`, qui a besoin de la base — ce filtre reste pur).
 */
export function critereEligible(
  maintenant: Date,
  idsTunnel: readonly string[] = [],
): Prisma.JobApplicationWhereInput {
  return {
    status: "new",
    replies: { none: {} },
    vivierOpposedAt: null,
    submittedAt: { lte: new Date(maintenant.getTime() - AGE_MIN_JOURS * 86_400_000) },
    ...(idsTunnel.length > 0 ? { id: { notIn: [...idsTunnel] } } : {}),
    AND: [
      {
        OR: [
          { offer: null },
          { offer: { slug: { notIn: SLUGS_EXCLUS }, category: { not: CATEGORIE_TUNNEL } } },
        ],
      },
      ...INTITULES_EXCLUS.map((t) => ({
        offerTitleSnap: { not: { contains: t }, mode: "insensitive" as const },
      })),
    ],
  };
}

/**
 * Candidatures BASCULÉES dans le tunnel apporteur : une fiche est née d'elles
 * (`details.jobApplicationId`), qu'elle vienne de l'invitation automatique ou
 * du bouton « Proposer le réseau d'apporteurs ». Une fiche effacée compte
 * aussi : la personne a pu recevoir l'invitation avant l'effacement.
 */
export async function idsBasculesAuTunnel(): Promise<string[]> {
  const lignes = await prisma.$queryRaw<Array<{ id: string | null }>>`
    SELECT DISTINCT details->>'jobApplicationId' AS id
    FROM submissions
    WHERE details ? 'jobApplicationId'`;
  return lignes
    .map((l) => l.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/** Le critère complet, tunnel compris — celui qu'utilisent le passage et l'écran. */
export async function critereEligibleActuel(
  maintenant: Date,
): Promise<Prisma.JobApplicationWhereInput> {
  return critereEligible(maintenant, await idsBasculesAuTunnel());
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
  const where = await critereEligibleActuel(maintenant);
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
      submittedAt: true,
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
    // Candidature reçue depuis le 29/09 : on propose le réseau d'apporteurs. La
    // fiche est préparée AVANT le message, qui n'annonce l'invitation que si
    // elle va partir (personne déjà apporteur, lien absent → pas d'annonce).
    const proposition =
      c.submittedAt >= DEBUT_PROPOSITION_RESEAU
        ? await preparerProposition(c.id, "poste-pourvu")
        : null;
    const avecReseau = proposition?.fiche === "creee";
    const issue = await ecrireEtEnfilerReponse(
      c,
      { userId: null, nom: AUTEUR },
      {
        subject: remplirModele(OBJET, valeurs),
        bodyMarkdown: remplirModele(avecReseau ? corpsAvecReseau() : CORPS, valeurs),
        modele: "libre",
      },
    );
    // L'invitation part même si la réponse n'a pas été écrite : la fiche existe
    // déjà (elle retire la candidature de ce passage), la personne doit au moins
    // recevoir la proposition annoncée.
    if (proposition?.fiche === "creee") await envoyerProposition(c.id, proposition.submissionId);
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
