/**
 * Les actions du DOSSIER EN LIGNE de l'apporteur (démarrage manuel, 2026-10-05).
 *
 * Chaque action :
 *   1. passe la limite de débit par IP HACHÉE (`hashIp`, jamais l'IP en clair) ;
 *   2. relit le dossier PAR SON LIEN (`lireDossierParLien`) : un jeton faux ou révoqué
 *      rend la même réponse neutre qu'un dossier inconnu ;
 *   3. vérifie que l'état du dossier permet ce qu'on demande (modifiable, ou signé pour
 *      les pièces de vigilance) — le navigateur ne décide jamais.
 *
 * Les actions rendent un résultat au composant client (pas de redirection) : la page se
 * rafraîchit ensuite (`router.refresh()`), et une erreur s'affiche sans perdre la saisie.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import * as Sentry from "@sentry/nextjs";

import { getClientIp, getClientUserAgent } from "@/lib/client-ip";
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { lireEntrepriseParSiren } from "@/features/apporteurs-reseau/annuaire";
import {
  TAILLE_MAX_PIECE,
  deposerPiece,
  enregistrerActivite,
  lireDossierParLien,
  type DossierVue,
} from "@/features/apporteurs-reseau/donnees";
import {
  LIBELLE_REFUS_ADMISSION,
  ajouterMois,
  estStatutJuridique,
  ibanValide,
  jugerAdmission,
  sirenValide,
  VIGILANCE_VALIDITE_MOIS,
  type StatutJuridique,
  type TypePiece,
} from "@/features/apporteurs-reseau/regles";
import {
  etatDeLaPage,
  nomAjoutable,
  piecesDeposables,
  signerContrat,
} from "@/features/apporteurs-reseau/signature";

import { TEXTES } from "./textes";

export type Resultat = { ok: true } | { ok: false; message: string };

export type ResultatRecherche =
  | {
      ok: true;
      entreprise: {
        siren: string;
        denomination: string | null;
        adresse: string | null;
        naf: string | null;
        statutSuggere: StatutJuridique | null;
        diffusionPartielle: boolean;
      };
      refus: string | null;
    }
  | {
      ok: false;
      raison: "siren_invalide" | "introuvable" | "indisponible" | "erreur";
      message: string;
    };

/**
 * Limites par IP et par quart d'heure. Panne de Redis : LAISSER PASSER, comme le
 * questionnaire — chaque écriture reste gardée par le jeton, et un refus pendant une
 * panne ferait perdre sa saisie à l'apporteur.
 */
const LIMITES = {
  recherche: { limit: 30, windowSec: 900, surPanne: "laisser-passer" },
  activite: { limit: 30, windowSec: 900, surPanne: "laisser-passer" },
  piece: { limit: 30, windowSec: 900, surPanne: "laisser-passer" },
  signature: { limit: 6, windowSec: 900, surPanne: "laisser-passer" },
} as const satisfies Record<string, RateLimitConfig>;

async function ipHachee(): Promise<string | null> {
  try {
    return hashIp(await getClientIp());
  } catch {
    // Sel absent en production (`hashIp` lève) : aucune IP en clair, jamais.
    return null;
  }
}

async function debitAutorise(famille: keyof typeof LIMITES): Promise<boolean> {
  const cle = `apporteur-dossier:${famille}:${(await ipHachee()) ?? "sans-ip"}`;
  return (await checkRateLimit(cle, LIMITES[famille])).allowed;
}

const lien = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.slice(0, 100) : "");
const champ = (fd: FormData, nom: string, max = 300) => {
  const v = fd.get(nom);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};

const NEUTRE: Resultat = { ok: false, message: TEXTES.invalideTitre };
const TROP: Resultat = { ok: false, message: TEXTES.trop };

async function dossierModifiableParLien(id: string, jeton: string): Promise<DossierVue | null> {
  const d = await lireDossierParLien(id, jeton);
  return d && etatDeLaPage(d.statut) === "modifiable" ? d : null;
}

// ── Étape 2 : recherche du SIREN ─────────────────────────────────────────

export async function rechercherSirenAction(
  id: string,
  jeton: string,
  siren: string,
): Promise<ResultatRecherche> {
  if (!(await debitAutorise("recherche")))
    return { ok: false, raison: "erreur", message: TEXTES.trop };
  if (!(await dossierModifiableParLien(lien(id), lien(jeton)))) {
    return { ok: false, raison: "erreur", message: TEXTES.invalideTitre };
  }
  const r = await lireEntrepriseParSiren(String(siren).slice(0, 20));
  if (!r.ok) {
    const message =
      r.raison === "siren_invalide"
        ? TEXTES.sirenInvalide
        : r.raison === "introuvable"
          ? TEXTES.introuvable
          : TEXTES.indisponible;
    return { ok: false, raison: r.raison, message };
  }
  const e = r.entreprise;
  const admission = jugerAdmission(e);
  return {
    ok: true,
    entreprise: {
      siren: e.siren,
      denomination: e.denomination,
      adresse: e.adresse,
      naf: e.naf,
      statutSuggere: e.statutSuggere,
      diffusionPartielle: e.diffusionPartielle,
    },
    refus: admission.ok ? null : LIBELLE_REFUS_ADMISSION[admission.motif],
  };
}

// ── Étapes 1 et 2 : téléphone et activité ────────────────────────────────

export async function enregistrerActiviteAction(fd: FormData): Promise<Resultat> {
  if (!(await debitAutorise("activite"))) return TROP;
  const dossier = await dossierModifiableParLien(lien(fd.get("id")), lien(fd.get("jeton")));
  if (!dossier) return NEUTRE;

  const siren = champ(fd, "siren", 20).replace(/\s+/g, "");
  if (!sirenValide(siren)) return { ok: false, message: TEXTES.sirenInvalide };

  // Le registre est relu ICI : la dénomination, l'adresse et le code NAF publics
  // l'emportent sur ce qu'envoie le navigateur, et le refus d'admission est rejugé.
  let denomination = champ(fd, "denomination", 250);
  let adresse = champ(fd, "adresse", 400);
  let codeNaf: string | null = null;
  // Registre muet (panne, 429 persistant, entreprise introuvable) : on garde la saisie
  // manuelle, mais le dossier est MARQUÉ « à contrôler » dans la console (jamais en silence).
  let registreIndisponible = false;
  const registre = await lireEntrepriseParSiren(siren);
  if (registre.ok) {
    const admission = jugerAdmission(registre.entreprise);
    if (!admission.ok) return { ok: false, message: LIBELLE_REFUS_ADMISSION[admission.motif] };
    denomination = registre.entreprise.denomination ?? denomination;
    adresse = registre.entreprise.adresse ?? adresse;
    codeNaf = registre.entreprise.naf?.slice(0, 8) ?? null;
  } else if (registre.raison === "siren_invalide") {
    return { ok: false, message: TEXTES.sirenInvalide };
  } else {
    registreIndisponible = true;
  }
  if (!denomination || !adresse)
    return { ok: false, message: "Indiquez le nom et l'adresse de votre entreprise." };

  const statutJuridique = champ(fd, "statutJuridique", 40);
  if (!estStatutJuridique(statutJuridique))
    return { ok: false, message: "Choisissez votre statut." };
  const tva = champ(fd, "regimeTva", 20);
  if (tva !== "assujetti" && tva !== "franchise_293b")
    return { ok: false, message: "Dites-nous si vous facturez la TVA." };

  const iban = champ(fd, "iban", 50).replace(/\s+/g, "").toUpperCase();
  if (!iban && !dossier.ibanSaisi) return { ok: false, message: "Indiquez votre IBAN." };
  if (iban && !ibanValide(iban)) return { ok: false, message: TEXTES.ibanInvalide };

  const telephone = champ(fd, "telephone", 30);
  if (telephone && !/^[0-9+().\s-]{6,30}$/.test(telephone)) {
    return { ok: false, message: "Ce numéro de téléphone n'est pas valide." };
  }

  // Nom d'un seul mot : l'étape 1 laisse compléter le nom, mais jamais réécrire un nom connu.
  const nom = nomAjoutable(dossier.nom, champ(fd, "nom", 80));

  return enregistrerActivite(dossier.id, {
    telephone: telephone || null,
    ...(nom ? { nom } : {}),
    registreIndisponible,
    siren,
    denomination,
    adresse,
    codeNaf,
    statutJuridique,
    regimeTva: tva,
    numeroTva: tva === "assujetti" ? champ(fd, "numeroTva", 30) : null,
    iban: iban || null,
  });
}

// ── Étape 3 et dossier signé : dépôt d'une pièce ─────────────────────────

/** « 2026-10-05 » → minuit UTC de ce jour, ou `null`. */
function dateDuJour(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : d;
}

export async function deposerPieceAction(fd: FormData): Promise<Resultat> {
  if (!(await debitAutorise("piece"))) return TROP;
  const dossier = await lireDossierParLien(lien(fd.get("id")), lien(fd.get("jeton")));
  if (!dossier) return NEUTRE;
  const type = champ(fd, "type", 30) as TypePiece;
  if (!piecesDeposables(etatDeLaPage(dossier.statut)).includes(type)) return NEUTRE;

  const fichier = fd.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0)
    return { ok: false, message: "Choisissez un fichier." };
  if (fichier.size > TAILLE_MAX_PIECE)
    return { ok: false, message: "Le fichier doit faire moins de 10 Mo." };

  let expireAt: Date | null = null;
  if (type === "vigilance") {
    const delivree = dateDuJour(champ(fd, "dateDelivrance", 10));
    if (!delivree || delivree.getTime() > Date.now()) {
      return { ok: false, message: "Indiquez la date de délivrance de l'attestation." };
    }
    expireAt = ajouterMois(delivree, VIGILANCE_VALIDITE_MOIS);
    if (expireAt.getTime() <= Date.now()) {
      return {
        ok: false,
        message: "Cette attestation a plus de 6 mois : téléchargez-en une nouvelle.",
      };
    }
  }

  const octets = new Uint8Array(await fichier.arrayBuffer());
  return deposerPiece(dossier.id, type, fichier.name || "piece", octets, expireAt);
}

// ── Étape 4 : signature ──────────────────────────────────────────────────

export async function signerAction(fd: FormData): Promise<Resultat> {
  if (!(await debitAutorise("signature"))) return TROP;
  const cases = (nom: string) =>
    fd
      .getAll(nom)
      .filter((v): v is string => typeof v === "string")
      .slice(0, 20);
  try {
    const r = await signerContrat({
      apporteurId: lien(fd.get("id")),
      jeton: lien(fd.get("jeton")),
      nomTape: champ(fd, "nomTape", 200),
      declarations: cases("declarations"),
      acceptations: cases("acceptations"),
      ipHash: await ipHachee(),
      userAgent: await getClientUserAgent(),
    });
    return r.ok ? { ok: true } : { ok: false, message: r.message };
  } catch (e) {
    // Contexte MINIMAL : ni jeton, ni nom, ni valeur saisie — le nom de l'erreur seul.
    const nom = e instanceof Error ? e.name : "inconnue";
    Sentry.captureException(new Error(`apporteur-dossier : signature échouée (${nom})`), {
      tags: { service: "apporteur-dossier", etape: "signature" },
    });
    return { ok: false, message: "La signature n'a pas abouti. Réessayez dans quelques minutes." };
  }
}
