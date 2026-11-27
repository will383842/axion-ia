// CHAÎNE DU CONTRAT APPORTEUR, DE BOUT EN BOUT, SUR LE CODE ACTUEL.
// Données entièrement FICTIVES (SIREN d'exemple, adresses en `.invalid`, aucun appel réseau).
//
// Seul ce qui sort du code est remplacé : Prisma, la file d'e-mails (on LIT ce qu'elle reçoit) et
// R2 (un stockage EN MÉMOIRE, partagé par tous les modules). Tout le reste est le vrai code :
// `jeton`, `signature`, `contrat-pdf` (texte, empreinte ET rendu PDF), `verification`,
// `documents-joints`, le guide de démarrage embarqué, les gabarits d'e-mail.
//
// a) invitation (annexes jointes, #2392)  b) signature en ligne  c) accusé « dossier bien reçu »
// d) e-mail « contrat signé »  e) fiche / livret / guide absents de R2  f) version 2.8
// g) CAS DE REFUS (portés de #2251, base unique des tests de bout en bout du contrat)
import { render } from "@react-email/render";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  /** Faux R2 : clé → contenu. */
  r2: new Map<string, Buffer>(),
  r2EnPanne: false,
  envois: [] as Array<Record<string, unknown>>,
  /** Ligne `ApporteurReseau` simulée (ce que Prisma garderait). */
  ligne: {} as Record<string, unknown>,
  dossier: {} as Record<string, unknown>,
  /** Réponse du registre public ; `null` = entreprise active (défaut). */
  registre: null as unknown,
  /** Lien (jeton) refusé par la page du dossier. */
  lienInvalide: false,
}));

vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: () => true,
  uploadToR2: vi.fn(async (cle: string, contenu: Buffer) => {
    if (h.r2EnPanne) throw new Error("R2 en panne");
    h.r2.set(cle, Buffer.from(contenu));
    return { key: cle, etag: "e", sizeBytes: contenu.byteLength };
  }),
  enteteObjetR2: vi.fn(async (cle: string) => {
    if (h.r2EnPanne) throw new Error("R2 en panne");
    const o = h.r2.get(cle);
    return o ? { taille: o.byteLength, etag: "e" } : null;
  }),
  getObjectBufferR2: vi.fn(async (cle: string) => h.r2.get(cle) ?? null),
  deleteFromR2: vi.fn(async (cle: string) => void h.r2.delete(cle)),
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("../envois", () => ({
  envoyer: vi.fn(async (e: Record<string, unknown>) => {
    h.envois.push(e);
    return "envoye";
  }),
  avecTexteLibre: (payload: Record<string, unknown>) => payload,
}));
vi.mock("../apercu-envoi", () => ({
  apercu: vi.fn(async () => ({ sujet: "s", html: "", destinataire: "" })),
}));
vi.mock("../retrait", () => ({ retraitDe: vi.fn(async () => false) }));
vi.mock("../annuaire", () => {
  const ok = {
    ok: true,
    entreprise: {
      siren: "123456782",
      active: true,
      personnes: [{ nom: "EXEMPLAIRE", prenoms: "CAMILLE", qualite: "Gérant" }],
      dirigeantsSocietes: 0,
    },
  };
  return {
    lireEntrepriseParSiren: async () => h.registre ?? ok,
    lireRegistre: async () => h.registre ?? ok,
  };
});
vi.mock("../donnees", () => ({
  lireDossierParLien: vi.fn(async () => (h.lienInvalide ? null : h.dossier)),
  lireDossier: vi.fn(async () => h.dossier),
  enregistrerDeclarations: vi.fn(),
  purgerContenuPieces: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: {
      findUnique: vi.fn(async () => h.ligne),
      updateMany: vi.fn(
        async (a: { where?: { statut?: unknown }; data: Record<string, unknown> }) => {
          // Écriture conditionnée au statut, comme la vraie base : un dossier déjà passé « à vérifier » n'est pas réécrit.
          const admis = (a.where?.statut as { in?: string[] } | undefined)?.in;
          if (admis && typeof h.ligne["statut"] === "string" && !admis.includes(h.ligne["statut"]))
            return { count: 0 };
          Object.assign(h.ligne, a.data);
          return { count: 1 };
        },
      ),
    },
    activityLog: { create: vi.fn() },
    pieceApporteur: { findMany: vi.fn().mockResolvedValue([]) },
    emailLog: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));

import { ApporteurDossierLienEmail } from "@/lib/email/templates/apporteur-demarrage";
import { SITE_URL } from "@/lib/site-url";

import { empreinte, rendreContratPdf, texteDuContrat } from "../contrat-pdf";
import { CONTRAT_V2_MARKDOWN, CONTRAT_VERSION } from "../contrat-v2";
import { DOCUMENTS_ANNEXES, NOM_CONTRAT_APPORTEUR, NOM_CONTRAT_SIGNE } from "../documents-joints";
import { LIBELLE_REFUS_ADMISSION } from "../regles";
import { jetonDossierValide, urlDossier } from "../jeton";
import {
  CLES_ACCEPTATIONS,
  CLE_REGISTRE_INDISPONIBLE,
  CLES_DECLARATIONS,
  LIBELLE_REFUS_SIGNATURE,
  signerContrat,
  valeursDuContrat,
} from "../signature";
import { appliquerDecision, envoyerLien, renvoyerContratSigne } from "../verification";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const MAINTENANT = new Date("2026-11-27T10:00:00Z");
const [FICHE, LIVRET, GUIDE] = DOCUMENTS_ANNEXES;
const PDF = Buffer.from("%PDF-1.4 fictif");

const dossierEnCours = () => ({
  id: ID,
  statut: "dossier_en_cours",
  versionLien: 1,
  prenom: "Camille",
  nom: "Exemplaire",
  email: "camille.exemplaire@exemple.invalid",
  siren: "123456782",
  siret: null,
  adresse: "12 rue de l'Exemple 69001 Lyon",
  statutJuridique: "micro_entrepreneur",
  regimeTva: "franchise_293b",
  numeroTva: null,
  ibanSaisi: true,
  pieces: [
    { type: "identite", statut: "conforme" },
    { type: "rib", statut: "conforme" },
  ],
});

const entreeSignature = (empreinteLue: string) => ({
  apporteurId: ID,
  jeton: "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd",
  nomTape: "Camille Exemplaire",
  declarations: [...CLES_DECLARATIONS],
  acceptations: [...CLES_ACCEPTATIONS],
  empreinteLue,
  ipHash: "0123456789abcdef",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0 Safari/537.36",
  maintenant: MAINTENANT,
});

/** Ce que la page du dossier affiche et empreint (mêmes fonctions que la signature). */
const empreinteAffichee = () =>
  empreinte(texteDuContrat(valeursDuContrat(h.dossier as never, MAINTENANT)));

const envoi = (gabarit: string) => h.envois.filter((e) => e["gabarit"] === gabarit);
const dernier = (gabarit: string) => envoi(gabarit).at(-1) as Record<string, unknown>;
const pieces = (e: Record<string, unknown>) =>
  (e["attachments"] as Array<{ filename: string; r2Key: string; facultative?: true }>) ?? [];
const noms = (e: Record<string, unknown>) => pieces(e).map((p) => p.filename);

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "secret-de-test");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  h.r2.clear();
  h.r2EnPanne = false;
  h.envois.length = 0;
  h.dossier = dossierEnCours();
  h.ligne = {};
  h.registre = null;
  h.lienInvalide = false;
});

/** Dépose une annexe sur le faux R2 (ce que fait `scripts/apporteurs/deposer-document-joint.ts`). */
const deposer = (cle: string) => h.r2.set(cle, PDF);

/** Joue la signature de l'apporteur puis prépare la ligne que Prisma garderait. */
async function apporteurSigne() {
  const r = await signerContrat(entreeSignature(empreinteAffichee()));
  if (!r.ok) throw new Error(`signature refusée : ${JSON.stringify(r)}`);
  h.dossier = { ...dossierEnCours(), statut: "a_verifier" };
  return r;
}

describe("a) l'e-mail d'invitation part avec le lien du dossier", () => {
  it("envoyerLien : gabarit « apporteur-dossier-lien », vers l'adresse du dossier, lien personnel valide", async () => {
    const r = await envoyerLien(ID, null);
    expect(r).toEqual({ ok: true, message: "Lien envoyé." });
    const e = dernier("apporteur-dossier-lien");
    expect(e["destinataire"]).toBe("camille.exemplaire@exemple.invalid");
    const url = (e["payload"] as { dossierUrl: string }).dossierUrl;
    const m = url.match(/\/apporteur\/dossier\/([0-9a-f-]{36})\/([A-Za-z0-9_-]{43})$/);
    expect(m).not.toBeNull();
    expect(url.startsWith(SITE_URL.replace(/\/+$/, ""))).toBe(true);
    // Le jeton du lien est bien celui que la page du dossier acceptera.
    expect(jetonDossierValide(m![1]!, 1, m![2]!)).toBe(true);
    expect(url).toBe(urlDossier(ID, 1));
  });

  it("le gabarit rendu contient ce lien (bouton) ; sans annexe sur R2, l'invitation part sans pièce jointe (#2392)", async () => {
    await envoyerLien(ID, null);
    const e = dernier("apporteur-dossier-lien");
    const url = (e["payload"] as { dossierUrl: string }).dossierUrl;
    const html = await render(
      <ApporteurDossierLienEmail locale="fr" payload={e["payload"] as Record<string, unknown>} />,
    );
    expect(html).toContain(url);
    expect(pieces(e)).toEqual([]);
    expect(e["payload"]).not.toHaveProperty("annexesJointes");
  });

  it("#2392 : fiche, livret et guide présents sur R2 → joints dès l'invitation (facultatifs), et le gabarit les annonce", async () => {
    deposer(FICHE.cleR2);
    deposer(LIVRET.cleR2);
    deposer(GUIDE.cleR2);
    await envoyerLien(ID, null);
    const e = dernier("apporteur-dossier-lien");
    expect(noms(e)).toEqual([
      "Fiche-des-commissions-Axion-IA.pdf",
      "Livret-apporteur-Axion-IA.pdf",
      GUIDE.nomFichier,
    ]);
    expect(pieces(e).every((p) => p.facultative === true)).toBe(true);
    expect((e["payload"] as { annexesJointes?: string[] }).annexesJointes).toEqual([
      "fiche-commissions",
      "livret",
      "guide-demarrage",
    ]);
    const html = await render(
      <ApporteurDossierLienEmail locale="fr" payload={e["payload"] as Record<string, unknown>} />,
    );
    expect(html).toContain((e["payload"] as { dossierUrl: string }).dossierUrl);
  });

  it("#2392 : une annexe absente ou vide n'est pas jointe, l'invitation part quand même", async () => {
    deposer(LIVRET.cleR2);
    h.r2.set(FICHE.cleR2, Buffer.alloc(0));
    await envoyerLien(ID, null);
    const e = dernier("apporteur-dossier-lien");
    expect(noms(e)).toEqual(["Livret-apporteur-Axion-IA.pdf"]);
    expect((e["payload"] as { annexesJointes?: string[] }).annexesJointes).toEqual(["livret"]);
  });

  it("dossier fermé (refusé) : aucun lien ne part", async () => {
    h.dossier = { ...dossierEnCours(), statut: "refuse" };
    const r = await envoyerLien(ID, null);
    expect(r.ok).toBe(false);
    expect(envoi("apporteur-dossier-lien")).toHaveLength(0);
  });
});

describe("b) la signature en ligne", () => {
  it("texte lu = texte signé : signé, PDF sur R2, empreinte et nom tapé gardés", async () => {
    const r = await apporteurSigne();
    const sig = h.ligne["signatureApporteur"] as Record<string, unknown>;
    expect(sig["texteSha256"]).toBe(r.sha256);
    expect(sig["texteSha256"]).toBe(empreinteAffichee());
    expect(sig["nomTape"]).toBe("Camille Exemplaire");
    expect(h.ligne["statut"]).toBe("a_verifier");
    expect(h.r2.has(h.ligne["contratCle"] as string)).toBe(true);
  });

  it("les 4 déclarations et 6 acceptations sont exigées : une case manquante = refus, rien d'écrit", async () => {
    for (const retirer of ["declarations", "acceptations"] as const) {
      const e = entreeSignature(empreinteAffichee());
      const r = await signerContrat({ ...e, [retirer]: e[retirer].slice(1) });
      expect(r.ok).toBe(false);
    }
    expect(h.r2.size).toBe(0);
    expect(h.ligne).toEqual({});
  });

  it("🔴 le texte a changé depuis l'affichage (empreinte lue différente) : refus, rien n'est écrit ni envoyé", async () => {
    const r = await signerContrat(entreeSignature("a".repeat(64)));
    expect(r).toMatchObject({ ok: false, message: LIBELLE_REFUS_SIGNATURE.texte_modifie });
    expect(h.r2.size).toBe(0);
    expect(h.ligne).toEqual({});
    expect(h.envois).toHaveLength(0);
  });

  it("🔴 empreinte du texte d'une AUTRE version du contrat : refus", async () => {
    const ancien = empreinte(
      texteDuContrat(valeursDuContrat(h.dossier as never, MAINTENANT)) + " ancienne version",
    );
    const r = await signerContrat(entreeSignature(ancien));
    expect(r.ok).toBe(false);
    expect(h.r2.size).toBe(0);
  });
});

describe("c) l'accusé « dossier bien reçu » porte le contrat signé", () => {
  it("une seule pièce : le contrat signé PAR L'APPORTEUR, lu depuis R2, facultative", async () => {
    await apporteurSigne();
    const accuse = dernier("apporteur-dossier-recu");
    expect(accuse["destinataire"]).toBe("camille.exemplaire@exemple.invalid");
    expect(noms(accuse)).toEqual([NOM_CONTRAT_APPORTEUR]);
    expect(pieces(accuse)[0]).toMatchObject({ r2Key: h.ligne["contratCle"], facultative: true });
    // La pièce nommée est réellement sur R2 : c'est un vrai PDF, pas une référence morte.
    expect(
      h.r2
        .get(h.ligne["contratCle"] as string)!
        .subarray(0, 4)
        .toString(),
    ).toBe("%PDF");
  });

  it("l'alerte interne « à vérifier » ne porte aucune pièce (aucun contrat ne sort vers Axion)", async () => {
    await apporteurSigne();
    expect(dernier("apporteur-dossier-a-verifier")).not.toHaveProperty("attachments");
  });

  it("R2 en panne à l'accusé : l'accusé part quand même, sans pièce", async () => {
    // Le dépôt du PDF réussit, puis R2 tombe avant la lecture de l'en-tête de l'accusé.
    const { enteteObjetR2 } = await import("@/lib/r2-storage");
    vi.mocked(enteteObjetR2).mockRejectedValueOnce(new Error("R2 en panne"));
    await apporteurSigne();
    expect(envoi("apporteur-dossier-recu")).toHaveLength(1);
    expect(dernier("apporteur-dossier-recu")).not.toHaveProperty("attachments");
  });
});

describe("d) l'e-mail « contrat signé » (contresignature)", () => {
  async function contresigne() {
    await apporteurSigne();
    h.envois.length = 0;
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: true });
    return r as { ok: true; message: string };
  }

  it("fiche, livret et guide PRÉSENTS sur R2 : contrat des deux parties + les trois annexes, dans cet ordre", async () => {
    deposer(FICHE.cleR2);
    deposer(LIVRET.cleR2);
    deposer(GUIDE.cleR2);
    const r = await contresigne();
    const e = dernier("apporteur-contrat-signe");
    expect(noms(e)).toEqual([
      NOM_CONTRAT_SIGNE,
      "Fiche-des-commissions-Axion-IA.pdf",
      "Livret-apporteur-Axion-IA.pdf",
      GUIDE.nomFichier,
    ]);
    // Le contrat est EXIGÉ (le texte de l'e-mail dit « en pièce jointe »), les annexes sont facultatives.
    expect(pieces(e)[0]).not.toHaveProperty("facultative");
    expect(
      pieces(e)
        .slice(1)
        .every((p) => p.facultative === true),
    ).toBe(true);
    // Le contrat joint est celui des deux parties, déposé à la contresignature.
    expect(pieces(e)[0]!.r2Key).toBe(h.ligne["contratSigneCle"]);
    expect(pieces(e)[0]!.r2Key).not.toBe(h.ligne["contratCle"]);
    expect(r.message).toBe(
      "Contrat contresigné et envoyé. Pièces jointes : le contrat, la fiche des commissions, le livret et le guide de démarrage.",
    );
    expect(h.ligne["statut"]).toBe("signe");
  });

  it("l'e-mail porte le lien de l'espace de l'apporteur", async () => {
    await contresigne();
    const url = (dernier("apporteur-contrat-signe")["payload"] as { dossierUrl: string })
      .dossierUrl;
    expect(url).toBe(urlDossier(ID, 1));
  });

  it("le renvoi (« Renvoyer le contrat signé ») joint les mêmes pièces", async () => {
    deposer(FICHE.cleR2);
    deposer(LIVRET.cleR2);
    deposer(GUIDE.cleR2);
    await contresigne();
    h.dossier = { ...dossierEnCours(), statut: "signe" };
    h.envois.length = 0;
    const r = await renvoyerContratSigne(ID, new Date("2026-11-28T09:00:00Z"));
    expect(r.ok).toBe(true);
    expect(noms(dernier("apporteur-contrat-signe"))).toEqual([
      NOM_CONTRAT_SIGNE,
      "Fiche-des-commissions-Axion-IA.pdf",
      "Livret-apporteur-Axion-IA.pdf",
      GUIDE.nomFichier,
    ]);
  });
});

describe("e) fiche ou livret manquent sur R2", () => {
  async function contresigne() {
    await apporteurSigne();
    h.envois.length = 0;
    return (await appliquerDecision(ID, "contresigner", null)) as { ok: true; message: string };
  }

  it("🔴 aucune annexe sur R2 : l'e-mail PART quand même, avec le contrat seul ; la console le dit", async () => {
    const r = await contresigne();
    expect(noms(dernier("apporteur-contrat-signe"))).toEqual([NOM_CONTRAT_SIGNE]);
    expect(r.message).toBe(
      "Contrat contresigné et envoyé. Pièce jointe : le contrat seul. Non joints (absents ou illisibles sur le stockage) : la fiche des commissions, le livret et le guide de démarrage.",
    );
    // Aucune annexe n'est jamais fabriquée à l'envoi : elles sont déposées à la main sur R2.
    for (const a of [FICHE, LIVRET, GUIDE]) expect(h.r2.has(a.cleR2)).toBe(false);
  });

  it("le livret seul manque : contrat + fiche + guide", async () => {
    deposer(FICHE.cleR2);
    deposer(GUIDE.cleR2);
    const r = await contresigne();
    expect(noms(dernier("apporteur-contrat-signe"))).toEqual([
      NOM_CONTRAT_SIGNE,
      "Fiche-des-commissions-Axion-IA.pdf",
      GUIDE.nomFichier,
    ]);
    expect(r.message).toContain("Non joint (absent ou illisible sur le stockage) : le livret.");
  });

  it("🔴 un fichier vide sur R2 n'est pas joint", async () => {
    h.r2.set(FICHE.cleR2, Buffer.alloc(0));
    deposer(LIVRET.cleR2);
    await contresigne();
    expect(noms(dernier("apporteur-contrat-signe"))).not.toContain(
      "Fiche-des-commissions-Axion-IA.pdf",
    );
    expect(noms(dernier("apporteur-contrat-signe"))).toContain("Livret-apporteur-Axion-IA.pdf");
  });

  it("R2 en panne au moment de l'envoi : le contrat reste dans la liste (le worker réessaie), aucune annexe", async () => {
    await apporteurSigne();
    h.envois.length = 0;
    // Le dépôt du contrat contresigné réussit ; R2 tombe ensuite (lecture des en-têtes).
    const { enteteObjetR2 } = await import("@/lib/r2-storage");
    vi.mocked(enteteObjetR2).mockRejectedValue(new Error("R2 en panne"));
    try {
      const r = await appliquerDecision(ID, "contresigner", null);
      expect(r).toMatchObject({ ok: true });
      expect(noms(dernier("apporteur-contrat-signe"))).toEqual([NOM_CONTRAT_SIGNE]);
    } finally {
      vi.mocked(enteteObjetR2).mockImplementation(async (cle: string) => {
        const o = h.r2.get(cle);
        return o ? { taille: o.byteLength, etag: "e" } : null;
      });
    }
  });
});

describe("f) la version du contrat présentée est la 2.8", () => {
  it("la version déclarée est « 2.8 » et le texte présenté à la signature la nomme", () => {
    expect(CONTRAT_VERSION).toBe("2.8");
    const texte = texteDuContrat(valeursDuContrat(dossierEnCours() as never, MAINTENANT));
    expect(texte).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(texte).not.toContain("[à compléter]");
    expect(CONTRAT_V2_MARKDOWN).toContain("**2.8 — Période de démarrage.**");
    expect(texte).toContain("2.8 — Période de démarrage");
  });

  it("la signature garde « version : 2.8 » avec le texte exact signé", async () => {
    await apporteurSigne();
    const sig = h.ligne["signatureApporteur"] as {
      version: string;
      texte: string;
      texteSha256: string;
    };
    expect(sig.version).toBe("2.8");
    expect(empreinte(sig.texte)).toBe(sig.texteSha256);
    expect(sig.texte).toContain("2.8 — Période de démarrage");
  });

  it("le PDF se rend, et la contresignature le fait avec la version signée (2.8)", async () => {
    const pdf = await rendreContratPdf({
      version: "2.8",
      texte: texteDuContrat(valeursDuContrat(dossierEnCours() as never, MAINTENANT)),
      apporteur: {
        nomTape: "Camille Exemplaire",
        signeAt: "27 novembre 2026 à 11:00",
        ipHash: "0123456789abcdef",
        navigateur: "Chrome sur Linux",
        acceptations: [...CLES_ACCEPTATIONS],
        declarations: [...CLES_DECLARATIONS],
      },
      societe: null,
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(5_000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// g) CAS DE REFUS — portés de la PR #2251 (« parcours signature »), adaptés à cette harness.
// Dans chaque cas : rien n'est écrit, aucun PDF n'est rangé, aucun e-mail ne part.
describe("g) cas de refus", () => {
  const ENTREPRISE_CESSEE = {
    ok: true as const,
    entreprise: {
      siren: "123456782",
      active: false,
      francaise: true,
      personnes: [{ nom: "EXEMPLAIRE", prenoms: "CAMILLE", qualite: "Gérant" }],
      dirigeantsSocietes: 0,
    },
  };
  const rienNEstSorti = () => {
    expect(h.r2.size).toBe(0);
    expect(h.envois).toHaveLength(0);
    expect(h.ligne["signatureApporteur"]).toBeUndefined();
  };

  it("SIREN ABSENT : la signature est refusée (dossier incomplet), ni PDF ni e-mail", async () => {
    h.dossier = { ...dossierEnCours(), siren: null };
    const r = await signerContrat(entreeSignature(empreinteAffichee()));
    expect(r).toMatchObject({ ok: false, message: LIBELLE_REFUS_SIGNATURE.incomplet });
    rienNEstSorti();
  });

  it("dossier INCOMPLET (pièce à retransmettre, case non cochée, nom tapé faux) : aucune signature", async () => {
    h.dossier = {
      ...dossierEnCours(),
      pieces: [
        { type: "identite", statut: "deposee" },
        { type: "rib", statut: "a_retransmettre" },
      ],
    };
    expect(await signerContrat(entreeSignature(empreinteAffichee()))).toMatchObject({
      ok: false,
      message: LIBELLE_REFUS_SIGNATURE.incomplet,
    });
    h.dossier = dossierEnCours();
    const e = entreeSignature(empreinteAffichee());
    expect(await signerContrat({ ...e, acceptations: CLES_ACCEPTATIONS.slice(1) })).toMatchObject({
      ok: false,
      message: LIBELLE_REFUS_SIGNATURE.cases,
    });
    expect(await signerContrat({ ...e, nomTape: "Quelqu'un d'Autre" })).toMatchObject({
      ok: false,
      message: LIBELLE_REFUS_SIGNATURE.nom,
    });
    rienNEstSorti();
  });

  it("contrat contenant « [à compléter] » (adresse vide) : jamais signé, ni PDF, ni écriture", async () => {
    h.dossier = { ...dossierEnCours(), adresse: "" };
    const r = await signerContrat(entreeSignature(empreinteAffichee()));
    expect(r).toMatchObject({ ok: false, message: LIBELLE_REFUS_SIGNATURE.incomplet });
    rienNEstSorti();
  });

  it("statuts « à vérifier », « signé », « refusé », « résilié » : plus signables ; « à compléter » : re-signable", async () => {
    for (const statut of ["a_verifier", "signe", "refuse", "resilie"]) {
      h.dossier = { ...dossierEnCours(), statut };
      expect(await signerContrat(entreeSignature(empreinteAffichee()))).toMatchObject({
        ok: false,
        message: LIBELLE_REFUS_SIGNATURE.non_modifiable,
      });
    }
    rienNEstSorti();
    h.dossier = { ...dossierEnCours(), statut: "a_completer" };
    h.ligne["statut"] = "a_completer";
    expect((await signerContrat(entreeSignature(empreinteAffichee()))).ok).toBe(true);
    expect(h.ligne["statut"]).toBe("a_verifier");
  });

  it("lien (jeton) refusé par la page du dossier, ou dossier retiré : « introuvable », aucune écriture", async () => {
    h.lienInvalide = true;
    expect(await signerContrat(entreeSignature("a".repeat(64)))).toMatchObject({
      ok: false,
      raison: "introuvable",
    });
    h.lienInvalide = false;
    h.dossier = { ...dossierEnCours(), restreint: true };
    expect(await signerContrat(entreeSignature("a".repeat(64)))).toMatchObject({
      ok: false,
      raison: "introuvable",
    });
    rienNEstSorti();
  });

  it("DOUBLE signature : la seconde est refusée, une seule preuve et un seul accusé", async () => {
    await apporteurSigne();
    const preuve = h.ligne["signatureApporteur"];
    const seconde = await signerContrat(entreeSignature(empreinteAffichee()));
    expect(seconde).toMatchObject({ ok: false, message: LIBELLE_REFUS_SIGNATURE.non_modifiable });
    expect(h.ligne["signatureApporteur"]).toBe(preuve);
    expect(envoi("apporteur-dossier-recu")).toHaveLength(1);
    expect(envoi("apporteur-dossier-a-verifier")).toHaveLength(1);
  });

  it("DOUBLE signature SIMULTANÉE (deux onglets) : une seule est écrite (écriture conditionnée au statut)", async () => {
    h.ligne["statut"] = "dossier_en_cours";
    const e = entreeSignature(empreinteAffichee());
    const [a, b] = await Promise.all([signerContrat(e), signerContrat(e)]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect(h.ligne["statut"]).toBe("a_verifier");
    expect(envoi("apporteur-dossier-recu")).toHaveLength(1);
    expect(envoi("apporteur-dossier-a-verifier")).toHaveLength(1);
  });

  it("SIREN saisi pendant une panne du registre, devenu CESSÉ au moment de signer : refus à la signature", async () => {
    h.ligne["declarations"] = { [CLE_REGISTRE_INDISPONIBLE]: true };
    h.registre = ENTREPRISE_CESSEE;
    const r = await signerContrat(entreeSignature(empreinteAffichee()));
    expect(r).toMatchObject({ ok: false, message: LIBELLE_REFUS_ADMISSION.siren_inactif });
    expect(h.r2.size).toBe(0);
    expect(h.envois).toHaveLength(0);
    expect(h.ligne["signatureApporteur"]).toBeUndefined();
  });

  it("SIREN signé pendant une panne du registre, CESSÉ ensuite : la contresignature est refusée", async () => {
    h.registre = { ok: false, raison: "indisponible" };
    await apporteurSigne(); // registre muet : on signe
    h.envois.length = 0;
    h.registre = ENTREPRISE_CESSEE;
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: false });
    expect(r.message).toContain("cessée au registre public");
    expect(h.ligne["contratSigneCle"]).toBeUndefined();
    expect(envoi("apporteur-contrat-signe")).toHaveLength(0);
  });

  it("registre muet à la contresignature : bloquée tant qu'il ne confirme pas", async () => {
    await apporteurSigne();
    h.envois.length = 0;
    h.registre = { ok: false, raison: "indisponible" };
    const r = await appliquerDecision(ID, "contresigner", null);
    expect(r).toMatchObject({ ok: false });
    expect(r.message).toContain("le registre public ne répond pas");
    expect(envoi("apporteur-contrat-signe")).toHaveLength(0);
  });

  it("la contresignature rejouée (double clic) n'écrit rien de plus et n'envoie rien", async () => {
    await apporteurSigne();
    h.envois.length = 0;
    expect(await appliquerDecision(ID, "contresigner", null)).toMatchObject({ ok: true });
    expect(envoi("apporteur-contrat-signe")).toHaveLength(1);
    h.dossier = { ...dossierEnCours(), statut: "signe" };
    const r2avant = h.r2.size;
    const seconde = await appliquerDecision(ID, "contresigner", null);
    expect(seconde).toEqual({ ok: false, message: "Ce dossier n'attend pas de vérification." });
    expect(envoi("apporteur-contrat-signe")).toHaveLength(1);
    expect(h.r2.size).toBe(r2avant);
  });
});
