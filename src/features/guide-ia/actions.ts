// Guide IA — Server Action du formulaire (lot L2, 2026-09-24).
//
// Remplace `subscribeNewsletterAction`. Deux finalités, découplées :
//   · le GUIDE part tout de suite, sur la seule adresse (RGPD 6.1.b) ;
//   · la LETTRE est une case facultative, décochée, à double opt-in (6.1.a) —
//     sa confirmation voyage dans le même e-mail.
//
// Les contrôles d'entrée, dans l'ordre :
//   1. débit par IP (3 / 5 min) ;
//   2. piège à robots (faux succès côté visiteur, trace côté serveur) ;
//   3. 🔴 Turnstile BLOQUANT (décision D3 de Will, 24/09). Le 01/07, il avait
//      été rendu non bloquant (« zéro friction ») : le formulaire n'envoyait
//      alors qu'une confirmation, et le double opt-in protégeait. Désormais il
//      envoie un e-mail à TOUTE adresse saisie, depuis le compte qui porte les
//      factures — le risque a changé, la protection aussi ;
//   4. validation ;
//   5. le domaine reçoit-il des e-mails (MX) ?
// Puis `enregistrerDemandeGuide` (serveur) applique les bornes d'envoi.
//
// ⚠️ Fichier `"use server"` : n'exporte QUE des fonctions asynchrones (et des
// types, effacés à la compilation). Toute la logique vit dans `server/guide-ia/`.

"use server";

import * as Sentry from "@sentry/nextjs";
import { demandeGuideSchema } from "@/lib/schemas/forms";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { parseLocale } from "@/lib/schemas/locale";
import { getClientIp } from "@/lib/client-ip";
import { hashIp } from "@/lib/security/ip-hash";
import { signalerHoneypot } from "@/lib/security/honeypot-observable";
import {
  FORM_REF_LETTRE,
  SOURCES_GUIDE,
  VERSION_LETTRE,
  VERSION_MENTION_GUIDE,
  varianteDeSource,
  type SourceGuide,
} from "@/content/guide-ia-formulaire";
import { domaineRecoitDesEmails } from "@/server/guide-ia/mx";
import { enregistrerDemandeGuide } from "@/server/guide-ia/demande";

export type DemandeGuideState = { ok: true } | { ok: false; error: string };

function lireSource(brut: FormDataEntryValue | null): SourceGuide | null {
  return typeof brut === "string" && (SOURCES_GUIDE as readonly string[]).includes(brut)
    ? (brut as SourceGuide)
    : null;
}

function empreinteIp(ip: string): string | null {
  try {
    return hashIp(ip);
  } catch {
    return null;
  }
}

export async function demanderGuideAction(
  _prev: DemandeGuideState,
  formData: FormData,
): Promise<DemandeGuideState> {
  const locale = parseLocale(formData.get("locale"));
  const fr = locale === "fr";
  const ip = await getClientIp();

  // 1. Débit par IP — inchangé depuis le formulaire d'origine.
  const rl = await checkRateLimit(`newsletter:${ip}`, { limit: 3, windowSec: 300 });
  if (!rl.allowed) {
    return {
      ok: false,
      error: fr
        ? "Trop de tentatives. Réessayez dans 5 minutes."
        : "Too many attempts. Try again in 5 minutes.",
    };
  }

  // 2. Piège à robots.
  const leurre = formData.get("website");
  if (leurre) {
    signalerHoneypot("newsletter", leurre);
    return { ok: true };
  }

  // 3. Turnstile BLOQUANT (D3).
  const turnstileToken = formData.get("cf-turnstile-response") as string | null;
  const humain = await verifyTurnstile(turnstileToken, ip).catch(() => false);
  if (!humain) {
    return {
      ok: false,
      error: fr
        ? "La vérification anti-robot n'a pas abouti. Rechargez la page, puis réessayez."
        : "The anti-bot check did not complete. Reload the page, then try again.",
    };
  }

  // 4. Validation.
  const parsed = demandeGuideSchema.safeParse({
    email: formData.get("email"),
    lettre: formData.get("lettre") === "true" || formData.get("lettre") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: fr ? "Adresse e-mail invalide." : "Invalid email address." };
  }

  // 5. MX : une faute dans le domaine se corrige ICI, pas en rebond dur.
  if ((await domaineRecoitDesEmails(parsed.data.email)) === "non") {
    return {
      ok: false,
      error: fr
        ? "Cette adresse ne semble pas pouvoir recevoir d'e-mails. Vérifiez-la, puis réessayez."
        : "This address does not seem able to receive emails. Check it, then try again.",
    };
  }

  const source = lireSource(formData.get("source"));
  const variante = varianteDeSource(source ?? "guide-ia");

  try {
    await enregistrerDemandeGuide({
      email: parsed.data.email,
      locale,
      source,
      versionMention: VERSION_MENTION_GUIDE,
      lettre: parsed.data.lettre
        ? { formRef: FORM_REF_LETTRE[variante], version: VERSION_LETTRE[variante] }
        : null,
      ipHash: empreinteIp(ip),
    });
  } catch (err) {
    console.error(
      "[guide-ia] demande non enregistrée :",
      err instanceof Error ? err.message : String(err),
    );
    Sentry.captureException(err);
    return {
      ok: false,
      error: fr
        ? "Erreur. Réessayez ou écrivez à contact@axion-ia.com."
        : "Error. Try again or email contact@axion-ia.com.",
    };
  }

  // La preuve de la LETTRE (IP hachée, agent) s'écrit à la CONFIRMATION, sur
  // le geste qui la vaut — pas ici, où rien n'est encore accepté.
  return { ok: true };
}
