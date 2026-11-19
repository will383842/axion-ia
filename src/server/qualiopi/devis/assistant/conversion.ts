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

/** Lit un champ d'IA de la liste blanche (S03) sans rien supposer sur le reste de `nonImprime`. */
const objet = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/**
 * Phrase d'IA d'UNE formule, tirée d'une table fermée des choix permis (jamais de montant,
 * aucun texte libre). Choix inconnu ou absent : aucune phrase.
 */
function phraseIA(formule: "achat" | "abonnement", choix: unknown): string | null {
  const c = typeof choix === "string" ? { mode: choix } : objet(choix);
  if (!c) return null;
  if (formule === "achat") {
    if (c["mode"] === "compte_client")
      return "L'utilisation de l'IA se fait avec le compte du client.";
    if (c["mode"] === "incluse") {
      const mois = c["mois"];
      return typeof mois === "number" && Number.isInteger(mois) && mois > 0
        ? `L'utilisation de l'IA est incluse pendant ${mois} mois.`
        : null;
    }
    return null;
  }
  const niveaux: Record<string, string> = { essentiel: "Essentiel", pro: "Pro", etendu: "Étendu" };
  if (c["inclus"] === true) {
    const niveau = typeof c["niveau"] === "string" ? niveaux[c["niveau"]] : undefined;
    return niveau
      ? `L'utilisation de l'IA est incluse dans l'abonnement (niveau ${niveau}).`
      : "L'utilisation de l'IA est incluse dans l'abonnement.";
  }
  if (c["inclus"] === false) return "L'utilisation de l'IA n'est pas incluse dans l'abonnement.";
  return null;
}

/** Textes D1 d'un devis À FORMULES : récit du projet et choix d'IA par formule, injectés comme textes actifs (jamais de montant). */
/**
 * Marqueur interne (champ `version`, jamais imprimé) posé sur le texte d'intitulé injecté :
 * seul moyen sûr de le reconnaître à la réouverture, l'intitulé étant facultatif et placé
 * après les textes de l'utilisateur.
 */
export const VERSION_TEXTE_INTITULE = "assistant:intitule";

function textesInjectes(p: PayloadAssistantV1): TexteCopie[] {
  const garantie = p.nonImprime["phraseGarantie"];
  const ia = objet(p.nonImprime["ia"]);
  const phrase = (f: "achat" | "abonnement", prefixe: string): string => {
    if (!p.formules.formules[f] || !ia) return "";
    const t = phraseIA(f, ia[f]);
    return t ? `${prefixe}${t}` : "";
  };
  const sources = [
    p.recit.intitule,
    p.recit.besoinClient,
    p.recit.resultatVise,
    typeof garantie === "string" ? garantie : "",
    phrase("achat", "Formule A : "),
    phrase("abonnement", "Formule B : "),
  ];
  // Comparaison sur le texte rogné : un devis rouvert dont les textes sont déjà injectés ne
  // reçoit pas une seconde copie de l'intitulé ressaisi (ou repris tel quel) dans le récit.
  // Une phrase d'IA déjà injectée (« Formule A/B : … », texte libre) est REMPLACÉE, jamais
  // doublée : on l'écarte dès que le choix d'IA de la formule est (re)posé, ou que la formule
  // n'est plus proposée (sinon l'ancienne phrase contredirait la nouvelle).
  const aEcarter = (t: TexteCopie): boolean => {
    if (t.bibliothequeId !== undefined) return false;
    return (["achat", "abonnement"] as const).some((f) => {
      const prefixe = f === "achat" ? "Formule A :" : "Formule B :";
      if (!t.texte.trim().startsWith(prefixe)) return false;
      return !p.formules.formules[f] || (ia !== null && f in ia);
    });
  };
  const conserves = p.textes.filter((t) => !aEcarter(t));
  const deja = new Set(conserves.map((t) => t.texte.trim()));
  const out: TexteCopie[] = [...conserves];
  sources.forEach((s, i) => {
    const texte = s.trim();
    if (texte !== "" && !deja.has(texte)) {
      deja.add(texte);
      out.push(
        i === 0 ? { texte, actif: true, version: VERSION_TEXTE_INTITULE } : { texte, actif: true },
      );
    }
  });
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
  /** Financement suggéré / estimation OPCO d'un devis classique : l'assistant ne les porte pas. */
  financementSuggere?: string | null;
  montantOpcoEstimeCents?: number | null;
}

/** Résultat de la réouverture : le payload, ou un refus motivé (renvoi vers la fiche du devis). */
export type ResultatOuverture =
  { payload: PayloadAssistantV1 } | { refus: string; motif: MotifRefus };

/** `opco` : seul refus que lève un brouillon lié lisible (cf. `charger.ts`). */
export type MotifRefus = "opco" | "offre_illisible" | "tva_non_standard";

const refus = (texte: string, motif: MotifRefus): { refus: string; motif: MotifRefus } => ({
  refus: `Ce devis ne peut pas être rouvert dans l'assistant : ${texte} Modifiez-le depuis sa fiche.`,
  motif,
});

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

/** Taux de TVA enregistré (points de base) ≠ taux standard reçu. */
const bpsNonStandard = (bps: number, tvaStandardPct: number): boolean =>
  bps !== Math.round(tvaStandardPct * 100);

/**
 * Hydratation EN MÉMOIRE d'un devis brouillon (aucune écriture). Réutilise `offreVersSaisie`.
 * REFUSE l'ouverture (jamais de perte silencieuse) pour :
 *  - une offre présente mais illisible (jamais de bascule en classique) ;
 *  - un devis classique avec financement ou estimation OPCO (l'assistant ne les relit pas) ;
 *  - une ligne existante à TVA non standard (le payload ne porte pas de taux par ligne).
 */
export function devisVersPayload(d: DevisPourAssistant, tvaStandardPct: number): ResultatOuverture {
  const p = payloadVide(tvaStandardPct);
  p.clientId = d.clientId;
  p.activite = d.activite;
  p.refClient = d.refClient ?? "";
  p.dateValidite = d.dateValidite ? d.dateValidite.toISOString().slice(0, 10) : null;
  p.sync = { devisId: d.id, devisMajLe: d.updatedAt.toISOString() };
  if (d.offre != null) {
    const offre = offreDevisV1.safeParse(d.offre);
    if (!offre.success) return refus("son offre est illisible.", "offre_illisible");
    const o = offre.data;
    const taux = [
      ...(o.achat?.lignes ?? []).map((l) => l.tauxTvaBps),
      ...(o.abonnement?.miseEnServiceLignes ?? []).map((l) => l.tauxTvaBps),
      ...(o.abonnement ? [o.abonnement.tauxTvaBps] : []),
    ];
    if (taux.some((t) => bpsNonStandard(t, tvaStandardPct)))
      return refus("une ligne a un taux de TVA différent du taux standard.", "tva_non_standard");
    p.typeDevis = "formules";
    p.formules = offreVersSaisie(o);
    p.textes = o.textes.map((t) => ({ ...t }));
    // Texte d'intitulé injecté à l'enregistrement : on le rend au récit (et on le retire des
    // textes) pour que ressaisir l'intitulé le REMPLACE à la prochaine conversion. Seul le
    // texte portant le marqueur d'injection est repris ; sans marqueur on ne devine rien
    // (un « besoin client » ou un texte libre ne doit jamais passer pour l'intitulé).
    const iIntitule = p.textes.findIndex(
      (t) => t.bibliothequeId === undefined && t.version === VERSION_TEXTE_INTITULE,
    );
    if (iIntitule >= 0) {
      p.recit.intitule = p.textes[iIntitule]!.texte;
      p.textes.splice(iIntitule, 1);
    }
    // D1 : lignes de l'étape 1 = lignes de A, ou mise en service de B seule.
    const source = o.achat ? o.achat.lignes : (o.abonnement?.miseEnServiceLignes ?? []);
    p.lignesClassiques = source.map((l) => ({
      designation: l.libelle,
      quantite: String(l.quantite),
      prixEur: centsVersTexte(l.prixHtCents),
    }));
  } else {
    if (Array.isArray(d.lignes)) {
      for (const l of d.lignes) {
        const x = l && typeof l === "object" ? (l as Record<string, unknown>) : {};
        const pct = x["tauxTvaPercent"];
        const bps = x["tauxTvaBps"];
        if (
          (typeof pct === "number" && bpsNonStandard(Math.round(pct * 100), tvaStandardPct)) ||
          (typeof bps === "number" && bpsNonStandard(bps, tvaStandardPct))
        )
          return refus(
            "une ligne a un taux de TVA différent du taux standard.",
            "tva_non_standard",
          );
      }
    }
    // Le motif TVA passe AVANT l'OPCO : il n'est jamais levé par le passe-droit du brouillon lié
    // (charger.ts), qui ne lève que le motif « opco ».
    if (
      (d.financementSuggere != null && d.financementSuggere !== "direct") ||
      (d.montantOpcoEstimeCents ?? null) !== null
    )
      return refus("il porte un financement ou une estimation OPCO.", "opco");
    p.typeDevis = "classique";
    const l = lignesClassiquesDe(d.lignes);
    if (l.length > 0) p.lignesClassiques = l;
  }
  return { payload: p };
}
