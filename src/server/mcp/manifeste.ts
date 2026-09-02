/**
 * **LE MANIFESTE** — ce que le socle consomme, épinglé par empreinte.
 *
 * Sortie de build de la DSL locale (§ 09) : id, version, mode, profils, et par
 * outil — nom, description, effect, dataClass, `inputSchema` et `outputSchema`
 * en JSON Schema, plafonds, compaction, `bytes`. Le socle ne voit JAMAIS un
 * `handler` ni un schéma Zod : il lit ce document, en vérifie l'empreinte
 * contre son `adapters.lock.json`, puis appelle `POST /api/mcp`.
 *
 * ═══ CE QUI EST VÉRIFIÉ ICI, AVANT LE SOCLE ═══
 *
 * Les refus du registre du socle (`core/registry/enregistrer.ts`) qui se
 * détectent sans lui : schéma d'entrée FERMÉ jusqu'au dernier sous-objet, aucun
 * nom réservé au contexte dans l'entrée, champs de rang 2 OPTIONNELS en sortie,
 * préfixe dérivé et jamais saisi, noms uniques, énumérations connues, mode
 * fédéré sans secret. Trouver le refus ici coûte une seconde ; le trouver à
 * l'enregistrement coûte un déploiement de production (~25 min).
 *
 * `bytes` est la taille canonique de l'entrée de l'outil, `bytes` exclu — c'est
 * l'unité du budget du socle (§ 14), des OCTETS, pas des tokens.
 */

import { z } from "zod/v4";

import {
  DATA_CLASSES,
  EFFECTS,
  ID_ADAPTATEUR,
  IDEMPOTENCES,
  MODE_ADAPTATEUR,
  NOMS_RESERVES_AU_CONTEXTE,
  nomComplet,
  PAGINATIONS,
  PROFILS_DE_L_ADAPTATEUR,
  PROFILS_DU_SOCLE,
  SCEAU_PROFILS,
  SECRETS_DE_L_ADAPTATEUR,
  VERSION_ADAPTATEUR,
  type DataClass,
  type Effect,
  type Idempotence,
  type OutilQuelconque,
  type Pagination,
} from "./contrat";
import {
  canoniser,
  empreinteCanonique,
  octetsCanoniques,
  versValeurJson,
  type ObjetJson,
  type ValeurJson,
} from "./json-canonique";
import { OUTILS } from "./registre";

export const VERSION_MANIFESTE = 1;

export interface ManifesteOutil {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly effect: Effect;
  readonly dataClass: DataClass;
  readonly idempotency: Idempotence;
  readonly pagination: Pagination;
  readonly inputSchema: ValeurJson;
  readonly outputSchema: ValeurJson;
  readonly maxBytes: number;
  readonly compaction: {
    readonly free: readonly string[];
    readonly tier2: readonly string[];
    readonly aggregateBy: string | null;
  };
  readonly idFields: readonly string[];
  readonly governanceFields: readonly string[];
  readonly bytes: number;
}

export interface Manifeste {
  readonly manifestVersion: number;
  readonly id: string;
  readonly version: string;
  readonly mode: "hébergé" | "fédéré";
  readonly profilesVersion: string;
  readonly profilesSha: string;
  readonly profiles: readonly string[];
  readonly secrets: readonly string[];
  readonly tools: readonly ManifesteOutil[];
}

const MOTIF_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MOTIF_VERSION = /^\d+\.\d+\.\d+$/;
const MOTIF_NOM_OUTIL = /^[a-z0-9]+(?:[._][a-z0-9]+)*$/;

/** Les clés de fermeture d'un schéma d'objet (draft 2020-12). */
const CLES_DE_FERMETURE = ["additionalProperties", "unevaluatedProperties"] as const;

function commeObjet(valeur: ValeurJson | undefined): ObjetJson | null {
  if (valeur === undefined || valeur === null || typeof valeur !== "object") return null;
  if (Array.isArray(valeur)) return null;
  return valeur as ObjetJson;
}

/**
 * Parcourt tous les sous-schémas d'objet et rend ceux qui ne sont PAS fermés.
 * Un objet est « à fermer » dès qu'il porte `type: "object"` ou `properties`.
 */
export function objetsOuverts(schema: ValeurJson): readonly string[] {
  const ouverts: string[] = [];
  const vus = new Set<ObjetJson>();
  const descendre = (valeur: ValeurJson | undefined, chemin: string): void => {
    const objet = commeObjet(valeur);
    if (objet === null || vus.has(objet)) return;
    vus.add(objet);
    const estObjet = objet["type"] === "object" || commeObjet(objet["properties"]) !== null;
    if (estObjet) {
      const ferme = CLES_DE_FERMETURE.some((cle) => objet[cle] === false);
      if (!ferme) ouverts.push(chemin);
    }
    for (const cle of ["properties", "$defs", "definitions", "patternProperties"] as const) {
      const conteneur = commeObjet(objet[cle]);
      if (conteneur === null) continue;
      for (const [nom, sous] of Object.entries(conteneur))
        descendre(sous, `${chemin}.${cle}.${nom}`);
    }
    for (const cle of ["allOf", "anyOf", "oneOf", "prefixItems"] as const) {
      const liste = objet[cle];
      if (!Array.isArray(liste)) continue;
      liste.forEach((sous, i) => descendre(sous, `${chemin}.${cle}[${String(i)}]`));
    }
    for (const cle of ["items", "not", "if", "then", "else", "contains"] as const) {
      descendre(objet[cle], `${chemin}.${cle}`);
    }
  };
  descendre(schema, "$");
  return ouverts;
}

/** Les noms de propriétés d'un schéma, à toute profondeur, avec leur chemin. */
export function proprietesProfondes(
  schema: ValeurJson,
): readonly { nom: string; chemin: string }[] {
  const trouvees: { nom: string; chemin: string }[] = [];
  const vus = new Set<ObjetJson>();
  const descendre = (valeur: ValeurJson | undefined, chemin: string): void => {
    const objet = commeObjet(valeur);
    if (objet === null || vus.has(objet)) return;
    vus.add(objet);
    const proprietes = commeObjet(objet["properties"]);
    if (proprietes !== null) {
      for (const [nom, sous] of Object.entries(proprietes)) {
        trouvees.push({ nom, chemin: `${chemin}.${nom}` });
        descendre(sous, `${chemin}.${nom}`);
      }
    }
    for (const cle of ["items", "additionalProperties"] as const) descendre(objet[cle], chemin);
    for (const cle of ["allOf", "anyOf", "oneOf", "prefixItems"] as const) {
      const liste = objet[cle];
      if (Array.isArray(liste)) liste.forEach((sous) => descendre(sous, chemin));
    }
    const defs = commeObjet(objet["$defs"]);
    if (defs !== null)
      for (const [nom, sous] of Object.entries(defs)) descendre(sous, `$defs.${nom}`);
  };
  descendre(schema, "$");
  return trouvees;
}

/** Les propriétés OBLIGATOIRES à la racine des éléments de `items`, ou `[]`. */
function requisDesItems(schemaSortie: ValeurJson): readonly string[] {
  const items = commeObjet(commeObjet(commeObjet(schemaSortie)?.["properties"])?.["items"]);
  const element = commeObjet(items?.["items"]);
  const requis = element?.["required"];
  return Array.isArray(requis) ? requis.filter((r): r is string => typeof r === "string") : [];
}

export class ErreurManifeste extends Error {
  public readonly anomalies: readonly string[];
  public constructor(anomalies: readonly string[]) {
    super(
      `Manifeste refusé — ${String(anomalies.length)} anomalie(s) :\n · ${anomalies.join("\n · ")}`,
    );
    this.name = "ErreurManifeste";
    this.anomalies = anomalies;
  }
}

export interface AnalyseManifeste {
  readonly manifeste: Manifeste | null;
  readonly anomalies: readonly string[];
  /** Combien d'outils ont été inspectés — une garde annonce ce qu'elle a lu. */
  readonly outilsInspectes: number;
}

export function analyserOutils(outils: readonly OutilQuelconque[] = OUTILS): AnalyseManifeste {
  const anomalies: string[] = [];

  if (!MOTIF_ID.test(ID_ADAPTATEUR)) anomalies.push(`id « ${ID_ADAPTATEUR} » hors forme.`);
  if (!MOTIF_VERSION.test(VERSION_ADAPTATEUR)) anomalies.push("version d'adaptateur hors forme.");
  if (MODE_ADAPTATEUR === "fédéré" && SECRETS_DE_L_ADAPTATEUR.length > 0) {
    anomalies.push("mode fédéré ⇒ secrets: [] — le socle refuserait l'enregistrement.");
  }
  const profilsConnus = new Set<string>(PROFILS_DU_SOCLE.map((p) => p.nom));
  for (const profil of PROFILS_DE_L_ADAPTATEUR) {
    if (!profilsConnus.has(profil)) anomalies.push(`profil « ${profil} » inconnu du socle.`);
  }
  if (outils.length === 0) anomalies.push("aucun outil — un manifeste vide n'a rien à épingler.");

  const outilsDuManifeste: ManifesteOutil[] = [];
  const nomsVus = new Set<string>();
  const reserves = new Set<string>(NOMS_RESERVES_AU_CONTEXTE);

  for (const outil of outils) {
    const ou = `outil « ${outil.name} »`;
    const avant = anomalies.length;

    if (!MOTIF_NOM_OUTIL.test(outil.name)) anomalies.push(`${ou} : nom hors forme.`);
    if (outil.name.startsWith(`${ID_ADAPTATEUR}.`)) {
      anomalies.push(`${ou} : le préfixe est DÉRIVÉ de l'id, jamais saisi (contrôle 5).`);
    }
    if (!MOTIF_VERSION.test(outil.version)) anomalies.push(`${ou} : version hors forme.`);
    if (outil.description.trim() === "") anomalies.push(`${ou} : description vide.`);
    if (!(EFFECTS as readonly string[]).includes(outil.effect))
      anomalies.push(`${ou} : effect inconnu.`);
    if (!(DATA_CLASSES as readonly string[]).includes(outil.dataClass)) {
      anomalies.push(`${ou} : dataClass inconnu.`);
    }
    if (!(IDEMPOTENCES as readonly string[]).includes(outil.idempotency)) {
      anomalies.push(`${ou} : idempotency inconnu.`);
    }
    if (!(PAGINATIONS as readonly string[]).includes(outil.pagination)) {
      anomalies.push(`${ou} : pagination inconnu.`);
    }
    if (!Number.isInteger(outil.maxBytes) || outil.maxBytes <= 0) {
      anomalies.push(`${ou} : maxBytes doit être un entier strictement positif.`);
    }
    if (outil.fixtureMax.trim() === "") anomalies.push(`${ou} : fixtureMax vide.`);
    const complet = nomComplet(outil.name);
    if (nomsVus.has(complet)) anomalies.push(`${ou} : nom complet en double (${complet}).`);
    nomsVus.add(complet);

    let entree: ValeurJson | null = null;
    let sortie: ValeurJson | null = null;
    try {
      entree = versValeurJson(z.toJSONSchema(outil.input, { io: "input" }), `${ou}, entrée`);
      sortie = versValeurJson(z.toJSONSchema(outil.output, { io: "output" }), `${ou}, sortie`);
    } catch (erreur) {
      anomalies.push(`${ou} : conversion en JSON Schema impossible — ${(erreur as Error).message}`);
    }
    if (entree !== null) {
      const ouverts = objetsOuverts(entree);
      if (ouverts.length > 0) {
        anomalies.push(`${ou} : schéma d'entrée OUVERT en ${ouverts.join(", ")} (contrôle 7).`);
      }
      const interdits = proprietesProfondes(entree).filter((p) => reserves.has(p.nom));
      if (interdits.length > 0) {
        anomalies.push(
          `${ou} : nom(s) réservé(s) au contexte dans l'entrée — ` +
            interdits.map((p) => `${p.nom} (${p.chemin})`).join(", ") +
            " (contrôle 7).",
        );
      }
    }
    if (sortie !== null) {
      const ouverts = objetsOuverts(sortie);
      if (ouverts.length > 0) {
        anomalies.push(`${ou} : schéma de sortie OUVERT en ${ouverts.join(", ")}.`);
      }
      const requis = requisDesItems(sortie);
      const tier2Obligatoires = outil.compaction.tier2.filter((champ) => requis.includes(champ));
      if (tier2Obligatoires.length > 0) {
        anomalies.push(
          `${ou} : ${tier2Obligatoires.join(", ")} est de rang 2 mais OBLIGATOIRE au schéma de ` +
            "sortie — la charge compactée ne validerait plus le schéma publié (§ 13.3).",
        );
      }
    }
    if (entree === null || sortie === null || anomalies.length > avant) continue;

    const sansBytes = {
      name: outil.name,
      version: outil.version,
      description: outil.description,
      effect: outil.effect,
      dataClass: outil.dataClass,
      idempotency: outil.idempotency,
      pagination: outil.pagination,
      inputSchema: entree,
      outputSchema: sortie,
      maxBytes: outil.maxBytes,
      compaction: {
        free: [...outil.compaction.free],
        tier2: [...outil.compaction.tier2],
        aggregateBy: outil.compaction.aggregateBy,
      },
      idFields: [...outil.idFields],
      governanceFields: [...outil.governanceFields],
    };
    outilsDuManifeste.push({ ...sansBytes, bytes: octetsCanoniques(sansBytes) });
  }

  if (anomalies.length > 0) {
    return { manifeste: null, anomalies, outilsInspectes: outils.length };
  }
  return {
    manifeste: {
      manifestVersion: VERSION_MANIFESTE,
      id: ID_ADAPTATEUR,
      version: VERSION_ADAPTATEUR,
      mode: MODE_ADAPTATEUR,
      profilesVersion: SCEAU_PROFILS.version,
      profilesSha: SCEAU_PROFILS.empreinte,
      profiles: [...PROFILS_DE_L_ADAPTATEUR],
      secrets: [...SECRETS_DE_L_ADAPTATEUR],
      tools: outilsDuManifeste,
    },
    anomalies: [],
    outilsInspectes: outils.length,
  };
}

export function construireManifeste(outils: readonly OutilQuelconque[] = OUTILS): Manifeste {
  const analyse = analyserOutils(outils);
  if (analyse.manifeste === null) throw new ErreurManifeste(analyse.anomalies);
  return analyse.manifeste;
}

/** Le texte canonique — c'est LUI que le SHA couvre, pas le fichier indenté. */
export function texteDuManifeste(manifeste: Manifeste): string {
  return canoniser(manifeste as unknown as ValeurJson);
}

export function empreinteDuManifeste(manifeste: Manifeste): string {
  return empreinteCanonique(manifeste as unknown as ValeurJson);
}
