/**
 * Le PASSAGE des campagnes de relance (lot CAMP-3, 08 §12.3 couche 2).
 *
 * Un passage HORAIRE sur la file existante `formation-crons` (aucune file nouvelle), de
 * 8 h à 19 h, heure de Paris. Pour chaque campagne déclarée dont tous les interrupteurs
 * sont allumés : lecture des faits en lot, décision par le moteur pur, puis envoi par
 * l'adaptateur des formateurs (qui revérifie le texte validé, la fin de collaboration et
 * les crochets ; le worker relit encore l'état au départ, CAMP-1).
 *
 * Règles du passage :
 *   · au plus UNE relance par personne et par passage (et par jour : le lecteur fournit
 *     `derniereRelancePersonne`), la plus urgente d'abord — classe B avant A, puis
 *     l'origine la plus ancienne ;
 *   · anti-doublon `dejaTente` : le journal des envois ET la corbeille (`EmailOutbox.jobId`,
 *     CAMP-2) — une relance garée n'est jamais regarée ; inconnu = on ne relance pas ;
 *   · au plus 30 envois par passage (boîte partagée à 40/h) ; le reste au suivant ;
 *   · toutes les relances portent `priority: 10` ;
 *   · `maintenant` est un PARAMÈTRE (le banc l'appelle avec son horloge) ;
 *   · garde `stub.invalid`.
 */

import {
  dansFenetreEnvoi,
  decisionCampagne,
  FENETRE_ENVOI_PAR_DEFAUT,
  memeJourLocal,
} from "@/lib/relances/campagne";
import { prisma } from "@/lib/prisma";
import { jobIdDejaGare } from "@/server/email/outbox-service";
import {
  lireDrapeauEnvoi,
  type EtatsInterrupteurs,
} from "@/server/qualiopi/formateurs-independants/interrupteurs";
import { lireEtatsInterrupteurs } from "@/server/qualiopi/formateurs-independants/interrupteurs-etat";
import type {
  EnvoiFormateur,
  ResultatEnvoiFormateur,
} from "@/server/qualiopi/formateurs-independants/envois";

import {
  REGISTRE_CAMPAGNES,
  cleRelance,
  type ClasseCampagne,
  type DeclarationCampagne,
  type FaitsCampagne,
} from "./registre-campagnes";

export const PLAFOND_ENVOIS_PAR_PASSAGE = 30;
export const PRIORITE_RELANCE = 10;

export interface BilanPassageCampagnes {
  readonly horsFenetre: boolean;
  readonly campagnesActives: number;
  readonly envoyes: number;
  /** Relances garées en corbeille de validation (comptées dans le plafond du passage). */
  readonly gares: number;
  readonly ecartes: Readonly<Record<string, number>>;
  readonly plafondAtteint: boolean;
}

export interface DependancesPassage {
  readonly registre: readonly DeclarationCampagne[];
  /**
   * Les fiches qui ont déjà reçu (ou vu garer) une relance de campagne `fi-` aujourd'hui
   * (jour de Paris), TOUTES campagnes confondues — journal ET corbeille. `null` : on ne
   * sait pas, rien ne part.
   */
  readonly relanceesAujourdhui: (
    entityIds: readonly string[],
    maintenant: Date,
  ) => Promise<ReadonlySet<string> | null>;
  readonly lireInterrupteurs: () => Promise<EtatsInterrupteurs>;
  /** Vrai si cette clé a déjà été tentée (journal OU corbeille) ; `null` : inconnu. */
  readonly dejaTente: (jobId: string) => Promise<boolean | null>;
  readonly envoyer: (e: EnvoiFormateur) => Promise<ResultatEnvoiFormateur>;
}

/** Journal des envois ET corbeille de validation. Inconnu (`null`) si l'un ne répond pas. */
export async function dejaTente(jobId: string): Promise<boolean | null> {
  let journal: boolean;
  try {
    // Un envoi en ÉCHEC définitif ne compte pas : l'adaptateur retire le job échoué et le
    // passage suivant peut le retenter (`retirerEnvoiEchoue`).
    journal =
      (await prisma.emailLog.findFirst({
        where: { jobId, status: { not: "failed" } },
        select: { id: true },
      })) !== null;
  } catch {
    return null;
  }
  if (journal) return true;
  return jobIdDejaGare(jobId);
}

/** Début du jour de Paris contenant `maintenant` (à l'heure près, changement d'heure compris). */
function debutDuJourParis(maintenant: Date): Date {
  let t = Math.floor(maintenant.getTime() / 3_600_000) * 3_600_000;
  while (memeJourLocal(new Date(t - 3_600_000), maintenant, FENETRE_ENVOI_PAR_DEFAUT.fuseau)) {
    t -= 3_600_000;
  }
  return new Date(t);
}

/** Journal et corbeille, en deux requêtes groupées. */
export async function relanceesAujourdhui(
  entityIds: readonly string[],
  maintenant: Date,
): Promise<ReadonlySet<string> | null> {
  if (entityIds.length === 0) return new Set();
  const depuis = debutDuJourParis(maintenant);
  const ids = [...new Set(entityIds)];
  try {
    const [journal, corbeille] = await Promise.all([
      prisma.emailLog.findMany({
        where: {
          entityId: { in: ids },
          jobId: { startsWith: "fi-" },
          status: { not: "failed" },
          createdAt: { gte: depuis },
        },
        select: { entityId: true },
      }),
      prisma.emailOutbox.findMany({
        where: { entityId: { in: ids }, jobId: { startsWith: "fi-" }, createdAt: { gte: depuis } },
        select: { entityId: true },
      }),
    ]);
    return new Set(
      [...journal, ...corbeille].map((l) => l.entityId).filter((x): x is string => x !== null),
    );
  } catch {
    return null;
  }
}

const RANG_CLASSE: Readonly<Record<ClasseCampagne, number>> = { B: 0, A: 1, C: 2 };

async function dependancesParDefaut(
  injectees: Partial<DependancesPassage> | undefined,
): Promise<DependancesPassage> {
  const envoyer =
    injectees?.envoyer ??
    (await import("@/server/qualiopi/formateurs-independants/envois")).envoyer;
  return {
    registre: REGISTRE_CAMPAGNES,
    lireInterrupteurs: lireEtatsInterrupteurs,
    relanceesAujourdhui,
    dejaTente,
    envoyer,
  };
}

interface Candidat {
  readonly campagne: DeclarationCampagne;
  readonly faits: FaitsCampagne;
  readonly etape: string;
}

export async function passerCampagnes(
  maintenant: Date,
  deps?: Partial<DependancesPassage>,
): Promise<BilanPassageCampagnes> {
  const ecartes: Record<string, number> = {};
  const ecarter = (motif: string) => {
    ecartes[motif] = (ecartes[motif] ?? 0) + 1;
  };
  const vide = (horsFenetre: boolean, campagnesActives = 0): BilanPassageCampagnes => ({
    horsFenetre,
    campagnesActives,
    envoyes: 0,
    gares: 0,
    ecartes,
    plafondAtteint: false,
  });

  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return vide(false);
  if (!dansFenetreEnvoi(maintenant, FENETRE_ENVOI_PAR_DEFAUT)) return vide(true);

  const d: DependancesPassage = { ...(await dependancesParDefaut(deps)), ...deps };
  if (d.registre.length === 0) return vide(false);

  const etats = await d.lireInterrupteurs();
  const actives = d.registre.filter((c) =>
    c.interrupteurs.every((cle) => lireDrapeauEnvoi(etats, cle)),
  );
  if (actives.length === 0) return vide(false);

  // 1. Décider, campagne par campagne (lecture en lot).
  const candidats: Candidat[] = [];
  for (const campagne of actives) {
    let faits: readonly FaitsCampagne[];
    try {
      faits = await campagne.lireFaits(maintenant);
    } catch {
      ecarter("lecture-impossible");
      continue;
    }
    for (const f of faits) {
      let decision: ReturnType<typeof decisionCampagne>;
      try {
        decision = decisionCampagne({ etat: f.etat, maintenant, regle: campagne.regle });
      } catch {
        ecarter("decision-impossible");
        continue;
      }
      if (!decision.envoyer) {
        ecarter(decision.motif);
        continue;
      }
      candidats.push({ campagne, faits: f, etape: decision.etape });
    }
  }

  // 2. Le plus urgent d'abord : classe B avant A, puis l'origine la plus ancienne.
  candidats.sort(
    (a, b) =>
      RANG_CLASSE[a.campagne.classe] - RANG_CLASSE[b.campagne.classe] ||
      a.faits.etat.origine.getTime() - b.faits.etat.origine.getTime(),
  );

  if (candidats.length === 0) return vide(false, actives.length);

  // 3. Une relance par personne ET par jour, toutes campagnes : ce que le journal et la
  //    corbeille disent d'aujourd'hui, plus ce que ce passage envoie.
  const deja = await d.relanceesAujourdhui(
    candidats.map((c) => c.faits.entityId),
    maintenant,
  );
  if (deja === null) {
    ecarter("journal-illisible");
    return vide(false, actives.length);
  }

  // 4. Envoyer : une par personne, plafond du passage, jamais deux fois la même clé.
  const servies = new Set<string>();
  let envoyes = 0;
  let gares = 0;
  let plafondAtteint = false;
  for (const c of candidats) {
    if (servies.has(c.faits.personneId) || deja.has(c.faits.entityId)) {
      ecarter("deja-aujourd-hui");
      continue;
    }
    if (envoyes + gares >= PLAFOND_ENVOIS_PAR_PASSAGE) {
      plafondAtteint = true;
      ecarter("plafond-du-passage");
      continue;
    }
    const jobId = cleRelance(c.campagne.id, c.faits.entityId, c.faits.origineId, c.etape);
    const tente = await d.dejaTente(jobId);
    if (tente !== false) {
      ecarter(tente === null ? "anti-doublon-illisible" : "deja-tente");
      continue;
    }
    const etapeIndex = c.campagne.regle.etapes.findIndex((e) => e.id === c.etape);
    const r = await d.envoyer({
      gabarit: c.campagne.gabarit,
      destinataire: c.faits.destinataire,
      payload: { ...c.faits.payload, etape: etapeIndex + 1 },
      entityType: c.campagne.entityType,
      entityId: c.faits.entityId,
      jobId,
      priority: PRIORITE_RELANCE,
    });
    servies.add(c.faits.personneId);
    if (r === "envoye") envoyes++;
    else if (r === "en-validation") gares++;
    else ecarter(r);
    // Base ou file en panne : inutile d'enchaîner les essais, le passage suivant reprendra.
    if (r === "indisponible") break;
  }

  return {
    horsFenetre: false,
    campagnesActives: actives.length,
    envoyes,
    gares,
    ecartes,
    plafondAtteint,
  };
}
