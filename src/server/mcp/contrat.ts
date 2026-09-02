/**
 * **LE CONTRAT D'ADAPTATEUR — CÔTÉ AXION-IA.** (cahier des charges `axion-ops`, § 09)
 *
 * Ce fichier est la DSL d'écriture LOCALE : des schémas Zod vivants et un
 * `handler`. Rien de tout cela ne franchit le fil. Ce que le socle consomme est
 * le **manifeste JSON** (`manifeste.ts`), épinglé par empreinte dans son
 * `adapters.lock.json`, et il appelle `POST /api/mcp` en JSON-RPC.
 *
 * ═══ POURQUOI CE N'EST PAS UN IMPORT DU DÉPÔT `axion-ops` ═══
 *
 * Le socle vit dans un autre dépôt, sans paquet publié. Le build d'Axion-IA
 * tourne sur GitHub Actions, sans accès à ce dépôt (ADR 0026). On porte donc le
 * contrat ici, **à l'identique**, et une garde (`__tests__/harnais.spec.ts`)
 * confronte ce qui doit l'être : énumérations, noms réservés au contexte,
 * forme du manifeste, sceau des profils. Si le socle bouge, c'est la garde qui
 * rougit — pas la production qui se tait.
 *
 * ═══ CE QUI EST REPRIS DU SOCLE, ET D'OÙ ═══
 *
 * Toutes les valeurs ci-dessous sont lues dans `axion-ops` au commit
 * `041970c` (2026-09-02) : `core/types.ts`, `core/adapter-kit/types.ts`,
 * `core/profiles/profiles.ts`. Le sceau des profils a été **exécuté** depuis le
 * code du socle (`SCEAU_PROFILS`), pas recopié d'une spécification — une valeur
 * qu'un tiers doit accepter se confronte à SON code.
 */

import type { z } from "zod/v4";

// ═════════════════════════════════════════════════════════════════════════════
//  L'identité de l'adaptateur
// ═════════════════════════════════════════════════════════════════════════════

/**
 * L'id de l'adaptateur. **C'est de lui que dérive le préfixe de chaque outil**
 * (`axionia.inbox.recent`) : un outil n'écrit JAMAIS son préfixe (§ 09,
 * contrôle 5). Sans point, sans majuscule : la grammaire de scope du socle
 * (`ops_policy`) lit « a.b.c » comme « l'outil b.c de l'adaptateur a ».
 */
export const ID_ADAPTATEUR = "axionia";

/** Version de l'ADAPTATEUR. Chaque outil porte la sienne (§ 13.4). */
export const VERSION_ADAPTATEUR = "1.0.0";

/**
 * Mode fédéré : l'adaptateur vit chez son produit et détient ses identifiants
 * par les moyens du produit. Le socle ne lui transmet JAMAIS un secret —
 * assertion au registre : `mode === "fédéré" && secrets.length > 0` ⇒ refus.
 */
export const MODE_ADAPTATEUR = "fédéré" as const;

/** Mode fédéré ⇒ `secrets: []`. Un tableau vide, et il est typé pour le rester. */
export const SECRETS_DE_L_ADAPTATEUR: readonly never[] = [];

// ═════════════════════════════════════════════════════════════════════════════
//  Les profils du socle — énumération FERMÉE, et son sceau
// ═════════════════════════════════════════════════════════════════════════════

/**
 * L'énumération des profils du socle (`core/profiles/profiles.ts`, version
 * 1.0.0). Un profil hors de cette liste ne compile pas côté socle ; ici, il
 * fait rougir le harnais.
 */
export const PROFILS_DU_SOCLE = [
  { nom: "courrier", depuis: "1.0.0" },
  { nom: "dev", depuis: "1.0.0" },
  { nom: "admin", depuis: "1.0.0" },
  { nom: "audit", depuis: "1.0.0" },
] as const;

export type NomDeProfil = (typeof PROFILS_DU_SOCLE)[number]["nom"];

/**
 * Le sceau de l'énumération : version + empreinte SHA-256 du JSON canonique de
 * `{ version, profils: [{ nom, depuis }] }`. **Valeur EXÉCUTÉE** depuis
 * `axion-ops` (`SCEAU_PROFILS`) le 2026-09-02. Le harnais recalcule
 * l'empreinte depuis `PROFILS_DU_SOCLE` avec le même algorithme : si la liste
 * et le sceau divergent, il rougit.
 */
export const SCEAU_PROFILS = {
  version: "1.0.0",
  empreinte: "6b9646f62b9451abeb4a5744e983bd1870cd62c5b9dccf0cc9af4c1fec27ed0a",
} as const;

/** Les profils sur lesquels cet adaptateur s'expose. La console = `admin`. */
export const PROFILS_DE_L_ADAPTATEUR: readonly NomDeProfil[] = ["admin"];

// ═════════════════════════════════════════════════════════════════════════════
//  Les énumérations du socle — sans valeur par défaut permissive
// ═════════════════════════════════════════════════════════════════════════════

export const EFFECTS = ["read", "write-draft", "send", "destructive"] as const;
export type Effect = (typeof EFFECTS)[number];

export const DATA_CLASSES = ["none", "internal", "personal", "sensitive"] as const;
export type DataClass = (typeof DATA_CLASSES)[number];

export const IDEMPOTENCES = ["key", "non-rejouable", "n/a"] as const;
export type Idempotence = (typeof IDEMPOTENCES)[number];

export const PAGINATIONS = ["keyset", "page", "none"] as const;
export type Pagination = (typeof PAGINATIONS)[number];

/**
 * Les noms que le socle RÉSERVE au contexte d'autorisation : propriétés de
 * `ToolContext`, de `Habilitations`, et les noms réservés hors contexte
 * (`core/adapter-kit/autorisation.ts`). **Aucun schéma d'entrée ne peut porter
 * l'un d'eux** (§ 09, contrôle 7) : une décision de droit atteint la couche
 * service par `ctx`, et par lui seul.
 */
export const NOMS_RESERVES_AU_CONTEXTE = [
  "principal",
  "sessionId",
  "scopes",
  "policyLevel",
  "profile",
  "idempotencyRef",
  "requestId",
  "deadline",
  "habilitations",
  "peutVoirAppels",
  "roleConsole",
  "idempotencyKey",
] as const;

// ═════════════════════════════════════════════════════════════════════════════
//  Le contexte d'appel — le SEUL chemin d'une décision de droit
// ═════════════════════════════════════════════════════════════════════════════

/** Ce que le socle calcule (§ 19 bis) et que l'adaptateur ne fait que LIRE. */
export interface Habilitations {
  /**
   * Le rôle a-t-il le droit de lire les coordonnées des prospects ? Décision
   * W-6 : tant qu'elle n'est pas prise, **le rôle le plus faible**, donc
   * `false`, et coordonnées masquées. Cf. `identite.ts`.
   */
  readonly peutVoirAppels: boolean;
  /**
   * **LE RÔLE CONSOLE au nom duquel l'adaptateur agit** (§ 19 bis : « le socle
   * traduit scope socle → rôle console → drapeaux »). Il est ici parce que
   * certaines lectures du produit appliquent elles-mêmes le prédicat commun sur
   * un rôle — c'est le cas du dossier de candidat, où recevoir un booléen déjà
   * tranché rendrait le cloisonnement dépendant de chaque appelant.
   *
   * ✅ **RÉPERCUTÉ CÔTÉ SOCLE le 2026-09-02** (axion-ops, PR #1, commit
   *    `ad6d77c`) : `Habilitations.roleConsole: string | null` y existe, et le
   *    nom fait partie des 12 que le contrôle 7 du socle refuse dans un schéma
   *    d'entrée — le même compte qu'ici. Le socle ne porte aucun nom de rôle
   *    (`null` = « aucun rôle porté ») : la valeur vient TOUJOURS du pont
   *    d'identité local, `identite.ts`, et vaut le rôle le plus faible (W-6,
   *    confirmé le 2026-09-02). Rien ne la lit sur le fil, et c'est voulu.
   */
  readonly roleConsole: string;
}

export interface ContexteOutil {
  /** Qui appelle — un identifiant opaque, journalisé, jamais interprété. */
  readonly principal: string;
  readonly requestId: string;
  readonly deadline: Date;
  readonly habilitations: Habilitations;
}

// ═════════════════════════════════════════════════════════════════════════════
//  Un outil
// ═════════════════════════════════════════════════════════════════════════════

export interface AnnotationsCompaction {
  /** Champs à RACCOURCIR en premier (< 150 % du plafond). */
  readonly free: readonly string[];
  /** Champs de rang 2, RETIRÉS au deuxième palier — OPTIONNELS au schéma. */
  readonly tier2: readonly string[];
  /** Clé du mode agrégat (> 300 %), ou `null` — alors `result_too_large`. */
  readonly aggregateBy: string | null;
}

export interface DefinitionOutil<TEntree extends z.ZodType, TSortie extends z.ZodType> {
  /** Nom LOCAL : `inbox.recent`. Le préfixe est dérivé, jamais saisi. */
  readonly name: string;
  readonly version: string;
  /** Obligatoire, journalisée, COMPTÉE AU BUDGET du socle (§ 14). */
  readonly description: string;
  readonly effect: Effect;
  readonly dataClass: DataClass;
  readonly idempotency: Idempotence;
  readonly pagination: Pagination;
  /** Zod, FERMÉ (`z.strictObject`). Vérifié par le harnais, contrôle 7. */
  readonly input: TEntree;
  /** Zod — la forme NON COMPACTÉE ; tout champ de rang 2 y est optionnel. */
  readonly output: TSortie;
  /** Plafond de sortie en octets, HORS du schéma. Le socle compacte au-delà. */
  readonly maxBytes: number;
  readonly compaction: AnnotationsCompaction;
  /** Champs porteurs d'identifiants — et le SCHÉMA les referme (ADR 0015). */
  readonly idFields: readonly string[];
  /** Champs de gouvernance du schéma d'entrée. Aucun pour une lecture. */
  readonly governanceFields: readonly string[];
  /** Chemin du jeu MAXIMAL, relatif à `src/server/mcp/`. Contrôle 4. */
  readonly fixtureMax: string;
  readonly handler: (input: z.output<TEntree>, ctx: ContexteOutil) => Promise<z.output<TSortie>>;
}

/** Un outil tel que le registre et le harnais le manipulent. */
export type OutilQuelconque = DefinitionOutil<z.ZodType, z.ZodType>;

/** Garde les types de l'auteur, puis les efface vers `OutilQuelconque`. */
export function definirOutil<TEntree extends z.ZodType, TSortie extends z.ZodType>(
  outil: DefinitionOutil<TEntree, TSortie>,
): DefinitionOutil<TEntree, TSortie> {
  return outil;
}

/** Le nom complet servi par `tools/list` : préfixe DÉRIVÉ + nom local. */
export function nomComplet(nomLocal: string): string {
  return `${ID_ADAPTATEUR}.${nomLocal}`;
}
