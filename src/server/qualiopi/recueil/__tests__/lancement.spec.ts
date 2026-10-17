/**
 * Chantier QNC, L03 — envoi AUTOMATIQUE du recueil à l'entreprise, relance,
 * retour tracé dans le dossier de la session. Éteint = rien ne change.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { chiffrerParole } from "@/lib/chiffrer-parole";

import { CLE_DE_TEST } from "../../../../../tests/outils/fixtures-enregistreur";

import { questionsDuGabarit } from "../gabarit";
import { lancerRecueil, relancerRecueils, tracerRetours, type PortEnvoi } from "../lancement";
import { fauxMonde } from "./monde-faux";

const SESSION = "22222222-2222-4222-8222-222222222222";
const PROJET = "66666666-6666-4666-8666-666666666666";
const CLIENT = "77777777-7777-4777-8777-777777777777";

beforeEach(() => {
  vi.stubEnv("PII_ENCRYPTION_KEY", CLE_DE_TEST);
  vi.stubEnv("AUTH_SECRET", "secret-de-test-0123456789");
});

const envoiOk = (): PortEnvoi & { appels: unknown[] } => {
  const appels: unknown[] = [];
  const f = Object.assign(
    async (a: unknown) => {
      appels.push(a);
      return { parti: true, garePourValidation: false } as const;
    },
    { appels },
  );
  return f;
};

describe("lancerRecueil", () => {
  it("ÉTEINT : ne lit rien, n'écrit rien, n'envoie rien", async () => {
    const m = fauxMonde({ interrupteur: "eteint" });
    const envoi = envoiOk();
    const r = await lancerRecueil(m.db, { sessionId: SESSION, auteurId: null }, envoi);
    expect(r).toEqual({ etat: "eteint" });
    expect(m.ecritures()).toBe(0);
    expect(envoi.appels).toHaveLength(0);
  });

  it("EN ESSAI, une session réelle n'est pas touchée", async () => {
    const m = fauxMonde({ interrupteur: "essai", session: { estTestInterne: false } });
    const envoi = envoiOk();
    const r = await lancerRecueil(m.db, { sessionId: SESSION, auteurId: null }, envoi);
    expect(r).toEqual({ etat: "eteint" });
    expect(m.ecritures()).toBe(0);
  });

  it("crée le questionnaire : gabarit + questions des faits, en ligne, rattaché au projet", async () => {
    const m = fauxMonde({
      interrupteur: "actif",
      questionsDesFaits: [
        {
          texte: chiffrerParole("Quel outil utilisez-vous pour la paie ?"),
          typeVise: "outil_utilise",
        },
      ],
    });
    const envoi = envoiOk();
    const r = await lancerRecueil(m.db, { sessionId: SESSION, auteurId: null }, envoi);
    expect(r).toMatchObject({ etat: "lance", envoye: true });
    const q = m.questionnaires[m.questionnaires.length - 1]!;
    // Le brouillon préparé depuis les faits reste : rien ne s'efface.
    expect(m.questionnaires[0]).toMatchObject({ statut: "brouillon", modele: "modele-ia" });
    expect(q).toMatchObject({
      projetId: PROJET,
      clientId: CLIENT,
      mode: "en_ligne",
      statut: "copie",
      modele: "recueil_besoin_v1",
    });
    const gabarit = questionsDuGabarit();
    expect(q.questions).toHaveLength(gabarit.length + 1);
    expect(q.questions.map((x) => x.ordre)).toEqual(q.questions.map((_, i) => i + 1));
    // Le gabarit d'abord, la question des faits ensuite.
    expect(q.questions[gabarit.length]!.texte).toBe(m.questionnaires[0]!.questions[0]!.texte);
    // Rien n'est écrit en clair : tout passe par chiffrerParole.
    for (const x of q.questions) expect(x.texte).not.toContain("Qu'attendez-vous");
  });

  it("envoie UN e-mail à l'entreprise avec le lien, trace la remise dans la session", async () => {
    const m = fauxMonde({ interrupteur: "actif" });
    const envoi = envoiOk();
    await lancerRecueil(m.db, { sessionId: SESSION, auteurId: null }, envoi);
    expect(envoi.appels).toHaveLength(1);
    const a = envoi.appels[0] as { destinataire: string; url: string; rang: number };
    expect(a.destinataire).toBe("drh@acme.test");
    expect(a.url).toMatch(/^https?:\/\/.+\/questionnaire\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{43}$/);
    expect(a.rang).toBe(0);
    expect(m.remises).toHaveLength(1);
    expect(m.remises[0]).toMatchObject({
      sessionId: SESSION,
      nature: "remise",
      destinataire: "entreprise",
      canal: "email",
      objet: "recueil_besoin",
      auteurId: null,
    });
  });

  it("est IDEMPOTENT : une seconde demande n'envoie rien de plus", async () => {
    const m = fauxMonde({ interrupteur: "actif" });
    const envoi = envoiOk();
    await lancerRecueil(m.db, { sessionId: SESSION, auteurId: null }, envoi);
    const r = await lancerRecueil(m.db, { sessionId: SESSION, auteurId: null }, envoi);
    expect(r).toMatchObject({ etat: "deja_lance" });
    expect(envoi.appels).toHaveLength(1);
    expect(m.questionnaires).toHaveLength(1);
  });

  it("refuse sans adresse de contact : rien n'est créé à moitié", async () => {
    const m = fauxMonde({ interrupteur: "actif", contactEmail: "" });
    const r = await lancerRecueil(m.db, { sessionId: SESSION, auteurId: null }, envoiOk());
    expect(r).toMatchObject({ etat: "refuse" });
    expect(m.questionnaires).toHaveLength(0);
  });

  it("rattache AUTOMATIQUEMENT l'unique projet ouvert du client", async () => {
    const m = fauxMonde({ interrupteur: "actif", session: { projetId: null } });
    await lancerRecueil(m.db, { sessionId: SESSION, auteurId: null }, envoiOk());
    expect(m.session.projetId).toBe(PROJET);
  });

  it("n'invente pas : plusieurs projets ouverts → refus, rien n'est rattaché", async () => {
    const m = fauxMonde({
      interrupteur: "actif",
      session: { projetId: null },
      projetsOuverts: ["p-a", "p-b"],
    });
    const r = await lancerRecueil(m.db, { sessionId: SESSION, auteurId: null }, envoiOk());
    expect(r).toMatchObject({ etat: "refuse" });
    expect(m.session.projetId).toBeNull();
    expect(m.questionnaires).toHaveLength(0);
  });

  it("e-mail non parti : le questionnaire existe, aucune remise n'est tracée", async () => {
    const m = fauxMonde({ interrupteur: "actif" });
    const echec: PortEnvoi = async () => ({ parti: false, garePourValidation: false });
    const r = await lancerRecueil(m.db, { sessionId: SESSION, auteurId: null }, echec);
    expect(r).toMatchObject({ etat: "lance", envoye: false });
    expect(m.questionnaires).toHaveLength(1);
    expect(m.remises).toHaveLength(0);
  });
});

describe("relancerRecueils", () => {
  const J = 24 * 3600 * 1000;
  const lance = async (m: ReturnType<typeof fauxMonde>, t0: Date) => {
    await lancerRecueil(m.db, { sessionId: SESSION, auteurId: null }, envoiOk(), t0);
  };

  it("ne relance PAS avant 3 jours", async () => {
    const m = fauxMonde({ interrupteur: "actif" });
    const t0 = new Date("2026-10-12T08:00:00Z");
    await lance(m, t0);
    const envoi = envoiOk();
    const b = await relancerRecueils(m.db, envoi, new Date(t0.getTime() + 2 * J));
    expect(b.relances).toBe(0);
    expect(envoi.appels).toHaveLength(0);
  });

  it("relance à 3 jours, journalise le rang, puis 2 relances AU PLUS", async () => {
    const m = fauxMonde({ interrupteur: "actif" });
    const t0 = new Date("2026-10-12T08:00:00Z");
    await lance(m, t0);
    const envoi = envoiOk();
    await relancerRecueils(m.db, envoi, new Date(t0.getTime() + 3 * J));
    expect(m.relances.map((r) => r.rang)).toEqual([1]);
    expect(m.relances[0]).toMatchObject({
      sessionId: SESSION,
      objet: "recueil_besoin",
      destinataire: "entreprise",
      canal: "email",
      automatique: true,
    });
    await relancerRecueils(m.db, envoi, new Date(t0.getTime() + 3 * J + 1000)); // trop tôt
    await relancerRecueils(m.db, envoi, new Date(t0.getTime() + 6 * J));
    await relancerRecueils(m.db, envoi, new Date(t0.getTime() + 20 * J));
    expect(m.relances.map((r) => r.rang)).toEqual([1, 2]);
    expect(envoi.appels).toHaveLength(2);
  });

  it("ne relance plus une fois les réponses reçues", async () => {
    const m = fauxMonde({ interrupteur: "actif" });
    const t0 = new Date("2026-10-12T08:00:00Z");
    await lance(m, t0);
    m.questionnaires[0]!.statut = "reponse_recue";
    const envoi = envoiOk();
    await relancerRecueils(m.db, envoi, new Date(t0.getTime() + 9 * J));
    expect(envoi.appels).toHaveLength(0);
  });

  it("ÉTEINT : rien", async () => {
    const m = fauxMonde({ interrupteur: "eteint" });
    const envoi = envoiOk();
    const b = await relancerRecueils(m.db, envoi, new Date());
    expect(b).toMatchObject({ relances: 0 });
    expect(m.ecritures()).toBe(0);
  });
});

describe("tracerRetours", () => {
  it("range le retour dans la session, daté de la réponse, UNE seule fois", async () => {
    const m = fauxMonde({ interrupteur: "actif" });
    const t0 = new Date("2026-10-12T08:00:00Z");
    await lancerRecueil(m.db, { sessionId: SESSION, auteurId: null }, envoiOk(), t0);
    const q = m.questionnaires[0]!;
    q.statut = "reponse_recue";
    q.reponseRecueLe = new Date("2026-10-13T14:00:00Z");
    expect((await tracerRetours(m.db)).traces).toBe(1);
    expect((await tracerRetours(m.db)).traces).toBe(0);
    const retour = m.remises.find((r) => r.nature === "reponse")!;
    expect(retour).toMatchObject({
      sessionId: SESSION,
      destinataire: "entreprise",
      objet: "recueil_besoin",
      remiseId: m.remises[0]!.id,
    });
    expect(retour.survenuLe).toEqual(q.reponseRecueLe);
  });

  it("ÉTEINT : rien", async () => {
    const m = fauxMonde({ interrupteur: "eteint" });
    expect(await tracerRetours(m.db)).toEqual({ traces: 0 });
    expect(m.ecritures()).toBe(0);
  });
});
