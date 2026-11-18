"use server";

// Tour France IA : l'action de la mini-demande (PR-2b).
//
// Trois champs (nom, e-mail, ville) avant le calendrier de la visio. Dans l'ordre :
//
//   1. champ leurre rempli → trace (`signalerHoneypot`), puis la MÊME redirection que pour tout le
//      monde, SANS rien enregistrer : le robot n'apprend rien, et un humain pris au piège arrive
//      quand même au calendrier (la visio, elle, se prend ensuite sans cette demande) ;
//   2. 10 demandes, pas plus, par heure et par empreinte d'adresse IP. Si le compteur (Redis) est en
//      panne, on REFUSE : sans lui, rien ne limite l'inondation de la table ;
//   3. validation (longueurs, e-mail) → `?erreur=champs`, sans aucune donnée dans l'URL ;
//   4. enregistrement (`enregistrerDemande`) puis jeton signé de 30 minutes ; une panne de la base
//      est signalée à Sentry et ne bloque jamais la personne : elle va au calendrier sans jeton ;
//   5. la redirection est HORS du `try` : `redirect` lève, elle ne doit jamais être avalée.
//
// 🔑 Anti-oracle : la redirection ne dépend NI de l'existence d'une fiche, NI de la nouveauté de
// l'adresse, NI du comptage de la ville (doublon ou non) : deux envois identiques reçoivent la même
// réponse. Aucun cookie ni e-mail ; une alerte Telegram sans donnée personnelle part APRÈS la réponse (alertes.ts), elle ne change ni la redirection ni la durée.

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { programmerAlerteDemande } from "@/features/tour-de-france/alertes";
import { enregistrerDemande } from "@/features/tour-de-france/enregistrer";
import { creerJetonDemande } from "@/features/tour-de-france/jeton-demande";
import { getClientIp } from "@/lib/client-ip";
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit";
import { signalerHoneypot } from "@/lib/security/honeypot-observable";
import { hashIp } from "@/lib/security/ip-hash";
import { normalizeEmail } from "@/lib/security/email-hash";
import { lireSuiviArrivee } from "@/server/calendly/choix-rendez-vous";
import { attendreDureeMinimale } from "./attente";
import { CHEMIN_DEMANDE, CHEMIN_RENDEZ_VOUS, META } from "../contenu";

/** 10 demandes par heure et par adresse IP ; compteur en panne : refus. */
const LIMITE_DEMANDES: RateLimitConfig = { limit: 10, windowSec: 3600, surPanne: "refuser" };

// Un `telephone` posté par une ancienne page est ignoré (zod retire les clés inconnues) : le
// téléphone est demandé à l'étape suivante (le choix du créneau de la visio).
const ENTREE = z.object({
  nom: z.string().trim().min(1).max(80),
  email: z.string().trim().max(254).email(),
  ville: z.string().trim().min(1).max(80),
});

/** Les paramètres de suivi (`depuis`, `utm_*`) à garder d'une page à l'autre. Jamais `ref`. */
function parametresDeSuivi(fd: FormData): URLSearchParams {
  const suivi = lireSuiviArrivee(Object.fromEntries(fd.entries()));
  const p = new URLSearchParams();
  for (const cle of [
    "depuis",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
  ] as const) {
    const v = suivi[cle];
    if (v) p.set(cle, v);
  }
  return p;
}

function versLaVisio(suivi: URLSearchParams, jeton?: string): string {
  const p = new URLSearchParams(suivi);
  if (jeton) p.set("j", jeton);
  const requete = p.toString();
  return requete ? `${CHEMIN_RENDEZ_VOUS}?${requete}` : CHEMIN_RENDEZ_VOUS;
}

function versLErreur(suivi: URLSearchParams, erreur: "champs" | "trop"): string {
  const p = new URLSearchParams(suivi);
  p.set("erreur", erreur);
  return `${CHEMIN_DEMANDE}?${p.toString()}`;
}

/** Le salage absent n'est signalé qu'une fois par processus. */
let saleAbsentSignale = false;

function empreinteDeLIp(ip: string): string {
  try {
    return hashIp(ip) ?? "inconnue";
  } catch {
    // Salage absent en production : le compteur reste utile avec une clé commune, mais on le dit.
    if (!saleAbsentSignale) {
      saleAbsentSignale = true;
      Sentry.captureMessage(
        "IP_HASH_SALT manquant : la limite de la mini-demande utilise une clé commune",
        {
          level: "error",
          tags: { module: "tour-demande", etape: "empreinte-ip" },
        },
      );
    }
    return "inconnue";
  }
}

function texte(fd: FormData, nom: string): string {
  const v = fd.get(nom);
  return typeof v === "string" ? v : "";
}

export async function envoyerDemandeTour(formData: FormData): Promise<void> {
  const debut = Date.now();
  const suivi = parametresDeSuivi(formData);

  // 1. Le leurre.
  const leurre = formData.get("website");
  if (leurre) {
    await signalerHoneypot("tour-demande", leurre);
    await attendreDureeMinimale(debut);
    redirect(versLaVisio(suivi));
  }

  // 2. La limite.
  const ipHash = empreinteDeLIp(await getClientIp());
  const limite = await checkRateLimit(`tour-demande:${ipHash}`, LIMITE_DEMANDES);
  if (!limite.allowed) {
    await attendreDureeMinimale(debut);
    redirect(versLErreur(suivi, "trop"));
  }

  // 3. La validation.
  const lue = ENTREE.safeParse({
    nom: texte(formData, "nom"),
    email: normalizeEmail(texte(formData, "email")),
    ville: texte(formData, "ville"),
  });
  if (!lue.success) {
    await attendreDureeMinimale(debut);
    redirect(versLErreur(suivi, "champs"));
  }
  const entree = lue.data;

  // 4. L'enregistrement. Jamais de `redirect` dans ce bloc.
  let jeton: string | undefined;
  try {
    const d = await enregistrerDemande({
      ...entree,
      depuis: suivi.get("depuis"),
      utmSource: suivi.get("utm_source"),
      utmMedium: suivi.get("utm_medium"),
      utmCampaign: suivi.get("utm_campaign"),
      utmContent: suivi.get("utm_content"),
      ipHash,
    });
    jeton = creerJetonDemande(d.id);
    revalidatePath(META.chemin);
    programmerAlerteDemande(d);
  } catch (e) {
    Sentry.captureException(e, { tags: { module: "tour-demande", etape: "action" } });
  }

  // 5. La visio, avec ou sans jeton, après la même durée minimale quelle que soit l'adresse.
  await attendreDureeMinimale(debut);
  redirect(versLaVisio(suivi, jeton));
}
