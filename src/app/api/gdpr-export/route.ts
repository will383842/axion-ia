// API /api/gdpr-export — RGPD self-service export (Sprint 24 / D2 + audit B5 2026-05-15).
//
// POST { email, token } : valide token signé HMAC-SHA256 (lib gdpr-token),
// vérifie que l'email du token = l'email du body (anti-replay), rate-limit
// 3/jour/email, retourne JSON avec :
//   - submissions: tous les Submission où contactEmail = email
//   - newsletter: ligne NewsletterSubscriber si elle existe
//   - bookings: les Booking liés via Submission (interventions ferme + cancelled)
//
// **Tables explicitement EXCLUES de l'export (logs techniques RGPD art. 23) :**
//   - generation_logs : audit trail content-gen (provider, model, tokens).
//     Lié à un `job_id` éditorial, jamais à un email visiteur. PII visiteur
//     impossible : les prompts content-gen sont éditoriaux (titres,
//     intent SEO, ville) et passent par le helper `pii-safe` côté Telegram.
//     Cf. politique-confidentialite § « IA générative et transparence ».
//   - cost_ledger : montants USD provider IA + tokens. Aucune PII.
//   - web_vital_samples : RUM agrégé, sessionId anonyme client.
//   - content_gen_jobs : pipeline interne, lié à templates éditoriaux.
//
// Ces tables sont purgées automatiquement par `retention-purge-worker.ts`
// (durées dans `_AUDIT/DPA-REGISTER.md` + politique-confidentialite).
//
// Le token est obtenu via POST /api/gdpr-export/request {email} qui envoie
// le lien par email (cf. request/route.ts).

import { NextResponse, type NextRequest } from "next/server";
import { exporterCandidaturesPour } from "@/server/careers/candidature-rgpd";
import { trouverDemandesPodcast } from "@/features/podcast-request/rgpd";
import { decryptPiiObject } from "@/lib/pii-crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { extractAnswersText } from "@/server/calendly/api";
import { verifyGdprToken } from "@/lib/gdpr-token";
import { propagateGdprToCrm } from "@/server/crm-sync/gdpr";
import { checkRateLimit } from "@/lib/rate-limit";
import { exportKbDataForEmail } from "@/lib/knowledge/rgpd-export";
import { exportChatDataForEmail } from "@/lib/rgpd-export-chat";
import { hashEmailForLookup } from "@/lib/security/email-hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  token: z.string().min(20),
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

  // Rate limit 3/jour/email pour empêcher abus token re-use
  const rl = await checkRateLimit(`gdpr:export:${email}`, {
    limit: 3,
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

  // 🔴 On interroge l'EMPREINTE, jamais `contactEmail`. Cette colonne est
  // chiffrée avec un IV aléatoire : l'égalité SQL qui se trouvait ici ne
  // pouvait JAMAIS correspondre, et l'export art. 15 renvoyait donc une liste
  // VIDE présentée comme complète. Le repli sur `contactEmail` couvre les
  // lignes stockées en clair et celles antérieures au remplissage rétroactif.
  const lookupHash = hashEmailForLookup(email);
  const submissions = await prisma.submission.findMany({
    where: {
      OR: [...(lookupHash ? [{ contactEmailHash: lookupHash }] : []), { contactEmail: email }],
    },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      type: true,
      status: true,
      locale: true,
      companyName: true,
      sector: true,
      contactName: true,
      contactRole: true,
      contactEmail: true,
      contactPhone: true,
      employeesCount: true,
      address: true,
      details: true,
      submittedAt: true,
    },
  });

  // 🔴 `D5-5-02` (2026-08-24) — LES MESSAGES QU'ON VOUS A ENVOYÉS SONT VOS DONNÉES.
  //
  // `email_logs` et `email_outbox` n'étaient ni exportés, ni déclarés dans
  // `excludedTables` — une liste qui se présente pourtant comme la liste
  // exhaustive de ce qui manque. C'est le défaut que le commentaire de `crm`,
  // vingt lignes plus bas, nomme lui-même : « on ne présente JAMAIS un export
  // amputé comme complet ».
  //
  // On exporte le QUOI et le QUAND, pas le corps du message : un envoi groupé
  // peut nommer d'autres personnes, et le corps se reconstitue de toute façon à
  // partir du gabarit. Ce que l'art. 15 doit rendre est « quels messages
  // m'avez-vous adressés, quand, et sont-ils arrivés ».
  const [emailsEnvoyes, emailsEnAttente] = await Promise.all([
    prisma.emailLog.findMany({
      where: { recipient: email },
      select: {
        template: true,
        locale: true,
        status: true,
        sentAt: true,
        failedAt: true,
        bounceType: true,
        bouncedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.emailOutbox.findMany({
      where: { recipient: email },
      select: {
        template: true,
        sujet: true,
        statut: true,
        approuveAt: true,
        refuseAt: true,
        envoyeAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const newsletter = await prisma.newsletterSubscriber.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      locale: true,
      status: true,
      source: true,
      confirmedAt: true,
      unsubscribedAt: true,
      createdAt: true,
    },
  });

  // 🔴 `D5-5-03` (2026-08-20) — LES CANDIDATURES ÉTAIENT ABSENTES DE L'EXPORT.
  //
  // Même cause que pour l'effacement : `JobApplication.email` est chiffré avec
  // un IV aléatoire, donc la candidature était INTROUVABLE par son adresse.
  // Elle porte pourtant le CV, la photo et le téléphone — les données les plus
  // sensibles que ce site détienne sur une personne.
  //
  // Le `notice.excludedTables` plus bas énumère ce qui est volontairement hors
  // export, et les candidatures n'y figuraient pas : elles n'étaient donc ni
  // incluses, ni déclarées exclues. Un export qui omet sans le dire se présente
  // comme complet.
  const candidatures = await exporterCandidaturesPour(email);
  // `D5-5-04` — les demandes de podcast manquaient AUX DEUX droits, comme les
  // candidatures avant elles. Un export qui omet une table que le site detient
  // n'est pas un export partiel : c'est une reponse fausse a l'art. 15.
  const podcast = await trouverDemandesPodcast(email);

  // Sprint Correctif S+1 (P0-S1-2) : KB data RGPD art. 15 (bookmarks).
  const kb = await exportKbDataForEmail(email);

  // Données chatbot RGPD art. 15 (T-23) : conversations + messages + escalades.
  const chat = await exportChatDataForEmail(email);

  // Registre de consentements (lot L4) — la PREUVE de ce que la personne a
  // accepté, et quand. Elle fait partie de « toutes les données la concernant ».
  const consentEvents = lookupHash
    ? await prisma.consentEvent.findMany({
        where: { personKey: lookupHash },
        orderBy: { occurredAt: "desc" },
        select: {
          formRef: true,
          consentVersion: true,
          action: true,
          occurredAt: true,
        },
      })
    : [];

  // ART. 15 BI-SYSTÈME (lot L4) — le CRM détient peut-être aussi des données.
  // NON BLOQUANT : s'il ne répond pas, l'export local part quand même. Rendre
  // une réponse partielle vaut infiniment mieux que rendre une erreur.
  const crm = await propagateGdprToCrm({ action: "export", personKey: lookupHash ?? "", email });

  // Activity log RGPD : tracé de l'export self-service
  await prisma.activityLog.create({
    data: {
      adminUserId: null,
      action: "gdpr.export.delivered",
      targetType: "self_service",
      targetId: v.jti,
      changes: {
        // 🔴 `D5-5-05` — même correctif que sur l'effacement : l'adresse en
        // clair a disparu du journal, qui est désormais conservé cinq ans.
        // `lookupHash` est déjà calculé plus haut pour la recherche.
        emailHash: lookupHash,
        submissionsCount: submissions.length,
        newsletterPresent: !!newsletter,
        kbBookmarksCount: kb.bookmarks.length,
        chatConversationsCount: chat.conversations.length,
        chatEscalationsCount: chat.escalations.length,
        consentEventsCount: consentEvents.length,
        crmStatus: crm.status,
      },
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
    },
  });

  // 🔴 `D5-5-02` (2026-08-20) — L'EXPORT ART. 15 RENDAIT DU CHIFFRÉ.
  //
  // `contactName`, `contactEmail` et `contactPhone` reçoivent des valeurs
  // CHIFFRÉES (`enc:v1:iv:ct:tag`, AES-256-GCM) dès que `PII_ENCRYPTION_KEY` est
  // active — le schéma Prisma le dit en toutes lettres. Elles partaient telles
  // quelles dans la réponse.
  //
  // La personne qui exerce son droit d'accès recevait donc, à la place de son
  // nom et de son adresse, une centaine de caractères de charabia. Un export
  // illisible n'est pas un export : l'art. 15 exige une communication
  // « sous une forme concise, transparente, compréhensible » (art. 12.1).
  //
  // 🔑 `decryptPiiObject` existait dans `lib/pii-crypto.ts` — écrit pour
  // exactement ce cas, et utilisé par PERSONNE. C'est le même motif que le
  // webhook de rebonds : la solution était écrite, jamais branchée.
  //
  // ⚠️ `decryptPii` est TOLÉRANT : une valeur sans le préfixe `enc:v1:` est
  // rendue telle quelle. Les enregistrements antérieurs au chiffrement passent
  // donc sans dommage — c'est ce qui permet de brancher la fonction sans
  // migration de données.
  const submissionsLisibles = submissions.map((s) => decryptPiiObject(s));

  // `inviteeEmail` est en `@db.Citext` et indexé : la recherche est directe et
  // insensible à la casse, contrairement aux candidatures dont l'adresse est
  // chiffrée avec un IV aléatoire et exige un balayage déchiffrant borné. Aucun
  // plafond ici, donc aucun avertissement de troncature à émettre.
  /**
   * 🔴 ON NE CHERCHE **PAS** L'ADRESSE DANS LA CHARGE BRUTE. Révoqué le
   * 2026-08-31, le jour même où ce chemin avait été élargi — voir le bloc
   * jumeau dans `src/lib/rgpd-erase.ts`, les deux vont ensemble.
   *
   * L'élargissement visait une réservation non enrichie dont la colonne serait
   * nulle pendant que le JSON porterait l'adresse : **0 ligne sur 18** en
   * production, et le cas est structurellement impossible (une capture
   * navigateur ne transporte que deux URI, une ligne enrichie a sa colonne
   * remplie).
   *
   * ⚠️ Ce qu'il ouvrait était réel : `rawPayload` contient `event_guests`. Un
   * invité ajouté par le prospect s'authentifie légitimement — le jeton part à
   * SA propre adresse — et obtenait la fiche complète du prospect : nom,
   * téléphone, notes internes écrites sur lui, et surtout `cancelUrl` /
   * `rescheduleUrl`, des URL-capacités qui annulent le rendez-vous d'autrui
   * **sans aucune authentification**.
   *
   * 🔑 `inviteeEmail` désigne le TITULAIRE, jamais ses invités. Verrou :
   * `src/lib/__tests__/un-invite-ne-voit-pas-la-fiche-du-prospect.spec.ts`.
   */
  const rendezVous = await prisma.calendlyEvent
    .findMany({
      where: { inviteeEmail: email },
      orderBy: { capturedAt: "desc" },
      select: {
        eventTypeName: true,
        status: true,
        startTime: true,
        endTime: true,
        timezone: true,
        inviteeName: true,
        inviteeEmail: true,
        inviteePhone: true,
        location: true,
        capturedAt: true,
        cancelUrl: true,
        rescheduleUrl: true,
        pageUrl: true,
        // ── Ajoutés le 2026-08-31 ────────────────────────────────────────
        // Ces champs étaient tus alors que la notice d'exclusions plus bas
        // n'en déclarait aucun : l'export se donnait pour « complet sauf la
        // liste ci-dessous » avec une liste incomplète. `notes` est une
        // appréciation écrite SUR la personne : l'article 15 y donne accès,
        // et c'est précisément le genre de champ qu'on n'a pas le droit
        // d'omettre en silence.
        notes: true,
        referrer: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        source: true,
        // Les réponses libres au formulaire ne vivent QUE là — aucune colonne
        // ne les porte. Les omettre reviendrait à taire ce que la personne a
        // elle-même écrit.
        rawPayload: true,
      },
    })
    .catch(() => []);

  return NextResponse.json({
    ok: true,
    exportedAt: new Date().toISOString(),
    email,
    submissions: submissionsLisibles,
    newsletter,
    kb,
    chat,
    consentEvents,
    /** Messages qui vous ont été adressés : quoi, quand, et s'ils sont arrivés. */
    emailsEnvoyes,
    /** Messages vous concernant en attente d'envoi ou de validation interne. */
    emailsEnAttente,
    candidatures: candidatures.candidatures,
    /** Demandes de tournage de podcast deposees via le formulaire public. */
    podcast: podcast.demandes,
    /**
     * Rendez-vous réservés depuis /appel.
     *
     * 🔴 ABSENTS DE CET EXPORT JUSQU'AU 2026-08-28 — et c'est ce qui rendait
     * l'omission fautive plutôt que distraite : la notice ci-dessous ÉNUMÈRE ses
     * exclusions, toutes présentées comme dépourvues de PII visiteur. Cette
     * table n'était ni dans les données rendues, ni dans la liste des
     * exclusions. La personne recevait donc un export qui se donne pour
     * « complet sauf cette liste », avec une liste incomplète.
     *
     * `rawPayload` est volontairement écarté : il contient la charge Calendly
     * brute, dont les réponses libres sont déjà restituées par `reponses`, et il
     * porte des clés techniques internes. `cancelUrl` et `rescheduleUrl` SONT
     * restituées — ce sont les liens de la personne, elle a le droit de les
     * avoir.
     */
    rendezVous: rendezVous.map((r) => ({
      type: r.eventTypeName,
      statut: r.status,
      debut: r.startTime,
      fin: r.endTime,
      fuseau: r.timezone,
      nom: r.inviteeName,
      email: r.inviteeEmail,
      telephone: r.inviteePhone,
      lieu: r.location,
      reserveLe: r.capturedAt,
      lienAnnulation: r.cancelUrl,
      lienReport: r.rescheduleUrl,
      pageOrigine: r.pageUrl,
      // Ajoutés le 2026-08-31 : sélectionnés en base mais jamais rendus, ils
      // étaient invisibles à l'export sans figurer dans les exclusions.
      notesInternes: r.notes,
      siteReferent: r.referrer,
      origineCampagne:
        [r.utmSource, r.utmMedium, r.utmCampaign].filter(Boolean).join(" / ") || null,
      canalDeCapture: r.source,
      // Restituées avec la MÊME fonction que celle qui les envoie dans l'alerte
      // interne — importée, jamais recopiée : la personne reçoit exactement ce
      // que nous lisons d'elle. Le filtre « question de téléphone » de cette
      // fonction ne retire rien ici : le numéro est déjà rendu ci-dessus.
      reponses: extractAnswersText(
        (r.rawPayload as { invitee?: { questions_and_answers?: unknown } } | null)?.invitee
          ?.questions_and_answers,
      ),
    })),
    ...(podcast.tronque
      ? {
          podcastAvertissement:
            "La recherche des demandes de podcast anciennes a atteint sa limite d'examen : cette liste peut être incomplète. Écrivez à contact@axion-ia.com pour une vérification manuelle.",
        }
      : {}),
    // ⚠️ Une recherche TRONQUÉE qui se présente comme complète est pire qu'une
    // recherche refusée. Le repli déchiffrant est borné : s'il a mordu son
    // plafond, la personne doit le savoir.
    ...(candidatures.tronque
      ? {
          candidaturesAvertissement:
            "La recherche des candidatures anciennes a atteint sa limite d'examen : cette liste peut être incomplète. Écrivez à contact@axion-ia.com pour une vérification manuelle.",
        }
      : {}),
    // Volet CRM : soit son contenu (`status: "ok"`), soit la raison honnête
    // pour laquelle il est absent. On ne présente JAMAIS un export amputé comme
    // complet — c'est exactement le défaut qui rendait l'art. 15 muet avant.
    crm,
    notice: {
      excludedTables: [
        "generation_logs (audit trail technique content-gen, sans PII visiteur)",
        "cost_ledger (montants USD provider IA, sans PII)",
        "web_vital_samples (RUM agrégé, sessionId client anonyme)",
        "content_gen_jobs (pipeline interne éditorial)",
        // ⚠️ Le CORPS des messages, et lui seul. Les métadonnées d'envoi sont
        // exportées ci-dessus (`emailsEnvoyes`, `emailsEnAttente`) : les omettre
        // sans le dire était le défaut `D5-5-02`.
        "email_outbox.payload (corps du message : un envoi groupé peut nommer d'autres personnes ; le contenu se reconstitue depuis le gabarit, disponible sur demande)",
        // ⚠️ Déclaré, parce que la charge brute EST écartée alors que la ligne,
        // elle, est exportée ci-dessus. Taire une exclusion partielle sur une
        // table présente serait exactement le défaut que cette notice existe
        // pour éviter.
        "calendly_events.raw_payload (charge technique renvoyée par Calendly : les réponses au formulaire y figurent, et elles sont restituées ci-dessus sous forme lisible)",
      ],
      excludedReason:
        "Logs techniques RGPD art. 23 — voir politique-confidentialite § IA générative et transparence. Purgés automatiquement (cf. retention-purge-worker).",
      contactDpo: "contact@axion-ia.com",
    },
  });
}
