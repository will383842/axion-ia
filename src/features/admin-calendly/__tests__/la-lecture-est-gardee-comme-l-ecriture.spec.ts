// La lecture des appels réservés est gardée comme leur écriture.
//
// ## Ce que ce fichier empêche de revenir
//
// Mesuré le 2026-08-27 : la fiche d'un appel interrogeait la base AVANT
// `auth()`, et la page de liste n'appelait pas `auth()` du tout. Tout compte de
// la console — `reader` compris — lisait le nom, l'adresse, le téléphone et les
// réponses libres de chaque prospect. Et surtout `cancelUrl` / `rescheduleUrl`,
// qui sont des URL-CAPACITÉS : les copier suffit pour annuler le rendez-vous
// d'un prospect depuis un onglet privé, sans authentification.
//
// Pendant ce temps, l'ÉCRITURE du même domaine était fermée à
// `super_admin | admin | editor`. Deux moitiés d'un même périmètre, dont une
// seule existait.
//
// ## Pourquoi le dernier cas est le plus important
//
// Les cas de rôle vérifient le comportement d'aujourd'hui. Le cas structurel,
// lui, vérifie que la liste n'a pas été RECOPIÉE dans la garde d'écriture — la
// forme exacte du défaut d'origine. Une garde qui vérifie deux comportements
// identiques reste verte le jour où quelqu'un modifie l'une des deux listes ;
// celle-ci rougit.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

// `redirect()` de Next lève une exception de contrôle de flux. On la reproduit
// pour distinguer « redirigé vers la connexion » de « refusé avec un motif ».
class RedirectSignal extends Error {
  constructor(public readonly destination: string) {
    super(`REDIRECT:${destination}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new RedirectSignal(destination);
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const LOGIN = "/fr/console/login";

/**
 * Trouve toutes les pages de la console qui servent des données d'appel.
 *
 * 🔑 DÉRIVÉ DE L'USAGE, jamais d'une liste. On cherche les pages qui touchent la
 * table — directement (`prisma.calendlyEvent`) ou par l'une des trois couches de
 * requêtes qui la lisent. C'est ce qui permet à ce fichier de découvrir un écran
 * qu'on n'aurait pas pensé à y inscrire.
 */
function surfacesQuiTouchentLesAppels(): string[] {
  const racine = join(process.cwd(), "src/app");
  if (!existsSync(racine)) {
    throw new Error(`Balayage inopérant : ${racine} est introuvable.`);
  }
  const MARQUEURS = [
    "prisma.calendlyEvent",
    "admin-rendezvous/queries",
    "admin-agenda/queries",
    "admin-inbox/queries",
  ];
  const trouvees: string[] = [];
  const parcourir = (dossier: string): void => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      const complet = join(dossier, entree.name);
      if (entree.isDirectory()) {
        parcourir(complet);
        continue;
      }
      if (entree.name !== "page.tsx") continue;
      // Seules les pages de la console : le site public ne lit pas cette table.
      if (!complet.includes("(admin)")) continue;
      const source = readFileSync(complet, "utf8");
      if (MARQUEURS.some((m) => source.includes(m))) {
        trouvees.push(relative(process.cwd(), complet).split("\\").join("/"));
      }
    }
  };
  parcourir(racine);
  return trouvees.sort();
}

/** Les trois rôles que Will a explicitement exclus le 2026-08-27. */
const REFUSES = ["reader", "secretaire", "responsable_qualite"] as const;
/** Les trois rôles alignés sur l'écriture du domaine. */
const ADMIS = ["super_admin", "admin", "editor"] as const;

describe("gardeLectureAppels", () => {
  it.each(REFUSES)("refuse le rôle « %s » avec un motif qui le NOMME", async (role) => {
    authMock.mockResolvedValue({ user: { id: "u1", role } });
    const { gardeLectureAppels } = await import("../acces");

    const acces = await gardeLectureAppels(LOGIN);

    expect(acces.autorise).toBe(false);
    if (acces.autorise) return;
    // 🔑 Un écran vide pour cause de droits doit DIRE que c'est une question de
    // droits (P7). Le motif nomme le rôle refusé et ce qui est en jeu.
    expect(acces.motif).toContain("annuler");
    expect(acces.role).toBe(role);
  });

  it.each(ADMIS)("laisse passer le rôle « %s »", async (role) => {
    authMock.mockResolvedValue({ user: { id: "u1", role } });
    const { gardeLectureAppels } = await import("../acces");

    const acces = await gardeLectureAppels(LOGIN);

    expect(acces.autorise).toBe(true);
  });

  it("redirige vers la connexion quand il n'y a PAS de session — et ne refuse pas", async () => {
    authMock.mockResolvedValue(null);
    const { gardeLectureAppels } = await import("../acces");

    // Sans session, la page de connexion est la bonne réponse ; un refus nommé
    // serait faux (l'utilisateur n'a pas un mauvais rôle, il n'en a aucun).
    await expect(gardeLectureAppels(LOGIN)).rejects.toThrow(`REDIRECT:${LOGIN}`);
  });

  it("refuse un rôle inconnu de la console", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "stagiaire_inconnu" } });
    const { gardeLectureAppels } = await import("../acces");

    const acces = await gardeLectureAppels(LOGIN);

    expect(acces.autorise).toBe(false);
    if (acces.autorise) return;
    expect(acces.motif).toContain("rôle reconnu");
  });
});

describe("le périmètre est DÉRIVÉ, jamais recopié", () => {
  it("`peutVoirLesAppels` répond exactement selon ROLES_APPELS", async () => {
    const { ROLES_APPELS, peutVoirLesAppels } = await import("../acces");

    for (const role of ROLES_APPELS) expect(peutVoirLesAppels(role)).toBe(true);
    for (const role of REFUSES) expect(peutVoirLesAppels(role)).toBe(false);
    expect(peutVoirLesAppels(null)).toBe(false);
    expect(peutVoirLesAppels(undefined)).toBe(false);
    expect(peutVoirLesAppels("")).toBe(false);
  });

  it("la garde d'écriture CONSOMME le périmètre au lieu de le réécrire", () => {
    // 🔴 LE CAS QUI COMPTE. Le défaut d'origine n'est pas qu'une liste était
    // fausse : c'est qu'il y en avait DEUX, dont une inexistante. Ce test lit la
    // source de la garde d'écriture et refuse qu'elle porte à nouveau la sienne.
    //
    // ⚠️ Ni `import.meta.url` (Vitest ne le sert pas en scheme `file:`), ni un
    // chemin écrit en dur qu'on recopierait au prochain déménagement. Le
    // fichier est cherché, et son ABSENCE est une ERREUR EXPLICITE : une garde
    // qui ne trouve plus sa cible doit rougir, jamais passer en silence.
    const chemin = join(process.cwd(), "src/features/admin-calendly/actions.ts");
    if (!existsSync(chemin)) {
      throw new Error(
        `Garde inopérante : ${chemin} est introuvable. Le module a déménagé — ` +
          `corrige CE chemin plutôt que de supprimer le test, sinon la liste de ` +
          `rôles peut redevenir double sans que rien ne le dise.`,
      );
    }
    const source = readFileSync(chemin, "utf8");

    // Témoin que c'est bien LE fichier attendu, et pas un homonyme : sans ça,
    // lire un fichier vide ferait passer les deux assertions négatives.
    expect(source).toContain("requireAdminWriteSession");
    expect(source).toContain("peutVoirLesAppels");
    // Aucune comparaison de rôle écrite à la main dans la garde d'écriture.
    expect(source).not.toMatch(/role\s*!==\s*["']super_admin["']/);
    expect(source).not.toMatch(/role\s*===\s*["']super_admin["']/);
  });
});

describe("les deux pages gardent AVANT de toucher la base", () => {
  // 🔴 CE CAS EST LE PLUS PROCHE DU DÉFAUT D'ORIGINE, et le seul qui aurait
  // rougi sur `origin/main` pour la BONNE raison.
  //
  // Le défaut n'était pas seulement « il manque une garde » : sur la fiche, la
  // garde EXISTAIT à moitié — `auth()` était appelé, mais APRÈS le
  // `findUnique`, et seulement pour l'accusé de lecture. La page répondait donc
  // différemment selon que la fiche existait ou non, à quelqu'un qui n'avait le
  // droit d'en lire aucune : un `notFound()` renseigne sur l'EXISTENCE d'un
  // identifiant.
  //
  // Vérifier la présence de l'appel ne suffirait donc pas : ce test vérifie sa
  // POSITION. Il rougit si quelqu'un retire la garde, et aussi s'il la
  // redescend sous la première requête.
  // 🔴 DÉRIVÉ, PAS ÉCRIT EN DUR. Une première version listait deux chemins à la
  // main — et c'est précisément ce qui l'aurait empêchée de voir les DEUX AUTRES
  // écrans qui servaient les mêmes coordonnées (`/agenda`, `/contacts`). Une
  // garde qui énumère ce qu'elle connaît ne trouve jamais le jumeau oublié.
  //
  // On balaie donc les pages de la console et on retient celles qui touchent les
  // données d'appel, quel que soit leur chemin.
  const PAGES = surfacesQuiTouchentLesAppels();

  it("le balayage trouve les surfaces — sinon il ne garde RIEN", () => {
    // Témoin obligatoire : un extracteur qui ne trouve plus rien rendrait tous
    // les cas suivants verts par vacuité. C'est le défaut « trois fantômes »
    // du 2026-08-24, dans l'autre sens.
    expect(
      PAGES.length,
      "le balayage ne trouve plus les écrans d'appels : le motif ou l'arborescence a changé",
    ).toBeGreaterThanOrEqual(4);
  });

  it.each(PAGES)("« %s » décide du rôle avant de rendre des coordonnées", (relatif) => {
    const chemin = join(process.cwd(), relatif);
    const source = readFileSync(chemin, "utf8");

    // Deux régimes légitimes, et un seul interdit : ne rien décider du tout.
    //
    //   · REFUS   — `gardeLectureAppels()` : l'écran entier est réservé.
    //     C'est le régime des deux écrans dédiés aux appels.
    //   · FILTRE  — `peutVoirLesAppels()` : l'écran reste ouvert, les
    //     coordonnées sont retirées. C'est le régime de l'agenda et de la boîte
    //     de réception, qui portent aussi autre chose que des appels et qu'on
    //     ne peut donc pas fermer sans décision de périmètre.
    const refuse = source.includes("gardeLectureAppels(");
    const filtre = source.includes("peutVoirLesAppels(");

    expect(
      refuse || filtre,
      `cet écran sert des données d'appel sans jamais consulter le rôle : ` +
        `il faut soit le garder (gardeLectureAppels), soit filtrer les ` +
        `coordonnées (peutVoirLesAppels). Ne rien faire, c'est la fuite ` +
        `refermée le 2026-08-27 sur trois autres écrans.`,
    ).toBe(true);

    // Sur le régime REFUS, l'ordre compte autant que la présence : interroger la
    // base puis refuser laisse un `notFound()` renseigner un visiteur non
    // habilité sur l'existence d'un identifiant.
    if (refuse) {
      const posGarde = source.indexOf("await gardeLectureAppels(");
      expect(posGarde, "la garde est importée mais jamais attendue").toBeGreaterThan(-1);
      for (const lecture of ["prisma.", "listRendezVous(", "getRdvMonth("]) {
        const posLecture = source.indexOf(lecture);
        if (posLecture === -1) continue;
        expect(
          posGarde,
          `« ${lecture} » apparaît AVANT la garde : la base est interrogée avant de savoir qui regarde`,
        ).toBeLessThan(posLecture);
      }
    }
  });
});
