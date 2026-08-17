/**
 * Lot 1ter §2 + §5 — QUELLES PIÈCES CETTE SESSION APPELLE-T-ELLE ? Module PUR.
 *
 * ## Le constat vécu
 *
 * 🔴 Sur ~20 boutons du bloc Documents, **cinq seulement** concernaient une
 * session en financement **direct entreprise**. Étaient proposés sans objet :
 * Kit OPCO, Convention tripartite OPCO, Kit CPF/EDOF, Kit France Travail,
 * Contrat de formation (particulier).
 *
 * **Le bruit n'est pas neutre : il produit des pièces à annuler.** Sur le
 * premier dossier réel, une « Lettre de mission formateur » a dû être ANNULÉE
 * au registre — le dirigeant-formateur ne peut pas se confier une mission à
 * lui-même, et l'écran la proposait quand même.
 *
 * ## 🔴 PARTICULIER ≠ PROFESSIONNEL — ce n'est pas de l'ergonomie
 *
 * Pour un **particulier** (personne physique se formant à titre individuel et à
 * ses frais), la pièce contractuelle n'est PAS une convention L.6353-1 mais un
 * **contrat de formation professionnelle L.6353-3**. Proposer « Convention de
 * formation » à un particulier, c'est proposer la mauvaise pièce — pas un
 * libellé maladroit.
 *
 * ⚠️ La bascule se joue sur **QUI PAIE**, pas sur qui suit la formation. Un
 * salarié envoyé par son employeur relève du régime entreprise : c'est
 * l'employeur qui contracte.
 *
 * ## Ce que ce module ne fait PAS
 *
 * Il **ne supprime rien**. Il classe : `attendue` (à produire pour ce dossier),
 * `possible` (légitime mais hors du cas courant), `sans_objet` (n'a aucun sens
 * ici). L'écran met les `attendue` en avant et replie le reste derrière
 * « Autres pièces ».
 *
 * 🔴 Masquer DUR serait un défaut à son tour : un dossier atypique existe, et
 * un bouton introuvable enverrait quelqu'un contourner l'outil. On réduit le
 * bruit, on ne condamne pas la porte.
 */

/** Financement de la session. Reprend l'enum `FinancementType`. */
export type Financement = "direct" | "opco" | "cpf" | "france_travail" | "mixte";

/** Qui contracte. Reprend l'enum `ClientType`. */
export type TypeClient = "entreprise" | "particulier";

export type Pertinence =
  /** Ce dossier l'appelle. Mise en avant. */
  | "attendue"
  /** Légitime, mais hors du cas courant. Repliée sous « Autres pièces ». */
  | "possible"
  /** N'a aucun sens ici — elle ne doit pas être proposée au premier plan. */
  | "sans_objet";

export interface ContexteSession {
  readonly financement: Financement | null;
  readonly typeClient: TypeClient | null;
  /** `planifiee` · `en_cours` · `realisee` · `annulee` · `reportee`. */
  readonly statut: string;
  /**
   * Le formateur principal est-il le dirigeant de l'organisme ?
   *
   * 🔴 Cas réel : une lettre de mission a dû être ANNULÉE au registre parce que
   * le dirigeant-formateur se la confiait à lui-même. Une mission suppose deux
   * personnes ; quand il n'y en a qu'une, la pièce n'a pas d'objet.
   */
  readonly formateurEstLeDirigeant?: boolean;
}

/**
 * La pertinence d'un type de pièce pour ce dossier.
 *
 * ⚠️ Le défaut est `possible`, pas `sans_objet`. Un type inconnu de ce module
 * reste donc proposé, simplement replié : c'est l'inverse du choix fait pour la
 * remise au bénéficiaire (`piece-remise.ts`, défaut `jamais`), et c'est
 * délibéré. Là-bas, le risque est de MONTRER ce qu'il ne fallait pas — ici, le
 * risque est d'EMPÊCHER un geste légitime. Le défaut protège du pire des deux.
 */
export function pertinencePiece(type: string, ctx: ContexteSession): Pertinence {
  // ── Kits financeurs : un seul circuit à la fois ──────────────────────────
  if (type === "kit_opco" || type === "convention_tripartite") {
    return ctx.financement === "opco" || ctx.financement === "mixte" ? "attendue" : "sans_objet";
  }
  if (type === "kit_cpf") {
    return ctx.financement === "cpf" || ctx.financement === "mixte" ? "attendue" : "sans_objet";
  }
  if (type === "kit_france_travail") {
    return ctx.financement === "france_travail" || ctx.financement === "mixte"
      ? "attendue"
      : "sans_objet";
  }

  // ── 🔴 La pièce contractuelle dépend de QUI CONTRACTE ────────────────────
  if (type === "convention") {
    // Un particulier ne signe pas une convention L.6353-1 : il signe un contrat
    // L.6353-3. Proposer la convention, c'est proposer la mauvaise pièce.
    return ctx.typeClient === "particulier" ? "sans_objet" : "attendue";
  }
  if (type === "contrat") {
    return ctx.typeClient === "particulier" ? "attendue" : "sans_objet";
  }

  // ── Lettre de mission : elle suppose DEUX personnes ──────────────────────
  if (type === "lettre_mission") {
    return ctx.formateurEstLeDirigeant === true ? "sans_objet" : "possible";
  }

  // ── Pièces d'après-séance : proposées quand la séance a eu lieu ──────────
  if (
    type === "attestation" ||
    type === "attestation_partielle" ||
    type === "certificat_realisation" ||
    type === "releve_connexion"
  ) {
    return ctx.statut === "realisee" ? "attendue" : "possible";
  }

  // ── Le socle : toute session en a besoin, quel que soit le financement ───
  if (
    type === "programme" ||
    type === "organisation_action" ||
    type === "reglement_interieur" ||
    type === "livret_accueil" ||
    type === "convocation" ||
    type === "emargement" ||
    type === "positionnement" ||
    type === "satisfaction" ||
    type === "grille_evaluation"
  ) {
    return "attendue";
  }

  return "possible";
}

/**
 * Faut-il mettre cette pièce EN AVANT ?
 *
 * Le seul prédicat que l'écran consomme. `sans_objet` et `possible` partent
 * toutes deux sous « Autres pièces » — la distinction sert au libellé et aux
 * tests, pas à la mise en page.
 */
export function pieceMiseEnAvant(type: string, ctx: ContexteSession): boolean {
  return pertinencePiece(type, ctx) === "attendue";
}

/**
 * Pourquoi cette pièce est repliée. Rendu au survol / en aide.
 *
 * 🔴 Une pièce reléguée sans explication ressemble à une pièce oubliée. Dire
 * pourquoi transforme le repli en information — et c'est ce qui distingue une
 * console qui guide d'une console qui cache.
 */
export function motifRepli(type: string, ctx: ContexteSession): string | null {
  const p = pertinencePiece(type, ctx);
  if (p === "attendue") return null;
  if (p === "possible") return "Hors du cas courant pour ce dossier — reste disponible.";

  if (type === "kit_opco" || type === "convention_tripartite") {
    return `Aucun financement OPCO sur cette session (${ctx.financement ?? "non renseigné"}).`;
  }
  if (type === "kit_cpf") return "Cette session n'est pas financée par le CPF.";
  if (type === "kit_france_travail") return "Cette session n'est pas financée par France Travail.";
  if (type === "convention") {
    return "Client particulier : la pièce contractuelle est un contrat de formation (L.6353-3), pas une convention.";
  }
  if (type === "contrat") {
    return "Client professionnel : la pièce contractuelle est une convention de formation (L.6353-1).";
  }
  if (type === "lettre_mission") {
    return "Le formateur est le dirigeant de l'organisme : une mission suppose deux personnes.";
  }
  return "Sans objet pour ce dossier.";
}
