/**
 * Validation des balises de tunnel reçues par `POST /api/funnel`.
 *
 * ── Ce que ce schéma protège ──────────────────────────────────────────────
 * La route est PUBLIQUE et non authentifiée : n'importe qui peut lui envoyer
 * n'importe quoi. Deux risques distincts, traités ici :
 *
 * 1. **Saturation de la table.** Sans bornes de longueur, un émetteur
 *    malveillant remplirait le disque avec des chaînes arbitraires. Chaque
 *    champ est donc borné à la taille exacte de sa colonne — une valeur trop
 *    longue fait rejeter la balise plutôt que de faire échouer l'écriture
 *    Postgres.
 *
 * 2. **Fuite de donnée personnelle.** Cette table doit rester anonyme pour
 *    tenir sous l'exemption de consentement (cf. la migration
 *    `20260812210000_funnel_events`). Les champs sont donc une liste FERMÉE :
 *    tout ce qui n'est pas déclaré ici est silencieusement écarté par Zod. Un
 *    développeur pressé qui ajouterait `email` côté client n'obtiendrait pas
 *    d'écriture — c'est voulu.
 *
 * 🔴 `gainBucket` accepte une tranche, JAMAIS un montant. Le montant exact,
 * croisé au secteur et à l'effectif, réidentifie une entreprise.
 */

import { z } from "zod";

/**
 * Tunnels mesurés — une clé par page qui participe à l'acquisition :
 *   - `diagnostic` : page d'atterrissage publicitaire (vidéo + promesse)
 *   - `simulateur` : questionnaire servi nu, cible des boutons de la VSL
 *   - `roi`        : même questionnaire servi dans le site public
 *
 * La clé dit OÙ l'événement a eu lieu. Le PARCOURS, lui, se reconstitue par
 * `sessionId` : c'est ainsi qu'on voit qu'un visiteur est entré par
 * `diagnostic` puis a terminé sur `simulateur`, sans avoir à stocker d'état.
 *
 * Liste fermée : un nom libre laisserait proliférer des variantes
 * (`simulateur`, `Simulateur`, `simu`) qui disperseraient les agrégats sans
 * jamais lever d'erreur.
 */
export const FUNNEL_KEYS = ["diagnostic", "simulateur", "roi"] as const;
export type FunnelKey = (typeof FUNNEL_KEYS)[number];

/**
 * Événements acceptés. Doublon assumé du type `FunnelEvent` de
 * `src/lib/tracking.ts` : celui-ci couvre tout le site (réservation, paiement,
 * chatbot), alors que seuls les événements d'acquisition sont journalisés ici.
 * Le test associé verrouille l'inclusion dans l'autre sens.
 */
export const FUNNEL_EVENT_NAMES = [
  "Landing Viewed",
  "Landing Video Played",
  "Landing CTA Clicked",
  "Simulator Started",
  "Simulator Step",
  "Simulator Completed",
  "Simulator Report Requested",
  "Simulator Callback Requested",
] as const;

/** Tranches de gain annuel estimé — alignées sur `gainBucketOf`. */
export const GAIN_BUCKETS = ["lt-10k", "10k-50k", "50k-150k", "150k-500k", "gt-500k"] as const;

export const funnelEventSchema = z
  .object({
    funnel: z.enum(FUNNEL_KEYS),
    event: z.enum(FUNNEL_EVENT_NAMES),
    /**
     * Identifiant de session éphémère, produit par le navigateur. Borné à 64
     * caractères comme la colonne. On n'exige pas un format précis : un
     * identifiant illisible n'est qu'un parcours non chaînable, pas une faille.
     */
    sessionId: z.string().min(8).max(64),
    locale: z.string().max(10).optional(),
    route: z.string().max(255).optional(),
    deviceType: z.enum(["mobile", "tablet", "desktop"]).optional(),
    step: z.string().max(60).optional(),
    /**
     * Bornes hautes volontairement larges mais finies : elles empêchent
     * `Infinity` et les entiers absurdes d'entrer en base tout en laissant de
     * la marge si le questionnaire s'allonge.
     */
    stepIndex: z.number().int().min(0).max(200).optional(),
    stepTotal: z.number().int().min(0).max(200).optional(),
    sector: z.string().max(60).optional(),
    headcount: z.string().max(40).optional(),
    gainBucket: z.enum(GAIN_BUCKETS).optional(),
    landing: z.string().max(60).optional(),
    placement: z.string().max(40).optional(),
  })
  // 🔴 `strict()` : une clé inconnue fait ÉCHOUER la validation au lieu d'être
  // ignorée. C'est la garde anti-fuite — si du code client se met un jour à
  // joindre une donnée personnelle, la balise est rejetée bruyamment plutôt
  // que d'écrire un champ inattendu.
  .strict();

export type FunnelEventInput = z.infer<typeof funnelEventSchema>;
