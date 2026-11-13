/**
 * LECTURE « combien de formulaires, d'envois et de clics, par mot, réseau, publication, version et cible ? »
 * (L5-27, contrat v1).
 *
 * Corps strict : `{ "v": 1 }` (toute autre forme : 422).
 * Réponse 200 : `{ v: 1, genereLe, lignes: [{ mot, reseau, postRef, versionTexte, cible, formulaires, envois, clics }] }`
 * où chaque compteur est `{ j7, j30, total }` : fenêtres glissantes de 7 × 24 h et 30 × 24 h, bornes incluses.
 * Dates : formulaires = `occurredAt` de l'origine ; envois = `sentAt` ; clics = `firstClickAt`.
 * `cible` = le guide demandé (`guide` de l'origine). Un envoi / un clic est rattaché à la ligne de l'ORIGINE
 * LA PLUS RÉCENTE de la même personne pour le même guide : chaque demande est comptée une seule fois.
 *
 * Pas de masquage des petits effectifs (décision du propriétaire : chiffres internes, affichés « au moins N »).
 * 🔴 Des nombres seulement : la clé de personne ne sert qu'à relier en mémoire, elle ne sort jamais.
 * 🔴 FERMÉ : toute erreur de lecture, ou plus de lignes que le plafond => 500, jamais de résultat partiel.
 * 🔴 AUCUNE ÉCRITURE. Journal : un événement avec des nombres, sans donnée de personne.
 */
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { EntreeSignee } from "@/server/videos/entree";
import { reponseJson } from "@/server/videos/reponse";

/** Seau de débit PROPRE à la route des compteurs. */
export const PREFIXE_DEBIT_COMPTEURS = "internal:compteurs-guide-reseau";
/** Corps maximal accepté : 1 Ko (le corps utile tient en une dizaine d'octets). */
export const CORPS_MAX_COMPTEURS = 1024;
/** Plafond de lignes lues par table et par appel : au-delà, échec fermé plutôt qu'un total tronqué. */
export const LIGNES_MAX_COMPTEURS = 200_000;

const JOUR_MS = 86_400_000;

export const SchemaCompteurs = z.object({ v: z.literal(1) }).strict();

export interface Fenetres {
  j7: number;
  j30: number;
  total: number;
}

export interface LigneCompteur {
  readonly mot: string;
  readonly reseau: string;
  readonly postRef: string | null;
  readonly versionTexte: string | null;
  readonly cible: string;
  readonly formulaires: Fenetres;
  readonly envois: Fenetres;
  readonly clics: Fenetres;
}

export interface OrigineLue {
  mot: string;
  reseau: string;
  postRef: string | null;
  versionTexte: string | null;
  guide: string;
  emailKey: string;
  occurredAt: Date;
}

export interface DemandeLue {
  emailKey: string;
  aimant: string;
  sentAt: Date | null;
  firstClickAt: Date | null;
}

function ajouter(f: Fenetres, date: Date, maintenant: number): void {
  const t = date.getTime();
  f.total++;
  if (t > maintenant) return; // une date future ne tombe dans aucune fenêtre glissante
  if (t >= maintenant - 7 * JOUR_MS) f.j7++;
  if (t >= maintenant - 30 * JOUR_MS) f.j30++;
}

const vide = (): Fenetres => ({ j7: 0, j30: 0, total: 0 });

/** Agrège origines et demandes en lignes. Pure : aucune E/S, aucune clé de personne en sortie. */
export function agreger(
  origines: ReadonlyArray<OrigineLue>,
  demandes: ReadonlyArray<DemandeLue>,
  maintenant: Date,
): LigneCompteur[] {
  const now = maintenant.getTime();
  const lignes = new Map<
    string,
    {
      base: Omit<LigneCompteur, "formulaires" | "envois" | "clics">;
      f: Fenetres;
      e: Fenetres;
      c: Fenetres;
    }
  >();
  const cleLigne = (o: OrigineLue) =>
    JSON.stringify([o.mot, o.reseau, o.postRef, o.versionTexte, o.guide]);
  const recente = new Map<string, OrigineLue>();
  for (const o of origines) {
    const k = cleLigne(o);
    let l = lignes.get(k);
    if (!l) {
      l = {
        base: {
          mot: o.mot,
          reseau: o.reseau,
          postRef: o.postRef,
          versionTexte: o.versionTexte,
          cible: o.guide,
        },
        f: vide(),
        e: vide(),
        c: vide(),
      };
      lignes.set(k, l);
    }
    ajouter(l.f, o.occurredAt, now);
    const kp = JSON.stringify([o.emailKey, o.guide]);
    const p = recente.get(kp);
    if (!p || o.occurredAt.getTime() > p.occurredAt.getTime()) recente.set(kp, o);
  }
  for (const d of demandes) {
    const o = recente.get(JSON.stringify([d.emailKey, d.aimant]));
    if (!o) continue;
    const l = lignes.get(cleLigne(o))!;
    if (d.sentAt) ajouter(l.e, d.sentAt, now);
    if (d.firstClickAt) ajouter(l.c, d.firstClickAt, now);
  }
  const cmp = (a: string | null, b: string | null) => (a ?? "").localeCompare(b ?? "");
  return [...lignes.values()]
    .map((l) => ({ ...l.base, formulaires: l.f, envois: l.e, clics: l.c }))
    .sort(
      (a, b) =>
        a.mot.localeCompare(b.mot) ||
        a.reseau.localeCompare(b.reseau) ||
        cmp(a.postRef, b.postRef) ||
        cmp(a.versionTexte, b.versionTexte) ||
        a.cible.localeCompare(b.cible),
    );
}

export async function repondreCompteurs(e: EntreeSignee): Promise<Response> {
  let brut: unknown;
  try {
    brut = JSON.parse(e.corps.toString("utf8"));
  } catch {
    return reponseJson(422, { ok: false, erreur: "json_invalide", champs: [] });
  }
  if (!SchemaCompteurs.safeParse(brut).success) {
    return reponseJson(422, { ok: false, erreur: "schema_invalide", champs: [] });
  }
  const maintenant = new Date();
  try {
    const origines = await prisma.guideReseauOrigine.findMany({
      select: {
        mot: true,
        reseau: true,
        postRef: true,
        versionTexte: true,
        guide: true,
        emailKey: true,
        occurredAt: true,
      },
      take: LIGNES_MAX_COMPTEURS + 1,
    });
    if (origines.length > LIGNES_MAX_COMPTEURS) throw new Error("plafond_de_lignes");
    const guides = [...new Set(origines.map((o) => o.guide))];
    const demandes = guides.length
      ? await prisma.guideRequest.findMany({
          where: {
            aimant: { in: guides },
            OR: [{ sentAt: { not: null } }, { firstClickAt: { not: null } }],
          },
          select: { emailKey: true, aimant: true, sentAt: true, firstClickAt: true },
          take: LIGNES_MAX_COMPTEURS + 1,
        })
      : [];
    if (demandes.length > LIGNES_MAX_COMPTEURS) throw new Error("plafond_de_lignes");
    const lignes = agreger(origines, demandes, maintenant);
    console.warn(JSON.stringify({ event: "guides_reseau_compteurs", lignes: lignes.length }));
    return reponseJson(200, { v: 1, genereLe: maintenant.toISOString(), lignes });
  } catch (err) {
    try {
      Sentry.captureException(
        { name: err instanceof Error ? err.name : "erreur" },
        { tags: { area: "guides-reseau", action: "repondreCompteurs" } },
      );
    } catch {
      /* l'observabilité ne casse jamais la réponse */
    }
    console.error(
      "[guides-reseau] compteurs en échec :",
      err instanceof Error ? err.name : "erreur",
    );
    return reponseJson(500, { ok: false, erreur: "erreur_interne" });
  }
}
