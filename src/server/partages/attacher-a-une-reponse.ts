// ⚠️ PAS de `import "server-only"` ici : ce module est atteint par
// `envoyer-reponse.ts`, que le WORKER charge aussi (réponse automatique
// « poste pourvu »). Gardé par `tests/unit/ci/aucun-module-du-worker-nimporte-server-only.spec.ts`.

/**
 * JOINDRE DES FICHIERS À UNE RÉPONSE — un lien privé, jamais une pièce jointe
 * (Candidatures unifiées L5, ADR 0065 D6, plan § 5).
 *
 * Deux temps, pour que le lien parte DANS la transaction de la réponse :
 *   1. `preparerLienFichiers` (avant la transaction) vérifie les fichiers,
 *      choisit l'identifiant du lien, calcule sa date limite et le paragraphe
 *      ajouté au message (le rendu de l'e-mail a besoin du texte final) ;
 *   2. `creerLienPartage` (dans la transaction de `ecrireEtEnfilerReponse`)
 *      écrit le lien et ses fichiers, avec le `reponseId` de la réponse.
 *
 * Aucune modification du worker ni des gabarits d'e-mail : le lien est un
 * paragraphe en Markdown léger du corps du message.
 */

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../prisma/generated/client";

import { configPartages } from "./config";
import { adresseMasqueeLien, jetonLien } from "./jeton";
import { FICHIERS_PAR_LIEN_MAX, expirationLien, paragrapheFichiers } from "./liens";
import { categoriesProposees } from "./regles";

type Env = Readonly<Record<string, string | undefined>>;

/** Un lien prêt à partir avec une réponse. */
export interface LienPrepare {
  readonly lienId: string;
  /** Adresse MASQUÉE (sans jeton) : c'est elle qui est écrite en base. */
  readonly adresse: string;
  readonly expireLe: Date;
  readonly fichierIds: ReadonlyArray<string>;
  readonly categories: ReadonlyArray<string>;
  /** Paragraphe ajouté à la fin du message (Markdown léger). */
  readonly paragraphe: string;
  /** L5b — la personne peut-elle déposer sa version par ce lien ? (coché par l'équipe) */
  readonly depotAutorise?: boolean;
}

export interface FichierCandidat {
  readonly id: string;
  readonly nature: string;
  readonly categorie: string;
  readonly etatDepot: string;
  readonly analyse: string | null;
  readonly archiveLe: Date | null;
}

export type Verification =
  | { readonly ok: true; readonly categories: string[] }
  | { readonly ok: false; readonly erreur: string };

/**
 * Les fichiers demandés se joignent-ils ? Pure.
 *
 * Un fichier encore en analyse antivirus SE JOINT : la page le montrera « en
 * cours de vérification » jusqu'au verdict. Un fichier infecté, en cours
 * d'envoi, abandonné ou archivé ne se joint pas ; ni un kit d'apporteur ou un
 * essai rendu (hors du monde « emploi »).
 */
export function verifierFichiersJoignables(
  ids: ReadonlyArray<string>,
  lignes: ReadonlyArray<FichierCandidat>,
  monde: "emploi" | "apporteur" = "emploi",
): Verification {
  const uniques = [...new Set(ids.map((i) => i.toLowerCase()))];
  if (uniques.length === 0) return { ok: false, erreur: "Aucun fichier choisi." };
  if (uniques.length > FICHIERS_PAR_LIEN_MAX) {
    return { ok: false, erreur: `${FICHIERS_PAR_LIEN_MAX} fichiers au plus par message.` };
  }
  // L6 — côté réseau d'apporteurs, seuls le kit et la présentation (D8) : une
  // consigne ou une LUT envoyée à un futur apporteur est le motif 10 de
  // l'anti-requalification.
  const permises = categoriesProposees(monde) as ReadonlyArray<string>;
  const parId = new Map(lignes.map((l) => [l.id.toLowerCase(), l]));
  const categories: string[] = [];
  for (const id of uniques) {
    const f = parId.get(id);
    if (!f) return { ok: false, erreur: "Un des fichiers choisis est introuvable." };
    if (f.archiveLe !== null) return { ok: false, erreur: "Un des fichiers choisis est archivé." };
    if (!permises.includes(f.categorie)) {
      return { ok: false, erreur: "Un des fichiers choisis ne s'envoie pas à cette personne." };
    }
    if (f.nature === "fichier") {
      if (f.etatDepot !== "disponible") {
        return { ok: false, erreur: "Un des fichiers n'a pas fini d'être déposé." };
      }
      if (f.analyse === "infecte") {
        return { ok: false, erreur: "L'antivirus a trouvé un risque dans un des fichiers." };
      }
    }
    categories.push(f.categorie);
  }
  return { ok: true, categories };
}

export type Preparation =
  | { readonly ok: true; readonly lien: LienPrepare }
  | { readonly ok: false; readonly erreur: string };

/** Vérifie les fichiers et prépare le lien. N'écrit rien. */
export async function preparerLienFichiers(
  fichierIds: ReadonlyArray<string>,
  opts: {
    maintenant?: Date;
    env?: Env;
    depotAutorise?: boolean;
    /** Le monde de la personne (L6) : décide des catégories qui se joignent. */
    monde?: "emploi" | "apporteur";
  } = {},
): Promise<Preparation> {
  const env = opts.env ?? process.env;
  if (configPartages(env) === null) {
    return { ok: false, erreur: "L'envoi de fichiers n'est pas encore activé." };
  }
  const ids = [...new Set(fichierIds.map((i) => i.toLowerCase()))];
  const lignes = (await prisma.fichierPartage.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      nature: true,
      categorie: true,
      etatDepot: true,
      analyse: true,
      archiveLe: true,
    },
  })) as FichierCandidat[];
  const monde = opts.monde ?? "emploi";
  const v = verifierFichiersJoignables(ids, lignes, monde);
  if (!v.ok) return v;

  const lienId = randomUUID();
  // 🔒 L'adresse écrite dans le message (donc en base) est MASQUÉE : le vrai
  // jeton n'est remis qu'à l'envoi, par le worker (`devoilerLienPrive`). On
  // vérifie seulement ici qu'un jeton PEUT être fabriqué.
  const adresse = adresseMasqueeLien(lienId, env);
  if (!adresse || jetonLien(lienId, env) === null) {
    return { ok: false, erreur: "L'envoi de fichiers n'est pas encore activé." };
  }
  const expireLe = expirationLien(v.categories, opts.maintenant ?? new Date());
  return {
    ok: true,
    lien: {
      lienId,
      adresse,
      expireLe,
      fichierIds: ids,
      categories: v.categories,
      // Le dépôt d'une version (L5b) n'existe que pour un candidat.
      depotAutorise: monde === "emploi" && opts.depotAutorise === true,
      paragraphe: paragrapheFichiers(adresse, expireLe, {
        depotAutorise: monde === "emploi" && opts.depotAutorise === true,
      }),
    },
  };
}

/** Le corps du message, suivi du paragraphe des fichiers. */
export function corpsAvecFichiers(corps: string, lien: LienPrepare | undefined): string {
  return lien ? `${corps.replace(/\s+$/, "")}\n\n${lien.paragraphe}` : corps;
}

/** Écrit le lien et ses fichiers DANS la transaction de la réponse. */
export async function creerLienPartage(
  tx: Pick<Prisma.TransactionClient, "lienPartage">,
  d: {
    readonly lien: LienPrepare;
    readonly reponseId: string;
    readonly auteur: { readonly userId: string | null; readonly nom: string };
  } & (
    | { readonly applicationId: string; readonly submissionId?: undefined }
    // L6 — un lien envoyé à un futur apporteur est rattaché à SA fiche.
    | { readonly submissionId: string; readonly applicationId?: undefined }
  ),
): Promise<void> {
  await tx.lienPartage.create({
    data: {
      id: d.lien.lienId,
      ...(d.applicationId !== undefined
        ? { applicationId: d.applicationId }
        : { submissionId: d.submissionId }),
      reponseId: d.reponseId,
      expireLe: d.lien.expireLe,
      depotAutorise: d.lien.depotAutorise === true,
      creeParId: d.auteur.userId,
      creeParNom: d.auteur.nom.slice(0, 200) || "Équipe",
      fichiers: { create: d.lien.fichierIds.map((fichierId) => ({ fichierId })) },
    },
    select: { id: true },
  });
}
