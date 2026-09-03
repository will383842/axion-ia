// @ts-check
/**
 * SONDE — `invitee.text_reminder_number` est-il RÉELLEMENT accepté par Calendly ?
 *
 * ## Pourquoi une sonde, et pas un test
 *
 * Depuis le 2026-09-03, le formulaire de réservation exige un numéro dans les
 * deux formats. Pour une visio, il ne voyage QUE par ce champ :
 * `location.location` n'existe que pour `outbound_call`, et
 * `api.ts::extractPhone` ne lit que ce que Calendly rend. Si le champ n'est pas
 * pris en compte, le numéro est saisi, posté, puis jeté — et personne ne
 * l'apprend avant un rendez-vous manqué.
 *
 * Or ce champ n'a PAS été mesuré, contrairement à `location.kind` et
 * `tracking`, éprouvés en phase 0 par deux réservations réelles. Et une mesure
 * ne se remplace pas par une lecture de documentation : ce module porte déjà,
 * noir sur blanc, le constat que **l'API ne dit pas non quand elle ne comprend
 * pas** — un champ inconnu est ignoré EN SILENCE. Un `201` ne prouve donc rien
 * du tout. La seule preuve est de RELIRE l'invité créé.
 *
 * ## Ce que la sonde fait, dans l'ordre
 *
 * 1. `GET /users/me` — qui sommes-nous.
 * 2. `GET /event_types` — retrouve l'event-type de `/appel` par son URL publique.
 * 3. `GET /event_type_available_times` — prend le créneau le PLUS LOINTAIN de la
 *    fenêtre : celui qu'un vrai prospect a le moins de chances de vouloir
 *    pendant les trente secondes que dure la sonde.
 * 4. `POST /invitees` — une visio, avec `text_reminder_number`.
 * 5. `GET /scheduled_events/{uuid}/invitees` — **la mesure**. Le numéro est-il
 *    rendu ? C'est exactement ce que lira `extractPhone` en production.
 * 6. `POST /scheduled_events/{uuid}/cancellation` — dans un `finally`, toujours.
 *
 * ## 🔴 CETTE SONDE CRÉE UNE VRAIE RÉSERVATION
 *
 * Sur l'agenda réel, avec le webhook de production qui va se déclencher. Elle
 * l'annule dans la foulée, et l'annulation est dans un `finally` : une panne au
 * milieu ne doit jamais laisser un rendez-vous fantôme. Si l'annulation échoue
 * elle-même, la sonde le CRIE avec l'URI à annuler à la main.
 *
 * Le jeton ne sort jamais des secrets GitHub et n'est jamais journalisé.
 *
 * Usage (workflow_dispatch uniquement) :
 *   CALENDLY_API_TOKEN=… SONDE_EMAIL=contact@axion-ia.com node scripts/calendly-sonde-text-reminder.mjs
 */

const API = "https://api.calendly.com";
const TOKEN = (process.env.CALENDLY_API_TOKEN ?? "").trim();
const EMAIL = (process.env.SONDE_EMAIL ?? "").trim();
const URL_PUBLIQUE = (process.env.CALENDLY_APPEL_URL ?? "").trim();
const NUMERO = "+33 6 00 00 00 01";

if (!TOKEN) {
  console.error("CALENDLY_API_TOKEN absent — la sonde ne peut rien mesurer.");
  process.exit(1);
}
if (!EMAIL) {
  console.error("SONDE_EMAIL absent — refus de deviner une adresse d'invité.");
  process.exit(1);
}

/** Un appel API qui ne journalise JAMAIS l'en-tête d'autorisation. */
async function appel(chemin, init = {}) {
  const url = chemin.startsWith("http") ? chemin : `${API}${chemin}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  let corps = null;
  try {
    corps = await res.json();
  } catch {
    corps = null;
  }
  return { status: res.status, corps };
}

function titre(t) {
  console.log(`\n${"=".repeat(72)}\n${t}\n${"=".repeat(72)}`);
}

/**
 * 🔍 MODE LECTURE — l'état RÉEL d'un événement, sans rien créer.
 *
 * Ajouté le 2026-09-03 : après le test de bout en bout, deux surfaces se
 * contredisaient sur le sort du rendez-vous de sonde. La page `/appel` le
 * disait libre (sa liste de créneaux vient d'un cache de quinze minutes) et la
 * page de confirmation le disait réservé. Aucune des deux ne fait autorité —
 * seul Calendly la fait, et personne ne le lui avait demandé.
 *
 * ⚠️ Et un point qui compte pour l'agenda : supprimer l'événement dans Google
 * Calendar N'ANNULE PAS la réservation chez Calendly. Le créneau resterait
 * bloqué pour un vrai prospect, sans que rien ne le signale.
 */
const LIRE_EVENT_TYPE = (process.env.SONDE_EVENT_TYPE ?? "").trim() === "true";
const EVENT_A_LIRE = (process.env.SONDE_EVENT_URI ?? "").trim();
const ANNULER = (process.env.SONDE_ANNULER ?? "").trim() === "true";

if (LIRE_EVENT_TYPE) {
  // 🔍 MODE EVENT-TYPE — les questions RÉELLEMENT posées par Calendly.
  //
  // `questions.ts` en masque certaines côté site (`QUESTIONS_MASQUEES`). Leur
  // absence du formulaire ne prouve donc RIEN sur ce que Calendly demande
  // encore : elles restent dans LEUR formulaire de repli, celui vers lequel on
  // bascule quand notre réservation directe échoue. Pour savoir si un réglage
  // a été fait dans leur interface, il faut le leur demander.
  titre("LECTURE DE L'EVENT-TYPE — les questions posées par Calendly");
  const moi = await appel("/users/me");
  const ets = await appel(
    `/event_types?user=${encodeURIComponent(moi.corps?.resource?.uri ?? "")}&count=100`,
  );
  const et = (ets.corps?.collection ?? []).find(
    (e) => (e?.scheduling_url ?? "").replace(/\/$/, "") === URL_PUBLIQUE.replace(/\/$/, ""),
  );
  if (!et) {
    console.error("✗ event-type introuvable pour", URL_PUBLIQUE);
    process.exit(1);
  }
  console.log(`event-type : ${et.name} (${et.duration} min) — actif : ${et.active}`);
  const qs = et.custom_questions ?? [];
  console.log(`\n${qs.length} question(s) posée(s) par Calendly :`);
  for (const q of qs) {
    const etat = q.enabled === false ? "DÉSACTIVÉE" : "activée";
    const obl = q.required ? "OBLIGATOIRE" : "facultative";
    console.log(`  [${q.position}] « ${q.name} » — ${q.type}, ${obl}, ${etat}`);
    if (Array.isArray(q.answer_choices) && q.answer_choices.length > 0) {
      console.log(`        choix : ${q.answer_choices.join(" | ")}`);
    }
  }

  titre("VERDICT");
  const ville = qs.find((q) => /ville/i.test(q?.name ?? "") && q?.enabled !== false);
  if (ville) {
    console.log(`🔴 « ${ville.name} » est TOUJOURS posée par Calendly.`);
    console.log("   Le site la masque, mais elle reste dans LEUR formulaire de repli");
    console.log("   et dans leurs e-mails. Le réglage est à faire dans Calendly.");
  } else {
    console.log("✅ Aucune question « ville » active — le réglage a bien été fait.");
  }
  process.exit(0);
}

if (EVENT_A_LIRE) {
  const uri = EVENT_A_LIRE.startsWith("http")
    ? EVENT_A_LIRE
    : `${API}/scheduled_events/${EVENT_A_LIRE}`;
  titre(`LECTURE — ${uri}`);
  const ev = await appel(uri);
  console.log(`→ HTTP ${ev.status}`);
  const r = ev.corps?.resource ?? null;
  console.log(
    JSON.stringify(
      r && {
        status: r.status,
        start_time: r.start_time,
        name: r.name,
        location: r.location,
        cancellation: r.cancellation ?? null,
        // 🔴 LA PREUVE QUE CALENDLY A POUSSÉ (OU NON) VERS UN AGENDA GOOGLE.
        // Ajouté le 2026-09-03 : un rendez-vous de test n'est apparu ni sur
        // l'iPhone de Will ni dans son Google Agenda. `calendar_event` dit si
        // Calendly a créé l'événement côté Google et sous quel identifiant —
        // c'est ce qui distingue « Calendly n'a rien poussé » de « poussé sur
        // un agenda que Will n'affiche pas ». Sans ce champ, on ne peut que
        // supposer.
        calendar_event: r.calendar_event ?? null,
        event_memberships: r.event_memberships ?? null,
        event_guests: r.event_guests ?? null,
      },
      null,
      2,
    ),
  );

  const inv = await appel(`${uri}/invitees`);
  const premier = inv.corps?.collection?.[0] ?? null;
  console.log("\ninvité :");
  console.log(
    JSON.stringify(
      premier && {
        name: premier.name,
        email: premier.email,
        status: premier.status,
        text_reminder_number: premier.text_reminder_number ?? null,
        cancel_url: premier.cancel_url,
      },
      null,
      2,
    ),
  );

  titre("VERDICT");
  if (r?.status === "active") {
    console.log("🔴 L'ÉVÉNEMENT EST TOUJOURS ACTIF CHEZ CALENDLY.");
    console.log("   Le créneau reste bloqué pour un vrai prospect.");
    if (ANNULER) {
      const a = await appel(`${uri}/cancellation`, { method: "POST", body: "{}" });
      console.log(
        a.status === 201
          ? "\n✓ ANNULÉ à l'instant."
          : `\n🔴 annulation refusée (HTTP ${a.status}) : ${JSON.stringify(a.corps)}`,
      );
      if (a.status !== 201) process.exitCode = 1;
    } else {
      console.log("   (relancer avec annuler=true pour le supprimer)");
    }
  } else if (r?.status === "canceled") {
    console.log("✅ Déjà annulé chez Calendly — le créneau est rendu.");
    console.log(`   annulé par : ${r?.cancellation?.canceler_type ?? "?"}`);
  } else {
    console.log(`⚠️ Statut inattendu : ${r?.status ?? "(illisible)"}`);
  }
  process.exit(process.exitCode ?? 0);
}

let eventUri = null;

try {
  // ── 1. Qui sommes-nous ──────────────────────────────────────────────────
  titre("1. GET /users/me");
  const moi = await appel("/users/me");
  if (moi.status !== 200) {
    console.error(`✗ ${moi.status} — le jeton ne lit même pas le compte.`);
    console.error(JSON.stringify(moi.corps, null, 2));
    process.exit(1);
  }
  const userUri = moi.corps?.resource?.uri;
  console.log(`✓ utilisateur : ${moi.corps?.resource?.name ?? "?"}`);

  // ── 2. L'event-type de /appel ───────────────────────────────────────────
  titre("2. GET /event_types — retrouver l'event-type de /appel");
  const ets = await appel(`/event_types?user=${encodeURIComponent(userUri)}&count=100`);
  if (ets.status !== 200) {
    console.error(`✗ ${ets.status}`);
    console.error(JSON.stringify(ets.corps, null, 2));
    process.exit(1);
  }
  const collection = ets.corps?.collection ?? [];
  // On apparie sur l'URL publique configurée, jamais sur un nom : un nom se
  // change dans l'interface Calendly sans que personne ne prévienne le dépôt.
  const cible = URL_PUBLIQUE
    ? collection.find(
        (e) => (e?.scheduling_url ?? "").replace(/\/$/, "") === URL_PUBLIQUE.replace(/\/$/, ""),
      )
    : null;
  const et = cible ?? collection.find((e) => e?.active === true);
  if (!et) {
    console.error("✗ aucun event-type actif trouvé.");
    console.error(collection.map((e) => `  - ${e?.name} → ${e?.scheduling_url}`).join("\n"));
    process.exit(1);
  }
  console.log(`✓ event-type : ${et.name}`);
  console.log(`  ${et.scheduling_url}`);
  console.log(`  durée ${et.duration} min`);

  // ── 3. Un créneau libre, le plus LOINTAIN possible ──────────────────────
  titre("3. GET /event_type_available_times");
  const debutFenetre = new Date(Date.now() + 3 * 60 * 60 * 1000);
  // Calendly refuse une fenêtre de plus de 7 jours sur cet endpoint.
  const finFenetre = new Date(debutFenetre.getTime() + 6.5 * 24 * 60 * 60 * 1000);
  const dispos = await appel(
    `/event_type_available_times?event_type=${encodeURIComponent(et.uri)}` +
      `&start_time=${debutFenetre.toISOString()}&end_time=${finFenetre.toISOString()}`,
  );
  if (dispos.status !== 200) {
    console.error(`✗ ${dispos.status}`);
    console.error(JSON.stringify(dispos.corps, null, 2));
    process.exit(1);
  }
  const creneaux = (dispos.corps?.collection ?? []).filter((c) => c?.status === "available");
  if (creneaux.length === 0) {
    console.error("✗ aucun créneau libre dans les 7 jours — sonde impossible aujourd'hui.");
    process.exit(1);
  }
  // 🔑 Le DERNIER, pas le premier : un prospect réel prend les créneaux proches.
  const creneau = creneaux[creneaux.length - 1];
  console.log(`✓ ${creneaux.length} créneaux libres, je prends le plus lointain :`);
  console.log(`  ${creneau.start_time}`);

  // ── 4. La réservation, AVEC le champ à mesurer ──────────────────────────
  titre("4. POST /invitees — une VISIO, avec invitee.text_reminder_number");
  const corpsDemande = {
    event_type: et.uri,
    start_time: creneau.start_time,
    invitee: {
      name: "SONDE TECHNIQUE — ne pas rappeler",
      email: EMAIL,
      timezone: "Europe/Paris",
      text_reminder_number: NUMERO,
    },
    location: { kind: "google_conference" },
    tracking: {
      utm_source: "sonde",
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      salesforce_uuid: null,
    },
    booking_source: "axion_ia_sonde",
  };
  console.log(JSON.stringify(corpsDemande, null, 2));

  const cree = await appel("/invitees", { method: "POST", body: JSON.stringify(corpsDemande) });
  console.log(`\n→ HTTP ${cree.status}`);
  console.log(JSON.stringify(cree.corps, null, 2));

  if (cree.status >= 400) {
    const details = Array.isArray(cree.corps?.details) ? cree.corps.details : [];
    const nomme = details.some((d) => /text_reminder_number/i.test(d?.parameter ?? ""));
    titre("VERDICT");
    if (nomme) {
      console.log("🔴 REFUSÉ, et le refus NOMME le champ.");
      console.log("   → le repli de `reserverCreneau` va se déclencher à chaque visio :");
      console.log("     la réservation passe, le numéro est PERDU, l'alerte");
      console.log("     `numero_non_transmis` part.");
      console.log("   → À FAIRE : activer les rappels SMS sur l'event-type Calendly.");
    } else {
      console.log("⚠️ REFUSÉ pour une AUTRE raison que le champ mesuré :");
      console.log(
        `   ${details.map((d) => `${d?.parameter} : ${d?.message}`).join(" | ") || "(aucun détail)"}`,
      );
      console.log("   → la sonde n'a rien tranché. Relancer.");
    }
    process.exit(0);
  }

  eventUri = cree.corps?.resource?.event ?? null;
  if (!eventUri) {
    console.error("✗ 201 sans `resource.event` — rien à relire ni à annuler.");
    process.exit(1);
  }

  // ── 5. LA MESURE : le numéro est-il RENDU ? ─────────────────────────────
  titre("5. GET /scheduled_events/{uuid}/invitees — LA MESURE");
  console.log("Un 201 ne prouve rien : ce module a déjà mesuré qu'un champ inconnu");
  console.log("est ignoré EN SILENCE. Seul ce que Calendly REND fait foi.\n");
  const invites = await appel(`${eventUri}/invitees`);
  console.log(`→ HTTP ${invites.status}`);
  const invite = invites.corps?.collection?.[0] ?? null;
  console.log(JSON.stringify(invite, null, 2));

  const rendu = invite?.text_reminder_number ?? null;
  titre("VERDICT");
  if (rendu && String(rendu).replace(/\D/g, "").endsWith("600000001")) {
    console.log("✅ ACCEPTÉ ET RENDU.");
    console.log(`   text_reminder_number = ${rendu}`);
    console.log("   → `extractPhone` le lira EN PREMIER : le numéro d'une visio");
    console.log("     arrivera bien dans la console. Le champ obligatoire sert.");
  } else if (rendu) {
    console.log(`⚠️ Un numéro est rendu mais ce n'est PAS le nôtre : ${rendu}`);
  } else {
    console.log("🔴 ACCEPTÉ MAIS AVALÉ — 201, et le champ n'est PAS rendu.");
    console.log("   C'est le cas le plus dangereux : aucune erreur, aucun repli");
    console.log("   déclenché (le repli ne réagit qu'à un REFUS), et le numéro");
    console.log("   n'arrive nulle part. Le champ obligatoire du formulaire ne");
    console.log("   sert alors à RIEN pour une visio.");
    console.log("   → À FAIRE : activer les rappels SMS sur l'event-type, puis");
    console.log("     relancer cette sonde. Si le résultat ne change pas, il faut");
    console.log("     ranger le numéro chez NOUS et ne plus dépendre de Calendly.");
  }
} finally {
  // ── 6. L'ANNULATION, quoi qu'il arrive ──────────────────────────────────
  if (eventUri) {
    titre("6. Annulation de la réservation de sonde");
    const annule = await appel(`${eventUri}/cancellation`, { method: "POST", body: "{}" });
    if (annule.status === 201) {
      console.log("✓ annulée.");
    } else {
      console.log(`🔴 ANNULATION ÉCHOUÉE (HTTP ${annule.status}).`);
      console.log(`   ANNULER À LA MAIN : ${eventUri}`);
      console.log(JSON.stringify(annule.corps, null, 2));
      process.exitCode = 1;
    }
  }
}
