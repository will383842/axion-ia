/**
 * ÉTAPES `extraire` → `verifier_faits` → `rattacher` → `consolider` →
 * `ebaucher` → `rediger` → `verifier_compte_rendu` (ADR 0055 ; plan §3.12 ;
 * `compte-rendu-et-extraction.md` §1).
 *
 *   P1 extraire          lit le dialogue entrelacé (seule passe qui voit la
 *                        transcription) ;
 *   V1 verifier_faits    le CODE vérifie chaque fait (citations, locuteur,
 *                        valeurs, catalogue, passages sensibles) ;
 *   P2 rattacher         PROPOSE où ranger chaque projet évoqué — jamais
 *                        appliqué (A4) ; pas appelée tant que la rencontre
 *                        n'a pas de client validé ;
 *   P3 consolider        un appel PAR PÉRIMÈTRE, entrée construite par le
 *                        code (G10) ;
 *   P4 ebaucher          par projet évoqué, SANS prix (G14) ; C4 chiffre ;
 *   P5 rediger           ne voit QUE des faits vérifiés, jamais la
 *                        transcription ;
 *   V2 verifier_compte_rendu  G6 + G9, puis « à valider ».
 *
 * Une étape n'applique rien sur la fiche : elle écrit des faits PROPOSÉS et
 * des propositions. Will valide.
 */

import { CODES_ALERTES_CIRCUIT } from "./alertes-circuit";
import { chiffrerEbauche } from "./catalogue-ia";
import { construireEntreeP1, faitsDejaConnus, type FaitPourPasse } from "./contexte";
import {
  construireEntreeP2,
  construireEntreeP3,
  construireEntreeP4,
  controlerEbauche,
  filtrerConsolidation,
  filtrerRattachement,
  perimetresAConsolider,
  projetsAEbaucher,
  type FaitConnuPourPasse,
} from "./consolider";
import { empreinteDesConsignes, instructionsDe } from "./consignes";
import { entrelacer } from "./dialogue";
import { etatInitial, etatSansTexteBrut, type EtatCompteRendu } from "./etat-compte-rendu";
import { ArretVisio, type ContexteEtape, type Gestionnaire } from "./etapes";
import { ErreurVisio } from "./openai/erreurs";
import { executerPasse } from "./openai/passe";
import type { DonneesPasses, FaitAEcrire, FaitDuJour } from "./port-donnees";
import { SCHEMAS_VISIO, VERSION_SCHEMAS_COMPTE_RENDU } from "./schemas";
import { couvertureDesFaits } from "./verification/g06-couverture";
import { verifierCompteRendu, type FaitPourRedaction } from "./verification/g09-redaction";
import { verifierFaits, type FaitVerifie } from "./verification/verifier-faits";

function depsPasse(ctx: ContexteEtape) {
  return { client: ctx.deps.openai(), cout: ctx.deps.cout };
}

function exigerCompteRendu(ctx: ContexteEtape): string {
  if (ctx.t.compteRenduId === null) throw new ArretVisio("inconnu");
  return ctx.t.compteRenduId;
}

async function chargerPasses(
  ctx: ContexteEtape,
): Promise<DonneesPasses & { etat: EtatCompteRendu }> {
  const d = await ctx.deps.donnees.pourPasses(exigerCompteRendu(ctx));
  if (d === null || d.etat === null) throw new ArretVisio("inconnu");
  return d as DonneesPasses & { etat: EtatCompteRendu };
}

/** Un fait du jour, tel que P2 à P5 le voient (sans citation). */
export function pourPasse(f: FaitDuJour): FaitPourPasse {
  return {
    ref: f.ref,
    type: f.type,
    portee: f.porteeDeclaree,
    projetRef: f.projetRef,
    enonce: f.enonce,
    valeur: f.valeurs.join(", "),
    locuteur: f.locuteur,
    confiance: f.confiance,
  };
}

/** Les faits connus (validés, antérieurs), avec leur référence `H…` de l'extraction. */
function faitsConnusPourPasse(d: DonneesPasses & { etat: EtatCompteRendu }): FaitConnuPourPasse[] {
  const refParId = new Map(d.etat.correspondances.faits.map(([ref, id]) => [id, ref]));
  return faitsDejaConnus(d.faitsConnus, { id: d.rencontre.id, debut: d.rencontre.debut }).map(
    (f) => ({
      ref: refParId.get(f.id) ?? `H-${f.id.slice(0, 8)}`,
      projetId: f.portee === "projet" ? f.projetId : null,
      type: f.type,
      enonce: f.enonce,
      constateLe: f.constateLe,
    }),
  );
}

// ── P1 ───────────────────────────────────────────────────────────────────────

/** « pas un rendez-vous client » : tout est effacé, sans compte rendu. */
export function doitEtreEffaceSansCompteRendu(nature: string): boolean {
  return nature === "pas_un_rendez_vous_client";
}

export const extraire: Gestionnaire = async (ctx) => {
  const { deps, t } = ctx;
  const d = await deps.donnees.pourExtraction(t.rencontreId);
  if (d === null) throw new ArretVisio("audio_incomplet");
  const catalogue = await deps.catalogue();
  const dialogue = entrelacer(d.segments);
  if (dialogue.segments.length === 0) throw new ArretVisio("piste_muette");
  const { entree, correspondances } = construireEntreeP1({
    rencontre: d.rencontre,
    pistes: d.pistes,
    formulaire: d.formulaire,
    contacts: d.contacts,
    projets: d.projets,
    dejaConnus: faitsDejaConnus(d.faitsClient, { id: d.rencontre.id, debut: d.rencontre.debut }),
    dialogue,
  });
  const { sortie, modele } = await executerPasse(depsPasse(ctx), {
    passe: "extraire",
    schema: SCHEMAS_VISIO.extraction.schema,
    nomSchema: SCHEMAS_VISIO.extraction.nom,
    instructions: instructionsDe("extraire", catalogue.texte),
    entree,
    jobId: ctx.jobId,
  });

  if (doitEtreEffaceSansCompteRendu(sortie.nature_echange.nature)) {
    return {
      ecrire: async (tx) => {
        await deps.donnees.effacerSansCompteRendu(tx, t.rencontreId);
        return [{ etape: "purger_audio", compteRenduId: null, reinitialiser: true }];
      },
    };
  }

  const etat: EtatCompteRendu = {
    ...etatInitial(d.rencontre.debut, catalogue.empreinte),
    extraction: sortie,
    natureEchange: sortie.nature_echange.nature,
    correspondances: {
      faits: [...correspondances.faits],
      contacts: [...correspondances.contacts],
      projets: [...correspondances.projets],
    },
    projetsEvoques: sortie.projets_evoques.map((j) => ({
      ref: j.ref,
      intitule: j.intitule,
      activite: j.activite,
    })),
  };
  return {
    ecrire: async (tx) => {
      const crId = await deps.donnees.creerCompteRendu(tx, {
        rencontreId: t.rencontreId,
        transcriptionId: d.transcriptionId,
        mode: d.mode,
        modele,
        promptHash: empreinteDesConsignes(),
        schemaVersion: VERSION_SCHEMAS_COMPTE_RENDU,
        etat,
      });
      return [{ etape: "verifier_faits", compteRenduId: crId }];
    },
  };
};

// ── V1 ───────────────────────────────────────────────────────────────────────

/**
 * ⛔ RÉGÉNÉRER NE DOUBLE AUCUN FAIT : un fait qui redit, depuis le même
 * endroit de la même rencontre, un fait déjà VALIDÉ par Will est écrit
 * `rejete` (motif `doublon`), lié à l'original — jamais un second fait
 * valide.
 */
export function dedoublonner(
  faits: readonly FaitVerifie[],
  valides: ReadonlyArray<{
    readonly id: string;
    readonly type: string;
    readonly cle: string;
    readonly citationDebutMs: number | null;
  }>,
): FaitAEcrire[] {
  return faits.map((f) => {
    const original =
      f.statut === "rejete"
        ? undefined
        : valides.find(
            (v) =>
              v.type === f.type &&
              v.cle === f.cle &&
              v.citationDebutMs !== null &&
              f.citationDebutMs !== null &&
              Math.abs(v.citationDebutMs - f.citationDebutMs) < 1000,
          );
    if (!original) return { ...f, doublonDeFaitId: null };
    return {
      ...f,
      statut: "rejete",
      motif: "doublon",
      citation: null,
      confirmationCitation: null,
      doublonDeFaitId: original.id,
    };
  });
}

export const verifierFaitsEtape: Gestionnaire = async (ctx) => {
  const { deps } = ctx;
  const crId = exigerCompteRendu(ctx);
  const d = await deps.donnees.pourVerificationFaits(crId);
  if (d === null || d.etat.extraction === null) throw new ArretVisio("inconnu");
  const catalogue = await deps.catalogue();
  const dialogue = entrelacer(d.segments);
  const bilan = verifierFaits({
    extraction: d.etat.extraction,
    segments: dialogue.segments,
    catalogue: catalogue.refs,
    connus: new Set(d.etat.correspondances.faits.map(([ref]) => ref)),
    dateEchange: new Date(d.etat.dateEchange),
  });
  const aEcrire = dedoublonner(bilan.faits, d.faitsValidesDeLaRencontre);
  const signaux = [
    ...(bilan.signaux.echo > 0
      ? [`écho : ${bilan.signaux.echo} phrase(s) entendue(s) sur les deux pistes`]
      : []),
    ...(bilan.signaux.passagesEcartes > 0
      ? [`passages écartés : ${bilan.signaux.passagesEcartes}`]
      : []),
    ...(bilan.signaux.sensibles > 0
      ? [`passage sensible : ${bilan.signaux.sensibles} fait(s) mis en attente`]
      : []),
    ...(bilan.signaux.consigneALOral ? ["tentative de consigne dans la conversation"] : []),
    ...(bilan.demandeArretMs !== null
      ? ["demande d'arrêt de l'enregistrement repérée par l'extraction"]
      : []),
    ...(bilan.faits.some((f) => f.statut === "rejete")
      ? ["faits rejetés par la vérification"]
      : []),
  ];
  return {
    ecrire: async (tx) => {
      const refs = await deps.donnees.ecrireFaits(tx, {
        compteRenduId: crId,
        rencontreId: d.rencontre.id,
        clientId: d.rencontre.clientId,
        constateLe: d.rencontre.debut,
        faits: aEcrire,
      });
      if (bilan.consentement !== null && d.enregistrementId !== null) {
        await deps.donnees.ecrirePreuvesAccord(tx, {
          rencontreId: d.rencontre.id,
          enregistrementId: d.enregistrementId,
          accords: [{ texte: bilan.consentement.texte, reponseMs: bilan.consentement.debutMs }],
        });
      }
      const etat: EtatCompteRendu = etatSansTexteBrut({
        ...d.etat,
        faits: refs,
        declarations: aEcrire.map((f) => [f.ref, f.porteeDeclaree, f.projetRef] as const),
        couverture: bilan.couverture,
        suivis: bilan.suivis,
        signaux,
        compteurs: {
          ...d.etat.compteurs,
          faitsVerifies: aEcrire.filter((f) => f.statut !== "rejete").length,
          faitsRejetes: aEcrire.filter((f) => f.statut === "rejete").length,
          faitsEnAttente: aEcrire.filter((f) => f.statut === "en_attente").length,
          correctionsCouverture: bilan.correctionsCouverture,
          suivisRejetes: bilan.suivisRejetes,
        },
      });
      await deps.donnees.majEtat(tx, crId, etat);
      return [{ etape: "rattacher", compteRenduId: crId }];
    },
  };
};

// ── P2 ───────────────────────────────────────────────────────────────────────

export const rattacher: Gestionnaire = async (ctx) => {
  const { deps } = ctx;
  const d = await chargerPasses(ctx);
  const crId = d.compteRenduId;
  const faits = d.faitsDuJour.filter((f) => f.statut !== "rejete").map(pourPasse);
  if (d.rencontre.clientId === null) {
    // A4 : aucun rattachement automatique. Sans client validé, P2 n'est pas
    // appelée ; « Compléter » la relancera après le rattachement.
    return {
      ecrire: async (tx) => {
        await deps.donnees.majEtat(tx, crId, { ...d.etat, rattachement: "en_attente_client" });
        return [{ etape: "consolider", compteRenduId: crId }];
      },
    };
  }
  const catalogue = await deps.catalogue();
  const refProjet = new Map(d.etat.correspondances.projets.map(([ref, id]) => [id, ref]));
  const projetsConnus = d.projets
    .filter((p) => refProjet.has(p.id))
    .map((p) => ({ ...p, ref: refProjet.get(p.id)! }));
  const connus = faitsConnusPourPasse(d);
  const { sortie } = await executerPasse(depsPasse(ctx), {
    passe: "rattacher",
    schema: SCHEMAS_VISIO.rattachement.schema,
    nomSchema: SCHEMAS_VISIO.rattachement.nom,
    instructions: instructionsDe("rattacher", catalogue.texte),
    entree: construireEntreeP2({
      projetsConnus,
      faitsConnus: connus,
      projetsEvoques: d.etat.projetsEvoques,
      faits,
    }),
    jobId: ctx.jobId,
  });
  const { rattachement, ecartees } = filtrerRattachement(sortie, {
    projetsConnus: new Set(projetsConnus.map((p) => p.ref)),
    evoques: new Set(d.etat.projetsEvoques.map((j) => j.ref)),
    faits: new Set(faits.map((f) => f.ref)),
  });
  return {
    ecrire: async (tx) => {
      await deps.donnees.majEtat(tx, crId, {
        ...d.etat,
        rattachement,
        compteurs: { ...d.etat.compteurs, rattachementsEcartes: ecartees },
      });
      return [{ etape: "consolider", compteRenduId: crId }];
    },
  };
};

// ── P3 ───────────────────────────────────────────────────────────────────────

export const consolider: Gestionnaire = async (ctx) => {
  const { deps } = ctx;
  const d = await chargerPasses(ctx);
  const crId = d.compteRenduId;
  const faits = d.faitsDuJour.filter((f) => f.statut !== "rejete").map(pourPasse);
  const connus = faitsConnusPourPasse(d);
  const perimetres =
    d.rencontre.clientId === null
      ? []
      : perimetresAConsolider({
          rattachement: typeof d.etat.rattachement === "object" ? d.etat.rattachement : null,
          correspondancesProjets: new Map(d.etat.correspondances.projets),
          projets: d.projets,
          faitsConnus: connus,
        });
  const resultats: EtatCompteRendu["consolidation"][number][] = [];
  let horsPerimetre = 0;
  if (perimetres.length > 0) {
    const catalogue = await deps.catalogue();
    for (const p of perimetres) {
      ctx.verifierArret();
      const e = construireEntreeP3(p, connus, faits);
      if (e.faitsDuJour.size === 0) continue;
      const { sortie } = await executerPasse(depsPasse(ctx), {
        passe: "consolider",
        schema: SCHEMAS_VISIO.consolidation.schema,
        nomSchema: SCHEMAS_VISIO.consolidation.nom,
        instructions: instructionsDe("consolider", catalogue.texte),
        entree: e.entree,
        jobId: `${ctx.jobId}-${p.projetId ?? "entreprise"}`,
      });
      const f = filtrerConsolidation(sortie, e);
      horsPerimetre += f.horsPerimetre;
      resultats.push({ perimetre: p.libelle, projetId: p.projetId, resultat: f.consolidation });
    }
  }
  return {
    ecrire: async (tx) => {
      await deps.donnees.majEtat(tx, crId, {
        ...d.etat,
        consolidation: resultats,
        compteurs: { ...d.etat.compteurs, relationsHorsPerimetre: horsPerimetre },
      });
      return [{ etape: "ebaucher", compteRenduId: crId }];
    },
  };
};

// ── P4 + C4 ──────────────────────────────────────────────────────────────────

export const ebaucher: Gestionnaire = async (ctx) => {
  const { deps } = ctx;
  const d = await chargerPasses(ctx);
  const crId = d.compteRenduId;
  const faits = d.faitsDuJour.filter((f) => f.statut !== "rejete").map(pourPasse);
  const aEbaucher = projetsAEbaucher(faits, d.etat.projetsEvoques);
  const connus = faitsConnusPourPasse(d);
  const ebauches: EtatCompteRendu["ebauches"][number][] = [];
  let lignesRetirees = 0;
  if (aEbaucher.length > 0) {
    const catalogue = await deps.catalogue();
    const rattachement = typeof d.etat.rattachement === "object" ? d.etat.rattachement : null;
    const projets = new Map(d.etat.correspondances.projets);
    for (const j of aEbaucher) {
      ctx.verifierArret();
      const decision = rattachement?.decisions.find(
        (x) => x.projet_evoque_ref === j.ref && x.decision === "projet_existant",
      );
      const projetId = decision?.projet_connu_ref
        ? (projets.get(decision.projet_connu_ref) ?? null)
        : null;
      const { sortie } = await executerPasse(depsPasse(ctx), {
        passe: "ebaucher",
        schema: SCHEMAS_VISIO.ebauche.schema,
        nomSchema: SCHEMAS_VISIO.ebauche.nom,
        instructions: instructionsDe("ebaucher", catalogue.texte),
        entree: construireEntreeP4(
          j,
          faits,
          connus.filter((f) => projetId !== null && f.projetId === projetId),
        ),
        jobId: `${ctx.jobId}-${j.ref}`,
      });
      const controle = controlerEbauche(sortie, catalogue.refs);
      // G14 : une ébauche qui parle d'argent est rejetée ENTIÈRE (nouvel essai).
      if (!controle.ok)
        throw new ErreurVisio("contenu", "sortie_invalide", "ébauche de devis avec un prix");
      lignesRetirees += controle.lignesRetirees;
      ebauches.push({
        projetRef: j.ref,
        ebauche: controle.ebauche,
        chiffrage: chiffrerEbauche(controle.ebauche.lignes, catalogue),
      });
    }
  }
  return {
    ecrire: async (tx) => {
      await deps.donnees.majEtat(tx, crId, {
        ...d.etat,
        ebauches,
        compteurs: { ...d.etat.compteurs, lignesDevisRetirees: lignesRetirees },
      });
      return [{ etape: "rediger", compteRenduId: crId }];
    },
  };
};

// ── P5 ───────────────────────────────────────────────────────────────────────

function entreeP5(
  d: DonneesPasses & { etat: EtatCompteRendu },
  faits: readonly FaitPourPasse[],
): string {
  const e = d.etat;
  const couverture = e.couverture ?? couvertureDesFaits(new Map(faits.map((f) => [f.ref, f.type])));
  const rattachement =
    e.rattachement === null || e.rattachement === "en_attente_client"
      ? "rencontre pas encore rattachée à une fiche : aucune proposition"
      : e.rattachement.decisions
          .map(
            (x) =>
              `${x.projet_evoque_ref} → ${x.decision}${x.projet_connu_ref ? ` ${x.projet_connu_ref}` : ""}${x.titre_propose ? ` « ${x.titre_propose} »` : ""}`,
          )
          .join(" · ") || "aucune proposition";
  return [
    `<echange>date : ${e.dateEchange.slice(0, 10)} · durée : ${Math.round(d.rencontre.dureeMs / 60000)} min · nature : ${e.natureEchange ?? "inconnue"}</echange>`,
    `<rattachement_propose>${rattachement}</rattachement_propose>`,
    `<couverture>\n${Object.entries(couverture)
      .map(([r, c]) => `${r} : ${c.statut}`)
      .join("\n")}\n</couverture>`,
    `<faits_verifies>\n${faits.map((f) => [f.ref, f.type, f.portee, f.projetRef ?? "—", f.enonce, f.valeur || "—", `dit par ${f.locuteur ?? "?"}`, `confiance ${f.confiance}`].join(" | ")).join("\n") || "aucun"}\n</faits_verifies>`,
    `<suivi_du_connu>${e.suivis.map((s) => `${s.connuRef} → ${s.statut}`).join(" · ") || "aucun"}</suivi_du_connu>`,
    `<consolidation>\n${e.consolidation.map((c) => `${c.perimetre} : ${c.resultat.relations.map((r) => `${r.fait_du_jour_ref} ${r.relation}${r.fait_existant_ref ? ` ${r.fait_existant_ref}` : ""}`).join(", ")}`).join("\n") || "aucune"}\n</consolidation>`,
    `<ebauche_chiffree>\n${e.ebauches.map((b) => `${b.projetRef} : ${b.chiffrage.lignes.map((l) => `${l.ref} × ${l.quantite} ${l.unite} (prix calculé par le site)`).join(" ; ")} · hypothèses : ${b.ebauche.hypotheses.join(" ; ") || "aucune"} · manquant : ${b.ebauche.manquant_pour_chiffrer.join(" ; ") || "rien"}`).join("\n") || "aucune"}\n</ebauche_chiffree>`,
    `<signaux_calcules>${e.signaux.join(" · ") || "aucun"}</signaux_calcules>`,
    "Rédige le compte rendu au format imposé.",
  ].join("\n");
}

export const rediger: Gestionnaire = async (ctx) => {
  const { deps, t } = ctx;
  const d = await chargerPasses(ctx);
  const faitsDuJour = d.faitsDuJour.filter((f) => f.statut !== "rejete" && f.statut !== "efface");
  const faits = faitsDuJour.map(pourPasse);
  const catalogue = await deps.catalogue();
  const { sortie, modele } = await executerPasse(depsPasse(ctx), {
    passe: "rediger",
    schema: SCHEMAS_VISIO.compteRendu.schema,
    nomSchema: SCHEMAS_VISIO.compteRendu.nom,
    instructions: instructionsDe("rediger", catalogue.texte),
    entree: entreeP5(d, faits),
    jobId: ctx.jobId,
  });
  // Réécriture d'un compte rendu vidé (retrait, effacement ciblé) : nouvelle version.
  const reecriture = d.statutCompteRendu === "a_regenerer" || d.statutCompteRendu === "valide";
  return {
    ecrire: async (tx) => {
      const etat: EtatCompteRendu = {
        ...d.etat,
        couverture:
          d.etat.couverture ?? couvertureDesFaits(new Map(faits.map((f) => [f.ref, f.type]))),
        redaction: sortie,
      };
      if (reecriture) {
        const nouveau = await deps.donnees.creerCompteRendu(tx, {
          rencontreId: t.rencontreId,
          transcriptionId: null,
          mode: "reecrire",
          modele,
          promptHash: empreinteDesConsignes(),
          schemaVersion: VERSION_SCHEMAS_COMPTE_RENDU,
          etat,
        });
        return [{ etape: "verifier_compte_rendu", compteRenduId: nouveau }];
      }
      await deps.donnees.majEtat(tx, d.compteRenduId, etat);
      return [{ etape: "verifier_compte_rendu", compteRenduId: d.compteRenduId }];
    },
  };
};

// ── V2 ───────────────────────────────────────────────────────────────────────

/** Au-delà : le compte rendu reste rejeté, une note manuelle est proposée. */
export const ESSAIS_REDACTION_MAX = 2;

export const verifierCompteRenduEtape: Gestionnaire = async (ctx) => {
  const { deps, t } = ctx;
  const d = await chargerPasses(ctx);
  if (d.etat.redaction === null) throw new ArretVisio("inconnu");
  const faits = d.faitsDuJour.filter((f) => f.statut !== "rejete" && f.statut !== "efface");
  const couverture =
    d.etat.couverture ?? couvertureDesFaits(new Map(faits.map((f) => [f.ref, f.type])));
  const pourRedaction = new Map<string, FaitPourRedaction>(
    faits.map((f) => [
      f.ref,
      { ref: f.ref, enonce: f.enonce, citation: f.citation, valeurs: f.valeurs },
    ]),
  );
  const montants = d.etat.ebauches.flatMap((b) =>
    b.chiffrage.lignes
      .flatMap((l) => [l.prixUnitaireHtCents, l.totalHtCents])
      .filter((x): x is number => x !== null)
      .map((c) => c / 100),
  );
  const bilan = verifierCompteRendu(d.etat.redaction, couverture, pourRedaction, montants);
  const essais = d.etat.essaisRedaction + 1;

  if (bilan.rejete) {
    if (essais >= ESSAIS_REDACTION_MAX) {
      await ctx.ecrireEnCours(async (tx) => {
        await deps.donnees.majEtat(
          tx,
          d.compteRenduId,
          etatSansTexteBrut({ ...d.etat, essaisRedaction: essais }),
        );
        await deps.donnees.rejeterCompteRendu(tx, d.compteRenduId);
      });
      throw new ArretVisio("sortie_invalide");
    }
    return {
      ecrire: async (tx) => {
        await deps.donnees.majEtat(tx, d.compteRenduId, {
          ...d.etat,
          redaction: null,
          essaisRedaction: essais,
        });
        return [{ etape: "rediger", compteRenduId: d.compteRenduId, reinitialiser: true }];
      },
    };
  }

  const document = {
    v: 1,
    redaction: bilan.compteRendu,
    couverture,
    ebauches: d.etat.ebauches.map((b) => ({
      projetRef: b.projetRef,
      chiffrage: b.chiffrage,
      hypotheses: b.ebauche.hypotheses,
      manquant: b.ebauche.manquant_pour_chiffrer,
      sansReference: b.ebauche.sans_reference,
    })),
    signaux: [
      ...d.etat.signaux,
      ...(bilan.retires > 0 ? [`paragraphes retirés à la vérification : ${bilan.retires}`] : []),
    ],
  };
  const etatFinal = etatSansTexteBrut({
    ...d.etat,
    couverture,
    essaisRedaction: essais,
    compteurs: {
      ...d.etat.compteurs,
      paragraphes: bilan.paragraphes,
      paragraphesRetires: bilan.retires,
    },
  });
  return {
    ecrire: async (tx) => {
      await deps.donnees.finaliserCompteRendu(tx, {
        compteRenduId: d.compteRenduId,
        rencontreId: t.rencontreId,
        contenu: JSON.stringify(document),
        etat: etatFinal,
        modele: null,
      });
      await deps.alerter({
        code: CODES_ALERTES_CIRCUIT.compteRenduAValider,
        niveau: "info",
        titre: "Un compte rendu de rendez-vous attend votre validation",
        message: "Ouvrez la page du rendez-vous pour le relire et le valider.",
        rencontreId: t.rencontreId,
      });
      return [];
    },
  };
};

export { faitsConnusPourPasse };
