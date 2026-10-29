// Lot 0 (socle) : la page fiche client n'importe QUE ce module. Seul le lot 0 le modifie.
export { lireClient360Cache, type ContexteFiche } from "./contexte";
export { enTeteFiche, EN_TETE_REMPLACE_LE_BANDEAU } from "./EnTeteFiche";
export { compteursOnglets, type CompteurOnglet } from "./compteurs-onglets";
export { ongletActivite, ONGLET_ACTIVITE_PRET } from "./OngletActivite";
export { resumeTaches } from "./ResumeTaches";
export { resumeNotes } from "./ResumeNotes";
export { resumePrestations } from "./ResumePrestations";
export { personnesDecision } from "./PersonnesDecision";
export { ActionsDeLaPersonne } from "./ActionsDeLaPersonne";
export { questionnaireEnBref } from "./QuestionnaireEnBref";
export { archivageFiche } from "./ArchivageFiche";
export { OngletDevisFactures } from "./OngletDevisFactures";
export { RelanceDevis } from "./RelanceDevis";
