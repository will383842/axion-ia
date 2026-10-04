/**
 * Qualiopi — les DEUX circuits de paiement d'une session financée par un OPCO
 * (lot A8c, demande de Williams du 04/10/2026 : « il faut que les deux cas
 * fonctionnent »). Module PUR.
 *
 * Depuis la réforme du 1/10/2026 (`regime-paiement-opco.ts`), le régime
 * calculé est une INDICATION ; ce qui fait foi pour la facturation est la
 * décision portée par la session, `opcoSubrogation`, gardée par
 * `setFinancementSessionAction` (refus sans accord écrit quand le régime exclut
 * la subrogation). D'où deux circuits :
 *
 * | Circuit         | Qui paie l'organisme                     | Factures                                    |
 * | --------------- | ---------------------------------------- | ------------------------------------------- |
 * | `subrogation`   | l'OPCO sa part, l'entreprise le reste    | une à l'OPCO + une à l'entreprise si reste  |
 * | `remboursement` | l'entreprise, TOUT ; l'OPCO la rembourse | UNE à l'entreprise, JAMAIS à l'OPCO         |
 *
 * 🔴 Défaut fermé ici (audit A8c) : la page Financement présélectionnait
 * « OPCO » comme destinataire dès que le financement était OPCO, subrogation
 * ou non ; et sans créance au dossier, l'émission acceptait ce choix — une
 * facture à l'OPCO dans le circuit où l'OPCO ne paie jamais l'organisme.
 */

import type { FactureFormationDestinataire } from "../../../../prisma/generated/client";

export type CircuitPaiementOpco = "subrogation" | "remboursement" | "hors_opco";

export interface SessionCircuit {
  financementType: string | null | undefined;
  opcoSubrogation: boolean;
}

/** Même ensemble que `financementAdmetSubrogation` (`dossier-auto.ts`). */
function financeParOpco(financementType: string | null | undefined): boolean {
  const t = (financementType ?? "").trim().toLowerCase();
  return t === "opco" || t === "mixte";
}

export function circuitPaiementSession(s: SessionCircuit): CircuitPaiementOpco {
  if (!financeParOpco(s.financementType)) return "hors_opco";
  return s.opcoSubrogation ? "subrogation" : "remboursement";
}

/** Destinataire présélectionné par l'écran de génération de facture. */
export function destinataireFactureParDefaut(s: SessionCircuit): FactureFormationDestinataire {
  const circuit = circuitPaiementSession(s);
  if (circuit === "subrogation") return "opco";
  if (circuit === "remboursement") return "entreprise";
  if (s.financementType === "france_travail") return "france_travail";
  if (s.financementType === "cpf") return "stagiaire";
  return "entreprise";
}

/**
 * Le destinataire demandé est-il compatible avec le circuit de la session ?
 * Rend le refus à afficher tel quel, ou `null`.
 *
 * Seul « opco » est contrôlé : c'est la seule confusion que la réforme a
 * rendue possible. Les autres destinataires restent arbitrés par les créances
 * du dossier (`facture-par-creance.ts`).
 */
export function refusDestinataireFacture(
  destinataire: FactureFormationDestinataire,
  s: SessionCircuit,
): string | null {
  if (destinataire !== "opco") return null;
  const circuit = circuitPaiementSession(s);
  if (circuit === "subrogation") return null;
  if (circuit === "remboursement") {
    return (
      "Facture à l'OPCO refusée : sans subrogation, l'OPCO rembourse l'entreprise, il ne paie pas l'organisme. " +
      "Émettez une seule facture, du montant total, à l'entreprise ; elle la présentera à son OPCO avec le certificat de réalisation."
    );
  }
  return "Facture à l'OPCO refusée : cette session n'est pas financée par un OPCO.";
}

/**
 * Une facture SOLDÉE ouvre-t-elle la transmission des pièces de remboursement
 * à l'entreprise (facture acquittée + certificat de réalisation) ?
 *
 * Oui seulement dans le circuit `remboursement`, sur la facture d'origine
 * adressée à l'entreprise. En subrogation, l'organisme se fait payer par
 * l'OPCO lui-même : l'entreprise n'a rien à se faire rembourser.
 */
export function factureOuvreLaTransmissionRemboursement(f: {
  destinataire: FactureFormationDestinataire;
  subrogation: boolean;
  avoirDeId: string | null;
  session: SessionCircuit | null;
}): boolean {
  if (f.avoirDeId !== null || f.subrogation) return false;
  if (f.destinataire !== "entreprise" || f.session === null) return false;
  return circuitPaiementSession(f.session) === "remboursement";
}
