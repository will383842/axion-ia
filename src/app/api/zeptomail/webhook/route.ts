// Webhook des rebonds ZeptoMail (2026-08-20, constat `D5-3-02`).
//
// ## Le défaut que cette route ferme
//
// Un rebond dur était **indiscernable d'une remise réussie**. Le relais
// acceptait le message — `EmailLog.status = "sent"` — le serveur destinataire le
// refusait ensuite, et rien ne revenait dans le système.
//
// Une convocation « envoyée » pouvait n'être jamais arrivée. Et la console
// offrait un filtre « Rejeté » (`SubmissionReplyStatus.bounced`) qu'aucun code
// n'écrivait : l'état avait été prévu à la conception — son commentaire dit
// « confirmation delivery via webhook bounce/delivery » — et le webhook n'a
// jamais été construit.
//
// ## Forme, calquée sur `api/calendly/webhook`
//
// Même doctrine, parce qu'elle a été payée : `text()` et jamais `json()` (la
// signature porte sur les octets), garde-fou de volume AVANT le calcul du HMAC,
// limite de débit par IP, et 200 muet quand la clé n'est pas configurée — un 404
// ou un 500 répété fait désabonner le fournisseur.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { notify } from "@/server/notifications";
import { creerOuDedup } from "@/server/qualiopi/alertes/alertes-service";
import { verifierSignatureZeptomail } from "@/server/email/zeptomail-webhook-signature";
import { lireRebond, FENETRE_RATTACHEMENT_HEURES } from "@/server/email/bounce-service";
import { noterAppelWebhook } from "@/server/email/webhook-battement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Un payload de rebond fait quelques kilo-octets ; au-delà, ce n'en est pas un. */
const MAX_BODY_BYTES = 128 * 1024;

/**
 * Sonde d'accessibilité — 🔴 SANS ELLE, LE WEBHOOK NE PEUT PAS ÊTRE CRÉÉ.
 *
 * ZeptoMail interroge l'URL AVANT d'accepter la création d'un webhook, et
 * exige un `200`. Mesuré sur la production le 2026-09-01, avant ce correctif :
 *
 *     GET  /api/zeptomail/webhook  → 405   (la route n'exportait que POST)
 *     POST /api/zeptomail/webhook  → 401   (signature exigée, absente)
 *
 * Aucune des deux réponses ne satisfait la sonde : le panneau affichait
 * « URL cannot be reached » et le bouton « Ajouter » ne créait rien.
 *
 * 🔑 C'est ce qui explique le vrai mystère de la journée : le compteur
 * `dernier appel webhook` valait `JAMAIS` non pas parce que les appels
 * étaient refusés, mais parce que **le webhook n'a jamais pu exister**. On a
 * cherché longtemps du côté de la clé et de la signature — c'est-à-dire d'une
 * étape qu'on n'avait jamais atteinte.
 *
 * Ce que cette route rend, et pourquoi c'est sûr : un objet constant, sans
 * aucune donnée du système. Elle ne dit même pas si une clé est configurée —
 * un point d'entrée public ne renseigne pas sur son propre armement.
 *
 * ⚠️ Elle NE contourne PAS la vérification de signature : le `POST` ci-dessous
 * est inchangé. Un `GET` ne transporte pas de rebond ; accepter de dire
 * « je suis là » n'est pas accepter de dire « j'ai reçu ça ».
 */
export function GET(): Response {
  return Response.json({ ok: true, endpoint: "zeptomail-webhook" });
}

export async function POST(req: NextRequest): Promise<Response> {
  const cle = process.env["ZEPTOMAIL_WEBHOOK_KEY"]?.trim();

  // Non configuré → 200 muet, comme pour Calendly. ZeptoMail désabonne un
  // webhook qui échoue plusieurs fois de suite : répondre 500 tant que la clé
  // n'est pas posée détruirait l'abonnement que Will vient de créer.
  if (!cle) return Response.json({ ok: true, skipped: "not_configured" });

  const longueurDeclaree = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(longueurDeclaree) && longueurDeclaree > MAX_BODY_BYTES) {
    return new Response("payload_too_large", { status: 413 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = await checkRateLimit(`zeptomail-webhook:${ip}`, { limit: 120, windowSec: 60 });
  if (!rl.allowed) return new Response("rate_limited", { status: 429 });

  // 🔴 `text()` et surtout PAS `json()` : la signature porte sur les octets
  // exacts. Un `JSON.parse` suivi d'un `stringify` réordonne les clés.
  let corpsBrut: string;
  try {
    corpsBrut = await req.text();
  } catch {
    return new Response("unreadable_body", { status: 400 });
  }
  if (corpsBrut.length > MAX_BODY_BYTES) {
    return new Response("payload_too_large", { status: 413 });
  }

  const verdict = verifierSignatureZeptomail(corpsBrut, req.headers.get("Producer-Signature"), cle);
  if (!verdict.ok) {
    // Signature invalide sur un endpoint public : soit une clé désynchronisée
    // après rotation, soit quelqu'un qui tente sa chance. Les deux méritent
    // d'être vus. IP HACHÉE, jamais en clair — une alerte de sécurité n'a besoin
    // que de savoir si c'est toujours la même source.
    void notify({
      category: "SECURITY_ALERT",
      payload: {
        kind: "zeptomail_webhook_signature_invalid",
        details: { reason: verdict.reason, ipHash: hashIp(ip) ?? "unknown" },
      },
    });
    // 🔴 200, PAS 401 — et c'est ce qui permet au webhook d'exister.
    //
    // ZeptoMail interroge cette URL en POST avant d'accepter la création d'un
    // webhook. Cette sonde n'est PAS signée, et elle ne peut pas l'être : la
    // « Clé d'authentification » ne se configure qu'APRÈS la création. Un 401
    // sur cette sonde ferme donc un cercle : pas de clé sans webhook, pas de
    // webhook sans clé. Mesuré le 2026-09-01 — le panneau affichait « URL
    // cannot be reached », la boîte se fermait sans rien créer, et rien
    // n'indiquait que la cause était notre code de rejet.
    //
    // 🔑 Le contrat de sécurité est INCHANGÉ : on ne traite toujours
    // rien. La charge n'est pas lue, aucun rebond n'est enregistré, l'alerte
    // ci-dessus part quand même. Ce qui change est le CODE rendu, pas le
    // comportement — et c'est la doctrine déjà écrite en tête de ce fichier :
    // « un 404 ou un 500 répété fait désabonner le fournisseur ». Le 401 était
    // une incohérence avec cette règle, pas une protection.
    //
    // Accessoirement, un 200 uniforme en dit MOINS à un attaquant qu'un 401 :
    // celui-ci confirmait que la vérification est active et que la tentative
    // avait échoué. Ici, rien ne distingue une charge acceptée d'une charge
    // ignorée — seule l'alerte hors bande le dit, à nous.
    return Response.json({ ok: true, ignored: "invalid_signature" });
  }

  // ── Battement ────────────────────────────────────────────────
  //
  // Posé ICI — après la signature, AVANT l'analyse du contenu — et c'est
  // délibéré. Ce qu'on mesure n'est pas le rebond, c'est l'ABONNEMENT : un
  // appel de test depuis la console ZeptoMail, ou un événement qui n'est pas un
  // rebond, prouve que la route est atteinte tout aussi bien qu'un vrai rebond.
  // Le placer plus bas ne laisserait aucune trace des appels `not_a_bounce`.
  //
  // `void` : le battement ne doit ni ralentir ni faire échouer la réponse. Un
  // 500 répété fait désabonner ZeptoMail — on détruirait l'abonnement qu'on
  // cherche justement à surveiller.
  //
  // 🔴 Cette ligne a été PERDUE une fois, le 2026-09-01 : la PR qui a
  // ajouté la sonde `GET` ci-dessus a été construite à partir d'une copie
  // périmée de ce fichier, prise dans un arbre de travail partagé qui était
  // resté sur une autre branche. Le module `webhook-battement.ts` est demeuré
  // parfait et DÉBRANCHÉ — état rigoureusement indiscernable d'un module
  // branché, tant qu'on ne teste que le module. D'où la garde de câblage dans
  // `route.spec.ts`, qui lit CE fichier et exige l'appel.
  void noterAppelWebhook();

  let payload: unknown;
  try {
    payload = JSON.parse(corpsBrut);
  } catch {
    return new Response("invalid_json", { status: 400 });
  }

  const rebond = lireRebond(payload);
  // Pas un rebond (l'agent peut être abonné à d'autres événements) : on accuse
  // réception. Répondre en erreur ferait retenter puis désabonner.
  if (rebond === null) return Response.json({ ok: true, ignored: "not_a_bounce" });

  const survenuLe = rebond.survenuLe ?? new Date();
  let rattache = false;

  // ── Rattachement à l'envoi ────────────────────────────────────────────────
  //
  // ⚠️ Par DESTINATAIRE et FENÊTRE DE TEMPS, faute de mieux : le dépôt ne pose
  // pas de `client_reference` à l'envoi, donc aucune corrélation exacte n'est
  // possible. On retient l'envoi le plus RÉCENT dans la fenêtre — deux envois au
  // même destinataire s'y départagent ainsi.
  //
  // 🔑 Un rebond non rattaché n'est JAMAIS perdu : l'alerte part quand même.
  // Perdre le lien vaut mieux que perdre le fait.
  if (rebond.destinataire !== null) {
    const depuis = new Date(survenuLe.getTime() - FENETRE_RATTACHEMENT_HEURES * 3600_000);
    try {
      const envoi = await prisma.emailLog.findFirst({
        where: {
          recipient: rebond.destinataire,
          createdAt: { gte: depuis, lte: survenuLe },
          // On ne « rebondit » que ce qui est parti. Un `pending` n'a pas encore
          // quitté la file : le marquer rebondi masquerait une panne d'envoi
          // derrière un refus du destinataire.
          status: "sent",
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (envoi !== null) {
        await prisma.emailLog.update({
          where: { id: envoi.id },
          data: {
            status: "bounced",
            bounceType: rebond.type,
            bounceReason: rebond.motif ?? rebond.diagnostic,
            bouncedAt: survenuLe,
          },
        });
        rattache = true;
      }

      // La réponse à un message de contact porte son propre état, et c'est LUI
      // que la console filtre sous « Rejeté ». Le mettre à jour aussi : sinon le
      // filtre resterait vide alors que le rebond est connu.
      await prisma.submissionReply.updateMany({
        where: {
          toEmail: rebond.destinataire,
          sentAt: { gte: depuis, lte: survenuLe },
          deliveryStatus: "sent",
        },
        data: { deliveryStatus: "bounced" },
      });
    } catch {
      // Base indisponible : on ne perd pas le rebond pour autant, l'alerte
      // ci-dessous part quand même. Répondre en erreur ferait retenter — et
      // ZeptoMail finirait par désabonner.
    }
  }

  // ── Alerte ────────────────────────────────────────────────────────────────
  //
  // Un rebond DUR seulement. Un rebond doux est transitoire par définition —
  // alerter dessus apprendrait à ignorer la catégorie, et c'est le dur qui
  // signale une adresse morte : le stagiaire ne recevra ni convocation, ni
  // attestation, tant que personne ne corrige.
  if (rebond.type === "hard") {
    void creerOuDedup({
      code: "email_rebond_dur",
      niveau: "important",
      titre: "Un e-mail a définitivement rebondi",
      message:
        `L'adresse « ${rebond.destinataire ?? "inconnue"} » a refusé définitivement un envoi` +
        `${rebond.sujet !== null ? ` (« ${rebond.sujet} »)` : ""}. ` +
        `Motif du serveur : ${rebond.motif ?? rebond.diagnostic ?? "non communiqué"}. ` +
        `${rattache ? "L'envoi correspondant est marqué « rebond »." : "Aucun envoi n'a pu être rattaché — le rebond est consigné ici."} ` +
        `Tant que l'adresse n'est pas corrigée, cette personne ne recevra ni convocation, ni attestation.`,
      cibleType: "EmailLog",
      // Dédoublonnage par ADRESSE : dix envois à une boîte morte produisent dix
      // rebonds, et une alerte par envoi rendrait la liste illisible pour un
      // seul geste à poser.
      cibleId: rebond.destinataire ?? "inconnu",
    }).catch(() => {});
  }

  return Response.json({ ok: true, type: rebond.type, rattache });
}
