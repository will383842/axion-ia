// Lot 2 du plan « changement de compte bancaire » : gabarits SANS émetteur.
// Textes mot pour mot : docs/plans/apporteurs-changement-iban-2026-11-25.md, section 12.3.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/server/email/apercu/catalogue";
import { SITE_URL as SITE_URL_BRUT } from "@/lib/site-url";
import { estGabaritConnu, GABARITS_SANS_LIEN_ESPACE, renderEmailTemplate } from "../index";
import { IBAN_GLOBAL } from "../apporteur-compte";

// Le gabarit exige https:// sur l'hôte du site ; en test, SITE_URL est en http://localhost.
const SITE_URL = `https://${new URL(SITE_URL_BRUT).host}`;

const NOMS = [
  "apporteur-compte-a-confirmer",
  "apporteur-compte-demande-bloquee",
  "apporteur-compte-change",
  "apporteur-compte-refuse",
  "apporteur-compte-expire",
] as const;

// Motif importé du gabarit (une seule définition) ; copie sans `g` pour `toMatch`.
const IBAN_RE = new RegExp(IBAN_GLOBAL.source, IBAN_GLOBAL.flags.replace("g", ""));
const IBAN_FAUX = "FR7630006000011234567890189"; // fictif, sert à vérifier le masque
const LIEN_PERSONNEL = /\/apporteur\/dossier\/[0-9a-f-]{8,}\//i;

const CHARGE = {
  prenom: "Claire",
  nouveauFin: "5678",
  ancienFin: "1234",
  effetLe: "29 novembre 2026",
  motif: "Le RIB n'est pas lisible.",
  lienConfirmer: `${SITE_URL}/apporteur/dossier/compte/D1/SIG-A`,
  lienBloquer: `${SITE_URL}/apporteur/dossier/compte/D1/SIG-B`,
};

async function rendu(nom: string, charge: Record<string, unknown> = CHARGE) {
  const r = await renderEmailTemplate(nom as never, "fr", charge);
  return { ...r, t: r.text.replace(/\s+/g, " ") };
}

describe("gabarits de changement de compte (lot 2)", () => {
  it.each(NOMS)("%s est connu du registre et du catalogue d'aperçu", (nom) => {
    expect(estGabaritConnu(nom)).toBe(true);
    expect(Object.keys(CATALOGUE)).toContain(nom);
  });

  it("e-mail 1 : texte de la section 12.3, deux liens hors jeton personnel", async () => {
    const r = await rendu("apporteur-compte-a-confirmer");
    expect(r.subject).toBe("Confirmez votre changement de compte bancaire");
    expect(r.t).toContain("Bonjour Claire,");
    expect(r.t).toContain(
      "Vous avez demandé à changer le compte sur lequel nous versons vos commissions.",
    );
    expect(r.t).toContain("Nouveau compte : il se termine par 5678.");
    expect(r.t).toContain("Ce bouton fonctionne pendant 24 heures.");
    expect(r.t).toContain("Cela prend au moins 3 jours.");
    expect(r.t).toContain("Ce n'est pas vous ?");
    expect(r.t).toContain(
      "Nous ne vous demanderons jamais votre IBAN par e-mail ou par téléphone.",
    );
    expect(r.html).toContain(CHARGE.lienConfirmer);
    expect(r.html).toContain(CHARGE.lienBloquer);
  });

  it("e-mail 2 : demande bloquée, aucun lien de sécurité", async () => {
    const r = await rendu("apporteur-compte-demande-bloquee");
    expect(r.subject).toBe("La demande de changement de compte est bloquée");
    expect(r.t).toContain("Nous avons annulé cette demande. Votre compte n'a pas changé.");
    expect(r.t).toContain("Nous vous envoyons le nouveau dans un e-mail séparé.");
    expect(r.t).toContain("Nous vous appelons dans les prochains jours pour faire le point.");
  });

  it("e-mail 3 : compte changé, date et deux fins de compte", async () => {
    const r = await rendu("apporteur-compte-change");
    expect(r.subject).toBe("Votre compte bancaire est changé");
    expect(r.t).toContain("À partir du 29 novembre 2026, nous versons vos commissions");
    expect(r.t).toContain("qui se termine par 5678.");
    expect(r.t).toContain("L'ancien compte (qui se termine par 1234) ne sera plus utilisé.");
    expect(r.t).toContain("Vous n'êtes pas d'accord ?");
  });

  it("e-mail 4 : refus avec le motif de l'administrateur", async () => {
    const r = await rendu("apporteur-compte-refuse");
    expect(r.subject).toBe("Votre demande de changement de compte n'est pas acceptée");
    expect(r.t).toContain("Raison : Le RIB n'est pas lisible.");
    expect(r.t).toContain("il se termine toujours par 1234.");
    expect(r.t).toContain("Vous pouvez faire une nouvelle demande depuis votre espace.");
  });

  it("e-mail 5 : demande non confirmée", async () => {
    const r = await rendu("apporteur-compte-expire");
    expect(r.subject).toBe("Votre demande de changement de compte est annulée");
    expect(r.t).toContain("Vous n'avez pas confirmé votre demande dans les 24 heures.");
    expect(r.t).toContain("Vous pouvez refaire la demande depuis votre espace.");
  });

  it.each(NOMS)("%s : un IBAN entier par erreur dans la charge ne sort jamais", async (nom) => {
    const r = await rendu(nom, {
      ...CHARGE,
      nouveauFin: IBAN_FAUX,
      ancienFin: IBAN_FAUX,
      motif: `Compte ${IBAN_FAUX} refusé`,
    });
    // Le pied de page porte un n° de TVA qui a la forme d'un IBAN : on lit le corps seul.
    // Balises retirées : le motif large ne doit lire que le texte, pas les attributs (id, style…).
    const corpsHtml = (r.html.split('data-bloc="pied"')[0] ?? "")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ");
    const corpsTexte = r.t.split("AXION IA SAS")[0] ?? "";
    expect(corpsHtml).not.toMatch(IBAN_RE);
    expect(corpsTexte).not.toMatch(IBAN_RE);
    expect(r.html).not.toContain("30006000011234567890");
    expect(r.html).not.toContain(IBAN_FAUX);
    expect(r.t).not.toContain(IBAN_FAUX);
  });

  it("masque aux quatre derniers caractères", async () => {
    const r = await rendu("apporteur-compte-change", {
      ...CHARGE,
      nouveauFin: IBAN_FAUX,
      ancienFin: "FR76 3000 6000 0112 3456 7890 189",
    });
    expect(r.t).toContain("qui se termine par 0189");
    expect(r.t).not.toContain("3456");
  });

  it.each(NOMS)("%s : aucun lien personnel de l'espace dans le rendu", async (nom) => {
    const r = await rendu(nom, {
      ...CHARGE,
      lien: `${SITE_URL}/apporteur/dossier/11111111-2222-3333-4444-555555555555/JETON`,
    });
    expect(r.html).not.toMatch(LIEN_PERSONNEL);
    expect(r.t).not.toMatch(LIEN_PERSONNEL);
  });

  it("charge vide : ne casse pas et ne laisse pas de « undefined »", async () => {
    for (const nom of NOMS.filter((n) => n !== "apporteur-compte-a-confirmer")) {
      const r = await rendu(nom, {});
      expect(r.t).not.toContain("undefined");
      expect(r.t).not.toContain("null");
    }
  });
});

describe("e-mail 1 : liens exigés et liste blanche", () => {
  it("un lien personnel de l'espace à la place d'un lien de demande est refusé", async () => {
    const perso = `${SITE_URL}/apporteur/dossier/11111111-2222-3333-4444-555555555555/JETON`;
    await expect(
      rendu("apporteur-compte-a-confirmer", { ...CHARGE, lienConfirmer: perso }),
    ).rejects.toThrow();
    await expect(
      rendu("apporteur-compte-a-confirmer", { ...CHARGE, lienBloquer: perso }),
    ).rejects.toThrow();
  });

  it("sans lien valide, le rendu échoue franchement", async () => {
    await expect(rendu("apporteur-compte-a-confirmer", {})).rejects.toThrow(/lienConfirmer/);
    await expect(
      rendu("apporteur-compte-a-confirmer", { ...CHARGE, lienBloquer: undefined }),
    ).rejects.toThrow();
    await expect(
      rendu("apporteur-compte-a-confirmer", { ...CHARGE, lienConfirmer: null }),
    ).rejects.toThrow();
  });

  it.each([
    ["http au lieu de https", CHARGE.lienConfirmer.replace("https:", "http:")],
    ["autre origine", "https://autre.example/apporteur/dossier/compte/D1/SIG"],
    ["autre chemin", `${SITE_URL}/apporteur/dossier/D1/SIG`],
    ["paramètre de requête", `${CHARGE.lienConfirmer}?x=1`],
    ["identifiant dans l'URL", CHARGE.lienConfirmer.replace("https://", "https://u:p@")],
  ])("refuse un lien : %s", async (_nom, lien) => {
    await expect(
      rendu("apporteur-compte-a-confirmer", { ...CHARGE, lienConfirmer: lien }),
    ).rejects.toThrow();
  });
});

describe("masque IBAN du motif libre : variantes de saisie", () => {
  it.each([
    ["minuscules", "fr7630006000011234567890189"],
    ["minuscules et espaces", "fr76 3000 6000 0112 3456 7890 189"],
    ["tirets", "FR76-3000-6000-0112-3456-7890-189"],
    ["points", "FR76.3000.6000.0112.3456.7890.189"],
    ["double espace", "FR76  3000  6000 0112 3456 7890 189"],
    ["espace après le code pays", "FR 76 3000 6000 0112 3456 7890 189"],
  ])("retire un IBAN écrit en %s", async (_nom, iban) => {
    const r = await rendu("apporteur-compte-refuse", { ...CHARGE, motif: `Compte ${iban} refusé` });
    expect(r.t).toContain("[IBAN retiré]");
    expect(r.t).not.toContain("3000");
    expect(r.t).not.toContain("7890");
  });
});

describe("lien personnel de l'espace coupé dès le rendu (plan 6.1)", () => {
  it.each(NOMS)("%s : `lienEspace` dans la charge n'affiche ni bouton ni lien", async (nom) => {
    expect(GABARITS_SANS_LIEN_ESPACE.has(nom)).toBe(true);
    const r = await rendu(nom, {
      ...CHARGE,
      lienEspace: `${SITE_URL}/apporteur/dossier/11111111-2222-3333-4444-555555555555/JETON`,
    });
    expect(r.html).not.toContain('data-bloc="lienEspace"');
    expect(r.html).not.toMatch(LIEN_PERSONNEL);
    expect(r.t).not.toMatch(LIEN_PERSONNEL);
    expect(r.t).not.toContain("Lien perdu");
  });
});

describe("les e-mails de compte n'ont pas de repli (plan, section 6.1)", () => {
  it("aucun gabaritRepli dans le gabarit ni dans ce lot (choix du plan, section 6.1)", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/email/templates/apporteur-compte.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/gabaritRepli/);
    expect(src).toContain("section 6.1");
    // Limite connue : un `gabaritRepli` se poserait dans la CHARGE, chez l'émetteur (`envois.ts`,
    // lot 4). À étendre à ce fichier-là quand il existera (ADR 0078, §3.3).
  });
});
