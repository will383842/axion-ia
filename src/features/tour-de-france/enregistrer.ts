/**
 * Tour France IA : enregistrer une demande (PR-2a).
 *
 * `enregistrerDemande` est l'unique chemin d'écriture d'une demande. Dans l'ordre :
 *
 *   1. les champs sont NETTOYÉS et validés : nom et ville sans caractère de contrôle ni d'inversion
 *      du sens d'écriture, e-mail valide et borné, téléphone lisible (9 chiffres au moins) ; tout
 *      champ qui commence par `enc:` est refusé (il ferait passer du texte pour un chiffré) ;
 *   2. la ville est ramenée à sa clé (`villes.ts`) ; une ville vide est refusée ;
 *   3. nom, e-mail et téléphone sont CHIFFRÉS (`chiffrement.ts` : clé exigée, donnée authentifiée
 *      propre au champ ; IV aléatoire, on ne les retrouve que par `emailHash`). Le téléphone n'est
 *      gardé sous AUCUNE autre forme : ses seuls dérivés sont des HMAC (clé de comptage) ;
 *   4. la ligne est créée avec `compte: true` et ses trois clés de comptage UNIQUES (HMAC). Si une
 *      clé est déjà prise (la même personne, la même entreprise ou le même téléphone a déjà demandé
 *      pour cette ville), la base refuse (P2002) : la demande est alors enregistrée SANS clé,
 *      `compte: false`, avec `doublonDeId` — elle reste visible dans la console, elle ne gonfle pas
 *      le compteur. Deux demandes simultanées ne passent donc jamais toutes les deux ;
 *   5. la fiche prospect (`fiche.ts`, qui n'écrit sur aucune fiche existante) puis le CRM Pro
 *      (`crm.ts`) sont traités EN MEILLEUR EFFORT : une panne laisse la demande « à vérifier » et
 *      la signale à Sentry, elle ne la perd jamais.
 *
 * Jamais de mise à jour ni de suppression d'une demande ici.
 */

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { finDeTelephone } from "@/features/dossier-client/fiche-auto";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup, normalizeEmail } from "@/lib/security/email-hash";
import { chiffrerChamp } from "./chiffrement";
import { clesDeComptage } from "./comptage";
import { envoyerAuCrm } from "./crm";
import { rattacherDemande } from "./fiche";
import type { Rattachement } from "./types";
import { resoudreVille } from "./villes";

export interface EntreeDemande {
  readonly nom: string;
  readonly email: string;
  readonly telephone: string;
  readonly ville: string;
  readonly depuis?: string | null;
  readonly utmSource?: string | null;
  readonly utmMedium?: string | null;
  readonly utmCampaign?: string | null;
  readonly utmContent?: string | null;
  /** L'empreinte de l'adresse IP (jamais l'adresse). */
  readonly ipHash?: string | null;
}

export interface DemandeEnregistree {
  readonly id: string;
  /** Vrai si la demande compte pour sa ville. */
  readonly compte: boolean;
  readonly rattachement: Rattachement;
}

/** Une donnée indispensable manque ou est refusée : l'appelant l'a mal validée. */
export class ErreurDemande extends Error {
  constructor(readonly champ: "nom" | "email" | "telephone" | "ville") {
    super(`demande du Tour : ${champ} manquant ou refusé`);
    this.name = "ErreurDemande";
  }
}

const LONGUEUR_MAX_NOM = 120;
const LONGUEUR_MAX_VILLE = 80;
const LONGUEUR_MAX_TELEPHONE = 40;
const LONGUEUR_MAX_EMAIL = 254;

const ADRESSE_VALIDE = z.string().email().max(LONGUEUR_MAX_EMAIL);

/** Les caractères de contrôle et d'inversion du sens d'écriture (jamais dans un nom ni une ville). */
const CARACTERES_INTERDITS = /[\p{Cc}\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/gu;

/** Un texte libre (nom, ville, téléphone) nettoyé : forme NFKC, un espace entre les mots, sans contrôle. */
function propre(texte: string, max: number): string {
  return texte
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(CARACTERES_INTERDITS, "")
    .trim()
    .slice(0, max);
}

/** Vrai si la valeur se fait passer pour un chiffré (`enc:v1:…`), quelle que soit la casse. */
function ressembleAUnChiffre(valeur: string): boolean {
  return valeur.trim().toLowerCase().startsWith("enc:");
}

function courte(v: string | null | undefined, max: number): string | null {
  const t = propre(v ?? "", max);
  return t === "" ? null : t;
}

/** Violation d'une contrainte d'unicité Prisma (P2002). */
function estCleUniquePrise(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

export async function enregistrerDemande(entree: EntreeDemande): Promise<DemandeEnregistree> {
  const villeSaisie = propre(entree.ville, LONGUEUR_MAX_VILLE);
  const ville = resoudreVille(villeSaisie);
  if (ville === null) throw new ErreurDemande("ville");
  const nom = propre(entree.nom, LONGUEUR_MAX_NOM);
  if (nom === "" || ressembleAUnChiffre(entree.nom) || ressembleAUnChiffre(nom)) {
    throw new ErreurDemande("nom");
  }
  const email = normalizeEmail(entree.email);
  if (ressembleAUnChiffre(email) || !ADRESSE_VALIDE.safeParse(email).success) {
    throw new ErreurDemande("email");
  }
  const telephone = propre(entree.telephone, LONGUEUR_MAX_TELEPHONE);
  const telephoneFin = finDeTelephone(telephone);
  // Un numéro illisible (moins de 9 chiffres) ne permet ni de rappeler ni de compter : refusé.
  if (
    telephoneFin === null ||
    ressembleAUnChiffre(entree.telephone) ||
    ressembleAUnChiffre(telephone)
  ) {
    throw new ErreurDemande("telephone");
  }

  const emailHash = hashEmailForLookup(email);
  const cles = clesDeComptage({ villeCle: ville.cle, email, telephoneFin });
  const depuis = courte(entree.depuis, 60);
  const utmSource = courte(entree.utmSource, 60);
  const utmMedium = courte(entree.utmMedium, 60);
  const utmCampaign = courte(entree.utmCampaign, 60);
  const utmContent = courte(entree.utmContent, 60);

  const base = {
    nom: chiffrerChamp("nom", nom),
    email: chiffrerChamp("email", email),
    telephone: chiffrerChamp("telephone", telephone),
    emailHash,
    villeSaisie,
    villeCle: ville.cle,
    villeNom: ville.nom,
    depuis,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    ipHash: courte(entree.ipHash, 64),
  };

  let id: string;
  let compte = true;
  try {
    const creee = await prisma.tourDemande.create({
      data: {
        ...base,
        compte: true,
        cleComptagePersonne: cles.personne,
        cleComptageDomaine: cles.domaine,
        cleComptageTelephone: cles.telephone,
      },
      select: { id: true },
    });
    id = creee.id;
  } catch (e) {
    if (!estCleUniquePrise(e)) throw e;
    compte = false;
    // Qui tient déjà la clé ? (pour la console ; une absence n'empêche pas l'enregistrement)
    const ou = [
      ...(cles.personne !== null ? [{ cleComptagePersonne: cles.personne }] : []),
      ...(cles.domaine !== null ? [{ cleComptageDomaine: cles.domaine }] : []),
      ...(cles.telephone !== null ? [{ cleComptageTelephone: cles.telephone }] : []),
    ];
    const tenant =
      ou.length > 0
        ? await prisma.tourDemande.findFirst({
            where: { OR: ou },
            select: { id: true },
            orderBy: { creeLe: "asc" },
          })
        : null;
    const creee = await prisma.tourDemande.create({
      data: { ...base, compte: false, doublonDeId: tenant?.id ?? null },
      select: { id: true },
    });
    id = creee.id;
  }

  let rattachement: Rattachement = "a_verifier";
  try {
    rattachement = (await rattacherDemande(id)).rattachement;
  } catch (e) {
    Sentry.captureException(e, { tags: { module: "tour-demande", etape: "rattachement" } });
  }

  try {
    await envoyerAuCrm({
      id,
      nom,
      email,
      telephone,
      ville: ville.nom ?? villeSaisie,
      depuis,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { module: "tour-demande", etape: "crm" } });
  }

  return { id, compte, rattachement };
}
