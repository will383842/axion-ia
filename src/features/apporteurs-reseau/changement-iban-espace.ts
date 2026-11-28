/**
 * Lot 5 : l'ÉTAT de la section « Mon compte bancaire » de l'espace apporteur.
 *
 * `etatSectionCompte` est PURE (testée aux bornes) ; `lireEtatSectionCompte` lit la base et
 * tolère la table absente (P2021 : le service se présente comme fermé). Aucun IBAN entier ne
 * sort d'ici : seulement les quatre derniers caractères.
 */
import { DELAI_OPPOSITION_MS, type StatutChangementIban } from "./changement-iban-regles";

export interface DemandeVue {
  readonly statut: StatutChangementIban;
  readonly demandeeAt: Date;
  readonly confirmeeAt?: Date | null;
  readonly motifRefus?: string | null;
}

export type EtatSection =
  | { etat: "absente" }
  | { etat: "ferme" }
  | { etat: "sans-telephone" }
  | { etat: "normal" }
  | { etat: "a-confirmer" }
  | { etat: "confirmee" }
  | { etat: "refusee"; motif: string };

export function dateReponseAuPlusTot(confirmeeAt: Date): Date {
  return new Date(confirmeeAt.getTime() + DELAI_OPPOSITION_MS);
}

export function etatSectionCompte(e: {
  signe: boolean;
  restreint: boolean;
  interrupteur: boolean;
  secret: boolean;
  aTelephone: boolean;
  demande: DemandeVue | null;
}): EtatSection {
  if (!e.signe || e.restreint) return { etat: "absente" };
  if (!e.interrupteur || !e.secret) return { etat: "ferme" };
  const d = e.demande;
  if (d?.statut === "a_confirmer") return { etat: "a-confirmer" };
  if (d?.statut === "confirmee") return { etat: "confirmee" };
  if (d?.statut === "refusee") return { etat: "refusee", motif: d.motifRefus ?? "" };
  if (!e.aTelephone) return { etat: "sans-telephone" };
  return { etat: "normal" };
}
