import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { eurosVersCents } from "@/components/admin/qualiopi/devis-formules/saisie";
import { TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";
import { lirePayload, normaliserEuros, payloadVide, TAILLE_MAX_PAYLOAD_OCTETS } from "../payload";

const FICHIER = resolve(__dirname, "../payload.ts");

/** Toutes les valeurs de type chaîne d'un objet, récursivement (clés incluses pour le diagnostic). */
function chaines(v: unknown, chemin = "", sortie: Array<[string, string]> = []) {
  if (typeof v === "string") sortie.push([chemin, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => chaines(x, `${chemin}.${i}`, sortie));
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) chaines(x, `${chemin}.${k}`, sortie);
  return sortie;
}

describe("payloadVide", () => {
  it("ne porte aucun prix, aucun modèle, aucun client", () => {
    const p = payloadVide(20);
    expect(p.v).toBe(1);
    expect(p.etape).toBe(1);
    expect(p.modeleId).toBeNull();
    expect(p.clientId).toBeNull();
    expect(p.typeDevis).toBeNull();
    expect(p.dateValidite).toBeNull();
    expect(p.sync).toEqual({ devisId: null, devisMajLe: null });
    const prix = chaines(p).filter(([c]) =>
      /prixEur|mensuelEur|mensuelCatalogueEur|hebergementMensuelEur/.test(c),
    );
    expect(prix.length).toBeGreaterThan(0);
    for (const [chemin, valeur] of prix) expect(valeur, chemin).toBe("");
  });

  it("une ligne classique neuve a un prix vide", () => {
    const p = payloadVide(20);
    for (const l of p.lignesClassiques) expect(l.prixEur).toBe("");
  });

  it("reprend le taux de TVA passé en paramètre, sans le deviner", () => {
    expect(payloadVide(20).formules.abonnement.tauxTvaPct).toBe("20");
    expect(payloadVide(21).formules.achat.lignes[0]!.tauxTvaPct).toBe("21");
    expect(payloadVide(TAUX_TVA_STANDARD).formules.abonnement.tauxTvaPct).toBe(
      String(TAUX_TVA_STANDARD),
    );
  });

  it("deux appels ne partagent aucun objet", () => {
    const a = payloadVide(20);
    const b = payloadVide(20);
    a.lignesClassiques.push({ designation: "x", quantite: "1", prixEur: "1" });
    expect(b.lignesClassiques).toHaveLength(payloadVide(20).lignesClassiques.length);
  });
});

describe("lirePayload", () => {
  it("relit un payload vide à l'identique", () => {
    const r = lirePayload(JSON.parse(JSON.stringify(payloadVide(20))));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload).toEqual(payloadVide(TAUX_TVA_STANDARD));
  });

  it("garde un brouillon partiel : ce qui est saisi est conservé, le reste prend le vide", () => {
    const r = lirePayload({
      v: 1,
      etape: 2,
      clientId: "c-1",
      activite: "implementation",
      recit: { intitule: "Assistant de réponse" },
      lignesClassiques: [{ designation: "Audit", quantite: "2", prixEur: "1 190,50" }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.etape).toBe(2);
    expect(r.payload.clientId).toBe("c-1");
    expect(r.payload.activite).toBe("implementation");
    expect(r.payload.recit.intitule).toBe("Assistant de réponse");
    expect(r.payload.recit.besoinClient).toBe("");
    expect(r.payload.lignesClassiques[0]).toMatchObject({
      designation: "Audit",
      prixEur: "1 190,50",
    });
    expect(r.payload.formules.formules).toEqual({ achat: false, abonnement: false });
    expect(r.payload.sync).toEqual({ devisId: null, devisMajLe: null });
  });

  it("garde le prix saisi tel quel (jamais ramené à 0)", () => {
    const r = lirePayload({
      v: 1,
      lignesClassiques: [{ designation: "x", quantite: "1", prixEur: "abc" }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.lignesClassiques[0]!.prixEur).toBe("abc");
  });

  it("refuse ce qui n'est pas un objet ou une autre version", () => {
    for (const brut of [null, undefined, 12, "x", [], { v: 2 }, { etape: 1 }]) {
      expect(lirePayload(brut).ok, JSON.stringify(brut)).toBe(false);
    }
  });

  it("refuse une étape hors 1 à 4", () => {
    expect(lirePayload({ v: 1, etape: 5 }).ok).toBe(false);
    expect(lirePayload({ v: 1, etape: 0 }).ok).toBe(false);
  });

  it("refuse plus de 256 Ko de JSON", () => {
    expect(TAILLE_MAX_PAYLOAD_OCTETS).toBe(256 * 1024);
    const gros = { v: 1, recit: { intitule: "a".repeat(TAILLE_MAX_PAYLOAD_OCTETS) } };
    const r = lirePayload(gros);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/256/);
  });

  it("compte des octets, pas des caractères", () => {
    const n = Math.floor(TAILLE_MAX_PAYLOAD_OCTETS / 3) + 10; // « é » = 2 octets, « € » = 3
    const r = lirePayload({ v: 1, recit: { intitule: "€".repeat(n) } });
    expect(r.ok).toBe(false);
  });

  it("accepte juste sous la limite", () => {
    const r = lirePayload({
      v: 1,
      recit: { intitule: "a".repeat(TAILLE_MAX_PAYLOAD_OCTETS - 200) },
    });
    expect(r.ok).toBe(true);
  });

  it("refuse un objet qui ne se sérialise pas (référence circulaire)", () => {
    const o: Record<string, unknown> = { v: 1 };
    o.moi = o;
    expect(lirePayload(o).ok).toBe(false);
  });

  it.each(["contactEmail", "contactNom", "contactTelephone", "email", "telephone", "phone"])(
    "refuse la clé de contact libre « %s » à la racine",
    (cle) => {
      const r = lirePayload({ v: 1, [cle]: "x" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain(cle);
    },
  );

  it("refuse une clé de contact imbriquée (recit, nonImprime, ligne)", () => {
    expect(lirePayload({ v: 1, recit: { contactEmail: "a@b.fr" } }).ok).toBe(false);
    expect(lirePayload({ v: 1, nonImprime: { a: { telephone: "06" } } }).ok).toBe(false);
    expect(
      lirePayload({ v: 1, lignesClassiques: [{ designation: "x", EMAIL: "a@b.fr" }] }).ok,
    ).toBe(false);
  });

  it("refuse une clé de contact au-delà de la profondeur maximale (niveau 14)", () => {
    let o: unknown = { email: "x@y.fr" };
    for (let i = 0; i < 13; i++) o = { n: o };
    const r = lirePayload({ v: 1, nonImprime: o });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("imbriqué");
  });

  it.each([
    "contact_email",
    "e-mail",
    "emailContact",
    "adresseEmail",
    "portable",
    "nom_contact",
    "Téléphone",
    "adresse_de_contact",
  ])("refuse la variante de clé de contact « %s »", (cle) => {
    expect(lirePayload({ v: 1, nonImprime: { [cle]: "x" } }).ok).toBe(false);
  });

  it("accepte un payload légitime complet (aucune clé de payloadVide refusée)", () => {
    const vide = payloadVide(TAUX_TVA_STANDARD);
    expect(lirePayload({ ...vide, nonImprime: { note: "ok", tarif: { remise: "5" } } }).ok).toBe(
      true,
    );
  });

  it("n'invente pas de refus : une valeur texte contenant « email » n'est pas une clé", () => {
    const r = lirePayload({ v: 1, recit: { intitule: "relance par email" } });
    expect(r.ok).toBe(true);
  });

  it("ignore une valeur de mauvais type au lieu de perdre tout le brouillon", () => {
    const r = lirePayload({
      v: 1,
      clientId: 42,
      activite: "inconnue",
      typeDevis: "autre",
      lignesClassiques: "x",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.clientId).toBeNull();
    expect(r.payload.activite).toBeNull();
    expect(r.payload.typeDevis).toBeNull();
    expect(r.payload.lignesClassiques).toEqual(payloadVide(TAUX_TVA_STANDARD).lignesClassiques);
  });

  it("conserve la saisie des formules (phases, périodes) et rejette un enum invalide", () => {
    const base = payloadVide(20);
    const formules = JSON.parse(JSON.stringify(base.formules));
    formules.formules.achat = true;
    formules.achat.phases = [
      { libelle: "Acompte", pourcentage: "30", declencheur: "signature" },
      { libelle: "Solde", pourcentage: "70", declencheur: "livraison" },
    ];
    formules.achat.maintenance.periodes = [1, 12, 3];
    const r = lirePayload({ v: 1, formules });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.formules.formules.achat).toBe(true);
    expect(r.payload.formules.achat.phases).toHaveLength(2);
    expect(r.payload.formules.achat.phases[1]!.declencheur).toBe("livraison");
    // une période de 3 mois n'existe pas : elle ne traverse pas la lecture
    expect(r.payload.formules.achat.maintenance.periodes).toEqual([1, 12]);
  });

  it("ne mute pas l'entrée", () => {
    const brut = { v: 1, etape: 3, recit: { intitule: "a" } };
    const copie = JSON.stringify(brut);
    lirePayload(brut);
    expect(JSON.stringify(brut)).toBe(copie);
  });

  it("garde les textes copiés et le champ nonImprime", () => {
    const r = lirePayload({
      v: 1,
      textes: [{ texte: "Garantie", actif: true }, { texte: 3 }],
      nonImprime: { delai: "4 semaines" },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.textes).toEqual([{ texte: "Garantie", actif: true }]);
    expect(r.payload.nonImprime).toEqual({ delai: "4 semaines" });
  });
});

describe("normaliserEuros", () => {
  it("retire les espaces, U+00A0 et U+202F avant eurosVersCents", () => {
    expect(eurosVersCents(normaliserEuros("1 190,50"))).toBe(119050);
    expect(eurosVersCents(normaliserEuros("1\u00A0190,50"))).toBe(119050);
    expect(eurosVersCents(normaliserEuros("1\u202F190,50"))).toBe(119050);
    expect(eurosVersCents(normaliserEuros(" 2 400 "))).toBe(240000);
    expect(eurosVersCents(normaliserEuros("2\u00A0400"))).toBe(240000);
  });

  it("sans normalisation, l'espace insécable est refusé : c'est elle qui sauve le cas", () => {
    expect(eurosVersCents("1\u00A0190,50")).toBeNull();
  });

  it("ne rend jamais valide une saisie douteuse (T6)", () => {
    for (const s of ["2.400", "1 190,505", "-5", "12 €", "", "abc"]) {
      expect(eurosVersCents(normaliserEuros(s)), s).toBeNull();
    }
  });

  it("ne touche ni la virgule ni le point décimal", () => {
    expect(normaliserEuros("12,5")).toBe("12,5");
    expect(normaliserEuros("12.50")).toBe("12.50");
  });
});

describe("client-safe", () => {
  function fermeture(entree: string) {
    const vus = new Set<string>();
    const specs: string[] = [];
    const pile = [entree];
    while (pile.length) {
      const f = pile.pop()!;
      if (vus.has(f)) continue;
      vus.add(f);
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
        const spec = m[1]!;
        specs.push(`${f} -> ${spec}`);
        const racine = resolve(__dirname, "../../../../../..");
        const base = spec.startsWith("@/")
          ? resolve(racine, "src", spec.slice(2))
          : spec.startsWith(".")
            ? resolve(dirname(f), spec)
            : null;
        if (!base) continue;
        for (const ext of [".ts", ".tsx", "/index.ts"]) {
          try {
            readFileSync(base + ext);
            pile.push(base + ext);
            break;
          } catch {
            /* suivant */
          }
        }
      }
    }
    return specs;
  }

  it("aucun import prisma, node:, pricing.ts dans la fermeture d'imports", () => {
    const specs = fermeture(FICHIER);
    expect(
      specs.filter((s) => /prisma|node:|pricing|server-only/.test(s.split(" -> ")[1]!)),
    ).toEqual([]);
  });

  it("le fichier lui-même n'importe rien d'interdit", () => {
    const src = readFileSync(FICHIER, "utf8");
    expect(src).not.toMatch(/@\/lib\/prisma|from ["']node:|pricing/);
  });
});
