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
 *   connu » → retrait de l'accord (tout effacé sauf la preuve).
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
import { terminerSession, terminerTranche } from "../../src/server/visio/sessions";

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
      versionExtension: "1.0.0",
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
  try {
    // ── Le scénario complet ────────────────────────────────────────────────
    const m = await semer(db, client.id, "1");
    const openai = fauxOpenAI(false);
    const deps = construireCircuit({
      db,
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
  } finally {
    await purgerPilote();
    await db.projet.deleteMany({ where: { clientId: client.id } });
    await db.appareilEnregistrement.deleteMany({ where: { nom: { startsWith: "Poste Gate D" } } });
    await db.client.delete({ where: { id: client.id } });
    await db.$disconnect();
  }
  if (fautes.length === 0)
    console.log("[visio] la chaîne de bout en bout est verte (faux OpenAI, vraie base)");
  void alertes;
  return fautes;
}
