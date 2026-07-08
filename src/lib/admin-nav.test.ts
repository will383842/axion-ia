import { describe, it, expect } from "vitest";
import {
  buildAdminNav,
  findActiveNavHref,
  ADMIN_NAV_GROUP_LABELS,
  ADMIN_NAV_GROUP_ORDER,
  QUALIOPI_POLE_ORDER,
  QUALIOPI_POLE_LABELS,
} from "./admin-nav";

describe("buildAdminNav SSOT", () => {
  it("returns 114 items (snapshot count — +5 console chatbot ADR-CB-07, +20 Qualiopi T0-T16, +1 RGPD T19, +1 Formateurs R9, +1 Stagiaires R10, +1 Config Qualiopi, +2 carrières, +6 Documents interventions dont Importer un kit, +3 Coaching 1-to-1, content_gen refonte UX 2026-06-16 = 30 items en 6 pôles, +1 Observatoire IA suivi 2026-06-17, +2 sous-items Documents interventions #125 (implementations/sites-web) non répercutés sur ce snapshot, +3 Salle de presse #140 (Vue d'ensemble · Communiqués · Kit média), +1 Couverture médias 2026-06-23 (CRUD retombées presse) — réconciliation du snapshot resté à 110 ; /orchestrator et /queue fusionnés → pas d'entrée nav, redirections seules ; +1 Photos hero Unsplash 2026-06-24 (rattrapage backfill content-gen/publier) ; +1 Backfill citations 2026-06-26 (content-gen/publier, rattrapage bloc Sources) ; +1 Actualités (news RSS) 2026-07-01 (pôle Lancer, contrôle volume news/jour))", () => {
    const items = buildAdminNav("admin-test-prefix");
    // +14 pôle Prospection & Base Entreprises 2026-07-04 (dashboard, départements,
    // campagnes, entreprises, contacts, couverture, carte, par activité, personnes,
    // exports, journal, rgpd, doublons, réglages) → 117 → 131.
    // +1 Avis clients 2026-07-06 (groupe content, modération avis) → 132.
    // -1 Témoignages 2026-07-06 (système Testimonial décommissionné) → 131.
    expect(items.length).toBe(131);
  });

  it("prefixes all hrefs with /fr/<adminPrefix>", () => {
    const items = buildAdminNav("admin-test-prefix");
    for (const it of items) {
      expect(it.href.startsWith("/fr/admin-test-prefix")).toBe(true);
    }
  });

  it("covers all 11 groups in ADMIN_NAV_GROUP_ORDER", () => {
    const items = buildAdminNav("admin-test-prefix");
    const groups = new Set(items.map((it) => it.group));
    for (const g of ADMIN_NAV_GROUP_ORDER) {
      expect(groups.has(g)).toBe(true);
    }
  });

  it("ADMIN_NAV_GROUP_LABELS covers all groups", () => {
    for (const g of ADMIN_NAV_GROUP_ORDER) {
      expect(ADMIN_NAV_GROUP_LABELS[g]).toBeDefined();
    }
  });

  it("has unique hrefs (no drift)", () => {
    const items = buildAdminNav("p");
    const hrefs = items.map((it) => it.href);
    const unique = new Set(hrefs);
    expect(unique.size).toBe(hrefs.length);
  });

  // Refonte UX 2026-07-08 : les onglets Qualiopi sont regroupés en 5 pôles
  // (accordéon sidebar). On verrouille que CHAQUE item qualiopi porte un pôle
  // valide — sinon il disparaîtrait du rendu en pôles (groupItems.filter).
  it("chaque item qualiopi porte un subGroup dans QUALIOPI_POLE_ORDER", () => {
    const items = buildAdminNav("p").filter((it) => it.group === "qualiopi");
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(it.subGroup, `« ${it.label} » sans pôle`).toBeDefined();
      expect(QUALIOPI_POLE_ORDER as ReadonlyArray<string>).toContain(it.subGroup);
    }
  });

  it("QUALIOPI_POLE_LABELS couvre tous les pôles de QUALIOPI_POLE_ORDER", () => {
    for (const p of QUALIOPI_POLE_ORDER) {
      expect(QUALIOPI_POLE_LABELS[p]).toBeDefined();
    }
  });
});

describe("findActiveNavHref — résolution sidebar (anti-rebascule)", () => {
  const items = buildAdminNav("p");
  const base = "/fr/p";
  const groupOf = (href: string | null) => items.find((it) => it.href === href)?.group ?? null;

  it("null pathname → null", () => {
    expect(findActiveNavHref(items, null)).toBeNull();
  });

  it("racine admin résout le Tableau de bord, pas une sous-page", () => {
    expect(findActiveNavHref(items, base)).toBe(base);
    expect(groupOf(findActiveNavHref(items, base))).toBe("main");
  });

  // ── Bug 2026-06-23 : clic « Communiqués » / « Kit média » rebasculait sur
  //    « Activité quotidienne » (groupe main) car ces routes ne matchaient
  //    aucun item en exact. On verrouille : chaque route presse (page ET
  //    sous-éditeur) reste dans le groupe « presse ».
  it("pages de liste presse → item exact + groupe presse", () => {
    for (const sub of [
      "/presse",
      "/presse/communiques",
      "/presse/kit-media",
      "/presse/couverture",
    ]) {
      const active = findActiveNavHref(items, `${base}${sub}`);
      expect(active).toBe(`${base}${sub}`);
      expect(groupOf(active)).toBe("presse");
    }
  });

  it("éditeurs presse (sans entrée de nav) → rattachés au parent, groupe presse", () => {
    const cases: Array<[string, string]> = [
      ["/presse/communiques/nouveau", "/presse/communiques"],
      ["/presse/communiques/abc-123", "/presse/communiques"],
      ["/presse/kit-media/upload", "/presse/kit-media"],
      ["/presse/couverture/nouveau", "/presse/couverture"],
      ["/presse/couverture/abc-123", "/presse/couverture"],
    ];
    for (const [path, expectedParent] of cases) {
      const active = findActiveNavHref(items, `${base}${path}`);
      expect(active).toBe(`${base}${expectedParent}`);
      expect(groupOf(active)).toBe("presse");
      // Surtout PAS le Tableau de bord (racine) ni le groupe main.
      expect(active).not.toBe(base);
      expect(groupOf(active)).not.toBe("main");
    }
  });

  it("le plus long préfixe gagne (jamais le parent court)", () => {
    const active = findActiveNavHref(items, `${base}/presse/communiques/nouveau`);
    expect(active).toBe(`${base}/presse/communiques`);
    expect(active).not.toBe(`${base}/presse`);
  });
});
