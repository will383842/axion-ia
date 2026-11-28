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
import { CATEGORIES } from "./categories";
import type { CleIcone, ContenuFiche, EnteteSection, SectionFiche } from "./contenu";
import { remplirPrenom } from "./modeles-categorie";
import { phraseLieu, villeAffichable } from "./presence";
import { categoriePublique } from "./depuis-membre-categorie";
import { estTextePropre, fichePublique } from "./regles";
import type { FicheCollaborateur } from "./types";
import type { FicheComplete } from "./adaptateurs";

export type { EnteteSection };

/**
 * Champs propres à une fiche de membre, ajoutés par le lot R2c2 ; les autres (entetes, vousEtes,
 * pourQui, chiffresCles, presence) vivent désormais dans `ContenuFiche`.
 */
export interface ExtensionContenuR2c2 {
  /** Phrase de lieu si le lieu est connu. */
  presence: NonNullable<ContenuFiche["presence"]>;
  /** Clé d'icône de chaque ligne d'identité (même ordre que `identite`). */
  iconesIdentite?: ReadonlyArray<string>;
}

const TITRE_MAX = 60;

/** « {prénom}, {fonction} · Axion-IA », 60 caractères au plus (fonction tronquée au besoin). */
export function titreCollaborateur(prenom: string, fonction: string): string {
  const suffixe = " · Axion-IA";
  if (!fonction) return `${prenom}${suffixe}`;
  const entete = `${prenom}, `;
  const place = Math.max(0, TITRE_MAX - entete.length - suffixe.length);
  const f =
    fonction.length <= place ? fonction : `${fonction.slice(0, Math.max(0, place - 1)).trimEnd()}…`;
  return `${entete}${f}${suffixe}`;
}

function nombreDeMots(t: string): number {
  return t.trim().split(/\s+/).filter(Boolean).length;
}

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

/** Sections propres à la catégorie : une section sans contenu n'est jamais produite. */
function sectionsDeCategorie(
  categorie: FicheCollaborateur["categorie"],
  prenom: string,
  competences: ReadonlyArray<string>,
): SectionFiche[] {
  const sections: SectionFiche[] = [];
  for (const s of CATEGORIES[categorie].modele.sections) {
    if (s.exigeDonnees === "competences" && competences.length === 0) continue;
    sections.push({
      id: s.id,
      titre: remplirPrenom(s.titre, prenom),
      paragraphes: s.paragraphes.map((p) => remplirPrenom(p, prenom)),
      ...(s.lien ? { lien: s.lien } : {}),
      ...(s.exigeDonnees === "competences" ? { liste: competences } : {}),
    });
  }
  return sections;
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
  const villePropre = villeAffichable(pub?.ville) ?? "";
  const propre = (t: string): boolean => estTextePropre(t);

  const identite: Array<{ terme: string; valeur: string; icone?: CleIcone }> = [];
  const iconesIdentite: string[] = [];
  const ligne = (terme: string, valeur: string, icone: CleIcone) => {
    identite.push({ terme, valeur, icone });
    iconesIdentite.push(icone);
  };
  if (fonctionPropre) ligne("Fonction", fonctionPropre, "fonction");
  if (villePropre) ligne("Lieu", villePropre, "lieu");
  const langues = m.languages.map((l) => l.trim()).filter((l) => l !== "" && propre(l));
  if (langues.length > 0) ligne("Langues", langues.join(", "), "langues");
  const competences = m.skills.map((s) => s.trim()).filter((c) => c !== "" && propre(c));
  if (competences.length > 0) ligne("Compétences", competences.join(", "), "competences");

  const modele = CATEGORIES[fiche.categorie].modele;
  const prenomPublic = pub?.nom ?? m.firstName.trim();
  const sectionsCategorie = sectionsDeCategorie(fiche.categorie, prenomPublic, competences);
  // Réponses propres à la personne d'abord (aucune à ce jour), puis les réponses modèles.
  const faqPersonne: ContenuFiche["faq"] = [];
  const faqModele: ContenuFiche["faq"] = modele.faq.map((q) => ({
    id: `modele-${q.id}`,
    question: remplirPrenom(q.question, prenomPublic),
    answer: remplirPrenom(q.answer, prenomPublic),
  }));

  // En-têtes en question : une réponse de la fiche (25 à 80 mots) sous « en bref », jamais une
  // réponse de registre identique d'une fiche à l'autre ; ailleurs, la réponse du registre (30 mots
  // au plus). Sans réponse : H2 seul.
  const entetes: Record<string, EnteteSection> = {
    "en-bref": {
      surTitre: "En bref",
      question: `Qui est ${prenomPublic}, en bref ?`,
      ...(reponsePropre && nombreDeMots(reponsePropre) >= 25 && nombreDeMots(reponsePropre) <= 80
        ? { reponse: reponsePropre }
        : {}),
    },
  };
  for (const s of modele.sections) {
    if (!s.question) continue;
    if (s.exigeDonnees === "competences" && competences.length === 0) continue;
    entetes[s.id] = {
      surTitre: s.surTitre ?? "",
      question: remplirPrenom(s.question, prenomPublic),
      ...(s.reponse ? { reponse: remplirPrenom(s.reponse, prenomPublic) } : {}),
    };
  }

  // Chiffres clés : seulement des champs réellement remplis et autorisés par la catégorie ; moins
  // de deux chiffres : aucun bloc.
  const chiffres: Array<{ valeur: string; libelle: string }> = [];
  if ((modele.chiffresAutorises ?? []).includes("langues") && langues.length >= 2) {
    chiffres.push({ valeur: String(langues.length), libelle: "langues de travail" });
  }

  const lieu = phraseLieu(prenomPublic, { ville: villePropre, departement: pub?.departement });
  const extension: Pick<ContenuFiche, "entetes" | "vousEtes" | "pourQui" | "chiffresCles"> &
    ExtensionContenuR2c2 = {
    entetes,
    ...(modele.vousEtes.length > 0
      ? {
          vousEtes: modele.vousEtes.slice(0, 3).map((c) => ({
            ...c,
            titre: remplirPrenom(c.titre, prenomPublic),
            cout: remplirPrenom(c.cout, prenomPublic),
            action: remplirPrenom(c.action, prenomPublic),
            gain: remplirPrenom(c.gain, prenomPublic),
          })),
        }
      : {}),
    presence: {
      surTitre: "Partout en France",
      question: remplirPrenom(modele.presence.question, prenomPublic),
      reponse: remplirPrenom(modele.presence.reponse, prenomPublic),
      ...(lieu ? { phraseLieu: lieu } : {}),
    },
    ...(modele.pourQui
      ? {
          pourQui: {
            ...modele.pourQui,
            question: remplirPrenom(modele.pourQui.question, prenomPublic),
          },
        }
      : {}),
    ...(chiffres.length >= 2 ? { chiffresCles: chiffres } : {}),
    iconesIdentite,
  };

  const contenu: ContenuFiche & ExtensionContenuR2c2 = {
    ...extension,
    titreSeo: titreCollaborateur(pub?.nom ?? m.firstName.trim(), fonctionPropre),
    metaDescription:
      reponsePropre ||
      (fonctionPropre
        ? `${m.firstName}, ${fonctionPropre} chez Axion-IA.`
        : `${m.firstName}, de l'équipe Axion-IA.`),
    sousTitre: fonctionPropre,
    dateMiseAJour: m.updatedAt.toISOString(),
    pastilles: competences.slice(0, 4),
    identite,
    ...(competences.length > 0 ? { competences } : {}),
    ...(sectionsCategorie.length > 0 ? { sectionsCategorie } : {}),
    faq: [...faqPersonne, ...faqModele],
    appelFinal: {
      titre: "Parlons de votre projet",
      texte:
        modele.actions.length > 0 && !modele.actions.some((a) => a.href === "/appel")
          ? "Décrivez votre besoin : l'équipe Axion-IA vous répond et organise la suite avec vous."
          : `Réservez un appel pour voir ensemble ce que l'IA peut faire concrètement dans votre entreprise.`,
      bouton: "Réserver un appel",
      boutonSecondaire: "Nous écrire",
      ...(modele.actions.length > 0 ? { actions: modele.actions } : {}),
    },
    liens: linkedinOk ? { linkedin: (m.linkedinUrl as string).trim() } : {},
  };
  return { fiche, contenu };
}
