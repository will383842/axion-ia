/**
 * Registres publics français GRATUITS et sans clé (2026-11-02) :
 *   · API Recherche d'entreprises (recherche-entreprises.api.gouv.fr) ;
 *   · BODACC via l'API Open Data (bodacc-datadila.opendatasoft.com).
 *
 * Données d'entreprise uniquement : seuls les dirigeants publiés au registre sont gardés (nom,
 * prénoms, qualité — ni date de naissance ni adresse personnelle). Aucun scraping de LinkedIn,
 * Pages Jaunes ou société.com. Le contenu reçu est une DONNÉE, jamais une instruction.
 * Le `fetch` est injectable ; par défaut `ssrfSafeFetch`.
 */

import { z } from "zod";

import { ssrfSafeFetch } from "@/lib/ssrf-safe-fetch";

const URL_RECHERCHE = "https://recherche-entreprises.api.gouv.fr/search";
const URL_BODACC =
  "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";

export type FetchRegistre = (url: string, init?: RequestInit) => Promise<Response>;

export class ErreurRegistre extends Error {
  constructor(
    readonly source: "recherche-entreprises" | "bodacc",
    message: string,
  ) {
    super(`Registre ${source} : ${message}`);
    this.name = "ErreurRegistre";
  }
}

const texteOuNull = z
  .string()
  .nullish()
  .transform((v) => (v && v.length > 0 ? v : null));
const nombreOuNull = z
  .number()
  .nullish()
  .transform((v) => v ?? null);

// ── Recherche d'entreprises ─────────────────────────────────────────────────

const EtablissementBrut = z.object({
  siret: texteOuNull,
  adresse: texteOuNull,
  code_postal: texteOuNull,
  libelle_commune: texteOuNull,
  activite_principale: texteOuNull,
  tranche_effectif_salarie: texteOuNull,
  est_siege: z.boolean().nullish(),
  etat_administratif: texteOuNull,
});

const DirigeantBrut = z.object({
  nom: texteOuNull,
  prenoms: texteOuNull,
  denomination: texteOuNull,
  qualite: texteOuNull,
  type_dirigeant: texteOuNull,
});

const FinanceBrute = z.object({ ca: nombreOuNull, resultat_net: nombreOuNull });

const EntrepriseBrute = z.object({
  siren: z.string().regex(/^\d{9}$/),
  nom_complet: texteOuNull,
  nom_raison_sociale: texteOuNull,
  nature_juridique: texteOuNull,
  activite_principale: texteOuNull,
  tranche_effectif_salarie: texteOuNull,
  date_creation: texteOuNull,
  etat_administratif: texteOuNull,
  nombre_etablissements: nombreOuNull,
  nombre_etablissements_ouverts: nombreOuNull,
  siege: EtablissementBrut.nullish(),
  matching_etablissements: z.array(EtablissementBrut).nullish(),
  dirigeants: z.array(DirigeantBrut).nullish(),
  finances: z.record(z.string(), FinanceBrute).nullish(),
});

const ReponseRecherche = z.object({ results: z.array(EntrepriseBrute) });

export const EtablissementSchema = z.object({
  siret: z.string().nullable(),
  adresse: z.string().nullable(),
  codePostal: z.string().nullable(),
  commune: z.string().nullable(),
  naf: z.string().nullable(),
  trancheEffectif: z.string().nullable(),
  siege: z.boolean(),
  actif: z.boolean().nullable(),
});

export const DirigeantSchema = z.object({
  nom: z.string(),
  qualite: z.string().nullable(),
  personnePhysique: z.boolean(),
});

export const FinanceAnnuelleSchema = z.object({
  annee: z.number().int(),
  chiffreAffaires: z.number().nullable(),
  resultatNet: z.number().nullable(),
});

export const EntrepriseSchema = z.object({
  siren: z.string().regex(/^\d{9}$/),
  nom: z.string(),
  natureJuridique: z.string().nullable(),
  naf: z.string().nullable(),
  trancheEffectif: z.string().nullable(),
  dateCreation: z.string().nullable(),
  active: z.boolean().nullable(),
  nbEtablissements: z.number().nullable(),
  nbEtablissementsOuverts: z.number().nullable(),
  siege: EtablissementSchema.nullable(),
  etablissements: z.array(EtablissementSchema),
  dirigeants: z.array(DirigeantSchema),
  finances: z.array(FinanceAnnuelleSchema),
});
export type Entreprise = z.infer<typeof EntrepriseSchema>;

function etablissement(e: z.infer<typeof EtablissementBrut>): z.infer<typeof EtablissementSchema> {
  return {
    siret: e.siret,
    adresse: e.adresse,
    codePostal: e.code_postal,
    commune: e.libelle_commune,
    naf: e.activite_principale,
    trancheEffectif: e.tranche_effectif_salarie,
    siege: e.est_siege === true,
    actif: e.etat_administratif ? e.etat_administratif === "A" : null,
  };
}

function entreprise(b: z.infer<typeof EntrepriseBrute>): Entreprise {
  // Dirigeants publiés seulement : nom + prénoms + qualité. Rien d'autre n'est copié.
  const dirigeants = (b.dirigeants ?? []).flatMap((d) => {
    const physique = d.type_dirigeant ? d.type_dirigeant === "personne physique" : !d.denomination;
    const nom = physique
      ? [d.prenoms, d.nom].filter(Boolean).join(" ")
      : (d.denomination ?? d.nom ?? "");
    return nom ? [{ nom, qualite: d.qualite, personnePhysique: physique }] : [];
  });
  const finances = Object.entries(b.finances ?? {})
    .map(([annee, f]) => ({
      annee: Number(annee),
      chiffreAffaires: f.ca,
      resultatNet: f.resultat_net,
    }))
    .filter((f) => Number.isInteger(f.annee))
    .sort((a, c) => c.annee - a.annee);
  return EntrepriseSchema.parse({
    siren: b.siren,
    nom: b.nom_complet ?? b.nom_raison_sociale ?? b.siren,
    natureJuridique: b.nature_juridique,
    naf: b.activite_principale,
    trancheEffectif: b.tranche_effectif_salarie,
    dateCreation: b.date_creation,
    active: b.etat_administratif ? b.etat_administratif === "A" : null,
    nbEtablissements: b.nombre_etablissements,
    nbEtablissementsOuverts: b.nombre_etablissements_ouverts,
    siege: b.siege ? etablissement(b.siege) : null,
    etablissements: (b.matching_etablissements ?? []).map(etablissement),
    dirigeants,
    finances,
  });
}

async function lireJson(
  source: "recherche-entreprises" | "bodacc",
  res: Response,
): Promise<unknown> {
  if (!res.ok) throw new ErreurRegistre(source, `réponse HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new ErreurRegistre(source, "réponse illisible (JSON invalide)");
  }
}

const SIREN = /^\d{9}$/;
const nettoyer = (s: string) => s.replace(/\s+/g, "");

/** Cherche une entreprise par SIREN (9 chiffres, espaces tolérés) ou par nom. Renvoie la liste. */
export async function rechercherEntreprise(
  siren_ou_nom: string,
  fetchImpl: FetchRegistre = ssrfSafeFetch,
): Promise<Entreprise[]> {
  const brut = siren_ou_nom.trim();
  if (!brut) throw new ErreurRegistre("recherche-entreprises", "requête vide");
  const q = SIREN.test(nettoyer(brut)) ? nettoyer(brut) : brut;
  const url = `${URL_RECHERCHE}?${new URLSearchParams({ q, per_page: "5", minimal: "false" })}`;
  const res = await fetchImpl(url, { headers: { accept: "application/json" } });
  const json = await lireJson("recherche-entreprises", res);
  const lu = ReponseRecherche.safeParse(json);
  if (!lu.success) throw new ErreurRegistre("recherche-entreprises", "forme de réponse inattendue");
  return lu.data.results.map(entreprise);
}

// ── BODACC ──────────────────────────────────────────────────────────────────

const AnnonceBrute = z.object({
  id: texteOuNull,
  numeroannonce: z.union([z.string(), z.number()]).nullish(),
  dateparution: texteOuNull,
  typeavis_lib: texteOuNull,
  typeavis: texteOuNull,
  familleavis_lib: texteOuNull,
  commercant: texteOuNull,
  ville: texteOuNull,
  cp: texteOuNull,
  tribunal: texteOuNull,
});
const ReponseBodacc = z.object({ results: z.array(AnnonceBrute) });

export const AnnonceBodaccSchema = z.object({
  id: z.string().nullable(),
  numero: z.string().nullable(),
  date: z.string().nullable(),
  type: z.string().nullable(),
  famille: z.string().nullable(),
  denomination: z.string().nullable(),
  ville: z.string().nullable(),
  codePostal: z.string().nullable(),
  tribunal: z.string().nullable(),
});
export type AnnonceBodacc = z.infer<typeof AnnonceBodaccSchema>;

/** Annonces BODACC d'un SIREN, les plus récentes d'abord (50 au plus). */
export async function annoncesBodacc(
  siren: string,
  fetchImpl: FetchRegistre = ssrfSafeFetch,
): Promise<AnnonceBodacc[]> {
  const s = nettoyer(siren);
  if (!SIREN.test(s)) throw new ErreurRegistre("bodacc", "SIREN invalide (9 chiffres attendus)");
  const params = new URLSearchParams({
    where: `registre like "${s}"`,
    order_by: "dateparution desc",
    limit: "50",
  });
  const res = await fetchImpl(`${URL_BODACC}?${params}`, {
    headers: { accept: "application/json" },
  });
  const json = await lireJson("bodacc", res);
  const lu = ReponseBodacc.safeParse(json);
  if (!lu.success) throw new ErreurRegistre("bodacc", "forme de réponse inattendue");
  return lu.data.results.map((a) =>
    AnnonceBodaccSchema.parse({
      id: a.id,
      numero: a.numeroannonce != null ? String(a.numeroannonce) : null,
      date: a.dateparution,
      type: a.typeavis_lib ?? a.typeavis,
      famille: a.familleavis_lib,
      denomination: a.commercant,
      ville: a.ville,
      codePostal: a.cp,
      tribunal: a.tribunal,
    }),
  );
}
