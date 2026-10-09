/**
 * Les actions de la DÉCLARATION D'ENTREPRISE (contrat v2 art. 3.2, démarrage manuel).
 *
 * Même garde que `actions.ts` : limite de débit par IP HACHÉE, puis dossier relu PAR SON
 * LIEN (jeton HMAC, temps constant) ET statut « signé » : un jeton faux, révoqué, ou un
 * dossier qui n'est pas signé rend la même réponse neutre. Rien n'est envoyé à
 * l'entreprise ; aucune valeur saisie ne va dans les logs.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import * as Sentry from "@sentry/nextjs";

import { getClientIp } from "@/lib/client-ip";
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { lireEtablissementParSiret } from "@/features/apporteurs-reseau/annuaire";
import { lireDossierParLien } from "@/features/apporteurs-reseau/donnees";
import {
  declarerEntreprise,
  MESSAGE_NEUTRE,
} from "@/features/apporteurs-reseau/declaration-entreprise";
import { siretValide } from "@/features/apporteurs-reseau/etablissement-presentation";
import { etatDeLaPage } from "@/features/apporteurs-reseau/signature";

import { TEXTES } from "./textes";

export type ResultatDeclarationAction = { ok: true } | { ok: false; message: string };
export type ResultatRechercheDeclaration =
  { ok: true; denomination: string | null } | { ok: false };

// Panne de Redis : laisser passer (chaque écriture reste gardée par le jeton, le statut
// et la limite de 20 par 24 h en base).
const LIMITES = {
  declaration: { limit: 20, windowSec: 900, surPanne: "laisser-passer" },
  recherche: { limit: 30, windowSec: 900, surPanne: "laisser-passer" },
} as const satisfies Record<string, RateLimitConfig>;

async function debitAutorise(famille: keyof typeof LIMITES): Promise<boolean> {
  let ip: string | null = null;
  try {
    ip = hashIp(await getClientIp());
  } catch {
    ip = null; // sel absent : jamais d'IP en clair
  }
  const cle = `apporteur-declaration:${famille}:${ip ?? "sans-ip"}`;
  return (await checkRateLimit(cle, LIMITES[famille])).allowed;
}

const lien = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.slice(0, 100) : "");
const champ = (fd: FormData, nom: string, max: number) => {
  const v = fd.get(nom);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};

async function dossierSigneParLien(id: string, jeton: string) {
  const d = await lireDossierParLien(id, jeton);
  // Mode restreint (retiré du réseau) : aucune déclaration d'entreprise.
  return d && !d.restreint && etatDeLaPage(d.statut) === "signe" ? d : null;
}

export async function rechercherEntrepriseDeclarationAction(
  id: string,
  jeton: string,
  siret: string,
): Promise<ResultatRechercheDeclaration> {
  if (!(await debitAutorise("recherche"))) return { ok: false };
  if (!(await dossierSigneParLien(lien(id), lien(jeton)))) return { ok: false };
  const s = String(siret).replace(/\s+/g, "").slice(0, 20);
  if (!siretValide(s)) return { ok: false };
  const r = await lireEtablissementParSiret(s);
  return r.ok ? { ok: true, denomination: r.entreprise.denomination } : { ok: false };
}

export async function declarerEntrepriseAction(fd: FormData): Promise<ResultatDeclarationAction> {
  if (!(await debitAutorise("declaration"))) return { ok: false, message: TEXTES.trop };
  const dossier = await dossierSigneParLien(lien(fd.get("id")), lien(fd.get("jeton")));
  if (!dossier) return { ok: false, message: MESSAGE_NEUTRE };
  try {
    return await declarerEntreprise(dossier.id, {
      siret: champ(fd, "siret", 20),
      denomination: champ(fd, "denomination", 250),
      personneNom: champ(fd, "personneNom", 150),
      personneFonction: champ(fd, "personneFonction", 150),
      personneEmail: champ(fd, "personneEmail", 254),
      personneTelephone: champ(fd, "personneTelephone", 30),
      dateContact: champ(fd, "dateContact", 10),
    });
  } catch (e) {
    // Contexte MINIMAL : le nom de l'erreur seul, jamais une valeur saisie.
    const nom = e instanceof Error ? e.name : "inconnue";
    Sentry.captureException(new Error(`apporteur-declaration : échec (${nom})`), {
      tags: { service: "apporteur-declaration", etape: "declaration" },
    });
    return { ok: false, message: MESSAGE_NEUTRE };
  }
}
