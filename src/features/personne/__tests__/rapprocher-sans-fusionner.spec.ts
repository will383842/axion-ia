// La fiche personne RAPPROCHE, elle ne FUSIONNE pas.
//
// ── Pourquoi cette garde existe ───────────────────────────────────────────
// L'écran qui montre côte à côte « a candidaté en mars » et « est apporteur
// depuis juin » est à un pas de celui qui leur donne un statut commun. Ce pas
// paraît une amélioration — une seule file, un seul pipeline, un seul écran —
// et c'est exactement ce qu'il ne faut pas faire.
//
// 🔴 La raison n'est pas architecturale. La boîte recrutement impose un
// vocabulaire de SÉLECTION : `shortlisted`, `rejected`, `hired`, et des motifs
// comme `competences_insuffisantes`. Appliqués à un apporteur d'affaires, ces
// mots écrivent dans la base la preuve d'un lien de subordination
// (`docs/partners/ANTI-REQUALIFICATION.md`). Et la même boîte porte une alerte
// quotidienne sur les dossiers qui n'ont pas bougé — la « relance de dormance »
// que l'audit a jugée fautive avant même qu'elle soit codée.
//
// Ces tests tiennent la frontière là où elle se franchit sans bruit : dans le
// VOCABULAIRE rendu, et dans la SÉPARATION des mondes.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CANDIDATURE_COMMERCIALE_SUBTYPE } from "@/lib/commercial-application/model";

const chercherSubmissions = vi.fn(async (_a: unknown) => [] as unknown[]);
const chercherCandidatures = vi.fn(async (_a: unknown) => [] as unknown[]);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findMany: (a: unknown) => chercherSubmissions(a) },
    jobApplication: { findMany: (a: unknown) => chercherCandidatures(a) },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string) => String(v).replace(/^chiffre\(|\)$/g, ""),
}));

const { lireFichePersonne } = await import("../fiche-personne");

const EMPREINTE = "a".repeat(64);

/**
 * Le cas qui justifie la fiche : la même personne des DEUX côtés.
 *
 * 🔑 La trace apporteur porte les DEUX clés, comme l'écrivent les quatre
 * producteurs réels du monde apporteur (`commercial-application/*-actions.ts`).
 * Une fixture qui n'écrirait que `unifiedType` décrirait une trace qui
 * n'existe pas côté apporteur — et laisserait passer la confusion avec la
 * rubrique « recrutement » du formulaire de contact public.
 */
function personneDesDeuxCotes() {
  chercherSubmissions.mockResolvedValue([
    {
      id: "sub-1",
      type: "contact",
      details: {
        unifiedType: "recrutement",
        subType: CANDIDATURE_COMMERCIALE_SUBTYPE,
        etape: "premier-contact",
      },
      submittedAt: new Date("2026-06-01T10:00:00Z"),
      contactName: "chiffre(Camille)",
    },
  ]);
  chercherCandidatures.mockResolvedValue([
    {
      id: "cand-1",
      status: "rejected",
      submittedAt: new Date("2026-03-01T10:00:00Z"),
      firstName: "chiffre(Camille)",
      lastName: "chiffre(Durand)",
      offerTitleSnap: "Monteur vidéo",
    },
  ]);
}

beforeEach(() => {
  chercherSubmissions.mockClear();
  chercherCandidatures.mockClear();
  chercherSubmissions.mockResolvedValue([]);
  chercherCandidatures.mockResolvedValue([]);
});

describe("la fiche personne rapproche sans fusionner", () => {
  it("réunit les traces des deux mondes et le DIT", async () => {
    personneDesDeuxCotes();
    const f = await lireFichePersonne(EMPREINTE);
    expect(f.traces).toHaveLength(2);
    expect(f.compte.apporteur).toBe(1);
    expect(f.compte.emploi).toBe(1);
    expect(f.desDeuxCotes, "c'est le cas qui justifie l'écran").toBe(true);
    expect(f.nom).toBe("Camille");
  });

  it("🔴 n'applique JAMAIS un statut de sélection à une trace apporteur", async () => {
    // Le franchissement le plus probable : afficher `rejected` ou `hired` sur
    // la ligne apporteur « par cohérence de colonne ».
    personneDesDeuxCotes();
    const f = await lireFichePersonne(EMPREINTE);
    const apporteur = f.traces.filter((t) => t.monde === "apporteur");
    expect(apporteur).toHaveLength(1);

    const texte = JSON.stringify(apporteur).toLowerCase();
    for (const interdit of [
      "rejected",
      "shortlisted",
      "hired",
      "écarté",
      "présélectionné",
      "embauché",
      "competences_insuffisantes",
    ]) {
      expect(texte, `« ${interdit} » ne doit jamais toucher une trace apporteur`).not.toContain(
        interdit,
      );
    }
  });

  it("chaque trace garde le VOCABULAIRE de son monde", async () => {
    personneDesDeuxCotes();
    const f = await lireFichePersonne(EMPREINTE);
    const parMonde = Object.fromEntries(f.traces.map((t) => [t.monde, t.intitule]));
    // Côté apporteur : « premier contact », jamais « candidature ».
    expect(parMonde["apporteur"]).toBe("Premier contact apporteur");
    expect(parMonde["apporteur"]?.toLowerCase()).not.toContain("candidat");
    // Côté emploi : le mot « candidature » est ici légitime.
    expect(parMonde["emploi"]).toContain("Candidature");
  });

  it("les deux mondes gardent des CHEMINS distincts — pas de file commune", async () => {
    // Une file commune est le second franchissement : traiter les deux dans le
    // même écran finit par leur donner les mêmes gestes.
    personneDesDeuxCotes();
    const f = await lireFichePersonne(EMPREINTE);
    const chemins = Object.fromEntries(f.traces.map((t) => [t.monde, t.chemin]));
    expect(chemins["apporteur"]).toContain("contacts/commercial/");
    expect(chemins["emploi"]).toContain("contacts/candidatures/");
    expect(chemins["apporteur"]).not.toBe(chemins["emploi"]);
  });

  it("interroge les DEUX tables par l'EMPREINTE, jamais par l'adresse", async () => {
    // Une requête par adresse en clair ne rendrait JAMAIS rien — colonnes
    // chiffrées à IV aléatoire — et la fiche paraîtrait simplement vide.
    await lireFichePersonne(EMPREINTE);
    const w1 = (chercherSubmissions.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      ?.where;
    const w2 = (chercherCandidatures.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      ?.where;
    expect(w1).toHaveProperty("contactEmailHash");
    expect(w2).toHaveProperty("emailHash");
  });

  it("refuse une empreinte malformée SANS interroger la base", async () => {
    // Une chaîne arbitraire dans l'URL ne doit pas déclencher de requête : le
    // paramètre vient de l'extérieur, il n'est jamais de confiance.
    for (const mauvaise of ["", "pas-une-empreinte", "a".repeat(63), "../../etc"]) {
      chercherSubmissions.mockClear();
      const f = await lireFichePersonne(mauvaise);
      expect(f.traces).toEqual([]);
      expect(chercherSubmissions, `« ${mauvaise} » ne doit rien interroger`).not.toHaveBeenCalled();
    }
  });

  it("une personne d'UN SEUL côté n'est pas annoncée comme étant des deux", async () => {
    // Contre-témoin : sans lui, un `desDeuxCotes` toujours vrai passerait le
    // premier test sans rien prouver.
    chercherSubmissions.mockResolvedValue([
      {
        id: "sub-1",
        type: "contact",
        details: { unifiedType: "recrutement", etape: "premier-contact" },
        submittedAt: new Date(),
        contactName: "chiffre(Seul)",
      },
    ]);
    const f = await lireFichePersonne(EMPREINTE);
    expect(f.desDeuxCotes).toBe(false);
    expect(f.compte.emploi).toBe(0);
  });

  it("🔴 un message « recrutement » du formulaire public N'EST PAS un apporteur", async () => {
    // Le franchissement le plus silencieux, et il ne demande aucun code
    // fautif : `unifiedType: "recrutement"` n'appartient PAS au monde
    // apporteur. C'est aussi l'une des rubriques du formulaire de contact
    // public (`unified-contact/actions.ts` écrit `unifiedType: data.type`, et
    // `submissionTypeFor` accepte `case "recrutement"`). Un visiteur qui écrit
    // « je cherche un poste » depuis /contact produit exactement cette trace.
    // La classer « apporteur » lui donne un dossier commercial qu'il n'a jamais
    // ouvert — et fait de la fiche l'écran de FUSION qu'elle interdit.
    //
    // Le discriminant est `details.subType`, que les quatre producteurs
    // apporteur écrivent et que le formulaire public ne pose jamais.
    chercherSubmissions.mockResolvedValue([
      {
        id: "sub-contact",
        type: "contact",
        details: { unifiedType: "recrutement", ville: "Grenoble", message: "Je cherche un poste" },
        submittedAt: new Date("2026-07-01T10:00:00Z"),
        contactName: "chiffre(Nadia)",
      },
    ]);
    const f = await lireFichePersonne(EMPREINTE);
    expect(f.compte.apporteur, "un message public n'ouvre aucun dossier apporteur").toBe(0);
    expect(f.traces[0]?.monde).toBe("autre");
    expect(f.traces[0]?.intitule).toBe("Message reçu");
    expect(f.traces[0]?.chemin).toBe("contacts/messages/sub-contact");
  });

  it("une trace portant les DEUX clés reste bien du monde apporteur", async () => {
    // Contre-témoin du test précédent : sans lui, un `estApporteur` toujours
    // faux le passerait sans rien prouver. Les deux intitulés du monde
    // apporteur et son chemin de console sont vérifiés ici.
    chercherSubmissions.mockResolvedValue([
      {
        id: "sub-premier",
        type: "contact",
        details: {
          unifiedType: "recrutement",
          subType: CANDIDATURE_COMMERCIALE_SUBTYPE,
          etape: "premier-contact",
        },
        submittedAt: new Date("2026-06-02T10:00:00Z"),
        contactName: "chiffre(Camille)",
      },
      {
        id: "sub-dossier",
        type: "contact",
        details: {
          unifiedType: "recrutement",
          subType: CANDIDATURE_COMMERCIALE_SUBTYPE,
          etape: "dossier-complet",
        },
        submittedAt: new Date("2026-06-01T10:00:00Z"),
        contactName: "chiffre(Camille)",
      },
    ]);
    const f = await lireFichePersonne(EMPREINTE);
    expect(f.compte.apporteur).toBe(2);
    expect(f.compte.autre).toBe(0);
    const parId = Object.fromEntries(f.traces.map((t) => [t.id, t]));
    expect(parId["sub-premier"]?.intitule).toBe("Premier contact apporteur");
    expect(parId["sub-dossier"]?.intitule).toBe("Dossier apporteur");
    expect(parId["sub-premier"]?.chemin).toBe("contacts/commercial/sub-premier");
    expect(parId["sub-dossier"]?.chemin).toBe("contacts/commercial/sub-dossier");
  });
});
