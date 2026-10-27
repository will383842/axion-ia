/**
 * Tour France IA : enregistrer une demande (PR-2a).
 *
 * `enregistrerDemande` est l'unique chemin d'écriture d'une demande. Dans l'ordre :
 *
 *   1. la ville est ramenée à sa clé (`villes.ts`) ; une ville vide est refusée ;
 *   2. nom, e-mail et téléphone sont CHIFFRÉS (`encryptPii`, IV aléatoire : on ne les retrouve que
 *      par `emailHash` et `telephoneFin`) ;
 *   3. la ligne est créée avec `compte: true` et ses trois clés de comptage UNIQUES. Si une clé est
 *      déjà prise (la même personne, la même entreprise ou le même téléphone a déjà demandé pour
 *      cette ville), la base refuse (P2002) : la demande est alors enregistrée SANS clé, `compte:
 *      false`, avec `doublonDeId` — elle reste visible dans la console, elle ne gonfle pas le
 *      compteur. Deux demandes simultanées ne passent donc jamais toutes les deux ;
 *   4. la fiche prospect (`fiche.ts`) puis le CRM Pro (`crm.ts`) sont traités EN MEILLEUR EFFORT :
 *      une panne laisse la demande « à vérifier » et la signale à Sentry, elle ne la perd jamais.
 *
 * Jamais de mise à jour ni de suppression d'une demande ici.
 */

import * as Sentry from "@sentry/nextjs";

import { finDeTelephone } from "@/features/dossier-client/fiche-auto";
import { encryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup, normalizeEmail } from "@/lib/security/email-hash";
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

/** Une donnée indispensable manque : l'appelant l'a mal validée. */
export class ErreurDemande extends Error {
  constructor(readonly champ: "nom" | "email" | "telephone" | "ville") {
    super(`demande du Tour : ${champ} manquant`);
    this.name = "ErreurDemande";
  }
}

function courte(v: string | null | undefined, max: number): string | null {
  const t = (v ?? "").trim().slice(0, max);
  return t === "" ? null : t;
}

/** Violation d'une contrainte d'unicité Prisma (P2002). */
function estCleUniquePrise(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

export async function enregistrerDemande(entree: EntreeDemande): Promise<DemandeEnregistree> {
  const ville = resoudreVille(entree.ville);
  if (ville === null) throw new ErreurDemande("ville");
  const nom = entree.nom.trim().slice(0, 120);
  if (nom === "") throw new ErreurDemande("nom");
  const email = normalizeEmail(entree.email).slice(0, 254);
  if (email === "") throw new ErreurDemande("email");
  const telephone = entree.telephone.trim().slice(0, 40);
  if (telephone === "") throw new ErreurDemande("telephone");

  const emailHash = hashEmailForLookup(email);
  const telephoneFin = finDeTelephone(telephone);
  const cles = clesDeComptage({ villeCle: ville.cle, emailHash, email, telephoneFin });
  const depuis = courte(entree.depuis, 60);
  const utmSource = courte(entree.utmSource, 60);
  const utmMedium = courte(entree.utmMedium, 60);
  const utmCampaign = courte(entree.utmCampaign, 60);
  const utmContent = courte(entree.utmContent, 60);

  const base = {
    nom: encryptPii(nom),
    email: encryptPii(email),
    telephone: encryptPii(telephone),
    emailHash,
    telephoneFin,
    villeSaisie: entree.ville.trim().slice(0, 80),
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
      ville: ville.nom ?? entree.ville.trim().slice(0, 80),
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
