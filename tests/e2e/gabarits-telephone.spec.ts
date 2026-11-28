/**
 * Contrôle « téléphone » des modèles d'articles v2/v3 (src/components/article-v2/**).
 *
 * Rend CHAQUE code de `GABARITS_ARTICLE` (donc tout modèle ajouté plus tard à la liste,
 * sans toucher ce fichier) sur la page d'aperçu `/fr/blog/apercu-gabarit/<code>` et vérifie,
 * à six largeurs (320, 360, 390, 412 : téléphones ; 768 : tablette ; 1280 : ordinateur) :
 *   (a) aucun défilement horizontal de la page ; tableaux défilant DANS leur cadre, avec indication ;
 *   (b) texte courant ≥ 16 px, interligne ≥ 1,5, ≤ 80 caractères par ligne ;
 *   (c) cibles tactiles ≥ 44 × 44 px, ou ≥ 24 px avec espacement suffisant (WCAG 2.2, 2.5.8) ;
 *   (d) images : ratio fixe, pas plus larges que l'écran, CLS = 0 ;
 *   (e) éléments collants/fixes : jamais plus de 30 % de l'écran, jamais sur le texte ancré ;
 *   (f) zoom texte 200 % et refusion à 320 px : aucune perte de contenu (WCAG 1.4.4, 1.4.10).
 *
 * La page d'aperçu est derrière `BLOG_GABARITS_V2=true` (404 sinon) : sans l'interrupteur,
 * la suite se met en « skipped » avec ce motif. Workflow dédié : `gabarits-telephone.yml`.
 * Captures 360 et 1280 px : jointes au rapport ; écrites dans `docs/captures-mobile/`
 * quand `CAPTURES_MOBILE=1`.
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { GABARITS_ARTICLE } from "../../src/server/content-gen/blog/gabarits";

const LARGEURS = [320, 360, 390, 412, 768, 1280] as const;
/** Hauteurs réalistes : un petit téléphone fait 568 px de haut, pas 800. */
const HAUTEUR = (l: number) =>
  ({ 320: 568, 360: 740, 390: 844, 412: 915, 768: 1024, 1280: 800 })[l] ?? 800;

/** Mesures prises dans la page ; chaque fonction rend la liste de ses défauts. */
async function mesurer(page: Page, largeur: number) {
  return page.evaluate(
    ({ largeur: w }) => {
      const defauts: Record<string, string[]> = { a: [], b: [], c: [], d: [], e: [] };
      const racine = document.querySelector<HTMLElement>("[data-gabarit]");
      if (!racine) return { defauts, erreur: "aucun [data-gabarit] dans la page" };
      const nom = (el: Element) =>
        `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}`;
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return (
          r.width > 1 &&
          r.height > 1 &&
          cs.visibility !== "hidden" &&
          cs.display !== "none" &&
          !(cs.position === "absolute" && /rect\(0/.test(cs.clip))
        );
      };

      // (a) page + tableaux
      const de = document.documentElement;
      if (de.scrollWidth > window.innerWidth)
        defauts["a"]!.push(`la page défile : scrollWidth ${de.scrollWidth} > ${window.innerWidth}`);
      for (const t of Array.from(racine.querySelectorAll("table"))) {
        let cadre: HTMLElement | null = t.parentElement;
        while (
          cadre &&
          cadre !== racine &&
          !/(auto|scroll)/.test(getComputedStyle(cadre).overflowX)
        )
          cadre = cadre.parentElement;
        const dansCadre = cadre && cadre !== racine;
        if (!dansCadre) {
          if (t.getBoundingClientRect().right > window.innerWidth + 1)
            defauts["a"]!.push(
              `tableau « ${t.querySelector("caption")?.textContent?.slice(0, 30) ?? "?"} » sans cadre défilant et plus large que l'écran`,
            );
          continue;
        }
        const deborde = cadre!.scrollWidth > cadre!.clientWidth + 1;
        if (deborde) {
          if (cadre!.tabIndex < 0)
            defauts["a"]!.push("cadre de tableau défilant non focusable au clavier");
          const cs = getComputedStyle(cadre!);
          const indication =
            cs.backgroundImage !== "none" ||
            getComputedStyle(cadre!, "::after").content !== "none" ||
            getComputedStyle(cadre!, "::before").content !== "none" ||
            !!cadre!.parentElement?.querySelector(".tableau__note, [data-indication-defilement]") ||
            cs.scrollbarWidth !== "auto" ||
            cadre!.closest(".tableau")?.matches("[class*='defil']");
          if (!indication)
            defauts["a"]!.push(
              "tableau qui défile sans indication visible (ombre, dégradé ou note)",
            );
        }
      }

      // (b) texte courant
      for (const p of Array.from(
        racine.querySelectorAll<HTMLElement>(".corps-html p, .corps-html li"),
      ).slice(0, 12)) {
        if (!visible(p) || (p.textContent ?? "").trim().length < 40) continue;
        const cs = getComputedStyle(p);
        const fs = parseFloat(cs.fontSize);
        const lh = cs.lineHeight === "normal" ? 1.2 * fs : parseFloat(cs.lineHeight);
        if (fs < 16) defauts["b"]!.push(`${nom(p)} : corps ${fs}px < 16`);
        if (lh / fs < 1.5 - 0.01)
          defauts["b"]!.push(`${nom(p)} : interligne ${(lh / fs).toFixed(2)} < 1,5`);
        // Longueur de ligne mesurée : nombre de caractères de la 1re ligne (Range sur le 1er nœud texte).
        const tn = Array.from(p.childNodes).find(
          (n) => n.nodeType === 3 && (n.textContent ?? "").length > 40,
        );
        if (tn) {
          const rg = document.createRange();
          const t0 = tn.textContent ?? "";
          let n = 0;
          const top0 = (rg.setStart(tn, 0), rg.setEnd(tn, 1), rg.getBoundingClientRect().top);
          for (; n < t0.length; n++) {
            rg.setStart(tn, n);
            rg.setEnd(tn, n + 1);
            if (rg.getBoundingClientRect().top > top0 + 4) break;
          }
          if (n < t0.length && n > 80)
            defauts["b"]!.push(`${nom(p)} : ${n} caractères sur la 1re ligne > 80`);
        }
      }

      // (c) cibles tactiles
      const cibles = Array.from(
        racine.querySelectorAll<HTMLElement>(
          "a[href], button, summary, input, select, textarea, [role=button]",
        ),
      ).filter((el) => {
        if (!visible(el)) return false;
        // Lien dans une phrase : exception WCAG 2.5.8 (en ligne).
        if (el.tagName === "A" && getComputedStyle(el).display === "inline") {
          let bloc: HTMLElement | null = el.parentElement;
          while (bloc && getComputedStyle(bloc).display.startsWith("inline"))
            bloc = bloc.parentElement;
          const reste = (bloc?.textContent ?? "").replace(el.textContent ?? "", "").trim();
          if (reste.length > 3) return false;
        }
        return true;
      });
      const rects = cibles.map((el) => ({ el, r: el.getBoundingClientRect() }));
      for (const { el, r } of rects) {
        if (r.width >= 44 && r.height >= 44) continue;
        if (r.width < 24 || r.height < 24) {
          defauts["c"]!.push(
            `${nom(el)} « ${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 24)} » ${Math.round(r.width)}×${Math.round(r.height)} < 24`,
          );
          continue;
        }
        // 24 ≤ taille < 44 : un cercle de 24 px centré ne doit toucher aucune autre cible.
        const cx = r.left + r.width / 2,
          cy = r.top + r.height / 2;
        for (const o of rects) {
          if (o.el === el || o.el.contains(el) || el.contains(o.el)) continue;
          const dx = Math.max(o.r.left - cx, 0, cx - o.r.right);
          const dy = Math.max(o.r.top - cy, 0, cy - o.r.bottom);
          if (Math.hypot(dx, dy) < 12) {
            defauts["c"]!.push(
              `${nom(el)} « ${(el.textContent ?? "").trim().slice(0, 24)} » ${Math.round(r.width)}×${Math.round(r.height)} trop proche de ${nom(o.el)}`,
            );
            break;
          }
        }
      }

      // (d) images
      for (const img of Array.from(racine.querySelectorAll("img"))) {
        const r = img.getBoundingClientRect();
        if (r.width > window.innerWidth + 0.5)
          defauts["d"]!.push(`${nom(img)} plus large que l'écran (${Math.round(r.width)})`);
        const reserve =
          (img.getAttribute("width") && img.getAttribute("height")) ||
          getComputedStyle(img).aspectRatio !== "auto" ||
          (img.parentElement && getComputedStyle(img.parentElement).aspectRatio !== "auto") ||
          (img.parentElement?.parentElement &&
            getComputedStyle(img.parentElement.parentElement).aspectRatio !== "auto");
        if (!reserve) defauts["d"]!.push(`${nom(img)} sans ratio réservé`);
      }

      // (e) éléments collants ou fixes
      // Hors périmètre : bandeaux de consentement et autres surcouches du site (hors gabarit, hors en-tête).
      const collants = Array.from(document.querySelectorAll<HTMLElement>("body *")).filter((el) => {
        const p = getComputedStyle(el).position;
        return (
          (p === "fixed" || p === "sticky") &&
          visible(el) &&
          (!!el.closest("header,[data-gabarit]") || el.matches("header"))
        );
      });
      let hauteurPincee = 0;
      for (const el of collants) {
        const r = el.getBoundingClientRect();
        const epingle = r.top <= 1 || r.bottom >= window.innerHeight - 1;
        if (epingle && r.width > window.innerWidth * 0.5)
          hauteurPincee += Math.min(r.height, window.innerHeight);
      }
      if (w < 768 && hauteurPincee > window.innerHeight * 0.3)
        defauts["e"]!.push(
          `éléments épinglés : ${Math.round(hauteurPincee)} px > 30 % de l'écran (${window.innerHeight})`,
        );
      return { defauts, erreur: null as string | null };
    },
    { largeur },
  );
}

async function cls(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __cls: number }).__cls ?? 0);
}

for (const gabarit of GABARITS_ARTICLE) {
  test.describe(`gabarit « ${gabarit} » sur téléphone`, () => {
    test.describe.configure({ mode: "parallel" });
    for (const largeur of LARGEURS) {
      test(`${gabarit} @ ${largeur} px`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== "chromium", "mesures calées sur Chromium");
        test.setTimeout(90_000);
        await page.addInitScript(() => {
          // Bandeau de cookies refusé d'avance : il est hors gabarit et se ferme d'un geste.
          try {
            localStorage.setItem("axion-cookie-consent-v2", "declined");
            localStorage.setItem("axion-cookie-consent-v2:ts", String(Date.now()));
          } catch {}
          const w = window as unknown as { __cls: number; __clsSources: string[] };
          w.__cls = 0;
          w.__clsSources = [];
          new PerformanceObserver((l) => {
            for (const e of l.getEntries() as unknown as Array<{
              value: number;
              hadRecentInput: boolean;
              sources?: Array<{ node?: Element | null }>;
            }>)
              if (!e.hadRecentInput) {
                w.__cls += e.value;
                for (const s of e.sources ?? [])
                  w.__clsSources.push(
                    `${s.node?.nodeName ?? "texte"}.${String((s.node as HTMLElement | null)?.className ?? "").slice(0, 30)} ${e.value.toExponential(1)}`,
                  );
              }
          }).observe({ type: "layout-shift", buffered: true });
        });
        await page.setViewportSize({ width: largeur, height: HAUTEUR(largeur) });
        const rep = await page.goto(`/fr/blog/apercu-gabarit/${gabarit}`, { waitUntil: "load" });
        test.skip(
          rep?.status() === 404,
          "page d'aperçu absente : BLOG_GABARITS_V2 n'est pas allumé sur ce serveur",
        );
        expect(rep?.status()).toBe(200);
        await expect(page.locator("[data-gabarit]").first()).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        // Défilement instantané : les mesures de position ne doivent pas attendre l'animation.
        await page.addStyleTag({ content: "html{scroll-behavior:auto !important}" });
        // Parcours de toute la page : charge les images, déclenche d'éventuels décalages.
        const h = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < h; y += Math.max(200, HAUTEUR(largeur) / 2)) {
          await page.evaluate((yy) => window.scrollTo(0, yy), y);
          await page.waitForTimeout(40);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);

        const { defauts, erreur } = await mesurer(page, largeur);
        expect(erreur, "structure").toBeNull();
        const decalage = await cls(page);
        if (decalage > 0) {
          const src = await page.evaluate(() =>
            (window as unknown as { __clsSources: string[] }).__clsSources.join(" ; "),
          );
          defauts["d"]!.push(`CLS = ${decalage.toExponential(2)} (attendu 0) : ${src}`);
        }

        // (e) un saut vers une ancre du sommaire ne laisse pas le titre sous l'en-tête collant.
        const lienSommaire = page
          .locator("[data-gabarit] a[href^='#']")
          .filter({ hasText: /contexte|démarche|données/i })
          .first();
        if (await lienSommaire.count()) {
          const href = (await lienSommaire.getAttribute("href")) ?? "";
          // Sur téléphone le sommaire est replié (<details>) : on l'ouvre comme le ferait la personne.
          const repli = lienSommaire.locator("xpath=ancestor::details[1]");
          if (await repli.count()) {
            if (!(await lienSommaire.isVisible())) {
              await repli.locator("summary").first().scrollIntoViewIfNeeded();
              await repli.locator("summary").first().click();
            }
          }
          await lienSommaire.scrollIntoViewIfNeeded();
          await lienSommaire.click();
          await page.waitForTimeout(500);
          const couvert = await page.evaluate((id) => {
            const cible = document.getElementById(id);
            if (!cible) return "ancre introuvable";
            const r = cible.getBoundingClientRect();
            const pt = document.elementFromPoint(
              Math.min(r.left + 10, window.innerWidth - 2),
              Math.max(r.top + 4, 2),
            );
            return pt &&
              (pt === cible ||
                cible.contains(pt) ||
                (pt.contains(cible) && !pt.closest("header,nav,[class*=sommaire],[class*=sticky]")))
              ? null
              : `le titre #${id} est masqué par ${pt?.tagName.toLowerCase()}.${pt?.className}`;
          }, href.slice(1));
          if (couvert) defauts["e"]!.push(couvert);
        }

        // (e) focus clavier jamais masqué (WCAG 2.4.11) par l'en-tête ou la barre d'action collants.
        // Vrai parcours au clavier (Tab) : c'est lui qui déclenche le défilement vers l'élément focalisé.
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.locator("[data-gabarit] a[href]").first().focus();
        const masques: string[] = [];
        for (let i = 0; i < 45; i++) {
          await page.keyboard.press("Tab");
          const m = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            if (!el || !el.closest("[data-gabarit]")) return null;
            const r = el.getBoundingClientRect();
            if (r.width < 1) return null;
            const pt = document.elementFromPoint(
              Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1),
              Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1),
            );
            if (!pt || el === pt || el.contains(pt) || pt.contains(el)) return null;
            if (pt.tagName.toLowerCase() === "nextjs-portal") return null; // surcouche de développement
            return `focus masqué : ${el.tagName.toLowerCase()} « ${(el.textContent ?? "").trim().slice(0, 24)} » sous ${pt.tagName.toLowerCase()}.${String(pt.className).slice(0, 30)}`;
          });
          if (m) masques.push(m);
        }
        for (const m of masques.slice(0, 5)) defauts["e"]!.push(m);

        // (e) fin de page : le dernier contenu n'est pas caché sous la barre fixe du bas.
        const sousBarre = await page.evaluate(() => {
          window.scrollTo(0, document.documentElement.scrollHeight);
          const barres = Array.from(
            document.querySelectorAll<HTMLElement>("[data-gabarit] *"),
          ).filter(
            (e) =>
              getComputedStyle(e).position === "fixed" &&
              e.getBoundingClientRect().bottom >= window.innerHeight - 1 &&
              e.getBoundingClientRect().height > 1,
          );
          const pieds = document.querySelectorAll("footer");
          const zone = pieds[pieds.length - 1] ?? document.body;
          const dernier = Array.from(zone.querySelectorAll<HTMLElement>("a, p, li"))
            .filter((e) => e.getBoundingClientRect().height > 1)
            .pop();
          if (!dernier) return null;
          const r = dernier.getBoundingClientRect();
          for (const b of barres)
            if (r.bottom > b.getBoundingClientRect().top + 1)
              return `fin de page cachée sous la barre fixe (${Math.round(r.bottom)} > ${Math.round(b.getBoundingClientRect().top)})`;
          return null;
        });
        if (sousBarre) defauts["e"]!.push(sousBarre);

        // Captures (360 et 1280).
        if (largeur === 360 || largeur === 1280) {
          await page.evaluate(() => window.scrollTo(0, 0));
          // JPEG qualité 70 : une page entière à 360 px fait ~9 000 px de haut ; en PNG, 18 Mo pour 16 images.
          const img = await page.screenshot({ fullPage: true, type: "jpeg", quality: 70 });
          await testInfo.attach(`${gabarit}-${largeur}.jpg`, {
            body: img,
            contentType: "image/jpeg",
          });
          if (process.env["CAPTURES_MOBILE"] === "1") {
            const dir = path.join(process.cwd(), "docs", "captures-mobile");
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, `${gabarit}-${largeur}.jpg`), img);
          }
        }

        const tous = Object.entries(defauts).flatMap(([k, v]) => v.map((m) => `(${k}) ${m}`));
        expect(tous, `défauts de ${gabarit} à ${largeur} px`).toEqual([]);
      });
    }

    test(`${gabarit} : zoom texte 200 % et refusion à 320 px`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "chromium", "mesures calées sur Chromium");
      test.setTimeout(90_000);
      await page.setViewportSize({ width: 320, height: 256 }); // 1280 × 1024 à 400 % (WCAG 1.4.10)
      const rep = await page.goto(`/fr/blog/apercu-gabarit/${gabarit}`, { waitUntil: "load" });
      test.skip(rep?.status() === 404, "page d'aperçu absente : BLOG_GABARITS_V2 éteint");
      await page.evaluate(() => document.fonts.ready);
      const avant = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").length);
      await page.addStyleTag({ content: "html{font-size:200% !important}" });
      await page.waitForTimeout(300);
      const res = await page.evaluate(() => {
        const defauts: string[] = [];
        const racine = document.querySelector("[data-gabarit]")!;
        // Le gabarit (hors tableaux, qui défilent dans leur cadre) tient dans 320 px. L'en-tête du site,
        // commun à toutes les pages, est hors périmètre de ce contrôle.
        for (const el of Array.from(racine.querySelectorAll<HTMLElement>("*"))) {
          if (el.closest(".table-scroll, .tableau__defilant, svg, [aria-hidden='true']")) continue;
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > window.innerWidth + 1)
            defauts.push(
              `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)} dépasse à droite (${Math.round(r.right)} > ${window.innerWidth})`,
            );
        }
        for (const el of Array.from(racine.querySelectorAll<HTMLElement>("*"))) {
          const cs = getComputedStyle(el);
          if (!/(hidden|clip)/.test(cs.overflowX + cs.overflowY)) continue;
          if (!(el.textContent ?? "").trim()) continue;
          if (el.scrollHeight <= el.clientHeight + 2 && el.scrollWidth <= el.clientWidth + 2)
            continue;
          // Seul un enfant porteur de texte, hors décor, compte : les disques décoratifs rognés sont voulus.
          const b = el.getBoundingClientRect();
          const rogne = Array.from(el.querySelectorAll<HTMLElement>("*")).find((c) => {
            if (
              c.closest("[aria-hidden='true']") ||
              !Array.from(c.childNodes).some(
                (n) => n.nodeType === 3 && (n.textContent ?? "").trim(),
              )
            )
              return false;
            const r = c.getBoundingClientRect();
            return (
              r.width > 0 &&
              (r.right > b.right + 1 || r.left < b.left - 1 || r.bottom > b.bottom + 1)
            );
          });
          if (rogne)
            defauts.push(
              `texte rogné dans ${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} : « ${(rogne.textContent ?? "").trim().slice(0, 30)} »`,
            );
        }
        return { defauts, apres: document.body.innerText.replace(/\s+/g, " ").length };
      });
      expect(res.apres, "le texte affiché ne doit pas disparaître au zoom").toBeGreaterThanOrEqual(
        avant * 0.98,
      );
      expect(res.defauts).toEqual([]);
    });
  });
}
