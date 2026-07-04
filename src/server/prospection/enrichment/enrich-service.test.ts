import { describe, it, expect } from "vitest";
import { enrichCompany, type EnrichDb, type EnrichDeps, type EnrichConfig } from "./enrich-service";
import type { MxResolver } from "./email";

const HOME = `<html><body><p>ACME BTP SAS — SIREN 123 456 789</p>
<a href="mailto:contact@acme-btp.fr">contact</a> <a href="tel:0476001122">tel</a></body></html>`;
const MENTIONS = `<html><body><p>ACME BTP — SIREN 123456789 — RCS Grenoble</p>
<p>Commercial : <a href="mailto:jean.dupont@acme-btp.fr">jean.dupont@acme-btp.fr</a> — 06 12 34 56 78</p>
</body></html>`;
const EQUIPE = `<html><body><ul>
<li>Jean DUPONT — Directeur Général</li>
<li>Marie MARTIN, Responsable des achats</li>
<li>Paul BERNARD - Chef de chantier</li>
</ul></body></html>`;

const HOMONYME = `<html><body><p>Une toute autre société, aucun lien</p>
<a href="mailto:x@autre.fr">x</a></body></html>`;

const mxOk: MxResolver = {
  async resolveMx() {
    return [{ exchange: "mx" }];
  },
};

const CONFIG: EnrichConfig = {
  contactPaths: ["/mentions-legales", "/contact"],
  teamPaths: ["/equipe"],
  maxPagesContact: 3,
  maxPagesPersonnes: 4,
  maxPagesEntreprise: 10,
  maxTeamAttempts: 6,
  enrichirPersonnes: true,
};

interface Rec {
  contacts: Array<{ type: string; value: string; isNominatif: boolean; verif: string }>;
  persons: Map<string, string>;
  roles: number;
  companyUpdate: Record<string, unknown> | null;
}

function makeDeps(pages: Record<string, string>): { deps: EnrichDeps; rec: Rec } {
  const rec: Rec = { contacts: [], persons: new Map(), roles: 0, companyUpdate: null };
  const db = {
    prospectionContact: {
      async upsert(a: {
        create: { type: string; value: string; isNominatif?: boolean; verifStatus: string };
      }) {
        rec.contacts.push({
          type: a.create.type,
          value: a.create.value,
          isNominatif: a.create.isNominatif ?? false,
          verif: a.create.verifStatus,
        });
        return {};
      },
    },
    prospectionPerson: {
      async upsert(a: { where: { companyId_personKey: { personKey: string } } }) {
        const key = a.where.companyId_personKey.personKey;
        let id = rec.persons.get(key);
        if (!id) {
          id = `person-${rec.persons.size + 1}`;
          rec.persons.set(key, id);
        }
        return { id };
      },
    },
    prospectionPersonRole: {
      async create() {
        rec.roles++;
        return {};
      },
    },
    prospectionCompany: {
      async update(a: { data: Record<string, unknown> }) {
        rec.companyUpdate = a.data;
        return {};
      },
    },
  } as unknown as EnrichDb;

  const deps: EnrichDeps = {
    mxResolver: mxOk,
    db,
    async fetchPage(url: string) {
      const path = new URL(url).pathname;
      const html = pages[path];
      if (html === undefined) return { url, ok: false, status: 404, text: "" };
      return { url, ok: true, status: 200, text: html };
    },
  };
  return { deps, rec };
}

const COMPANY = {
  id: "c1",
  siren: "123456789",
  denomination: "ACME BTP",
  siteWeb: "https://acme-btp.fr",
};

describe("enrichCompany — 2 passes", () => {
  it("domaine confirmé → coordonnées + responsables + nominatif (#7, #9)", async () => {
    const { deps, rec } = makeDeps({ "/": HOME, "/mentions-legales": MENTIONS, "/equipe": EQUIPE });
    const r = await enrichCompany(COMPANY, CONFIG, deps);

    expect(r.status).toBe("enriched");
    expect(r.domainConfirmed).toBe(true);
    expect(r.persons).toBe(3); // Jean DUPONT, Marie MARTIN, Paul BERNARD
    expect(rec.roles).toBe(3);

    const emails = rec.contacts.filter((c) => c.type === "email").map((c) => c.value);
    expect(emails).toEqual(
      expect.arrayContaining(["contact@acme-btp.fr", "jean.dupont@acme-btp.fr"]),
    );

    // Email nominatif rattaché à la bonne personne.
    const nominatif = rec.contacts.find((c) => c.value === "jean.dupont@acme-btp.fr");
    expect(nominatif?.isNominatif).toBe(true);
    expect(nominatif?.verif).toBe("mx_ok");

    // Exploitable (email MX-OK).
    expect(rec.companyUpdate?.contactabilite).toBe("exploitable");
    expect(rec.companyUpdate?.enrichmentStatus).toBe("enriched");
  });

  it("homonyme sans preuve → non retenu, AUCUN contact écrit (#9)", async () => {
    const { deps, rec } = makeDeps({ "/": HOMONYME, "/mentions-legales": HOMONYME });
    const r = await enrichCompany(COMPANY, CONFIG, deps);
    expect(r.domainConfirmed).toBe(false);
    expect(r.status).toBe("no_data");
    expect(rec.contacts).toHaveLength(0); // rien scrapé sur un domaine non confirmé
    expect(rec.companyUpdate?.contactabilite).toBe("non_contactable");
  });

  it("aucun site → no_data (0 appel réseau gaspillé)", async () => {
    const { deps, rec } = makeDeps({});
    const r = await enrichCompany({ ...COMPANY, siteWeb: null }, CONFIG, deps);
    expect(r.status).toBe("no_data");
    expect(rec.contacts).toHaveLength(0);
  });

  it("contenu inchangé → no-op, aucune ré-écriture (anti-re-scrape D4)", async () => {
    const pages = { "/": HOME, "/mentions-legales": MENTIONS, "/equipe": EQUIPE };
    const first = makeDeps(pages);
    const r1 = await enrichCompany(COMPANY, CONFIG, first.deps);
    expect(r1.noop).toBe(false);
    expect(r1.contentHash).toBeTruthy();

    // 2e passe avec le même contentHash → no-op.
    const second = makeDeps(pages);
    const r2 = await enrichCompany(
      { ...COMPANY, contentHash: r1.contentHash ?? null },
      CONFIG,
      second.deps,
    );
    expect(r2.noop).toBe(true);
    expect(second.rec.contacts).toHaveLength(0); // rien ré-écrit
    expect(second.rec.roles).toBe(0);
  });
});
