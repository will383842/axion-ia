/**
 * Brouillon de l'assistant de création de devis — contrat de données v1 (fiche S02).
 *
 * PUR et client-safe : aucun import prisma, aucun module Node, aucun catalogue de prix.
 * Les montants sont des CHAÎNES saisies (« 1 190,50 ») ; la conversion en centimes se fait
 * ailleurs par `normaliserEuros` puis `eurosVersCents` (jamais de flottant libre). Rien n'est
 * deviné : un brouillon s'ouvre vide, sans prix ni modèle.
 */
import {
  saisieVide,
  type Engagement,
  type LigneSaisie,
  type MoisPeriode,
  type PhaseSaisie,
  type Preavis,
  type SaisieFormules,
  type TexteCopie,
} from "@/components/admin/qualiopi/devis-formules/saisie";
import { TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";

export type EtapeAssistant = 1 | 2 | 3 | 4;
export type TypeDevisAssistant = "classique" | "formules";
export type ActiviteAssistant = "formation" | "un_a_un" | "audit" | "implementation" | "site_web";

export interface LigneClassiqueSaisie {
  designation: string;
  quantite: string;
  prixEur: string;
  offreCode?: string;
  offreTierId?: string;
}

export interface OpcoSaisie {
  financementSuggere?: "direct" | "opco" | "cpf" | "france_travail";
  nbParticipants?: string;
  dureeHeures?: string;
  modaliteOpco?: "intra" | "inter_presentiel" | "inter_distanciel";
  enveloppeRestanteEur?: string;
  dateDebutSessionPrevue?: string;
}

export interface PayloadAssistantV1 {
  v: 1;
  etape: EtapeAssistant;
  /** null = devis ouvert vide (décision du 29/09). */
  modeleId: string | null;
  clientId: string | null;
  projetId: string | null;
  rencontreId: string | null;
  venteBrouillonId: string | null;
  activite: ActiviteAssistant | null;
  typeDevis: TypeDevisAssistant | null;
  refClient: string;
  /** AAAA-MM-JJ ; null = défaut du moteur (+30 jours). */
  dateValidite: string | null;
  recit: { intitule: string; besoinClient: string; resultatVise: string; valeurClient: string };
  lignesClassiques: LigneClassiqueSaisie[];
  opco: OpcoSaisie;
  formules: SaisieFormules;
  textes: TexteCopie[];
  /** Champs de la maquette sans place dans le moteur (D1). Bornés par la taille globale. */
  nonImprime: Record<string, unknown>;
  /** Écrit par le serveur seulement : toute valeur reçue du navigateur est à ignorer. */
  sync: { devisId: string | null; devisMajLe: string | null };
}

export const TAILLE_MAX_PAYLOAD_OCTETS = 256 * 1024;

const PROFONDEUR_MAX = 12;
/**
 * Clés de contact libres : le brouillon ne stocke jamais nom, e-mail ni téléphone (fiche client
 * seulement). La clé est d'abord réduite à ses lettres minuscules sans accent (« contact_email »,
 * « e-mail », « Téléphone » → « contactemail », « email », « telephone »).
 */
const MOTIF_CONTACT_SOUS_CHAINE = /mail|courriel|telephone|phone|portable|mobile/;
const MOTIF_CONTACT_EXACT =
  /^(tel|telcontact|contacttel|(nom|prenom|adresse)(d[eu])?(contact|client)|contact(nom|prenom|adresse)|adresse(d[eu])?(contact|client))$/;

function estCleDeContact(cle: string): boolean {
  const k = cle
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return MOTIF_CONTACT_SOUS_CHAINE.test(k) || MOTIF_CONTACT_EXACT.test(k);
}

const ACTIVITES: readonly ActiviteAssistant[] = [
  "formation",
  "un_a_un",
  "audit",
  "implementation",
  "site_web",
];
const TYPES: readonly TypeDevisAssistant[] = ["classique", "formules"];
const FINANCEMENTS = ["direct", "opco", "cpf", "france_travail"] as const;
const MODALITES = ["intra", "inter_presentiel", "inter_distanciel"] as const;
const DECLENCHEURS = ["signature", "avancement", "livraison"] as const;
const PERIODES: readonly MoisPeriode[] = [1, 2, 6, 12];
const ENGAGEMENTS: readonly Engagement[] = [0, 3, 6, 12, 24];
const PREAVIS: readonly Preavis[] = [1, 2, 3];

export function payloadVide(tvaStandardPct: number): PayloadAssistantV1 {
  return {
    v: 1,
    etape: 1,
    modeleId: null,
    clientId: null,
    projetId: null,
    rencontreId: null,
    venteBrouillonId: null,
    activite: null,
    typeDevis: null,
    refClient: "",
    dateValidite: null,
    recit: { intitule: "", besoinClient: "", resultatVise: "", valeurClient: "" },
    lignesClassiques: [{ designation: "", quantite: "1", prixEur: "" }],
    opco: {},
    formules: saisieVide(tvaStandardPct),
    textes: [],
    nonImprime: {},
    sync: { devisId: null, devisMajLe: null },
  };
}

/** « 1 190,50 » (espaces, U+00A0, U+202F) → « 1190,50 ». À appeler AVANT `eurosVersCents`. */
export function normaliserEuros(s: string): string {
  return s.replace(/[\s\u00A0\u202F]/g, "");
}

// ───────────────────────── lecture tolérante ─────────────────────────

type Obj = Record<string, unknown>;
const estObjet = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const chaine = (v: unknown, defaut: string): string => (typeof v === "string" ? v : defaut);
const chaineOuNull = (v: unknown): string | null => (typeof v === "string" ? v : null);
const parmi = <T extends string | number>(v: unknown, permis: readonly T[]): T | undefined =>
  permis.find((p) => p === v);

function octets(json: string): number {
  return new TextEncoder().encode(json).length;
}

/** `{ cle }` = clé de contact trouvée ; `{ tropProfond }` = imbrication au-delà de la limite (refus). */
function cleDeContact(v: unknown, profondeur = 0): { cle: string } | { tropProfond: true } | null {
  if (profondeur > PROFONDEUR_MAX) return { tropProfond: true };
  if (Array.isArray(v)) {
    for (const x of v) {
      const c = cleDeContact(x, profondeur + 1);
      if (c) return c;
    }
  } else if (estObjet(v)) {
    for (const [k, x] of Object.entries(v)) {
      if (estCleDeContact(k)) return { cle: k };
      const c = cleDeContact(x, profondeur + 1);
      if (c) return c;
    }
  }
  return null;
}

function lireLigneClassique(v: unknown): LigneClassiqueSaisie | null {
  if (!estObjet(v)) return null;
  const l: LigneClassiqueSaisie = {
    designation: chaine(v.designation, ""),
    quantite: chaine(v.quantite, "1"),
    prixEur: chaine(v.prixEur, ""),
  };
  if (typeof v.offreCode === "string") l.offreCode = v.offreCode;
  if (typeof v.offreTierId === "string") l.offreTierId = v.offreTierId;
  return l;
}

function lireOpco(v: unknown): OpcoSaisie {
  if (!estObjet(v)) return {};
  const o: OpcoSaisie = {};
  const f = parmi(v.financementSuggere, FINANCEMENTS);
  if (f) o.financementSuggere = f;
  const m = parmi(v.modaliteOpco, MODALITES);
  if (m) o.modaliteOpco = m;
  for (const k of [
    "nbParticipants",
    "dureeHeures",
    "enveloppeRestanteEur",
    "dateDebutSessionPrevue",
  ] as const) {
    if (typeof v[k] === "string") o[k] = v[k];
  }
  return o;
}

function lireLignes(v: unknown, defaut: LigneSaisie[]): LigneSaisie[] {
  if (!Array.isArray(v)) return defaut;
  const lignes = v.filter(estObjet).map((l) => ({
    libelle: chaine(l.libelle, ""),
    quantite: chaine(l.quantite, "1"),
    prixEur: chaine(l.prixEur, ""),
    tauxTvaPct: chaine(l.tauxTvaPct, defaut[0]?.tauxTvaPct ?? String(TAUX_TVA_STANDARD)),
  }));
  return lignes.length > 0 ? lignes : defaut;
}

function lirePhases(v: unknown, defaut: PhaseSaisie[]): PhaseSaisie[] {
  if (!Array.isArray(v)) return defaut;
  const phases = v.filter(estObjet).map((p): PhaseSaisie => {
    const phase: PhaseSaisie = {
      libelle: chaine(p.libelle, ""),
      pourcentage: chaine(p.pourcentage, ""),
      declencheur: parmi(p.declencheur, DECLENCHEURS) ?? "signature",
    };
    if (typeof p.delaiJours === "number" && Number.isFinite(p.delaiJours))
      phase.delaiJours = p.delaiJours;
    if (typeof p.dateEstimee === "string") phase.dateEstimee = p.dateEstimee;
    return phase;
  });
  return phases.length > 0 ? phases : defaut;
}

function lirePeriodes(v: unknown, defaut: MoisPeriode[]): MoisPeriode[] {
  if (!Array.isArray(v)) return defaut;
  const ok = v.filter((x): x is MoisPeriode => PERIODES.includes(x as MoisPeriode));
  return ok.length > 0 ? ok : defaut;
}

function lireFormules(v: unknown, tva: number): SaisieFormules {
  const d = saisieVide(tva);
  if (!estObjet(v)) return d;
  const bool = (x: unknown, def: boolean) => (typeof x === "boolean" ? x : def);
  const a = estObjet(v.achat) ? v.achat : {};
  const b = estObjet(v.abonnement) ? v.abonnement : {};
  const fo = estObjet(v.formules) ? v.formules : {};
  const mt = estObjet(a.maintenance) ? a.maintenance : {};
  const out: SaisieFormules = {
    formules: {
      achat: bool(fo.achat, d.formules.achat),
      abonnement: bool(fo.abonnement, d.formules.abonnement),
    },
    garantieJours: chaine(v.garantieJours, d.garantieJours),
    // Éléments que l'écran ne sait pas saisir : ils traversent tels quels (jamais effacés).
    automatisations: Array.isArray(v.automatisations)
      ? (v.automatisations as SaisieFormules["automatisations"])
      : d.automatisations,
    servicesTiers: Array.isArray(v.servicesTiers)
      ? (v.servicesTiers as SaisieFormules["servicesTiers"])
      : d.servicesTiers,
    plafondAConfirmer:
      v.plafondAConfirmer === null || estObjet(v.plafondAConfirmer)
        ? (v.plafondAConfirmer as SaisieFormules["plafondAConfirmer"])
        : d.plafondAConfirmer,
    achat: {
      lignes: lireLignes(a.lignes, d.achat.lignes),
      phases: lirePhases(a.phases, d.achat.phases),
      hebergement: a.hebergement === "axion" ? "axion" : "client",
      hebergementMensuelEur: chaine(a.hebergementMensuelEur, ""),
      maintenance: {
        regle: mt.regle === "obligatoire" ? "obligatoire" : "facultative",
        moisOfferts: chaine(mt.moisOfferts, d.achat.maintenance.moisOfferts),
        mensuelEur: chaine(mt.mensuelEur, ""),
        periodes: lirePeriodes(mt.periodes, d.achat.maintenance.periodes),
      },
    },
    abonnement: {
      lignes: lireLignes(b.lignes, d.abonnement.lignes),
      phases: lirePhases(b.phases, d.abonnement.phases),
      mensuelCatalogueEur: chaine(b.mensuelCatalogueEur, ""),
      tauxTvaPct: chaine(b.tauxTvaPct, d.abonnement.tauxTvaPct),
      terme: b.terme === "echu" ? "echu" : "a_echoir",
      periodes: Array.isArray(b.periodes)
        ? b.periodes
            .filter(estObjet)
            .filter((p) => PERIODES.includes(p.mois as MoisPeriode))
            .map((p) => ({ mois: p.mois as MoisPeriode, remisePct: chaine(p.remisePct, "0") }))
        : d.abonnement.periodes,
      engagementMois: parmi(b.engagementMois, ENGAGEMENTS) ?? d.abonnement.engagementMois,
      reconduction:
        b.reconduction === "annuelle" || b.reconduction === "aucune" ? b.reconduction : "mensuelle",
      preavisMois: parmi(b.preavisMois, PREAVIS) ?? d.abonnement.preavisMois,
      indemniteTauxPct: chaine(b.indemniteTauxPct, d.abonnement.indemniteTauxPct),
    },
  };
  if (b.modeAvance === "premiere_periode_seulement" || b.modeAvance === "toutes_periodes")
    out.abonnement.modeAvance = b.modeAvance;
  if (out.abonnement.periodes.length === 0) out.abonnement.periodes = d.abonnement.periodes;
  return out;
}

function lireTextes(v: unknown): TexteCopie[] {
  if (!Array.isArray(v)) return [];
  const sortie: TexteCopie[] = [];
  for (const t of v) {
    if (!estObjet(t) || typeof t.texte !== "string" || typeof t.actif !== "boolean") continue;
    const x: TexteCopie = { texte: t.texte, actif: t.actif };
    if (typeof t.bibliothequeId === "string") x.bibliothequeId = t.bibliothequeId;
    if (typeof t.version === "string") x.version = t.version;
    sortie.push(x);
  }
  return sortie;
}

/**
 * Relit un brouillon enregistré. Tolérant : un champ absent ou de mauvais type reprend sa valeur
 * vide (le reste du brouillon est gardé). Refus : pas un objet, autre version, étape hors 1 à 4,
 * clé de contact libre, plus de 256 Ko de JSON.
 */
export function lirePayload(
  brut: unknown,
): { ok: true; payload: PayloadAssistantV1 } | { ok: false; error: string } {
  let json: string;
  try {
    json = JSON.stringify(brut) ?? "";
  } catch {
    return { ok: false, error: "Brouillon illisible (non sérialisable)." };
  }
  if (octets(json) > TAILLE_MAX_PAYLOAD_OCTETS)
    return { ok: false, error: "Brouillon trop volumineux (256 Ko au plus)." };
  if (!estObjet(brut)) return { ok: false, error: "Brouillon illisible (objet attendu)." };
  if (brut.v !== 1) return { ok: false, error: "Version de brouillon inconnue." };
  const contact = cleDeContact(brut);
  if (contact && "tropProfond" in contact)
    return {
      ok: false,
      error: `Brouillon trop imbriqué (${PROFONDEUR_MAX} niveaux au plus) : impossible de vérifier l'absence de contact libre.`,
    };
  if (contact)
    return {
      ok: false,
      error: `Champ de contact libre refusé (« ${contact.cle} ») : utilisez la fiche client.`,
    };
  let etape: EtapeAssistant = 1;
  if (brut.etape !== undefined) {
    if (brut.etape !== 1 && brut.etape !== 2 && brut.etape !== 3 && brut.etape !== 4)
      return { ok: false, error: "Étape de brouillon invalide (1 à 4)." };
    etape = brut.etape;
  }
  const vide = payloadVide(TAUX_TVA_STANDARD);
  const recit = estObjet(brut.recit) ? brut.recit : {};
  const sync = estObjet(brut.sync) ? brut.sync : {};
  const lignes = Array.isArray(brut.lignesClassiques)
    ? brut.lignesClassiques.map(lireLigneClassique).filter((l): l is LigneClassiqueSaisie => !!l)
    : [];
  return {
    ok: true,
    payload: {
      v: 1,
      etape,
      modeleId: chaineOuNull(brut.modeleId),
      clientId: chaineOuNull(brut.clientId),
      projetId: chaineOuNull(brut.projetId),
      rencontreId: chaineOuNull(brut.rencontreId),
      venteBrouillonId: chaineOuNull(brut.venteBrouillonId),
      activite: parmi(brut.activite, ACTIVITES) ?? null,
      typeDevis: parmi(brut.typeDevis, TYPES) ?? null,
      refClient: chaine(brut.refClient, ""),
      dateValidite: chaineOuNull(brut.dateValidite),
      recit: {
        intitule: chaine(recit.intitule, ""),
        besoinClient: chaine(recit.besoinClient, ""),
        resultatVise: chaine(recit.resultatVise, ""),
        valeurClient: chaine(recit.valeurClient, ""),
      },
      lignesClassiques: lignes.length > 0 ? lignes : vide.lignesClassiques,
      opco: lireOpco(brut.opco),
      formules: lireFormules(brut.formules, TAUX_TVA_STANDARD),
      textes: lireTextes(brut.textes),
      nonImprime: estObjet(brut.nonImprime) ? { ...brut.nonImprime } : {},
      sync: { devisId: chaineOuNull(sync.devisId), devisMajLe: chaineOuNull(sync.devisMajLe) },
    },
  };
}
