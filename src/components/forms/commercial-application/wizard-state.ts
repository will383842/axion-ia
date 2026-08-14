// Candidature commerciale — état du wizard, validation par écran, sauvegarde
// localStorage et construction du payload serveur.
//
// L’état du wizard est VOLONTAIREMENT plus lâche que le schéma Zod serveur
// (chaînes vides, booléens null « pas encore répondu ») : c’est ce qui permet
// la reprise à mi-parcours. La conversion stricte se fait dans
// `buildSubmissionPayload`, et le serveur re-valide tout de toute façon.

import {
  COMMERCIAL_APPLICATION_STORAGE_KEY,
  type CommercialApplicationInput,
} from "@/lib/commercial-application/model";

// ── Types d’état ────────────────────────────────────────────────────────────

export interface ExperienceDraft {
  /** Clé React stable (les blocs se suppriment / réordonnent). */
  id: string;
  entreprise: string;
  ville: string;
  poste: string;
  debutMois: string; // "01".."12" ou ""
  debutAnnee: string;
  finMois: string;
  finAnnee: string;
  posteActuel: boolean;
  typesClients: string[];
  /** Bloc déplié (les blocs remplis se replient en accordéon). */
  open: boolean;
}

export interface WizardAnswers {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  naissanceJour: string;
  naissanceMois: string;
  naissanceAnnee: string;
  nationalite: string;
  ville: string;
  codePostal: string;
  b2bDejaVendu: boolean | null;
  b2bAnnees: string;
  experiences: ExperienceDraft[];
  iaUtilise: boolean | null;
  iaOutils: string[];
  iaOutilAutre: string;
  iaUsage: string;
  informatiqueUtilise: boolean | null;
  informatiqueUsages: string[];
  informatiqueAutre: string;
  zoneMobile: boolean;
  zones: string[];
  deplacement: string;
  pitch: string;
  messageLibre: string;
  dispoMois: string;
  dispoAnnee: string;
  permisVehicule: boolean | null;
  statut: string;
  linkedin: string;
  sourceConnaissance: string;
  consent: boolean;
  /** Accord OPTIONNEL de conservation en vivier 2 ans (lot L4). */
  consentVivier: boolean;
}

export function newExperience(open = true): ExperienceDraft {
  return {
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    entreprise: "",
    ville: "",
    poste: "",
    debutMois: "",
    debutAnnee: "",
    finMois: "",
    finAnnee: "",
    posteActuel: false,
    typesClients: [],
    open,
  };
}

export function emptyAnswers(): WizardAnswers {
  return {
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    naissanceJour: "",
    naissanceMois: "",
    naissanceAnnee: "",
    nationalite: "",
    ville: "",
    codePostal: "",
    b2bDejaVendu: null,
    b2bAnnees: "",
    experiences: [newExperience()],
    iaUtilise: null,
    iaOutils: [],
    iaOutilAutre: "",
    iaUsage: "",
    informatiqueUtilise: null,
    informatiqueUsages: [],
    informatiqueAutre: "",
    zoneMobile: false,
    zones: [],
    deplacement: "",
    pitch: "",
    messageLibre: "",
    dispoMois: "",
    dispoAnnee: "",
    permisVehicule: null,
    statut: "",
    linkedin: "",
    sourceConnaissance: "",
    consent: false,
    // Décoché par défaut : un consentement pré-coché n'en est pas un
    // (RGPD art. 4.11 — « acte positif clair »).
    consentVivier: false,
  };
}

// ── Validation par écran ────────────────────────────────────────────────────
//
// Messages explicites (règle du brief : validation à la volée, erreurs
// claires). Clés = identifiants de champ, consommées par les écrans.

export type FieldErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function mmYYYY(mois: string, annee: string): string {
  return `${annee}-${mois}`;
}

export function validateStep(step: number, a: WizardAnswers): FieldErrors {
  const e: FieldErrors = {};
  switch (step) {
    case 1: {
      if (!a.prenom.trim()) e.prenom = "Ton prénom est nécessaire.";
      if (!a.nom.trim()) e.nom = "Ton nom est nécessaire.";
      if (!a.email.trim()) e.email = "Ton email est nécessaire.";
      else if (!EMAIL_RE.test(a.email.trim())) e.email = "Cet email ne semble pas valide.";
      if (!a.telephone.trim()) e.telephone = "Ton téléphone est nécessaire.";
      else if (a.telephone.replace(/\D/g, "").length < 6)
        e.telephone = "Ce numéro semble trop court.";
      if (!a.ville.trim()) e.ville = "Ta ville est nécessaire.";
      if (!a.codePostal.trim()) e.codePostal = "Ton code postal est nécessaire.";
      else if (!/^[0-9A-Za-z][0-9A-Za-z -]{2,9}$/.test(a.codePostal.trim()))
        e.codePostal = "Ce code postal ne semble pas valide.";
      // Date de naissance FACULTATIVE — mais si elle est commencée, elle doit
      // être complète et plausible.
      const naissance = [a.naissanceJour, a.naissanceMois, a.naissanceAnnee];
      const remplis = naissance.filter((v) => v.trim() !== "").length;
      if (remplis > 0 && remplis < 3) {
        e.naissance = "Complète les trois champs, ou laisse-les vides (c’est facultatif).";
      } else if (remplis === 3) {
        const j = Number(a.naissanceJour);
        const m = Number(a.naissanceMois);
        const an = Number(a.naissanceAnnee);
        const now = new Date().getFullYear();
        if (!(j >= 1 && j <= 31 && m >= 1 && m <= 12 && an >= now - 100 && an <= now - 15)) {
          e.naissance = "Cette date ne semble pas plausible.";
        }
      }
      return e;
    }
    case 2: {
      if (a.b2bDejaVendu === null) e.b2bDejaVendu = "Réponds par oui ou par non.";
      if (a.b2bDejaVendu === true && !a.b2bAnnees) e.b2bAnnees = "Indique depuis combien d’années.";
      return e;
    }
    case 3: {
      if (a.experiences.length === 0) {
        e.experiences = "Ajoute au moins une expérience.";
        return e;
      }
      a.experiences.forEach((exp, i) => {
        const pre = `exp-${exp.id}`;
        if (!exp.entreprise.trim())
          e[`${pre}-entreprise`] = "Le nom de l’entreprise est nécessaire.";
        if (!exp.ville.trim()) e[`${pre}-ville`] = "La ville ou le département est nécessaire.";
        if (!exp.poste.trim()) e[`${pre}-poste`] = "Le poste occupé est nécessaire.";
        if (!exp.debutMois || !exp.debutAnnee)
          e[`${pre}-debut`] = "Indique le mois et l’année de début.";
        if (!exp.posteActuel && (!exp.finMois || !exp.finAnnee))
          e[`${pre}-fin`] = "Indique la fin, ou coche « poste actuel ».";
        if (
          exp.debutMois &&
          exp.debutAnnee &&
          !exp.posteActuel &&
          exp.finMois &&
          exp.finAnnee &&
          mmYYYY(exp.finMois, exp.finAnnee) < mmYYYY(exp.debutMois, exp.debutAnnee)
        ) {
          e[`${pre}-fin`] = "La fin est avant le début.";
        }
        void i;
      });
      return e;
    }
    case 4: {
      if (a.iaUtilise === null) e.iaUtilise = "Réponds par oui ou par non.";
      // OBLIGATOIRE quand la réponse est Oui (retour Will 2026-08-13).
      if (a.iaUtilise === true && !a.iaUsage.trim())
        e.iaUsage = "Explique en quelques mots pourquoi, et pour quoi faire.";
      return e;
    }
    case 5: {
      if (a.informatiqueUtilise === null) e.informatiqueUtilise = "Réponds par oui ou par non.";
      return e;
    }
    case 6: {
      if (!a.zoneMobile && a.zones.length === 0)
        e.zones = "Choisis au moins une zone, ou « Peu importe, je suis mobile ».";
      return e;
    }
    case 7: {
      const len = a.pitch.trim().length;
      if (len < 150)
        e.pitch = `Encore ${150 - len} caractère${150 - len > 1 ? "s" : ""} — développe un peu, ça compte.`;
      else if (len > 800) e.pitch = `${len - 800} caractère${len - 800 > 1 ? "s" : ""} de trop.`;
      return e;
    }
    case 8:
      return e;
    case 9: {
      if (!a.dispoMois || !a.dispoAnnee) e.dispo = "Indique le mois et l’année.";
      else {
        // Une disponibilité ne peut pas être dans le passé (retour Will
        // 2026-08-13) : le mois courant est accepté, pas avant.
        const now = new Date();
        const courant = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        if (mmYYYY(a.dispoMois.padStart(2, "0"), a.dispoAnnee) < courant)
          e.dispo = "Cette date est déjà passée — indique le mois courant ou un mois à venir.";
      }
      if (a.permisVehicule === null) e.permisVehicule = "Réponds par oui ou par non.";
      if (
        a.linkedin.trim() &&
        !/^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/.test(a.linkedin.trim())
      )
        e.linkedin = "Ce lien ne semble pas valide.";
      if (!a.consent) e.consent = "Ton accord est nécessaire pour traiter ta candidature.";
      return e;
    }
    default:
      return e;
  }
}

// ── Payload serveur ─────────────────────────────────────────────────────────

export function buildSubmissionPayload(a: WizardAnswers): CommercialApplicationInput {
  const naissanceComplete = a.naissanceJour && a.naissanceMois && a.naissanceAnnee;
  return {
    prenom: a.prenom.trim(),
    nom: a.nom.trim(),
    email: a.email.trim(),
    telephone: a.telephone.trim(),
    ...(naissanceComplete
      ? {
          dateNaissance: `${a.naissanceAnnee}-${a.naissanceMois.padStart(2, "0")}-${a.naissanceJour.padStart(2, "0")}`,
        }
      : {}),
    ...(a.nationalite.trim() ? { nationalite: a.nationalite.trim() } : {}),
    ville: a.ville.trim(),
    codePostal: a.codePostal.trim(),
    b2bDejaVendu: a.b2bDejaVendu === true,
    ...(a.b2bDejaVendu === true && a.b2bAnnees ? { b2bAnnees: a.b2bAnnees } : {}),
    experiences: a.experiences.map((exp) => ({
      entreprise: exp.entreprise.trim(),
      ville: exp.ville.trim(),
      poste: exp.poste.trim(),
      debut: mmYYYY(exp.debutMois, exp.debutAnnee),
      ...(exp.posteActuel ? {} : { fin: mmYYYY(exp.finMois, exp.finAnnee) }),
      posteActuel: exp.posteActuel,
      ...(exp.typesClients.length > 0 ? { typesClients: exp.typesClients } : {}),
    })),
    iaUtilise: a.iaUtilise === true,
    ...(a.iaUtilise === true && a.iaOutils.length > 0 ? { iaOutils: a.iaOutils } : {}),
    ...(a.iaUtilise === true && a.iaOutilAutre.trim()
      ? { iaOutilAutre: a.iaOutilAutre.trim() }
      : {}),
    ...(a.iaUtilise === true && a.iaUsage.trim() ? { iaUsage: a.iaUsage.trim() } : {}),
    informatiqueUtilise: a.informatiqueUtilise === true,
    ...(a.informatiqueUtilise === true && a.informatiqueUsages.length > 0
      ? { informatiqueUsages: a.informatiqueUsages }
      : {}),
    ...(a.informatiqueUtilise === true && a.informatiqueAutre.trim()
      ? { informatiqueAutre: a.informatiqueAutre.trim() }
      : {}),
    zoneMobile: a.zoneMobile,
    ...(a.zoneMobile || a.zones.length === 0 ? {} : { zones: a.zones }),
    ...(a.deplacement ? { deplacement: a.deplacement } : {}),
    pitch: a.pitch.trim(),
    ...(a.messageLibre.trim() ? { messageLibre: a.messageLibre.trim() } : {}),
    disponibilite: mmYYYY(a.dispoMois, a.dispoAnnee),
    permisVehicule: a.permisVehicule === true,
    ...(a.statut ? { statut: a.statut } : {}),
    ...(a.linkedin.trim() ? { linkedin: a.linkedin.trim() } : {}),
    ...(a.sourceConnaissance ? { sourceConnaissance: a.sourceConnaissance } : {}),
    consent: true,
    // Transmis TEL QUEL, y compris `false` : le serveur doit pouvoir
    // distinguer un refus explicite d'une absence de réponse.
    consentVivier: a.consentVivier,
  };
}

// ── Sauvegarde locale (reprise après fermeture) ─────────────────────────────

interface SavedState {
  v: 1;
  screen: number;
  answers: WizardAnswers;
}

export function saveDraft(screen: number, answers: WizardAnswers): void {
  try {
    const state: SavedState = { v: 1, screen, answers };
    window.localStorage.setItem(COMMERCIAL_APPLICATION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Stockage plein / bloqué : la sauvegarde est un confort, jamais bloquante.
  }
}

export function loadDraft(): { screen: number; answers: WizardAnswers } | null {
  try {
    const raw = window.localStorage.getItem(COMMERCIAL_APPLICATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedState> | null;
    if (!parsed || parsed.v !== 1 || typeof parsed.screen !== "number" || !parsed.answers)
      return null;
    // Fusion défensive : un brouillon d’une version antérieure du formulaire
    // ne doit jamais casser le rendu — les champs manquants prennent le défaut.
    const base = emptyAnswers();
    const answers: WizardAnswers = {
      ...base,
      ...parsed.answers,
      experiences:
        Array.isArray(parsed.answers.experiences) && parsed.answers.experiences.length > 0
          ? parsed.answers.experiences.map((exp) => ({ ...newExperience(false), ...exp }))
          : base.experiences,
    };
    const screen = Math.min(Math.max(0, parsed.screen), 9);
    return { screen, answers };
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(COMMERCIAL_APPLICATION_STORAGE_KEY);
  } catch {
    // idem : confort.
  }
}
