export { evaluerPorte } from "./porte";
export { CRITERES, CLASSES_PAR_ID, IDS_BLOQUANTS_PREVUS } from "./registre";
export { calculerNote, MAX_PENALITES } from "./note";
export { ReglagesPorteSchema, REGLAGES_PAR_DEFAUT, VERSION_PORTE } from "./reglages";
export type * from "./types";
export {
  CLE_CONFIG_PORTE,
  DRAPEAU_OBSERVATION,
  observationActive,
  observerSortie,
  reglagesDepuisConfig,
} from "./observation";
export type { IssueObservation, LigneVerdictEcrite } from "./observation";
export { construireVue, lireLigneVerdict } from "./vue";
export type { LigneVerdictLue, VerdictAffiche, VuePorte } from "./vue";
export { evaluerB06 } from "./criteres/unicite";
export {
  PAIRES_CALIBRAGE_MIN,
  TYPES_INDEX_STATIQUE,
  calibrerSeuil,
  cosinus,
  penaliteProximite,
  voisinsLesPlusProches,
} from "./semantique";
export {
  CLE_COUPE_CIRCUIT,
  DRAPEAU_POINT_FINAL,
  appliquerPointFinal,
  controlerTexteHorsArticle,
  evaluerB17,
  lireCoupeCircuit,
  pointFinalActif,
} from "./point-final";
export type {
  ControleHorsArticle,
  DepsPointFinal,
  EntreeB17,
  IssuePointFinal,
  ResultatB17,
} from "./point-final";
export { evaluerB05 } from "./criteres/intention";
export { evaluerB07 } from "./criteres/apport";
export { cleIntention, lignesDepuisCarte } from "./intentions-registre";
export {
  TYPES_APPORT,
  contientMarqueurApport,
  extraireApports,
  reserverApports,
  retirerMarqueursApport,
} from "./apports";
