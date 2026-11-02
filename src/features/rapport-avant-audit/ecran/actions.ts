/**
 * Écran « Rapport d'analyse » — les trois gestes de Will (Server Actions).
 *
 *   · `lancerAnalyseAction` — le bouton « Lancer l'analyse complète » (îlot client). La trace
 *     du lancement est écrite par l'accès (`rapport-avant-audit.lancer`), une seule fois ;
 *   · `validerPdfClientAction` — « Valider le PDF client ». Rend le PDF téléchargeable ;
 *     ⛔ n'envoie RIEN à personne (aucun envoi automatique, jamais) ;
 *   · `completerFicheAction` — « Compléter la fiche » : écrit les champs cochés, SEULEMENT
 *     s'ils sont vides au moment du clic, par la porte unique `updateClientAction`. Jamais
 *     d'écrasement ; le SIREN n'y passe jamais (il a son bouton). Trace
 *     `client.complete_depuis_rapport` ;
 *   · `poserSirenDepuisRapportAction` — « Poser ce SIREN » : relit la proposition DANS LE
 *     RAPPORT (jamais un champ caché du formulaire), relit la fiche et refuse si le SIREN n'est
 *     pas vide, puis écrit par `updateClientAction`. Même trace, `champs: [{ champ: "siren" }]`.
 *
 * Tous réservés au super-administrateur, revérifié ICI (une Server Action est un point d'entrée
 * HTTP public : la page qui cache le bouton ne protège rien).
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones (aucun type, aucun
 * ré-export) — garde `tests/unit/ci/surface-server-actions.spec.ts`.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminPath } from "@/lib/admin-path";
import { updateClientAction } from "@/server/actions/qualiopi/clients";
import { logQualiopiActivity, requireSuperAdmin } from "@/server/actions/qualiopi/_guards";

import { accesRapports } from "./brancher";
import { rapportAvantAuditActif } from "./interrupteur";
import { datesDesReponses, lireFicheActuelle } from "./lecture";
import {
  decisionCompletion,
  decisionValidationPdf,
  etatBoutonLancer,
  LIBELLES_CHAMPS,
  listerPropositions,
  planifierCompletion,
  RESERVE_SUPER_ADMIN,
} from "./logique";

const Uuid = z.string().uuid();
/** Un identifiant de rapport est un UUID (clé de `rapports_avant_audit`). */
const IdRapport = Uuid;

const ficheDe = (clientId: string): string => adminPath("fr", `qualiopi/clients/${clientId}`);

async function superAdminOuNull(): Promise<{ userId: string; role: string } | null> {
  try {
    return await requireSuperAdmin();
  } catch {
    return null;
  }
}

// ── Lancer ───────────────────────────────────────────────────────────────────

export async function lancerAnalyseAction(saisie: {
  clientId: string;
}): Promise<{ ok: true; message: string } | { ok: false; erreur: string }> {
  const session = await superAdminOuNull();
  if (session === null) return { ok: false, erreur: RESERVE_SUPER_ADMIN };
  const v = Uuid.safeParse(saisie?.clientId);
  if (!v.success) return { ok: false, erreur: "Fiche client invalide." };
  const clientId = v.data;

  const acces = accesRapports();
  const [dates, rapports] = await Promise.all([
    datesDesReponses(clientId),
    acces.listerRapports(clientId),
  ]);
  const bouton = etatBoutonLancer({
    role: session.role,
    interrupteurAllume: rapportAvantAuditActif(),
    branche: acces.branche,
    nbReponses: dates.length,
    rapports,
  });
  if (!bouton.actif) return { ok: false, erreur: bouton.raison ?? "Lancement impossible." };

  // L'accès trace lui-même le lancement (`rapport-avant-audit.lancer`) : pas de seconde trace.
  const r = await acces.lancer(clientId, session.userId);
  if (!r.ok) return { ok: false, erreur: r.raison };
  revalidatePath(ficheDe(clientId));
  return {
    ok: true,
    message:
      "Analyse lancée. Elle prend plusieurs minutes : rechargez la page pour suivre les étapes.",
  };
}

// ── Valider le PDF client ────────────────────────────────────────────────────

type Retour = { ok: true; texte: string } | { ok: false; texte: string };

const champsDuFormulaire = (formData: FormData) => {
  const clientId = Uuid.safeParse(String(formData.get("clientId") ?? ""));
  const rapportId = IdRapport.safeParse(String(formData.get("rapportId") ?? ""));
  return clientId.success && rapportId.success
    ? { clientId: clientId.data, rapportId: rapportId.data }
    : null;
};

export async function validerPdfClientAction(formData: FormData): Promise<Retour> {
  const session = await superAdminOuNull();
  if (session === null) return { ok: false, texte: RESERVE_SUPER_ADMIN };
  const ids = champsDuFormulaire(formData);
  if (ids === null) return { ok: false, texte: "Demande invalide." };
  const { clientId, rapportId } = ids;

  const acces = accesRapports();
  const rapport = (await acces.listerRapports(clientId)).find((r) => r.id === rapportId) ?? null;
  const d = decisionValidationPdf({ role: session.role, rapport });
  if (!d.ok) return { ok: false, texte: d.texte };

  const r = await acces.validerPdf(clientId, rapportId, session.userId);
  if (!r.ok) return { ok: false, texte: r.raison };
  await logQualiopiActivity({
    action: "rapport-avant-audit.pdf_valide",
    targetType: "Client",
    targetId: clientId,
    changes: { rapportId, version: rapport?.version ?? null },
    session,
  });
  revalidatePath(ficheDe(clientId));
  return {
    ok: true,
    texte: "PDF client validé : il est maintenant téléchargeable. Rien n'a été envoyé au client.",
  };
}

// ── Compléter la fiche ───────────────────────────────────────────────────────

export async function completerFicheAction(formData: FormData): Promise<Retour> {
  const session = await superAdminOuNull();
  if (session === null) return { ok: false, texte: RESERVE_SUPER_ADMIN };
  const ids = champsDuFormulaire(formData);
  if (ids === null) return { ok: false, texte: "Demande invalide." };
  const { clientId, rapportId } = ids;
  const cles = formData
    .getAll("cle")
    .map(String)
    .filter((c) => /^p\d{1,4}$/.test(c));
  if (cles.length === 0) {
    return { ok: false, texte: "Cochez au moins une ligne avant de compléter la fiche." };
  }

  const acces = accesRapports();
  const rapport = (await acces.listerRapports(clientId)).find((r) => r.id === rapportId) ?? null;
  const d = decisionCompletion({ role: session.role, rapport });
  if (!d.ok) return { ok: false, texte: d.texte };

  // Les VALEURS viennent du rapport relu ici, jamais du formulaire ; la fiche est relue AU CLIC.
  const [propositions, fiche] = await Promise.all([
    acces.lirePropositions(clientId, rapportId),
    lireFicheActuelle(clientId),
  ]);
  if (fiche === null) return { ok: false, texte: "Fiche client introuvable." };
  const plan = planifierCompletion(propositions, fiche, cles);
  if (plan.ecrits.length === 0) {
    return {
      ok: false,
      texte:
        "Rien n'a été écrit : les champs cochés sont déjà remplis ou ne peuvent pas être complétés ainsi.",
    };
  }

  // La porte unique : mêmes contrôles qu'« Éditer » (formats, type de fiche, droits d'écriture).
  const r = await updateClientAction({ id: clientId, ...plan.aEcrire });
  if ("error" in r) return { ok: false, texte: `Rien n'a été écrit : ${r.error}` };

  await logQualiopiActivity({
    action: "client.complete_depuis_rapport",
    targetType: "Client",
    targetId: clientId,
    changes: {
      rapportId,
      version: rapport?.version ?? null,
      champs: plan.ecrits.map((e) => ({ champ: e.champ, source: e.source })),
      refuses: plan.refuses.length,
    },
    session,
  });
  revalidatePath(ficheDe(clientId));
  const noms = plan.ecrits.map((e) => LIBELLES_CHAMPS[e.champ]).join(", ");
  const ignores =
    plan.refuses.length > 0 ? ` ${plan.refuses.length} ligne(s) laissée(s) de côté.` : "";
  return { ok: true, texte: `Fiche complétée : ${noms}.${ignores}` };
}

// ── Poser le SIREN proposé par le rapport ────────────────────────────────────

export async function poserSirenDepuisRapportAction(
  clientIdSaisi: string,
  rapportIdSaisi: string,
  cleSaisie: string,
): Promise<Retour> {
  const session = await superAdminOuNull();
  if (session === null) return { ok: false, texte: RESERVE_SUPER_ADMIN };
  const clientId = Uuid.safeParse(clientIdSaisi);
  const rapportId = IdRapport.safeParse(rapportIdSaisi);
  const cle = typeof cleSaisie === "string" && /^p\d{1,4}$/.test(cleSaisie) ? cleSaisie : null;
  if (!clientId.success || !rapportId.success || cle === null) {
    return { ok: false, texte: "Demande invalide." };
  }

  const acces = accesRapports();
  const rapport =
    (await acces.listerRapports(clientId.data)).find((r) => r.id === rapportId.data) ?? null;
  const d = decisionCompletion({ role: session.role, rapport });
  if (!d.ok) return { ok: false, texte: d.texte };

  // La valeur vient du RAPPORT relu ici ; la fiche est relue AU CLIC.
  const [propositions, fiche] = await Promise.all([
    acces.lirePropositions(clientId.data, rapportId.data),
    lireFicheActuelle(clientId.data),
  ]);
  if (fiche === null) return { ok: false, texte: "Fiche client introuvable." };
  if (fiche.siren !== null && fiche.siren.trim() !== "") {
    return {
      ok: false,
      texte: "Rien n'a été écrit : la fiche a déjà un SIREN, il n'est jamais remplacé.",
    };
  }
  const ligne = listerPropositions(propositions, fiche).find((l) => l.cle === cle);
  if (ligne === undefined || ligne.etat !== "siren" || ligne.valeurAEcrire === null) {
    return { ok: false, texte: "Rien n'a été écrit : ce rapport ne propose pas ce SIREN." };
  }

  // La porte unique : mêmes contrôles qu'« Éditer » (cohérence avec le SIRET, droits d'écriture).
  const r = await updateClientAction({ id: clientId.data, siren: ligne.valeurAEcrire });
  if ("error" in r) return { ok: false, texte: `Rien n'a été écrit : ${r.error}` };

  await logQualiopiActivity({
    action: "client.complete_depuis_rapport",
    targetType: "Client",
    targetId: clientId.data,
    changes: {
      rapportId: rapportId.data,
      version: rapport?.version ?? null,
      champs: [{ champ: "siren", source: ligne.source }],
      refuses: 0,
    },
    session,
  });
  revalidatePath(ficheDe(clientId.data));
  return { ok: true, texte: "SIREN posé sur la fiche." };
}
