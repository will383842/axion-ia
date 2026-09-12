/**
 * Qualiopi — Ce qu'on doit à CHAQUE formateur, quel que soit son statut.
 *
 * ── LE DÉFAUT QUE CE MODULE FERME ────────────────────────────────────────────
 *
 * 🔴 Le suivi de la rémunération était réservé aux INDÉPENDANTS. Eux seuls
 * produisent un relevé, apparaissent dans « Ce qu'on doit », déclenchent une
 * alerte de retard. Un salarié ou un dirigeant qui anime des formations
 * n'existait dans AUCUN suivi de paiement : ses lignes étaient calculées en coût
 * analytique, et s'arrêtaient là. Personne ne savait combien lui verser en plus
 * de son fixe, ni ce qui restait à rattraper.
 *
 * Demande de Will (2026-09-12) : « il faut que ce soit complet et harmonisé quel
 * que soit le statut du formateur ».
 *
 * ── ⛔ CE QUE L'HARMONISATION NE FAIT PAS, ET POURQUOI ───────────────────────
 *
 * Elle porte sur ce qu'on VOIT et ce qu'on SUIT, jamais sur la nature de la
 * dette. Un salarié n'est pas payé sur facture : lui fabriquer un relevé
 * facturable fausserait la déclaration BPF, qui compte la charge de
 * sous-traitance en filtrant sur `nature: honoraire_du`. Le mode de RÈGLEMENT
 * reste donc différent — facture pour l'indépendant, paie pour le salarié — et
 * c'est précisément ce que chaque ligne annonce.
 *
 * C'est la nuance que j'ai proposée à Will plutôt que d'obéir à la lettre, et
 * elle est écrite ici pour qu'on n'ait pas à la redécouvrir.
 */

import { prisma } from "@/lib/prisma";
import { deroulerAvanceRecuperable, synthetiser } from "./avance-recuperable";
import { echeanceEffective, joursDeRetard, STATUTS_RELEVE_DU } from "./echeance";

/**
 * Comment cette somme arrive chez le formateur.
 *
 * 🔑 Ce n'est pas un détail d'affichage : c'est ce qui dit à l'opérateur quel
 * geste faire. Un « à payer » indifférencié l'enverrait chercher une facture
 * pour quelqu'un qui n'en émettra jamais.
 */
export type ModeReglement =
  /** Facture d'honoraires (autofacture), puis virement. Indépendants. */
  | "facture"
  /** Bulletin de paie. Salariés et dirigeants — hors de l'outil. */
  | "paie";

export interface LigneDueFormateur {
  readonly trainerId: string;
  readonly trainerNom: string;
  readonly statut: "salarie" | "sous_traitant" | "dirigeant";
  readonly mode: ModeReglement;
  /** Montant restant à régler, en centimes. */
  readonly montantCents: number;
  /** Période de rattachement, pour situer la somme. */
  readonly periodeYear: number;
  readonly periodeMonth: number;
  /** Relevé concerné — absent pour un salarié, qui n'en a pas. */
  readonly statementId: string | null;
  /** Échéance de règlement. `null` quand le mode est `paie` : la paie a son propre calendrier. */
  readonly echeance: Date | null;
  readonly retardJours: number | null;
  /** Autofacture émise mais jamais transmise — l'état dangereux du circuit. */
  readonly autofactureNonTransmise: boolean;
  /**
   * Dette d'avance restant à rattraper (fixe récupérable). Toujours 0 hors
   * salarié — un indépendant n'a pas de fixe à rembourser.
   */
  readonly avanceResteCents: number;
}

/**
 * Tout ce qu'on doit, tous statuts confondus, trié par urgence.
 *
 * ⚠️ Le tri met les RETARDS en tête, puis les échéances les plus proches, puis
 * ce qui n'a pas d'échéance. Trier par montant mettrait une grosse somme non
 * échue devant un petit retard — or c'est le retard qui coûte des pénalités.
 *
 * Stub-aware : rend une liste vide si la base est indisponible.
 */
export async function listDuFormateurs(now = new Date()): Promise<LigneDueFormateur[]> {
  const [independants, salaries] = await Promise.all([
    lignesIndependants(now),
    lignesSalaries(now),
  ]);

  return [...independants, ...salaries].sort((a, b) => {
    // 1. les retards d'abord, du plus ancien au plus récent
    if (a.retardJours !== null || b.retardJours !== null) {
      return (b.retardJours ?? -1) - (a.retardJours ?? -1);
    }
    // 2. puis les échéances les plus proches
    if (a.echeance !== null && b.echeance !== null) {
      return a.echeance.getTime() - b.echeance.getTime();
    }
    if (a.echeance !== null) return -1;
    if (b.echeance !== null) return 1;
    // 3. ce qui n'a pas d'échéance ferme la marche, du plus gros au plus petit
    return b.montantCents - a.montantCents;
  });
}

/** Les indépendants : un relevé non soldé = une dette exigible. */
async function lignesIndependants(now: Date): Promise<LigneDueFormateur[]> {
  try {
    const rows = await prisma.trainerStatement.findMany({
      where: { statut: { in: [...STATUTS_RELEVE_DU] }, payeAt: null },
      select: {
        id: true,
        statut: true,
        periodeYear: true,
        periodeMonth: true,
        totalTtcCents: true,
        dateFacture: true,
        echeanceAt: true,
        payeAt: true,
        autofactureAt: true,
        autofactureTransmiseAt: true,
        trainerId: true,
        trainer: { select: { nom: true, prenom: true, statut: true } },
      },
      take: 200,
    });

    return rows.map((r) => ({
      trainerId: r.trainerId,
      trainerNom: `${r.trainer.prenom} ${r.trainer.nom}`.trim(),
      statut: r.trainer.statut,
      mode: "facture" as const,
      montantCents: r.totalTtcCents,
      periodeYear: r.periodeYear,
      periodeMonth: r.periodeMonth,
      statementId: r.id,
      echeance: echeanceEffective(r),
      retardJours: joursDeRetard(r, now),
      autofactureNonTransmise: r.autofactureAt !== null && r.autofactureTransmiseAt === null,
      avanceResteCents: 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Les salariés et dirigeants : le COMPLÉMENT à porter en paie, après imputation
 * du fixe récupérable.
 *
 * ⚠️ On ne rend une ligne QUE s'il y a quelque chose à faire — un complément à
 * verser, ou une dette à connaître. Un salarié dont les commissions couvrent
 * exactement son fixe n'a rien à signaler, et l'afficher chaque mois à zéro
 * apprendrait à survoler la liste.
 *
 * ⚠️ Le déroulé part du PREMIER mois commissionné, pas du mois courant : la
 * dette se construit sur l'historique, et la calculer sur le seul mois en cours
 * rendrait un complément faux — c'est très exactement la différence entre les
 * deux options soumises à Will.
 */
async function lignesSalaries(now: Date): Promise<LigneDueFormateur[]> {
  try {
    const formateurs = await prisma.trainer.findMany({
      where: {
        statut: { in: ["salarie", "dirigeant"] },
        actif: true,
        fixeMensuelBrutCents: { not: null },
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        statut: true,
        fixeMensuelBrutCents: true,
        avanceRepriseCents: true,
      },
      take: 200,
    });
    if (formateurs.length === 0) return [];

    const lignes = await prisma.trainerFeeLine.findMany({
      where: {
        trainerId: { in: formateurs.map((f) => f.id) },
        // Les lignes ANALYTIQUES sont celles d'un interne. `previsionnel` et
        // `annule` ne sont pas des gains acquis : les compter gonflerait le
        // remboursement de l'avance avec des montants qui n'existent pas.
        nature: "analytique",
        statut: { in: ["calcule", "valide"] },
      },
      select: { trainerId: true, periodeYear: true, periodeMonth: true, montantHtCents: true },
    });

    const out: LigneDueFormateur[] = [];
    for (const f of formateurs) {
      const fixe = f.fixeMensuelBrutCents ?? 0;
      const parPeriode = new Map<string, { year: number; month: number; total: number }>();
      for (const l of lignes) {
        if (l.trainerId !== f.id) continue;
        const cle = `${l.periodeYear}-${l.periodeMonth}`;
        const acc = parPeriode.get(cle) ?? {
          year: l.periodeYear,
          month: l.periodeMonth,
          total: 0,
        };
        acc.total += l.montantHtCents;
        parPeriode.set(cle, acc);
      }
      if (parPeriode.size === 0) continue;

      const deroule = deroulerAvanceRecuperable(
        [...parPeriode.values()].map((p) => ({
          year: p.year,
          month: p.month,
          fixeCents: fixe,
          commissionsCents: p.total,
        })),
        f.avanceRepriseCents ?? 0,
      );
      const s = synthetiser(deroule);
      if (s.complementDuMoisCents === 0 && s.detteCents === 0) continue;

      out.push({
        trainerId: f.id,
        trainerNom: `${f.prenom} ${f.nom}`.trim(),
        statut: f.statut,
        mode: "paie",
        montantCents: s.complementDuMoisCents,
        periodeYear: s.dernierMois?.year ?? now.getFullYear(),
        periodeMonth: s.dernierMois?.month ?? now.getMonth() + 1,
        statementId: null,
        // ⚠️ Aucune échéance : la paie a son propre calendrier, et lui en
        // inventer une ferait apparaître des « retards » qui n'existent pas.
        echeance: null,
        retardJours: null,
        autofactureNonTransmise: false,
        avanceResteCents: s.detteCents,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Le déroulé du fixe récupérable d'UN formateur, pour sa fiche.
 *
 * 🔑 Même chemin de calcul que le pilotage global : les deux passent par
 * `deroulerAvanceRecuperable`. Deux implémentations du même calcul d'argent
 * finiraient par diverger, et la divergence porterait sur ce qu'on verse à
 * quelqu'un — la pire qui soit.
 *
 * Rend `null` quand rien n'a été commissionné : afficher des zéros ferait croire
 * à un calcul, alors qu'il n'y a simplement rien à calculer.
 */
export async function lireSituationFixe(
  trainerId: string,
): Promise<{ complementDuMoisCents: number; detteCents: number; moisLabel: string } | null> {
  try {
    const f = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { fixeMensuelBrutCents: true, avanceRepriseCents: true },
    });
    if (f === null) return null;

    const lignes = await prisma.trainerFeeLine.findMany({
      where: { trainerId, nature: "analytique", statut: { in: ["calcule", "valide"] } },
      select: { periodeYear: true, periodeMonth: true, montantHtCents: true },
    });
    if (lignes.length === 0) return null;

    const parPeriode = new Map<string, { year: number; month: number; total: number }>();
    for (const l of lignes) {
      const cle = `${l.periodeYear}-${l.periodeMonth}`;
      const acc = parPeriode.get(cle) ?? { year: l.periodeYear, month: l.periodeMonth, total: 0 };
      acc.total += l.montantHtCents;
      parPeriode.set(cle, acc);
    }

    const s = synthetiser(
      deroulerAvanceRecuperable(
        [...parPeriode.values()].map((p) => ({
          year: p.year,
          month: p.month,
          fixeCents: f.fixeMensuelBrutCents ?? 0,
          commissionsCents: p.total,
        })),
        f.avanceRepriseCents ?? 0,
      ),
    );
    if (s.dernierMois === null) return null;

    const moisLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
      new Date(Date.UTC(s.dernierMois.year, s.dernierMois.month - 1, 1)),
    );
    return {
      complementDuMoisCents: s.complementDuMoisCents,
      detteCents: s.detteCents,
      moisLabel,
    };
  } catch {
    return null;
  }
}

/**
 * Ce qu'un formateur doit lire dans SON espace, quel que soit son statut.
 *
 * ## 🔴 Le trou que cette lecture ferme
 *
 * « Ma rémunération » ne savait lire que des RELEVÉS. Or un salarié n'en a
 * jamais — ni aujourd'hui, ni demain : sa rémunération passe par la paie. Il
 * ouvrait donc la page et lisait « Aucun relevé pour l'instant, ils apparaissent
 * ici une fois le mois arrêté ».
 *
 * Cette phrase est vraie pour un indépendant et FAUSSE pour lui : elle promet
 * une chose qui n'arrivera pas, sur l'écran même où il cherche ce qu'on lui
 * doit. Un état vide qui ment est pire qu'un état vide — il fait attendre.
 *
 * ## Ce que la lecture rend, et ce qu'elle se garde d'affirmer
 *
 * ⚠️ Le complément n'est PAS un salaire, et l'écran doit le dire : l'outil
 * calcule ce qu'il faut porter EN PLUS sur la paie, il ne verse rien et ne fait
 * pas foi. Le bulletin de paie fait foi. Laisser croire l'inverse ferait
 * contester un bulletin sur la base d'un écran.
 *
 * 🔑 Aucune donnée d'un autre formateur ne peut en sortir : tout est borné par
 * `trainerId`, celui de la session, jamais un paramètre d'URL.
 */
export async function lireRemunerationDuFormateur(trainerId: string): Promise<{
  statut: string;
  /** Le fixe de référence, en centimes. `null` quand il n'a pas été renseigné. */
  fixeMensuelBrutCents: number | null;
  /** Le déroulé du mois, ou `null` si rien n'a encore été commissionné. */
  situation: { complementDuMoisCents: number; detteCents: number; moisLabel: string } | null;
} | null> {
  try {
    const t = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { statut: true, fixeMensuelBrutCents: true },
    });
    if (t === null) return null;
    return {
      statut: t.statut,
      fixeMensuelBrutCents: t.fixeMensuelBrutCents,
      // 🔑 Le MÊME calcul que la console — `lireSituationFixe`, la fonction
      // elle-même. Deux chemins pour le même montant finiraient par annoncer
      // deux sommes différentes à l'employeur et au salarié, sur la même paie.
      situation: await lireSituationFixe(trainerId),
    };
  } catch {
    return null;
  }
}
