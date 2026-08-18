/**
 * 🔴 CE QUE L'ÉCRAN DIT APRÈS UN EXPORT DE DOSSIER — module PUR.
 *
 * ## Le défaut
 *
 * Les deux messages les plus importants de la console partaient dans un
 * `window.alert` :
 *
 *   · « N chaînes de signatures présentent une ANOMALIE D'INTÉGRITÉ — ouvrez
 *     verification-integrite.json AVANT de remettre ce dossier à un auditeur » ;
 *   · « dossier INCOMPLET », suivi de la **liste** des avertissements.
 *
 * Or `window.alert` est le pire véhicule possible pour ces deux-là :
 *
 *   1. **Non copiable.** Le message nomme un fichier à ouvrir dans le ZIP et
 *      énumère des manques. On ne peut ni le coller dans une note, ni le
 *      relire : il disparaît au premier clic.
 *   2. **Non persistant.** Il s'efface, et le ZIP — lui — est déjà téléchargé.
 *      Le dossier part chez l'auditeur avec son anomalie, et l'avertissement
 *      n'existe plus nulle part.
 *   3. **Il gèle l'automatisation.** Un `alert()` bloque tout événement
 *      navigateur : aucun test Playwright ne peut traverser cet écran.
 *
 * ## Ce que ce module décide
 *
 * Uniquement le CONTENU et la GRAVITÉ du message. Le rendu appartient à
 * l'écran — et le rendu, lui, doit être une zone `role="alert"` qui **reste**.
 */

export type TonVerdict = "succes" | "attention" | "danger";

export interface VerdictExport {
  readonly ton: TonVerdict;
  readonly titre: string;
  /** Lignes du corps. Une liste, parce qu'il y en a souvent plusieurs. */
  readonly details: ReadonlyArray<string>;
  /** Fichier du ZIP à ouvrir, quand il y en a un à nommer. */
  readonly fichierAConsulter: string | null;
}

export interface EtatDossier {
  readonly incomplet: boolean;
  readonly nbChainesAnormales: number;
  readonly nbChainesContresignAnormales: number;
  readonly avertissements: ReadonlyArray<string>;
  readonly nomFichier: string;
}

export function verdictExport(e: EtatDossier): VerdictExport {
  // 🔴 L'anomalie d'intégrité passe AVANT tout le reste : c'est la seule qui
  // signifie « une signature a été modifiée après avoir été apposée ». Une
  // contresignature FORMATEUR falsifiée compte autant (exigée, CAA Nantes
  // 20/04/2021) — d'où la somme des deux compteurs.
  const anomalies = e.nbChainesAnormales + e.nbChainesContresignAnormales;
  if (anomalies > 0) {
    const s = anomalies > 1 ? "s" : "";
    return {
      ton: "danger",
      titre: `${anomalies} chaîne${s} de signatures présente${s} une ANOMALIE D'INTÉGRITÉ`,
      details: [
        "Une empreinte qui ne concorde pas signifie qu'une signature a été modifiée après avoir été apposée.",
        "Le ZIP est téléchargé : ouvrez le fichier de vérification AVANT de remettre ce dossier à un auditeur.",
      ],
      fichierAConsulter: "verification-integrite.json",
    };
  }

  if (e.incomplet) {
    return {
      ton: "attention",
      titre: "Dossier INCOMPLET",
      // ⚠️ Les avertissements sont relayés TELS QUELS. Les résumer en « des
      // pièces manquent » ferait perdre ce qui manque — et c'est précisément
      // la seule information utile.
      details:
        e.avertissements.length > 0
          ? [...e.avertissements]
          : ["Le détail des manques figure dans « index.txt »."],
      fichierAConsulter: "index.txt",
    };
  }

  return {
    ton: "succes",
    titre: `Dossier d'audit téléchargé : ${e.nomFichier}`,
    details: [],
    fichierAConsulter: null,
  };
}
