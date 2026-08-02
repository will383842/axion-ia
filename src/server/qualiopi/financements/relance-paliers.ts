/**
 * Qualiopi — ÉCHELLE DES PALIERS DE RELANCE d'une facture impayée.
 *
 * ## Le trou que ce module ferme
 *
 * L'échelle s'arrêtait à J30. Passé trente jours de retard, le cron ne
 * proposait plus RIEN : la créance la plus ancienne — donc la plus en danger —
 * était la seule à ne plus jamais remonter à l'écran. Une facture à 90 jours
 * était strictement aussi silencieuse qu'une facture payée.
 *
 * Deux paliers d'escalade sont ajoutés :
 *   - **J45** : mise en demeure. C'est le palier qui fait courir les intérêts de
 *     façon incontestable et qui, envoyé en recommandé, constitue la pièce
 *     exigée avant toute procédure (injonction de payer, référé).
 *   - **J60** : avant contentieux. Dernier message amiable ; au-delà, la
 *     décision n'est plus épistolaire (recouvrement, provision, abandon).
 *
 * ## Deux mécaniques distinctes, à ne pas confondre
 *
 *   - `RelanceProposee` (ce module) = une ACTION proposée à l'admin, paliers
 *     J1 → J60, envoi manuel après double validation ;
 *   - alerte `facture_impayee_j60` = une ESCALADE de pilotage, un seul seuil.
 *
 * Module PUR : aucun accès Prisma, aucune horloge lue. Testable seul.
 */

/** Identifiant de palier, stocké tel quel dans `RelanceProposee.palier`. */
export type PalierRelance = "j1" | "j15" | "j30" | "j45" | "j60";

/**
 * Ton de la relance — pilote la rédaction de l'e-mail.
 *
 * Séparé de l'identifiant de palier à dessein : le ton est ce que LIT le
 * client, le palier est ce que compte le système. Les faire coïncider
 * aujourd'hui n'oblige pas à les confondre demain.
 */
export type TonRelance = "rappel" | "ferme" | "mise_en_demeure" | "avant_contentieux";

export interface DefinitionPalier {
  readonly palier: PalierRelance;
  /** Ancienneté MINIMALE du retard, en jours, pour atteindre ce palier. */
  readonly joursMin: number;
  readonly ton: TonRelance;
  /** Libellé court affiché à l'admin (jamais envoyé au client). */
  readonly libelle: string;
}

/**
 * Échelle complète, du plus doux au plus ferme.
 *
 * ⚠️ ORDRE CROISSANT de `joursMin` — `palierPourJours` parcourt à l'envers et
 * s'arrête au premier seuil atteint. Insérer un palier hors ordre casserait la
 * sélection en silence ; `relance-paliers.spec.ts` verrouille l'invariant.
 */
export const PALIERS_RELANCE_FACTURE: readonly DefinitionPalier[] = [
  { palier: "j1", joursMin: 1, ton: "rappel", libelle: "Rappel (J+1)" },
  { palier: "j15", joursMin: 15, ton: "rappel", libelle: "Relance (J+15)" },
  { palier: "j30", joursMin: 30, ton: "ferme", libelle: "Relance ferme (J+30)" },
  { palier: "j45", joursMin: 45, ton: "mise_en_demeure", libelle: "Mise en demeure (J+45)" },
  { palier: "j60", joursMin: 60, ton: "avant_contentieux", libelle: "Avant contentieux (J+60)" },
] as const;

/**
 * Palier applicable à un retard de `jours` jours, ou `null` si la facture n'est
 * pas encore échue (aucune relance n'a alors de sens).
 *
 * On rend le palier LE PLUS ÉLEVÉ atteint, jamais tous les paliers franchis :
 * une facture découverte à J+50 doit recevoir une mise en demeure, pas la série
 * complète des quatre messages précédents d'un coup.
 */
export function palierPourJours(jours: number): PalierRelance | null {
  if (!Number.isFinite(jours)) return null;
  for (let i = PALIERS_RELANCE_FACTURE.length - 1; i >= 0; i--) {
    const def = PALIERS_RELANCE_FACTURE[i];
    if (def !== undefined && jours >= def.joursMin) return def.palier;
  }
  return null;
}

/** Définition d'un palier, ou `null` si l'identifiant est inconnu (donnée ancienne). */
export function definitionPalier(palier: string): DefinitionPalier | null {
  return PALIERS_RELANCE_FACTURE.find((d) => d.palier === palier) ?? null;
}

/**
 * Libellé affiché à l'admin. Repli sur l'identifiant brut en majuscules : une
 * relance créée sous un palier retiré du code doit rester lisible à l'écran
 * plutôt que d'afficher un vide.
 */
export function libellePalier(palier: string): string {
  return definitionPalier(palier)?.libelle ?? palier.toUpperCase();
}

/** Ton de rédaction d'un palier. Repli « rappel » : le ton le moins agressif. */
export function tonPalier(palier: string): TonRelance {
  return definitionPalier(palier)?.ton ?? "rappel";
}
