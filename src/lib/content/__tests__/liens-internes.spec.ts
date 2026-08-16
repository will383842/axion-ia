/**
 * Verrou GEO-079 + GEO-081 — chaque lien interne des corps d'articles
 * provoquait une redirection (audit GEO/AEO du 2026-08-14, lot 13).
 *
 * ## Le défaut mesuré en production le 2026-08-16
 *
 *   /audit                      → 301 → /fr/audit
 *   /un-a-un                    → 301 → /fr/un-a-un
 *   /blog/<slug>                → 301 → /fr/blog/<slug>
 *   /reserver        → 301 → /fr/reserver        → 308 → /fr/appel
 *   /implementations → 301 → /fr/implementations → 308 → /fr/implementation
 *
 * 22 des 23 articles échantillonnés portaient au moins un de ces liens. Un lien
 * qui redirige coûte un aller-retour au visiteur, dilue le signal transmis à la
 * cible et consomme du budget de crawl — sur tout le corpus.
 *
 * ## Ce que cette garde protège
 *
 * Surtout les cas où une réécriture serait PIRE que l'absence de réécriture :
 * double préfixe, ressource cassée, lien externe détourné. Un correctif de lien
 * trop gourmand casse des liens qui marchaient — c'est le risque principal ici,
 * pas l'oubli.
 */

import { describe, expect, it } from "vitest";

import {
  ALIAS_LIENS_INTERNES,
  prefixerLiensInternes,
  resoudreLienInterne,
} from "@/lib/content/liens-internes";

describe("GEO-079 — le préfixe de langue", () => {
  it("🔴 préfixe les chemins internes nus", () => {
    expect(resoudreLienInterne("/audit", "fr")).toBe("/fr/audit");
    expect(resoudreLienInterne("/un-a-un", "fr")).toBe("/fr/un-a-un");
    expect(resoudreLienInterne("/blog/ai-act-vs-rgpd", "fr")).toBe("/fr/blog/ai-act-vs-rgpd");
  });

  it("respecte la langue demandée", () => {
    expect(resoudreLienInterne("/audit", "en")).toBe("/en/audit");
  });

  it("🔴 ne double JAMAIS le préfixe", () => {
    // Le defaut le plus probable d'une reecriture : `/fr/fr/audit` est un 404
    // sec, donc pire que le 301 qu'on cherchait a supprimer.
    expect(resoudreLienInterne("/fr/audit", "fr")).toBeNull();
    expect(resoudreLienInterne("/en/audit", "fr")).toBeNull();
    expect(resoudreLienInterne("/fr", "fr")).toBeNull();
    expect(prefixerLiensInternes('<a href="/fr/audit">x</a>', "fr")).toBe(
      '<a href="/fr/audit">x</a>',
    );
  });
});

describe("GEO-081 — les chaînes à deux sauts", () => {
  it("🔴 résout directement les chemins qui redirigeraient encore après préfixe", () => {
    expect(resoudreLienInterne("/implementations", "fr")).toBe("/fr/implementation");
    expect(resoudreLienInterne("/interventions/essentielle", "fr")).toBe("/fr/formations");
    expect(resoudreLienInterne("/reserver", "fr")).toBe("/fr/appel");
  });

  it("l'alias s'applique au chemin nu, pas à la chaîne complète", () => {
    // Sinon `/reserver?utm=x` echapperait a la table et repartirait pour 2 sauts.
    expect(resoudreLienInterne("/reserver?utm_source=blog", "fr")).toBe(
      "/fr/appel?utm_source=blog",
    );
    expect(resoudreLienInterne("/implementations#tarifs", "fr")).toBe("/fr/implementation#tarifs");
  });

  it("la table d'alias reste courte — sinon c'est qu'on réimplémente le routeur", () => {
    // 🔑 Garde d'intention : les routes injectees dans les corps sont enumerees
    // dans les gabarits du generateur. Si cette table enfle, c'est le signe
    // qu'on duplique les regles de redirection au lieu de corriger la source.
    expect(Object.keys(ALIAS_LIENS_INTERNES).length).toBeLessThanOrEqual(8);
    for (const cible of Object.values(ALIAS_LIENS_INTERNES)) {
      expect(cible.startsWith("/"), `cible relative attendue : ${cible}`).toBe(true);
      expect(cible.startsWith("/fr/") || cible.startsWith("/en/")).toBe(false);
    }
  });
});

describe("ce qu'il ne faut surtout PAS toucher", () => {
  it("les liens externes", () => {
    expect(resoudreLienInterne("https://insee.fr/x", "fr")).toBeNull();
    expect(resoudreLienInterne("http://dares.fr", "fr")).toBeNull();
    expect(resoudreLienInterne("//cdn.example.com/x", "fr")).toBeNull();
  });

  it("les ancres, mailto et tel", () => {
    expect(resoudreLienInterne("#sommaire", "fr")).toBeNull();
    expect(resoudreLienInterne("mailto:contact@axion-ia.com", "fr")).toBeNull();
    expect(resoudreLienInterne("tel:+33123456789", "fr")).toBeNull();
  });

  it("🔴 les ressources : les préfixer les casserait", () => {
    for (const r of [
      "/api/og",
      "/_next/static/x.js",
      "/sitemap-index.xml",
      "/robots.txt",
      "/favicon.ico",
      "/icon.png",
      "/manifest.webmanifest",
      "/images/hero.avif",
      "/image-bank/x/thumb.webp",
      "/documents/plaquette.pdf",
      "/.well-known/security.txt",
    ]) {
      expect(resoudreLienInterne(r, "fr"), `${r} ne doit pas etre prefixe`).toBeNull();
    }
  });

  it("la racine", () => {
    expect(resoudreLienInterne("/", "fr")).toBeNull();
  });
});

describe("réécriture d'un fragment HTML", () => {
  it("🔴 traite un corps d'article réaliste sans abîmer le reste", () => {
    const html = [
      '<p>Voir notre <a href="/audit">audit</a> et nos ',
      '<a href="/implementations">implementations</a>.</p>',
      '<p><a href="https://insee.fr/stat">INSEE</a> · ',
      '<a href="/fr/blog/deja-bon">déjà bon</a> · ',
      '<a href="#faq">FAQ</a></p>',
      '<img src="/images/x.avif" alt="x" />',
    ].join("");

    const sortie = prefixerLiensInternes(html, "fr");

    expect(sortie).toContain('href="/fr/audit"');
    expect(sortie).toContain('href="/fr/implementation"');
    expect(sortie).toContain('href="https://insee.fr/stat"');
    expect(sortie).toContain('href="/fr/blog/deja-bon"');
    expect(sortie).toContain('href="#faq"');
    expect(sortie, "les `src` ne sont pas des `href` : ne pas les toucher").toContain(
      'src="/images/x.avif"',
    );
    expect(sortie).not.toContain("/fr/fr/");
  });

  it("est idempotent — un second passage ne change rien", () => {
    // La page peut etre re-rendue ; une reecriture qui derive a chaque passage
    // produirait `/fr/fr/...` au bout de deux tours.
    const html = '<a href="/audit">a</a><a href="/reserver">b</a>';
    const un = prefixerLiensInternes(html, "fr");
    expect(prefixerLiensInternes(un, "fr")).toBe(un);
  });

  it("une chaîne vide reste vide", () => {
    expect(prefixerLiensInternes("", "fr")).toBe("");
  });
});
