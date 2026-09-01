// @vitest-environment node

/**
 * Verrou — un lien d'annulation ne transporte aucune donnée personnelle, et il
 * vit aussi longtemps que le rendez-vous.
 *
 * ## Les deux propriétés, et pourquoi aucune ne se voit en relecture
 *
 * **1. Le contenu d'un jeton est SIGNÉ, PAS CHIFFRÉ.** C'est le fait qui rend
 * la première propriété non évidente : `signMagicToken` accepte un champ
 * `email`, il est tentant de le remplir « pour retrouver la personne », et rien
 * dans le code appelant ne rappelle que la valeur se relit d'un décodage
 * base64. L'adresse se retrouverait alors dans l'URL — donc dans l'historique
 * du navigateur, les journaux du serveur et de Cloudflare, et l'en-tête
 * `Referer` envoyé à tout tiers que la page suivante contacterait.
 *
 * Ce test DÉCODE le jeton et lit ce qu'il porte réellement. Vérifier la
 * signature ne dirait rien : un jeton portant une adresse est parfaitement
 * valide.
 *
 * **2. La durée de vie vient du RENDEZ-VOUS, pas du défaut du scope.** Le
 * module de jetons donne 24 h à `cancel`. Or la confirmation part dès la
 * réservation et le rendez-vous peut être à trois semaines : le lien serait
 * mort bien avant qu'on en ait besoin, alors que l'e-mail promet noir sur blanc
 * de pouvoir se décommander. Personne ne s'en apercevrait — un lien expiré ne
 * remonte pas, la personne appelle ou ne vient pas.
 */

import { describe, expect, it, beforeAll, vi } from "vitest";

import {
  lienDuGeste,
  lireLeLien,
  dureeDeVieMs,
  cheminDuGeste,
  MARGE_APRES_MINUTES,
  PLANCHER_MINUTES,
  PLAFOND_JOURS,
} from "../liens-rendez-vous";

const RDV_ID = "clx9k2m4a0001qw8h7yz3n5vb";
const MAINTENANT = new Date("2026-09-01T12:00:00.000Z");

beforeAll(() => {
  // `magic-token` lit `AUTH_SECRET` et exige au moins 32 caractères.
  process.env["AUTH_SECRET"] = "un-secret-de-test-suffisamment-long-pour-passer";
});

/** Le jeton d'une adresse `?t=…`, décodé. */
function chargeUtile(url: string): Record<string, unknown> {
  const jeton = decodeURIComponent(url.split("t=")[1] ?? "");
  const payloadB64 = jeton.split(".")[0] ?? "";
  const json = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8",
  );
  return JSON.parse(json) as Record<string, unknown>;
}

describe("🔴 le jeton ne porte AUCUNE donnée personnelle", () => {
  it("il porte l'identifiant de NOTRE ligne, et rien d'autre d'identifiant", async () => {
    const url = await lienDuGeste({
      rendezVousId: RDV_ID,
      debut: new Date("2026-09-25T09:30:00.000Z"),
      locale: "fr",
      geste: "cancel",
      maintenant: MAINTENANT,
    });
    const charge = chargeUtile(url);

    expect(charge["resourceId"]).toBe(RDV_ID);
    expect(
      charge["email"],
      "le contenu d'un jeton se relit d'un décodage base64 — une adresse ici " +
        "serait une adresse dans l'URL, donc dans l'historique, les journaux et " +
        "le Referer",
    ).toBeUndefined();
  });

  it("🔑 le jeton décodé ne contient aucun caractère d'adresse", async () => {
    // Garde plus large que la précédente : elle attraperait une adresse rangée
    // sous un autre nom de champ, ou concaténée dans le `resourceId`.
    const url = await lienDuGeste({
      rendezVousId: RDV_ID,
      debut: new Date("2026-09-25T09:30:00.000Z"),
      locale: "fr",
      geste: "cancel",
      maintenant: MAINTENANT,
    });
    expect(JSON.stringify(chargeUtile(url))).not.toContain("@");
  });

  it("🔑 CONTRE-TÉMOIN : le décodage lit bien quelque chose", () => {
    // Sans lui, une extraction cassée rendrait un objet vide, et les deux tests
    // ci-dessus passeraient en ne regardant rien.
    const faux = `${cheminDuGeste("fr", "cancel")}?t=${encodeURIComponent(
      `${Buffer.from(JSON.stringify({ resourceId: "x", email: "a@b.fr" })).toString("base64url")}.sig`,
    )}`;
    expect(chargeUtile(faux)["email"]).toBe("a@b.fr");
  });
});

describe("🔴 la durée de vie suit le rendez-vous", () => {
  it("un rendez-vous à trois semaines donne un lien de trois semaines", () => {
    // Le défaut du scope est de 24 h : un lien mort avant d'avoir servi, sur un
    // e-mail qui promet de pouvoir se décommander.
    const dans21j = new Date(MAINTENANT.getTime() + 21 * 86_400_000);
    const ms = dureeDeVieMs(dans21j, MAINTENANT);
    expect(ms).toBeGreaterThan(20 * 86_400_000);
    expect(
      ms,
      "24 h serait le défaut du scope — c'est exactement ce qu'on refuse ici",
    ).toBeGreaterThan(24 * 60 * 60 * 1000);
  });

  it("la marge d'après rendez-vous est bien ajoutée", () => {
    // Un lien qui expire à l'heure pile serait mort PENDANT le rendez-vous.
    const dans1h = new Date(MAINTENANT.getTime() + 3_600_000);
    expect(dureeDeVieMs(dans1h, MAINTENANT)).toBe(3_600_000 + MARGE_APRES_MINUTES * 60_000);
  });

  it("🔑 un rendez-vous DÉJÀ PASSÉ ne fabrique pas un jeton mort-né", () => {
    // Sans plancher, la durée serait négative : la page dirait « lien expiré »
    // à propos d'un lien qui vient d'être fabriqué — incompréhensible pour qui
    // le reçoit, et indiscernable d'une vraie expiration pour qui déboguera.
    const hier = new Date(MAINTENANT.getTime() - 86_400_000);
    expect(dureeDeVieMs(hier, MAINTENANT)).toBe(PLANCHER_MINUTES * 60_000);
  });

  it("🔴 le LIEN utilise réellement cette durée — pas seulement la fonction", async () => {
    // ⚠️ GARDE AJOUTÉE APRÈS COUP, PARCE QUE LES AUTRES ÉTAIENT MUETTES.
    //
    // Les tests ci-dessus éprouvent `dureeDeVieMs` toute seule. Retirer
    // `ttlMs` de l'appel à `signMagicToken` — donc retomber sur le défaut de
    // 24 h du scope, exactement le défaut qu'on cherche à éviter — ne les
    // faisait PAS rougir : la fonction restait juste, mais plus personne ne
    // l'appelait.
    //
    // Une fonction correcte et débranchée est indiscernable d'une fonction
    // correcte et branchée, tant qu'on ne mesure que la fonction. On lit donc
    // l'expiration DANS LE JETON ÉMIS.
    const dans21j = new Date(Date.now() + 21 * 86_400_000);
    const url = await lienDuGeste({
      rendezVousId: RDV_ID,
      debut: dans21j,
      locale: "fr",
      geste: "cancel",
    });
    const exp = Number(chargeUtile(url)["exp"]);
    const restant = exp - Date.now();

    expect(
      restant,
      "le jeton expire dans moins de 24 h : `ttlMs` n'est pas transmis, et le " +
        "lien meurt vingt jours avant le rendez-vous qu'il sert à annuler",
    ).toBeGreaterThan(24 * 60 * 60 * 1000);
    expect(restant).toBeGreaterThan(20 * 86_400_000);
  });

  it("un rendez-vous absurdement lointain est plafonné", () => {
    const dans10ans = new Date(MAINTENANT.getTime() + 3650 * 86_400_000);
    expect(dureeDeVieMs(dans10ans, MAINTENANT)).toBe(PLAFOND_JOURS * 86_400_000);
  });
});

describe("🔴 un jeton ne vaut que pour SON geste", () => {
  it("un jeton d'annulation présenté comme un report est refusé", async () => {
    // La séparation qui empêche qu'un lien d'annulation, transféré ou deviné,
    // serve à déplacer un rendez-vous — et l'inverse.
    const url = await lienDuGeste({
      rendezVousId: RDV_ID,
      debut: new Date("2026-09-25T09:30:00.000Z"),
      locale: "fr",
      geste: "cancel",
      maintenant: MAINTENANT,
    });
    const jeton = decodeURIComponent(url.split("t=")[1] ?? "");

    const bon = await lireLeLien(jeton, "cancel");
    expect(bon.ok, "son propre geste doit passer").toBe(true);

    const mauvais = await lireLeLien(jeton, "reschedule");
    expect(mauvais.ok).toBe(false);
    if (mauvais.ok) return;
    expect(
      mauvais.raison,
      "un lien détourné n'est pas un lien abîmé — les confondre effacerait le signal",
    ).toBe("mauvais_geste");
  });

  it("un jeton illisible est « invalide », pas « expiré »", async () => {
    // Les deux mènent à un refus, mais pas au même message. « Ce lien a expiré,
    // appelez-nous » est actionnable ; « lien invalide » ne l'est pas.
    for (const brut of ["", "n'importe.quoi", "aaa.bbb"]) {
      const r = await lireLeLien(brut, "cancel");
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.raison).toBe("invalide");
    }
  });

  it("🔴 un jeton EXPIRÉ se distingue d'un jeton invalide", async () => {
    // ⚠️ La distinction porte tout le diagnostic d'une rotation de secret : une
    // rotation produit des « invalide » EN MASSE sur des liens légitimes. Si
    // l'expiration se confondait avec elle, on ne saurait jamais lequel des deux
    // on observe.
    //
    // 🔑 IL FAUT UNE HORLOGE FACTICE, et le premier jet l'ignorait : passer un
    // `maintenant` au module ne déplace que le CALCUL de la durée de vie.
    // `signMagicToken`, lui, écrit `exp = Date.now() + ttlMs` sur l'horloge
    // RÉELLE. Un jeton signé « il y a 401 jours » avec une durée d'un jour
    // expirait donc… demain. Le test passait sans mesurer l'expiration.
    let jeton = "";
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const url = await lienDuGeste({
        rendezVousId: RDV_ID,
        debut: new Date("2026-01-01T02:00:00.000Z"),
        locale: "fr",
        geste: "cancel",
      });
      jeton = decodeURIComponent(url.split("t=")[1] ?? "");
    } finally {
      // ⚠️ `finally` et pas une ligne après le bloc : si la signature levait,
      // l'horloge factice resterait posée et empoisonnerait TOUS les tests
      // suivants du fichier, avec des échecs qui n'auraient aucun rapport.
      vi.useRealTimers();
    }
    // De retour sur l'horloge réelle, le jeton de janvier est largement expiré.
    const r = await lireLeLien(jeton, "cancel");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe("expire");
  });
});

describe("le chemin", () => {
  it("chaque geste a le sien, et la locale est respectée", () => {
    expect(cheminDuGeste("fr", "cancel")).toBe("/fr/appel/annuler");
    expect(cheminDuGeste("fr", "reschedule")).toBe("/fr/appel/reporter");
    expect(cheminDuGeste("en", "cancel")).toBe("/en/appel/annuler");
  });

  it("🔑 l'adresse rendue est RELATIVE", async () => {
    // L'origine est ajoutée par l'appelant, qui la connaît. La coder ici ferait
    // fabriquer des liens d'e-mail sur une mauvaise origine — un lien mort
    // qu'on ne découvre qu'en production, chez le destinataire.
    const url = await lienDuGeste({
      rendezVousId: RDV_ID,
      debut: new Date("2026-09-25T09:30:00.000Z"),
      locale: "fr",
      geste: "cancel",
      maintenant: MAINTENANT,
    });
    expect(url.startsWith("/fr/appel/annuler?t=")).toBe(true);
    expect(url).not.toContain("http");
  });
});
