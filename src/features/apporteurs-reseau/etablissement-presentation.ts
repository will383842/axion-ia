// Réseau d'apporteurs — contrat 2.6 (décision de Will, 09/10/2026) : l'attribution porte sur
// l'ÉTABLISSEMENT déclaré (SIRET). L'apporteur n'est commissionné que sur les commandes de cet
// établissement ; Williams peut, à sa seule discrétion, étendre l'attribution à toute l'entreprise
// (SIREN), sauf les établissements déjà attribués à d'autres ou déjà connus (art. 3.1 et 3.3).
//
// Relecture de a1 (09/10) : une commande dont l'établissement ne correspond à AUCUNE attribution
// exacte n'est jamais perdue en silence — elle passe « à attribuer » et attend le choix de
// Williams (`commande_a_attribuer`). Le SIRET de l'établissement qui commande vient du DEVIS
// (`devis_etablissement`), sinon de la fiche client — jamais du payeur (REQ-ARG-005).
//
// Tables séparées, tolérantes à leur absence (fenêtre app/worker). Une présentation SANS ligne est
// d'avant la 2.6 : elle couvre toute l'entreprise, comme avant.
//
// ⚠️ Atteint par le WORKER (passage horaire) : aucun `server-only`.

import { prisma } from "@/lib/prisma";
import { luhnValid } from "@/lib/siret";

import { ajouterMois } from "./regles";

export interface Etablissement {
  /** SIRET déclaré ; `null` = présentation d'avant la 2.6 (toute l'entreprise). */
  siret: string | null;
  /** Toute l'entreprise : étendue par Williams, ou apporteur signé avant la 2.6 (art. 13). */
  entreprise: boolean;
  /** Établissements exclus de l'extension (déjà connus de la Société, art. 3.3). */
  exclus: readonly string[];
  /** Étendue par Williams (sinon, `entreprise` vient d'un contrat signé avant la 2.6). */
  etendue?: boolean;
}

export const AVANT_2_6: Etablissement = { siret: null, entreprise: false, exclus: [] };

/** Le SIRET est-il valable (14 chiffres, clé de Luhn) ? Le SIREN est ses 9 premiers chiffres. */
export function siretValide(s: string): boolean {
  return /^\d{14}$/.test(s) && luhnValid(s);
}

/** Les chiffres d'un SIRET valable, sinon `null`. */
export function siretNet(v: string | null | undefined): string | null {
  const n = (v ?? "").replace(/\s+/g, "");
  return /^\d{14}$/.test(n) ? n : null;
}

/** La présentation couvre-t-elle tous les établissements de l'entreprise ? */
export function couvreToutLEntreprise(e: Etablissement): boolean {
  return e.siret === null || e.entreprise;
}

/**
 * Deux présentations du MÊME SIREN se disputent-elles le même périmètre ? Oui si l'une couvre
 * toute l'entreprise, ou si elles portent le même SIRET. Deux établissements différents : non.
 */
export function memePerimetre(a: Etablissement, b: Etablissement): boolean {
  return couvreToutLEntreprise(a) || couvreToutLEntreprise(b) || a.siret === b.siret;
}

/**
 * SOURCE UNIQUE du SIRET de l'établissement qui COMMANDE (facture et annonce « commande signée ») :
 * celui porté par le devis, sinon celui de la fiche client. Jamais le payeur (REQ-ARG-005).
 */
export function siretDeLaCommande(e: {
  devisSiret?: string | null;
  clientSiret?: string | null;
}): string | null {
  return siretNet(e.devisSiret) ?? siretNet(e.clientSiret);
}

export interface Candidate {
  recueAt: Date;
  etablissement: Etablissement;
}

/**
 * Parmi les présentations qui couvrent une commande à sa date (`couvrantes`, déjà filtrées), celle
 * à qui revient la commande de l'établissement `siret` :
 *   · celle qui porte CE SIRET (la plus ancienne) — un établissement attribué reste à son apporteur
 *     même si un autre a reçu l'extension à toute l'entreprise ;
 *   · sinon celle qui couvre toute l'entreprise sans exclure cet établissement (la plus ancienne) ;
 *   · sinon, s'il existe une présentation sur ce SIREN : « à attribuer » (choix de Williams) —
 *     jamais « pas de commission » en silence ;
 *   · aucune présentation : `null`.
 */
export function attributaireDeLaCommande<T extends Candidate>(
  couvrantes: readonly T[],
  siret: string | null,
): { presentation: T } | { aAttribuer: true; candidats: T[] } | null {
  const parAnciennete = [...couvrantes].sort((a, b) => a.recueAt.getTime() - b.recueAt.getTime());
  if (siret) {
    const exacte = parAnciennete.find((p) => p.etablissement.siret === siret);
    if (exacte) return { presentation: exacte };
  }
  const toute = parAnciennete.find(
    (p) =>
      couvreToutLEntreprise(p.etablissement) &&
      !(siret && p.etablissement.exclus.includes(siret)) &&
      // Une attribution d'avant la 2.6 (ou d'un contrat signé avant) couvre tout. Une EXTENSION
      // ne couvre jamais d'elle-même une commande sans SIRET (relecture de a1) : on ne sait pas
      // quel établissement commande, ni s'il était déjà connu — elle passe « à attribuer ».
      !(siret === null && p.etablissement.etendue),
  );
  if (toute) return { presentation: toute };
  if (parAnciennete.length > 0) return { aAttribuer: true, candidats: parAnciennete };
  return null;
}

function tableAbsente(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2021";
}

/** Les établissements des présentations ; une présentation absente de la table : `AVANT_2_6`. */
export async function lireEtablissements(
  ids: readonly string[],
): Promise<Map<string, Etablissement>> {
  const m = new Map<string, Etablissement>(ids.map((id) => [id, AVANT_2_6] as const));
  if (ids.length === 0) return m;
  try {
    const ls = await prisma.presentationEtablissement.findMany({
      where: { presentationId: { in: [...ids] } },
      select: {
        presentationId: true,
        siret: true,
        entreprise: true,
        exclus: true,
        etendueAt: true,
      },
    });
    for (const l of ls)
      m.set(l.presentationId, {
        siret: l.siret,
        entreprise: l.entreprise,
        exclus: l.exclus,
        etendue: l.etendueAt !== null,
      });
  } catch (err) {
    if (!tableAbsente(err)) throw err;
  }
  return m;
}

/** Le SIRET porté par chaque devis (s'il y en a un). */
export async function lireSiretsDevis(ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  try {
    const ls = await prisma.devisEtablissement.findMany({
      where: { devisId: { in: [...ids] } },
      select: { devisId: true, siret: true },
    });
    return new Map(ls.map((l) => [l.devisId, l.siret] as const));
  } catch (err) {
    if (tableAbsente(err)) return new Map();
    throw err;
  }
}

/** Le contrat signé est-il antérieur à la 2.6 (il garde alors toute l'entreprise, art. 13) ? */
export function signeAvant26(signature: unknown): boolean {
  const v = (signature as { version?: unknown } | null)?.version;
  return typeof v === "string" && Number(v) > 0 && Number(v) < 2.6;
}

/** Écrit le SIRET d'une présentation, DANS la transaction qui la crée (`db`). */
export async function enregistrerEtablissement(
  presentationId: string,
  siret: string,
  entreprise: boolean,
  db: Pick<typeof prisma, "presentationEtablissement"> = prisma,
): Promise<void> {
  await db.presentationEtablissement.create({ data: { presentationId, siret, entreprise } });
}

const STATUTS_FACTURE_EMISE = ["emise", "partiellement_payee", "en_retard", "payee"] as const;

/** Libellé d'une fiche client connue sans SIRET (jamais un vrai SIRET : jamais stocké dans `exclus`). */
export const FICHE_SANS_SIRET = "fiche sans SIRET";

export interface Exclusion {
  siret: string;
  raison: string;
}

/**
 * Les établissements que l'extension à toute l'entreprise N'EMPORTE PAS (art. 3.3 jugé
 * établissement par établissement) : ceux d'une fiche client déjà connue (facture de moins de 24
 * mois, devis de moins de 6 mois, devis signé non entièrement facturé), et ceux déjà attribués à
 * un AUTRE apporteur (qui restent les leurs).
 */
export async function exclusionsDeLExtension(
  presentationId: string,
  maintenant: Date = new Date(),
): Promise<{ siren: string; exclusions: Exclusion[] } | null> {
  const p = await prisma.presentationEntreprise.findUnique({
    where: { id: presentationId },
    select: { siren: true, apporteurId: true },
  });
  if (!p) return null;
  const exclusions = new Map<string, string>();
  // Toutes les fiches du SIREN, AVEC ou SANS SIRET (relecture de a1) : une fiche sans SIRET déjà
  // connue est signalée ; ses commandes sans SIRET passent « à attribuer » (jamais automatiques).
  const clients = await prisma.client.findMany({
    where: { siren: p.siren },
    select: { id: true, siret: true },
  });
  for (const c of clients) {
    const siret = siretNet(c.siret) ?? FICHE_SANS_SIRET;
    const [factures, devisRecents, devisSignes] = await Promise.all([
      prisma.factureFormation.count({
        where: {
          clientId: c.id,
          avoirDeId: null,
          statut: { in: [...STATUTS_FACTURE_EMISE] },
          emiseAt: { gte: ajouterMois(maintenant, -24) },
        },
      }),
      prisma.devis.count({
        where: {
          clientId: c.id,
          statut: { not: "brouillon" },
          OR: [
            { sentAt: { gte: ajouterMois(maintenant, -6) } },
            { sentAt: null, createdAt: { gte: ajouterMois(maintenant, -6) } },
          ],
        },
      }),
      prisma.devis.findMany({
        where: { clientId: c.id, acceptedAt: { not: null } },
        select: {
          montantTotalHtCents: true,
          facturesFormation: {
            where: { avoirDeId: null, statut: { notIn: ["brouillon", "annulee"] } },
            select: { montantHtCents: true },
          },
        },
      }),
    ]);
    const nonFacture = devisSignes.some(
      (d) => d.facturesFormation.reduce((s, f) => s + f.montantHtCents, 0) < d.montantTotalHtCents,
    );
    if (factures > 0) exclusions.set(siret, "déjà client (facture de moins de 24 mois)");
    else if (devisRecents > 0) exclusions.set(siret, "devis de moins de 6 mois");
    else if (nonFacture) exclusions.set(siret, "devis signé non entièrement facturé");
  }
  const autres = await prisma.presentationEntreprise.findMany({
    where: {
      siren: p.siren,
      apporteurId: { not: p.apporteurId },
      statut: { in: ["reservee", "confirmee"] },
    },
    select: { id: true },
  });
  for (const [, e] of await lireEtablissements(autres.map((a) => a.id)))
    if (e.siret && !exclusions.has(e.siret))
      exclusions.set(e.siret, "attribué à un autre apporteur");
  return {
    siren: p.siren,
    exclusions: [...exclusions].map(([siret, raison]) => ({ siret, raison })),
  };
}

/**
 * Williams étend l'attribution à toute l'entreprise (art. 3.1, à sa seule discrétion), SAUF les
 * établissements exclus (`exclusionsDeLExtension`), figés au moment de l'extension. L'écriture et
 * sa trace sont dans la MÊME transaction : sans trace, pas d'extension.
 */
export async function etendreALEntreprise(
  presentationId: string,
  acteurId: string | null,
  maintenant: Date = new Date(),
): Promise<{ ok: true; exclusions: Exclusion[] } | { ok: false; message: string }> {
  const p = await prisma.presentationEntreprise.findUnique({
    where: { id: presentationId },
    select: { id: true, statut: true },
  });
  if (!p) return { ok: false, message: "Présentation introuvable." };
  if (p.statut !== "reservee" && p.statut !== "confirmee")
    return { ok: false, message: "Seule une attribution en cours peut être étendue." };
  const e = (await lireEtablissements([p.id])).get(p.id) ?? AVANT_2_6;
  if (couvreToutLEntreprise(e))
    return { ok: false, message: "Cette attribution couvre déjà toute l'entreprise." };
  const x = await exclusionsDeLExtension(presentationId, maintenant);
  const exclusions = (x?.exclusions ?? []).filter((z) => z.siret !== e.siret);
  const fait = await prisma.$transaction(async (tx) => {
    const u = await tx.presentationEtablissement.updateMany({
      where: { presentationId, entreprise: false },
      data: {
        entreprise: true,
        etendueAt: maintenant,
        exclus: exclusions.map((z) => z.siret).filter((x) => siretNet(x) !== null),
      },
    });
    if (u.count !== 1) return false;
    await tx.activityLog.create({
      data: {
        adminUserId: acteurId,
        action: "presentation_entreprise.etendue_a_l_entreprise",
        targetType: "presentation_entreprise",
        targetId: presentationId,
        changes: {
          siret: e.siret,
          exclus: exclusions,
          motif: "Art. 3.1 : extension à toute l'entreprise",
        } as object,
      },
    });
    return true;
  });
  if (!fait) return { ok: false, message: "L'attribution a changé : rechargez la page." };
  return { ok: true, exclusions };
}

// ── Commandes à attribuer (choix de Williams) ───────────────────────────

export interface DecisionAttribution {
  presentationId: string | null;
  aucune: boolean;
  decidee: boolean;
}

export async function lireDecisionsAAttribuer(
  factureIds: readonly string[],
): Promise<Map<string, DecisionAttribution>> {
  if (factureIds.length === 0) return new Map();
  try {
    const ls = await prisma.commandeAAttribuer.findMany({
      where: { factureId: { in: [...factureIds] } },
      select: { factureId: true, presentationId: true, aucune: true, decideeAt: true },
    });
    return new Map(
      ls.map((l) => [
        l.factureId,
        { presentationId: l.presentationId, aucune: l.aucune, decidee: l.decideeAt !== null },
      ]),
    );
  } catch (err) {
    if (tableAbsente(err)) return new Map();
    throw err;
  }
}

/** Ouvre la commande « à attribuer » (une seule fois). Rend `true` si elle vient d'être ouverte. */
export async function ouvrirAAttribuer(e: {
  factureId: string;
  siren: string;
  siret: string | null;
  candidats: readonly string[];
}): Promise<boolean> {
  try {
    const r = await prisma.commandeAAttribuer.createMany({
      data: [
        {
          factureId: e.factureId,
          siren: e.siren,
          siret: e.siret,
          candidats: [...e.candidats],
        },
      ],
      skipDuplicates: true,
    });
    return r.count === 1;
  } catch (err) {
    if (tableAbsente(err)) return false;
    throw err;
  }
}

/**
 * Williams attribue la commande à l'une des présentations candidates, ou à aucune. Écriture
 * conditionnelle (une seule décision) et trace dans la même transaction.
 */
export const MOTIF_MIN = 10;

export async function deciderAttribution(
  factureId: string,
  presentationId: string | null,
  acteurId: string | null,
  maintenant: Date = new Date(),
  motifBrut = "",
): Promise<{ ok: true; ecartes: string[]; motif: string } | { ok: false; message: string }> {
  const motif = motifBrut.trim().slice(0, 1000);
  // Art. 3.1 (relecture de a1) : « aucune attribution » est motivée et notifiée.
  if (presentationId === null && motif.length < MOTIF_MIN)
    return { ok: false, message: "Motivez la décision « aucun apporteur » (art. 3.1)." };
  const l = await prisma.commandeAAttribuer.findUnique({
    where: { factureId },
    select: { candidats: true, decideeAt: true },
  });
  if (!l) return { ok: false, message: "Commande introuvable." };
  if (l.decideeAt) return { ok: false, message: "Cette commande est déjà attribuée." };
  if (presentationId !== null && !l.candidats.includes(presentationId))
    return { ok: false, message: "Cette attribution n'est pas candidate pour cette commande." };
  const fait = await prisma.$transaction(async (tx) => {
    const u = await tx.commandeAAttribuer.updateMany({
      where: { factureId, decideeAt: null },
      data: {
        presentationId,
        aucune: presentationId === null,
        decideeAt: maintenant,
        decideePar: acteurId,
      },
    });
    if (u.count !== 1) return false;
    await tx.activityLog.create({
      data: {
        adminUserId: acteurId,
        action: "commande.attribuee_a_la_main",
        targetType: "facture_formation",
        targetId: factureId,
        changes: { presentationId, aucune: presentationId === null, motif } as object,
      },
    });
    return true;
  });
  if (!fait) return { ok: false, message: "La commande a changé : rechargez la page." };
  return { ok: true, ecartes: l.candidats.filter((c) => c !== presentationId), motif };
}

/** Délai de rattachement manuel (contrat 2.6, art. 3.1) et relance interne. */
export const DELAI_ATTRIBUTION_JOURS = 15;
export const RELANCE_ATTRIBUTION_JOURS = 10;

/** La relance due pour une commande à attribuer ouverte le `creeAt` : J+15, sinon J+10, ou rien. */
export function relanceAttributionDue(creeAt: Date, maintenant: Date): 10 | 15 | null {
  const jours = (maintenant.getTime() - creeAt.getTime()) / 86_400_000;
  if (jours >= DELAI_ATTRIBUTION_JOURS) return 15;
  if (jours >= RELANCE_ATTRIBUTION_JOURS) return 10;
  return null;
}

/** Les commandes encore à attribuer (passage : relances J+10 et J+15). */
export async function lireAAttribuerEnAttente(): Promise<
  Array<{ factureId: string; siren: string; creeAt: Date }>
> {
  try {
    return await prisma.commandeAAttribuer.findMany({
      where: { decideeAt: null },
      select: { factureId: true, siren: true, creeAt: true },
      take: 500,
    });
  } catch (err) {
    if (tableAbsente(err)) return [];
    throw err;
  }
}
