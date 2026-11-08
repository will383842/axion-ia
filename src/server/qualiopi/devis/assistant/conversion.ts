/**
 * Conversion payload ↔ entrées des actions EXISTANTES (fiche S04). PUR : aucun import prisma.
 *
 * L'assistant ne crée jamais un devis lui-même : il produit l'entrée de `createDevisAction`
 * (classique) ou de `creerDevisFormulesAction` (formules). Le serveur REJOUE cette conversion
 * (S08) ; il ne croit pas celle de l'écran. Aucun second convertisseur de formules :
 * `construireOffre` / `offreVersSaisie` (saisie.ts) font le travail, après le mapping D1 de
 * `saisieFormulesPourOffre` (validation-etapes.ts).
 *
 * Règles (DECISIONS-D1-D2-ARCHITECTE.md) : aucune `tauxTvaPercent` transmise en classique ;
 * taux des lignes et de l'abonnement = taux standard reçu ; `automatisations` recopiées telles
 * quelles (jamais réécrites) ; aucune `modeAvance` écrite par l'assistant ; montants en chaînes
 * puis `normaliserEuros` + `eurosVersCents`, jamais `parseFloat`.
 *
 * Limite connue (ESCALADE) : le payload ne porte pas de taux de TVA par ligne ni plusieurs
 * lignes de mise en service pour « A + B ». Une offre existante à taux non standard, ou à
 * plusieurs lignes de mise en service en « A + B », ne se re-sérialise donc PAS à l'identique.
 */
import {
  construireOffre,
  eurosVersCents,
  offreVersSaisie,
  type TexteCopie,
} from "@/components/admin/qualiopi/devis-formules/saisie";
import { CENTS_MAX, offreDevisV1, type OffreDevisV1 } from "@/server/qualiopi/devis/offre-devis";
import { TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";
import {
  normaliserEuros,
  payloadVide,
  type ActiviteAssistant,
  type LigneClassiqueSaisie,
  type PayloadAssistantV1,
} from "./payload";
import {
  saisieFormulesPourOffre,
  validerEtape,
  type ContexteValidation,
  type ErreurChamp,
} from "./validation-etapes";

export interface EntreeDevisClassique {
  clientId: string;
  lignes: Array<{
    designation: string;
    quantite: number;
    prixUnitaireHtCents: number;
    offreCode?: string;
    offreTierId?: string;
  }>;
  activite?: ActiviteAssistant;
  refClient?: string;
  financementSuggere?: "direct" | "opco" | "cpf" | "france_travail";
  nbParticipants?: number;
  dureeHeures?: number;
  modaliteOpco?: "intra" | "inter_presentiel" | "inter_distanciel";
  opcoEnveloppeRestanteCents?: number;
  dateDebutSessionPrevue?: string;
  projetId?: string;
}

export interface EntreeDevisFormules {
  clientId: string;
  offre: OffreDevisV1;
  activite: "implementation" | "site_web";
  refClient?: string;
  projetId?: string;
}

export interface ContexteConversion extends ContexteValidation {
  /** Client du projet, relu en base par l'appelant : `projetId` n'est transmis que s'il coïncide. */
  clientIdDuProjet?: string | null;
}

export type ResultatConversion =
  | { type: "classique"; input: EntreeDevisClassique }
  | { type: "formules"; input: EntreeDevisFormules }
  | { erreurs: ErreurChamp[] };

type Erreurs = ErreurChamp[];
const err = (e: Erreurs, champ: string, message: string) => e.push({ champ, message });
const REF_MAX = 120;

function communs(p: PayloadAssistantV1, ctx: ContexteConversion, e: Erreurs) {
  const out: { refClient?: string; projetId?: string } = {};
  const ref = p.refClient.trim();
  if (ref.length > REF_MAX)
    err(e, "refClient", `Référence client : ${REF_MAX} caractères au plus.`);
  else if (ref !== "") out.refClient = ref;
  // Même garde que DevisForm : le projet n'est transmis que si le client choisi est le sien.
  if (p.projetId && ctx.clientIdDuProjet && ctx.clientIdDuProjet === p.clientId)
    out.projetId = p.projetId;
  return out;
}

function lireOpco(p: PayloadAssistantV1, e: Erreurs) {
  const o = p.opco;
  const out: Partial<EntreeDevisClassique> = {};
  if (o.financementSuggere) out.financementSuggere = o.financementSuggere;
  if (o.modaliteOpco) out.modaliteOpco = o.modaliteOpco;
  if (o.nbParticipants?.trim()) {
    const t = o.nbParticipants.trim();
    if (/^\d+$/.test(t) && Number(t) >= 1) out.nbParticipants = Number(t);
    else err(e, "opco.nbParticipants", "Nombre de participants : entier d'au moins 1.");
  }
  if (o.dureeHeures?.trim()) {
    const t = o.dureeHeures.trim().replace(",", ".");
    if (/^\d+(\.\d{1,2})?$/.test(t) && Number(t) > 0) out.dureeHeures = Number(t);
    else err(e, "opco.dureeHeures", "Durée en heures illisible.");
  }
  if (o.enveloppeRestanteEur?.trim()) {
    const c = eurosVersCents(normaliserEuros(o.enveloppeRestanteEur));
    if (c !== null && c <= CENTS_MAX) out.opcoEnveloppeRestanteCents = c;
    else err(e, "opco.enveloppeRestanteEur", "Enveloppe restante illisible (euros).");
  }
  if (o.dateDebutSessionPrevue?.trim())
    out.dateDebutSessionPrevue = o.dateDebutSessionPrevue.trim();
  return out;
}

/** Textes D1 d'un devis À FORMULES : récit du projet injecté comme textes actifs (jamais de montant). */
function textesInjectes(p: PayloadAssistantV1): TexteCopie[] {
  const garantie = p.nonImprime["phraseGarantie"];
  const sources = [
    p.recit.intitule,
    p.recit.besoinClient,
    p.recit.resultatVise,
    typeof garantie === "string" ? garantie : "",
  ];
  const deja = new Set(p.textes.map((t) => t.texte));
  const out: TexteCopie[] = [...p.textes];
  for (const s of sources) {
    const texte = s.trim();
    if (texte !== "" && !deja.has(texte)) {
      deja.add(texte);
      out.push({ texte, actif: true });
    }
  }
  return out;
}

export function payloadVersCreation(
  p: PayloadAssistantV1,
  ctx: ContexteConversion,
): ResultatConversion {
  const v = validerEtape(p, 3, ctx);
  if (!v.ok) return { erreurs: v.erreurs };
  const e: Erreurs = [];
  const clientId = p.clientId as string;
  const base = communs(p, ctx, e);

  if (p.typeDevis === "classique") {
    const lignes: EntreeDevisClassique["lignes"] = [];
    p.lignesClassiques.forEach((l, i) => {
      const prix = eurosVersCents(normaliserEuros(l.prixEur));
      if (prix === null) return err(e, `lignesClassiques.${i}.prixEur`, "Prix illisible.");
      if (l.designation.length > 500)
        return err(e, `lignesClassiques.${i}.designation`, "Désignation : 500 caractères au plus.");
      lignes.push({
        designation: l.designation,
        quantite: Number(l.quantite.trim().replace(",", ".")),
        prixUnitaireHtCents: prix,
        ...(l.offreCode !== undefined ? { offreCode: l.offreCode } : {}),
        ...(l.offreTierId !== undefined ? { offreTierId: l.offreTierId } : {}),
      });
    });
    const opco = lireOpco(p, e);
    if (e.length > 0) return { erreurs: e };
    return {
      type: "classique",
      // Aucun `tauxTvaPercent` : le taux se dérive du régime en aval.
      input: {
        clientId,
        lignes,
        ...(p.activite ? { activite: p.activite } : {}),
        ...base,
        ...opco,
      },
    };
  }

  const r = construireOffre(
    saisieFormulesPourOffre(p, ctx.tauxStandard ?? TAUX_TVA_STANDARD),
    textesInjectes(p),
  );
  if (!r.ok) return { erreurs: r.erreurs.map((m) => ({ champ: "formules", message: m })) };
  if (e.length > 0) return { erreurs: e };
  return {
    type: "formules",
    input: {
      clientId,
      offre: r.offre,
      activite: p.activite as "implementation" | "site_web",
      ...base,
    },
  };
}

// ───────────────────────── devis existant → payload ─────────────────────────

export interface DevisPourAssistant {
  id: string;
  clientId: string;
  refClient: string | null;
  activite: ActiviteAssistant | null;
  dateValidite: Date | null;
  updatedAt: Date;
  /** Offre enregistrée (`null` = devis classique). */
  offre: unknown;
  /** Lignes enregistrées (JSON) d'un devis classique. */
  lignes: unknown;
}

/** Centimes entiers → « 12.5 » / « 12 » (division entière : aucun flottant). */
function centsVersTexte(c: number): string {
  const e = Math.floor(c / 100);
  const r = c % 100;
  return r === 0 ? String(e) : `${e}.${String(r).padStart(2, "0")}`;
}

function lignesClassiquesDe(brut: unknown): LigneClassiqueSaisie[] {
  if (!Array.isArray(brut)) return [];
  const out: LigneClassiqueSaisie[] = [];
  for (const l of brut) {
    if (!l || typeof l !== "object") continue;
    const x = l as Record<string, unknown>;
    const ligne: LigneClassiqueSaisie = {
      designation: typeof x["designation"] === "string" ? x["designation"] : "",
      quantite: String(x["quantite"] ?? "1"),
      prixEur:
        typeof x["prixUnitaireHtCents"] === "number"
          ? centsVersTexte(x["prixUnitaireHtCents"])
          : "",
    };
    if (typeof x["offreCode"] === "string") ligne.offreCode = x["offreCode"];
    if (typeof x["offreTierId"] === "string") ligne.offreTierId = x["offreTierId"];
    out.push(ligne);
  }
  return out;
}

/** Hydratation EN MÉMOIRE d'un devis brouillon (aucune écriture). Réutilise `offreVersSaisie`. */
export function devisVersPayload(
  d: DevisPourAssistant,
  tvaStandardPct: number,
): PayloadAssistantV1 {
  const p = payloadVide(tvaStandardPct);
  p.clientId = d.clientId;
  p.activite = d.activite;
  p.refClient = d.refClient ?? "";
  p.dateValidite = d.dateValidite ? d.dateValidite.toISOString().slice(0, 10) : null;
  p.sync = { devisId: d.id, devisMajLe: d.updatedAt.toISOString() };
  const offre = d.offre == null ? null : offreDevisV1.safeParse(d.offre);
  if (offre?.success) {
    const o = offre.data;
    p.typeDevis = "formules";
    p.formules = offreVersSaisie(o);
    p.textes = o.textes.map((t) => ({ ...t }));
    // D1 : lignes de l'étape 1 = lignes de A, ou mise en service de B seule.
    const source = o.achat ? o.achat.lignes : (o.abonnement?.miseEnServiceLignes ?? []);
    p.lignesClassiques = source.map((l) => ({
      designation: l.libelle,
      quantite: String(l.quantite),
      prixEur: centsVersTexte(l.prixHtCents),
    }));
  } else {
    p.typeDevis = "classique";
    const l = lignesClassiquesDe(d.lignes);
    if (l.length > 0) p.lignesClassiques = l;
  }
  return p;
}
