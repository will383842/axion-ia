/**
 * Qualiopi — Données du PDF d'un devis, UNE source pour l'envoi et l'aperçu.
 *
 * `sendDevisAction` (envoi réel, pièce numérotée) et la route d'aperçu d'un
 * brouillon construisent le même `DevisData` : sinon l'aperçu montrerait autre
 * chose que ce qui partira chez le client.
 *
 *  - `donneesPdfDevis`      : fonction PURE (aucune lecture, aucune écriture,
 *                             pas d'horloge : la date arrive en paramètre).
 *  - `lireContextePdfDevis` : lectures de configuration seules (identité,
 *                             régime TVA, taux, drapeau de certification).
 */

import { getOrganismeIdentite, type OrganismeIdentite } from "./organisme";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import { regimeEstimationMutualisee } from "@/server/qualiopi/financements/estimation-certification";
import {
  ACTIVITE_LABELS,
  normaliserLignesPourActivite,
} from "@/server/qualiopi/financements/facture-libre-pur";
import {
  regimeTvaDepuisConfig,
  TAUX_TVA_STANDARD,
  type RegimeTva,
} from "@/server/qualiopi/legal/tva";
import { offreDevisV1 } from "@/server/qualiopi/devis/offre-devis";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import { vueFormules, type VueFormules } from "@/server/qualiopi/devis/vue-formules";
import type { DevisData } from "./templates/devis";
import type { LigneFacture } from "./templates/facture";

type Financement = "direct" | "opco" | "cpf" | "france_travail";

/** Libellés d'affichage du financement suggéré (PDF devis). */
const FINANCEMENT_LABELS: Record<Financement, string> = {
  direct: "Financement direct (fonds propres)",
  opco: "OPCO",
  cpf: "CPF",
  france_travail: "France Travail",
};

/** Assemble l'adresse d'affichage : structurée si présente, sinon champ libre. */
export function adresseClientDevis(client: {
  adresse: string | null;
  adresseRue: string | null;
  adresseCodePostal: string | null;
  adresseVille: string | null;
}): string | undefined {
  if (client.adresseRue && client.adresseVille) {
    return [
      client.adresseRue,
      [client.adresseCodePostal, client.adresseVille].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", ");
  }
  return client.adresse ?? undefined;
}

/** Champs du devis lus par le PDF (sous-ensemble du `select` de l'envoi). */
export interface DevisPourPdf {
  numero: string;
  lignes: unknown;
  activite: keyof typeof ACTIVITE_LABELS | null;
  refClient: string | null;
  financementSuggere: string | null;
  montantOpcoEstimeCents: number | null;
  resteAChargeCents: number | null;
  dateValidite: Date;
  /**
   * Offre à formules (Json). ABSENT ou NULL = devis classique, rendu inchangé.
   * Lue par `SELECT_DEVIS_POUR_PDF` (`offre: true`) : sans elle, l'aperçu imprimerait un
   * tableau vide à 0,00 €. Elle n'est exploitée que si l'interrupteur est allumé.
   */
  offre?: unknown;
  client: {
    type: string;
    raisonSociale: string;
    siret: string | null;
    adresse: string | null;
    adresseRue: string | null;
    adresseCodePostal: string | null;
    adresseVille: string | null;
    contactEmail: string | null;
  };
}

/** `select` Prisma des champs nécessaires à `DevisPourPdf`. */
export const SELECT_DEVIS_POUR_PDF = {
  numero: true,
  statut: true,
  lignes: true,
  activite: true,
  refClient: true,
  financementSuggere: true,
  montantOpcoEstimeCents: true,
  resteAChargeCents: true,
  dateValidite: true,
  // Offre à formules : sans elle, l'aperçu d'un devis à formules rendrait un tableau vide à 0,00 €.
  offre: true,
  client: {
    select: {
      type: true,
      raisonSociale: true,
      siret: true,
      adresse: true,
      adresseRue: true,
      adresseCodePostal: true,
      adresseVille: true,
      contactEmail: true,
    },
  },
} as const;

export interface ContextePdfDevis {
  identite: OrganismeIdentite;
  regimeTva: RegimeTva;
  tauxStandard: number;
  certificationObtenue: boolean;
  /**
   * Interrupteur `qualiopi.devis_formules.actif`. Absent = ÉTEINT : une offre éventuelle
   * est alors ignorée et le devis est rendu comme avant.
   */
  formulesActives?: boolean | undefined;
}

/** Une offre stockée est illisible : on n'imprime pas un devis à 0 € à sa place. */
export class OffreDevisInvalideError extends Error {
  constructor(detail: string) {
    super(`Offre du devis invalide : ${detail}`);
    this.name = "OffreDevisInvalideError";
  }
}

/**
 * Vue des formules, ou `undefined` si l'interrupteur est éteint ou si le devis n'a pas
 * d'offre. UNE seule porte pour le PDF et pour l'e-mail.
 */
export function formulesDuDevis(
  offre: unknown,
  actif: boolean | undefined,
  regime: RegimeTva = "assujetti",
): VueFormules | undefined {
  if (actif !== true || offre === null || offre === undefined) return undefined;
  const parsed = offreDevisV1.safeParse(offre);
  if (!parsed.success) {
    throw new OffreDevisInvalideError(parsed.error.issues[0]?.message ?? "schéma non conforme");
  }
  return vueFormules(parsed.data, regime);
}

/** Lectures de configuration (aucune écriture). */
export async function lireContextePdfDevis(): Promise<ContextePdfDevis> {
  const identite = await getOrganismeIdentite();
  const regimeTva: RegimeTva = regimeTvaDepuisConfig(await getQualiopiConfig("regime_tva"));
  const tauxStandard = (await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD;
  return {
    identite,
    regimeTva,
    tauxStandard,
    certificationObtenue: isQualiopiCertificationObtenue(),
    formulesActives: await formulesActives(),
  };
}

/** Construit le `DevisData` du PDF. Pure : mêmes entrées, mêmes données. */
export function donneesPdfDevis(
  devis: DevisPourPdf,
  contexte: ContextePdfDevis,
  maintenant: Date,
): DevisData {
  const { identite, regimeTva, tauxStandard } = contexte;

  const lignesBrutes = (Array.isArray(devis.lignes)
    ? devis.lignes
    : []) as unknown as LigneFacture[];
  const lignes =
    devis.activite !== null
      ? normaliserLignesPourActivite(lignesBrutes, devis.activite, regimeTva, tauxStandard)
      : lignesBrutes;

  const formatDate = (d: Date) => d.toLocaleDateString("fr-FR");
  const adresse = adresseClientDevis(devis.client);
  const financementLabel =
    devis.financementSuggere !== null
      ? (FINANCEMENT_LABELS[devis.financementSuggere as Financement] ?? devis.financementSuggere)
      : undefined;

  // Sous-lot 8G — décidé UNE fois, ici, avec l'état réel du drapeau, puis
  // transmis au gabarit. Le gabarit ne lit pas la configuration : un PDF qui
  // consulterait l'environnement rendrait deux pièces différentes pour le
  // même devis selon l'endroit d'où on le regénère.
  const regimeEstimation = regimeEstimationMutualisee(
    devis.financementSuggere,
    contexte.certificationObtenue,
  );

  const formules = formulesDuDevis(devis.offre, contexte.formulesActives, regimeTva);

  return {
    numero: devis.numero,
    dateEmission: formatDate(maintenant),
    dateValidite: formatDate(devis.dateValidite),
    identite,
    client: {
      // Un devis part TOUJOURS au client lui-meme : pas de destinataire tiers
      // ici, contrairement a la facture (OPCO, France Travail, beneficiaire).
      // Le predicat se reduit donc au type du client.
      estPersonnePhysique: devis.client.type === "particulier",
      raisonSociale: devis.client.raisonSociale,
      ...(devis.client.siret !== null ? { siret: devis.client.siret } : {}),
      ...(adresse !== undefined ? { adresse } : {}),
      ...(devis.client.contactEmail !== null ? { email: devis.client.contactEmail } : {}),
    },
    lignes,
    ...(formules !== undefined ? { formules } : {}),
    regimeTva,
    tauxTvaStandardPercent: tauxStandard,
    ...(devis.refClient !== null ? { refClient: devis.refClient } : {}),
    ...(devis.activite !== null ? { activiteLabel: ACTIVITE_LABELS[devis.activite] } : {}),
    ...(financementLabel !== undefined ? { financementSuggere: financementLabel } : {}),
    // 🔴 Sous-lot 8G — les montants d'estimation ne partent au PDF que si le
    // financement mutualisé est réellement accessible. Sinon la pièce porte
    // la mention à leur place : l'accès aux fonds OPCO/CPF/France Travail est
    // subordonné à la certification (L.6316-1), et un devis est l'offre que
    // le client accepte, pas une note de travail.
    ...(regimeEstimation.presentable
      ? {
          ...(devis.montantOpcoEstimeCents !== null
            ? { montantOpcoEstimeCents: devis.montantOpcoEstimeCents }
            : {}),
          ...(devis.resteAChargeCents !== null
            ? { resteAChargeCents: devis.resteAChargeCents }
            : {}),
        }
      : { mentionEstimationIndisponible: regimeEstimation.mention ?? "" }),
  };
}
