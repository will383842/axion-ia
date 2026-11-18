/**
 * Modèles prêts à l'emploi de l'assistant de devis (fiche S05). PUR et client-safe.
 *
 * AUCUN montant : un modèle ne porte que de la STRUCTURE (activité, type de devis, phases,
 * pourcentages). Tous les prix restent `""` ; `appliquerModele` n'efface ni ne remplace jamais
 * un prix déjà saisi. Le taux de TVA des lignes est le taux standard (`TAUX_TVA_STANDARD`),
 * jamais 0. Le devis s'ouvre VIDE : un modèle ne s'applique que sur clic.
 *
 * Les libellés de phases sont des intitulés neutres à compléter ; les livrables et les durées
 * (`semaines`) sont laissés vides (0) : ce sont des engagements imprimés, jamais devinés.
 */
import type { PhaseSaisie } from "@/components/admin/qualiopi/devis-formules/saisie";
import { TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";
import type { PayloadAssistantV1, TypeDevisAssistant } from "./payload";

export type IdModeleDevis = "formation" | "coaching" | "audit" | "mise_en_place_ia" | "site_web";

export interface ModeleDevis {
  id: IdModeleDevis;
  nom: string;
  detail: string;
  activite: PayloadAssistantV1["activite"];
  typeDevis: TypeDevisAssistant;
}

export const MODELES_DEVIS: readonly ModeleDevis[] = [
  {
    id: "formation",
    nom: "Formation",
    detail: "Devis classique, activité formation.",
    activite: "formation",
    typeDevis: "classique",
  },
  {
    id: "coaching",
    nom: "Coaching",
    detail: "Devis classique, accompagnement individuel.",
    activite: "un_a_un",
    typeDevis: "classique",
  },
  {
    id: "audit",
    nom: "Audit",
    detail: "Devis classique, activité audit.",
    activite: "audit",
    typeDevis: "classique",
  },
  {
    id: "mise_en_place_ia",
    nom: "Mise en place d'une IA",
    detail: "Devis à formules (achat, abonnement), activité mise en place.",
    activite: "implementation",
    typeDevis: "formules",
  },
  {
    id: "site_web",
    nom: "Site web",
    detail: "Devis à formules (achat, abonnement), activité site web.",
    activite: "site_web",
    typeDevis: "formules",
  },
];

interface PhaseModele {
  libelle: string;
  livrable: string;
  semaines: number;
  pourcentage: number;
}

export const MODELES_PHASES: readonly {
  id: "complet" | "court" | "libre";
  nom: string;
  phases: PhaseModele[];
}[] = [
  {
    id: "complet",
    nom: "Complet (6 phases)",
    phases: [
      { libelle: "Cadrage", livrable: "", semaines: 0, pourcentage: 20 },
      { libelle: "Conception", livrable: "", semaines: 0, pourcentage: 20 },
      { libelle: "Réalisation", livrable: "", semaines: 0, pourcentage: 20 },
      { libelle: "Tests", livrable: "", semaines: 0, pourcentage: 15 },
      { libelle: "Mise en service", livrable: "", semaines: 0, pourcentage: 15 },
      { libelle: "Suivi", livrable: "", semaines: 0, pourcentage: 10 },
    ],
  },
  {
    id: "court",
    nom: "Court (3 phases)",
    phases: [
      { libelle: "Cadrage", livrable: "", semaines: 0, pourcentage: 30 },
      { libelle: "Réalisation", livrable: "", semaines: 0, pourcentage: 40 },
      { libelle: "Livraison", livrable: "", semaines: 0, pourcentage: 30 },
    ],
  },
  {
    id: "libre",
    nom: "Libre (1 phase)",
    phases: [{ libelle: "Solde", livrable: "", semaines: 0, pourcentage: 100 }],
  },
];

export const MODELES_ECHEANCIER: readonly {
  id: "signature" | "moitie" | "trois" | "libre";
  nom: string;
  phases: PhaseSaisie[];
}[] = [
  {
    id: "signature",
    nom: "Tout à la signature",
    phases: [{ libelle: "Solde", pourcentage: "100", declencheur: "signature" }],
  },
  {
    id: "moitie",
    nom: "Moitié / moitié",
    phases: [
      { libelle: "Signature", pourcentage: "50", declencheur: "signature" },
      { libelle: "Livraison", pourcentage: "50", declencheur: "livraison" },
    ],
  },
  {
    id: "trois",
    nom: "Trois versements (30 / 30 / 40)",
    phases: [
      { libelle: "Signature", pourcentage: "30", declencheur: "signature" },
      { libelle: "Avancement", pourcentage: "30", declencheur: "avancement" },
      { libelle: "Livraison", pourcentage: "40", declencheur: "livraison" },
    ],
  },
  {
    id: "libre",
    nom: "Libre",
    phases: [{ libelle: "Solde", pourcentage: "100", declencheur: "signature" }],
  },
];

const copie = <T>(v: T): T => structuredClone(v);
const TAUX = String(TAUX_TVA_STANDARD);

/** Structure seulement : activité, type de devis, taux standard. Aucun prix écrit ni effacé. */
export function appliquerModele(p: PayloadAssistantV1, id: IdModeleDevis): PayloadAssistantV1 {
  const m = MODELES_DEVIS.find((x) => x.id === id);
  if (!m) return p;
  const out = copie(p);
  out.modeleId = m.id;
  out.activite = m.activite;
  out.typeDevis = m.typeDevis;
  for (const l of out.formules.achat.lignes) l.tauxTvaPct = TAUX;
  for (const l of out.formules.abonnement.lignes) l.tauxTvaPct = TAUX;
  out.formules.abonnement.tauxTvaPct = TAUX;
  return out;
}

function phasesDepuis(id: string): PhaseSaisie[] | null {
  const echeancier = id.startsWith("echeancier:");
  const cle = echeancier ? id.slice("echeancier:".length) : id;
  if (!echeancier) {
    const m = MODELES_PHASES.find((x) => x.id === cle);
    if (m)
      return m.phases.map((ph, i, tab) => ({
        libelle: ph.livrable ? `${ph.libelle} — ${ph.livrable}` : ph.libelle,
        pourcentage: String(ph.pourcentage),
        declencheur: i === 0 ? "signature" : i === tab.length - 1 ? "livraison" : "avancement",
        ...(ph.semaines > 0 ? { delaiJours: ph.semaines * 7 } : {}),
      }));
  }
  const e = MODELES_ECHEANCIER.find((x) => x.id === cle);
  return e ? copie(e.phases) : null;
}

/**
 * Remplace les phases d'une formule (`abonnement` = mise en service). `id` : un modèle de
 * phases (« complet », « court », « libre ») ou, préfixé « echeancier: », un modèle
 * d'échéancier (« echeancier:libre » désigne ce dernier, « libre » seul le premier).
 */
export function appliquerModelePhases(
  p: PayloadAssistantV1,
  formule: "achat" | "abonnement",
  id: string,
): PayloadAssistantV1 {
  const phases = phasesDepuis(id);
  if (!phases) return p;
  const out = copie(p);
  out.formules[formule].phases = phases;
  return out;
}
