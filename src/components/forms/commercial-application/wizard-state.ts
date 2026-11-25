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

export interface WizardAnswers {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  ville: string;
  codePostal: string;
  b2bDejaVendu: boolean | null;
  b2bAnnees: string;
  /** Facultatif — meilleur signal du scoring, jamais bloquant (cf. `lib/commercial-application/scoring.ts`). */
  carnetDirigeants: string;
  iaUtilise: boolean | null;
  iaOutils: string[];
  iaOutilAutre: string;
  iaUsage: string;
  informatiqueUtilise: boolean | null;
  informatiqueUsages: string[];
  informatiqueAutre: string;
  pitch: string;
  messageLibre: string;
  statut: string;
  linkedin: string;
  sourceConnaissance: string;
  consent: boolean;
}

export function emptyAnswers(): WizardAnswers {
  return {
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    ville: "",
    codePostal: "",
    b2bDejaVendu: null,
    b2bAnnees: "",
    carnetDirigeants: "",
    iaUtilise: null,
    iaOutils: [],
    iaOutilAutre: "",
    iaUsage: "",
    informatiqueUtilise: null,
    informatiqueUsages: [],
    informatiqueAutre: "",
    pitch: "",
    messageLibre: "",
    statut: "",
    linkedin: "",
    sourceConnaissance: "",
    consent: false,
  };
}

// ── Validation par écran ────────────────────────────────────────────────────
//
// Messages explicites (règle du brief : validation à la volée, erreurs
// claires). Clés = identifiants de champ, consommées par les écrans.

export type FieldErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateStep(step: number, a: WizardAnswers): FieldErrors {
  const e: FieldErrors = {};
  switch (step) {
    case 1: {
      // 🔴 2026-09-04 — LE CONSENTEMENT REMONTE ICI, depuis le dernier écran.
      //
      // Il ne s'agit pas d'un déplacement de confort. À partir de cette version,
      // le dossier ENREGISTRE le contact dès la validation de cet écran, pour
      // qu'un abandon à l'écran 5 laisse une personne rappelable au lieu de rien.
      // Prendre des coordonnées ici et demander l'accord huit écrans plus loin
      // serait un traitement sans base — l'accord doit précéder l'écriture, pas
      // la suivre.
      //
      // C'est aussi meilleur pour la personne : on lui dit ce qu'on fait de ses
      // réponses au moment où elle les donne, pas après huit écrans de travail.
      // Le mini formulaire du tunnel procède déjà ainsi.
      //
      // ⛔ Ne pas le redescendre. Verrouillé par
      // `le-consentement-precede-l-ecriture.spec.ts`.
      if (!a.consent) e.consent = "Votre accord est nécessaire pour étudier votre demande.";
      if (!a.prenom.trim()) e.prenom = "Votre prénom est nécessaire.";
      if (!a.nom.trim()) e.nom = "Votre nom est nécessaire.";
      if (!a.email.trim()) e.email = "Votre e-mail est nécessaire.";
      else if (!EMAIL_RE.test(a.email.trim())) e.email = "Cet e-mail ne semble pas valide.";
      if (!a.telephone.trim()) e.telephone = "Votre téléphone est nécessaire.";
      else if (a.telephone.replace(/\D/g, "").length < 6)
        e.telephone = "Ce numéro semble trop court.";
      if (!a.ville.trim()) e.ville = "Votre ville est nécessaire.";
      if (!a.codePostal.trim()) e.codePostal = "Votre code postal est nécessaire.";
      else if (!/^[0-9A-Za-z][0-9A-Za-z -]{2,9}$/.test(a.codePostal.trim()))
        e.codePostal = "Ce code postal ne semble pas valide.";
      return e;
    }
    case 2: {
      if (a.b2bDejaVendu === null) e.b2bDejaVendu = "Répondez par oui ou par non.";
      if (a.b2bDejaVendu === true && !a.b2bAnnees)
        e.b2bAnnees = "Indiquez depuis combien d’années.";
      return e;
    }
    case 3: {
      if (a.iaUtilise === null) e.iaUtilise = "Répondez par oui ou par non.";
      // OBLIGATOIRE quand la réponse est Oui (retour Will 2026-08-13).
      if (a.iaUtilise === true && !a.iaUsage.trim())
        e.iaUsage = "Expliquez en quelques mots pourquoi, et pour quoi faire.";
      return e;
    }
    case 4: {
      if (a.informatiqueUtilise === null) e.informatiqueUtilise = "Répondez par oui ou par non.";
      return e;
    }
    case 5: {
      const len = a.pitch.trim().length;
      if (len < 150)
        e.pitch = `Encore ${150 - len} caractère${150 - len > 1 ? "s" : ""} — développez un peu, ça compte.`;
      else if (len > 800) e.pitch = `${len - 800} caractère${len - 800 > 1 ? "s" : ""} de trop.`;
      return e;
    }
    case 6:
      return e;
    case 7: {
      if (
        a.linkedin.trim() &&
        !/^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/.test(a.linkedin.trim())
      )
        e.linkedin = "Ce lien ne semble pas valide.";
      return e;
    }
    default:
      return e;
  }
}

// ── Payload serveur ─────────────────────────────────────────────────────────

export function buildSubmissionPayload(a: WizardAnswers): CommercialApplicationInput {
  return {
    prenom: a.prenom.trim(),
    nom: a.nom.trim(),
    email: a.email.trim(),
    telephone: a.telephone.trim(),
    ville: a.ville.trim(),
    codePostal: a.codePostal.trim(),
    b2bDejaVendu: a.b2bDejaVendu === true,
    ...(a.b2bDejaVendu === true && a.b2bAnnees ? { b2bAnnees: a.b2bAnnees } : {}),
    ...(a.carnetDirigeants ? { carnetDirigeants: a.carnetDirigeants } : {}),
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
    pitch: a.pitch.trim(),
    ...(a.messageLibre.trim() ? { messageLibre: a.messageLibre.trim() } : {}),
    ...(a.statut ? { statut: a.statut } : {}),
    ...(a.linkedin.trim() ? { linkedin: a.linkedin.trim() } : {}),
    ...(a.sourceConnaissance ? { sourceConnaissance: a.sourceConnaissance } : {}),
    consent: true,
  };
}

// ── Sauvegarde locale (reprise après fermeture) ─────────────────────────────

interface SavedState {
  /** 1 = parcours à 9 écrans (avant le 2026-11-25) ; 2 = parcours à 7 écrans. */
  v: 1 | 2;
  screen: number;
  answers: WizardAnswers;
}

/** Réponses retirées du formulaire : jamais relues depuis un brouillon. */
const CHAMPS_RETIRES: readonly string[] = [
  "consentVivier",
  "permisVehicule",
  "naissanceJour",
  "naissanceMois",
  "naissanceAnnee",
  "nationalite",
  "experiences",
  "zoneMobile",
  "zones",
  "deplacement",
  "dispoMois",
  "dispoAnnee",
];

/** Écran du parcours à 9 écrans → écran du parcours à 7 écrans. */
const ECRAN_V1_VERS_V2: readonly number[] = [0, 1, 2, 2, 3, 4, 4, 5, 6, 7];

export function saveDraft(screen: number, answers: WizardAnswers): void {
  try {
    const state: SavedState = { v: 2, screen, answers };
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
    if (
      !parsed ||
      (parsed.v !== 1 && parsed.v !== 2) ||
      typeof parsed.screen !== "number" ||
      !parsed.answers
    )
      return null;
    // Fusion défensive : un brouillon d’une version antérieure du formulaire
    // ne doit jamais casser le rendu — les champs manquants prennent le défaut.
    //
    // 🔴 Et les champs RETIRÉS sont écartés, pas étalés. Un brouillon commencé
    // avant le 19/09 porte encore l'accord « vivier 2 ans », case supprimée ce
    // jour-là (décision B2 : le dossier apporteur ne part plus au CRM). Étalé
    // tel quel, il survivrait en silence — ré-écrit à chaque sauvegarde — et un
    // accord que la personne n'a pas vu dans CE formulaire voyagerait avec son
    // dossier. Seule occurrence tolérée du nom dans ce dossier (contrôle P2).
    // Double conversion assumee : `WizardAnswers` n'a pas de signature d'index,
    // et `consentVivier` n'y figure PLUS — c'est tout l'objet du retrait. Le
    // brouillon vient de `JSON.parse`, donc sa vraie nature est `unknown` : on le
    // dit au lieu de mentir au compilateur avec une conversion directe, que TS
    // refuse ici (TS2352).
    //
    // 11/11/2026 (Williams) : la question « permis et véhicule » est retirée du
    // formulaire. Même traitement : un brouillon antérieur qui porte encore la
    // réponse ne la renvoie pas avec le dossier.
    //
    // 25/11/2026 (L5b, D5) : naissance, nationalité, parcours, zone, déplacements
    // et disponibilité ne sont plus demandés. Même traitement : un brouillon
    // antérieur ne les renvoie pas avec le dossier.
    const reponses: Record<string, unknown> = {
      ...(parsed.answers as unknown as Record<string, unknown>),
    };
    for (const cle of CHAMPS_RETIRES) delete reponses[cle];
    const answers: WizardAnswers = { ...emptyAnswers(), ...(reponses as Partial<WizardAnswers>) };
    const brut = Math.max(0, parsed.screen);
    // Un brouillon v1 compte 9 écrans : on le ramène sur son équivalent du
    // parcours à 7 écrans (parcours → expérience, zone → outils).
    const screen = Math.min(parsed.v === 1 ? (ECRAN_V1_VERS_V2[brut] ?? 7) : brut, 7);
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
