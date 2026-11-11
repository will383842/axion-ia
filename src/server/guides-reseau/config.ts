/**
 * GUIDES PAR RÉSEAU — l'INTERRUPTEUR (lot PV-1, 2026-11-01).
 *
 * 🔴 ÉTEINT PAR DÉFAUT. Tant que `GUIDES_RESEAU_ENABLED` n'est pas exactement `"true"`,
 * la route répond 503 et rien n'est lu ni écrit. Nom du plan (la consigne orale parlait de
 * `DEMANDES_GUIDE_RESEAU_ENABLED` : c'est `GUIDES_RESEAU_ENABLED` qui fait foi).
 *
 * ✅ EFFACEMENT TRAITÉ (PV-1 bis, `effacement.ts`). Une demande d'effacement reçue en message
 * privé (`type: "demande_effacement"`) déclenche UNE alerte à l'opérateur, adresse masquée par
 * `redactEmail`, et met l'adresse à l'écart des envois (mécanisme d'opposition). AUCUNE
 * suppression automatique. Malgré cela, `GUIDES_RESEAU_ENABLED` RESTE ÉTEINT jusqu'à l'essai
 * « STOP » par l'opérateur. Garde : le test « éteint par défaut » (`config.spec.ts`).
 *
 * Lecture en `process.env` brut, hors schéma `env.ts`, AU RUNTIME uniquement (Coolify,
 * scope RUN, conteneur app) — jamais un build-arg.
 */
export function guidesReseauActifs(): boolean {
  return process.env.GUIDES_RESEAU_ENABLED === "true";
}

const LONGUEUR_MIN_SECRET = 32;

function secretValide(v: string | undefined): string | null {
  const s = v?.trim();
  return s && s.length >= LONGUEUR_MIN_SECRET ? s : null;
}

/** Préfixe du seau de débit de la route (distinct de `internal:videos`). */
export const PREFIXE_DEBIT_GUIDES = "internal:guides-reseau";

/**
 * Secret HMAC de la route. Variable propre `GUIDES_RESEAU_HMAC_SECRET` (+ `_PRECEDENT` pendant
 * une rotation). REPLI DOCUMENTÉ : tant qu'elle est absente ou < 32 caractères, on retombe sur
 * `VIDEOS_STUDIO_HMAC_SECRET` (déploiement sans nouvelle variable) — dans ce cas une fuite de
 * ce secret ouvre aussi la route vidéos ; définir la variable propre dès l'allumage.
 * Lecture `process.env` brut au runtime (hors `env.ts`, donc sans effet sur
 * `SKIP_ENV_VALIDATION` ni sur le build `stub.invalid`).
 */
export function secretsGuidesReseau(
  env: Readonly<Record<string, string | undefined>> = process.env,
): { courant: string; precedent: string | null } | null {
  const propre = secretValide(env.GUIDES_RESEAU_HMAC_SECRET);
  if (propre)
    return { courant: propre, precedent: secretValide(env.GUIDES_RESEAU_HMAC_SECRET_PRECEDENT) };
  const repli = secretValide(env.VIDEOS_STUDIO_HMAC_SECRET);
  if (!repli) return null;
  return { courant: repli, precedent: secretValide(env.VIDEOS_STUDIO_HMAC_SECRET_PRECEDENT) };
}

/** Corps maximal accepté par la route (ADR contrat v3, I3) : 32 Ko. */
export const CORPS_MAX_GUIDES_RESEAU = 32 * 1024;

/** Limites de débit de la v3 (I3), par jour : par personne, et par (post_ref, canal). */
export const LIMITE_JOUR_PAR_PERSONNE = 20;
export const LIMITE_JOUR_PAR_POST = 5000;

/**
 * OPPOSITIONS PAR RÉSEAU — l'INTERRUPTEUR de `POST /api/interne/oppositions-reseau`.
 *
 * 🔴 ÉTEINT PAR DÉFAUT : vrai seulement si la variable vaut exactement `"true"`. Lu au runtime
 * (`process.env` brut, hors `env.ts`). Éteint = 503 `reception_eteinte`, rien n'est lu ni écrit.
 * ⚠️ À allumer AVANT `GUIDES_RESEAU_ENABLED` et à ne JAMAIS éteindre pendant que le Studio
 * tourne : un « stop » refusé serait perdu pour la personne qui l'a écrit.
 */
export function oppositionsReseauActives(): boolean {
  return process.env.OPPOSITIONS_RESEAU_ENABLED === "true";
}

/** Seau de débit de la route des oppositions (distinct des deux autres routes internes). */
export const PREFIXE_DEBIT_OPPOSITIONS = "internal:oppositions-reseau";

/** Corps maximal accepté par la route des oppositions : 4 Ko (le corps utile tient en 300 octets). */
export const CORPS_MAX_OPPOSITIONS = 4 * 1024;

/** Valeur de `email_oppositions.source` pour un « stop » venu d'un réseau (colonne ≤ 40). */
export const ORIGINE_OPPOSITION_RESEAU_STOP = "reseau-stop";

/**
 * Secret HMAC de la route des oppositions : `GUIDES_RESEAU_HMAC_SECRET` (+ `_PRECEDENT` pendant
 * une rotation), SANS AUCUN REPLI sur `VIDEOS_STUDIO_HMAC_SECRET` : une fuite du secret des
 * vidéos ne doit pas permettre de mettre des adresses à l'écart. Absent ou < 32 caractères → null
 * (503 `reception_non_configuree`).
 */
export function secretsOppositionsReseau(
  env: Readonly<Record<string, string | undefined>> = process.env,
): { courant: string; precedent: string | null } | null {
  const courant = secretValide(env.GUIDES_RESEAU_HMAC_SECRET);
  if (!courant) return null;
  return { courant, precedent: secretValide(env.GUIDES_RESEAU_HMAC_SECRET_PRECEDENT) };
}

/**
 * PAGE « RECEVOIR LE GUIDE » (lot S2) — l'INTERRUPTEUR de `/guide-reseau` et de sa route d'envoi.
 *
 * 🔴 ÉTEINT PAR DÉFAUT : vrai seulement si `PAGE_GUIDE_RESEAU_ENABLED` vaut exactement `"true"`.
 * Éteint = la page répond 404, la route d'envoi 503, rien n'est lu ni écrit. Lu au runtime
 * (`process.env` brut, hors `env.ts`) : jamais au build.
 */
export function pageGuideReseauActive(): boolean {
  return process.env.PAGE_GUIDE_RESEAU_ENABLED === "true";
}

/** Seau de débit par IP de la route d'envoi de la page. */
export const PREFIXE_DEBIT_PAGE_GUIDE = "page-guide-reseau:ip";
export const LIMITE_PAGE_GUIDE_PAR_IP = 5;
export const FENETRE_PAGE_GUIDE_SEC = 600;

/**
 * CONFIRMATIONS DE LA PAGE « RECEVOIR LE GUIDE » (lot S4a) — l'INTERRUPTEUR de
 * `POST /api/interne/confirmations-page-guide` (le Studio y RÉSERVE la liste des « merci » à envoyer).
 *
 * 🔴 ÉTEINT PAR DÉFAUT : vrai seulement si la variable vaut exactement `"true"`. Lu au runtime
 * (`process.env` brut, hors `env.ts`). Éteint = 503 `reception_eteinte`, rien n'est lu ni écrit.
 */
export function confirmationsPageGuideActives(): boolean {
  return process.env.CONFIRMATIONS_PAGE_GUIDE_ENABLED === "true";
}

/** Seau de débit PROPRE à la route des confirmations (distinct des autres routes internes). */
export const PREFIXE_DEBIT_CONFIRMATIONS = "internal:confirmations-page-guide";

/** Corps maximal accepté : 4 Ko (le corps utile tient en une quarantaine d'octets). */
export const CORPS_MAX_CONFIRMATIONS = 4096;

/** Nombre maximal de « merci » réservés par appel (et valeur par défaut). */
export const LOT_MAX_CONFIRMATIONS = 50;

/**
 * Fenêtre d'un « merci », en heures, comptée depuis la validation de la page : au-delà, la ligne
 * passe à `expire` (la fenêtre de messagerie du réseau, courte, est refermée). Rien n'est supprimé.
 */
export const FENETRE_MERCI_H = 48;

/**
 * Secret HMAC de la route des confirmations : `GUIDES_RESEAU_HMAC_SECRET` (+ `_PRECEDENT` pendant
 * une rotation), SANS AUCUN REPLI sur `VIDEOS_STUDIO_HMAC_SECRET`. Absent ou < 32 caractères → null
 * (503 `reception_non_configuree`).
 */
export function secretsConfirmationsPageGuide(
  env: Readonly<Record<string, string | undefined>> = process.env,
): { courant: string; precedent: string | null } | null {
  const courant = secretValide(env.GUIDES_RESEAU_HMAC_SECRET);
  if (!courant) return null;
  return { courant, precedent: secretValide(env.GUIDES_RESEAU_HMAC_SECRET_PRECEDENT) };
}

/**
 * PREUVE DE L'ACCORD de la page « Recevoir le guide » — nombre de jours, SANS clic sur le bouton du
 * lien du guide, avant que l'accord « en attente » passe « non vérifiée, à l'écart » (mise à
 * l'écart : RIEN n'est supprimé). Le guide peut partir jusqu'à J+7 (rattrapage,
 * `HORIZON_RATTRAPAGE_MS`) : 14 laisse au moins 7 jours de lecture après le dernier envoi possible,
 * sans garder indéfiniment un accord jamais vérifié. Garde : `config.spec.ts`.
 */
export const JOURS_AVANT_ECART_PREUVE = 14;

/**
 * INTERRUPTEUR de la mise à l'écart (job quotidien `guide-ia-crons` / `preuves`).
 *
 * 🔴 ÉTEINT PAR DÉFAUT : vrai seulement si la variable vaut exactement `"true"`. Lu au runtime
 * (`process.env` brut), conteneur WORKER. Éteint = le job sort sans lire la base.
 * ⚠️ Ne s'allume qu'APRÈS l'atterrissage de la migration ET de la confirmation au clic : sinon on
 * écarterait des personnes qui ont cliqué pendant que le clic ne confirmait pas encore.
 */
export function preuveEcartActif(): boolean {
  return process.env.PREUVE_PAGE_GUIDE_ECART_ENABLED === "true";
}
