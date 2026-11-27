/**
 * Relevé mensuel des apporteurs : statistiques et lecture des écrans de la console (lot 3e, 4b').
 *
 * LECTURE SEULE : aucune écriture, aucun e-mail. Sans `server-only` (testé en pur). Les montants
 * sont des centimes entiers. Les fonctions pures (série de 12 mois, hauteurs, anomalies) sont
 * séparées des lectures Prisma pour se tester sans base.
 */
import { prisma } from "@/lib/prisma";
import { bornesPeriode, moisPrecedent, periodePrecedente } from "./periode";
import type { StatutReleveMensuel } from "../../../../prisma/generated/client";

export type StatutReleveEcran = StatutReleveMensuel;
export type SourceChiffres = "releves" | "direct" | "aucune";

export interface TotauxPeriode {
  nbReleves: number;
  nbLignes: number;
  facturesHtCents: number;
  avoirsHtCents: number;
  viresTtcCents: number;
  enAttenteHtCents: number;
  cumulAnneeHtCents: number;
}

export interface PointMois {
  periode: string;
  source: SourceChiffres;
  facturesHtCents: number;
  avoirsHtCents: number;
  /** `null` : mois non préparé, le TTC viré n'est lu que sur les relevés. */
  viresTtcCents: number | null;
}

export interface CartesStatistiques {
  periode: string;
  apporteursSignes: number;
  /** `null` : période non préparée. */
  avecMouvement: number | null;
  facturesHtCents: number;
  viresTtcCents: number | null;
  enAttenteHtCents: number | null;
  cumulAnneeHtCents: number | null;
  source: SourceChiffres;
}

export interface LignePeriode {
  periode: string;
  prepares: number;
  envoyes: number;
  echecs: number;
  ecartes: number;
}

export interface VueStatistiques {
  cartes: CartesStatistiques;
  serie: PointMois[];
  periodes: LignePeriode[];
}

export interface ReleveEcran {
  id: string;
  numero: string;
  apporteurId: string;
  apporteurNom: string;
  rang: number;
  statut: StatutReleveEcran;
  nbLignes: number;
  facturesHtCents: number;
  avoirsHtCents: number;
  /** TVA et TTC NETS du mois, LUS dans `contenu.totaux` (jamais recalculés) ; 0 si illisibles. */
  tvaCents: number;
  ttcCents: number;
  viresTtcCents: number;
  enAttenteHtCents: number;
  cumulAnneeHtCents: number;
  empreinteCourte: string;
  pdfDisponible: boolean;
  emailPresent: boolean;
  erreur: string | null;
  motifEcart: string | null;
  envoyeAt: Date | null;
}

export interface AnomalieEcran {
  code: "completude" | "email_absent" | "pdf_absent" | "donnees_modifiees" | "echec_envoi";
  detail: string;
}

/** Apporteur attendu dans la période (cibles de la préparation : signés avant la coupure + Q4 b). */
export interface CibleReleve {
  apporteurId: string;
  nom: string;
}

export interface VuePeriode {
  cibles: CibleReleve[];
  releves: ReleveEcran[];
}

export interface ReleveDeFiche {
  id: string;
  numero: string;
  periode: string;
  rang: number;
  statut: StatutReleveEcran;
  envoyeAt: Date | null;
  empreinteCourte: string;
  pdfDisponible: boolean;
  /** Statut de l'`EmailLog` du `jobId` du relevé ; `null` : pas (encore) de ligne de journal. */
  statutEmail: string | null;
  erreur: string | null;
}

export const PREFIXE_ERREUR_DONNEES_MODIFIEES = "données du mois modifiées";

// ── Fonctions pures ──────────────────────────────────────────────────────────────────────────

/** TVA et TTC lus tels quels dans le contenu figé ; entiers ou 0. Aucun calcul. */
export function totauxTvaDeContenu(contenu: unknown): { tvaCents: number; ttcCents: number } {
  const t = (contenu as { totaux?: { tvaCents?: unknown; ttcCents?: unknown } } | null)?.totaux;
  const lire = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : 0);
  return { tvaCents: lire(t?.tvaCents), ttcCents: lire(t?.ttcCents) };
}

/** Les 12 mois finissant à `derniere` (comprise), le plus ancien d'abord. */
export function periodesDouzeMois(derniere: string): string[] {
  const liste: string[] = [derniere];
  for (let i = 1; i < 12; i++) liste.unshift(periodePrecedente(liste[0]!));
  return liste;
}

/** Mois préparé : colonnes dénormalisées ; sinon calcul direct ; sinon « aucune ». */
export function construireSerie(
  periodes: readonly string[],
  deReleves: ReadonlyMap<string, TotauxPeriode>,
  direct: ReadonlyMap<string, { facturesHtCents: number; avoirsHtCents: number }>,
): PointMois[] {
  return periodes.map((periode) => {
    const r = deReleves.get(periode);
    if (r) {
      return {
        periode,
        source: "releves",
        facturesHtCents: r.facturesHtCents,
        avoirsHtCents: r.avoirsHtCents,
        viresTtcCents: r.viresTtcCents,
      };
    }
    const dd = direct.get(periode);
    if (dd) {
      return {
        periode,
        source: "direct",
        facturesHtCents: dd.facturesHtCents,
        avoirsHtCents: dd.avoirsHtCents,
        viresTtcCents: null,
      };
    }
    return { periode, source: "aucune", facturesHtCents: 0, avoirsHtCents: 0, viresTtcCents: null };
  });
}

/** Hauteur de barre en % de la plus grande valeur (0 si tout est nul). */
export function hauteursEnPourcent(valeurs: readonly number[]): number[] {
  const max = Math.max(0, ...valeurs);
  return valeurs.map((v) => (max === 0 ? 0 : Math.round((v / max) * 100)));
}

/** Anomalies BLOQUANTES de la vérification avant envoi (complétude, e-mail, PDF, données, échec). */
export function anomaliesDePeriode(e: {
  cibles: readonly CibleReleve[];
  releves: readonly ReleveEcran[];
}): AnomalieEcran[] {
  const anomalies: AnomalieEcran[] = [];
  // Complétude par ENSEMBLES d'apporteurId (jamais par comptage : un résilié préparé ne doit pas
  // masquer un signé manquant) : une anomalie par apporteur cible sans relevé d'origine (rang 0).
  const avecReleve = new Set(e.releves.filter((r) => r.rang === 0).map((r) => r.apporteurId));
  for (const c of e.cibles) {
    if (!avecReleve.has(c.apporteurId)) {
      anomalies.push({
        code: "completude",
        detail: `${c.nom} : aucun relevé préparé pour la période.`,
      });
    }
  }
  for (const r of e.releves) {
    if (r.statut === "ecarte") continue;
    if (!r.emailPresent) {
      anomalies.push({ code: "email_absent", detail: `${r.numero} : aucune adresse e-mail.` });
    }
    if (!r.pdfDisponible) {
      anomalies.push({ code: "pdf_absent", detail: `${r.numero} : PDF non stocké.` });
    }
    if (r.erreur?.startsWith(PREFIXE_ERREUR_DONNEES_MODIFIEES)) {
      anomalies.push({ code: "donnees_modifiees", detail: `${r.numero} : ${r.erreur}.` });
    } else if (r.statut === "echec") {
      anomalies.push({
        code: "echec_envoi",
        detail: `${r.numero} : échec de l'envoi${r.erreur ? ` (${r.erreur})` : ""}.`,
      });
    }
  }
  return anomalies;
}

// ── Lectures Prisma (lecture seule) ──────────────────────────────────────────────────────────

const ZERO = { nbReleves: 0, nbLignes: 0 } as const;

export async function lireVueStatistiques(maintenant: Date = new Date()): Promise<VueStatistiques> {
  const derniere = moisPrecedent(maintenant);
  const periodes = periodesDouzeMois(derniere);

  const [sommes, parStatut, signes] = await Promise.all([
    prisma.releveMensuelApporteur.groupBy({
      by: ["periode"],
      where: { periode: { in: periodes }, rang: 0, statut: { not: "ecarte" } },
      _count: { _all: true },
      _sum: {
        nbLignes: true,
        facturesHtCents: true,
        avoirsHtCents: true,
        viresTtcCents: true,
        enAttenteHtCents: true,
        cumulAnneeHtCents: true,
      },
    }),
    prisma.releveMensuelApporteur.groupBy({
      by: ["periode", "statut"],
      where: { rang: 0 },
      _count: { _all: true },
      orderBy: { periode: "desc" },
    }),
    prisma.apporteurReseau.count({ where: { statut: "signe" } }),
  ]);

  const deReleves = new Map<string, TotauxPeriode>();
  for (const s of sommes) {
    deReleves.set(s.periode, {
      ...ZERO,
      nbReleves: s._count._all,
      nbLignes: s._sum.nbLignes ?? 0,
      facturesHtCents: s._sum.facturesHtCents ?? 0,
      avoirsHtCents: s._sum.avoirsHtCents ?? 0,
      viresTtcCents: s._sum.viresTtcCents ?? 0,
      enAttenteHtCents: s._sum.enAttenteHtCents ?? 0,
      cumulAnneeHtCents: s._sum.cumulAnneeHtCents ?? 0,
    });
  }

  // Mois non préparés : calcul direct, INDICATIF (date d'émission de l'autofacture, HT).
  const direct = new Map<string, { facturesHtCents: number; avoirsHtCents: number }>();
  await Promise.all(
    periodes
      .filter((p) => !deReleves.has(p))
      .map(async (p) => {
        const { debut, coupure } = bornesPeriode(p);
        const [f, a] = await Promise.all([
          prisma.commissionApporteur.aggregate({
            _sum: { montantCents: true },
            where: {
              autofactureNumero: { not: null },
              avoirNumero: null,
              statut: { not: "annulee" },
              autofactureEmiseAt: { gte: debut, lt: coupure },
            },
          }),
          prisma.pieceAutofactureApporteur.aggregate({
            _sum: { totalHtCents: true },
            where: { genre: "avoir", emiseAt: { gte: debut, lt: coupure } },
          }),
        ]);
        const facturesHtCents = f._sum.montantCents ?? 0;
        const avoirsHtCents = Math.abs(a._sum.totalHtCents ?? 0);
        if (facturesHtCents > 0 || avoirsHtCents > 0) {
          direct.set(p, { facturesHtCents, avoirsHtCents });
        }
      }),
  );

  const serie = construireSerie(periodes, deReleves, direct);
  const point = serie[serie.length - 1]!;
  const totaux = deReleves.get(derniere);
  const avecMouvement = totaux
    ? await prisma.releveMensuelApporteur.count({
        where: { periode: derniere, rang: 0, statut: { not: "ecarte" }, nbLignes: { gt: 0 } },
      })
    : null;

  const parPeriode = new Map<string, LignePeriode>();
  for (const l of parStatut) {
    const ligne = parPeriode.get(l.periode) ?? {
      periode: l.periode,
      prepares: 0,
      envoyes: 0,
      echecs: 0,
      ecartes: 0,
    };
    const n = l._count._all;
    if (l.statut === "envoye") ligne.envoyes += n;
    else if (l.statut === "echec") ligne.echecs += n;
    else if (l.statut === "ecarte") ligne.ecartes += n;
    else ligne.prepares += n;
    parPeriode.set(l.periode, ligne);
  }

  return {
    cartes: {
      periode: derniere,
      apporteursSignes: signes,
      avecMouvement,
      facturesHtCents: point.facturesHtCents,
      viresTtcCents: point.viresTtcCents,
      enAttenteHtCents: totaux ? totaux.enAttenteHtCents : null,
      cumulAnneeHtCents: totaux ? totaux.cumulAnneeHtCents : null,
      source: point.source,
    },
    serie,
    periodes: [...parPeriode.values()].sort((a, b) => b.periode.localeCompare(a.periode)),
  };
}

/**
 * Cibles de la période (même définition que la préparation) : les apporteurs `signe` dont le
 * contrat est contresigné AVANT la coupure (un signé après n'est pas attendu), plus, Q4 b, les
 * résiliés ou retirés qui ont eu un mouvement dans le mois ou ont encore de l'argent en jeu
 * (autofacture non versée, ligne en attente d'autofacture).
 */
export async function lireCiblesPeriode(
  periode: string,
  voitIdentite: boolean,
): Promise<CibleReleve[]> {
  const { debut, coupure } = bornesPeriode(periode);
  const select = { id: true, prenom: true, nom: true, denomination: true } as const;
  const [signes, avecArgent] = await Promise.all([
    prisma.apporteurReseau.findMany({
      where: {
        statut: "signe",
        OR: [{ signeParSocieteAt: null }, { signeParSocieteAt: { lt: coupure } }],
      },
      select,
      take: 5000,
    }),
    prisma.apporteurReseau.findMany({
      where: {
        statut: { not: "signe" },
        commissions: {
          some: {
            statut: { not: "annulee" },
            OR: [
              { autofactureEmiseAt: { gte: debut, lt: coupure } },
              { autofactureNumero: { not: null }, verseeAt: null },
              { autofactureAttenteDepuis: { not: null }, autofactureNumero: null },
            ],
          },
        },
      },
      select,
      take: 5000,
    }),
  ]);
  const vus = new Map<string, CibleReleve>();
  for (const a of [...signes, ...avecArgent]) {
    if (vus.has(a.id)) continue;
    vus.set(a.id, {
      apporteurId: a.id,
      nom: voitIdentite
        ? a.denomination || `${a.prenom} ${a.nom}`.trim() || "Apporteur"
        : "Apporteur (identité masquée)",
    });
  }
  return [...vus.values()];
}

export async function lireVuePeriode(periode: string, voitIdentite: boolean): Promise<VuePeriode> {
  const [lignes, cibles] = await Promise.all([
    prisma.releveMensuelApporteur.findMany({
      where: { periode },
      orderBy: [{ numero: "asc" }],
      take: 1000,
      select: {
        id: true,
        numero: true,
        apporteurId: true,
        rang: true,
        statut: true,
        nbLignes: true,
        facturesHtCents: true,
        avoirsHtCents: true,
        contenu: true,
        viresTtcCents: true,
        enAttenteHtCents: true,
        cumulAnneeHtCents: true,
        empreinteSha256: true,
        pdfR2Key: true,
        erreur: true,
        motifEcart: true,
        envoyeAt: true,
        apporteur: { select: { prenom: true, nom: true, denomination: true, email: true } },
      },
    }),
    lireCiblesPeriode(periode, voitIdentite),
  ]);
  return {
    cibles,
    releves: lignes.map((l) => ({
      id: l.id,
      numero: l.numero,
      apporteurId: l.apporteurId,
      apporteurNom: voitIdentite
        ? l.apporteur.denomination ||
          `${l.apporteur.prenom} ${l.apporteur.nom}`.trim() ||
          "Apporteur"
        : "Apporteur (identité masquée)",
      rang: l.rang,
      statut: l.statut,
      nbLignes: l.nbLignes,
      facturesHtCents: l.facturesHtCents,
      avoirsHtCents: l.avoirsHtCents,
      ...totauxTvaDeContenu(l.contenu),
      viresTtcCents: l.viresTtcCents,
      enAttenteHtCents: l.enAttenteHtCents,
      cumulAnneeHtCents: l.cumulAnneeHtCents,
      empreinteCourte: l.empreinteSha256.slice(0, 8),
      pdfDisponible: l.pdfR2Key !== null,
      emailPresent: !!l.apporteur.email,
      erreur: l.erreur,
      motifEcart: l.motifEcart,
      envoyeAt: l.envoyeAt,
    })),
  };
}

/** Relevés d'un apporteur pour sa fiche ; l'état de remise se lit dans `EmailLog` par `jobId`. */
export async function lireRelevesDeLApporteur(apporteurId: string): Promise<ReleveDeFiche[]> {
  const lignes = await prisma.releveMensuelApporteur.findMany({
    where: { apporteurId },
    orderBy: [{ periode: "desc" }, { rang: "desc" }],
    take: 36,
    select: {
      id: true,
      numero: true,
      periode: true,
      rang: true,
      statut: true,
      envoyeAt: true,
      empreinteSha256: true,
      pdfR2Key: true,
      emailJobId: true,
      erreur: true,
    },
  });
  const jobIds = lignes.map((l) => l.emailJobId).filter((j): j is string => !!j);
  const journal = jobIds.length
    ? await prisma.emailLog.findMany({
        where: { jobId: { in: jobIds } },
        orderBy: { createdAt: "asc" },
        select: { jobId: true, status: true },
      })
    : [];
  // Plusieurs lignes possibles par jobId : la plus récente fait foi (tri croissant, la dernière gagne).
  const statutParJob = new Map<string, string>();
  for (const j of journal) if (j.jobId) statutParJob.set(j.jobId, j.status);
  return lignes.map((l) => ({
    id: l.id,
    numero: l.numero,
    periode: l.periode,
    rang: l.rang,
    statut: l.statut,
    envoyeAt: l.envoyeAt,
    empreinteCourte: l.empreinteSha256.slice(0, 8),
    pdfDisponible: l.pdfR2Key !== null,
    statutEmail: l.emailJobId ? (statutParJob.get(l.emailJobId) ?? null) : null,
    erreur: l.erreur,
  }));
}
