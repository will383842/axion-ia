/**
 * Assistant de devis — état, réducteur, contrôles d'étape, sérialisation (fiche E01).
 * PUR et client-safe : aucun import de prisma, de `node:`, de pricing ni de json-canonique.
 * Aucun prix ni taux de TVA : les montants sont des chaînes saisies, jamais calculées ici.
 */
import { eurosVersCents } from "../devis-formules/saisie";
import {
  ETAPES,
  type Etape,
  type EtatAssistant,
  type EtatSerialise,
  type LigneAssistant,
  type PhaseAssistant,
  type Proposition,
  type ResultatLecture,
  type TypeLigne,
} from "./types";

export interface ParamsInitiaux {
  defaultClientId?: string | undefined;
  projetId?: string | undefined;
  rencontreId?: string | undefined;
  validiteParDefaut: string;
  formulesActives: boolean;
}

export function ligneVide(id: string, type: TypeLigne = "libre"): LigneAssistant {
  return {
    id,
    type,
    libelle: "",
    quantite: "1",
    prixEur: "",
    delaiSemaines: "",
    necessite: [],
    champsLibres: [],
    offreCode: "",
    designationDepuisOffre: false,
  };
}

function phaseSolde(id: string): PhaseAssistant {
  return {
    id,
    libelle: "Solde",
    pourcentage: "100",
    declencheur: "signature",
    livrable: "",
    delaiSemaines: "",
  };
}

export function etatInitial(p: ParamsInitiaux): EtatAssistant {
  return {
    modele: null,
    clientId: p.defaultClientId ?? "",
    clientType: null,
    intitule: "",
    validite: p.validiteParDefaut,
    origine: {
      ...(p.projetId ? { projetId: p.projetId } : {}),
      ...(p.rencontreId ? { rencontreId: p.rencontreId } : {}),
    },
    motsDuClient: "",
    resultatVise: "",
    valeurClient: "",
    lignes: [ligneVide("ligne-1")],
    proposition: "prix_unique",
    formulesActives: p.formulesActives,
    garantie: { afficher: true, jours: "", phrase: "" },
    delais: { texte: "", fourchette: "" },
    achat: {
      phases: [phaseSolde("phase-a-1")],
      hebergement: "client",
      hebergementMensuelEur: "",
      maintenance: {
        regle: "facultative",
        mensuelEur: "",
        periodes: [1, 12],
        dureeMinimale: "",
        moisOfferts: "0",
      },
    },
    abonnement: {
      miseEnServiceSaisie: "",
      miseEnServiceLibelle: "Mise en service et adaptation",
      phases: [phaseSolde("phase-b-1")],
      mensuelCatalogueEur: "",
      terme: "a_echoir",
      periodes: [{ mois: 1, remisePct: "0" }],
      engagementMois: 0,
      reconduction: "mensuelle",
      preavisMois: 1,
      indemniteTauxPct: "0",
    },
    ia: {
      achat: { mode: "compte_client", moisInclus: "" },
      abonnement: { mode: "non_incluse", niveau: "essentiel" },
    },
    avantages: { A: [], B: [] },
    servicesTiers: [],
    plafondAConfirmer: null,
    automatisationsHeritees: [],
    financement: {
      mode: "",
      modaliteOpco: "",
      nbParticipants: "",
      dureeHeures: "",
      enveloppeRestante: "",
      dateDebutSession: "",
    },
  };
}

/** Raison pour laquelle seul le prix unique est possible (lue par `aria-describedby`), sinon null. */
export function raisonPrixUniqueImpose(e: EtatAssistant): string | null {
  if (!e.formulesActives) return "Les devis à formules ne sont pas activés.";
  if (e.clientType === "particulier") return "Un client particulier ne reçoit qu'un prix unique.";
  if (e.modele !== "implementation" && e.modele !== "site_web") {
    return "Les formules ne concernent que la mise en place d'une IA et le site web.";
  }
  return null;
}

/** Choix effectif : le choix demandé reste dans l'état (rien n'est perdu), mais peut être refusé. */
export function propositionEffective(e: EtatAssistant): Proposition {
  return raisonPrixUniqueImpose(e) === null ? e.proposition : "prix_unique";
}

export type ActionAssistant =
  | { type: "remplacer"; etat: EtatAssistant }
  | { type: "modele"; modele: EtatAssistant["modele"] }
  | { type: "client"; id: string; clientType: EtatAssistant["clientType"] }
  | { type: "proposer"; proposition: Proposition }
  | { type: "champs"; patch: Partial<EtatAssistant> }
  | { type: "achat"; patch: Partial<EtatAssistant["achat"]> }
  | { type: "abonnement"; patch: Partial<EtatAssistant["abonnement"]> }
  | { type: "ligne_ajouter"; id: string; typeLigne?: TypeLigne }
  | { type: "ligne_modifier"; id: string; patch: Partial<Omit<LigneAssistant, "id">> }
  | { type: "ligne_supprimer"; id: string };

export function reducteur(e: EtatAssistant, a: ActionAssistant): EtatAssistant {
  switch (a.type) {
    case "remplacer":
      return a.etat;
    case "modele":
      return { ...e, modele: a.modele };
    case "client":
      return { ...e, clientId: a.id, clientType: a.clientType };
    case "proposer":
      return { ...e, proposition: a.proposition };
    case "champs":
      return { ...e, ...a.patch };
    case "achat":
      return { ...e, achat: { ...e.achat, ...a.patch } };
    case "abonnement":
      return { ...e, abonnement: { ...e.abonnement, ...a.patch } };
    case "ligne_ajouter":
      return { ...e, lignes: [...e.lignes, ligneVide(a.id, a.typeLigne)] };
    case "ligne_modifier":
      return { ...e, lignes: e.lignes.map((l) => (l.id === a.id ? { ...l, ...a.patch } : l)) };
    case "ligne_supprimer":
      // Les dépendances qui visaient la ligne supprimée sont retirées avec elle.
      return {
        ...e,
        lignes: e.lignes
          .filter((l) => l.id !== a.id)
          .map((l) => ({ ...l, necessite: l.necessite.filter((n) => n !== a.id) })),
      };
  }
}

const ESPACES = /[   ]/g;
/** Montant lisible : séparateurs de milliers admis, jamais ramené à 0 (le calcul est ailleurs). */
function centsLus(s: string): number | null {
  return eurosVersCents(s.replace(ESPACES, ""));
}
/** Pourcentage saisi : « illisible » (format) ou « hors_borne » (hors 0 à 100), sinon null. */
export function defautPourcentage(saisie: string): "illisible" | "hors_borne" | null {
  const t = saisie.replace(ESPACES, "").trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return "illisible";
  return Number(t) > 100 ? "hors_borne" : null;
}

const entier = (s: string): number | null => (/^\d+$/.test(s.trim()) ? Number(s) : null);

function totalPhases(p: readonly PhaseAssistant[], nom: string): string[] {
  const vals = p.map((x) => entier(x.pourcentage));
  if (p.length === 0 || vals.some((v) => v === null)) {
    return [`${nom} : chaque phase demande un pourcentage entier.`];
  }
  const total = (vals as number[]).reduce((s, v) => s + v, 0);
  return total === 100
    ? []
    : [`${nom} : le total des phases doit valoir 100 % (actuellement ${total} %).`];
}

function controlerLignes(e: EtatAssistant): string[] {
  if (e.lignes.length === 0) return ["Ajoutez au moins une ligne au devis."];
  const err: string[] = [];
  e.lignes.forEach((l, i) => {
    const r = `Ligne ${i + 1}`;
    if (l.libelle.trim() === "") err.push(`${r} : le libellé est requis.`);
    if (
      !/^\d+([.,]\d{1,2})?$/.test(l.quantite.trim()) ||
      Number(l.quantite.replace(",", ".")) <= 0
    ) {
      err.push(`${r} : quantité illisible (positive, 2 décimales au plus).`);
    }
    if (centsLus(l.prixEur) === null)
      err.push(`${r} : prix illisible (euros, 2 décimales au plus).`);
  });
  return err;
}

/** Erreurs de l'étape (liste vide = on peut continuer). Le serveur revalide tout. */
export function controlerEtape(e: EtatAssistant, etape: Etape): string[] {
  const p = propositionEffective(e);
  const a = p === "A" || p === "AB";
  const b = p === "B" || p === "AB";
  const err: string[] = [];
  switch (etape) {
    case 1:
      if (e.clientId === "") err.push("Choisissez un client.");
      if (e.intitule.trim() === "") err.push("Donnez un intitulé au devis.");
      return [...err, ...controlerLignes(e)];
    case "1b": {
      const hors = e.achat.phases.some((x) => {
        const v = entier(x.pourcentage);
        return v !== null && (v < 1 || v > 100);
      });
      return [
        ...totalPhases(e.achat.phases, "Phases"),
        ...(hors ? ["Phases : chaque versement doit être compris entre 1 et 100 %."] : []),
      ];
    }
    case 2:
      if (
        a &&
        e.achat.hebergement === "axion" &&
        centsLus(e.achat.hebergementMensuelEur) === null
      ) {
        err.push("Hébergement chez Axion-IA : le montant mensuel est requis.");
      }
      if (a && (centsLus(e.achat.maintenance.mensuelEur) ?? 0) <= 0) {
        err.push("Maintenance : un montant mensuel supérieur à 0 est requis.");
      }
      if (a && !/^\d+$/.test(e.achat.maintenance.moisOfferts.trim())) {
        err.push("Maintenance : les mois offerts doivent être un entier supérieur ou égal à 0.");
      }
      // Section « Services extérieurs » masquée en prix unique : ne pas bloquer sur un champ invisible.
      if (p !== "prix_unique") {
        e.servicesSaisies?.forEach((t, i) => {
          if (t.trim() !== "" && centsLus(t) === null) {
            err.push(
              `Service extérieur ${i + 1} : estimation illisible (euros, 2 décimales au plus).`,
            );
          }
        });
        if (e.plafondSaisie !== undefined && e.plafondSaisie !== null) {
          if (e.plafondSaisie.trim() === "")
            err.push("Plafond : saisissez un montant ou décochez.");
          else if (centsLus(e.plafondSaisie) === null) {
            err.push("Plafond : montant illisible (euros, 2 décimales au plus).");
          }
        }
      }
      if (b && (centsLus(e.abonnement.mensuelCatalogueEur) ?? 0) <= 0) {
        err.push("Abonnement : un montant mensuel supérieur à 0 est requis.");
      }
      if (
        p === "AB" &&
        e.abonnement.miseEnServiceSaisie.trim() !== "" &&
        centsLus(e.abonnement.miseEnServiceSaisie) === null
      ) {
        err.push("Mise en service : montant illisible.");
      }
      return err;
    case 3: {
      if (a) err.push(...totalPhases(e.achat.phases, "Échéancier de la formule A"));
      if (b) {
        const ab = e.abonnement;
        err.push(...totalPhases(ab.phases, "Échéancier de la formule B"));
        if (ab.periodes.some((x) => defautPourcentage(x.remisePct) === "illisible"))
          err.push("Abonnement : remise illisible.");
        if (ab.periodes.some((x) => defautPourcentage(x.remisePct) === "hors_borne"))
          err.push("Abonnement : la remise doit être comprise entre 0 et 100 %.");
        if (ab.engagementMois > 0 && ab.periodes.some((x) => ab.engagementMois % x.mois !== 0)) {
          err.push("L'engagement doit être un multiple de chaque période proposée.");
        }
        const di = defautPourcentage(ab.indemniteTauxPct);
        if (di === "illisible") err.push("Indemnité de sortie : taux illisible.");
        if (di === "hors_borne")
          err.push("Indemnité de sortie : le taux doit être entre 0 et 100 %.");
      }
      return err;
    }
    case 4:
      if (e.validite.trim() === "") err.push("Choisissez une date de validité.");
      return [...err, ...ETAPES.filter((x) => x !== 4).flatMap((x) => controlerEtape(e, x))];
  }
}

export function serialiser(etat: EtatAssistant, etape: Etape): EtatSerialise {
  return { v: 1, etape, etat: JSON.parse(JSON.stringify(etat)) as EtatAssistant };
}

const objet = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/** Lecture d'un brouillon : jamais d'exception, une erreur lisible. Le serveur valide en zod (C3). */
export function deserialiser(brut: unknown): ResultatLecture {
  if (!objet(brut)) return { ok: false, erreur: "Brouillon illisible." };
  if (brut["v"] !== 1) {
    return {
      ok: false,
      erreur: `Version de brouillon inconnue (${String(brut["v"])}) : ouvrez-le avec une version à jour.`,
    };
  }
  const etape = brut["etape"];
  const etat = brut["etat"];
  if (!ETAPES.some((x) => x === etape))
    return { ok: false, erreur: "Étape du brouillon illisible." };
  if (
    !objet(etat) ||
    !Array.isArray(etat["lignes"]) ||
    !objet(etat["achat"]) ||
    !objet(etat["abonnement"]) ||
    !objet(etat["ia"])
  ) {
    return { ok: false, erreur: "Contenu du brouillon illisible." };
  }
  return {
    ok: true,
    etape: etape as Etape,
    etat: JSON.parse(JSON.stringify(etat)) as EtatAssistant,
  };
}
