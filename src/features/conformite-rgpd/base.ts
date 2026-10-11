// Conformité RGPD (console) — le registre EN BASE (lot 2).
//
// Le fichier importé reste la source des champs de l'article 30 ; la base garde,
// en plus, ce qui se décide dans la console : un écart corrigé ne repasse JAMAIS à
// « ouvert » par un import. Upsert par `cle` (traitement) et par `code` (écart).
//
// ⛔ Aucune suppression : un traitement absent du fichier passe « archivé », un écart
// absent du fichier reste tel quel. Le code n'appelle aucun `delete`.

import type { PrismaClient } from "../../../prisma/generated/client";

import { prisma } from "@/lib/prisma";

import type { Destinataire, Ecart, Registre, Traitement } from "./schema";

export interface EcartBase extends Ecart {
  id: string;
  code: string;
  corrigeLe: Date | null;
  corrigeParNom: string | null;
  note: string | null;
}

/** Un traitement tel que la page le lit : `id` reste la clé du fichier (adresse de la fiche). */
export interface TraitementBase extends Omit<Traitement, "ecarts"> {
  uuid: string;
  statut: "actif" | "archive";
  ecarts: EcartBase[];
}

export type LectureBase =
  | { etat: "indisponible" }
  | {
      etat: "ok";
      traitements: TraitementBase[];
      archives: TraitementBase[];
      importeLe: Date | null;
    };

/** L'auteur d'un geste de la console. */
export interface Auteur {
  id: string;
  nom: string;
}

type Client = Pick<PrismaClient, "traitementRgpd" | "ecartRgpd" | "$transaction">;

/** Le code d'un écart : celui du fichier, sinon sa position dans l'activité (« #2 »). */
export function codeEcart(e: Pick<Ecart, "code">, index: number): string {
  return e.code ?? `#${index + 1}`;
}

/** Deux écarts d'une même activité ne peuvent pas porter le même code. */
export function verifierCodes(registre: Registre): string | null {
  for (const [i, t] of registre.traitements.entries()) {
    const vus = new Set<string>();
    for (const [j, e] of t.ecarts.entries()) {
      const code = codeEcart(e, j);
      if (code.length > 200) {
        return `Champ « traitements › n° ${i + 1} › ecarts › n° ${j + 1} › code » : 200 caractères au plus.`;
      }
      if (vus.has(code)) {
        return `Champ « traitements › n° ${i + 1} › ecarts › n° ${j + 1} › code » : code déjà utilisé dans cette activité.`;
      }
      vus.add(code);
    }
  }
  return null;
}

interface EtatEcartExistant {
  statut: "ouvert" | "corrige";
  corrigeLe: Date | null;
  corrigeParId: string | null;
  corrigeParNom: string | null;
}

/**
 * Ce qu'un import écrit sur un écart. 🔑 Un écart déjà corrigé le RESTE, avec sa
 * date et son auteur : le fichier ne peut pas défaire un geste de la console.
 */
export function fusionnerEcart(
  existant: EtatEcartExistant | null,
  fichier: Pick<Ecart, "gravite" | "constat" | "correction" | "statut">,
  auteur: Auteur,
  maintenant: Date,
) {
  const commun = {
    gravite: fichier.gravite,
    constat: fichier.constat,
    correction: fichier.correction,
  };
  if (existant?.statut === "corrige") {
    return {
      ...commun,
      statut: "corrige" as const,
      corrigeLe: existant.corrigeLe,
      corrigeParId: existant.corrigeParId,
      corrigeParNom: existant.corrigeParNom,
    };
  }
  if (fichier.statut === "corrige") {
    return {
      ...commun,
      statut: "corrige" as const,
      corrigeLe: maintenant,
      corrigeParId: auteur.id,
      corrigeParNom: auteur.nom,
    };
  }
  return {
    ...commun,
    statut: "ouvert" as const,
    corrigeLe: null,
    corrigeParId: null,
    corrigeParNom: null,
  };
}

export interface BilanImport {
  traitements: number;
  ecarts: number;
  archives: number;
}

/** Écrit un registre validé dans la base, en une transaction. */
export async function ecrireRegistreEnBase(
  registre: Registre,
  auteur: Auteur,
  maintenant: Date,
  client: Client = prisma,
): Promise<BilanImport> {
  return client.$transaction(
    async (tx) => {
      const existants = await tx.traitementRgpd.findMany({
        select: {
          id: true,
          cle: true,
          statut: true,
          ecarts: {
            select: {
              id: true,
              code: true,
              statut: true,
              corrigeLe: true,
              corrigeParId: true,
              corrigeParNom: true,
            },
          },
        },
      });
      const parCle = new Map(existants.map((t) => [t.cle, t]));
      let ecarts = 0;

      for (const [ordre, t] of registre.traitements.entries()) {
        const champs = {
          nom: t.nom,
          personnes: t.personnes,
          donnees: t.donnees,
          finalite: t.finalite,
          baseLegale: t.baseLegale,
          conservationAnnoncee: t.conservationAnnoncee,
          conservationReelle: t.conservationReelle,
          destinataires: t.destinataires,
          securite: t.securite,
          droits: t.droits,
          statut: "actif" as const,
          ordre,
          importeLe: maintenant,
        };
        const ancien = parCle.get(t.id);
        const { id: traitementId } = await tx.traitementRgpd.upsert({
          where: { cle: t.id },
          create: { cle: t.id, ...champs },
          update: champs,
          select: { id: true },
        });
        const ecartsExistants = new Map((ancien?.ecarts ?? []).map((e) => [e.code, e]));

        for (const [j, e] of t.ecarts.entries()) {
          const code = codeEcart(e, j);
          const existant = ecartsExistants.get(code) ?? null;
          const data = { ...fusionnerEcart(existant, e, auteur, maintenant), ordre: j };
          if (existant) {
            await tx.ecartRgpd.update({ where: { id: existant.id }, data });
          } else {
            await tx.ecartRgpd.create({ data: { ...data, traitementId, code } });
          }
          ecarts += 1;
        }
      }

      const presents = registre.traitements.map((t) => t.id);
      const { count: archives } = await tx.traitementRgpd.updateMany({
        where: { cle: { notIn: presents }, statut: "actif" },
        data: { statut: "archive" },
      });
      return { traitements: registre.traitements.length, ecarts, archives };
    },
    { timeout: 60_000 },
  );
}

function destinatairesDepuisJson(v: unknown): Destinataire[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((d): Destinataire[] => {
    if (typeof d !== "object" || d === null) return [];
    const o = d as Record<string, unknown>;
    if (typeof o.nom !== "string" || o.nom.trim() === "") return [];
    return [
      {
        nom: o.nom,
        pays: typeof o.pays === "string" ? o.pays : null,
        horsUE: typeof o.horsUE === "boolean" ? o.horsUE : null,
      },
    ];
  });
}

/** Lecture stub-safe : au build (`stub.invalid`), la base répond vide. */
export async function lireRegistreBase(client: Pick<Client, "traitementRgpd"> = prisma) {
  let lignes;
  try {
    lignes = await client.traitementRgpd.findMany({
      orderBy: [{ ordre: "asc" }, { nom: "asc" }],
      include: { ecarts: { orderBy: { ordre: "asc" } } },
    });
  } catch {
    return { etat: "indisponible" } satisfies LectureBase as LectureBase;
  }
  const tous: TraitementBase[] = (lignes ?? []).map((t) => ({
    uuid: t.id,
    id: t.cle,
    nom: t.nom,
    statut: t.statut,
    personnes: t.personnes,
    donnees: t.donnees,
    finalite: t.finalite,
    baseLegale: t.baseLegale,
    conservationAnnoncee: t.conservationAnnoncee,
    conservationReelle: t.conservationReelle,
    destinataires: destinatairesDepuisJson(t.destinataires),
    securite: t.securite,
    droits: t.droits,
    ecarts: t.ecarts.map((e) => ({
      id: e.id,
      code: e.code,
      gravite: e.gravite,
      constat: e.constat,
      correction: e.correction,
      statut: e.statut,
      corrigeLe: e.corrigeLe,
      corrigeParNom: e.corrigeParNom,
      note: e.note,
    })),
  }));
  const dates = (lignes ?? []).map((t) => t.importeLe.getTime());
  return {
    etat: "ok",
    traitements: tous.filter((t) => t.statut === "actif"),
    archives: tous.filter((t) => t.statut === "archive"),
    importeLe: dates.length > 0 ? new Date(Math.max(...dates)) : null,
  } satisfies LectureBase as LectureBase;
}

/** Le registre actif, sous la forme que `regles.ts` et le PDF attendent. */
export function enRegistre(traitements: ReadonlyArray<TraitementBase>): {
  misAJourLe: null;
  traitements: TraitementBase[];
} {
  return { misAJourLe: null, traitements: [...traitements] };
}
