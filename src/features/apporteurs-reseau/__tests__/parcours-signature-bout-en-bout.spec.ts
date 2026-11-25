// @vitest-environment node
/**
 * PARCOURS DE SIGNATURE DU CONTRAT D'APPORTEUR, DE BOUT EN BOUT — DONNÉES ENTIÈREMENT FICTIVES.
 *
 * Ce fichier enchaîne, d'un seul tenant et sur le code réel, les étapes du dossier en ligne :
 *   1. le lien (jeton) du dossier ;
 *   2. la saisie (étape 1 coordonnées, étape 2 SIRET/IBAN, dépôt des pièces) par les vraies
 *      server actions ;
 *   3. le texte du contrat avec la grille, sa signature (empreinte, date, PDF réel rendu) ;
 *   4. la contresignature de la Société (PDF des deux parties) et l'e-mail avec le contrat
 *      en pièce jointe mis en file ;
 *   5. les refus : SIREN inactif ou absent, IBAN invalide, dossier incomplet, jeton faux, double
 *      signature, texte modifié entre la lecture et la signature.
 *
 * NIVEAU : fonctions réelles (donnees, signature, verification, actions, envois, contrat-pdf,
 * jeton) au-dessus d'un Prisma SIMULÉ EN MÉMOIRE (aucune base Postgres dans le bac à sable).
 * Seules les frontières externes sont remplacées : registre SIRENE (annuaire), stockage R2,
 * file d'e-mails (enqueueEmail), antivirus, chiffrement des données personnelles, limiteur de
 * débit, IP. Aucune requête réseau ; aucune donnée réelle (e-mail en `.invalid`, IBAN d'exemple
 * public, SIREN d'exemple).
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ── Prisma simulé en mémoire ────────────────────────────────────────────────────────────────

type Ligne = Record<string, unknown>;
const bd = vi.hoisted(() => ({
  apporteurs: new Map<string, Record<string, unknown>>(),
  pieces: [] as Record<string, unknown>[],
  journal: [] as Record<string, unknown>[],
  siret: new Map<string, string | null>(),
  prochainePiece: 1,
}));

function egal(valeur: unknown, filtre: unknown): boolean {
  if (filtre !== null && typeof filtre === "object" && !(filtre instanceof Date)) {
    const f = filtre as Record<string, unknown>;
    if ("in" in f) return (f["in"] as unknown[]).includes(valeur);
    if ("lt" in f) return valeur instanceof Date && valeur.getTime() < (f["lt"] as Date).getTime();
    if ("not" in f) return valeur !== f["not"];
  }
  if (filtre instanceof Date)
    return valeur instanceof Date && valeur.getTime() === filtre.getTime();
  return (valeur ?? null) === (filtre ?? null);
}

function correspond(ligne: Ligne, where: Ligne): boolean {
  return Object.entries(where).every(([cle, filtre]) => {
    if (cle === "OR") return (filtre as Ligne[]).some((w) => correspond(ligne, w));
    return egal(ligne[cle], filtre);
  });
}

function appliquer(ligne: Ligne, data: Ligne): void {
  for (const [cle, v] of Object.entries(data)) {
    if (v !== null && typeof v === "object" && !(v instanceof Date) && "increment" in v) {
      ligne[cle] = (Number(ligne[cle]) || 0) + Number((v as Ligne)["increment"]);
    } else ligne[cle] = v;
  }
}

function piecesCourantes(apporteurId: string) {
  return bd.pieces.filter((p) => p["apporteurId"] === apporteurId && !p["remplaceeAt"]);
}

const prismaSimule = vi.hoisted(() => {
  const apporteurReseau = {
    findUnique: async (a: { where: { id: string }; include?: unknown }) => {
      const l = bd.apporteurs.get(a.where.id);
      if (!l) return null;
      const copie: Ligne = { ...l };
      if (a.include) copie["pieces"] = piecesCourantes(a.where.id).map((p) => ({ ...p }));
      return copie;
    },
    update: async (a: { where: { id: string }; data: Ligne }) => {
      const l = bd.apporteurs.get(a.where.id);
      if (!l) throw new Error("introuvable");
      appliquer(l, a.data);
      return { ...l };
    },
    updateMany: async (a: { where: Ligne; data: Ligne }) => {
      let count = 0;
      for (const l of bd.apporteurs.values()) {
        if (correspond(l, a.where)) {
          appliquer(l, a.data);
          count++;
        }
      }
      return { count };
    },
  };
  const pieceApporteur = {
    findUnique: async (a: { where: { id: string } }) =>
      bd.pieces.find((p) => p["id"] === a.where.id) ?? null,
    findMany: async (a: { where: Ligne }) => bd.pieces.filter((p) => correspond(p, a.where)),
    updateMany: async (a: { where: Ligne; data: Ligne }) => {
      const cibles = bd.pieces.filter((p) => correspond(p, a.where));
      for (const p of cibles) appliquer(p, a.data);
      return { count: cibles.length };
    },
    update: async (a: { where: { id: string }; data: Ligne }) => {
      const p = bd.pieces.find((x) => x["id"] === a.where.id)!;
      appliquer(p, a.data);
      return p;
    },
    create: async (a: { data: Ligne }) => {
      const p = { id: `piece-${bd.prochainePiece++}`, statut: "deposee", ...a.data };
      bd.pieces.push(p);
      return p;
    },
  };
  const pieceApporteurContenu = {
    create: async () => ({}),
    deleteMany: async () => ({ count: 0 }),
  };
  const activityLog = {
    create: async (a: { data: Ligne }) => {
      bd.journal.push(a.data);
      return a.data;
    },
  };
  const client: Record<string, unknown> = {
    apporteurReseau,
    pieceApporteur,
    pieceApporteurContenu,
    activityLog,
  };
  client["$transaction"] = async (fn: (tx: unknown) => unknown) => fn(client);
  return client;
});
vi.mock("@/lib/prisma", () => ({ prisma: prismaSimule }));

// ── Frontières externes simulées ────────────────────────────────────────────────────────────

const ext = vi.hoisted(() => ({
  registre: vi.fn(),
  enqueueEmail: vi.fn(),
  r2: new Map<string, { octets: Buffer; type: string }>(),
  checkRateLimit: vi.fn(),
}));

// Simulateur du registre SIRENE : `ext.registre` rend ce que rendrait l'API publique.
vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: (...a: unknown[]) => ext.registre(...a),
  lireRegistre: (...a: unknown[]) => ext.registre(...a),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => ext.enqueueEmail(...a),
  emailsQueue: null,
}));
vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: () => true,
  uploadToR2: async (cle: string, octets: Buffer, type: string) => {
    ext.r2.set(cle, { octets: Buffer.from(octets), type });
  },
  deleteFromR2: async (cle: string) => {
    ext.r2.delete(cle);
  },
  getObjectBufferR2: async (cle: string) => ext.r2.get(cle)?.octets ?? null,
}));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => v,
  decryptPii: (v: string | null) => v,
  chiffrerOctetsPii: (o: Uint8Array) => o,
}));
vi.mock("../pieces-chiffrement", () => ({ chiffrerContenuPiece: (o: Uint8Array) => o }));
vi.mock("@/server/careers/clamav", () => ({
  analyserOctets: async () => ({ issue: "sain" }),
}));
vi.mock("../alerte-vigilance", () => ({ alerterPieceVigilance: vi.fn() }));
vi.mock("../siret-apporteur", () => ({
  siretDe: async (id: string) => bd.siret.get(id) ?? null,
  siretsDe: async () => new Map(),
  enregistrerSiret: async (id: string, siret: string | null) => {
    bd.siret.set(id, siret);
  },
}));
vi.mock("../retrait", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../retrait")>()),
  retraitDe: async () => null,
  argentEnJeu: async () => false,
}));
vi.mock("@/lib/client-ip", () => ({
  getClientIp: async () => "203.0.113.9",
  getClientUserAgent: async () => "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0 Safari/537.36",
}));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash-ip-fictif" }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => ext.checkRateLimit(...a),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import { luhnValid } from "@/lib/siret";

// Les vraies server actions du dossier public : le test traverse volontairement la frontière app/.
/* eslint-disable no-restricted-imports */
import {
  enregistrerActiviteAction,
  enregistrerCoordonneesAction,
  deposerPieceAction,
  signerAction,
} from "@/app/apporteur/dossier/[id]/[jeton]/actions";
/* eslint-enable no-restricted-imports */
import { empreinte, texteDuContrat } from "../contrat-pdf";
import { lireDossierParLien } from "../donnees";
import { jetonDossier } from "../jeton";
import {
  CLES_ACCEPTATIONS,
  CLES_DECLARATIONS,
  LIBELLE_REFUS_SIGNATURE,
  signerContrat,
  valeursDuContrat,
} from "../signature";
import { LIBELLE_REFUS_ADMISSION } from "../regles";
import { appliquerDecision, jugerPiece } from "../verification";

// ── Données fictives ────────────────────────────────────────────────────────────────────────

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
/** SIREN d'exemple (clé de Luhn valide) et SIRET de son siège, calculés ici. */
const SIREN = "123456782";
const SIRET = (() => {
  for (let i = 1; i < 100000; i++) {
    const c = `${SIREN}${String(i).padStart(5, "0")}`;
    if (luhnValid(c)) return c;
  }
  throw new Error("aucun SIRET de test");
})();
/** IBAN d'exemple public (clé valide, n'appartient à personne). */
const IBAN_FICTIF = "FR76 3000 6000 0112 3456 7890 189";
const PRENOM = "Camille";
const NOM = "Exemplaire";
const ADRESSE = "12 rue de l'Exemple 69001 Lyon";

const ENTREPRISE_ACTIVE = {
  ok: true as const,
  entreprise: {
    siren: SIREN,
    denomination: "Camille Exemplaire (EI fictive)",
    adresse: ADRESSE,
    naf: "70.22Z",
    statutSuggere: null,
    diffusionPartielle: false,
    active: true,
    francaise: true,
    personnes: [{ nom: "EXEMPLAIRE", prenoms: "CAMILLE", qualite: null }],
    dirigeantsSocietes: 0,
  },
};
const ENTREPRISE_CESSEE = {
  ok: true as const,
  entreprise: { ...ENTREPRISE_ACTIVE.entreprise, active: false },
};

function nouveauDossier(over: Ligne = {}): void {
  bd.apporteurs.set(ID, {
    id: ID,
    statut: "dossier_en_cours",
    versionLien: 1,
    prenom: PRENOM,
    nom: NOM,
    email: "camille.exemplaire@exemple.invalid",
    telephone: null,
    siren: null,
    denomination: null,
    adresse: null,
    codeNaf: null,
    statutJuridique: null,
    regimeTva: null,
    numeroTva: null,
    iban: null,
    declarations: null,
    dernierMessage: null,
    contratCle: null,
    contratSha256: null,
    contratSigneCle: null,
    contratSigneSha256: null,
    signatureApporteur: null,
    signeParApporteurAt: null,
    signeParSocieteAt: null,
    contresignatureReserveeJusqua: null,
    refuseAt: null,
    resilieAt: null,
    ...over,
  });
}

function formulaire(champs: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) {
    for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  }
  return fd;
}

const jeton = () => jetonDossier(ID, 1)!;

function saisieActivite(extra: Record<string, string> = {}): FormData {
  return formulaire({
    id: ID,
    jeton: jeton(),
    siren: SIRET,
    denomination: "Saisie navigateur",
    adresse: "Adresse navigateur",
    statutJuridique: "micro_entrepreneur",
    regimeTva: "franchise_293b",
    iban: IBAN_FICTIF,
    telephone: "06 12 34 56 78",
    ...extra,
  });
}

function depot(type: "identite" | "rib", id = ID, j = jeton()): FormData {
  const fd = formulaire({ id, jeton: j, type });
  const octets = Buffer.from(`%PDF-1.4\n% pièce fictive ${type}\n%%EOF\n`, "latin1");
  fd.set("fichier", new File([octets], `${type}-fictif.pdf`, { type: "application/pdf" }));
  return fd;
}

function signature(extra: Record<string, string | string[]> = {}): FormData {
  return formulaire({
    id: ID,
    jeton: jeton(),
    nomTape: `${PRENOM} ${NOM}`,
    declarations: [...CLES_DECLARATIONS],
    acceptations: [...CLES_ACCEPTATIONS],
    ...extra,
  });
}

/** Les étapes 1 et 2 réussies : un dossier complet, prêt à signer. */
async function remplirLeDossier(): Promise<void> {
  ext.registre.mockResolvedValue(ENTREPRISE_ACTIVE);
  expect(
    await enregistrerCoordonneesAction(
      formulaire({ id: ID, jeton: jeton(), telephone: "0612345678" }),
    ),
  ).toEqual({ ok: true });
  expect(await enregistrerActiviteAction(saisieActivite())).toEqual({ ok: true });
  expect(await deposerPieceAction(depot("identite"))).toEqual({ ok: true });
  expect(await deposerPieceAction(depot("rib"))).toEqual({ ok: true });
}

const emailsMis = (gabarit: string) => ext.enqueueEmail.mock.calls.filter((c) => c[0] === gabarit);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "secret-de-test-fictif");
  bd.apporteurs.clear();
  bd.pieces.length = 0;
  bd.journal.length = 0;
  bd.siret.clear();
  bd.prochainePiece = 1;
  ext.r2.clear();
  ext.checkRateLimit.mockResolvedValue({ allowed: true });
  ext.enqueueEmail.mockResolvedValue({ enqueued: true });
  ext.registre.mockResolvedValue(ENTREPRISE_ACTIVE);
  nouveauDossier();
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
describe("parcours nominal, étapes 1 à 4, d'un seul tenant", () => {
  it("lien → dossier → contrat → signature → contresignature → e-mail avec pièce jointe", async () => {
    // 1. Le lien (jeton) ouvre le dossier ; un jeton d'une autre version n'ouvre rien.
    const dossier0 = await lireDossierParLien(ID, jeton());
    expect(dossier0).toMatchObject({ id: ID, statut: "dossier_en_cours", prenom: PRENOM });
    expect(await lireDossierParLien(ID, jetonDossier(ID, 2)!)).toBeNull();

    // 2. Saisie : le registre simulé confirme le SIRET actif ; ses valeurs l'emportent sur le navigateur.
    await remplirLeDossier();
    const dossier = (await lireDossierParLien(ID, jeton()))!;
    expect(dossier).toMatchObject({
      siren: SIREN,
      siret: SIRET,
      adresse: ADRESSE,
      denomination: "Camille Exemplaire (EI fictive)",
      statutJuridique: "micro_entrepreneur",
      ibanSaisi: true,
      ibanMasque: "FR76 •••• •••• 0189",
    });
    expect(dossier.pieces.map((p) => p.type).sort()).toEqual(["identite", "rib"]);
    expect(bd.apporteurs.get(ID)!["iban"]).toBe("FR7630006000011234567890189");

    // 3. Le contrat rempli avec la grille, tel que la page l'affiche (« il le lit »).
    const maintenant = new Date("2026-11-25T10:00:00.000Z");
    const valeursLues = valeursDuContrat(dossier, maintenant);
    const texteLu = texteDuContrat(valeursLues);
    expect(texteLu).not.toContain("[à compléter]");
    expect(texteLu).toContain(SIREN);
    expect(texteLu).toContain("EXEMPLAIRE");
    expect(texteLu).toContain("25 novembre 2026"); // la grille est datée du jour
    expect(texteLu).toMatch(/commission/i);

    // … il signe (nom tapé, 4 déclarations, 6 acceptations) : la preuve est enregistrée.
    const res = await signerContrat({
      apporteurId: ID,
      jeton: jeton(),
      nomTape: `${PRENOM} ${NOM}`,
      declarations: [...CLES_DECLARATIONS],
      acceptations: [...CLES_ACCEPTATIONS],
      ipHash: "hash-ip-fictif",
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0 Safari/537.36",
      maintenant,
    });
    expect(res).toEqual({ ok: true, sha256: empreinte(texteLu) });

    const apresSignature = bd.apporteurs.get(ID)!;
    expect(apresSignature["statut"]).toBe("a_verifier");
    expect(apresSignature["contratSha256"]).toBe(empreinte(texteLu));
    expect(apresSignature["signeParApporteurAt"]).toEqual(maintenant);
    const preuve = apresSignature["signatureApporteur"] as Record<string, unknown>;
    expect(preuve).toMatchObject({
      nomTape: `${PRENOM} ${NOM}`,
      signeAt: maintenant.toISOString(),
      ipHash: "hash-ip-fictif",
      texteSha256: empreinte(texteLu),
      texte: texteLu,
    });
    expect(preuve["acceptations"]).toEqual([...CLES_ACCEPTATIONS]);
    expect(preuve["declarations"]).toEqual([...CLES_DECLARATIONS]);
    // Le PDF de l'apporteur (rendu réel) est rangé sous la clé enregistrée.
    const pdfApporteur = ext.r2.get(apresSignature["contratCle"] as string)!;
    expect(pdfApporteur.type).toBe("application/pdf");
    expect(pdfApporteur.octets.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // Alerte interne et accusé à l'apporteur mis en file, une fois chacun.
    expect(emailsMis("apporteur-dossier-a-verifier")).toHaveLength(1);
    const accuse = emailsMis("apporteur-dossier-recu");
    expect(accuse).toHaveLength(1);
    expect(accuse[0]![1]).toBe("camille.exemplaire@exemple.invalid");

    // 4. La société contresigne : pièces jugées conformes, puis décision.
    for (const p of bd.pieces)
      expect(await jugerPiece(p["id"] as string, "conforme", null)).toEqual({ ok: true });
    const avant = ext.enqueueEmail.mock.calls.length;
    const contre = await appliquerDecision(ID, "contresigner", null);
    expect(contre).toEqual({ ok: true, message: "Contrat contresigné et envoyé." });

    const final = bd.apporteurs.get(ID)!;
    expect(final["statut"]).toBe("signe");
    expect(final["signeParSocieteAt"]).toBeInstanceOf(Date);
    const pdfFinal = ext.r2.get(final["contratSigneCle"] as string)!;
    expect(pdfFinal.octets.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(createHash("sha256").update(pdfFinal.octets).digest("hex")).toBe(
      final["contratSigneSha256"],
    );
    // Le PDF des deux parties est un autre fichier que celui de l'apporteur seul.
    expect(final["contratSigneCle"]).not.toBe(apresSignature["contratCle"]);
    expect(pdfFinal.octets.equals(pdfApporteur.octets)).toBe(false);

    // L'e-mail « contrat signé » est en file, avec le PDF final en pièce jointe.
    expect(ext.enqueueEmail.mock.calls.length).toBe(avant + 1);
    const [gabarit, destinataire, , , options] = emailsMis("apporteur-contrat-signe")[0]!;
    expect(gabarit).toBe("apporteur-contrat-signe");
    expect(destinataire).toBe("camille.exemplaire@exemple.invalid");
    expect(options.attachments).toEqual([
      {
        filename: "Contrat-apporteur-Axion-IA.pdf",
        r2Key: final["contratSigneCle"],
        contentType: "application/pdf",
      },
    ]);
    expect(options.entityId).toBe(ID);
  });

  it("la contresignature rejouée (double clic) n'écrit rien de plus et n'envoie rien", async () => {
    await remplirLeDossier();
    expect(await signerAction(signature())).toEqual({ ok: true });
    for (const p of bd.pieces) await jugerPiece(p["id"] as string, "conforme", null);
    expect(await appliquerDecision(ID, "contresigner", null)).toMatchObject({ ok: true });
    const envois = ext.enqueueEmail.mock.calls.length;
    const pdfs = ext.r2.size;
    const seconde = await appliquerDecision(ID, "contresigner", null);
    expect(seconde).toEqual({ ok: false, message: "Ce dossier n'attend pas de vérification." });
    expect(ext.enqueueEmail.mock.calls.length).toBe(envois);
    expect(ext.r2.size).toBe(pdfs);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
describe("cas de refus (étape 5)", () => {
  it("SIREN INACTIF au registre : refusé dès l'étape 2, rien n'est enregistré, aucune signature possible", async () => {
    ext.registre.mockResolvedValue(ENTREPRISE_CESSEE);
    const r = await enregistrerActiviteAction(saisieActivite());
    expect(r).toEqual({ ok: false, message: LIBELLE_REFUS_ADMISSION.siren_inactif });
    expect(bd.apporteurs.get(ID)!["siren"]).toBeNull();
    // Même avec les pièces et les cases, le dossier n'est pas signable : pas de SIREN.
    await deposerPieceAction(depot("identite"));
    await deposerPieceAction(depot("rib"));
    const s = await signerAction(signature());
    expect(s).toEqual({ ok: false, message: LIBELLE_REFUS_SIGNATURE.incomplet });
    expect(bd.apporteurs.get(ID)!["statut"]).toBe("dossier_en_cours");
    expect(ext.r2.size).toBe(0);
    expect(ext.enqueueEmail).not.toHaveBeenCalled();
  });

  it("SIREN ABSENT : la signature est refusée (dossier incomplet), ni PDF ni e-mail", async () => {
    nouveauDossier({
      statutJuridique: "micro_entrepreneur",
      regimeTva: "franchise_293b",
      adresse: ADRESSE,
      iban: "FR7630006000011234567890189",
    });
    await deposerPieceAction(depot("identite"));
    await deposerPieceAction(depot("rib"));
    expect(await signerAction(signature())).toEqual({
      ok: false,
      message: LIBELLE_REFUS_SIGNATURE.incomplet,
    });
    expect(ext.r2.size).toBe(0);
    expect(ext.enqueueEmail).not.toHaveBeenCalled();
  });

  it("SIREN saisi pendant une panne du registre, devenu CESSÉ au moment de signer : refus à la signature", async () => {
    ext.registre.mockResolvedValue({ ok: false, raison: "indisponible" });
    await enregistrerActiviteAction(saisieActivite());
    await deposerPieceAction(depot("identite"));
    await deposerPieceAction(depot("rib"));
    expect(bd.apporteurs.get(ID)!["siren"]).toBe(SIREN); // saisie gardée, marquée « à contrôler »
    ext.registre.mockResolvedValue(ENTREPRISE_CESSEE);
    expect(await signerAction(signature())).toEqual({
      ok: false,
      message: LIBELLE_REFUS_ADMISSION.siren_inactif,
    });
    expect(bd.apporteurs.get(ID)!["statut"]).toBe("dossier_en_cours");
    expect(ext.r2.size).toBe(0);
  });

  it("SIREN signé pendant une panne du registre, CESSÉ ensuite : la contresignature est refusée", async () => {
    ext.registre.mockResolvedValue({ ok: false, raison: "indisponible" });
    await enregistrerActiviteAction(saisieActivite());
    await deposerPieceAction(depot("identite"));
    await deposerPieceAction(depot("rib"));
    expect(await signerAction(signature())).toEqual({ ok: true }); // registre encore muet : on signe
    for (const p of bd.pieces) await jugerPiece(p["id"] as string, "conforme", null);
    ext.registre.mockResolvedValue(ENTREPRISE_CESSEE);
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: false });
    expect(r.message).toContain("fermé au registre public");
    expect(bd.apporteurs.get(ID)!["statut"]).toBe("a_verifier");
    expect(bd.apporteurs.get(ID)!["contratSigneCle"]).toBeNull();
    expect(emailsMis("apporteur-contrat-signe")).toHaveLength(0);
  });

  it("IBAN invalide (clé fausse) ou absent : refusé à l'étape 2, dossier non signable", async () => {
    // Même IBAN d'exemple avec un chiffre changé : la clé de contrôle ne correspond plus.
    const faux = await enregistrerActiviteAction(
      saisieActivite({ iban: "FR76 3000 6000 0112 3456 7890 188" }),
    );
    expect(faux).toMatchObject({ ok: false });
    expect(bd.apporteurs.get(ID)!["iban"]).toBeNull();
    const absent = await enregistrerActiviteAction(saisieActivite({ iban: "" }));
    expect(absent).toEqual({ ok: false, message: "Indiquez votre IBAN." });
    expect(bd.apporteurs.get(ID)!["siren"]).toBeNull(); // rien d'écrit à moitié
    await deposerPieceAction(depot("identite"));
    await deposerPieceAction(depot("rib"));
    expect(await signerAction(signature())).toMatchObject({ ok: false });
    expect(ext.r2.size).toBe(0);
  });

  it("dossier INCOMPLET (pièce manquante, case non cochée, nom tapé faux) : aucune signature", async () => {
    await remplirLeDossier();
    const sansRib = new Map(bd.pieces.map((p) => [p["type"], p]));
    sansRib.get("rib")!["statut"] = "a_retransmettre";
    expect(await signerAction(signature())).toEqual({
      ok: false,
      message: LIBELLE_REFUS_SIGNATURE.incomplet,
    });
    sansRib.get("rib")!["statut"] = "deposee";
    expect(
      await signerAction(signature({ acceptations: CLES_ACCEPTATIONS.slice(1) as string[] })),
    ).toEqual({ ok: false, message: LIBELLE_REFUS_SIGNATURE.cases });
    expect(await signerAction(signature({ nomTape: "Quelqu'un d'Autre" }))).toEqual({
      ok: false,
      message: LIBELLE_REFUS_SIGNATURE.nom,
    });
    expect(bd.apporteurs.get(ID)!["statut"]).toBe("dossier_en_cours");
    expect(ext.r2.size).toBe(0);
    expect(ext.enqueueEmail).not.toHaveBeenCalled();
  });

  it("contrat contenant « [à compléter] » (adresse vide en base) : jamais signé, ni PDF, ni écriture", async () => {
    await remplirLeDossier();
    bd.apporteurs.get(ID)!["adresse"] = "";
    expect(await signerAction(signature())).toEqual({
      ok: false,
      message: LIBELLE_REFUS_SIGNATURE.incomplet,
    });
    expect(bd.apporteurs.get(ID)!["statut"]).toBe("dossier_en_cours");
    expect(bd.apporteurs.get(ID)!["signatureApporteur"]).toBeNull();
    expect(ext.r2.size).toBe(0);
  });

  it("statuts « à vérifier », « signé », « refusé » : plus signables depuis le lien ; « à compléter » : re-signable", async () => {
    await remplirLeDossier();
    for (const statut of ["a_verifier", "signe", "refuse", "resilie"]) {
      bd.apporteurs.get(ID)!["statut"] = statut;
      expect(await signerAction(signature())).toEqual({
        ok: false,
        message: LIBELLE_REFUS_SIGNATURE.non_modifiable,
      });
    }
    expect(ext.r2.size).toBe(0);
    // « À compléter » (Williams a demandé un complément) : l'apporteur corrige puis signe à nouveau.
    bd.apporteurs.get(ID)!["statut"] = "a_completer";
    expect(await signerAction(signature())).toEqual({ ok: true });
    expect(bd.apporteurs.get(ID)!["statut"]).toBe("a_verifier");
  });

  it("jeton FAUX, d'une autre version, tronqué ou d'un autre dossier : page neutre, aucune écriture", async () => {
    await remplirLeDossier();
    const autres = [
      "A".repeat(43),
      jetonDossier(ID, 2)!,
      jeton().slice(0, 20),
      jetonDossier("00000000-0000-4000-8000-000000000001", 1)!,
      "",
    ];
    for (const j of autres) {
      expect(await signerAction(signature({ jeton: j }))).toEqual({
        ok: false,
        message: "Ce lien ne fonctionne plus.",
      });
      expect(await enregistrerActiviteAction(saisieActivite({ jeton: j }))).toMatchObject({
        ok: false,
      });
      expect(await deposerPieceAction(depot("rib", ID, j))).toMatchObject({ ok: false });
    }
    expect(bd.apporteurs.get(ID)!["statut"]).toBe("dossier_en_cours");
    expect(ext.r2.size).toBe(0);
    // Identifiant inconnu avec un jeton bien formé.
    expect(
      await signerAction(signature({ id: "00000000-0000-4000-8000-000000000001" })),
    ).toMatchObject({ ok: false });
  });

  it("DOUBLE signature : la seconde est refusée, une seule preuve et un seul accusé", async () => {
    await remplirLeDossier();
    expect(await signerAction(signature())).toEqual({ ok: true });
    const preuve = bd.apporteurs.get(ID)!["signatureApporteur"];
    expect(await signerAction(signature())).toEqual({
      ok: false,
      message: LIBELLE_REFUS_SIGNATURE.non_modifiable,
    });
    expect(bd.apporteurs.get(ID)!["signatureApporteur"]).toBe(preuve);
    expect(emailsMis("apporteur-dossier-recu")).toHaveLength(1);
    expect(emailsMis("apporteur-dossier-a-verifier")).toHaveLength(1);
  });

  it("DOUBLE signature SIMULTANÉE (deux onglets) : une seule est écrite", async () => {
    await remplirLeDossier();
    const [a, b] = await Promise.all([signerAction(signature()), signerAction(signature())]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect(bd.apporteurs.get(ID)!["statut"]).toBe("a_verifier");
    expect(emailsMis("apporteur-dossier-recu")).toHaveLength(1);
    expect(emailsMis("apporteur-dossier-a-verifier")).toHaveLength(1);
  });

  // ⛔ DÉFAUT RÉEL SUR `main` (corrigé par la PR #2249, `fix/signature-apporteur-empreinte-lue`) :
  // `signerContrat` (src/features/apporteurs-reseau/signature.ts) recalcule le texte du contrat
  // AU MOMENT de la signature et signe ce texte, sans le comparer à ce que la page a AFFICHÉ.
  // Si le dossier (ou la grille datée du jour, au passage de minuit) change entre la lecture et
  // la signature, la personne signe un texte qu'elle n'a pas lu, et la preuve (empreinte)
  // atteste de ce texte-là. Ce test décrit le comportement ATTENDU (refus) ; il est marqué
  // `it.fails` car `main` signe. Quand #2249 est fusionnée, ce test passera « à l'envers » :
  // retirer alors `.fails`.
  it.fails(
    "TEXTE MODIFIÉ entre la lecture et la signature : la signature doit être refusée (défaut sur main)",
    async () => {
      await remplirLeDossier();
      const dossierLu = (await lireDossierParLien(ID, jeton()))!;
      const empreinteLue = empreinte(texteDuContrat(valeursDuContrat(dossierLu, new Date())));

      // Entre-temps, le texte change (ici l'adresse du siège, déclarée à l'étape 2 dans un autre onglet).
      bd.apporteurs.get(ID)!["adresse"] = "99 avenue du Changement 75001 Paris";

      const entree = {
        apporteurId: ID,
        jeton: jeton(),
        nomTape: `${PRENOM} ${NOM}`,
        declarations: [...CLES_DECLARATIONS],
        acceptations: [...CLES_ACCEPTATIONS],
        ipHash: null,
        userAgent: null,
        empreinteLue, // champ introduit par #2249 ; ignoré par main
      };
      const r = await signerContrat(entree);
      expect(r.ok).toBe(false);
      expect(bd.apporteurs.get(ID)!["statut"]).toBe("dossier_en_cours");
      expect(ext.r2.size).toBe(0);
    },
  );
});
