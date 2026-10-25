// Le type d'un rendez-vous À LA LECTURE — colonne d'abord, nom en repli (2026-10-04).
//
// Chantier « Types de rendez-vous », lot L3. La colonne `typeRendezVous` est
// classée à l'écriture (lot L1, `type-rendez-vous.ts`) mais NULLABLE : une
// ligne écrite pendant la fenêtre de déploiement n'en a pas. Toute lecture
// passe donc par ici, jamais par la colonne seule.
//
// 🔑 Même règle que les clauses Prisma (`appel-apporteur.ts`, `rdv-salon.ts`) :
//   1. échange apporteur si la colonne OU le nom le dit (double verrou de la
//      garde CRM) ;
//   2. sinon la colonne, si elle est posée ;
//   3. sinon le nom (`classerParNom`).
// Un écran et un e-mail ne peuvent donc pas classer la même ligne différemment.

import { estRendezVousApporteur } from "@/server/calendly/appel-apporteur";
import {
  classerParNom,
  estVisioTourDeFranceIaParNom,
  estTypeRendezVous,
  type TypeRendezVous,
} from "@/server/calendly/type-rendez-vous";

export function typeEffectif(rdv: {
  readonly typeRendezVous?: string | null | undefined;
  readonly eventTypeName?: string | null | undefined;
}): TypeRendezVous {
  if (estRendezVousApporteur(rdv)) return "apporteur";
  if (estTypeRendezVous(rdv.typeRendezVous)) {
    // Écrite avant la migration du Tour (2026-10-27), la visio reste `autre` en base.
    if (rdv.typeRendezVous === "autre" && estVisioTourDeFranceIaParNom(rdv.eventTypeName)) {
      return "tour_de_france_ia";
    }
    return rdv.typeRendezVous;
  }
  return classerParNom(rdv.eventTypeName);
}
