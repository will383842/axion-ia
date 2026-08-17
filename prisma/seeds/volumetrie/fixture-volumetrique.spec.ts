/**
 * T0 — ce que la fixture volumétrique doit garantir, vérifié SANS base.
 *
 * Deux familles de tests, et la seconde compte davantage que la première :
 *
 * 1. **Les volumes et les invariants** — une fixture qui dérive silencieusement
 *    rend toutes les mesures postérieures incomparables sans que rien ne le dise.
 * 2. **La garde de cible vue REFUSER** — c'est la seule opération de ce dépôt
 *    dont une exécution accidentelle contre la production serait irréparable
 *    sans restauration de sauvegarde. Une garde qu'on n'a jamais vue rougir
 *    n'est pas une garde, c'est une intention.
 */

import { describe, expect, it } from "vitest";
import { cibleAutorisee } from "./garde-cible";
import { construireFixture, VOLUMES, PREFIXE_FIXTURE } from "./fixture-volumetrique";

const REFERENCE = new Date("2026-08-16T00:00:00.000Z");
const f = construireFixture({ graine: 20260816, maintenant: REFERENCE });

describe("les volumes sont exactement ceux du plan", () => {
  it.each([
    ["formateurs", f.formateurs.length, VOLUMES.formateurs],
    ["clients", f.clients.length, VOLUMES.clients],
    ["formations", f.formations.length, VOLUMES.formations],
    ["sessions", f.sessions.length, VOLUMES.sessions],
    ["stagiaires", f.stagiaires.length, VOLUMES.stagiaires],
    ["inscriptions", f.inscriptions.length, VOLUMES.inscriptions],
    ["documents", f.documents.length, VOLUMES.documents],
    ["alertes ouvertes", f.alertes.length, VOLUMES.alertesOuvertes],
  ])("%s : %i = %i", (_nom, obtenu, attendu) => {
    expect(obtenu).toBe(attendu);
  });

  it("les alertes sont toutes OUVERTES — une alerte résolue ne coûte rien", () => {
    expect(f.alertes.every((a) => a["resolue"] === false && a["lu"] === false)).toBe(true);
  });
});

describe("🔴 un tiers des sessions porte PLUSIEURS financeurs — sans quoi V5 reste invisible", () => {
  it("400 sessions inter-entreprises, chacune avec son dossier", () => {
    expect(f.dossiers.length).toBe(VOLUMES.sessionsInterEntreprises);
    expect(f.sessions.filter((s) => s["interEntreprises"] === true).length).toBe(
      VOLUMES.sessionsInterEntreprises,
    );
  });

  it("chaque dossier a AU MOINS deux créances", () => {
    // Un dossier à une seule créance n'exerce rien : la ventilation ne ventile
    // pas, et le reste à charge est une addition à un terme.
    const minimum = Math.min(...f.dossiers.map((d) => d.payeurs.length));
    expect(
      minimum,
      "un dossier n'a qu'un seul payeur — le cas multi-payeurs n'est pas exercé",
    ).toBeGreaterThanOrEqual(2);
  });

  it("🔴 la somme des créances égale EXACTEMENT le montant de la session", () => {
    // Si la répartition ne sommait pas au total, la fixture fabriquerait un
    // reste à charge faux — et prouverait un défaut qu'elle a créé elle-même.
    const sessionsParId = new Map(f.sessions.map((s) => [s["id"] as string, s]));
    for (const d of f.dossiers) {
      const session = sessionsParId.get(d.dossier["trainingSessionId"] as string)!;
      const somme = d.payeurs.reduce((t, p) => t + (p["montantAttenduCents"] as number), 0);
      expect(somme, `dossier ${d.dossier["numeroDossierExterne"]}`).toBe(session["montantHtCents"]);
    }
  });

  it("aucune créance négative ou nulle", () => {
    const parts = f.dossiers.flatMap((d) =>
      d.payeurs.map((p) => p["montantAttenduCents"] as number),
    );
    expect(Math.min(...parts)).toBeGreaterThan(0);
  });

  it("les sessions inter-entreprises ne sont jamais en financement direct", () => {
    const inter = f.sessions.filter((s) => s["interEntreprises"] === true);
    expect(inter.every((s) => s["financementType"] !== "direct")).toBe(true);
  });
});

describe("🔴 tout est marqué — c'est ce qui rend la fixture annulable", () => {
  // Une seule ligne sans marqueur survivrait à la purge ET ressemblerait à une
  // donnée réelle. Elle empoisonnerait la mesure suivante sans qu'on sache d'où
  // elle vient.
  it.each([
    ["clients", () => f.clients.map((x) => x["numero"] as string)],
    ["formations", () => f.formations.map((x) => x["numero"] as string)],
    ["sessions", () => f.sessions.map((x) => x["numero"] as string)],
    ["documents", () => f.documents.map((x) => x["numero"] as string)],
    ["alertes", () => f.alertes.map((x) => x["code"] as string)],
    ["dossiers", () => f.dossiers.map((d) => d.dossier["numeroDossierExterne"] as string)],
  ])("%s : chaque numéro porte le préfixe", (_nom, lire) => {
    const sansPrefixe = lire().filter((n) => !n.startsWith(PREFIXE_FIXTURE));
    expect(sansPrefixe.slice(0, 5)).toEqual([]);
  });

  it("aucune adresse e-mail ne peut recevoir : domaine réservé RFC 6761", () => {
    const emails = [
      ...f.formateurs.map((x) => x["email"] as string),
      ...f.stagiaires.map((x) => x["email"] as string),
    ];
    expect(emails.filter((e) => !e.endsWith(".invalid")).slice(0, 5)).toEqual([]);
  });
});

describe("la fixture est reproductible — sinon deux mesures ne se comparent pas", () => {
  it("même graine, même base", () => {
    const bis = construireFixture({ graine: 20260816, maintenant: REFERENCE });
    expect(JSON.stringify(bis.sessions.slice(0, 50))).toBe(JSON.stringify(f.sessions.slice(0, 50)));
  });

  it("graine différente, données différentes", () => {
    const autre = construireFixture({ graine: 7, maintenant: REFERENCE });
    expect(JSON.stringify(autre.sessions.slice(0, 50))).not.toBe(
      JSON.stringify(f.sessions.slice(0, 50)),
    );
  });

  it("aucun identifiant en double", () => {
    const ids = [
      ...f.sessions.map((x) => x["id"] as string),
      ...f.inscriptions.map((x) => x["id"] as string),
      ...f.documents.map((x) => x["id"] as string),
      ...f.stagiaires.map((x) => x["id"] as string),
      ...f.clients.map((x) => x["id"] as string),
      ...f.formateurs.map((x) => x["id"] as string),
      ...f.dossiers.flatMap((d) => [
        d.dossier["id"] as string,
        ...d.payeurs.map((p) => p["id"] as string),
      ]),
    ];
    expect(
      new Set(ids).size,
      "des identifiants se répètent — le seed écrirait moins que prévu",
    ).toBe(ids.length);
  });
});

describe("les sessions couvrent bien 12 mois — une liste sur un mois ne teste rien", () => {
  it("s'étalent de part et d'autre de la date de référence", () => {
    const dates = f.sessions.map((s) => (s["dateDebut"] as Date).getTime());
    const passe = dates.filter((d) => d < REFERENCE.getTime()).length;
    const futur = dates.length - passe;
    expect(passe).toBeGreaterThan(400);
    expect(futur).toBeGreaterThan(400);
  });

  it("l'amplitude approche les 12 mois", () => {
    const dates = f.sessions.map((s) => (s["dateDebut"] as Date).getTime());
    const jours = (Math.max(...dates) - Math.min(...dates)) / 86_400_000;
    expect(jours).toBeGreaterThan(330);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 LA GARDE DE CIBLE — on la regarde refuser", () => {
  it("accepte une base locale", () => {
    const v = cibleAutorisee({
      DATABASE_URL: "postgresql://u:p@localhost:5432/axion_ci",
      NODE_ENV: "test",
    });
    expect(v.ok).toBe(true);
  });

  it("accepte une préproduction qui se DÉCLARE comme telle", () => {
    const v = cibleAutorisee({
      DATABASE_URL: "postgresql://u:p@db-preprod.axion-ia.com:5432/axionia",
      NODE_ENV: "development",
    });
    expect(v.ok).toBe(true);
  });

  it("🔴 REFUSE un hôte distant inconnu — la liste est BLANCHE, pas noire", () => {
    // Le point entier de la garde : un serveur de production qu'on aurait
    // oublié d'inscrire dans une liste noire passerait. Ici il est refusé
    // parce qu'il n'est inscrit nulle part.
    const v = cibleAutorisee({
      DATABASE_URL: "postgresql://u:p@91.99.12.34:5432/axionia",
      NODE_ENV: "development",
    });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.raison).toBe("hote_non_autorise");
  });

  it("🔴 REFUSE NODE_ENV=production même sur localhost", () => {
    const v = cibleAutorisee({
      DATABASE_URL: "postgresql://u:p@localhost:5432/axionia",
      NODE_ENV: "production",
    });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.raison).toBe("node_env_production");
  });

  it("refuse le stub de build — il n'y a pas de base à peupler", () => {
    const v = cibleAutorisee({
      DATABASE_URL: "postgresql://stub:stub@stub.invalid:5432/stub",
      NODE_ENV: "test",
    });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.raison).toBe("stub");
  });

  it("refuse une URL absente plutôt que de deviner", () => {
    expect(cibleAutorisee({ DATABASE_URL: undefined, NODE_ENV: "test" }).ok).toBe(false);
    expect(cibleAutorisee({ DATABASE_URL: "   ", NODE_ENV: "test" }).ok).toBe(false);
  });

  it("refuse une URL illisible", () => {
    const v = cibleAutorisee({ DATABASE_URL: "pas-une-url", NODE_ENV: "test" });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.raison).toBe("url_illisible");
  });

  it("le refus DIT ce qui est autorisé, au lieu de dire seulement non", () => {
    const v = cibleAutorisee({
      DATABASE_URL: "postgresql://u:p@prod.example.com:5432/axionia",
      NODE_ENV: "development",
    });
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.message).toContain("localhost");
    expect(v.message).toContain("préproduction");
  });
});
