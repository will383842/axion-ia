/**
 * Assistant de devis — adaptateur écran ↔ payload serveur (fiche E17a). PUR, client-safe.
 *
 * `EtatAssistant` (écrans) → `PayloadAssistantV1` (serveur, étapes 1 à 4) et retour. AUCUN calcul
 * d'argent ici : les formules viennent de `versSaisie` (fiche E04), les lignes et montants sont
 * recopiés en CHAÎNES ; le serveur rejoue lui-même validation et conversion.
 *
 * Aller-retour sans perte : l'état complet (`EtatSerialise`) voyage dans `nonImprime.ecran`.
 * Une seule clé y est renommée : `ia` → `choixIntelligence`. La garde S03 (`montantIA`) refuse en
 * effet toute clé « ia » qui n'est pas `nonImprime.ia` ; l'état de l'écran ne porte qu'un CHOIX
 * (mode, niveau, mois inclus en texte), jamais un montant, et le serveur lit les choix d'IA
 * imprimés dans `nonImprime.ia` (liste blanche), écrit ci-dessous.
 */
import type { TexteCopie } from "../devis-formules/saisie";
import type { PayloadAssistantV1 } from "@/server/qualiopi/devis/assistant/payload";
import { deserialiser, etatInitial, propositionEffective, serialiser } from "./etat";
import type { Etape, EtatAssistant, EtatSerialise } from "./types";
import { eurosEnCents, quantiteLue } from "./calculs";
import { versSaisie } from "./vers-offre";

export interface ContexteVersPayload {
  /** Taux de TVA standard (%), reçu des props. */
  tvaStandardPct: number;
  /** Textes actifs de la bibliothèque (ceux de la page). */
  textes: readonly TexteCopie[];
  /** Devis rouvert : lien posé sur `sync` (le serveur ne le croit pas, il lit la colonne). */
  devisId?: string | undefined;
  /** Références que l'écran ne saisit pas et qui ne doivent pas se perdre à la sauvegarde. */
  refClient?: string | undefined;
  venteBrouillonId?: string | null | undefined;
  modeleId?: string | null | undefined;
}

/** Clé de l'état écran dans `nonImprime`, et clé de remplacement pour `ia` (voir l'en-tête). */
export const CLE_ECRAN = "ecran";
const CLE_IA_ECRAN = "choixIntelligence";

const MOIS_IA_MAX = 120;

function iaImprimable(ia: EtatAssistant["ia"]): Record<string, unknown> {
  const mois = ia.achat.moisInclus.trim();
  const moisLus = /^\d+$/.test(mois) && Number(mois) <= MOIS_IA_MAX ? Number(mois) : null;
  return {
    achat: {
      mode: ia.achat.mode,
      ...(ia.achat.mode === "incluse" && moisLus !== null ? { mois: moisLus } : {}),
    },
    abonnement: { inclus: ia.abonnement.mode === "incluse", niveau: ia.abonnement.niveau },
  };
}

function ecranSansCleIA(s: EtatSerialise): Record<string, unknown> {
  const { ia, ...reste } = s.etat;
  return { v: s.v, etape: s.etape, etat: { ...reste, [CLE_IA_ECRAN]: ia } };
}

function ecranDepuisPayload(brut: unknown): unknown {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return brut;
  const s = brut as { etat?: unknown };
  if (typeof s.etat !== "object" || s.etat === null || Array.isArray(s.etat)) return brut;
  const { [CLE_IA_ECRAN]: ia, ...reste } = s.etat as Record<string, unknown>;
  return { ...s, etat: ia === undefined ? reste : { ...reste, ia } };
}

export function etatVersPayload(
  etat: EtatAssistant,
  etape: Etape,
  ctx: ContexteVersPayload,
): PayloadAssistantV1 {
  const classique = propositionEffective(etat) === "prix_unique";
  const f = etat.financement;
  const opco: PayloadAssistantV1["opco"] = {};
  if (classique && f.mode !== "") {
    opco.financementSuggere = f.mode;
    if (f.mode === "opco") {
      // Champs d'un ancien brouillon : plus aucun écran ne les affiche (PR 2050), donc une
      // valeur illisible n'est pas envoyée (le serveur la refuserait sur un champ que
      // l'utilisateur ne peut plus corriger) — même règle que `vers-offre.ts`. Une valeur
      // lisible est envoyée telle quelle : aucune donnée n'est perdue.
      const nb = f.nbParticipants.trim();
      if (/^\d+$/.test(nb) && Number(nb) > 0) opco.nbParticipants = nb;
      const heures = f.dureeHeures.trim();
      if (quantiteLue(heures) !== null) opco.dureeHeures = heures;
      if (f.modaliteOpco !== "") opco.modaliteOpco = f.modaliteOpco;
      if (f.enveloppeRestante.trim() !== "" && eurosEnCents(f.enveloppeRestante) !== null)
        opco.enveloppeRestanteEur = f.enveloppeRestante;
    }
    if (f.dateDebutSession !== "") opco.dateDebutSessionPrevue = f.dateDebutSession;
  }
  const nonImprime: Record<string, unknown> = {
    [CLE_ECRAN]: ecranSansCleIA(serialiser(etat, etape)),
    ia: iaImprimable(etat.ia),
  };
  if (etat.garantie.afficher && etat.garantie.phrase.trim() !== "")
    nonImprime["phraseGarantie"] = etat.garantie.phrase.trim();
  // Délais saisis à l'écran : lus par le serveur pour les conditions particulières du prix unique.
  const delaisTexte = etat.delais.texte.trim();
  const delaisFourchette = etat.delais.fourchette.trim();
  if (delaisTexte !== "" || delaisFourchette !== "")
    nonImprime["delais"] = { texte: delaisTexte, fourchette: delaisFourchette };

  return {
    v: 1,
    // L'étape « 1b » (phases) appartient à l'étape 1 du serveur.
    etape: etape === "1b" ? 1 : etape,
    modeleId: ctx.modeleId ?? null,
    clientId: etat.clientId === "" ? null : etat.clientId,
    projetId: etat.origine.projetId ?? null,
    rencontreId: etat.origine.rencontreId ?? null,
    venteBrouillonId: ctx.venteBrouillonId ?? null,
    activite: etat.modele,
    typeDevis: classique ? "classique" : "formules",
    refClient: ctx.refClient ?? "",
    dateValidite: etat.validite === "" ? null : etat.validite,
    recit: {
      intitule: etat.intitule,
      besoinClient: etat.motsDuClient,
      resultatVise: etat.resultatVise,
      valeurClient: etat.valeurClient,
    },
    lignesClassiques: etat.lignes.map((l) => ({
      designation: l.libelle,
      quantite: l.quantite,
      prixEur: l.prixEur,
      ...(l.offreCode !== "" ? { offreCode: l.offreCode } : {}),
      ...(l.offreCode !== "" && l.offreTierId ? { offreTierId: l.offreTierId } : {}),
    })),
    opco,
    // Le SEUL calcul de saisie des formules : celui de l'écran (E04), pas un second.
    formules: versSaisie(etat, ctx.tvaStandardPct).saisie,
    textes: ctx.textes.map((t) => ({ ...t })),
    // Prix unique seulement : une proposition à formules n'imprime jamais cette garantie.
    journeeIa: classique && etat.garantieJournee === true,
    nonImprime,
    sync: { devisId: ctx.devisId ?? null, devisMajLe: null },
  };
}

export interface EtatDepuisPayload {
  etat: EtatAssistant;
  etape: Etape;
  /** `ecran` : relu à l'identique ; `payload` : reconstitué a minima (client et projet seulement). */
  source: "ecran" | "payload";
}

export interface ParamsEtatVide {
  validiteParDefaut?: string;
  formulesActives?: boolean;
}

export function payloadVersEtat(
  payload: PayloadAssistantV1,
  params: ParamsEtatVide = {},
): EtatDepuisPayload {
  const lu = deserialiser(ecranDepuisPayload(payload.nonImprime[CLE_ECRAN]));
  // La case vient du payload (relu de la colonne `Devis.journeeIa`), pas de l'état d'écran figé.
  if (lu.ok)
    return {
      etat: { ...lu.etat, garantieJournee: payload.journeeIa === true },
      etape: lu.etape,
      source: "ecran",
    };
  const etat = etatInitial({
    defaultClientId: payload.clientId ?? undefined,
    projetId: payload.projetId ?? undefined,
    rencontreId: payload.rencontreId ?? undefined,
    validiteParDefaut: params.validiteParDefaut ?? payload.dateValidite ?? "",
    formulesActives: params.formulesActives ?? false,
  });
  etat.garantieJournee = payload.journeeIa === true;
  return { etat, etape: 1, source: "payload" };
}
