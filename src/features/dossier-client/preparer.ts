/**
 * « Préparer » le prochain échange avec un client — la réponse à « réutiliser
 * ce qu'on sait pour les échanges futurs » (chantier visio, plan §3.13, MQ-M5).
 *
 * Fonction PURE. Elle ASSEMBLE :
 *   · `consoliderFaits` (valeurs, à trancher, trous, suivis ouverts) — elle ne
 *     relit JAMAIS les faits autrement ;
 *   · trois lectures nommées de `queries.ts` : la dernière suite convenue, les
 *     questions de questionnaire sans réponse, les personnes jamais rencontrées.
 *
 * Douze blocs, dans cet ordre (l'écran les rend dans cet ordre) :
 *    1. client, projet visé, dernière suite convenue (en rouge si dépassée)
 *    2. engagements de Williams ouverts
 *    3. engagements du client ouverts
 *    4. questions ouvertes (dernière rencontre + questionnaire sans réponse)
 *    5. objections non levées
 *    6. valeurs « à trancher » et « à reconfirmer »
 *    7. personnes citées comme décideur, jamais rencontrées
 *    8. rubriques jamais abordées
 *    9. échéance trop proche avec un financement OPCO
 *   10. comptes rendus non validés
 *   11. enregistrement refusé
 *   12. mise en relation annoncée
 *
 * 🔴 RIEN D'UN AUTRE PROJET. Seules deux portées sont lues : celle du projet
 * visé et celle de l'entreprise. Des autres projets, on ne montre que la liste
 * des titres et statuts, sans leurs faits. Garde :
 * `__tests__/preparer-liste-engagements-ouverts-questions-ouvertes-et-decideur-non-rencontre.spec.ts`.
 */

import type { FaitType, ProjetStatut, RendezVousSuite } from "../../../prisma/generated/client";
import {
  consoliderFaits,
  trouverValeur,
  valeurRetenue,
  type FaitAConsolider,
  type PorteeConsolidee,
  type ProjetAConsolider,
  type ValeurConsolidee,
} from "@/features/dossier-client/consolider-faits";
import { DELAI_OPCO_JOURS } from "@/features/dossier-client/seuils";

export interface ProjetResume {
  readonly id: string;
  readonly numero: string;
  readonly titre: string;
  readonly statut: ProjetStatut;
  readonly derniereReouvertureLe: Date | null;
}

export interface DernierSuivi {
  readonly suite: RendezVousSuite | null;
  readonly suiteLe: Date | null;
  readonly rencontreTitre: string;
}

export interface QuestionSansReponse {
  readonly id: string;
  readonly texte: string;
  readonly projetId: string;
}

export interface PersonneDuClient {
  readonly id: string;
  readonly nom: string;
  readonly fonction: string | null;
  /** Présente dans au moins une rencontre. */
  readonly rencontree: boolean;
}

export interface CompteRenduNonValide {
  readonly rencontreId: string;
  readonly rencontreTitre: string;
  readonly depuis: Date;
}

export interface EntreePreparer {
  readonly client: { readonly id: string; readonly numero: string; readonly raisonSociale: string };
  /** `null` = « projet non choisi » : portée entreprise seulement. */
  readonly projetId: string | null;
  readonly projets: ReadonlyArray<ProjetResume>;
  /** Tous les faits du client : la consolidation choisit. */
  readonly faits: ReadonlyArray<FaitAConsolider>;
  readonly dernierSuivi: DernierSuivi | null;
  readonly questionsSansReponse: ReadonlyArray<QuestionSansReponse>;
  readonly personnes: ReadonlyArray<PersonneDuClient>;
  readonly comptesRendusNonValides: ReadonlyArray<CompteRenduNonValide>;
  readonly enregistrementsRefusesLe: ReadonlyArray<Date>;
  readonly maintenant: Date;
}

export interface SignalOpco {
  readonly echeance: Date;
  readonly joursRestants: number;
  readonly seuilJours: number;
}

export interface Preparation {
  /** 1 */
  readonly entete: {
    readonly client: EntreePreparer["client"];
    readonly projet: ProjetResume | null;
    readonly dernierSuivi: DernierSuivi | null;
    readonly suiteDepassee: boolean;
    /** Les autres projets : titre et statut SEULEMENT. */
    readonly autresProjets: ReadonlyArray<Pick<ProjetResume, "id" | "numero" | "titre" | "statut">>;
  };
  /** 2 */ readonly engagementsAxion: ReadonlyArray<FaitAConsolider>;
  /** 3 */ readonly engagementsClient: ReadonlyArray<FaitAConsolider>;
  /** 4 */ readonly questionsOuvertes: {
    readonly faits: ReadonlyArray<FaitAConsolider>;
    readonly questionnaire: ReadonlyArray<QuestionSansReponse>;
  };
  /** 5 */ readonly objections: ReadonlyArray<FaitAConsolider>;
  /** 6 */ readonly aTrancherOuReconfirmer: ReadonlyArray<ValeurConsolidee>;
  /** 7 */ readonly decideursJamaisRencontres: ReadonlyArray<PersonneDuClient>;
  /** 8 */ readonly rubriquesJamaisAbordees: ReadonlyArray<number>;
  /** 9 */ readonly echeanceProcheAvecOpco: SignalOpco | null;
  /** 10 */ readonly comptesRendusNonValides: ReadonlyArray<CompteRenduNonValide>;
  /** 11 */ readonly enregistrementsRefusesLe: ReadonlyArray<Date>;
  /** 12 */ readonly misesEnRelation: ReadonlyArray<FaitAConsolider>;
}

/** Les portées lues : le projet visé (s'il y en a un) puis l'entreprise. Jamais un autre projet. */
function porteesLues(
  entreprise: PorteeConsolidee,
  projet: PorteeConsolidee | undefined,
): PorteeConsolidee[] {
  return projet !== undefined ? [projet, entreprise] : [entreprise];
}

function suivisDuType(portees: PorteeConsolidee[], type: FaitType): FaitAConsolider[] {
  return portees.flatMap((p) => p.suivisOuverts.filter((f) => f.type === type));
}

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Le financement annoncé passe-t-il par un OPCO ? */
function financementOpco(v: ValeurConsolidee | undefined): boolean {
  const f = valeurRetenue(v);
  if (f === null) return false;
  return /\bopco\b/i.test(`${f.texteCourt ?? ""} ${f.enonce}`);
}

/**
 * Échéance trop proche avec un financement OPCO, sur la portée d'UN projet.
 * Source unique du signal : « Préparer » (bloc 9) et l'aide au devis (PR 7)
 * l'appellent, personne ne le recopie.
 */
export function signalEcheanceOpco(
  porteeProjet: PorteeConsolidee | undefined,
  maintenant: Date,
): SignalOpco | null {
  if (porteeProjet === undefined) return null;
  const echeance = valeurRetenue(trouverValeur(porteeProjet, "echeance"));
  if (echeance?.dateCible == null) return null;
  if (!financementOpco(trouverValeur(porteeProjet, "financement"))) return null;
  const joursRestants = Math.floor((echeance.dateCible.getTime() - maintenant.getTime()) / JOUR_MS);
  if (joursRestants >= DELAI_OPCO_JOURS) return null;
  return { echeance: echeance.dateCible, joursRestants, seuilJours: DELAI_OPCO_JOURS };
}

export function preparer(e: EntreePreparer): Preparation {
  const projetsAConsolider: ProjetAConsolider[] = e.projets.map((p) => ({
    id: p.id,
    derniereReouvertureLe: p.derniereReouvertureLe,
  }));
  const conso = consoliderFaits(e.faits, projetsAConsolider, e.maintenant);
  const projet = e.projetId !== null ? (e.projets.find((p) => p.id === e.projetId) ?? null) : null;
  const porteeProjet = projet !== null ? conso.projets[projet.id] : undefined;
  const portees = porteesLues(conso.entreprise, porteeProjet);

  // 1. En-tête
  const suiteDepassee =
    e.dernierSuivi?.suiteLe != null &&
    e.dernierSuivi.suite !== "aucune" &&
    e.dernierSuivi.suiteLe.getTime() < e.maintenant.getTime();

  // 6. À trancher / à reconfirmer (et « avant réouverture », qui se reconfirme aussi).
  const aTrancherOuReconfirmer = portees.flatMap((p) =>
    p.valeurs.filter(
      (v) =>
        v.etat === "a_trancher" || v.etat === "a_reconfirmer" || v.etat === "avant_reouverture",
    ),
  );

  // 7. Décideurs cités, jamais rencontrés.
  const sujetsDecideurs = new Set(
    portees
      .flatMap((p) => p.valeurs.filter((v) => v.type === "decideur"))
      .flatMap((v) => v.faits)
      .map((f) => f.contactSujetId)
      .filter((id): id is string => id !== null),
  );
  const decideursJamaisRencontres = e.personnes.filter(
    (p) => sujetsDecideurs.has(p.id) && !p.rencontree,
  );

  // 9. Échéance trop proche avec OPCO (projet visé seulement : l'échéance est une valeur de projet).
  const echeanceProcheAvecOpco = signalEcheanceOpco(porteeProjet, e.maintenant);

  // 4. Questions de questionnaire sans réponse : celles du projet visé seulement.
  const questionnaire =
    projet !== null ? e.questionsSansReponse.filter((q) => q.projetId === projet.id) : [];

  return {
    entete: {
      client: e.client,
      projet,
      dernierSuivi: e.dernierSuivi,
      suiteDepassee,
      autresProjets: e.projets
        .filter((p) => p.id !== projet?.id)
        .map((p) => ({ id: p.id, numero: p.numero, titre: p.titre, statut: p.statut })),
    },
    engagementsAxion: suivisDuType(portees, "engagement_axion"),
    engagementsClient: suivisDuType(portees, "engagement_client"),
    questionsOuvertes: { faits: suivisDuType(portees, "question_ouverte"), questionnaire },
    objections: suivisDuType(portees, "objection"),
    aTrancherOuReconfirmer,
    decideursJamaisRencontres,
    rubriquesJamaisAbordees: [...new Set(portees.flatMap((p) => p.trous))].sort((a, b) => a - b),
    echeanceProcheAvecOpco,
    comptesRendusNonValides: e.comptesRendusNonValides,
    enregistrementsRefusesLe: e.enregistrementsRefusesLe,
    misesEnRelation: portees.flatMap((p) =>
      p.valeurs.filter((v) => v.type === "mise_en_relation").flatMap((v) => v.faits),
    ),
  };
}
