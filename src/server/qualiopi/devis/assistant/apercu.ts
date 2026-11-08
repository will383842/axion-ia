/**
 * Aperçu en direct de l'assistant (fiche S07). PUR côté données : aucun accès base, aucune
 * écriture, aucun numéro. SEULE source des montants par phase pendant la saisie.
 *
 * Aucun calcul propre : le classique passe par `computeTotauxFacture`, les formules par
 * `vueFormules` sur l'offre produite par la conversion S04 — exactement ce que
 * `donneesPdfDevis` imprimera (test d'égalité stricte). Offre impossible à construire :
 * `erreurs` renseignées et AUCUN chiffre.
 */
import {
  computeTotauxFacture,
  mentionTva,
  type RegimeTva,
  type TotauxFacture,
} from "@/server/qualiopi/legal/tva";
import { vueFormules, type VueFormules } from "@/server/qualiopi/devis/vue-formules";
import { type PayloadAssistantV1 } from "./payload";
import { payloadVersCreation } from "./conversion";
import type { ErreurChamp } from "./validation-etapes";

export interface ApercuAssistant {
  regimeTva: RegimeTva;
  mentionTva: string | null;
  classique?: {
    lignes: Array<{ designation: string; totalHtCents: number }>;
    totaux: TotauxFacture;
  };
  /** EXACTEMENT ce que le PDF imprimera. */
  formules?: VueFormules;
  alertes: string[];
  erreurs: ErreurChamp[];
}

export interface ContexteApercu {
  regime: RegimeTva;
  tauxStandard: number;
  formulesActives: boolean;
  typeClient?: "entreprise" | "particulier" | null;
  maintenant?: Date;
  automatisationsHeritees?: readonly unknown[];
  clientIdDuProjet?: string | null;
}

export function calculerApercu(p: PayloadAssistantV1, ctx: ContexteApercu): ApercuAssistant {
  const sortie: ApercuAssistant = {
    regimeTva: ctx.regime,
    mentionTva: mentionTva(ctx.regime),
    alertes: [],
    erreurs: [],
  };
  const r = payloadVersCreation(p, {
    formulesActives: ctx.formulesActives,
    typeClient: ctx.typeClient ?? null,
    maintenant: ctx.maintenant ?? new Date(),
    tauxStandard: ctx.tauxStandard,
    ...(ctx.automatisationsHeritees !== undefined
      ? { automatisationsHeritees: ctx.automatisationsHeritees }
      : {}),
    ...(ctx.clientIdDuProjet !== undefined ? { clientIdDuProjet: ctx.clientIdDuProjet } : {}),
  });
  if ("erreurs" in r) {
    sortie.erreurs = r.erreurs;
    for (const e of r.erreurs)
      if (e.champ === "lignesClassiques" || /pourcentage|100/.test(e.message))
        sortie.alertes.push(e.message);
    return sortie;
  }
  if (r.type === "classique") {
    const lignes = r.input.lignes.map((l) => ({
      quantite: l.quantite,
      prixUnitaireHtCents: l.prixUnitaireHtCents,
    }));
    const totaux = computeTotauxFacture(lignes, ctx.regime, ctx.tauxStandard);
    sortie.classique = {
      lignes: r.input.lignes.map((l) => ({
        designation: l.designation,
        totalHtCents: computeTotauxFacture(
          [{ quantite: l.quantite, prixUnitaireHtCents: l.prixUnitaireHtCents }],
          ctx.regime,
          ctx.tauxStandard,
        ).totalHtCents,
      })),
      totaux,
    };
    return sortie;
  }
  sortie.formules = vueFormules(r.input.offre, ctx.regime);
  if (r.input.offre.formulesProposees.length === 2)
    sortie.alertes.push("Deux formules proposées : le total dépend du choix du client.");
  return sortie;
}
