/**
 * Adaptateur PUR : une ligne publique de `TeamMember` → fiche + contenu du gabarit `ProfilCollaborateur`.
 *
 * Confidentialité, appliquée ICI (et non à l'affichage) pour que ni la page ni le JSON-LD ne puissent
 * l'oublier :
 *  - prénom seul : `nomComplet` n'est jamais posé ;
 *  - photo réelle seulement avec `photoKind = "reelle"` ET consentement photo daté (sinon avatar) ;
 *  - LinkedIn seulement avec consentement LinkedIn daté et URL https ;
 *  - aucun e-mail : la ligne publique n'en porte pas.
 */
import type { ContenuFiche } from "./contenu";
import { categoriePublique } from "./depuis-membre-categorie";
import { estTextePropre, fichePublique } from "./regles";
import type { FicheCollaborateur } from "./types";
import type { FicheComplete } from "./adaptateurs";

/** Les seuls champs lus en base pour une fiche publique (cf. `SELECT_PUBLIC`). */
export interface MembrePublic {
  slug: string;
  category: string;
  firstName: string;
  organizationName: string | null;
  jobTitle: string;
  headline: string | null;
  bioMd: string | null;
  skills: string[];
  languages: string[];
  categoryAnswers: unknown;
  questionnaireVersion: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  citySlug: string | null;
  departmentCode: string | null;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  showOnMap: boolean;
  photoKind: string;
  photoUrl256: string | null;
  photoUrl1024: string | null;
  photoAlt: string | null;
  photoConsentAt: Date | null;
  linkedinConsentAt: Date | null;
  publishedAt: Date | null;
  updatedAt: Date;
}

function estHttps(valeur: string | null): valeur is string {
  if (valeur === null) return false;
  try {
    return new URL(valeur.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

function premierParagraphe(md: string | null): string {
  const p =
    (md ?? "")
      .split(/\n{2,}/)[0]
      ?.replace(/\*\*/g, "")
      .trim() ?? "";
  return p.length > 450 ? `${p.slice(0, 447).trimEnd()}…` : p;
}

export function ficheDepuisMembre(m: MembrePublic): FicheComplete {
  const photoOk =
    m.photoKind === "reelle" &&
    m.photoConsentAt !== null &&
    (m.photoUrl1024 ?? "").trim() !== "" &&
    (m.photoUrl256 ?? "").trim() !== "";
  const linkedinOk = m.linkedinConsentAt !== null && estHttps(m.linkedinUrl);
  const ville = (m.locationLabel ?? "").trim();
  const reponse = (m.headline ?? "").trim() || premierParagraphe(m.bioMd);

  const fiche: FicheCollaborateur = {
    slug: m.slug,
    categorie: categoriePublique(m.category),
    prenom: m.firstName,
    estDirigeantPrincipal: false,
    accord: "n",
    fonction: m.jobTitle,
    reponseQui: reponse,
    afficherSurCarte: m.showOnMap,
    ...(ville ? { ville } : {}),
    ...(m.departmentCode ? { departement: m.departmentCode } : {}),
    ...(photoOk
      ? {
          photo: {
            src: m.photoUrl1024 as string,
            largeur: 1024,
            hauteur: 1024,
            alt: (m.photoAlt ?? "").trim() || `Portrait de ${m.firstName}`,
            consentementLe: (m.photoConsentAt as Date).toISOString(),
          },
        }
      : {}),
  };

  // Tout texte du contenu passe par le même filtre que la fiche publique (formulations interdites,
  // fragments de nom de famille) : jamais une valeur brute de la base.
  const pub = fichePublique(fiche);
  const fonctionPropre = pub?.fonction ?? "";
  const reponsePropre = pub?.reponseQui ?? "";
  const villePropre = pub?.ville ?? "";
  const propre = (t: string): boolean => estTextePropre(t);

  const identite: Array<{ terme: string; valeur: string }> = [];
  if (fonctionPropre) identite.push({ terme: "Fonction", valeur: fonctionPropre });
  if (villePropre) identite.push({ terme: "Lieu", valeur: villePropre });
  const langues = m.languages.map((l) => l.trim()).filter((l) => l !== "" && propre(l));
  if (langues.length > 0) identite.push({ terme: "Langues", valeur: langues.join(", ") });
  const competences = m.skills.map((s) => s.trim()).filter((c) => c !== "" && propre(c));
  if (competences.length > 0)
    identite.push({ terme: "Compétences", valeur: competences.join(", ") });

  const contenu: ContenuFiche = {
    titreSeo: fonctionPropre
      ? `${m.firstName}, ${fonctionPropre} chez Axion-IA`
      : `${m.firstName} chez Axion-IA`,
    metaDescription:
      reponsePropre ||
      (fonctionPropre
        ? `${m.firstName}, ${fonctionPropre} chez Axion-IA.`
        : `${m.firstName}, de l'équipe Axion-IA.`),
    sousTitre: fonctionPropre,
    dateMiseAJour: m.updatedAt.toISOString(),
    pastilles: competences.slice(0, 4),
    identite,
    faq: [],
    appelFinal: {
      titre: "Parlons de votre projet",
      texte: `Réservez un appel pour voir ensemble ce que l'IA peut faire concrètement dans votre entreprise.`,
      bouton: "Réserver un appel",
      boutonSecondaire: "Nous écrire",
    },
    liens: linkedinOk ? { linkedin: (m.linkedinUrl as string).trim() } : {},
  };
  return { fiche, contenu };
}
