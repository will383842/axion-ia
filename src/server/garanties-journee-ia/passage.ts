/**
 * Garantie Journée IA — passage quotidien des alertes d'échéance (06:50 UTC, week-end compris,
 * AVANT le moteur d'alertes de 07:00 qui envoie le groupe par e-mail).
 *
 * Pour chaque dossier non archivé et chaque échéance ouverte, au palier atteint (J-5, J-2, J0,
 * dépassée) : une `AlerteSysteme` OUVERTE par (code, dossier) — l'index unique partiel
 * `alertes_systeme_dedup_ouverte_uniq` l'impose — dont le niveau, le titre et le message suivent le
 * palier. Idempotence : un second passage le même jour rend les mêmes textes, `creerOuActualiser`
 * ne touche à rien et ne ré-arme aucune notification ; un NOUVEAU palier met l'alerte à jour et
 * ré-arme `notifiedAt` (au plus un e-mail par palier de niveau « important » ou « critique », donc dès J-2 ; J-5 reste à l'écran).
 *
 * Fermeture : par ce passage seulement (codes `resolutionAuto: false`). Une alerte ouverte dont
 * l'échéance est faite, dont le dossier est archivé ou dont le palier a disparu (date corrigée) est
 * résolue.
 *
 * 🔴 Deux conteneurs (AGENTS.md) : le worker peut tourner AVANT que la migration soit jouée par
 * l'entrypoint de l'app. La table absente (Prisma P2021) est un état attendu : journal, sortie
 * propre, rien d'écrit. « Réputée acceptée » n'est jamais écrite : le passage ne fait que dire.
 */
import { prisma } from "@/lib/prisma";
import { calculerEcheances } from "@/lib/garantie-journee-ia/echeances";
import { aujourdhuiParis, jourIso } from "@/lib/garantie-journee-ia/presentation";
import { creerOuActualiser } from "@/server/qualiopi/alertes/alertes-service";
import {
  alerteVoulue,
  CIBLE_TYPE_GARANTIE,
  CODES_GARANTIE_JI,
  type AlerteVoulue,
} from "@/server/garanties-journee-ia/paliers";

/** Plafond de lecture : au-delà, la fermeture est suspendue (un dossier non lu n'est pas un dossier clos). */
const PLAFOND = 2000;

export interface BilanPassage {
  tableAbsente: boolean;
  dossiers: number;
  creeesOuMisesAJour: number;
  resolues: number;
}

function estP2021(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2021";
}

export async function passerGarantiesJourneeIa(
  maintenant: Date = new Date(),
): Promise<BilanPassage> {
  const bilan: BilanPassage = {
    tableAbsente: false,
    dossiers: 0,
    creeesOuMisesAJour: 0,
    resolues: 0,
  };
  const aujourdhui = aujourdhuiParis(maintenant);

  let dossiers;
  try {
    dossiers = await prisma.garantieJourneeIa.findMany({
      where: { archiveLe: null },
      select: {
        id: true,
        dateJournee: true,
        rapportRemisLe: true,
        demandeRecueLe: true,
        decision: true,
        decisionLe: true,
        virementLe: true,
        client: { select: { raisonSociale: true } },
      },
      orderBy: { id: "asc" },
      take: PLAFOND + 1,
    });
  } catch (e) {
    if (estP2021(e)) {
      console.warn(
        "[garanties-journee-ia] table absente (P2021) : migration pas encore jouée, passage ignoré",
      );
      bilan.tableAbsente = true;
      return bilan;
    }
    throw e;
  }
  // PLAFOND + 1 lus : le dépassement se voit sans confondre « exactement PLAFOND » et « davantage ».
  const tronque = dossiers.length > PLAFOND;
  if (tronque) {
    dossiers = dossiers.slice(0, PLAFOND);
    console.warn(`[garanties-journee-ia] plus de ${PLAFOND} dossiers : fermetures suspendues`);
  }
  bilan.dossiers = dossiers.length;

  const voulues: AlerteVoulue[] = [];
  for (const d of dossiers) {
    const donnees = {
      dateJournee: jourIso(d.dateJournee) as string,
      rapportRemisLe: jourIso(d.rapportRemisLe),
      demandeRecueLe: jourIso(d.demandeRecueLe),
      decision: (d.decision as "remboursement" | "refus" | "avoir" | null) ?? null,
      decisionLe: jourIso(d.decisionLe),
      virementLe: jourIso(d.virementLe),
    };
    for (const e of calculerEcheances(donnees, aujourdhui)) {
      // Une décision datée clôt l'alerte de réponse, même tardive : l'obligation qui reste est le virement.
      const close =
        e.type === "reponse" && (donnees.decisionLe !== null || donnees.virementLe !== null);
      const v = alerteVoulue(
        d.id,
        d.client.raisonSociale,
        { ...e, faite: e.faite || close },
        aujourdhui,
      );
      if (v) voulues.push(v);
    }
  }

  for (const v of voulues) {
    const r = await creerOuActualiser({
      code: v.code,
      niveau: v.niveau,
      titre: v.titre.slice(0, 300),
      message: v.message,
      cibleType: CIBLE_TYPE_GARANTIE,
      cibleId: v.cibleId,
      metadata: { echeance: v.echeance, palier: v.palier },
    });
    if (r) bilan.creeesOuMisesAJour++;
  }

  // Fermeture : toute alerte ouverte de ces codes que le passage ne veut plus.
  const voulu = new Set(voulues.map((v) => `${v.code}::${v.cibleId}`));
  const ouvertes = await prisma.alerteSysteme.findMany({
    where: { code: { in: [...CODES_GARANTIE_JI] }, cibleType: CIBLE_TYPE_GARANTIE, resolue: false },
    select: { id: true, code: true, cibleId: true, message: true },
  });
  const aResoudre = ouvertes.filter((a) => !voulu.has(`${a.code}::${a.cibleId ?? ""}`));
  if (aResoudre.length > 0 && !tronque) {
    // Le message est marqué : sinon une alerte refermée ici bloquerait, comme un « Résoudre » humain,
    // la re-création au même palier si le dossier redevient actif (désarchivage, date effacée).
    for (const a of aResoudre) {
      await prisma.alerteSysteme.update({
        where: { id: a.id },
        data: {
          resolue: true,
          resolueAt: new Date(),
          message: `${a.message} [refermée par le passage quotidien]`,
        },
      });
      bilan.resolues++;
    }
  }

  // eslint-disable-next-line no-console -- journal du worker, comme les autres passages quotidiens
  console.log(
    `[garanties-journee-ia] ${bilan.dossiers} dossier(s), ${bilan.creeesOuMisesAJour} alerte(s) créée(s) ou mise(s) à jour, ${bilan.resolues} refermée(s)`,
  );
  return bilan;
}
