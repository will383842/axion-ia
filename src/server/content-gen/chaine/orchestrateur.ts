/**
 * Orchestration de la chaîne éditoriale IA (C10, § 4 de `CONCEPTION-CHAINE-EDITORIALE-IA.md`).
 *
 * Module PUR : tout ce qui touche au monde (modèle, porte, base, file de relecture, lecture
 * des liens) est INJECTÉ par `PortsChaine`. Rien n'est branché sur la publication, et la chaîne
 * ne publie JAMAIS : la seule issue favorable est la file de relecture humaine (`a_relire`).
 *
 * États : besoin → brief → faits → redige → critique → verifie → edite → porte
 *         → a_relire | abandonne (ou reporte / en_attente / a_trancher : le contenu attend).
 *
 * Règles :
 *  - un seul compteur de réécritures (2 au plus), partagé avec la porte (`reecrituresFaites`) ;
 *  - plafond de 3 $ par contenu : l'atteindre, ou être sur le point de le dépasser = abandon ;
 *  - porte fail-closed : appel en erreur ou sortie illisible = le contenu attend, jamais publié ;
 *  - interrupteur général relu avant tout appel (éteint par défaut).
 */

import type { CodeRefus } from "./codes-refus";
import {
  actionApresVerdict,
  noteValide,
  PLAFOND_COUT_USD,
  publicationAutorisee,
  refusDepuisVerdict,
  type EntreePorte,
  type ResultatAppelPorte,
  type SortiePorte,
} from "./contrat-porte";
import {
  CompteurCout,
  MAX_REECRITURES,
  PlafondAtteintError,
  peutSeReecrire,
  type AppelModele,
  type Correction,
  type RoleChaine,
} from "./roles/commun";
import { collecterFaits, type FaitSource } from "./roles/collecteur-faits";
import { critiquerArticle } from "./roles/expert-critique";
import { editerForme } from "./roles/editeur-forme";
import {
  redigerArticle,
  reecrireSections,
  type ArticleRedige,
  type EntreeRedaction,
} from "./roles/redacteur";
import { strategeBrief, type EntreeStrateg } from "./roles/strateg-brief";
import { ChaineEteinteError, exigerChaineAllumee, roleAllume } from "./roles/interrupteur";
import { verifierFaits, type ResultatLien } from "./roles/verificateur-faits";

const COUT_MAX_PORTE_DEFAUT_USD = 0.5;

export const ETATS_CONTENU = [
  "besoin",
  "brief",
  "faits",
  "redige",
  "critique",
  "verifie",
  "edite",
  "porte",
  "a_relire",
  "abandonne",
] as const;
export type EtatContenu = (typeof ETATS_CONTENU)[number];

export interface Besoin {
  readonly contenuId: string;
  readonly strateg: Omit<EntreeStrateg, "urlSite" | "urlCouvrante" | "pageProprietaire"> &
    Partial<Pick<EntreeStrateg, "urlSite">>;
  /** Sujet d'IA ou de réglementation : sources de moins de 18 mois. */
  readonly sujetSensible: boolean;
}

export interface LigneRefusChaine {
  readonly contenuId: string;
  readonly role: RoleChaine | "porte" | "orchestrateur";
  readonly code: CodeRefus;
  readonly raison: string;
  readonly tentative: number;
  readonly coutUsd: number;
  readonly critere?: string;
  readonly section?: string;
  readonly preuve?: string;
  readonly versionPorte?: string;
}

export interface EvenementJournal {
  readonly contenuId: string;
  readonly etat: EtatContenu;
  readonly coutUsd: number;
  readonly parRole: Readonly<Partial<Record<RoleChaine, number>>>;
  readonly detail?: string;
}

export interface ContenuARelire {
  readonly contenuId: string;
  readonly titre: string;
  readonly metaDescription: string;
  readonly article: ArticleRedige;
  readonly faits: ReadonlyArray<FaitSource>;
  readonly note: number;
  readonly versionPorte: string;
  readonly reecrituresFaites: number;
  readonly coutUsd: number;
  /** Appel Journée IA : relecture humaine obligatoire (règle existante). */
  readonly relectureObligatoire: boolean;
}

export interface PortsChaine {
  readonly appel: AppelModele;
  readonly maintenant: () => Date;
  readonly urlSite: string;
  /** Coût maximal estimé d'un appel à la porte (défaut 0,5 $) : réservé avant l'appel. */
  readonly coutMaxPorteUsd?: number;
  readonly urlCouvrante: (requete: string) => string | null;
  readonly pageProprietaire: (requete: string) => string | null;
  readonly testerLien: (url: string) => Promise<ResultatLien>;
  /** Appel à la porte qualité ; une exception est traitée comme une erreur (échec fermé). */
  readonly appelerPorte: (entree: EntreePorte) => Promise<ResultatAppelPorte>;
  /** Écrit un refus (table `ContenuRefus`) : un seul mécanisme pour la chaîne et la porte. */
  readonly enregistrerRefus: (ligne: LigneRefusChaine) => Promise<void>;
  readonly journaliser: (evenement: EvenementJournal) => Promise<void>;
  /**
   * Dépose dans la file de relecture humaine (jamais de publication). DOIT être idempotent par
   * `contenuId` : si le journal tombe juste après le dépôt, `PanneEcriture` remonte et l'appelant
   * peut relancer le même besoin sans créer un second dépôt.
   */
  readonly deposerEnRelecture: (contenu: ContenuARelire) => Promise<void>;
}

export type IssueContenu =
  | { readonly issue: "a_relire"; readonly contenu: ContenuARelire }
  | {
      readonly issue: "abandonne";
      readonly code: CodeRefus;
      readonly raison: string;
      readonly etatAtteint: EtatContenu;
      readonly coutUsd: number;
    }
  /** Plafond du jour ou coupe-circuit (B17) : le contenu attend, ni réécriture ni abandon. */
  | { readonly issue: "reporte"; readonly coutUsd: number }
  /** Porte injoignable ou critère non évalué : rien n'est publié, rien n'est détruit. */
  | { readonly issue: "en_attente"; readonly raison: string; readonly coutUsd: number }
  /** Dérogation ou fusion (B05, B06, B07) : un humain tranche. */
  | {
      readonly issue: "a_trancher";
      readonly criteres: readonly string[];
      readonly coutUsd: number;
    };

class Abandon extends Error {
  constructor(
    readonly code: CodeRefus,
    readonly raison: string,
    readonly role: LigneRefusChaine["role"],
    /** Le refus est déjà écrit (lignes de la porte) : ne pas le compter une seconde fois. */
    readonly dejaEnregistre = false,
  ) {
    super(raison);
  }
}

/** Panne d'un port d'écriture (journal, refus, file) : remonte, ne devient jamais un abandon. */
export class PanneEcriture extends Error {
  constructor(readonly origine: unknown) {
    super(
      `Panne d'un port d'écriture de la chaîne : ${origine instanceof Error ? origine.message : "inconnue"}`,
    );
    this.name = "PanneEcriture";
  }
}

/** Rôle qui tourne dans chaque état : son interrupteur est relu avant l'appel. */
const ROLE_DE_ETAT: Partial<Record<EtatContenu, RoleChaine>> = {
  brief: "strateg",
  faits: "collecteur",
  redige: "redacteur",
  critique: "expert",
  verifie: "verificateur",
  edite: "editeur",
};

async function ecrire<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    throw new PanneEcriture(e);
  }
}

/** Index de section lisible : « 2 », « directAnswer », « faq » ; tout le reste = global. */
function sectionDePorte(section: string): Correction["section"] {
  const s = section.trim();
  if (/^\d+$/.test(s)) return Number(s);
  if (s === "directAnswer" || s === "faq") return s;
  // « intro » est l'étiquette de la porte pour la réponse directe sous le H1.
  if (s === "intro") return "directAnswer";
  return "global";
}

/** Meta-description par défaut : la réponse directe, coupée à 155 caractères sur un mot entier. */
export function metaDescriptionDepuis(directAnswer: string): string {
  const texte = directAnswer.replace(/\s+/g, " ").trim();
  if (texte.length <= 155) return texte;
  const coupe = texte.slice(0, 155);
  const dernierEspace = coupe.lastIndexOf(" ");
  return (dernierEspace > 80 ? coupe.slice(0, dernierEspace) : coupe).trim();
}

/** Corps transmis à la porte : réponse directe, corps, FAQ. */
function corpsPourPorte(a: ArticleRedige): string {
  const faq = a.faq.map((f) => `<h3>${f.question}</h3><p>${f.answer}</p>`).join("");
  return `<p>${a.directAnswer}</p>${a.bodyHtml}${faq ? `<h2>Questions fréquentes</h2>${faq}` : ""}`;
}

function sansDoublonCorrections(cs: ReadonlyArray<Correction>): Correction[] {
  const vus = new Set<string>();
  return cs.filter((c) => {
    const cle = `${c.section}|${c.probleme}`;
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
}

/**
 * Un contenu, du besoin à la file de relecture. Toute erreur du cycle devient une issue (abandon
 * ou attente) ; seule une panne des ports d'écriture (journal, refus, file) remonte. Chaque
 * transition est journalisée.
 */
export async function lancerContenu(besoin: Besoin, ports: PortsChaine): Promise<IssueContenu> {
  exigerChaineAllumee();
  const compteur = new CompteurCout();
  const total = () => compteur.totalUsd;
  let reecritures = 0;
  /** Qui a demandé la réécriture en cours : les abandons lui sont imputés. */
  let demandeur: LigneRefusChaine["role"] = "redacteur";
  let etat: EtatContenu = "besoin";

  const aller = async (e: EtatContenu, detail?: string) => {
    // Interrupteur général et interrupteur du rôle relus avant CHAQUE étape payante.
    const role = ROLE_DE_ETAT[e];
    if (role !== undefined) {
      exigerChaineAllumee();
      if (!roleAllume(role)) throw new ChaineEteinteError(`Rôle ${role} éteint`);
    } else if (e === "porte") exigerChaineAllumee();
    etat = e;
    await journal(e, detail);
  };
  const journal = (e: EtatContenu, detail?: string) =>
    ecrire(() =>
      ports.journaliser({
        contenuId: besoin.contenuId,
        etat: e,
        coutUsd: total(),
        parRole: { ...compteur.parRole },
        ...(detail !== undefined ? { detail } : {}),
      }),
    );
  const refuser = (
    role: LigneRefusChaine["role"],
    code: CodeRefus,
    raison: string,
  ): Promise<void> =>
    ecrire(() =>
      ports.enregistrerRefus({
        contenuId: besoin.contenuId,
        role,
        code,
        raison,
        tentative: reecritures + 1,
        coutUsd: total(),
      }),
    );
  /** Exige une réécriture : applique le plafond de 2 et l'impossibilité de cibler une section. */
  const exigerReecriture = (corrections: ReadonlyArray<Correction>) => {
    if (corrections.some((c) => !peutSeReecrire(c))) {
      throw new Abandon("autre", "Correction globale : non réécrivable par section", demandeur);
    }
    if (reecritures >= MAX_REECRITURES) {
      throw new Abandon("plafond_atteint", "Plafond de réécritures atteint", demandeur);
    }
  };

  try {
    // ── brief ─────────────────────────────────────────────────────────────
    await aller("brief");
    const brief = await strategeBrief(
      {
        ...besoin.strateg,
        urlSite: besoin.strateg.urlSite ?? ports.urlSite,
        urlCouvrante: ports.urlCouvrante,
        pageProprietaire: ports.pageProprietaire,
      },
      ports.appel,
      compteur,
    );
    if (brief.verdict === "pas_de_matiere" || brief.verdict === "pas_d_angle") {
      throw new Abandon(brief.codeRefus, brief.raison, "strateg");
    }
    if (brief.verdict === "deja_couvert" || brief.verdict === "intention_hors_article") {
      throw new Abandon(brief.codeRefus, brief.raison, "strateg");
    }
    if (brief.verdict !== "brief_pret") {
      throw new Abandon("autre", `Brief inutilisable : ${brief.raison}`, "strateg");
    }
    const { structure } = brief;

    // ── faits ─────────────────────────────────────────────────────────────
    await aller("faits");
    const collecte = await collecterFaits(
      {
        sujet: structure.h1,
        questionsFactuelles: structure.faitsACollecter,
        sujetSensible: besoin.sujetSensible,
        maintenant: ports.maintenant(),
      },
      ports.appel,
      compteur,
    );
    if (collecte.verdict !== "dossier_complet") {
      throw new Abandon(
        "dossier_insuffisant",
        collecte.raison ?? "Dossier de preuves insuffisant",
        "collecteur",
      );
    }
    const faits = collecte.faits;
    const entreeRedaction: EntreeRedaction = {
      brief: brief.brief,
      structure,
      faits,
      maintenant: ports.maintenant(),
    };

    // ── rédaction, puis boucle critique → vérification → édition → porte ──
    await aller("redige");
    const premiere = await redigerArticle(entreeRedaction, ports.appel, compteur);
    if (premiere.verdict !== "redige") {
      throw new Abandon("autre", premiere.raison, "redacteur");
    }
    let article = premiere.article;
    let aCorriger: ReadonlyArray<Correction> = premiere.problemes;
    demandeur = "redacteur";

    for (;;) {
      if (aCorriger.length > 0) {
        exigerReecriture(aCorriger);
        reecritures += 1;
        await aller("redige", `réécriture ${reecritures}`);
        const r = await reecrireSections(
          entreeRedaction,
          article,
          sansDoublonCorrections(aCorriger),
          ports.appel,
          compteur,
        );
        if (r.verdict !== "redige") throw new Abandon("autre", r.raison, "redacteur");
        article = r.article;
        aCorriger = r.problemes;
        demandeur = "redacteur";
        // Les problèmes de contrat se corrigent avant tout autre appel : on ne paie pas l'expert
        // pour un texte que le code sait déjà non conforme.
        if (aCorriger.length > 0) continue;
      }

      // critique
      await aller("critique");
      const critique = await critiquerArticle(
        {
          titre: structure.h1,
          lecteur: structure.lecteur,
          secteur: structure.lecteur.metier,
          directAnswer: article.directAnswer,
          bodyHtml: article.bodyHtml,
          faq: article.faq,
          types: structure.planHn.map((p) => p.type),
          gabarit: structure.gabaritCible,
        },
        ports.appel,
        compteur,
      );
      if (critique.verdict === "illisible") throw new Abandon("autre", critique.raison, "expert");
      if (critique.verdict === "abandonner") {
        throw new Abandon(
          critique.codeRefus ?? "autre",
          "L'expert juge le contenu non sauvable",
          "expert",
        );
      }
      if (critique.verdict === "reecrire") {
        aCorriger = critique.corrections;
        demandeur = "expert";
        if (aCorriger.length === 0) {
          throw new Abandon("autre", "Réécriture demandée sans correction localisée", "expert");
        }
        continue;
      }

      // vérification des faits
      await aller("verifie");
      const verif = await verifierFaits(
        {
          directAnswer: article.directAnswer,
          bodyHtml: article.bodyHtml,
          faq: article.faq,
          faits,
          testerLien: ports.testerLien,
        },
        ports.appel,
        compteur,
      );
      if (verif.verdict === "illisible") throw new Abandon("autre", verif.raison, "verificateur");
      if (verif.verdict === "a_corriger") {
        aCorriger = verif.corrections;
        demandeur = "verificateur";
        if (aCorriger.length === 0) {
          throw new Abandon(
            verif.codeRefus ?? "autre",
            "Vérification en défaut sans correction localisée",
            "verificateur",
          );
        }
        continue;
      }

      // édition de forme
      await aller("edite");
      const edition = await editerForme({ ...entreeRedaction, article }, ports.appel, compteur);
      if (edition.verdict === "illisible") throw new Abandon("autre", edition.raison, "editeur");
      article = edition.article;
      const renvoi = [...edition.renvoiR4, ...edition.problemesResiduels];
      if (renvoi.length > 0) {
        aCorriger = renvoi;
        demandeur = "editeur";
        continue;
      }

      // ── porte (échec fermé) ───────────────────────────────────────────
      await aller("porte");
      const entreePorte: EntreePorte = {
        contenuId: besoin.contenuId,
        titre: structure.h1,
        metaDescription: metaDescriptionDepuis(article.directAnswer),
        corps: corpsPourPorte(article),
        dossierPreuves: faits.map((f) => ({
          enonce: f.enonce,
          extrait: f.extrait,
          url: f.url,
          editeur: f.editeur ?? "",
          datePublication: f.datePublication,
        })),
        brief: { requetePrincipale: brief.brief.motCle, intention: brief.brief.intention },
        reecrituresFaites: reecritures,
      };
      // La porte a un coût (juge, sources) : il compte dans le plafond du contenu, et l'appel
      // n'est pas lancé si le plafond est déjà atteint.
      if (total() + (ports.coutMaxPorteUsd ?? COUT_MAX_PORTE_DEFAUT_USD) > PLAFOND_COUT_USD) {
        throw new Abandon("plafond_atteint", "Plafond de coût atteint avant la porte", "porte");
      }
      let appelPorte: ResultatAppelPorte;
      try {
        appelPorte = await ports.appelerPorte(entreePorte);
      } catch (e) {
        appelPorte = { etat: "erreur", message: e instanceof Error ? e.message : "erreur" };
      }
      if (typeof appelPorte.coutUsd === "number") compteur.ajouterExterne(appelPorte.coutUsd);
      if (appelPorte.etat !== "ok") {
        await journal("porte", `en attente : ${appelPorte.message}`);
        return { issue: "en_attente", raison: appelPorte.message, coutUsd: total() };
      }
      const sortie: SortiePorte = appelPorte.sortie;
      const ctx = {
        contenuId: besoin.contenuId,
        reecrituresFaites: reecritures,
        coutUsd: total(),
      };
      const lignesPorte = refusDepuisVerdict(sortie, ctx);
      for (const refus of lignesPorte) {
        await ecrire(() =>
          ports.enregistrerRefus({
            contenuId: refus.contenuId,
            role: "porte",
            code: refus.code,
            raison: refus.raison,
            tentative: refus.tentative,
            coutUsd: refus.coutUsd,
            preuve: refus.preuve,
            versionPorte: refus.versionPorte,
            ...(refus.critere !== undefined ? { critere: refus.critere } : {}),
            ...(refus.section !== undefined ? { section: refus.section } : {}),
          }),
        );
      }
      const action = actionApresVerdict(sortie, {
        reecrituresFaites: reecritures,
        coutUsd: total(),
      });
      switch (action.action) {
        case "relecture_humaine": {
          // Seul chemin vers la file : une note valide. La porte « publiable » complète est
          // `publicationAutorisee` ; B04 non évalué (relecture humaine prévue) passe aussi ici.
          if (!noteValide(sortie.note)) {
            return { issue: "en_attente", raison: "Note invalide", coutUsd: total() };
          }
          const contenu: ContenuARelire = {
            contenuId: besoin.contenuId,
            titre: structure.h1,
            metaDescription: entreePorte.metaDescription,
            article,
            faits,
            note: sortie.note,
            versionPorte: sortie.versionPorte,
            reecrituresFaites: reecritures,
            coutUsd: total(),
            relectureObligatoire:
              brief.relectureHumaineObligatoire || !publicationAutorisee(appelPorte),
          };
          await ecrire(() => ports.deposerEnRelecture(contenu));
          await journal("a_relire");
          return { issue: "a_relire", contenu };
        }
        case "reporter":
          await journal("porte", "reporté (plafond du jour ou coupe-circuit)");
          return { issue: "reporte", coutUsd: total() };
        case "mettre_en_attente":
          await journal("porte", `en attente : ${action.criteres.join(", ") || "porte"}`);
          return {
            issue: "en_attente",
            raison: `Critères non évalués : ${action.criteres.join(", ") || "note invalide"}`,
            coutUsd: total(),
          };
        case "derogation_ou_fusion":
          await journal("porte", `à trancher : ${action.criteres.join(", ")}`);
          return { issue: "a_trancher", criteres: action.criteres, coutUsd: total() };
        case "abandonner":
          // Les lignes de la porte sont déjà écrites : pas de seconde ligne pour la même cause.
          throw new Abandon(
            action.code,
            "Abandon décidé après le verdict de la porte",
            "porte",
            lignesPorte.length > 0 && action.code !== "plafond_atteint",
          );
        case "reecrire": {
          const sansSection = action.corrections.find(
            (c) => sectionDePorte(c.section) === "global",
          );
          if (sansSection) {
            throw new Abandon(
              sansSection.code,
              `Section « ${sansSection.section} » non réécrivable`,
              "porte",
              lignesPorte.length > 0,
            );
          }
          demandeur = "porte";
          aCorriger = action.corrections.map((c) => ({
            section: sectionDePorte(c.section),
            probleme: `${c.critere} : ${c.code}`,
            attendu: "Corriger cette section selon la raison de la porte",
          }));
          continue;
        }
      }
    }
  } catch (e) {
    if (e instanceof PanneEcriture) throw e;
    if (e instanceof ChaineEteinteError) {
      // Éteinte en cours de route : le contenu attend, aucune dépense de plus, aucun abandon.
      await journal(etat, "chaîne éteinte en cours de route");
      return { issue: "reporte", coutUsd: total() };
    }
    const abandon =
      e instanceof Abandon
        ? e
        : e instanceof PlafondAtteintError
          ? new Abandon("plafond_atteint", e.message, e.role ?? "orchestrateur")
          : new Abandon(
              "autre",
              `Erreur inattendue : ${e instanceof Error ? e.message : "inconnue"}`,
              "orchestrateur",
            );
    const etatAtteint = etat;
    // Le plafond de coût est le dernier filet : un total au plafond ou au-delà = abandon motivé.
    if (!abandon.dejaEnregistre) await refuser(abandon.role, abandon.code, abandon.raison);
    await journal("abandonne", `${abandon.code} : ${abandon.raison}`);
    return {
      issue: "abandonne",
      code: abandon.code,
      raison: abandon.raison,
      etatAtteint,
      coutUsd: total(),
    };
  }
}
