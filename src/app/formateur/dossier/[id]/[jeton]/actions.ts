/**
 * Les actions du DOSSIER EN LIGNE du formateur indépendant (lot L5).
 *
 * Chaque action :
 *   1. passe la limite de débit par IP HACHÉE (jamais l'IP en clair) ; sur l'IBAN et
 *      l'envoi, une panne de Redis REFUSE (08c E2) ;
 *   2. relit le dossier PAR SON LIEN (`lireDossierParLien`) : interrupteur éteint, jeton
 *      faux, échu ou révoqué, fiche d'un autre formateur → la même réponse neutre ;
 *   3. n'écrit QUE sur la fiche du lien, par des écritures conditionnelles (`dossier.ts`).
 * Le navigateur ne décide jamais : tout est revérifié ici.
 *
 * Journaux et Sentry : le nom de l'erreur seul, jamais un jeton, un IBAN, un SIRET ou un code.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones (et des types).
 */

"use server";

import * as Sentry from "@sentry/nextjs";

import { getClientIp } from "@/lib/client-ip";
import { ibanValide } from "@/lib/iban";
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { checkSiretFormat, normalizeSiret } from "@/lib/siret";
import { controlerRegistreFormateur } from "@/server/qualiopi/formateurs-independants/controle";
import {
  deposerPiece,
  enregistrerActivite,
  enregistrerCodeUrssaf,
  enregistrerVous,
  envoyerDossier,
  lireDossierParLien,
  signalerSituation,
  type DossierVue,
} from "@/server/qualiopi/formateurs-independants/dossier";
import {
  NDA_EN_COURS,
  codePostalValide,
  estPieceDossier,
  estRegimeTva,
  piecesDemandees,
} from "@/server/qualiopi/formateurs-independants/dossier-regles";
import {
  ECRANS_QUI_LAISSENT_CONTINUER,
  jugerAdmissionFormateur,
  type EcranEntreprise,
} from "@/server/qualiopi/formateurs-independants/regles-admission";
import { normaliserNda } from "@/server/qualiopi/formateurs-independants/controle-regles";
import {
  alerterDossierRecu,
  prevenirStatutNonOuvert,
} from "@/server/qualiopi/formateurs-independants/envois-dossier";
import { sourceRegistreCommune } from "@/server/qualiopi/formateurs-independants/source-registre";
import {
  codeVigilanceBienForme,
  finValiditeVigilance,
  normaliserCodeVigilance,
} from "@/server/qualiopi/formateurs-independants/vigilance";
import { prisma } from "@/lib/prisma";
import { lireEtablissementParSiret } from "@/server/registre-entreprises/annuaire";

import { TEXTES } from "./textes";

export type Resultat = { ok: true } | { ok: false; message: string };

export type ResultatRecherche =
  | {
      ok: true;
      ecran: EcranEntreprise;
      continuer: boolean;
      entreprise: { denomination: string | null; adresse: string | null } | null;
    }
  | { ok: false; message: string };

const LIMITES = {
  recherche: { limit: 30, windowSec: 900, surPanne: "laisser-passer" },
  vous: { limit: 30, windowSec: 900, surPanne: "laisser-passer" },
  // L'IBAN passe par cette famille : une panne du compteur REFUSE (08c E2).
  activite: { limit: 20, windowSec: 900, surPanne: "refuser" },
  piece: { limit: 30, windowSec: 900, surPanne: "laisser-passer" },
  envoi: { limit: 6, windowSec: 900, surPanne: "refuser" },
} as const satisfies Record<string, RateLimitConfig>;

async function ipHachee(): Promise<string | null> {
  try {
    return hashIp(await getClientIp());
  } catch {
    return null;
  }
}

async function debitAutorise(famille: keyof typeof LIMITES): Promise<boolean> {
  const cle = `formateur-dossier:${famille}:${(await ipHachee()) ?? "sans-ip"}`;
  return (await checkRateLimit(cle, LIMITES[famille])).allowed;
}

const lien = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.slice(0, 100) : "");
const champ = (fd: FormData, nom: string, max = 300) => {
  const v = fd.get(nom);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};

const NEUTRE: Resultat = { ok: false, message: TEXTES.invalideTitre };
const TROP: Resultat = { ok: false, message: TEXTES.trop };

async function dossierModifiable(fd: FormData): Promise<DossierVue | null> {
  const d = await lireDossierParLien(lien(fd.get("id")), lien(fd.get("jeton")));
  return d && d.etat === "modifiable" ? d : null;
}

function signaler(etape: string, e: unknown): void {
  const nom = e instanceof Error ? e.name : "inconnue";
  Sentry.captureException(new Error(`formateur-dossier : ${etape} échoué (${nom})`), {
    tags: { service: "formateur-dossier", etape },
  });
}

const ECHEC: Resultat = {
  ok: false,
  message: "L'enregistrement n'a pas abouti. Réessayez dans quelques minutes.",
};

// ── Étape 1 ──────────────────────────────────────────────────────────────

export async function enregistrerVousAction(fd: FormData): Promise<Resultat> {
  if (!(await debitAutorise("vous"))) return TROP;
  const d = await dossierModifiable(fd);
  if (!d) return NEUTRE;
  const telephone = champ(fd, "telephone", 30);
  if (telephone && !/^[0-9+().\s-]{6,30}$/.test(telephone)) {
    return { ok: false, message: TEXTES.telephoneInvalide };
  }
  const codePostal = champ(fd, "codePostal", 10).replace(/\s+/g, "");
  if (!codePostalValide(codePostal)) return { ok: false, message: TEXTES.codePostalInvalide };
  try {
    return await enregistrerVous(d, { telephone: telephone || null, codePostalPro: codePostal });
  } catch (e) {
    signaler("vous", e);
    return ECHEC;
  }
}

// ── Étape 2 ──────────────────────────────────────────────────────────────

/** Juge un SIRET au registre (lecture seule, rien n'est écrit). */
async function jugerSiret(d: DossierVue, siret: string, nda: string | null) {
  const registre = await lireEtablissementParSiret(siret, { enrichi: true });
  const v = jugerAdmissionFormateur({
    siret,
    nda,
    registre,
    identite: { prenom: d.prenom, nom: d.nom },
    ancienSalarieMoinsDe12Mois: null,
    maintenant: new Date(),
  });
  return { registre, v };
}

export async function rechercherSiretAction(
  id: string,
  jeton: string,
  saisie: string,
): Promise<ResultatRecherche> {
  if (!(await debitAutorise("recherche"))) return { ok: false, message: TEXTES.trop };
  const fd = new FormData();
  fd.set("id", String(id));
  fd.set("jeton", String(jeton));
  const d = await dossierModifiable(fd);
  if (!d) return { ok: false, message: TEXTES.invalideTitre };
  const siret = normalizeSiret(String(saisie).slice(0, 30));
  if (!checkSiretFormat(siret).ok) return { ok: false, message: TEXTES.siretInvalide };
  const { registre, v } = await jugerSiret(d, siret, d.nda);
  return {
    ok: true,
    ecran: v.ecran,
    continuer: ECRANS_QUI_LAISSENT_CONTINUER.has(v.ecran),
    entreprise: registre.ok
      ? { denomination: registre.entreprise.denomination, adresse: registre.entreprise.adresse }
      : null,
  };
}

export async function enregistrerActiviteAction(fd: FormData): Promise<Resultat> {
  if (!(await debitAutorise("activite"))) return TROP;
  const d = await dossierModifiable(fd);
  if (!d) return NEUTRE;

  const siret = normalizeSiret(champ(fd, "siret", 30));
  if (!checkSiretFormat(siret).ok) return { ok: false, message: TEXTES.siretInvalide };

  const enCours = champ(fd, "ndaEnCours", 5) === "1";
  const nda = enCours ? NDA_EN_COURS : normaliserNda(champ(fd, "nda", 30));
  if (!nda) return { ok: false, message: TEXTES.ndaInvalide };

  const tva = champ(fd, "regimeTva", 30);
  if (!estRegimeTva(tva)) return { ok: false, message: TEXTES.tvaManquante };

  const iban = champ(fd, "iban", 50).replace(/\s+/g, "").toUpperCase();
  if (!iban && !d.ibanSaisi) return { ok: false, message: TEXTES.ibanInvalide };
  if (iban && !ibanValide(iban)) return { ok: false, message: TEXTES.ibanInvalide };

  // Le registre est rejugé ICI : le navigateur ne décide pas qu'une entreprise est ouverte.
  const { v } = await jugerSiret(d, siret, nda);
  if (!ECRANS_QUI_LAISSENT_CONTINUER.has(v.ecran)) {
    if (v.ecran === "statut_non_ouvert" || v.ecran === "hors_france") await statutNonOuvert(d);
    return { ok: false, message: messageEcran(v.ecran) };
  }
  try {
    return await enregistrerActivite(d, { siret, nda, regimeTva: tva, iban: iban || null });
  } catch (e) {
    signaler("activite", e);
    return ECHEC;
  }
}

/** F15, une seule fois par fiche (L6) ; une panne ne bloque jamais l'écran. */
async function statutNonOuvert(d: DossierVue): Promise<void> {
  try {
    await prevenirStatutNonOuvert(d.id);
  } catch (e) {
    signaler("statut-non-ouvert", e);
  }
}

function messageEcran(e: EcranEntreprise): string {
  switch (e) {
    case "fermee":
      return TEXTES.ecranFermee;
    case "introuvable":
      return TEXTES.ecranIntrouvable;
    case "hors_france":
      return TEXTES.ecranHorsFrance;
    case "statut_non_ouvert":
      return TEXTES.ecranStatutNonOuvert;
    case "societe_axion":
      return TEXTES.ecranSocieteAxion;
    default:
      return TEXTES.ecranMuette;
  }
}

const SITUATIONS = ["portage_ou_cooperative", "hors_france", "sans_entreprise"] as const;

/** « Pas de numéro SIRET à votre nom ? » : une trace pour la console, rien d'autre. */
export async function signalerSituationAction(fd: FormData): Promise<Resultat> {
  if (!(await debitAutorise("vous"))) return TROP;
  const d = await dossierModifiable(fd);
  if (!d) return NEUTRE;
  const s = champ(fd, "situation", 40);
  const situation = SITUATIONS.find((x) => x === s);
  if (!situation) return NEUTRE;
  try {
    await signalerSituation(d, situation);
    if (situation !== "sans_entreprise") await statutNonOuvert(d);
    return { ok: true };
  } catch (e) {
    signaler("situation", e);
    return ECHEC;
  }
}

// ── Étape 3 ──────────────────────────────────────────────────────────────

/** « 2026-10-05 » → minuit UTC de ce jour, ou `null`. */
function dateDuJour(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : d;
}

export async function deposerPieceAction(fd: FormData): Promise<Resultat> {
  if (!(await debitAutorise("piece"))) return TROP;
  const d = await dossierModifiable(fd);
  if (!d) return NEUTRE;
  const type = champ(fd, "type", 40);
  if (!estPieceDossier(type) || !piecesDemandees(d.nda).includes(type)) return NEUTRE;

  const fichier = fd.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: "Choisissez un fichier." };
  }

  let dateEmission: Date | null = null;
  if (type === "attestation_vigilance_urssaf") {
    dateEmission = dateDuJour(champ(fd, "dateDelivrance", 10));
    const maintenant = new Date();
    if (!dateEmission || dateEmission.getTime() > maintenant.getTime()) {
      return { ok: false, message: "Indiquez la date de délivrance de l'attestation." };
    }
    const fin = finValiditeVigilance(dateEmission);
    if (!fin || fin.getTime() <= maintenant.getTime()) {
      return { ok: false, message: TEXTES.attestationPerimee };
    }
  }

  const octets = new Uint8Array(await fichier.arrayBuffer());
  try {
    return await deposerPiece(d, {
      type,
      nomFichier: fichier.name || "piece",
      octets,
      dateEmission,
    });
  } catch (e) {
    signaler("depot-piece", e);
    return {
      ok: false,
      message:
        "Nous ne pouvons pas recevoir de fichier pour l'instant. Votre saisie est gardée : réessayez dans quelques minutes.",
    };
  }
}

export async function enregistrerCodeUrssafAction(fd: FormData): Promise<Resultat> {
  if (!(await debitAutorise("piece"))) return TROP;
  const d = await dossierModifiable(fd);
  if (!d) return NEUTRE;
  const code = normaliserCodeVigilance(champ(fd, "code", 80));
  if (!codeVigilanceBienForme(code)) return { ok: false, message: TEXTES.codeUrssafInvalide };
  try {
    return await enregistrerCodeUrssaf(d, code);
  } catch (e) {
    signaler("code-urssaf", e);
    return ECHEC;
  }
}

// ── Étape 4 ──────────────────────────────────────────────────────────────

export async function envoyerDossierAction(fd: FormData): Promise<Resultat> {
  if (!(await debitAutorise("envoi"))) return TROP;
  const d = await dossierModifiable(fd);
  if (!d) return NEUTRE;
  if (champ(fd, "certifie", 5) !== "1") {
    return { ok: false, message: "Cochez la case « Je certifie que » pour envoyer." };
  }
  const maintenant = new Date();
  // Le registre est rejugé à l'envoi : une entreprise fermée entre-temps renvoie à l'étape 2.
  let bloquante = !d.siret;
  if (d.siret) {
    const { v } = await jugerSiret(d, d.siret, d.nda);
    bloquante = !ECRANS_QUI_LAISSENT_CONTINUER.has(v.ecran);
  }
  try {
    const r = await envoyerDossier(d, { bloquante }, maintenant);
    if (!r.ok) return r;
  } catch (e) {
    signaler("envoi", e);
    return ECHEC;
  }
  // Le contrôle registre du lot L4, déclenché par l'envoi : il écrit SA preuve. Une panne ne
  // défait pas l'envoi (le contrôle se relance depuis la console).
  try {
    await controlerRegistreFormateur(prisma, sourceRegistreCommune(), {
      trainerId: d.id,
      verifieParId: null,
      maintenant,
    });
  } catch (e) {
    signaler("controle-registre", e);
  }
  // F11 : l'alerte interne, minimisée (L6). Une panne ne défait pas l'envoi.
  try {
    await alerterDossierRecu(d.id);
  } catch (e) {
    signaler("alerte-dossier-recu", e);
  }
  return { ok: true };
}
