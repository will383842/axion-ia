// @vitest-environment node
/**
 * Lot E (M14), relecture — INVENTAIRE de tout ce qu'un formateur peut appeler depuis
 * son espace ou par le lien de sa mission, et preuve, UNE LIGNE PAR ACTION, que chacune
 * est refusée côté serveur une fois la collaboration close.
 *
 * Trois parties :
 *  1. l'inventaire est EXHAUSTIF : chaque export d'un module `"use server"` importé par
 *     l'espace (pages, composants, routes) et chaque route de l'espace figure dans le
 *     tableau ci-dessous. Une action ajoutée sans être classée fait échouer ce test ;
 *  2. chaque action du formateur est refusée, AVANT tout travail (aucune requête hors la
 *     relecture de la fiche ou de la mission), avec la session la plus large qui existe
 *     après la fin : la session en lecture seule ouverte après la clôture, tous les
 *     interrupteurs allumés. Le jeton de mission est essayé signé avant la clôture
 *     (version 0) et sans version (lien d'avant ce lot) ;
 *  3. témoin : la même ligne, collaboration EN COURS, passe la garde (le service
 *     travaille). Sans lui, un refus pour « données invalides » passerait pour la garde.
 *
 * Seules restent ouvertes après la fin la LECTURE des honoraires et du dossier, et le
 * téléchargement des pièces du formateur lui-même (`getFormateurSessionLecture`), plus
 * la connexion qui y mène.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-lot-e-0123456789abcdef";
  process.env["IBAN_EMPREINTE_SECRET"] = "empreinte-de-test-lot-e";
});

const etat = vi.hoisted(() => ({
  jeton: null as string | null,
  fin: null as Date | null,
  statutMission: "en_attente",
  appels: [] as string[],
}));

// Prisma : toute requête est consignée ; seules la fiche et la mission répondent.
// La garde lit la fiche (session) ou la mission (jeton) : c'est sa SEULE lecture admise.
const prismaMock = vi.hoisted(() => {
  const fiche = () => ({
    id: "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13",
    nom: "Martin",
    prenom: "Camille",
    email: "camille@example.test",
    actif: true,
    statut: "sous_traitant",
    accesVersion: 3,
    finCollaborationAt: etat.fin,
    // V1-D-1 — aucun changement d'adresse enregistré : le lien sans empreinte vaut.
    emailRemplaceAt: null,
  });
  const mission = () => ({
    id: "5b6c7d8e-9f01-4a2b-8c3d-4e5f6a7b8c9d",
    statut: etat.statutMission,
    role: "principal",
    echeanceReponseAt: null,
    trainer: fiche(),
    session: {
      id: "8d7c6b5a-4f3e-4d2c-8b1a-0f9e8d7c6b5a",
      numero: "S-1",
      titreSession: "Formation",
      dateDebut: new Date("2026-11-02T08:00:00Z"),
      dateFin: new Date("2026-11-03T16:00:00Z"),
      modalite: "presentiel",
      nbParticipantsPrevus: 6,
      lieuType: null,
      lieuIntitule: null,
      lieuAdresse: null,
      lieuCodePostal: null,
      lieuVille: null,
      lieuSalle: null,
      lieuVisioUrl: null,
      _count: { enrollments: 4 },
    },
  });
  const modele = (nom: string): unknown =>
    new Proxy(
      {},
      {
        get: (_t, methode: string) => async () => {
          const cle = `${nom}.${methode}`;
          etat.appels.push(cle);
          if (cle === "trainer.findUnique") return fiche();
          if (cle === "missionFormateur.findUnique") return mission();
          return null;
        },
      },
    );
  return new Proxy(
    {},
    {
      get: (_t, nom: string) => {
        if (nom === "then") return undefined;
        if (nom.startsWith("$")) {
          return async () => {
            etat.appels.push(nom);
            return null;
          };
        }
        return modele(nom);
      },
    },
  );
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, default: prismaMock }));
vi.mock("@/server/formateur/cookie", () => ({
  getFormateurToken: async () => etat.jeton,
  setFormateurCookie: async () => undefined,
  clearFormateurCookie: async () => undefined,
}));
// Tous les interrupteurs ALLUMÉS : le cas le plus ouvert, celui où la lecture seule existe.
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: async () => true,
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-envoi", () => ({
  envoiAllume: async () => true,
}));
// Aucun Redis dans ce test : le limiteur de débit laisse passer. Sans lui, la première
// action qui l'appelle ouvre une connexion qui se reconnecte en boucle, et les suivantes
// attendent au-delà du délai du test.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true, count: 1, remaining: 99, resetAt: 0 }),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: async () => {
    etat.appels.push("enqueueEmail");
  },
}));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: async () => {
    etat.appels.push("creerOuDedup");
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
// Console : jamais atteinte par le formateur ; ici, elle refuse tout.
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => {
    throw new Error("admin");
  },
  requireHabilitation: async () => {
    throw new Error("admin");
  },
  logQualiopiActivity: async () => {
    etat.appels.push("logQualiopiActivity");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

import { signFormateurSession } from "@/lib/formateur-session";
import { signMagicToken } from "@/lib/magic-token";
import { versionSessionFormateur } from "@/server/formateur/acces-apres-fin";
import { FORMATEUR_CONNEXION_PATH } from "@/server/formateur/routes";

const TRAINER = "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13";
const MISSION = "5b6c7d8e-9f01-4a2b-8c3d-4e5f6a7b8c9d";
const SESSION = "8d7c6b5a-4f3e-4d2c-8b1a-0f9e8d7c6b5a";
const DOC = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const FIN = new Date("2026-10-01T00:00:00Z");

const fd = (champs: Record<string, string | File>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
};
const fichier = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "piece.pdf");

const tokenMission = (version?: number) =>
  signMagicToken({
    scope: "formateur_mission",
    resourceId: MISSION,
    ...(version !== undefined ? { version } : {}),
  });

// ─────────────────────────────────────────────────────────────────────────────
// L'inventaire
// ─────────────────────────────────────────────────────────────────────────────

type Porte = "session" | "jeton-mission";
type Ligne =
  | {
      readonly classe: "formateur";
      readonly porte: Porte;
      /** Statut de la mission lue par le service (le message après délai exige une échue). */
      readonly statutMission?: string;
      readonly appel: (token: string) => Promise<unknown>;
    }
  | { readonly classe: "console"; readonly garde: string }
  | { readonly classe: "ouverte-apres-fin"; readonly pourquoi: string };

const action = (module: string, nom: string) => async () =>
  ((await import(module)) as Record<string, (...a: unknown[]) => Promise<unknown>>)[nom]!;

const A = {
  coaching: "@/server/actions/formateur/coaching.actions",
  auth: "@/server/actions/formateur/auth.actions",
  mission: "@/server/actions/qualiopi/mission-formateur",
  choix: "@/server/actions/qualiopi/choix-formateur",
  emargement: "@/server/actions/qualiopi/emargement-formateur",
  releve: "@/server/actions/qualiopi/releve-signature",
  lettre: "@/server/actions/qualiopi/lettre-mission-signature",
  contrat: "@/server/actions/qualiopi/contrat-travail-signature",
  dossier: "@/app/[locale]/espace-formateur/dossier/actions",
  desaccord: "@/server/actions/formateur/desaccord.actions",
  bilan: "@/server/actions/formateur/bilan-fin-formation.actions",
  evaluation: "@/server/actions/formateur/evaluation-finale.actions",
} as const;

const formateur = (
  module: string,
  nom: string,
  arg: unknown | ((token: string) => unknown),
  porte: Porte = "session",
  statutMission?: string,
  /** Action à état (`useActionState`) : reçoit l'état précédent avant le formulaire. */
  aEtat = false,
): Ligne => ({
  classe: "formateur",
  porte,
  ...(statutMission !== undefined ? { statutMission } : {}),
  appel: async (token) => {
    const a = typeof arg === "function" ? (arg as (t: string) => unknown)(token) : arg;
    const f = await action(module, nom)();
    return aEtat ? f(null, a) : f(a);
  },
});

/** Une route GET : 401 = refusée. */
const route = (
  charger: () => Promise<{ GET: (req: never, ctx: never) => Promise<Response> }>,
  params: Record<string, string>,
): Ligne => ({
  classe: "formateur",
  porte: "session",
  appel: async () => {
    const { GET } = await charger();
    const r = await GET(
      new Request("https://x.test/r") as never,
      {
        params: Promise.resolve(params),
      } as never,
    );
    return r.status === 401 ? { error: "unauthorized" } : { status: r.status };
  },
});

/** Clé : `module#export` (actions) ou chemin de la route. */
const INVENTAIRE: Record<string, Ligne> = {
  // ── Séances 1-to-1 (coaching) ──
  [`${A.coaching}#createSessionAction`]: formateur(A.coaching, "createSessionAction", {
    interventionSlug: "audit-ia",
    dateSeance: "2026-11-02",
  }),
  [`${A.coaching}#updateSessionStatutAction`]: formateur(A.coaching, "updateSessionStatutAction", {
    sessionId: SESSION,
    statut: "realisee",
  }),
  [`${A.coaching}#upsertCartographieAction`]: formateur(A.coaching, "upsertCartographieAction", {
    sessionId: SESSION,
  }),
  [`${A.coaching}#upsertOptimisationAction`]: formateur(A.coaching, "upsertOptimisationAction", {
    sessionId: SESSION,
    type: "automatisation",
    titre: "Titre",
  }),
  [`${A.coaching}#deleteOptimisationAction`]: formateur(A.coaching, "deleteOptimisationAction", {
    sessionId: SESSION,
    id: DOC,
  }),
  [`${A.coaching}#upsertPlanAction`]: formateur(A.coaching, "upsertPlanAction", {
    sessionId: SESSION,
  }),
  [`${A.coaching}#addCompteRenduAction`]: formateur(A.coaching, "addCompteRenduAction", {
    sessionId: SESSION,
    dateSeance: "2026-11-02",
  }),
  [`${A.coaching}#deleteCompteRenduAction`]: formateur(A.coaching, "deleteCompteRenduAction", {
    sessionId: SESSION,
    id: DOC,
  }),
  [`${A.coaching}#addJournalAction`]: formateur(A.coaching, "addJournalAction", {
    sessionId: SESSION,
  }),
  [`${A.coaching}#deleteJournalAction`]: formateur(A.coaching, "deleteJournalAction", {
    sessionId: SESSION,
    id: DOC,
  }),

  // ── Missions : réponse connectée, désistement, formulaires sans JavaScript ──
  [`${A.mission}#repondreMissionFormateurAction`]: formateur(
    A.mission,
    "repondreMissionFormateurAction",
    { missionId: MISSION, reponse: "acceptee" },
  ),
  [`${A.choix}#seDesisterMissionAction`]: formateur(A.choix, "seDesisterMissionAction", {
    missionId: MISSION,
  }),
  [`${A.choix}#seDesisterDepuisFormulaireAction`]: formateur(
    A.choix,
    "seDesisterDepuisFormulaireAction",
    fd({ missionId: MISSION }),
  ),
  [`${A.choix}#repondreDepuisFormulaireAction`]: formateur(
    A.choix,
    "repondreDepuisFormulaireAction",
    fd({ missionId: MISSION, reponse: "acceptee" }),
  ),

  // ── Missions : par le LIEN de l'e-mail (jeton `formateur_mission`) ──
  [`${A.mission}#repondreMissionParJetonAction`]: formateur(
    A.mission,
    "repondreMissionParJetonAction",
    (token: string) => ({ token, reponse: "acceptee" }),
    "jeton-mission",
  ),
  [`${A.mission}#ecrireApresDelaiAction`]: formateur(
    A.mission,
    "ecrireApresDelaiAction",
    (token: string) => ({ token, message: "Je suis disponible finalement." }),
    "jeton-mission",
    "retiree",
  ),

  // ── Émargement ──
  [`${A.emargement}#signerPourStagiaireAction`]: formateur(
    A.emargement,
    "signerPourStagiaireAction",
    {
      sessionId: SESSION,
      creneauId: DOC,
      methode: "confirmation_accessible",
      nomConfirme: "Camille Martin",
    },
  ),
  [`${A.emargement}#contresignerDemiJourneeAction`]: formateur(
    A.emargement,
    "contresignerDemiJourneeAction",
    {
      sessionId: SESSION,
      date: "2026-11-02",
      demiJournee: "matin",
      methode: "confirmation_accessible",
      nomConfirme: "Camille Martin",
    },
  ),

  // ── Signatures : relevé, lettre de mission, contrat de travail ──
  [`${A.releve}#signerReleveFormateurAction`]: formateur(A.releve, "signerReleveFormateurAction", {
    documentGenereId: DOC,
    methode: "confirmation_accessible",
  }),
  [`${A.lettre}#signerLettreMissionFormateurAction`]: formateur(
    A.lettre,
    "signerLettreMissionFormateurAction",
    { documentGenereId: DOC, methode: "confirmation_accessible" },
  ),
  [`${A.contrat}#signerContratTravailFormateurAction`]: formateur(
    A.contrat,
    "signerContratTravailFormateurAction",
    { documentGenereId: DOC, methode: "confirmation_accessible" },
  ),

  // ── Mon dossier ──
  [`${A.dossier}#deposerMaPieceAction`]: formateur(
    A.dossier,
    "deposerMaPieceAction",
    fd({ type: "assurance_rc_pro", fichier: fichier(), dateEmission: "2026-09-01" }),
  ),
  [`${A.dossier}#demanderChangementIbanAction`]: formateur(
    A.dossier,
    "demanderChangementIbanAction",
    // Le formulaire joint le RIB du nouveau compte (canal de changement de compte).
    fd({ iban: "FR7630006000011234567890189", rib: fichier() }),
  ),
  [`${A.dossier}#demanderChangementAdresseAction`]: formateur(
    A.dossier,
    "demanderChangementAdresseAction",
    fd({ adresse: "1 rue de la Paix, 75002 Paris" }),
  ),
  [`${A.dossier}#transmettreMonNumeroAction`]: formateur(
    A.dossier,
    "transmettreMonNumeroAction",
    fd({ nda: "84691234569" }),
  ),

  // ── Ma rémunération : signaler un désaccord sur une facture d'honoraires ──
  [`${A.desaccord}#signalerDesaccordFormAction`]: formateur(
    A.desaccord,
    "signalerDesaccordFormAction",
    fd({ statementId: DOC, texte: "Le montant ne correspond pas." }),
  ),

  // ── Lot G2 : le bilan de fin de formation (page de la session) ──
  [`${A.bilan}#evaluerStagiaireFormAction`]: formateur(
    A.bilan,
    "evaluerStagiaireFormAction",
    fd({ sessionId: SESSION, enrollmentId: DOC, "note-0": "3" }),
  ),
  // V2-N-3 — action à état (`useActionState`) : l'état précédent d'abord.
  [`${A.bilan}#donnerAvisAction`]: formateur(
    A.bilan,
    "donnerAvisAction",
    fd({ sessionId: SESSION, commentaire: "Groupe motivé, rien à signaler." }),
    "session",
    undefined,
    true,
  ),
  [`${A.bilan}#terminerBilanFormAction`]: formateur(
    A.bilan,
    "terminerBilanFormAction",
    fd({ sessionId: SESSION }),
  ),

  // ── Lot L08 : la saisie de l'évaluation finale (page de la session) ──
  [`${A.evaluation}#saisirEvaluationFinaleFormAction`]: formateur(
    A.evaluation,
    "saisirEvaluationFinaleFormAction",
    fd({
      sessionId: SESSION,
      enrollmentId: DOC,
      "note-0": "3",
      "observation-0": "Autonome en atelier.",
    }),
  ),

  // ── Routes : kit imprimé, PDF de la lettre de mission et du contrat à signer ──
  "src/app/api/espace-formateur/kit/[sessionId]/route.ts": route(
    () => import("@/app/api/espace-formateur/kit/[sessionId]/route"),
    { sessionId: SESSION },
  ),
  "src/app/api/formateur/lettre-mission/[id]/route.ts": route(
    () => import("@/app/api/formateur/lettre-mission/[id]/route"),
    { id: DOC },
  ),
  "src/app/api/formateur/contrat-travail/[id]/route.ts": route(
    () => import("@/app/api/formateur/contrat-travail/[id]/route"),
    { id: DOC },
  ),

  // ── Ouvertes après la fin, par décision ──
  [`${A.auth}#sendFormateurMagicLinkAction`]: {
    classe: "ouverte-apres-fin",
    pourquoi: "connexion : n'ouvre qu'une session en LECTURE SEULE (`accesFormateur`)",
  },
  [`${A.auth}#logoutFormateurAction`]: {
    classe: "ouverte-apres-fin",
    pourquoi: "déconnexion : efface le cookie, n'écrit rien",
  },
  "src/app/[locale]/espace-formateur/connexion/[token]/route.ts": {
    classe: "ouverte-apres-fin",
    pourquoi: "consommation du lien : signe la session en lecture seule (`accesFormateur`)",
  },
  "src/app/api/espace-formateur/documents/[id]/route.ts": {
    classe: "ouverte-apres-fin",
    pourquoi: "téléchargement de SES pièces (`getFormateurSessionLecture` + `trainerId`)",
  },

  // ── Console, dans les mêmes modules : garde admin, hors espace formateur ──
  [`${A.mission}#renvoyerPropositionMissionAction`]: {
    classe: "console",
    garde: "requireAdminWrite",
  },
  [`${A.mission}#declarerAbsenceFormateurAction`]: {
    classe: "console",
    garde: "requireAdminWrite",
  },
  [`${A.mission}#consignerAccordHorsOutilAction`]: {
    classe: "console",
    garde: "requireHabilitation|requireAdminWrite",
  },
  [`${A.choix}#choisirFormateursSessionAction`]: { classe: "console", garde: "requireAdminWrite" },
  [`${A.releve}#viserReleveResponsablePedagogiqueAction`]: {
    classe: "console",
    garde: "requireAdminWrite",
  },
  [`${A.lettre}#contresignerLettreMissionAction`]: {
    classe: "console",
    garde: "requireAdminWrite",
  },
  [`${A.contrat}#signerContratTravailEmployeurAction`]: {
    classe: "console",
    garde: "requireAdminWrite",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Exhaustivité
// ─────────────────────────────────────────────────────────────────────────────

const RACINE = resolve(__dirname, "../../../..");
const SRC = join(RACINE, "src");

function fichiers(dir: string): string[] {
  const abs = join(RACINE, dir);
  return readdirSync(abs).flatMap((n) => {
    const p = join(dir, n);
    if (n === "__tests__") return [];
    if (statSync(join(RACINE, p)).isDirectory()) return fichiers(p);
    return /\.tsx?$/.test(n) && !/\.spec\.tsx?$/.test(n) ? [p] : [];
  });
}

const ESPACE = [
  ...fichiers("src/app/[locale]/espace-formateur"),
  ...fichiers("src/components/espace-formateur"),
  ...fichiers("src/app/api/espace-formateur"),
  // PDF des pièces à signer, ouverts depuis l'espace.
  ...fichiers("src/app/api/formateur"),
];

function resoudre(depuis: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(join(RACINE, depuis)), spec);
  else return null;
  for (const ext of [".ts", ".tsx", "/index.ts"]) {
    try {
      if (statSync(base + ext).isFile()) return base + ext;
    } catch {
      /* suivant */
    }
  }
  return null;
}

const estUseServer = (src: string) =>
  /^(?:\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*))*\s*["']use server["']/.test(src);

/** Clé d'un module : son alias `@/…` sans extension. */
const cle = (abs: string) => `@/${abs.slice(SRC.length + 1).replace(/\.tsx?$/, "")}`;

function inventaireReel(): Set<string> {
  const vu = new Set<string>();
  for (const f of ESPACE) {
    if (/\/route\.ts$/.test(f)) vu.add(f);
    const src = readFileSync(join(RACINE, f), "utf8");
    for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
      const abs = resoudre(f, m[1]!);
      if (abs === null) continue;
      const contenu = readFileSync(abs, "utf8");
      if (!estUseServer(contenu)) continue;
      for (const e of contenu.matchAll(/^export\s+async\s+function\s+(\w+)/gm)) {
        vu.add(`${cle(abs)}#${e[1]}`);
      }
    }
  }
  return vu;
}

describe("inventaire de l'espace formateur", () => {
  it("chaque action serveur et chaque route atteignable est classée — rien d'oublié, rien en trop", () => {
    expect([...inventaireReel()].sort()).toEqual(Object.keys(INVENTAIRE).sort());
  });

  it("les actions classées « console » portent bien une garde admin", () => {
    for (const [k, l] of Object.entries(INVENTAIRE)) {
      if (l.classe !== "console") continue;
      const [mod, nom] = k.split("#") as [string, string];
      const src = readFileSync(join(SRC, `${mod.slice(2)}.ts`), "utf8");
      const corps = src.slice(src.indexOf(`export async function ${nom}(`)).split(/\nexport /)[0]!;
      expect(corps, k).toMatch(new RegExp(`await (${l.garde})\\(`));
    }
  });

  it("chaque page de l'espace exige l'accès complet, sauf les lectures autorisées", () => {
    const pages = ESPACE.filter((f) => f.endsWith("/page.tsx"));
    const LECTURE = new Set([
      "src/app/[locale]/espace-formateur/remuneration/page.tsx",
      "src/app/[locale]/espace-formateur/dossier/page.tsx",
    ]);
    const SANS_SESSION = new Set([
      "src/app/[locale]/espace-formateur/connexion/page.tsx",
      // Lecture par le jeton de mission : `lireMissionParJeton`, couvert plus bas.
      "src/app/[locale]/espace-formateur/mission/[token]/page.tsx",
    ]);
    for (const p of pages) {
      const src = readFileSync(join(RACINE, p), "utf8");
      if (SANS_SESSION.has(p)) continue;
      if (LECTURE.has(p)) expect(src, p).toMatch(/requireFormateurLecture\(/);
      else expect(src, p).toMatch(/requireFormateur\(/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 et 3. Refus après la fin, témoin pendant la collaboration
// ─────────────────────────────────────────────────────────────────────────────

const LIGNES = Object.entries(INVENTAIRE).flatMap(([k, l]) =>
  l.classe === "formateur" ? [[k, l] as const] : [],
);

/** Rend « refusée » (exception, redirection vers la connexion, résultat d'erreur) ou l'issue. */
async function issue(appel: () => Promise<unknown>): Promise<string> {
  try {
    const r = (await appel()) as Record<string, unknown> | undefined;
    if (r && ("error" in r || r["ok"] === false)) return "refusee";
    return "acceptee";
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (
      m === "unauthorized" ||
      m === `REDIRECT:${FORMATEUR_CONNEXION_PATH}` ||
      m === `REDIRECT:${FORMATEUR_CONNEXION_PATH}?erreur=session`
    ) {
      return "refusee";
    }
    return `exception:${m}`;
  }
}

const LECTURE_DE_GARDE: Record<Porte, string> = {
  session: "trainer.findUnique",
  "jeton-mission": "missionFormateur.findUnique",
};

beforeEach(() => {
  etat.statutMission = "en_attente";
  etat.appels = [];
  etat.jeton = null;
  etat.fin = null;
});

describe("collaboration CLOSE : chaque action du formateur est refusée, avant tout travail", () => {
  it.each(LIGNES)("%s", async (_k, l) => {
    if (l.classe !== "formateur") return;
    etat.fin = FIN;
    etat.statutMission = l.statutMission ?? "en_attente";
    const essais: Array<() => Promise<unknown>> = [];
    if (l.porte === "session") {
      // La session la plus large après la fin : ouverte APRÈS la clôture (lecture seule).
      etat.jeton = await signFormateurSession(
        TRAINER,
        "formateur",
        undefined,
        versionSessionFormateur({ finCollaborationAt: FIN }),
      );
      essais.push(() => l.appel(""));
    } else {
      const avant = await tokenMission(0);
      const sansVersion = await tokenMission();
      essais.push(
        () => l.appel(avant),
        () => l.appel(sansVersion),
      );
    }
    for (const essai of essais) {
      expect(await issue(essai)).toBe("refusee");
    }
    // Rien d'autre que la lecture de garde, une fois par essai au plus.
    expect(etat.appels.filter((a) => a !== LECTURE_DE_GARDE[l.porte])).toEqual([]);
    expect(etat.appels.length).toBeLessThanOrEqual(essais.length);
  });
});

describe("témoin — collaboration EN COURS : la même ligne passe la garde", () => {
  it.each(LIGNES)("%s", async (_k, l) => {
    if (l.classe !== "formateur") return;
    etat.fin = null;
    etat.statutMission = l.statutMission ?? "en_attente";
    let token = "";
    if (l.porte === "session")
      etat.jeton = await signFormateurSession(TRAINER, "formateur", undefined, 0);
    else token = await tokenMission(0);
    await issue(() => l.appel(token));
    const auDela = etat.appels.length - 1;
    expect(auDela, "le service doit travailler au-delà de la garde").toBeGreaterThan(0);
  });
});
