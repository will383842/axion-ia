/**
 * E0-D — reclasser les demandes passées venues de la page devis.
 *
 * Avant #2020, la page `/demande-devis` cochait « Audit » d'office : ses demandes
 * ont été rangées `type = 'audit'` au lieu de `quote_request`. Ce module PUR
 * (aucun accès base de lui-même : la base lui est passée) décide quelles lignes
 * sont à reclasser, et écrit ce reclassement dans UNE transaction.
 *
 * Garanties :
 *  - le critère ne lit aucune donnée de personne : ni nom, ni adresse, ni message,
 *    seulement `id`, `type`, `status`, `submitted_at` et quatre chemins JSON ;
 *  - rien n'est supprimé ; `status`, `subType`, `updated_at`, l'identité, le CRM
 *    ne bougent pas ; aucun e-mail, aucune alerte, aucune synchronisation ;
 *  - relançable sans effet (une ligne déjà reclassée porte `details.reclassement`) ;
 *  - réversible (`revenir`), avec trace conservée sous `reclassementAnnule`.
 */

import { Prisma } from "../../../prisma/generated/client";

export const LOT = "E0-D-2026-11-17";
export const SOURCE_DEVIS = "/demande-devis";
export const FENETRE_A_REVOIR_MS = 24 * 60 * 60 * 1000;
export const MOTIF = "page /demande-devis cochait Audit d'office, corrigé par #2020";

export type LigneDevis = {
  id: string;
  type: string;
  status: string;
  submittedAt: Date;
  source: string | null;
  unifiedType: string | null;
  subType: string | null;
  dejaReclassee: boolean;
  missionLiee: boolean;
};

/** Sous-ensemble de PrismaClient dont on a besoin (substituable en test). */
export interface BaseReclassement {
  $queryRaw<T = unknown>(query: Prisma.Sql): Promise<T>;
  $executeRaw(query: Prisma.Sql): Promise<number>;
  $transaction<T>(
    fn: (tx: BaseReclassement) => Promise<T>,
    options?: { timeout?: number },
  ): Promise<T>;
}

export const DELAI_TRANSACTION_MS = 30_000;

/**
 * Cible de la base, SANS identifiant ni mot de passe : hôte (et port) + nom de la base.
 * Refuse une URL absente, illisible ou factice (`stub.invalid`, contrat de build ADR 0026).
 */
export function cibleBase(url: string | undefined): { hote: string; base: string } {
  if (!url) throw new ReclassementRefuse("DATABASE_URL absent : aucune base visée, refus.");
  if (url.includes("stub.invalid")) {
    throw new ReclassementRefuse("DATABASE_URL pointe la base factice (stub.invalid) : refus.");
  }
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new ReclassementRefuse("DATABASE_URL illisible : refus.");
  }
  return { hote: u.host, base: decodeURIComponent(u.pathname.replace(/^\//, "")) };
}

export class ReclassementRefuse extends Error {}

export type Classement = {
  retenues: LigneDevis[];
  aRevoirFenetre: LigneDevis[];
  aRevoirMission: LigneDevis[];
};

/** Les conditions 1, 2, 3 et 5 (indépendantes du temps), recontrôlées en TypeScript. */
function conditionsDeBase(l: LigneDevis): boolean {
  return (
    l.type === "audit" && l.unifiedType === "audit" && l.source === SOURCE_DEVIS && !l.dejaReclassee
  );
}

/** Classe les lignes. Pur : aucune lecture, aucune écriture. */
export function classer(lignes: LigneDevis[], avant: Date): Classement {
  const t = avant.getTime();
  const fin = t + FENETRE_A_REVOIR_MS;
  const out: Classement = { retenues: [], aRevoirFenetre: [], aRevoirMission: [] };
  for (const l of lignes) {
    if (!conditionsDeBase(l)) continue;
    const quand = l.submittedAt.getTime();
    if (quand >= t) {
      if (quand < fin) out.aRevoirFenetre.push(l);
      continue;
    }
    if (l.missionLiee) {
      out.aRevoirMission.push(l);
      continue;
    }
    out.retenues.push(l);
  }
  return out;
}

type LigneBrute = {
  id: string;
  type: string;
  status: string;
  submitted_at: Date;
  source: string | null;
  unified_type: string | null;
  sub_type: string | null;
  deja_reclassee: boolean;
  mission_liee: boolean;
};

/**
 * Lecture SQL brute, bornée aux lignes qui remplissent 1, 2, 3 et 5. Ne nomme
 * ni `contact_name`, ni `contact_email`, ni `details` en entier : que des chemins.
 */
export function requeteLecture(): Prisma.Sql {
  return Prisma.sql`
    SELECT s.id::text AS id,
           s.type::text AS type,
           s.status::text AS status,
           s.submitted_at AS submitted_at,
           s.details->>'source' AS source,
           s.details->>'unifiedType' AS unified_type,
           s.details->>'subType' AS sub_type,
           (s.details->'reclassement') IS NOT NULL AS deja_reclassee,
           EXISTS (SELECT 1 FROM audit_missions m WHERE m.submission_id = s.id) AS mission_liee
    FROM submissions s
    WHERE s.type = 'audit'::"SubmissionType"
      AND s.details->>'unifiedType' = 'audit'
      AND s.details->>'source' = ${SOURCE_DEVIS}
      AND (s.details->'reclassement') IS NULL
    ORDER BY s.submitted_at ASC`;
}

export async function lireLignes(db: BaseReclassement): Promise<LigneDevis[]> {
  const brutes = await db.$queryRaw<LigneBrute[]>(requeteLecture());
  return brutes.map((b) => ({
    id: b.id,
    type: b.type,
    status: b.status,
    submittedAt: new Date(b.submitted_at),
    source: b.source,
    unifiedType: b.unified_type,
    subType: b.sub_type,
    dejaReclassee: b.deja_reclassee,
    missionLiee: b.mission_liee,
  }));
}

function repartir(lignes: LigneDevis[], cle: (l: LigneDevis) => string): Record<string, number> {
  const r: Record<string, number> = {};
  for (const l of lignes) r[cle(l)] = (r[cle(l)] ?? 0) + 1;
  return r;
}

export type RapportLecture = {
  total: number;
  parMois: Record<string, number>;
  parStatut: Record<string, number>;
  parSousType: Record<string, number>;
  aRevoirFenetre: string[];
  aRevoirMission: string[];
  identifiants: string[];
};

/** Mode `--lire` : aucune écriture. Ne rend jamais de nom, d'adresse, de téléphone ni de message. */
export async function lire(db: BaseReclassement, avant: Date): Promise<RapportLecture> {
  const c = classer(await lireLignes(db), avant);
  return {
    total: c.retenues.length,
    parMois: repartir(c.retenues, (l) => l.submittedAt.toISOString().slice(0, 7)),
    parStatut: repartir(c.retenues, (l) => l.status),
    parSousType: repartir(c.retenues, (l) => l.subType ?? "(aucun)"),
    aRevoirFenetre: c.aRevoirFenetre.map((l) => l.id),
    aRevoirMission: c.aRevoirMission.map((l) => l.id),
    identifiants: c.retenues.map((l) => l.id),
  };
}

export type OptionsAppliquer = { avant: Date; attendu: number; maintenant?: Date };

/** Mode `--appliquer` : une transaction ; tout écart de comptage la fait échouer (retour arrière). */
export async function appliquer(
  db: BaseReclassement,
  options: OptionsAppliquer,
): Promise<{ modifiees: number; identifiants: string[]; le: string }> {
  const { avant, attendu } = options;
  if (!(avant instanceof Date) || Number.isNaN(avant.getTime())) {
    throw new ReclassementRefuse("--avant=<ISO> obligatoire et valide.");
  }
  if (!Number.isInteger(attendu) || attendu < 0) {
    throw new ReclassementRefuse("--attendu=<N> obligatoire (entier positif ou nul).");
  }
  const le = (options.maintenant ?? new Date()).toISOString();
  const trace = JSON.stringify({
    lot: LOT,
    le,
    ancienType: "audit",
    ancienUnifiedType: "audit",
    motif: MOTIF,
  });
  return db.$transaction(
    async (tx) => {
      const { retenues } = classer(await lireLignes(tx), avant);
      if (retenues.length !== attendu) {
        throw new ReclassementRefuse(
          `Comptage ${retenues.length} différent de --attendu=${attendu} : retour arrière, rien écrit.`,
        );
      }
      if (retenues.length === 0) return { modifiees: 0, identifiants: [], le };
      const ids = retenues.map((l) => l.id);
      // Conditions 1, 2, 3 et 5 RELUES dans l'UPDATE, plus l'absence de mission.
      // `updated_at` n'est pas touché : pas d'effet sur les tris de la console.
      const modifiees = await tx.$executeRaw(Prisma.sql`
      UPDATE submissions
      SET type = 'quote_request'::"SubmissionType",
          details = jsonb_set(details, '{unifiedType}', '"devis"'::jsonb)
                    || jsonb_build_object('reclassement', ${trace}::jsonb)
      WHERE id = ANY(${ids}::uuid[])
        AND type = 'audit'::"SubmissionType"
        AND details->>'unifiedType' = 'audit'
        AND details->>'source' = ${SOURCE_DEVIS}
        AND (details->'reclassement') IS NULL
        AND NOT EXISTS (SELECT 1 FROM audit_missions m WHERE m.submission_id = submissions.id)`);
      if (modifiees !== attendu) {
        throw new ReclassementRefuse(
          `${modifiees} ligne(s) modifiée(s) pour ${attendu} attendue(s) : retour arrière.`,
        );
      }
      return { modifiees, identifiants: ids, le };
    },
    { timeout: DELAI_TRANSACTION_MS },
  );
}

/**
 * Mode `--revenir` : restitue d'après `details.reclassement`. Ne touche qu'une ligne
 * ENCORE telle que le reclassement l'a laissée (`quote_request` + `devis`) : une ligne
 * retypée depuis par un administrateur n'est pas écrasée. L'historique des
 * annulations est conservé dans le tableau `reclassementsAnnules`. `attendu`
 * (facultatif) : si le nombre de lignes touchées diffère, retour arrière.
 */
export async function revenir(
  db: BaseReclassement,
  lot: string,
  attendu?: number,
): Promise<{ restituees: number }> {
  if (!lot) throw new ReclassementRefuse("--lot=<id> obligatoire.");
  if (attendu !== undefined && (!Number.isInteger(attendu) || attendu < 0)) {
    throw new ReclassementRefuse("--attendu=<N> doit être un entier positif ou nul.");
  }
  return db.$transaction(
    async (tx) => {
      const restituees = await tx.$executeRaw(Prisma.sql`
      UPDATE submissions
      SET type = (details->'reclassement'->>'ancienType')::"SubmissionType",
          details = (
            jsonb_set(
              details,
              '{unifiedType}',
              to_jsonb(details->'reclassement'->>'ancienUnifiedType')
            ) - 'reclassement' - 'reclassementAnnule'
          ) || jsonb_build_object(
            'reclassementsAnnules',
            COALESCE(details->'reclassementsAnnules', '[]'::jsonb)
              || CASE WHEN details->'reclassementAnnule' IS NULL THEN '[]'::jsonb
                      ELSE jsonb_build_array(details->'reclassementAnnule') END
              || jsonb_build_array(details->'reclassement')
          )
      WHERE details->'reclassement'->>'lot' = ${lot}
        AND type = 'quote_request'::"SubmissionType"
        AND details->>'unifiedType' = 'devis'`);
      if (attendu !== undefined && restituees !== attendu) {
        throw new ReclassementRefuse(
          `${restituees} ligne(s) à restituer pour ${attendu} attendue(s) : retour arrière, rien écrit.`,
        );
      }
      return { restituees };
    },
    { timeout: DELAI_TRANSACTION_MS },
  );
}

export type Commande =
  | { mode: "lire"; avant: Date }
  | { mode: "appliquer"; avant: Date; attendu: number }
  | { mode: "revenir"; lot: string; attendu?: number };

/** Lit les arguments. `--lire` par défaut, mais `--avant` est exigé (aucun défaut) ; `--attendu` aussi pour appliquer. */
export function lireArguments(argv: string[]): Commande {
  const valeur = (nom: string): string | undefined => {
    const a = argv.find((x) => x.startsWith(`${nom}=`));
    return a ? a.slice(nom.length + 1) : undefined;
  };
  const modes = ["--lire", "--appliquer", "--revenir"].filter((m) => argv.includes(m));
  if (modes.length > 1) throw new ReclassementRefuse("Un seul mode à la fois.");
  const mode = modes[0] ?? "--lire";
  const avantBrut = valeur("--avant");
  let avant: Date | null = null;
  if (avantBrut !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}T/.test(avantBrut) || !/(Z|[+-]\d{2}:\d{2})$/.test(avantBrut)) {
      throw new ReclassementRefuse(
        "--avant doit être une date ISO complète avec fuseau (Z ou ±HH:MM).",
      );
    }
    avant = new Date(avantBrut);
    if (Number.isNaN(avant.getTime())) throw new ReclassementRefuse("--avant illisible.");
  }
  const attenduBrut = valeur("--attendu");
  if (mode === "--lire") {
    if (!avant) throw new ReclassementRefuse("--lire exige --avant=<ISO avec fuseau>.");
    return { mode: "lire", avant };
  }
  if (mode === "--revenir") {
    const lot = valeur("--lot");
    if (!lot) throw new ReclassementRefuse("--revenir exige --lot=<id>.");
    if (attenduBrut !== undefined && !/^\d+$/.test(attenduBrut)) {
      throw new ReclassementRefuse("--attendu doit être un entier positif ou nul.");
    }
    return {
      mode: "revenir",
      lot,
      ...(attenduBrut !== undefined ? { attendu: Number(attenduBrut) } : {}),
    };
  }
  if (!avant) throw new ReclassementRefuse("--appliquer exige --avant=<ISO>.");
  if (attenduBrut === undefined || !/^\d+$/.test(attenduBrut)) {
    throw new ReclassementRefuse("--appliquer exige --attendu=<N>.");
  }
  return { mode: "appliquer", avant, attendu: Number(attenduBrut) };
}
