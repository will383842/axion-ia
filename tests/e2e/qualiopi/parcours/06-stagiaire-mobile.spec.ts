/**
 * PARCOURS 6 — LE STAGIAIRE, sur un téléphone de 360 px.
 *
 * Phase 6 de `_AUDIT/PROMPT-AUDIT-QUALIOPI-E2E-50-AGENTS-2026-08-18.md` :
 * « du lien d'accès à l'attestation ».
 *
 * 360 px n'est pas un cas limite : c'est la largeur d'un Android d'entrée de
 * gamme, et un stagiaire consulte son espace depuis le train, pas depuis un
 * poste de travail. Une console admin qui déborde est un désagrément ; un
 * portail stagiaire qui déborde empêche de signer.
 *
 * ⚠️ Le lien d'accès est généré pour un stagiaire de DÉMONSTRATION
 * (`@demo.axion-ia.invalid`). Aucune personne physique n'est destinataire.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../fixtures/admin-auth";
import { ouvrirSessionDemo, ENREGISTREMENT } from "./_communs";

/** Pixel 7 est déjà un projet Playwright ; ici on veut le pire cas courant. */
const TELEPHONE = { width: 360, height: 740 };

test.use(ENREGISTREMENT);

test.describe("@parcours-qualiopi 6 — le stagiaire sur téléphone", () => {
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test("un lien d'accès se génère et le portail tient dans 360 px", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    const id = await ouvrirSessionDemo(page);
    expect(id, "session de démonstration introuvable — `pnpm qualiopi:seed-demo`").not.toBeNull();

    // 🔴 2026-08-21 — `waitForLoadState("networkidle")` NE REVENAIT JAMAIS ICI.
    //
    // Sans délai explicite, l'attente hérite du budget du test : elle a donc
    // consommé les 300 000 ms entières, puis rendu « Test timeout exceeded » —
    // un message qui ne nomme rien. La fiche de session admin ne devient jamais
    // silencieuse côté réseau (revalidations, compteurs), et c'est normal.
    //
    // 🔑 On attend un CONTENU, pas un état de réseau. Le bouton porte sa propre
    // attente, et son absence dit quelque chose d'utile ; le silence du réseau
    // ne dit rien du tout.

    // ── Côté organisme : produire le lien, comme le ferait l'assistante ──────
    const bouton = page.getByRole("button", { name: /Générer un accès portail/i }).first();
    await bouton.waitFor({ state: "visible", timeout: 60_000 }).catch(() => {
      /* Le compte ci-dessous porte le message utile. */
    });
    expect(
      await bouton.count(),
      "aucun bouton de génération d'accès portail sur la fiche de session — " +
        "le stagiaire n'a alors AUCUN moyen d'atteindre son espace",
    ).toBeGreaterThan(0);
    await bouton.click();

    // Le lien s'affiche à l'écran, qu'il soit parti par e-mail ou non — c'est
    // le repli assumé du composant, et c'est lui qu'on suit ici.
    // 🔴 2026-08-22 — L'UNION PRENAIT LE PREMIER DANS L'ORDRE DU DOM.
    //
    // `code, a[href*='/portail/']` ne classe pas par pertinence : il prend le
    // premier des deux qui apparaît. Or `PreparationKitSession` est rendu AVANT
    // `EnrollmentsSection` (sessions/[id]/page.tsx:798 vs :850) et affiche
    // `<code>pnpm tsx scripts/kit-formateur/publier-vers-r2.ts</code>` quand le
    // kit est absent. `toBeVisible()` passait donc sur CE bloc, et l'échec
    // tombait deux lignes plus bas en accusant la génération d'accès.
    //
    // 🔑 C'est le CONTENU qui identifie la cible, pas la balise. Le lien généré
    // est affiché en `<code>{result.url}</code>` (GenererPortailAccesButton.tsx:114) ;
    // la branche `a[href]` n'est qu'un repli théorique.
    const zoneLien = page
      .locator("a[href*='/portail/'], code")
      .filter({ hasText: /\/portail\// })
      .first();
    await expect(
      zoneLien,
      "le lien d'accès n'apparaît pas après génération — impossible de le transmettre",
    ).toBeVisible({ timeout: 60_000 });

    const lien = (await zoneLien.innerText()).trim();
    expect(lien, `le texte affiché ne ressemble pas à un lien de portail : « ${lien} »`).toMatch(
      /\/portail\//,
    );
    await info.attach("lien-portail.txt", { body: lien, contentType: "text/plain" });

    // ── Côté stagiaire : un téléphone, et rien d'autre ──────────────────────
    const chemin = new URL(lien, "http://localhost:3000").pathname;
    await page.setViewportSize(TELEPHONE);
    const reponse = await page.goto(chemin, { waitUntil: "networkidle", timeout: 90_000 });
    expect(reponse?.status(), `le lien d'accès rend ${reponse?.status()} — il est mort`).toBe(200);

    const mesure = await page.evaluate(() => {
      const r = document.documentElement;
      const limite = r.clientWidth + 1;
      const debordants: string[] = [];
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        if (b.right <= limite) continue;
        // Ce qu'un ancêtre découpe ne pousse pas la page.
        let p = el.parentElement;
        let decoupe = false;
        while (p !== null && p !== r) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === "hidden" || ox === "clip" || ox === "auto" || ox === "scroll") {
            decoupe = true;
            break;
          }
          p = p.parentElement;
        }
        if (decoupe) continue;
        const pb = el.parentElement?.getBoundingClientRect();
        if (pb === undefined || b.right - pb.right <= 1) continue;
        debordants.push(
          `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className || "").slice(0, 60)} ` +
            `dépasse de ${Math.round(b.right - pb.right)} px`,
        );
      }
      return {
        scrollWidth: r.scrollWidth,
        clientWidth: r.clientWidth,
        debordants: debordants.slice(0, 5),
        texte: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 300),
      };
    });

    await info.attach("portail-360.json", {
      body: JSON.stringify(mesure, null, 2),
      contentType: "application/json",
    });

    expect(
      mesure.scrollWidth,
      `le portail stagiaire déborde à 360 px (${mesure.scrollWidth} px) — ` +
        `coupables : ${JSON.stringify(mesure.debordants)}`,
    ).toBeLessThanOrEqual(mesure.clientWidth + 1);

    // Un écran de portail vide serait un 200 sans contenu : on exige du texte.
    expect(
      mesure.texte.length,
      `le portail répond 200 mais n'affiche presque rien : « ${mesure.texte} »`,
    ).toBeGreaterThan(80);
  });
});
