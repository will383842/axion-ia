// API /api/gdpr-erase — RGPD self-service erase (Sprint Correctif S+1 / P0-S1-2 2026-05-16).
//
// POST { email, token, confirm: "ERASE_MY_DATA" }
//
// Flow :
//   1. Vérifie token HMAC (même schéma que /api/gdpr-export, lib `gdpr-token`).
//   2. Anti-replay : token email === body email.
//   3. Confirmation littérale "ERASE_MY_DATA" (anti-clic-accidentel).
//   4. Rate limit 1/jour/email (l'erase ne se rejoue pas).
//   5. Pour chaque type de données :
//      - Submission : anonymisation in-place (audit business conservé)
//      - NewsletterSubscriber : suppression hard
//      - KnowledgeBookmark : suppression hard
//   6. ActivityLog `gdpr.erase.completed` (forensique) + alerte Telegram canal Will.
//
// **Important** : pas d'undo. Le token est consommé pour 1 erase ; au prochain
// export, l'email est anonymisé donc inacessible. Le contrat utilisateur
// implicite est explicité dans la confirmation UI (composant `/admin/rgpd/...`).
//
// Tables NON-touchées (legal hold) :
//   - generation_logs / cost_ledger / web_vital_samples / content_gen_jobs
//     (logs techniques sans PII visiteur — voir politique-confidentialite).
//   - ActivityLog : conservé (immuable, art. 30 RGPD register).
//     🔴 `D5-5-05` (2026-08-20) — cette affirmation était FAUSSE jusqu'à cette
//     date : `retention-purge-worker.ts` effaçait tout `activity_logs` de plus
//     de 12 mois, SANS filtre d'action, traces `gdpr.*` comprises. Deux textes
//     du dépôt se contredisaient, et c'est le silencieux qui gagnait. La purge
//     exclut désormais le préfixe `gdpr.` et lui applique la durée des pièces.

import { NextResponse, type NextRequest } from "next/server";
import { effacerCandidaturesPour } from "@/server/careers/candidature-rgpd";
import { effacerDemandesPodcastPour } from "@/features/podcast-request/rgpd";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyGdprToken } from "@/lib/gdpr-token";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { propagateGdprToCrm } from "@/server/crm-sync/gdpr";
import { checkRateLimit } from "@/lib/rate-limit";
import { eraseKbDataForEmail } from "@/lib/knowledge/rgpd-export";
import {
  eraseChatDataForEmail,
  eraseSignatureTokensForEmail,
  eraseEmailTracesForEmail,
  eraseNewsletterForEmail,
  eraseSubmissionsForEmail,
  eraseClientsForEmail,
  eraseDocumentRecipientsForEmail,
  eraseCoachingSignaturesForEmail,
  eraseCalendlyEventsForEmail,
} from "@/lib/rgpd-erase";
import { alertIncident } from "@/lib/telegram";
import { enqueueEmail } from "@/server/queue/queues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  token: z.string().min(20),
  confirm: z.literal("ERASE_MY_DATA"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const { email, token } = parsed.data;

  // Rate limit 1/jour/email — l'erase est one-shot
  const rl = await checkRateLimit(`gdpr:erase:${email}`, {
    limit: 1,
    windowSec: 86_400,
    surPanne: "refuser",
  });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const v = await verifyGdprToken(token);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.reason }, { status: 401 });
  }
  if (v.email !== email) {
    return NextResponse.json({ ok: false, error: "email_mismatch" }, { status: 401 });
  }

  // Données chatbot (chat_*) AVANT l'anonymisation des Submissions : le
  // rattachement conversation↔lead se fait par `contactEmail`, qui sera hashé
  // par eraseSubmissionsForEmail.
  const chatResult = await eraseChatDataForEmail(email);

  // Exécution des effacements
  const [
    submissionsResult,
    newsletterResult,
    kbResult,
    candidaturesResult,
    emailTracesResult,
    podcastResult,
    signatureTokensResult,
    clientsResult,
    destinatairesResult,
    signaturesCoachingResult,
    appelsResult,
  ] = await Promise.all([
    eraseSubmissionsForEmail(email),
    eraseNewsletterForEmail(email),
    eraseKbDataForEmail(email),
    // 🔴 `D5-5-03` (2026-08-20) — LES CANDIDATURES ÉTAIENT HORS DE PORTÉE.
    //
    // Ni exportées, ni effacées — alors qu'une candidature porte le **CV**, la
    // **photo** et le **téléphone**, c'est-à-dire les données les plus
    // sensibles que ce site détienne sur une personne. Et le courriel de
    // confirmation ÉNUMÉRAIT ce qui avait été effacé : une liste qui se donne
    // pour exhaustive et qui omet le CV est pire qu'une absence de liste.
    //
    // Le défaut était plus profond qu'un oubli de branchement : `email` est
    // chiffré avec un IV aléatoire, donc la candidature était INTROUVABLE par
    // son adresse. Cf. `careers/candidature-rgpd.ts`.
    effacerCandidaturesPour(email),
    // 🔴 `D5-5-01` (2026-08-24) — LES DEUX TABLES D'E-MAIL ÉTAIENT HORS DE PORTÉE.
    //
    // Exactement le défaut de `D5-5-03` ci-dessus, une table plus loin :
    // `email_logs.recipient` et `email_outbox.recipient` portent l'adresse EN
    // CLAIR, et `email_outbox.payload` la charge utile complète — nom, formation,
    // dates, liens personnels. Ni effacées, ni déclarées en exception : la
    // personne recevait « vos données identifiantes ont été effacées » pendant
    // qu'elles survivaient.
    //
    // Les deux ne se traitent pas pareil, et le détail est dans `rgpd-erase.ts` :
    // le journal est une PREUVE Qualiopi (art. 17(3)(b) et (e)) — on
    // pseudonymise l'adresse et on garde la ligne ; la corbeille ne prouve rien
    // — on supprime.
    eraseEmailTracesForEmail(email),
    // QUATRIEME occurrence de la meme faute (`D5-5-04`, 2026-08-24).
    //
    // `podcast_requests` n'etait NI effacee NI declaree en exception. La
    // personne y laisse, par un formulaire PUBLIC, son nom, son adresse, son
    // telephone, sa ville et sa description d'activite ; la reponse ci-dessous
    // lui affirmait que ses donnees identifiantes avaient ete effacees.
    //
    // Elle est la plus indefendable des quatre : les autres tables non
    // instruites concernent des signataires, des factures, des contacts
    // d'affaires -- des gens lies par un contrat. Ici, aucun contrat, aucune
    // piece comptable, aucune preuve Qualiopi. Rien a opposer a la demande.
    //
    // Et comme `D5-5-03`, le defaut etait double : `email` est chiffre a IV
    // aleatoire, donc la ligne etait INTROUVABLE par son adresse. Cf.
    // `features/podcast-request/rgpd.ts`.
    effacerDemandesPodcastPour(email),
    // Les JETONS d'invitation a signer -- PAS les signatures, qui sont
    // scellees dans un tuple hache et declarees en exception ci-dessous.
    // Revocation d'abord : un lien encore valide permettrait de signer au nom
    // d'une personne effacee, et de resceller son adresse dans une signature
    // neuve -- ce qui annulerait l'effacement qu'on vient de faire.
    eraseSignatureTokensForEmail(email),
    // ── LES TROIS DERNIERES TABLES « A INSTRUIRE » (2026-08-25) ──────────────
    //
    // Elles etaient nommees depuis le 2026-08-24 dans
    // `rgpd-aucune-table-n-echappe-en-silence.spec.ts`, chacune bloquee sur une
    // decision. La cle qui les a debloquees toutes les trois : cette route est
    // declenchee par une DEMANDE, pas par une purge periodique. Les blocages
    // ecrits (« aucune date de fin de relation, donc les 5 ans sont
    // incalculables ») ne s'opposaient qu'a une purge - or la purge a ete
    // ecartee par le proprietaire en connaissance de cause.
    //
    // Le detail de chaque arbitrage est au-dessus de son effaceur dans
    // `rgpd-erase.ts`. En resume : `Client` pseudonymise le CONTACT et retient
    // les fiches facturees (art. L.123-22 + art. 17(3)(b)) ; `DocumentRecipient`
    // pseudonymise SANS supprimer, pour ne pas emporter en cascade l'accuse de
    // telechargement qui vaut preuve de diffusion Qualiopi ;
    // `CoachingSeanceSignature` est pseudonymisee parce que sa chaine
    // d'empreintes n'est plus recalculee par personne.
    eraseClientsForEmail(email),
    eraseDocumentRecipientsForEmail(email),
    eraseCoachingSignaturesForEmail(email),
    eraseCalendlyEventsForEmail(email),
  ]);

  // ART. 17 BI-SYSTÈME (lot L4) — le CRM efface par `person_key` dans les deux
  // univers et inscrit l'empreinte en liste de suppression (ce qui empêche une
  // réinsertion par un futur import).
  //
  // 🔴 NON BLOQUANT, et calculé AVANT d'effacer localement l'adresse : une
  // personne qui exerce son droit à l'effacement doit l'obtenir sur le site,
  // que le second système réponde ou non. Lui renvoyer une erreur parce qu'un
  // CRM inerte n'a pas répondu serait une régression de droit.
  const crmResult = await propagateGdprToCrm({
    action: "erase",
    personKey: hashEmailForLookup(email) ?? "",
    email,
  });

  // Activity log RGPD : trace forensique immuable
  await prisma.activityLog.create({
    data: {
      adminUserId: null,
      action: "gdpr.erase.completed",
      targetType: "self_service",
      targetId: v.jti,
      changes: {
        // 🔴 `D5-5-05` (2026-08-20) — c'était `email`, EN CLAIR. Sur le journal
        // qui trace l'effacement de cette même personne, et que la purge
        // conserve désormais cinq ans. Conserver la preuve plus longtemps
        // n'avait de sens qu'à condition de ne pas conserver l'identifiant
        // avec : le hachage est déterministe, donc re-hacher l'adresse fournie
        // suffit à retrouver la trace le jour où quelqu'un conteste.
        emailHash: hashEmailForLookup(email),
        submissionsAnonymized: submissionsResult.anonymized,
        newsletterDeleted: newsletterResult.deleted,
        kbBookmarksDeleted: kbResult.bookmarksDeleted,
        chatConversationsDeleted: chatResult.conversationsDeleted,
        chatEscalationsAnonymized: chatResult.escalationsAnonymized,
        // Le compte rendu du volet CRM est TRACÉ : un effacement seulement
        // local doit se voir dans le journal, jamais se supposer.
        crmStatus: crmResult.status,
      },
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
    },
  });

  // ── Confirmation à la personne ───────────────────────────────────────────
  // 🔴 Ajouté le 2026-08-13. Jusque-là, l'effacement s'exécutait sans que la
  // personne en soit JAMAIS informée. Deux conséquences : aucune preuve de son
  // côté, et — puisque son adresse vient d'être anonymisée ci-dessus — plus
  // aucun moyen de la recontacter. L'omission était donc DÉFINITIVE.
  //
  // L'adresse ne survit plus que dans `email`, variable locale : la mettre en
  // file la copie dans la charge utile de la tâche, seul endroit où elle
  // persistera. C'est aussi pourquoi l'envoi est mis en file ICI et non
  // ailleurs — le déplacer après une future étape d'effacement le casserait.
  //
  // Meilleur effort : l'effacement est fait et acté. Un échec d'envoi ne doit
  // pas transformer une réussite en erreur 500 côté visiteur.
  try {
    await enqueueEmail("rgpd-effacement-confirme", email, "fr", {
      effectueLe: new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      demandes: submissionsResult.anonymized,
      newsletter: newsletterResult.deleted,
      conversations: chatResult.conversationsDeleted,
      // 🔴 `D5-5-03` — la candidature ENTRE dans l'énumération. Le courriel
      // dressait la liste de ce qui avait été effacé sans jamais mentionner le
      // CV : la personne pouvait croire son dossier parti alors qu'il restait
      // en base, avec sa photo et son numéro.
      candidatures: candidaturesResult.supprimees,
      // `D5-5-04` — meme raison que la ligne au-dessus, une table plus loin.
      // Une liste qui se donne pour exhaustive et qui omet la demande de
      // podcast est, selon les termes de ce depot, pire qu'une absence de liste.
      podcast: podcastResult.supprimees,
      // 2026-08-25 — les trois dernieres tables de l'inventaire entrent dans
      // l'enumeration. `clientsRetenus` est annonce SEPAREMENT et a dessein :
      // une reponse qui dirait « tout est efface » alors qu'une fiche facturee
      // survit serait exactement le defaut que cette famille de correctifs
      // corrige depuis quatre occurrences. On declare la retention, on ne la
      // tait pas.
      fichesClient: clientsResult.anonymises,
      fichesClientRetenues: clientsResult.retenusObligationComptable,
      destinatairesDocuments: destinatairesResult.anonymises,
      // 2026-08-28 — même motif que les deux blocs ci-dessus, une table plus
      // loin. Une réservation d'appel porte le nom, l'adresse, le TÉLÉPHONE, les
      // réponses libres du formulaire, et les liens qui permettent d'annuler le
      // rendez-vous sans authentification. Elle n'était dans aucun des trois
      // mécanismes RGPD, et cette énumération ne la mentionnait pas.
      appels: appelsResult.anonymized,
    });
  } catch (err) {
    console.error("[gdpr-erase] confirmation impossible à mettre en file :", err);
  }

  // Telegram alert (DPO doit savoir — art. 30 RGPD register update)
  try {
    await alertIncident(
      `🗑️ RGPD art. 17 effacement effectué : ${submissionsResult.anonymized} submissions anonymisées, ${newsletterResult.deleted} newsletter, ${kbResult.bookmarksDeleted} KB bookmarks, ${chatResult.conversationsDeleted} conversations chatbot supprimées, ${chatResult.escalationsAnonymized} escalades anonymisées, ${clientsResult.anonymises} fiches client pseudonymisées (${clientsResult.retenusObligationComptable} RETENUES au titre de l'obligation comptable), ${destinatairesResult.anonymises} destinataires de documents, ${signaturesCoachingResult.anonymises} signatures de coaching.`,
      { userId: v.jti },
    );
  } catch {
    // Telegram alert non-bloquant
  }

  return NextResponse.json({
    ok: true,
    erasedAt: new Date().toISOString(),
    summary: {
      submissionsAnonymized: submissionsResult.anonymized,
      newsletterDeleted: newsletterResult.deleted,
      kbBookmarksDeleted: kbResult.bookmarksDeleted,
      chatConversationsDeleted: chatResult.conversationsDeleted,
      chatEscalationsAnonymized: chatResult.escalationsAnonymized,
      emailLogsPseudonymises: emailTracesResult.logsPseudonymises,
      emailOutboxSupprimes: emailTracesResult.outboxSupprimes,
      podcastSupprimes: podcastResult.supprimees,
      jetonsSignatureRevoques: signatureTokensResult.revoques,
      jetonsSignaturePseudonymises: signatureTokensResult.pseudonymises,
      // Le repli dechiffrant est BORNE, ici comme pour les candidatures. S'il a
      // mordu son plafond, des lignes anciennes peuvent subsister -- et la
      // personne doit l'apprendre ici, pas le decouvrir plus tard. Un
      // effacement tronque qui se presente comme complet est pire qu'un
      // effacement refuse.
      ...(podcastResult.tronque || candidaturesResult.tronque
        ? {
            avertissement:
              "La recherche des enregistrements anciens a atteint sa limite d'examen : " +
              "certains peuvent subsister. Ecrivez a contact@axion-ia.com pour une " +
              "verification manuelle.",
          }
        : {}),
      /** `ok` | `deferred` | `failed` — cf. `notice.retentionExceptions`. */
      crm: crmResult.status,
    },
    notice: {
      explanation:
        "Vos données identifiantes ont été effacées ou anonymisées. Les lignes business (factures, audit comptable) sont conservées sous forme anonymisée conformément à l'art. 30 RGPD (legal hold).",
      retentionExceptions: [
        "Submissions : anonymisées in-place (audit business + facturation préservés sans PII).",
        "ActivityLog : conservé (immuable, art. 30 RGPD register).",
        "generation_logs / cost_ledger / web_vital_samples : logs techniques sans PII visiteur (purgés par retention-purge-worker).",
        // Conservé au titre de l'art. 17(3)(e) : c'est la preuve exigée par
        // l'art. 7(1). L'effacer reviendrait à détruire la démonstration que le
        // traitement passé était licite — y compris celui qu'on vient d'effacer.
        // Le registre ne contient AUCUNE adresse en clair, seulement une
        // empreinte : il ne permet pas de retrouver la personne.
        "consent_events : registre de preuve des consentements, conservé sous forme d'empreinte (art. 7(1) et 17(3)(e) RGPD).",
        // ⚠️ DÉCLARÉE, et pas seulement appliquée. Une exception de rétention
        // qu'on pratique sans la dire est indiscernable d'un oubli — et c'est
        // précisément sous cette forme que le défaut a vécu.
        "email_logs : l'adresse est PSEUDONYMISÉE, la ligne conservée. C'est la preuve que vous avez été informé (convocation, convention, attestation), exigée par la certification Qualiopi et couverte par l'art. 17(3)(b) et (e) RGPD. Elle ne permet plus de vous identifier.",
        "email_outbox : SUPPRIMÉ intégralement — messages non envoyés, charge utile comprise. Aucune base légale ne justifie de les conserver.",
        "podcast_requests : SUPPRIMÉ intégralement (nom, adresse, téléphone, ville, activité). Aucun contrat, aucune obligation comptable : rien ne justifiait de les conserver.",
        "booking_options : SUPPRIMÉ intégralement. Une option de réservation non confirmée ne fonde aucune obligation.",
        "document_signature_tokens : liens de signature RÉVOQUÉS puis adresse pseudonymisée. Le jeton est un artefact d'envoi, pas une preuve.",
        // ⚠️ LES QUATRE EXCEPTIONS CI-DESSOUS ÉTAIENT PRATIQUÉES SANS ÊTRE DITES.
        // Aucune n'était fausse ; aucune n'était déclarée. Or une exception de
        // rétention qu'on applique en silence est indiscernable d'un oubli —
        // c'est mot pour mot sous cette forme qu'ont vécu les quatre défauts
        // `D5-5-01` à `D5-5-04`. Les écrire ici, c'est les rendre contestables
        // par la personne, ce qui est le but de l'art. 17(3).
        "emargement_signatures : l'adresse du signataire est CONSERVÉE. Elle entre dans le tuple scellé qui prouve l'assiduité (art. 17(3)(b) et (e) RGPD, indicateur 12 Qualiopi) : l'effacer rendrait « pièces modifiées après coup » sur des feuilles intactes. L'IMAGE du tracé, elle, est purgée.",
        "document_signatures : idem — l'identité du signataire est scellée dans l'empreinte de la pièce (art. 1366 du code civil, art. 17(3)(e) RGPD). Seule l'image de la signature est purgeable.",
        "factures : les pièces comptables et leurs destinataires sont conservés au titre de l'art. 17(3)(b) RGPD — obligation de conservation des documents comptables.",
        "sous_traitants : le dossier du signataire d'un contrat de sous-traitance est conservé au titre de l'art. 17(3)(b) — pièces exigées par la certification Qualiopi (indicateur 27) — et 17(3)(e), la qualité du signataire portant l'opposabilité de son pouvoir de signer.",
      ],
      contactDpo: "contact@axion-ia.com",
    },
  });
}
