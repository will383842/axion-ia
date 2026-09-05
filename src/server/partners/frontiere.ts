/**
 * frontiere.ts — REQ-INT-029 : ce qui ne franchit JAMAIS la frontière axionia → Partners.
 *
 * ⚠️ CE FICHIER EST UNE TRANSCRIPTION, ET C'EST UNE DETTE NOMMÉE. La source de la
 * frontière est `packages/contracts/events.ts` d'Axion Partners (`FRONTIERE_INTERDITE`,
 * `champsInterdits`). Contrairement à l'énumération des types et aux champs de
 * l'enveloppe — que `contrat.ts` LIT dans la copie `contracts.v1.json` —, la frontière
 * n'est portée par AUCUN des deux artefacts que `pnpm contracts:export` publie : un JSON
 * Schema ne sait pas exprimer « aucune clé ne ressemble à une adresse ».
 *
 * Il n'y a donc rien à dériver ici, et RM-01 est enfreinte faute de source dérivable.
 * Le geste qui la répare n'est pas dans ce dépôt : il faut que l'exportateur de Partners
 * publie un TROISIÈME artefact (`frontiere.v1.json` : les trois familles, leurs motifs et
 * les types visés), qu'axionia copierait comme il copie déjà le schéma. Tant que ce
 * n'est pas fait, ce fichier est tenu par ses contre-témoins, pas par une empreinte —
 * et les deux dépôts peuvent diverger en silence. C'est écrit ici plutôt que tu.
 *
 * 🔑 Une garde de confidentialité échoue FERMÉ : elle préfère un faux positif, qu'un
 * humain lève en une ligne, à une coordonnée qui passe sans que personne ne la voie.
 */

/** Les types d'AVANT-signature — les seuls dont REQ-INT-029 exclut tout montant. */
const TYPES_AVANT_SIGNATURE: readonly string[] = ["client.cree", "client.mis_a_jour"];

export type FamilleInterdite = {
  readonly famille: string;
  /** Le fragment de REQ-INT-029 dont la famille est la transcription. */
  readonly exigence: string;
  /** Les types visés. Vide = tous. */
  readonly types: readonly string[];
  readonly motifCle: RegExp;
  /** Appliqué à la VALEUR quand elle est une chaîne. `null` = on ne la regarde pas. */
  readonly motifValeur: RegExp | null;
};

export const FRONTIERE_INTERDITE: readonly FamilleInterdite[] = [
  {
    famille: "montant_avant_signature",
    exigence: "les montants négociés avant `devis.signe`",
    // APRÈS la signature les montants traversent — REQ-INT-005 et REQ-INT-006 les
    // EXIGENT. Porter cette famille sur tous les types ferait rougir le contrat sur ce
    // que deux autres exigences imposent.
    types: TYPES_AVANT_SIGNATURE,
    motifCle: /cents$|^montant|^prix|^tarif|^remise|^rabais|negoci/i,
    motifValeur: null,
  },
  {
    famille: "identite_autre_apporteur",
    exigence: "l'identité des autres apporteurs",
    types: [],
    motifCle: /apporteur|parrain|filleul/i,
    motifValeur: null,
  },
  {
    famille: "coordonnees_du_contact",
    exigence: "les coordonnées chiffrées du contact rencontré",
    types: [],
    // La même liste que REQ-DM-041 refuse au journal. Un champ « chiffré » n'est pas une
    // exception : chiffré, il traverse quand même.
    motifCle: /mail|telephone|^tel$|nom$|prenom|adresse|iban|^bic$|chiffre/i,
    // NON ANCRÉ : « rencontré jean@exemple.fr sur place » franchit la frontière
    // exactement comme une valeur qui ne serait QUE l'adresse.
    motifValeur: /[^\s@,;:<>()"']+@[^\s@,;:<>()"']+\.[a-z]{2,}/i,
  },
];

/**
 * L'ARBITRAGE QU'INT-T01a A LAISSÉ À CETTE TÂCHE, tranché et borné.
 *
 * `packages/contracts/events.ts` l'écrit noir sur blanc : « le payload de
 * `candidature.recue`, que REQ-INT-032 décrit avec un champ `parrainCodeCapture`, ferait
 * rougir cette famille. […] l'arbitrage — un code de parrainage n'est pas une identité,
 * ou bien il l'est — revient à INT-T01b, qui devra soit resserrer le motif, soit déclarer
 * l'exemption avec l'exigence qui la porte. »
 *
 * 🔑 CE N'EST PAS LE MOTIF QU'ON RESSERRE, C'EST L'EXEMPTION QU'ON NOMME. Resserrer
 * `/apporteur|parrain|filleul/i` rouvrirait la frontière pour TOUS les champs à venir
 * dont personne n'a encore eu l'idée. Une garde lexicale trop étroite laisse passer ce
 * pour quoi elle avait été écrite, et personne ne s'en aperçoit — c'est le mode d'échec
 * le plus coûteux d'une frontière de confidentialité.
 *
 * CE QUE LA FRONTIÈRE PROTÈGE, ET POURQUOI CE CHAMP N'EST PAS DEDANS. REQ-INT-029 vise
 * « l'identité des AUTRES apporteurs » : le risque est qu'un apporteur apprenne qui sont
 * ses pairs. Un code de parrainage saisi par un CANDIDAT est le seul lien qui rattache
 * ce candidat à son parrain, et c'est précisément ce que REQ-INT-032 demande de
 * transporter (« sans `candidature.recue`, aucun apporteur n'existe jamais dans
 * Partners »). Le supprimer ne protégerait personne : Partners connaît déjà tous ses
 * apporteurs, et sans ce code la filiation se perdrait sans qu'aucune console ne le
 * dise. Ce n'est pas une identité, c'est une RÉFÉRENCE opaque — et l'exemption s'arrête
 * là : `parrainNom`, `parrainEmail`, `autreApporteurId` restent refusés.
 *
 * L'exemption est donc NOMINATIVE (une feuille, pas un motif), TYPÉE (un seul type
 * d'événement) et VÉRIFIÉE (la valeur doit avoir la forme d'un code, jamais celle d'une
 * adresse ou d'un nom). Ses trois bornes sont chacune éprouvées par un contre-témoin.
 */
export const EXEMPTIONS_NOMMEES: readonly {
  readonly famille: string;
  readonly type: string;
  readonly feuille: string;
  readonly exigence: string;
  /** La forme que la valeur DOIT avoir pour que l'exemption s'applique. */
  readonly formeAttendue: RegExp;
}[] = [
  {
    famille: "identite_autre_apporteur",
    type: "candidature.recue",
    feuille: "parrainCodeCapture",
    exigence: "REQ-INT-032",
    // Un code de parrainage : capitales, chiffres et tirets. Ni espace (un nom), ni
    // arobase (une adresse). Une valeur hors de cette forme n'est PAS exemptée —
    // l'exemption ne couvre pas un CHAMP, elle couvre une valeur de code.
    formeAttendue: /^[A-Z0-9][A-Z0-9-]{2,31}$/,
  },
];

export type ChampInterdit = { famille: string; chemin: string };

type Noeud = { chemin: string; cle: string; valeur: unknown };

/**
 * Les feuilles d'une valeur JSON, avec leur chemin pointé.
 *
 * ⚠️ CHAQUE ÉLÉMENT DE TABLEAU EST UN NŒUD, primitifs compris. Une récursion qui ne
 * pousse de nœud que depuis `Object.entries` descend bien dans les tableaux mais
 * n'inspecte JAMAIS un primitif qui s'y trouve : `contacts: ["jean@exemple.fr"]`
 * passait. La frontière échouait OUVERT sur la forme la plus banale d'une fuite — une
 * liste de contacts. (Défaut trouvé côté Partners sur la PR 28 ; transcrit ici corrigé.)
 *
 * L'élément HÉRITE de la clé de son tableau — `contacts[0]` porte la clé `contacts` —,
 * sans quoi `motifCle` cesserait de s'appliquer dès qu'une valeur entre dans une liste.
 */
function feuilles(valeur: unknown, chemin: string, acc: Noeud[], cleHeritee = ""): void {
  if (Array.isArray(valeur)) {
    valeur.forEach((v, i) => {
      const sous = `${chemin}[${i}]`;
      acc.push({ chemin: sous, cle: cleHeritee, valeur: v });
      feuilles(v, sous, acc, cleHeritee);
    });
    return;
  }
  if (valeur !== null && typeof valeur === "object") {
    for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) {
      const sous = chemin === "" ? cle : `${chemin}.${cle}`;
      acc.push({ chemin: sous, cle, valeur: v });
      feuilles(v, sous, acc, cle);
    }
    return;
  }
}

/** Le dernier segment d'un chemin pointé, sans son indice de tableau. */
function feuilleDuChemin(chemin: string): string {
  const sansIndice = chemin.replace(/\[\d+\]$/, "");
  const segments = sansIndice.split(".");
  return segments[segments.length - 1] ?? sansIndice;
}

function estExempte(famille: string, type: string, noeud: Noeud): boolean {
  return EXEMPTIONS_NOMMEES.some(
    (e) =>
      e.famille === famille &&
      e.type === type &&
      e.feuille === feuilleDuChemin(noeud.chemin) &&
      // `null` est exempté : c'est l'ABSENCE de valeur, elle ne révèle rien. Toute autre
      // valeur doit avoir la forme d'un code — un nom ou une adresse glissés dans ce
      // champ ne sont pas couverts par l'exemption et ressortent interdits.
      (noeud.valeur === null ||
        (typeof noeud.valeur === "string" && e.formeAttendue.test(noeud.valeur))),
  );
}

/**
 * Les champs d'un PAYLOAD qui n'auraient pas dû franchir la frontière, pour un type donné.
 *
 * ⚠️ Cette fonction inspecte un payload NU, pas une enveloppe. Côté Partners,
 * `champsInterdits()` prend l'événement entier et regarde AUSSI `subject_ref` : les deux
 * traversent, et une coordonnée glissée dans la référence de sujet traverse tout autant.
 * Ici l'appelant est le constructeur de payload, qui ne connaît pas encore l'enveloppe ;
 * `champsInterditsDuSujet()` ci-dessous couvre le second emplacement.
 */
export function champsInterditsSelonFrontiere(type: string, payload: unknown): ChampInterdit[] {
  const noeuds: Noeud[] = [{ chemin: "payload", cle: "payload", valeur: payload }];
  feuilles(payload, "payload", noeuds, "payload");

  const trouves: ChampInterdit[] = [];
  for (const famille of FRONTIERE_INTERDITE) {
    if (famille.types.length > 0 && !famille.types.includes(type)) continue;
    for (const noeud of noeuds) {
      const parLaCle = famille.motifCle.test(noeud.cle);
      const parLaValeur =
        famille.motifValeur !== null &&
        typeof noeud.valeur === "string" &&
        famille.motifValeur.test(noeud.valeur);
      if (!parLaCle && !parLaValeur) continue;
      if (estExempte(famille.famille, type, noeud)) continue;
      trouves.push({ famille: famille.famille, chemin: noeud.chemin });
    }
  }
  return trouves;
}

/**
 * La MÊME frontière, appliquée à `subject_ref`.
 *
 * `subject_ref` est la seule valeur du contrat dont la forme n'est pas arrêtée en v1 :
 * une chaîne libre y passe sans aucune clé pour la trahir. On regarde donc la valeur de
 * la racine elle-même, pas seulement ses descendants.
 */
export function champsInterditsDuSujet(type: string, sujet: unknown): ChampInterdit[] {
  return champsInterditsSelonFrontiere(type, sujet).map((c) => ({
    famille: c.famille,
    chemin: c.chemin.replace(/^payload/, "subject_ref"),
  }));
}
