/**
 * « Apporteurs » ne contient que des apporteurs — et aucune ligne ne s'égare.
 *
 * ## Le défaut corrigé
 *
 * L'écran Boîte de réception › Recrutement filtrait sur le seul
 * `details.unifiedType = "recrutement"`. Or cette valeur est AUSSI une rubrique
 * du formulaire de contact public : quelqu'un qui cherche un poste depuis
 * /contact la choisit, sans jamais poser de `subType`. Ces messages tombaient
 * dans la liste des apporteurs, avec leur bouton d'invitation — et l'export de
 * la liste les emportait.
 *
 * ## Ce que ces tests prouvent, de bout en bout
 *
 * Chaque vue est prise telle que la console la sert : la PAGE, puis la liste
 * qu'elle rend, puis le `where` que la liste envoie à la base — et, pour
 * l'export, le lien « Exporter CSV » de l'écran, suivi jusqu'à la route. Rien
 * n'est recopié de l'implémentation : si une page cesse de transmettre son
 * périmètre, ou si l'export oublie de le relire, ces tests rougissent.
 *
 * ## 🔴 Pourquoi un évaluateur à TROIS valeurs
 *
 * Postgres évalue `details #> '{subType}' = 'x'` à NULL — ni vrai, ni faux —
 * quand la clé est absente, et `NOT NULL` reste NULL : la ligne disparaît des
 * deux côtés d'une négation. C'est exactement la ligne visée ici (recrutement
 * SANS subType). Un évaluateur booléen naïf rendrait `NOT(faux) = vrai` et
 * mettrait au vert un filtre qui, en base, perd la ligne. L'émulation suit donc
 * le SQL que Prisma génère réellement (relevé le 2026-09-19 sur Postgres 16 :
 * `equals: AnyNull` sur un chemin produit `= 'null' OR IS NULL`, `not` produit
 * `<>`), et refuse toute clause qu'elle ne sait pas évaluer.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { ReactElement } from "react";

// ─── Base simulée : un `where` Prisma évalué comme Postgres l'évaluerait ────

type V3 = boolean | null;
const et = (vs: V3[]): V3 => (vs.includes(false) ? false : vs.includes(null) ? null : true);
const ou = (vs: V3[]): V3 => (vs.includes(true) ? true : vs.includes(null) ? null : false);
const non = (v: V3): V3 => (v === null ? null : !v);

function extraire(details: unknown, chemin: string[]): unknown {
  let courant: unknown = details;
  for (const cle of chemin) {
    if (!courant || typeof courant !== "object" || Array.isArray(courant)) return undefined;
    courant = (courant as Record<string, unknown>)[cle];
  }
  return courant;
}

function evaluerJson(filtre: Record<string, unknown>, details: unknown): V3 {
  const chemin = filtre["path"] as string[] | undefined;
  if (!chemin) throw new Error(`filtre JSON sans chemin : ${JSON.stringify(filtre)}`);
  const valeur = extraire(details, chemin);
  if ("equals" in filtre) {
    if (filtre["equals"] === ANY_NULL) return valeur === undefined || valeur === null;
    // Clé absente → SQL NULL : la comparaison ne vaut ni vrai ni faux.
    if (valeur === undefined) return null;
    return JSON.stringify(valeur) === JSON.stringify(filtre["equals"]);
  }
  if ("not" in filtre) {
    if (valeur === undefined) return null;
    return JSON.stringify(valeur) !== JSON.stringify(filtre["not"]);
  }
  throw new Error(`opérateur JSON non émulé : ${JSON.stringify(filtre)}`);
}

function evaluer(where: Record<string, unknown>, ligne: Ligne): V3 {
  const parts: V3[] = [];
  for (const [cle, v] of Object.entries(where)) {
    if (v === undefined) continue;
    const liste = (x: unknown) => (Array.isArray(x) ? x : [x]) as Record<string, unknown>[];
    switch (cle) {
      case "AND":
        parts.push(et(liste(v).map((w) => evaluer(w, ligne))));
        break;
      case "OR":
        parts.push(ou(liste(v).map((w) => evaluer(w, ligne))));
        break;
      case "NOT":
        parts.push(non(et(liste(v).map((w) => evaluer(w, ligne)))));
        break;
      case "details":
        parts.push(evaluerJson(v as Record<string, unknown>, ligne.details));
        break;
      case "deletedAt":
      case "archivedAt": {
        const actuel = ligne[cle];
        if (v === null) parts.push(actuel === null);
        else if (typeof v === "object" && v !== null && "not" in v && v.not === null)
          parts.push(actuel !== null);
        else throw new Error(`filtre ${cle} non émulé`);
        break;
      }
      default:
        throw new Error(`clé de where non émulée : ${cle}`);
    }
  }
  return et(parts);
}

interface Ligne {
  id: string;
  details: unknown;
  deletedAt: Date | null;
  archivedAt: Date | null;
  submittedAt: Date;
  [k: string]: unknown;
}

function ligne(id: string, details: unknown, minute: number): Ligne {
  return {
    id,
    type: "contact",
    status: "new",
    locale: "fr",
    companyName: "—",
    sector: null,
    contactName: `Nom ${id}`,
    contactRole: null,
    contactEmail: `${id}@exemple.invalid`,
    contactPhone: null,
    employeesCount: null,
    address: null,
    assignedTo: null,
    internalNotes: null,
    submittedAt: new Date(Date.UTC(2026, 8, 19, 10, minute)),
    replyCount: 0,
    needsAttention: true,
    archivedAt: null,
    deletedAt: null,
    lastRepliedAt: null,
    replies: [],
    details,
  };
}

/**
 * La population de référence. Chaque ligne DOIT se retrouver dans au moins une
 * catégorie — c'est le critère d'arrêt du lot : une ligne qui disparaît de
 * toutes les listes est pire qu'une ligne mal rangée.
 */
const BASE: Ligne[] = [
  ligne("apporteur", { unifiedType: "recrutement", subType: "candidature-commerciale" }, 1),
  ligne("emploi-sans-soustype", { unifiedType: "recrutement", message: "Je cherche un poste" }, 2),
  ligne("emploi-soustype-null", { unifiedType: "recrutement", subType: null }, 3),
  ligne("emploi-autre-soustype", { unifiedType: "recrutement", subType: "stage" }, 4),
  ligne("autre", { unifiedType: "autre" }, 5),
  ligne("client-audit", { unifiedType: "audit" }, 6),
  ligne("client-simulateur", { unifiedType: "simulateur_roi" }, 7),
];

const findMany = vi.fn();
const count = vi.fn();
const activityLogCreate = vi.fn();

function servir(base: Ligne[]): void {
  const filtrer = (args: { where?: Record<string, unknown> } | undefined) =>
    base
      .filter((l) => evaluer(args?.where ?? {}, l) === true)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  findMany.mockImplementation(
    (args: {
      where?: Record<string, unknown>;
      take?: number;
      skip?: number;
      cursor?: { id: string };
    }) => {
      const lignes = filtrer(args);
      let debut = 0;
      if (args?.cursor?.id) debut = lignes.findIndex((l) => l.id === args.cursor!.id);
      debut += args?.skip ?? 0;
      return Promise.resolve(lignes.slice(debut, debut + (args?.take ?? lignes.length)));
    },
  );
  count.mockImplementation((args: { where?: Record<string, unknown> }) =>
    Promise.resolve(filtrer(args).length),
  );
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findMany: (...a: unknown[]) => findMany(...a),
      count: (...a: unknown[]) => count(...a),
    },
    activityLog: { create: (...a: unknown[]) => activityLogCreate(...a) },
  },
}));
vi.mock("@/auth", () => ({
  auth: () => Promise.resolve({ user: { id: "admin-1", role: "super_admin" } }),
}));
vi.mock("@/server/auth/garde-page", () => ({ gardePage: () => Promise.resolve({ ok: true }) }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: () => Promise.resolve("127.0.0.1") }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/fr/p/contacts",
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
}));
// Accessoires de la liste, sans rapport avec le périmètre : neutralisés.
vi.mock("@/features/admin-submissions/accuse-reception", () => ({
  lireAccusesMessages: () => Promise.resolve(new Map()),
}));
vi.mock("@/app/[locale]/(admin)/[adminPrefix]/submissions/_v2/SubmissionRowActions", () => ({
  SubmissionRowActions: () => null,
}));

import { Prisma } from "../../../../prisma/generated/client";
import { NextRequest } from "next/server";
import MessagesPage from "@/app/[locale]/(admin)/[adminPrefix]/contacts/messages/page";
import AutresPage from "@/app/[locale]/(admin)/[adminPrefix]/contacts/autres/page";
import ApporteursPage from "@/app/[locale]/(admin)/[adminPrefix]/contacts/commercial/page";
import ClientsPage from "@/app/[locale]/(admin)/[adminPrefix]/contacts/clients/page";
import { GET as exporter } from "@/app/api/admin/submissions/export/route";

/**
 * Sentinelle `Prisma.AnyNull` — lue par IDENTITE, comme le client la serialise.
 *
 * Declaree ICI et pas en tete du fichier : les `vi.mock()` doivent preceder les
 * imports qu'ils interceptent, donc `Prisma` n'existe qu'a partir de cette
 * ligne. Un `let` pose plus haut puis affecte une seule fois disait la meme
 * chose en laissant croire a une variable mutable (eslint `prefer-const`).
 * La lecture, elle, se fait dans une fonction appelee bien apres.
 */
const ANY_NULL: unknown = Prisma.AnyNull;

type Page = (p: {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) => Promise<ReactElement>;

interface Vue {
  ids: string[];
  csvHref: string;
  html: string;
}

/**
 * Sert une vue comme la console : page → composant de liste → rendu. Les ids
 * sont relus sur les liens de détail AFFICHÉS, pas sur un argument interne.
 */
async function servirVue(page: Page): Promise<Vue> {
  const racine = await page({
    params: Promise.resolve({ adminPrefix: "p" }),
    searchParams: Promise.resolve({}),
  });
  const composant = racine.type as (p: unknown) => Promise<ReactElement>;
  const liste = await composant(racine.props);
  const { container } = render(liste);
  const liens = [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!);
  const ids = [
    ...new Set(
      liens
        .map((h) => /\/contacts\/(?:messages|commercial)\/([a-z-]+)$/.exec(h)?.[1])
        .filter((x): x is string => Boolean(x) && x !== "nouveau"),
    ),
  ].sort();
  const csvHref = liens.find((h) => h.startsWith("/api/admin/submissions/export"));
  if (!csvHref) throw new Error("lien « Exporter CSV » introuvable");
  const html = container.innerHTML;
  cleanup();
  return { ids, csvHref, html };
}

/** Suit le lien d'export de l'écran jusqu'à la route, et relit les ids du CSV. */
async function idsExportes(csvHref: string): Promise<string[]> {
  const reponse = await exporter(new NextRequest(`http://localhost${csvHref}`));
  expect(reponse.status).toBe(200);
  const csv = await reponse.text();
  return csv
    .split("\r\n")
    .slice(1)
    .filter(Boolean)
    .map((l) => l.split(";")[0]!.replace(/"/g, ""))
    .sort();
}

beforeEach(() => {
  findMany.mockReset();
  count.mockReset();
  activityLogCreate.mockReset();
  activityLogCreate.mockResolvedValue({});
  servir(BASE);
});

describe("contacts — le recrutement se partage entre Apporteurs et Autres", () => {
  it("une ligne /contact « recrutement » sans subType est dans Autres et Messages, PAS dans Apporteurs", async () => {
    const [messages, autres, apporteurs] = [
      await servirVue(MessagesPage as unknown as Page),
      await servirVue(AutresPage as unknown as Page),
      await servirVue(ApporteursPage as unknown as Page),
    ];

    expect(messages.ids).toContain("emploi-sans-soustype");
    expect(autres.ids).toContain("emploi-sans-soustype");
    expect(apporteurs.ids).not.toContain("emploi-sans-soustype");

    // Les mêmes règles pour un subType JSON null ou un autre subType : ce ne
    // sont pas des apporteurs, et ils ne doivent pas se perdre pour autant.
    for (const id of ["emploi-soustype-null", "emploi-autre-soustype"]) {
      expect(autres.ids, id).toContain(id);
      expect(apporteurs.ids, id).not.toContain(id);
    }
    // Autres garde ses messages « autre » d'avant.
    expect(autres.ids).toContain("autre");
    // Et n'accueille pas l'apporteur, qui a sa propre liste.
    expect(autres.ids).not.toContain("apporteur");
  });

  it("l'export lancé depuis Autres emporte la ligne recrutement sans subType, sans l'apporteur", async () => {
    const autres = await servirVue(AutresPage as unknown as Page);
    const ids = await idsExportes(autres.csvHref);
    expect(ids).toEqual(autres.ids);
    expect(ids).toContain("emploi-sans-soustype");
    expect(ids).not.toContain("apporteur");
  });

  it("l'export lancé depuis Messages emporte aussi la ligne recrutement sans subType", async () => {
    const messages = await servirVue(MessagesPage as unknown as Page);
    expect(await idsExportes(messages.csvHref)).toContain("emploi-sans-soustype");
  });

  it("Apporteurs ne liste QUE des apporteurs", async () => {
    const apporteurs = await servirVue(ApporteursPage as unknown as Page);
    expect(apporteurs.ids).toEqual(["apporteur"]);
  });

  it("l'export lancé depuis Apporteurs ne sort QUE des apporteurs", async () => {
    const apporteurs = await servirVue(ApporteursPage as unknown as Page);
    expect(await idsExportes(apporteurs.csvHref)).toEqual(["apporteur"]);
  });

  it("Demandes clients inclut le simulateur de gain (périmètre client unique)", async () => {
    const clients = await servirVue(ClientsPage as unknown as Page);
    expect(clients.ids).toEqual(["client-audit", "client-simulateur"]);
  });

  it("aucune ligne ne disparaît de TOUTES les catégories", async () => {
    const vues = await Promise.all(
      [AutresPage, ApporteursPage, ClientsPage].map((p) => servirVue(p as unknown as Page)),
    );
    const rangees = new Set(vues.flatMap((v) => v.ids));
    for (const l of BASE)
      expect(rangees.has(l.id), `« ${l.id} » n'est plus dans aucune liste`).toBe(true);
  });

  it("depuis Messages, un apporteur s'ouvre sur SA fiche, les autres sur la fiche message", async () => {
    const racine = await (MessagesPage as unknown as Page)({
      params: Promise.resolve({ adminPrefix: "p" }),
      searchParams: Promise.resolve({}),
    });
    const liste = await (racine.type as (p: unknown) => Promise<ReactElement>)(racine.props);
    const { container } = render(liste);
    const hrefs = [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/fr/p/contacts/commercial/apporteur");
    expect(hrefs).not.toContain("/fr/p/contacts/messages/apporteur");
    expect(hrefs).toContain("/fr/p/contacts/messages/emploi-sans-soustype");
    cleanup();
  });

  it("la liste Apporteurs porte son nom, un bouton « Ajouter », et aucun bouton sur Messages", async () => {
    // Assertions booléennes : un échec n'imprime pas les 20 Ko de la page.
    const apporteurs = await servirVue(ApporteursPage as unknown as Page);
    expect(/<h1[^>]*>Apporteurs<\/h1>/.test(apporteurs.html), "titre « Apporteurs »").toBe(true);
    expect(
      apporteurs.html.includes('href="/fr/p/contacts/commercial/nouveau"'),
      "bouton « Ajouter » vers la saisie d'un apporteur",
    ).toBe(true);
    const messages = await servirVue(MessagesPage as unknown as Page);
    expect(/<h1[^>]*>Messages<\/h1>/.test(messages.html), "titre « Messages » inchangé").toBe(true);
    expect(messages.html.includes("/contacts/commercial/nouveau"), "bouton sur Messages").toBe(
      false,
    );
  });
});
