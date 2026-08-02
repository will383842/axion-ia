/**
 * Qualiopi — Résolution des conditions de paiement d'un client (F61).
 *
 * Trois réglages peuvent venir du client ou du défaut global : délai de
 * paiement, taux d'acompte, mode de facturation. La règle est la même que pour
 * les emails — **le spécifique prime sur le général** — et `null` côté client
 * signifie « suivre le global », jamais « zéro ».
 *
 * Cette distinction n'est pas cosmétique : un client sans condition particulière
 * et un client réglé explicitement sur la même valeur se comportent pareil
 * aujourd'hui, mais divergeront le jour où le défaut global changera. Écraser
 * l'un par l'autre ferait perdre l'intention.
 *
 * Logique PURE — aucun accès Prisma. La lecture en base vit chez l'appelant.
 */

/** Plafond légal du délai de paiement entre professionnels (art. L441-10 C. com.). */
export const DELAI_PAIEMENT_MAX_JOURS = 60;

/**
 * Délai retenu quand ni le client ni la configuration ne fixent de valeur
 * utilisable. Le repli était écrit en dur, à l'identique, chez chaque émetteur
 * de facture — donc silencieusement divergeable.
 */
export const DELAI_PAIEMENT_DEFAUT_JOURS = 30;

/**
 * Échéance de paiement d'une facture ÉMISE.
 *
 * 🔴 Pourquoi une fonction, et pourquoi ici. Une facture sans `echeanceAt` est
 * INVISIBLE de tout le circuit de recouvrement : le cron de retard filtre sur
 * `echeanceAt < now` (une colonne nulle ne satisfait aucune comparaison SQL),
 * donc aucun statut `en_retard`, aucune `RelanceProposee`, aucune alerte, et un
 * prévisionnel de trésorerie qui ignore la ligne. Elle est en outre une mention
 * obligatoire (art. L.441-9 C. com.). Le calcul était réécrit à l'identique chez
 * cinq émetteurs — la sixième porte d'entrée l'a simplement oublié.
 *
 * Bornage : `delaiJours` est ramené dans [1, DELAI_PAIEMENT_MAX_JOURS].
 *   - plancher 1 : une échéance le jour même de l'émission est déjà échue à
 *     l'instant où elle est écrite, ce qui déclencherait une relance immédiate
 *     sur une facture que le client vient de recevoir ;
 *   - plafond 60 : art. L.441-10 C. com., une clause au-delà est illicite entre
 *     professionnels.
 *   - non fini (NaN, Infinity) → défaut 30 j, jamais une Invalid Date propagée
 *     en base.
 *
 * PURE : ne lit ni l'horloge ni la base. `emiseAt` n'est jamais muté (le
 * `Date` reçu est souvent réutilisé par l'appelant pour `emiseAt` lui-même).
 *
 * @param emiseAt    Date d'émission de la facture (point de départ du délai).
 * @param delaiJours Délai propre au client, ou `null`/`undefined` → défaut 30 j.
 */
export function calculerEcheanceFacture(
  emiseAt: Date,
  delaiJours: number | null | undefined,
): Date {
  const brut = delaiJours ?? DELAI_PAIEMENT_DEFAUT_JOURS;
  const jours = Number.isFinite(brut)
    ? Math.min(DELAI_PAIEMENT_MAX_JOURS, Math.max(1, Math.trunc(brut)))
    : DELAI_PAIEMENT_DEFAUT_JOURS;

  const echeance = new Date(emiseAt.getTime());
  echeance.setDate(echeance.getDate() + jours);
  return echeance;
}

export type ModeFacturation = "acompte_solde" | "solde_unique";

/** Réglages portés par le client. `null` = suivre le défaut global. */
export interface ConditionsClient {
  delaiPaiementJours: number | null;
  tauxAcomptePct: number | null;
  modeFacturation: ModeFacturation | null;
}

/** Défauts globaux, lus dans la configuration Qualiopi. */
export interface DefautsGlobaux {
  delaiPaiementJours: number;
  tauxAcomptePct: number;
  modeFacturation: ModeFacturation;
}

export interface ConditionsResolues {
  delaiPaiementJours: number;
  tauxAcomptePct: number;
  modeFacturation: ModeFacturation;
  /** Vrai pour chaque valeur qui vient du client et non du défaut global. */
  origine: {
    delai: "client" | "global";
    acompte: "client" | "global";
    mode: "client" | "global";
  };
  /** Renseigné si une valeur du client a dû être ramenée dans les bornes. */
  avertissements: string[];
}

/**
 * Résout les conditions applicables.
 *
 * Les valeurs hors bornes sont **ramenées, jamais rejetées** : refuser
 * bloquerait l'émission d'un devis pour une donnée qu'un import a pu salir. On
 * corrige et on le dit, plutôt que d'échouer.
 */
export function resoudreConditions(
  client: ConditionsClient | null,
  defauts: DefautsGlobaux,
): ConditionsResolues {
  const avertissements: string[] = [];

  const origineDelai: "client" | "global" =
    client?.delaiPaiementJours != null ? "client" : "global";
  const delaiSaisi =
    client?.delaiPaiementJours != null ? client.delaiPaiementJours : defauts.delaiPaiementJours;

  // 🔴 Vérification E2E 2026-07-26 — deux trous dans le bornage.
  //
  // 1. Le clamp L441-10 ne s'appliquait QU'À la valeur du client. Un défaut
  //    global aberrant (365 jours, 900 %) sortait tel quel, sans un mot : la
  //    protection couvrait la saisie exceptionnelle et laissait passer celle qui
  //    s'applique à TOUS les clients.
  // 2. `NaN > 60` et `NaN < 0` sont tous deux faux : un délai NaN ressortait NaN
  //    SANS avertissement, et un taux NaN ressortait NaN AVEC l'avertissement
  //    « ramené dans l'intervalle 0–100 % » — un message qui mentait, puisque
  //    rien n'avait été ramené.
  let delai = Number.isFinite(delaiSaisi) ? Math.trunc(delaiSaisi) : 0;
  if (!Number.isFinite(delaiSaisi)) {
    avertissements.push(
      `Délai de paiement non numérique (valeur reçue : ${String(delaiSaisi)}) ramené à 0 jour.`,
    );
  } else if (delai > DELAI_PAIEMENT_MAX_JOURS) {
    avertissements.push(
      `Délai de paiement de ${delai} jours ramené à ${DELAI_PAIEMENT_MAX_JOURS} : au-delà, la clause est illicite entre professionnels (art. L441-10 du code de commerce).`,
    );
    delai = DELAI_PAIEMENT_MAX_JOURS;
  } else if (delai < 0) {
    avertissements.push("Délai de paiement négatif ramené à 0.");
    delai = 0;
  }

  const origineAcompte: "client" | "global" = client?.tauxAcomptePct != null ? "client" : "global";
  const acompteSaisi =
    client?.tauxAcomptePct != null ? client.tauxAcomptePct : defauts.tauxAcomptePct;

  let acompte: number;
  if (!Number.isFinite(acompteSaisi)) {
    avertissements.push(
      `Taux d'acompte non numérique (valeur reçue : ${String(acompteSaisi)}) ramené à 0 %.`,
    );
    acompte = 0;
  } else {
    acompte = Math.max(0, Math.min(100, acompteSaisi));
    if (acompte !== acompteSaisi) {
      avertissements.push(
        `Taux d'acompte ramené dans l'intervalle 0–100 % (valeur reçue : ${acompteSaisi}).`,
      );
    }
  }

  const mode = client?.modeFacturation ?? defauts.modeFacturation;
  const origineMode: "client" | "global" = client?.modeFacturation != null ? "client" : "global";

  // Cohérence : un mode « solde unique » avec un taux d'acompte non nul est
  // contradictoire. Le MODE l'emporte — c'est l'intention explicite, le taux
  // n'est qu'un paramètre.
  const acompteEffectif = mode === "solde_unique" ? 0 : acompte;
  if (mode === "solde_unique" && acompte > 0) {
    avertissements.push(
      "Mode « solde unique » retenu : le taux d'acompte est ignoré. Choisissez « acompte + solde » pour l'appliquer.",
    );
  }

  return {
    delaiPaiementJours: delai,
    tauxAcomptePct: acompteEffectif,
    modeFacturation: mode,
    origine: { delai: origineDelai, acompte: origineAcompte, mode: origineMode },
    avertissements,
  };
}
