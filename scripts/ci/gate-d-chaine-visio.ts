/**
 * Gate D — ⛔ LA CHAÎNE VISIO DE BOUT EN BOUT, sur la base de Gate D (PR 6).
 *
 * Avec un FAUX client OpenAI (réponses enregistrées FICTIVES,
 * `tests/fixtures/visio/openai/menuiserie/`) et un FAUX stockage en mémoire à
 * la place de R2, mais le VRAI code du site et la VRAIE base (triggers,
 * contraintes, index partiels, SQL brut de la prise d'étape) :
 *
 *   dépôt des morceaux (code de la PR 5) → clôture des tranches et de la
 *   session → balayage → transcription → précontrôles (accord retrouvé) →
 *   P1 → V1 → P2 → P3 → P4 (sans prix) → P5 → V2 → « à valider » → validation →
 *   purge du son → 2ᵉ rendez-vous : les faits validés reviennent en « déjà
 *   connu » → (PR 7) devis ouvert depuis le projet : vide, lié au projet,
 *   l'aide à côté sans prix → questionnaire (P6) → réponses collées → faits
 *   proposés sous leur question → validation (la question source répond) →
 *   e-mail de suivi rédigé ET modèle fixe, GARÉS « à valider » → retrait de
 *   l'accord (tout effacé sauf la preuve) → (PR 7) DICTÉE après un appel,
 *   `dicteeAnnoncee` injecté : éteinte → 503 ; allumée → piste de Williams
 *   reçue, piste client REFUSÉE, P1 avec le préambule de dictée, compte rendu
 *   `origine = dictee`, faits `rapporte_par_williams`, suivi PROPOSÉ.
 *
 * ⚠️ Ne tourne QUE si `CI === "true"` ET que la base est sur `localhost` :
 * impossible en production (la fonction lève sinon).
 *
 * Contre-témoin : une seconde rencontre dont P1 est TRONQUÉE ne doit jamais
 * atteindre « à valider » — si le contrôle de la chaîne ne le voyait pas, il
 * ne prouverait rien. Angle mort nommé : le vrai Chrome, le vrai Meet, le vrai
 * OpenAI (essai de fumée et pilote O-1 après la mise en ligne).
 *
 * Aucune ligne `cost_ledger` n'est écrite (port de coût en mémoire), et c'est
 * vérifié. Les journaux en ajout seul (`fait_evenements`, `effacements_journal`)
 * gardent leurs lignes : c'est leur raison d'être.
 */

import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { PrismaClient } from "../../prisma/generated/client";
import { chiffrerOctets } from "../../src/lib/chiffrer-parole";
import { purgerPilote, retirerAccordRencontre } from "../../src/lib/rgpd-erase";
import { balayerCircuit } from "../../src/server/visio/balayage-circuit";
import { construireCircuit } from "../../src/server/visio/circuit";
import { construireEntreeP1, faitsDejaConnus } from "../../src/server/visio/contexte";
import { entrelacer } from "../../src/server/visio/dialogue";
import type { AlerteCircuit } from "../../src/server/visio/etapes";
import { executerEtape } from "../../src/server/visio/etapes";
import { creerOuRetrouverClient } from "../../src/server/qualiopi/crm/porte-client";
import { validerCompteRendu } from "../../src/server/visio/gestes-compte-rendu";
import { deposerMorceau, empreinteSha256 } from "../../src/server/visio/morceaux";
import type { ClientOpenAIVisio, ReponseBrute } from "../../src/server/visio/openai/client";
import type { EcritureCout } from "../../src/server/visio/openai/cout";
import {
  CODE_DICTEE_ETEINTE,
  creerOuReprendreSession,
  terminerSession,
  terminerTranche,
} from "../../src/server/visio/sessions";
import { CODE_PISTE_CLIENT_EN_DICTEE } from "../../src/server/visio/morceaux";
import { PREAMBULE_DICTEE } from "../../src/server/visio/dictee";
import {
  extraction as extractionFictive,
  fait as faitFictif,
} from "../../tests/fixtures/visio/scenario-menuiserie";
import { aideAuDevis } from "../../src/features/dossier-client/aide-au-devis";
import { consoliderFaits } from "../../src/features/dossier-client/consolider-faits";
import { lierDevisAuProjet } from "../../src/server/qualiopi/crm/devis-projet";
import {
  demanderEmailSuivi,
  demanderQuestionnaire,
  emailSuiviGabaritFixe,
  enregistrerReponses,
  validerFaitDeReponse,
} from "../../src/server/visio/gestes-suivi";
import type { PortEnvoiEmailSuivi } from "../../src/server/visio/passes/etapes-a-la-demande";

const CLE_CI = "0123456789abcdef".repeat(4);
const DOSSIER = path.resolve(process.cwd(), "tests/fixtures/visio/openai/menuiserie");
const lire = (n: string): unknown => JSON.parse(readFileSync(path.join(DOSSIER, n), "utf8"));

function exigerCI(): void {
  const brute = process.env["DATABASE_URL"] ?? "";
  const hote = brute ? new URL(brute).hostname : "";
  if (process.env["CI"] !== "true" || !["localhost", "127.0.0.1"].includes(hote)) {
    throw new Error(
      "chaîne visio : réservée à la CI, sur une base locale (CI=true, hôte localhost)",
    );
  }
}

function reponse(v: unknown, statut = "completed", raison: string | null = null): ReponseBrute {
  return {
    statut,
    raisonIncomplete: raison,
    modele: "gpt-6-sol",
    texte: JSON.stringify(v),
    refus: null,
    jetonsEntree: 2000,
    jetonsEntreeEnCache: 500,
    jetonsSortie: 600,
  };
}

/** Faux OpenAI : répond selon le FORMAT demandé et le contenu de la tranche. */
function fauxOpenAI(p1Tronquee: boolean): { client: ClientOpenAIVisio; appels: string[] } {
  const appels: string[] = [];
  const parFormat: Record<string, () => ReponseBrute> = {
    extraction_v1: () =>
      p1Tronquee
        ? reponse({}, "incomplete", "max_output_tokens")
        : reponse(lire("extraction.json")),
    rattachement_v1: () => reponse(lire("rattachement.json")),
    consolidation_v1: () => reponse(lire("consolidation.json")),
    ebauche_v1: () => reponse(lire("ebauche.json")),
    compte_rendu_v1: () => reponse(lire("compte-rendu.json")),
    // PR 7 — passes à la demande.
    questionnaire_v1: () => reponse(lire("questionnaire.json")),
    lecture_reponses_v1: () => reponse(lire("lecture-reponses.json")),
    email_suivi_v1: () => reponse(lire("email-suivi.json")),
  };
  return {
    appels,
    client: {
      transcrire: async (d) => {
        const piste = d.octets.toString("utf8").startsWith("client") ? "client" : "axion";
        appels.push(`transcrire:${piste}`);
        return lire(`transcription-${piste}.json`);
      },
      repondre: async (d) => {
        appels.push(d.format.name);
        const f = parFormat[d.format.name];
        if (!f) throw new Error(`format inattendu : ${d.format.name}`);
        return f();
      },
    },
  };
}

interface Monde {
  readonly clientId: string;
  readonly rencontreId: string;
  readonly appareil: { id: string; adminUserId: string };
  readonly r2: Map<string, Buffer>;
  readonly debut: Date;
}

async function semer(db: PrismaClient, clientId: string, suffixe: string): Promise<Monde> {
  const debut = new Date("2026-10-06T08:00:00Z");
  const rencontre = await db.rencontre.create({
    data: {
      source: "saisie_manuelle",
      type: "visio",
      titre: `Diagnostic fictif (Gate D ${suffixe})`,
      estTestInterne: true,
      clientId,
      rattachementStatut: "valide",
      debutPrevu: debut,
      debutReel: debut,
    },
  });
  await db.rencontreParticipant.create({
    data: { rencontreId: rencontre.id, clientId, nomAffiche: "Cliente fictive", role: "client" },
  });
  const appareil = await db.appareilEnregistrement.create({
    data: {
      nom: `Poste Gate D ${suffixe}`,
      jetonHash: createHash("sha256").update(randomUUID()).digest("hex"),
      adminUserId: randomUUID(),
      expireLe: new Date(Date.now() + 86_400_000),
    },
  });
  const enr = await db.enregistrement.create({
    data: {
      rencontreId: rencontre.id,
      nature: "visio",
      cleClient: randomUUID(),
      appareilId: appareil.id,
      statut: "en_cours",
      debut,
      accordConfirmeLe: new Date(debut.getTime() + 9_000),
      evenements: "[]",
      versionExtension: "1.2.0",
      versionContrat: 1,
    },
  });
  const r2 = new Map<string, Buffer>();
  const stockage = {
    disponible: () => true,
    deposer: async (cle: string, octets: Buffer) => void r2.set(cle, Buffer.from(octets)),
    supprimer: async (cle: string) => void r2.delete(cle),
    lire: async (cle: string) => r2.get(cle) ?? null,
    existe: async (cle: string) => r2.has(cle),
  };
  const a = { id: appareil.id, adminUserId: appareil.adminUserId };
  for (const piste of ["client", "axion"] as const) {
    const morceaux = [
      Buffer.from(`${piste}-tranche-0-morceau-0-fictif`),
      Buffer.from(`-${piste}-morceau-1`),
    ];
    for (const [seq, octets] of morceaux.entries()) {
      const r = await deposerMorceau(db, stockage, {
        appareil: a,
        enregistrementId: enr.id,
        entetes: {
          piste,
          tranche: "0",
          seq: String(seq),
          debutCaptureMs: seq === 0 ? String(debut.getTime()) : null,
          empreinte: empreinteSha256(octets),
        },
        octets,
        maintenant: new Date(),
      });
      if (r.statut !== 200)
        throw new Error(`dépôt du morceau : ${r.statut} ${JSON.stringify(r.corps)}`);
    }
    await terminerTranche(db, {
      appareil: a,
      enregistrementId: enr.id,
      corps: {
        piste,
        numero: 0,
        motifDebut: "demarrage",
        debutCaptureEpochMs: debut.getTime(),
        nbMorceaux: morceaux.length,
        empreinte: empreinteSha256(Buffer.concat(morceaux)),
        dureeMs: 180_000,
        finMuette: true,
      },
      maintenant: new Date(),
    });
  }
  await terminerSession(db, {
    appareil: a,
    enregistrementId: enr.id,
    corps: {
      finLe: new Date(debut.getTime() + 600_000).toISOString(),
      motif: "manuel",
      perdus: [],
      fenetresHorsAccord: [],
      evenements: [],
    },
    maintenant: new Date(),
  });
  return { clientId, rencontreId: rencontre.id, appareil: a, r2, debut };
}

async function derouler(
  db: PrismaClient,
  deps: ReturnType<typeof construireCircuit>,
): Promise<string[]> {
  const issues: string[] = [];
  for (let tour = 0; tour < 40; tour++) {
    const b = await balayerCircuit(db, deps);
    if (b.dues.length === 0) break;
    for (const d of b.dues) issues.push(`${d.etape}:${await executerEtape(deps, d.id)}`);
  }
  return issues;
}

// ── PR 7 : la DICTÉE après un appel ─────────────────────────────────────────

/**
 * Ce que Williams dicte, seul, après l'appel : il RAPPORTE ce que la gérante a
 * dit. Mêmes faits que le rendez-vous en visio (les passes suivantes
 * réutilisent leurs réponses enregistrées), mais toutes les phrases sont les
 * siennes, sur SA piste : aucune n'est une phrase du client.
 */
const DICTEE: ReadonlyArray<readonly [number, string]> = [
  [2, "Appel avec la gérante de la menuiserie : on serait douze commerciaux à former, dit-elle."],
  [20, "Côté budget, on avait prévu autour de trois mille euros hors taxes, d'après elle."],
  [40, "Elle voudrait que ce soit fait avant le 15 décembre si possible."],
  [60, "Je vous envoie le programme de la formation vendredi, c'est ce que je lui ai promis."],
  [80, "Aujourd'hui tout est sur Excel et on perd des heures sur les relances clients."],
];

function transcriptionDictee(): unknown {
  return {
    text: DICTEE.map(([, t]) => t).join(" "),
    segments: DICTEE.map(([debut, texte], i) => ({
      type: "transcript.text.segment",
      id: `seg_${i}`,
      start: debut,
      end: debut + 6,
      speaker: "A",
      text: texte,
    })),
    usage: { type: "tokens", input_tokens: 3000, output_tokens: 180 },
  };
}

/** P1 de la dictée : chaque fait est dit par Williams (AXION), cité sur SA piste. */
function extractionDictee(): unknown {
  const base = lire("extraction.json") as {
    faits: Array<{ ref: string; enonce: string; valeur: unknown }>;
  };
  const de = (ref: string) => base.faits.find((f) => f.ref === ref)!;
  const citer = (ref: string, type: string, s: number, citation: string, cle = "global") =>
    faitFictif({
      ref,
      type: type as never,
      cle,
      enonce: de(ref).enonce,
      valeur: de(ref).valeur as never,
      locuteur_declare: "axion",
      preuves: [{ segment_ids: [`S000${s}`], citation }],
    });
  return extractionFictive(
    [
      citer("F01", "nb_participants", 1, "on serait douze commerciaux à former"),
      citer("F02", "budget", 2, "on avait prévu autour de trois mille euros hors taxes"),
      citer("F03", "echeance", 3, "que ce soit fait avant le 15 décembre"),
      citer(
        "F04",
        "engagement_axion",
        4,
        "Je vous envoie le programme de la formation vendredi",
        "programme",
      ),
      citer(
        "F05",
        "probleme",
        5,
        "tout est sur Excel et on perd des heures sur les relances clients",
        "relances",
      ),
    ],
    {
      nature_echange: { nature: "echange_complet", explication: "Dictée après un appel." },
      consentement: null,
      participants: [{ etiquette: "AXION", personne_ref: null }],
    },
  );
}

/**
 * La dictée de bout en bout, sur une fiche de test à part. Rend ses fautes.
 * `dicteeAnnoncee` est INJECTÉ (la dictée est éteinte en production tant que
 * la PR 8 ne l'a pas annoncée) : c'est précisément ce chemin qu'on rejoue.
 */
async function dicteeDeBoutEnBout(db: PrismaClient, clientId: string): Promise<string[]> {
  const fautes: string[] = [];
  const debut = new Date("2026-10-06T08:00:00Z");
  const apres = new Date("2026-10-06T09:00:00Z");
  const rencontre = await db.rencontre.create({
    data: {
      source: "saisie_manuelle",
      type: "telephone",
      titre: "Appel fictif (Gate D, dictée)",
      estTestInterne: true,
      clientId,
      rattachementStatut: "valide",
      debutPrevu: debut,
      finPrevue: new Date(debut.getTime() + 30 * 60_000),
      debutReel: debut,
    },
  });
  await db.rencontreParticipant.create({
    data: { rencontreId: rencontre.id, clientId, nomAffiche: "Gérante fictive", role: "client" },
  });
  const appareil = await db.appareilEnregistrement.create({
    data: {
      nom: "Poste Gate D dictée",
      jetonHash: createHash("sha256").update(randomUUID()).digest("hex"),
      adminUserId: randomUUID(),
      expireLe: new Date(Date.now() + 86_400_000),
    },
  });
  const a = { id: appareil.id, adminUserId: appareil.adminUserId };
  const corps = {
    cleClient: randomUUID(),
    rencontreId: rencontre.id,
    nature: "dictee" as const,
    versionExtension: "1.2.0",
    debutLe: apres.toISOString(),
    accordLocalLe: null,
    nbParticipants: null,
  };

  // Contre-témoin : ÉTEINTE (non annoncée), la dictée ne démarre pas (503).
  const eteinte = await creerOuReprendreSession(db, {
    appareil: a,
    corps: { ...corps, cleClient: randomUUID() },
    mode: "pilote",
    maintenant: apres,
    preavis: null,
    dicteeAnnoncee: false,
  });
  if (eteinte.statut !== 503 || eteinte.corps["erreur"] !== CODE_DICTEE_ETEINTE)
    fautes.push(`dictée éteinte : ${eteinte.statut} au lieu de 503`);

  const session = await creerOuReprendreSession(db, {
    appareil: a,
    corps,
    mode: "pilote",
    maintenant: apres,
    preavis: null,
    dicteeAnnoncee: true,
  });
  const enrId = session.corps["enregistrementId"];
  if (
    session.statut !== 200 ||
    session.corps["statut"] !== "en_cours" ||
    typeof enrId !== "string"
  ) {
    fautes.push(`dictée : session ${session.statut} ${JSON.stringify(session.corps)}`);
    return fautes;
  }

  const r2 = new Map<string, Buffer>();
  const stockage = {
    disponible: () => true,
    deposer: async (cle: string, octets: Buffer) => void r2.set(cle, Buffer.from(octets)),
    supprimer: async (cle: string) => void r2.delete(cle),
    lire: async (cle: string) => r2.get(cle) ?? null,
    existe: async (cle: string) => r2.has(cle),
  };
  const deposer = (piste: "client" | "axion", seq: number, octets: Buffer) =>
    deposerMorceau(db, stockage, {
      appareil: a,
      enregistrementId: enrId,
      entetes: {
        piste,
        tranche: "0",
        seq: String(seq),
        debutCaptureMs: seq === 0 ? String(apres.getTime()) : null,
        empreinte: empreinteSha256(octets),
      },
      octets,
      maintenant: new Date(),
    });

  // La piste CLIENT est refusée : une dictée, c'est Williams seul.
  const voixClient = await deposer("client", 0, Buffer.from("client-dictee-fictif"));
  if (voixClient.statut !== 409 || voixClient.corps["erreur"] !== CODE_PISTE_CLIENT_EN_DICTEE)
    fautes.push(`dictée : la piste client n'est pas refusée (${voixClient.statut})`);

  const morceaux = [Buffer.from("axion-dictee-morceau-0-fictif"), Buffer.from("-axion-morceau-1")];
  for (const [seq, octets] of morceaux.entries()) {
    const r = await deposer("axion", seq, octets);
    if (r.statut !== 200)
      fautes.push(`dictée : dépôt de la piste de Williams ${r.statut} ${JSON.stringify(r.corps)}`);
  }
  await terminerTranche(db, {
    appareil: a,
    enregistrementId: enrId,
    corps: {
      piste: "axion",
      numero: 0,
      motifDebut: "demarrage",
      debutCaptureEpochMs: apres.getTime(),
      nbMorceaux: morceaux.length,
      empreinte: empreinteSha256(Buffer.concat(morceaux)),
      dureeMs: 180_000,
      finMuette: true,
    },
    maintenant: new Date(),
  });
  await terminerSession(db, {
    appareil: a,
    enregistrementId: enrId,
    corps: {
      finLe: new Date(apres.getTime() + 180_000).toISOString(),
      motif: "manuel",
      perdus: [],
      fenetresHorsAccord: [],
      evenements: [],
    },
    maintenant: new Date(),
  });

  // Le circuit, avec un faux OpenAI qui garde l'entrée de P1.
  const appels: string[] = [];
  let entreeP1 = "";
  const reponsesEnregistrees: Record<string, string> = {
    rattachement_v1: "rattachement.json",
    consolidation_v1: "consolidation.json",
    ebauche_v1: "ebauche.json",
    compte_rendu_v1: "compte-rendu.json",
  };
  const deps = construireCircuit({
    db,
    mode: () => "pilote",
    stockage: {
      lire: async (c) => r2.get(c) ?? null,
      supprimer: async (c) => void r2.delete(c),
      existe: async (c) => r2.has(c),
    },
    openai: () => ({
      transcrire: async (d) => {
        const piste = d.octets.toString("utf8").startsWith("client") ? "client" : "axion";
        appels.push(`transcrire:${piste}`);
        return transcriptionDictee();
      },
      repondre: async (d) => {
        appels.push(d.format.name);
        if (d.format.name === "extraction_v1") {
          entreeP1 = d.entree;
          return reponse(extractionDictee());
        }
        const f = reponsesEnregistrees[d.format.name];
        if (!f) throw new Error(`dictée : format inattendu ${d.format.name}`);
        return reponse(lire(f));
      },
    }),
    cout: { verifierPlafond: async () => undefined, enregistrer: async () => undefined },
    alerter: async () => undefined,
  });
  const issues = await derouler(db, deps);

  if (appels.includes("transcrire:client")) fautes.push("dictée : une piste client est transcrite");
  if (!entreeP1.startsWith(PREAMBULE_DICTEE))
    fautes.push("dictée : l'entrée de P1 ne commence pas par le préambule de dictée");
  const cr = await db.compteRendu.findFirst({
    where: { rencontreId: rencontre.id },
    orderBy: { version: "desc" },
  });
  if (cr?.statut !== "a_valider" || cr.origine !== "dictee")
    fautes.push(
      `dictée : compte rendu ${cr?.statut ?? "absent"}, origine ${cr?.origine ?? "—"} ` +
        `au lieu de a_valider, dictee (${issues.join(", ")} ; ${appels.join(", ")})`,
    );
  const faits = await db.fait.findMany({
    where: { rencontreId: rencontre.id, statut: { in: ["propose", "en_attente"] } },
  });
  if (faits.length === 0) fautes.push("dictée : aucun fait proposé");
  if (faits.some((f) => f.certitude !== "rapporte_par_williams" || f.source !== "dictee"))
    fautes.push("dictée : un fait n'est pas « rapporté par Williams », source dictée");
  if (faits.some((f) => f.locuteur !== "axion"))
    fautes.push("dictée : un fait s'appuie sur une phrase du client");
  const suivi = await db.rencontreSuivi.findUnique({ where: { rencontreId: rencontre.id } });
  if (!suivi || suivi.auteurId !== null || suivi.issue !== "eu_lieu" || suivi.suiteLe === null)
    fautes.push(`dictée : suivi du rendez-vous non PROPOSÉ (${JSON.stringify(suivi)})`);
  return fautes;
}

/** Rend la liste des fautes de la chaîne (vide = verte). */
export async function chaineVisioDeBoutEnBout(): Promise<string[]> {
  exigerCI();
  if (!process.env["PII_ENCRYPTION_KEY"]) process.env["PII_ENCRYPTION_KEY"] = CLE_CI;
  const fautes: string[] = [];
  const db = new PrismaClient();
  // La fiche passe par la PORTE UNIQUE (B18), comme toute création de client.
  const porte = await creerOuRetrouverClient(
    db,
    { raisonSociale: `Menuiserie fictive chaîne visio ${Date.now()}` },
    null,
    { parAdminId: null },
  );
  if (porte.statut !== "cree") throw new Error(`chaîne visio : fiche refusée (${porte.statut})`);
  const client = { id: porte.id };
  await db.clientTestInterne.create({ data: { clientId: client.id } });
  const alertes: AlerteCircuit[] = [];
  const couts: EcritureCout[] = [];
  let plafonds = 0;
  // PR 7 — les e-mails « garés » par la chaîne : de VRAIES lignes `email_outbox`
  // en « à valider » (la file Redis n'existe pas en Gate D), supprimées à la fin.
  const outboxCrees: string[] = [];
  const devisCrees: string[] = [];
  let clientDictee: string | null = null;
  const envoiEmail: PortEnvoiEmailSuivi = {
    mettreEnValidation: async (a) => {
      const o = await db.emailOutbox.create({
        data: {
          template: "visio-email-suivi",
          recipient: a.to,
          locale: "fr",
          payload: a.payload as never,
          sujet: a.sujet,
          statut: "a_valider",
          clientId: a.clientId,
          entityType: "Rencontre",
          entityId: a.rencontreId,
        },
        select: { id: true },
      });
      outboxCrees.push(o.id);
      return o.id;
    },
  };
  try {
    // ── Le scénario complet ────────────────────────────────────────────────
    const m = await semer(db, client.id, "1");
    const openai = fauxOpenAI(false);
    const deps = construireCircuit({
      db,
      // La rencontre semée est de test : le pilote ouvre les étapes à la demande.
      mode: () => "pilote",
      stockage: {
        lire: async (c) => m.r2.get(c) ?? null,
        supprimer: async (c) => void m.r2.delete(c),
        existe: async (c) => m.r2.has(c),
      },
      openai: () => openai.client,
      cout: {
        verifierPlafond: async () => void (plafonds += 1),
        enregistrer: async (e) => void couts.push(e),
      },
      alerter: async (a) => void alertes.push(a),
      envoiEmail,
    });
    const issues = await derouler(db, deps);

    const objetsR2 = [...m.r2.values()];
    if (objetsR2.length !== 4) fautes.push(`R2 : ${objetsR2.length} objet(s) au lieu de 4`);
    if (objetsR2.some((o) => o.toString("utf8").includes("morceau")))
      fautes.push("R2 : un morceau est écrit EN CLAIR");
    void chiffrerOctets;

    const cr = await db.compteRendu.findFirst({
      where: { rencontreId: m.rencontreId },
      orderBy: { version: "desc" },
    });
    if (cr?.statut !== "a_valider")
      fautes.push(
        `compte rendu : ${cr?.statut ?? "absent"} au lieu de a_valider (${issues.join(", ")})`,
      );
    if (
      cr &&
      (!cr.contenu.startsWith("enc:v1:") || !(cr.verification ?? "").startsWith("enc:v1:"))
    ) {
      fautes.push("compte rendu : contenu ou vérification en clair");
    }
    const faits = await db.fait.findMany({ where: { rencontreId: m.rencontreId } });
    const proposes = faits.filter((f) => f.statut === "propose");
    if (proposes.length !== 5) fautes.push(`faits proposés : ${proposes.length} au lieu de 5`);
    if (faits.some((f) => !f.enonce.startsWith("enc:v1:")))
      fautes.push("un énoncé de fait est en clair");
    if (proposes.some((f) => !f.citationVerifiee || f.citationDebutMs === null))
      fautes.push("une citation n'est pas vérifiée et horodatée");
    const segments = await db.transcriptionSegment.findMany({
      where: { transcription: { enregistrement: { rencontreId: m.rencontreId } } },
    });
    if (segments.length !== 11 || segments.some((s) => !s.texte.startsWith("enc:v1:")))
      fautes.push(`segments : ${segments.length}, ou un segment en clair`);
    const preuve = await db.enregistrementConsentement.count({
      where: { rencontreId: m.rencontreId, type: "phrase_retrouvee_verifiee" },
    });
    if (preuve < 1) fautes.push("l'accord n'a pas été retrouvé dans la transcription");
    const attendus = [
      "transcrire:client",
      "transcrire:axion",
      "extraction_v1",
      "rattachement_v1",
      "ebauche_v1",
      "compte_rendu_v1",
    ];
    if (JSON.stringify(openai.appels) !== JSON.stringify(attendus))
      fautes.push(`appels OpenAI : ${openai.appels.join(", ")}`);
    if (plafonds !== attendus.length || couts.length !== attendus.length)
      fautes.push(`plafond ${plafonds} / registre ${couts.length} au lieu de ${attendus.length}`);
    if (couts.some((c) => !c.jobId.startsWith(`visio-`) || !c.jobId.includes(m.rencontreId)))
      fautes.push("un coût n'est pas attribué au rendez-vous");
    if ((await db.costLedger.count({ where: { jobId: { startsWith: "visio-" } } })) !== 0)
      fautes.push("une ligne cost_ledger a été écrite en CI");

    // ── Validation → purge du son ─────────────────────────────────────────
    if (cr?.statut === "a_valider") {
      await validerCompteRendu(db, {
        compteRenduId: cr.id,
        parAdminId: m.appareil.adminUserId,
        maintenant: new Date(),
      });
      await derouler(db, deps);
      if (m.r2.size !== 0)
        fautes.push(`purge : ${m.r2.size} objet(s) restent dans R2 après validation`);
      const e = await db.enregistrement.findFirst({ where: { rencontreId: m.rencontreId } });
      if (!e?.audioSupprimeLe) fautes.push("purge : audioSupprimeLe non posé");
    }

    // ── 2ᵉ rendez-vous : les faits validés reviennent en « déjà connu » ───
    const projet = await db.projet.create({
      data: {
        numero: `AXI-PRJ-GATE-D-${Date.now()}`,
        clientId: client.id,
        titre: "Former les commerciaux",
      },
    });
    await db.fait.updateMany({
      where: { id: { in: proposes.map((f) => f.id) } },
      data: { portee: "projet", projetId: projet.id, statut: "valide" },
    });
    const donnees = deps.donnees;
    const valides = await db.fait.findMany({
      where: { clientId: client.id, statut: "valide" },
      select: {
        id: true,
        type: true,
        cle: true,
        portee: true,
        projetId: true,
        statut: true,
        suivi: true,
        enonce: true,
        constateLe: true,
        rencontreId: true,
      },
    });
    const suivant = { id: randomUUID(), debut: new Date("2026-10-20T08:00:00Z") };
    const connus = faitsDejaConnus(
      valides.map((f) => ({ ...f, enonce: "x" })),
      suivant,
    );
    if (connus.length !== 5)
      fautes.push(`2ᵉ rendez-vous : ${connus.length} fait(s) déjà connu(s) au lieu de 5`);
    const { entree } = construireEntreeP1({
      rencontre: {
        id: suivant.id,
        titre: "Suite",
        debut: suivant.debut,
        dureeMs: 0,
        source: "saisie_manuelle",
      },
      pistes: { client: "OK", axion: "OK" },
      formulaire: [],
      contacts: [],
      projets: [
        {
          id: projet.id,
          numero: projet.numero,
          titre: projet.titre,
          activite: null,
          statut: "ouvert",
        },
      ],
      dejaConnus: connus,
      dialogue: entrelacer([]),
    });
    if (!/H005 \| PRJ-1/.test(entree))
      fautes.push(
        "2ᵉ rendez-vous : les faits validés ne sont pas rangés sous leur projet dans « déjà connu »",
      );
    void donnees;

    // ── PR 7 : devis ouvert depuis le projet — vide, lié, l'aide à côté ────
    const adminId = m.appareil.adminUserId;
    const devis = await db.$transaction(async (tx) => {
      const d = await tx.devis.create({
        data: {
          numero: `AXI-DEV-GATE-D-${Date.now()}`,
          clientId: client.id,
          lignes: [],
          montantTotalHtCents: 0,
          mentionTva: "gate-d",
          statut: "brouillon",
          dateValidite: new Date(),
        },
        select: { id: true },
      });
      await lierDevisAuProjet(tx, {
        devisId: d.id,
        projetId: projet.id,
        clientId: client.id,
        lieParId: null,
      });
      return d;
    });
    devisCrees.push(devis.id);
    if ((await db.projetDevis.count({ where: { devisId: devis.id, projetId: projet.id } })) !== 1)
      fautes.push("devis : le lien au projet n'est pas écrit");
    if ((await db.preRemplissage.count()) !== 0)
      fautes.push("devis : un pré-remplissage a été écrit (décision de Will : aucun)");
    const aide = aideAuDevis({
      consolidation: consoliderFaits(
        valides.map((f) => ({
          ...f,
          enonce: "x",
          texteCourt: null,
          montantMinCents: null,
          montantMaxCents: null,
          dateCible: null,
          quantite: 12,
          refCatalogue: null,
          citationDebutMs: null,
          contactSujetId: null,
          relation: null,
          relationAvecFaitId: null,
          remplaceParId: null,
        })),
        [{ id: projet.id, derniereReouvertureLe: null }],
        new Date(),
      ),
      projetId: projet.id,
      citations: new Map(),
      role: "admin",
      maintenant: new Date(),
    });
    if (aide.vide) fautes.push("aide au devis : vide alors que le projet a des faits validés");
    if (/€|TVA/.test(JSON.stringify(aide))) fautes.push("aide au devis : un prix est proposé");

    // ── PR 7 : questionnaire de cadrage (P6) ────────────────────────────────
    await db.rencontre.update({ where: { id: m.rencontreId }, data: { projetId: projet.id } });
    await demanderQuestionnaire(
      db,
      { clientId: client.id, projetId: projet.id, parAdminId: adminId },
      { mode: "pilote" },
    );
    await derouler(db, deps);
    const questionnaire = await db.questionnaireCadrage.findFirst({
      where: { projetId: projet.id },
      orderBy: { version: "desc" },
      include: { questions: { orderBy: { ordre: "asc" } } },
    });
    // Q3 cite un fait connu, Q4 parle de budget : retirées. Restent Q1, Q2, Q5.
    if (questionnaire?.questions.length !== 3)
      fautes.push(
        `questionnaire : ${questionnaire?.questions.length ?? 0} question(s) au lieu de 3`,
      );
    if (questionnaire?.questions.some((q) => !q.texte.startsWith("enc:v1:")))
      fautes.push("questionnaire : une question est écrite en clair");
    if (!questionnaire?.modele) fautes.push("questionnaire : modèle servi non noté");

    // ── PR 7 : réponses collées → faits sous leur question → validation ────
    const q1 = questionnaire?.questions[0];
    if (questionnaire && q1) {
      await enregistrerReponses(
        db,
        {
          questionnaireId: questionnaire.id,
          reponses: new Map([[q1.id, "C'est notre directrice commerciale qui valide."]]),
        },
        { mode: "pilote" },
      );
      await derouler(db, deps);
      const tires = await db.fait.findMany({ where: { questionnaireQuestionId: q1.id } });
      if (tires.length !== 1 || tires[0]?.source !== "questionnaire_cadrage")
        fautes.push(`réponses : ${tires.length} fait(s) sous la question 1 au lieu de 1`);
      else {
        if (!tires[0].citation?.startsWith("enc:v1:") || tires[0].statut !== "propose")
          fautes.push("réponses : le fait n'est pas proposé, ou sa citation est en clair");
        await validerFaitDeReponse(db, { faitId: tires[0].id, parAdminId: adminId });
        const apres = await db.fait.findUnique({ where: { id: tires[0].id } });
        if (apres?.statut !== "valide") fautes.push("réponses : la validation n'a pas pris");
      }
    }

    // ── PR 7 : e-mail de suivi, rédigé ET modèle fixe, garés « à valider » ──
    const contact = await db.clientContact.create({
      data: {
        clientId: client.id,
        nom: "Cliente fictive",
        origine: "mention",
        adresses: {
          create: {
            email: "cliente@exemple.invalid",
            emailHash: createHash("sha256").update("cliente@exemple.invalid").digest("hex"),
            nature: "pro",
          },
        },
      },
      select: { id: true },
    });
    await db.rencontreParticipant.updateMany({
      where: { rencontreId: m.rencontreId, role: "client" },
      data: { contactId: contact.id },
    });
    await demanderEmailSuivi(
      db,
      { rencontreId: m.rencontreId, contactId: contact.id, parAdminId: adminId },
      { mode: "pilote" },
    );
    await derouler(db, deps);
    // V1-02 : l'e-mail rédigé attend déjà pour cette personne — le modèle fixe
    // répond « déjà préparé » et ne gare rien (un double clic, un second onglet).
    const dejaPrepare = await emailSuiviGabaritFixe(db, envoiEmail, {
      rencontreId: m.rencontreId,
      contactId: contact.id,
      parAdminId: adminId,
    });
    if (!dejaPrepare.includes("déjà préparé"))
      fautes.push(
        "e-mail de suivi : le modèle fixe gare un second e-mail alors qu'un premier attend",
      );
    // Will écarte l'e-mail rédigé : le modèle fixe en prépare alors un autre.
    await db.emailOutbox.updateMany({
      where: { emailSuivi: { is: { rencontreId: m.rencontreId } }, statut: "a_valider" },
      data: { statut: "refuse" },
    });
    await emailSuiviGabaritFixe(db, envoiEmail, {
      rencontreId: m.rencontreId,
      contactId: contact.id,
      parAdminId: adminId,
    });
    const emails = await db.emailSuivi.findMany({
      where: { rencontreId: m.rencontreId },
      include: { emailOutbox: true },
    });
    if (
      emails.length !== 2 ||
      emails.filter((e) => e.emailOutbox?.statut === "a_valider").length !== 1
    )
      fautes.push(
        `e-mail de suivi : ${emails.length} e-mail(s), ou l'e-mail du modèle fixe n'attend pas la validation`,
      );
    const premier = emails.map(
      (e) => e.emailOutbox?.payload as Record<string, unknown> | undefined,
    );
    // Art. 14 : aucun des deux n'est PARTI (l'un est écarté, l'autre attend),
    // donc les deux portent la ligne. Une fois l'un réellement envoyé,
    // le suivant ne la porte plus.
    if (premier.filter((p) => p?.["informationArt14"] === true).length !== 2)
      fautes.push(
        "e-mail de suivi : un e-mail garé avant tout envoi ne porte pas la ligne art. 14",
      );
    const parti = emails.find((e) => e.emailOutbox?.statut === "a_valider")?.emailOutboxId;
    if (parti) {
      await db.emailOutbox.update({ where: { id: parti }, data: { statut: "envoye" } });
      await emailSuiviGabaritFixe(db, envoiEmail, {
        rencontreId: m.rencontreId,
        contactId: contact.id,
        parAdminId: adminId,
      });
      const suivant = await db.emailSuivi.findFirst({
        where: { rencontreId: m.rencontreId, id: { notIn: emails.map((e) => e.id) } },
        include: { emailOutbox: true },
      });
      const charge = suivant?.emailOutbox?.payload as Record<string, unknown> | undefined;
      if (!charge || charge["informationArt14"] === true)
        fautes.push("e-mail de suivi : la ligne art. 14 est reposée après un premier envoi");
    }
    if (premier.some((p) => /€|https?:/.test(JSON.stringify(p ?? {}))))
      fautes.push("e-mail de suivi : un prix ou un lien dans le texte");

    // ── Retrait de l'accord : tout part, sauf la preuve ────────────────────
    await retirerAccordRencontre(m.rencontreId, m.appareil.adminUserId, { db });
    if (
      (await db.transcriptionSegment.count({
        where: { transcription: { enregistrement: { rencontreId: m.rencontreId } } },
      })) !== 0
    )
      fautes.push("retrait : des segments restent");
    if ((await db.compteRendu.count({ where: { rencontreId: m.rencontreId } })) !== 0)
      fautes.push("retrait : un compte rendu reste");
    if (
      (await db.fait.count({
        where: { rencontreId: m.rencontreId, statut: { not: "efface" } },
      })) !== 0
    )
      fautes.push("retrait : un fait n'est pas effacé");
    if (
      (await db.enregistrementConsentement.count({
        where: { rencontreId: m.rencontreId, type: "phrase_retrouvee_verifiee" },
      })) < 1
    )
      fautes.push("retrait : la PREUVE de l'accord a disparu");
    if (
      (await db.enregistrementConsentement.count({
        where: { rencontreId: m.rencontreId, type: "retrait" },
      })) !== 1
    )
      fautes.push("retrait : aucune trace du retrait");

    // ── Contre-témoin : P1 tronquée n'atteint jamais « à valider » ─────────
    const t = await semer(db, client.id, "2");
    const cassee = fauxOpenAI(true);
    const depsCasses = construireCircuit({
      db,
      mode: () => "pilote",
      stockage: {
        lire: async (c) => t.r2.get(c) ?? null,
        supprimer: async (c) => void t.r2.delete(c),
        existe: async (c) => t.r2.has(c),
      },
      openai: () => cassee.client,
      cout: { verifierPlafond: async () => undefined, enregistrer: async () => undefined },
      alerter: async () => undefined,
    });
    await derouler(db, depsCasses);
    await db.traitementVisio.updateMany({
      where: { rencontreId: t.rencontreId, statut: "a_faire" },
      data: { prochaineTentativeLe: null },
    });
    await derouler(db, depsCasses);
    const crCasse = await db.compteRendu.count({
      where: { rencontreId: t.rencontreId, statut: "a_valider" },
    });
    const echec = await db.traitementVisio.count({
      where: { rencontreId: t.rencontreId, etape: "extraire", statut: "echec_definitif" },
    });
    if (crCasse !== 0 || echec !== 1)
      fautes.push("contre-témoin : une P1 tronquée a produit un compte rendu (ou n'a pas échoué)");

    // ── PR 7 : la dictée, sur une fiche de test à part ─────────────────────
    const porteDictee = await creerOuRetrouverClient(
      db,
      { raisonSociale: `Menuiserie fictive dictée ${Date.now()}` },
      null,
      { parAdminId: null },
    );
    if (porteDictee.statut !== "cree") {
      fautes.push(`dictée : fiche refusée (${porteDictee.statut})`);
    } else {
      clientDictee = porteDictee.id;
      await db.clientTestInterne.create({ data: { clientId: clientDictee } });
      fautes.push(...(await dicteeDeBoutEnBout(db, clientDictee)));
    }
  } finally {
    // PR 7 — ce que `purgerPilote` ne couvre pas : les pièces (devis) et les
    // e-mails garés (hors dossier client).
    await db.projetDevis.deleteMany({ where: { devisId: { in: devisCrees } } });
    await db.devis.deleteMany({ where: { id: { in: devisCrees } } });
    await db.emailSuivi.deleteMany({ where: { clientId: client.id } });
    await db.emailOutbox.deleteMany({ where: { id: { in: outboxCrees } } });
    await purgerPilote();
    await db.projet.deleteMany({ where: { clientId: client.id } });
    if (clientDictee) await db.projet.deleteMany({ where: { clientId: clientDictee } });
    await db.appareilEnregistrement.deleteMany({ where: { nom: { startsWith: "Poste Gate D" } } });
    await db.client.delete({ where: { id: client.id } });
    if (clientDictee) await db.client.delete({ where: { id: clientDictee } });
    await db.$disconnect();
  }
  if (fautes.length === 0)
    console.log("[visio] la chaîne de bout en bout est verte (faux OpenAI, vraie base)");
  void alertes;
  return fautes;
}
