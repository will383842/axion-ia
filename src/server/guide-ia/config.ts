/**
 * GUIDE IA — les réglages de la chaîne d'envoi (lot L2, 2026-09-24).
 *
 * Décision n° 1 de Will : le formulaire envoie le guide TOUT DE SUITE, à une
 * adresse que personne n'a vérifiée, depuis le compte d'envoi qui porte aussi
 * les factures, les convocations Qualiopi et les liens de connexion. Chaque
 * borne ci-dessous protège ce compte-là — c'est lui qu'un abus ou une rafale de
 * rebonds mettrait en danger, pas le guide.
 *
 * ⚠️ Module PUR (aucun import) : lu par l'app ET par le worker.
 */

/** Nom de l'aimant dans `guide_requests.aimant`. */
export const AIMANT_GUIDE_IA = "guide-ia";

/** Gabarit d'e-mail « Votre guide ». Transactionnel : JAMAIS `marketing: true`. */
export const GABARIT_GUIDE = "guide-ia-envoi" as const;

/**
 * Au plus 3 e-mails du guide par destinataire sur 24 h glissantes. Au-delà,
 * le formulaire répond « c'est parti » sans rien envoyer (anti-énumération) :
 * sans cette borne, n'importe qui ferait écrire en boucle à un tiers, en
 * changeant d'adresse IP.
 */
export const LIMITE_PAR_DESTINATAIRE = 3;
export const FENETRE_DESTINATAIRE_MS = 24 * 3_600_000;

/**
 * Plafond HORAIRE des e-mails du guide, pour la chaîne entière. Le worker
 * d'e-mails est limité à 40/h tous gabarits confondus (`email-worker.ts`) : le
 * guide n'en prend jamais plus de 30, et passe APRÈS les autres grâce à sa
 * priorité BullMQ (`PRIORITE_GUIDE`). Une demande au-delà du plafond n'est pas
 * perdue : elle attend en base, et le rattrapage horaire la reprend.
 *
 * Mesure (test `__tests__/envoi.spec.ts`, bloc « un pic de 300 demandes ») :
 * 300 demandes en une heure → 30 mises en file tout de suite, 270 reprises par
 * le rattrapage à raison de 30 par heure. Les factures ne font jamais la queue derrière le guide.
 */
export const PLAFOND_HORAIRE_GUIDE = 30;

/**
 * Priorité BullMQ des e-mails du guide. Un job SANS priorité passe avant tout
 * job priorisé : les factures, convocations et liens de connexion (enfilés sans
 * priorité) sont donc toujours servis d'abord quand le limiteur de 40/h mord.
 */
export const PRIORITE_GUIDE = 10;

/**
 * Coupe-circuit : au-delà de ce nombre de rebonds DURS du guide en une heure,
 * l'envoi du guide est suspendu (Telegram prévenu). Des adresses inventées ou
 * mal tapées en série, c'est la réputation du compte d'envoi qui paie.
 */
export const SEUIL_REBONDS_DURS_PAR_HEURE = 5;

/**
 * Clé du réglage (`settings`) qui porte l'état du coupe-circuit. Présente =
 * envoi suspendu. Pour ré-armer : supprimer ce réglage dans la console
 * (Réglages), une fois la cause comprise.
 */
export const CLE_COUPE_CIRCUIT = "guide-ia.coupe-circuit";

/**
 * Rattrapage : une demande est reprise si elle n'est pas partie et que son
 * dernier passage en file date de plus d'une heure (âge compté depuis
 * `queued_at`, jamais depuis la demande). Une demande jamais mise en file
 * (plafond atteint, coupe-circuit) attend au moins `DELAI_AVANT_RATTRAPAGE_MS`,
 * pour ne pas doubler le chemin direct.
 */
export const AGE_RATTRAPAGE_MS = 3_600_000;
export const DELAI_AVANT_RATTRAPAGE_MS = 5 * 60_000;
/** Au-delà, une demande n'est plus reprise automatiquement (guide trop tardif). */
export const HORIZON_RATTRAPAGE_MS = 7 * 24 * 3_600_000;

/** Au-delà de ce délai en suspension, la sentinelle quotidienne alerte. */
export const COUPE_CIRCUIT_TROP_LONG_MS = 24 * 3_600_000;

/** Entité liée au journal d'envoi (`email_logs.entity_type`). */
export const ENTITE_GUIDE = "GuideRequest";
