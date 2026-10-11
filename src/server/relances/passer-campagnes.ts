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
  readonly ecartes: Readonly<Record<string, number>>;
  readonly plafondAtteint: boolean;
}

export interface DependancesPassage {
  readonly registre: readonly DeclarationCampagne[];
  readonly lireInterrupteurs: () => Promise<EtatsInterrupteurs>;
  /** Vrai si cette clé a déjà été tentée (journal OU corbeille) ; `null` : inconnu. */
  readonly dejaTente: (jobId: string) => Promise<boolean | null>;
  readonly envoyer: (e: EnvoiFormateur) => Promise<ResultatEnvoiFormateur>;
}

/** Journal des envois ET corbeille de validation. Inconnu (`null`) si l'un ne répond pas. */
export async function dejaTente(jobId: string): Promise<boolean | null> {
  let journal: boolean;
  try {
    journal =
      (await prisma.emailLog.findFirst({ where: { jobId }, select: { id: true } })) !== null;
  } catch {
    return null;
  }
  if (journal) return true;
  return jobIdDejaGare(jobId);
}

const RANG_CLASSE: Readonly<Record<ClasseCampagne, number>> = { B: 0, A: 1, C: 2 };

async function dependancesParDefaut(): Promise<DependancesPassage> {
  const { envoyer } = await import("@/server/qualiopi/formateurs-independants/envois");
  return {
    registre: REGISTRE_CAMPAGNES,
    lireInterrupteurs: lireEtatsInterrupteurs,
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
    ecartes,
    plafondAtteint: false,
  });

  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return vide(false);
  if (!dansFenetreEnvoi(maintenant, FENETRE_ENVOI_PAR_DEFAUT)) return vide(true);

  const d: DependancesPassage = { ...(await dependancesParDefaut()), ...deps };
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
      const decision = decisionCampagne({ etat: f.etat, maintenant, regle: campagne.regle });
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

  // 3. Envoyer : une par personne, plafond du passage, jamais deux fois la même clé.
  const servies = new Set<string>();
  let envoyes = 0;
  let plafondAtteint = false;
  for (const c of candidats) {
    if (servies.has(c.faits.personneId)) {
      ecarter("deja-aujourd-hui");
      continue;
    }
    if (envoyes >= PLAFOND_ENVOIS_PAR_PASSAGE) {
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
    if (r === "envoye" || r === "en-validation") envoyes++;
    else ecarter(r);
  }

  return { horsFenetre: false, campagnesActives: actives.length, envoyes, ecartes, plafondAtteint };
}
