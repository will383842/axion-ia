/**
 * Qualiopi — Saisie du bloc « Branche et OPCO » (module PUR, lot OPCO A7b).
 *
 * Transforme ce que l'écran affiche (chaînes) en charge pour
 * `updateClientAction`, en n'envoyant QUE ce qui a changé : un simple
 * « Enregistrer » ne re-date pas l'effectif et ne fige pas un OPCO inféré.
 *
 * 🔴 UN SEUL OPCO part : le champ TYPÉ `opco`. « — » envoie `opco: null` ET
 * `opcoIdentifie: null` : c'est l'ancien « remettre en inféré » du second
 * sélecteur, retiré — le serveur efface la saisie et relance l'inférence
 * IDCC/NAF.
 *
 * Aucun import Prisma/next : importable par le formulaire client et les tests.
 */

import { OPCO_IDS, type OpcoId } from "./opco-referentiel";

export type Tristate = "" | "oui" | "non";

/** Ce qui est en base, tel que l'écran le reçoit. */
export interface BrancheOpcoInitiale {
  idcc: string | null;
  taille: string | null;
  /** OPCO typé (`Client.opco`). */
  opco: string | null;
  effectif: number | null;
  enveloppeCents: number | null;
  numeroAdherent: string | null;
  adhesionMobilites: boolean | null;
  versementVolontaire: boolean | null;
}

/** Ce que l'écran saisit (toujours des chaînes). */
export interface BrancheOpcoSaisie {
  idcc: string;
  taille: string;
  opco: string;
  effectif: string;
  enveloppeEuros: string;
  numeroAdherent: string;
  adhesionMobilites: Tristate;
  versementVolontaire: Tristate;
}

export interface ChargeBrancheOpco {
  idcc?: string;
  taille?: "TPE" | "PME" | "ETI" | "GRANDE_ENTREPRISE";
  opco?: OpcoId | null;
  opcoIdentifie?: null;
  effectif?: number | null;
  opcoEnveloppeAnnuelleCents?: number | null;
  opcoNumeroAdherent?: string | null;
  opcoAdhesionOffreMobilites?: boolean | null;
  opcoVersementVolontaire?: boolean | null;
}

const TAILLES = ["TPE", "PME", "ETI", "GRANDE_ENTREPRISE"] as const;

/** « — » : efface l'OPCO typé ET la saisie libre, le serveur ré-infère. */
const REMETTRE_EN_INFERE = { opco: null, opcoIdentifie: null } as const;

/**
 * Euros saisis (« 1 500,50 », « 1500.5 », « 12 000 € ») → centimes ENTIERS.
 * Vide → `null` (effacer). Négatif, plus de deux décimales ou illisible →
 * `"invalide"`. Calcul sur les chiffres, jamais en virgule flottante.
 */
export function eurosVersCentimes(saisie: string): number | null | "invalide" {
  const t = saisie.replace(/[\s  €]/g, "").replace(",", ".");
  if (t === "") return null;
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return "invalide";
  const centimes = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(centimes) ? centimes : "invalide";
}

/** Centimes → euros affichables dans le champ (« 3000 », « 3200,5 »). */
export function centimesVersSaisie(cents: number | null): string {
  if (cents === null) return "";
  const euros = Math.trunc(cents / 100);
  const reste = cents % 100;
  return reste === 0 ? String(euros) : `${euros},${String(reste).padStart(2, "0")}`;
}

function versTristate(b: boolean | null): Tristate {
  return b === null ? "" : b ? "oui" : "non";
}

function depuisTristate(t: Tristate): boolean | null {
  return t === "" ? null : t === "oui";
}

/** La saisie qui correspond exactement à l'état en base. */
export function saisieInitiale(i: BrancheOpcoInitiale): BrancheOpcoSaisie {
  return {
    idcc: i.idcc ?? "",
    taille: i.taille ?? "",
    opco: i.opco ?? "",
    effectif: i.effectif === null ? "" : String(i.effectif),
    enveloppeEuros: centimesVersSaisie(i.enveloppeCents),
    numeroAdherent: i.numeroAdherent ?? "",
    adhesionMobilites: versTristate(i.adhesionMobilites),
    versementVolontaire: versTristate(i.versementVolontaire),
  };
}

/** La charge à envoyer, ou le message qui dit quoi corriger. */
export function chargeBrancheOpco(
  initial: BrancheOpcoInitiale,
  saisie: BrancheOpcoSaisie,
  opts: { estParticulier: boolean },
): { charge: ChargeBrancheOpco } | { erreur: string } {
  const charge: ChargeBrancheOpco = {};

  // IDCC et taille : comportement historique du formulaire — envoyés dès
  // qu'ils sont renseignés (l'IDCC réarme l'inférence d'un OPCO vide).
  const idcc = saisie.idcc.trim();
  if (idcc !== "") charge.idcc = idcc;
  const taille = TAILLES.find((t) => t === saisie.taille);
  if (taille !== undefined) charge.taille = taille;

  // Un particulier n'a ni OPCO, ni effectif, ni enveloppe : rien de tout cela
  // ne part (le serveur le refuserait de toute façon).
  if (opts.estParticulier) return { charge };

  if (saisie.opco !== (initial.opco ?? "")) {
    const choisi = OPCO_IDS.find((o) => o === saisie.opco);
    // Écriture (jamais lecture) du texte libre : « remettre en inféré ».
    Object.assign(charge, choisi !== undefined ? { opco: choisi } : REMETTRE_EN_INFERE);
  }

  const eff = saisie.effectif.trim();
  const effectif = eff === "" ? null : Number(eff);
  if (effectif !== null && (!Number.isInteger(effectif) || effectif < 0)) {
    return { erreur: "Effectif : un nombre entier de salariés est attendu." };
  }
  if (effectif !== initial.effectif) charge.effectif = effectif;

  const enveloppe = eurosVersCentimes(saisie.enveloppeEuros);
  if (enveloppe === "invalide") {
    return {
      erreur: "Enveloppe annuelle : un montant en euros est attendu (ex. 3 000 ou 2 500,50).",
    };
  }
  if (enveloppe !== initial.enveloppeCents) charge.opcoEnveloppeAnnuelleCents = enveloppe;

  const adherent = saisie.numeroAdherent.trim();
  const adherentOuNull = adherent === "" ? null : adherent;
  if (adherentOuNull !== initial.numeroAdherent) charge.opcoNumeroAdherent = adherentOuNull;

  const mobilites = depuisTristate(saisie.adhesionMobilites);
  if (mobilites !== initial.adhesionMobilites) charge.opcoAdhesionOffreMobilites = mobilites;
  const versement = depuisTristate(saisie.versementVolontaire);
  if (versement !== initial.versementVolontaire) charge.opcoVersementVolontaire = versement;

  return { charge };
}
