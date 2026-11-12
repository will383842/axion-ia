// @vitest-environment node
//
// Lot L3b — contrat v3 d'origine (ADR-CONTRAT-V3-ORIGINE §1, §3, §4, I4, I6).
// Adresses en `.test` ; aucune vraie URL de publication, aucun vrai jeton.
import { describe, it, expect } from "vitest";
import { analyserCorps, SchemaDemandeGuideReseau } from "../contrat";
import { prefixesDepuisEnv, validerPostUrl } from "../post-url";
import { CAMPAGNES_UTM_CONNUES, VERSIONS_TEXTE_CONNUES } from "../valeurs-connues";
import dico from "@/content/dictionnaire-origine.v1.json";
import { EMPREINTE_DICTIONNAIRE, empreinteDictionnaire } from "@/content/dictionnaire-origine";

const PREFIXES = { instagram: ["/nos-comptes-test/"], facebook: ["/page-test/"] };
const v1 = {
  schemaVersion: 1,
  cleIdempotence: "run_zernio_0001",
  email: "personne@exemple.test",
  mot: "guide",
  reseau: "instagram",
  guide: "guide-ia",
  accord: "non_demande",
  versionTexteM1: "m1-brouillon-v1",
};
const v3min = { ...v1, schemaVersion: 3 };
const v3 = {
  ...v3min,
  post_ref: "post_ref_test_01",
  canal: "commentaire",
  famille: "guide_reseau",
  detail: "autre_non_classe",
  compte: "page_principale",
  version_texte: "m1-v1",
  utm_campaign: "guide_reseau",
  commentaire_ref: "comm_ref_test_01",
};
const corps = (o: unknown) => Buffer.from(JSON.stringify(o));

describe("versions", () => {
  it("v1 toujours acceptée", () => expect(analyserCorps(corps(v1)).ok).toBe(true));
  it("v3 minimale acceptée", () => expect(analyserCorps(corps(v3min)).ok).toBe(true));
  it("v3 complète acceptée", () => expect(analyserCorps(corps(v3)).ok).toBe(true));
  it("version 2 et 4 refusées", () => {
    expect(analyserCorps(corps({ ...v1, schemaVersion: 2 })).ok).toBe(false);
    expect(analyserCorps(corps({ ...v1, schemaVersion: 4 })).ok).toBe(false);
  });
  it("v1 n'accepte pas les champs v3", () => {
    expect(
      SchemaDemandeGuideReseau.safeParse({ ...v1, post_ref: "post_ref_test_01" }).success,
    ).toBe(false);
  });
  it.each([1, 3])("clé inconnue refusée en v%i", (n) => {
    const r = analyserCorps(corps({ ...v1, schemaVersion: n, inconnu: "x" }));
    expect(r.ok).toBe(false);
  });
  it("v3 : clé inconnue → unknown_field, sans la valeur ni le nom reçu", () => {
    const r = analyserCorps(corps({ ...v3min, secret_x: "valeur-confidentielle" }));
    expect(r).toMatchObject({ ok: false, erreur: "unknown_field" });
    expect(JSON.stringify(r)).not.toContain("valeur-confidentielle");
    expect(JSON.stringify(r)).not.toContain("secret_x");
  });
  it.each(["pseudo", "nom", "texte", "profil_id", "display_name"])("%s refusé en v3", (k) => {
    expect(analyserCorps(corps({ ...v3, [k]: "quelquun" })).ok).toBe(false);
  });
});

describe("champs v3", () => {
  const refuse = (patch: Record<string, unknown>) =>
    expect(analyserCorps(corps({ ...v3, ...patch })).ok).toBe(false);
  it("post_ref invalide", () => refuse({ post_ref: "court" }));
  it("canal hors liste", () => refuse({ canal: "sms" }));
  it("famille hors dictionnaire", () => refuse({ famille: "inventee" }));
  it("détail hors famille", () => refuse({ detail: "inconnu_ici" }));
  it("détail sans famille", () => {
    const { famille: _f, ...sans } = v3;
    expect(analyserCorps(corps(sans)).ok).toBe(false);
  });
  it("compte hors liste fermée (un pseudo)", () => refuse({ compte: "@jean_dupont" }));
  it("version_texte invalide", () => refuse({ version_texte: "a b" }));
  it("utm_campaign invalide", () => refuse({ utm_campaign: "Camp Majuscule" }));
  it("LISTE FERMÉE : un pseudo conforme à l'ancienne regex est refusé", () => {
    refuse({ utm_campaign: "jean_dupont_75" });
    refuse({ version_texte: "jean_dupont_75" });
  });
  it.each(CAMPAGNES_UTM_CONNUES)("utm_campaign connue acceptée : %s", (utm_campaign) =>
    expect(analyserCorps(corps({ ...v3, utm_campaign })).ok).toBe(true),
  );
  it.each(VERSIONS_TEXTE_CONNUES)("version_texte connue acceptée : %s", (version_texte) =>
    expect(analyserCorps(corps({ ...v3, version_texte })).ok).toBe(true),
  );
  describe("versions de texte du Studio (liste fermée)", () => {
    const ANCIENNES = ["m1-brouillon-v1", "m1-v1"];
    const STUDIO = [
      "mp-m1-v2",
      "mp-m1-v2-a",
      "mp-m1-v2-b",
      "mp-m1-v2-c",
      "mp-m1-v2-d",
      "mp-m1-v2-e",
      "mp-m1-v3",
      "mp-m1-v5-1",
      "mp-m1-v5-2",
      "mp-m1-v5-3",
      "mp-m1-v5-4",
    ];
    it.each(STUDIO)("version Studio acceptée par le contrat : %s", (version_texte) =>
      expect(analyserCorps(corps({ ...v3, version_texte })).ok).toBe(true),
    );
    it("une valeur inconnue reste refusée", () => {
      refuse({ version_texte: "jean_dupont_75" });
      refuse({ version_texte: "mp-m1-v4" });
      refuse({ version_texte: "mp-m1-v9-9" });
    });
    it("aucune ancienne valeur n'a disparu", () => {
      for (const v of ANCIENNES) expect(VERSIONS_TEXTE_CONNUES as readonly string[]).toContain(v);
    });
    it("toutes les valeurs respectent le format version_texte du CRM", () => {
      for (const v of VERSIONS_TEXTE_CONNUES) expect(v).toMatch(/^[A-Za-z0-9._-]{3,64}$/);
    });
  });
  it.each(["linkedin_page", "tiktok"])("message_prive refusé sur %s", (reseau) =>
    refuse({ reseau, canal: "message_prive" }),
  );
  it("message_prive accepté sur instagram", () =>
    expect(analyserCorps(corps({ ...v3, canal: "message_prive" })).ok).toBe(true));
  it("les erreurs ne contiennent jamais la valeur reçue", () => {
    const r = analyserCorps(corps({ ...v3, post_ref: "e@exemple.test" }));
    expect(JSON.stringify(r)).not.toContain("exemple.test");
  });
});

describe("post_url (I4)", () => {
  const ok = (u: string, reseau = "instagram") => validerPostUrl(u, reseau, PREFIXES).ok;
  const bonne = "https://www.instagram.com/nos-comptes-test/p/AbC123/";
  it("acceptée", () => expect(ok(bonne)).toBe(true));
  it("http refusé", () => expect(ok(bonne.replace("https", "http"))).toBe(false));
  it("hôte hors liste refusé", () =>
    expect(ok("https://evil.test/nos-comptes-test/p/x")).toBe(false));
  it("jamais endsWith", () =>
    expect(ok("https://www.instagram.com.evil.test/nos-comptes-test/p/x")).toBe(false));
  it("sous-domaine refusé", () =>
    expect(ok("https://x.www.instagram.com/nos-comptes-test/p/x")).toBe(false));
  it("port, identifiant, paramètre, fragment refusés", () => {
    expect(ok("https://www.instagram.com:444/nos-comptes-test/p/x")).toBe(false);
    expect(ok("https://u:p@www.instagram.com/nos-comptes-test/p/x")).toBe(false);
    expect(ok(bonne + "?utm=1")).toBe(false);
    expect(ok(bonne + "#c1")).toBe(false);
  });
  it("IDN refusé (chemin non ASCII)", () =>
    expect(ok("https://www.instagram.com/nos-comptes-test/é")).toBe(false));
  it("IDN refusé : hôte IDN réel, en unicode et en punycode (xn--)", () => {
    const unicode = "https://www.ınstagram.com/nos-comptes-test/p/AbC123/"; // « ı » sans point
    const punycode = new URL(unicode).hostname; // forme xn-- que `new URL` produit
    expect(punycode).toContain("xn--");
    expect(ok(unicode)).toBe(false);
    expect(ok(`https://${punycode}/nos-comptes-test/p/AbC123/`)).toBe(false);
  });
  it("préfixe d'environnement sans `/` final : écarté, `/page-testpseudo/` refusé", () => {
    const sans = prefixesDepuisEnv({
      GUIDES_RESEAU_POST_URL_PREFIXES: JSON.stringify({ facebook: ["/page-test"] }),
    });
    expect(sans.facebook).toEqual([]);
    expect(
      validerPostUrl("https://www.facebook.com/page-testpseudo/p/1", "facebook", sans).ok,
    ).toBe(false);
    const avec = prefixesDepuisEnv({
      GUIDES_RESEAU_POST_URL_PREFIXES: JSON.stringify({ facebook: ["/page-test/"] }),
    });
    expect(avec.facebook).toEqual(["/page-test/"]);
    expect(
      validerPostUrl("https://www.facebook.com/page-testpseudo/p/1", "facebook", avec).ok,
    ).toBe(false);
    expect(validerPostUrl("https://www.facebook.com/page-test/p/1", "facebook", avec).ok).toBe(
      true,
    );
  });
  it("raccourcisseur refusé", () => expect(ok("https://bit.ly/abc")).toBe(false));
  it("chemin de profil refusé (hors préfixe de nos comptes)", () => {
    expect(ok("https://www.instagram.com/un_pseudo/")).toBe(false);
    expect(ok("https://www.instagram.com/")).toBe(false);
  });
  it("préfixe absent de la configuration : tout refusé (fermé par défaut)", () =>
    expect(validerPostUrl(bonne, "instagram", {}).ok).toBe(false));
  it("plus de 300 caractères refusé", () => expect(ok(bonne + "a".repeat(300))).toBe(false));
  it("valider dans le contrat : post_url refusée remonte en schema_invalide", () => {
    const r = analyserCorps(corps({ ...v3, post_url: "http://x.test/" }));
    expect(r.ok).toBe(false);
  });
});

describe("dictionnaire (§4)", () => {
  it("chaque famille porte autre_non_classe, clés ASCII minuscules", () => {
    for (const [f, d] of Object.entries(dico.familles)) {
      expect(f).toMatch(/^[a-z0-9_]+$/);
      expect(Object.keys(d.details)).toContain("autre_non_classe");
    }
    expect(Object.keys(dico.familles)).toEqual(
      expect.arrayContaining([
        "guide_reseau",
        "cas_concret",
        "carrousel",
        "video",
        "tour_france_ia",
        "autre",
      ]),
    );
  });
  it("aucun nom, montant ni pseudo (pas de @, pas de chiffre monétaire)", () => {
    const t = JSON.stringify(dico);
    expect(t).not.toMatch(/@|€|\beuros?\b/i);
  });
  it("libellé de la famille tour_france_ia : « Tour France IA »", () => {
    expect(dico.familles.tour_france_ia.libelle).toBe("Tour France IA");
  });
  it("empreinte SHA-256 du JSON canonique = constante", () => {
    expect(empreinteDictionnaire(dico)).toBe(EMPREINTE_DICTIONNAIRE);
    expect(EMPREINTE_DICTIONNAIRE).toMatch(/^[0-9a-f]{64}$/);
  });
  it("l'empreinte change si une clé change (contre-témoin)", () => {
    const copie = JSON.parse(JSON.stringify(dico));
    copie.familles.autre.details.ajout_test = { libelle: "x" };
    expect(empreinteDictionnaire(copie)).not.toBe(EMPREINTE_DICTIONNAIRE);
  });
  it("l'empreinte ne dépend pas de l'ordre des clés", () => {
    const inverser = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(inverser)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.entries(v)
                .reverse()
                .map(([k, x]) => [k, inverser(x)]),
            )
          : v;
    expect(empreinteDictionnaire(inverser(dico))).toBe(EMPREINTE_DICTIONNAIRE);
  });
});
