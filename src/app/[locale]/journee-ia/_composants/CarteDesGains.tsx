// La carte des gains du héros : « Votre entreprise, cartographiée ». Un exemple type, chiffré
// avec les jetons de `contenu.ts` (le gain est calculé, le prix lu dans `pricing.ts`).
// Composant serveur, aucun état. Les largeurs des barres sont des styles en ligne rendus par le
// serveur : elles ne dépendent d’aucun JS (en v3, une règle `.js … {width:0}` les laissait à 0).
// Seule animation : une pousse des barres en CSS (transform), éteinte sous reduced-motion.

import { remplacerJetons } from "@/content/journee-ia-commun";

import { CONTENU } from "../contenu";
import s from "../journee-ia.module.css";
import { Ruban } from "./Ruban";

export function CarteDesGains() {
  const c = CONTENU.accroche.carteDesGains;
  return (
    <figure className={s.carte} aria-labelledby="cg-titre">
      <figcaption className={s.legende}>
        <b id="cg-titre" className={s.titre}>
          {c.titre}
        </b>
        <span className={s.sous}>{c.sousTitre}</span>
      </figcaption>
      <ol className={s.lignes}>
        {c.lignes.map((l) => (
          <li key={l.libelle} className={`${s.ligne}${"plusGrosGain" in l ? ` ${s.haut}` : ""}`}>
            <span className={s.nom}>{l.libelle}</span>
            <span className={s.barre} aria-hidden="true">
              {/* Largeur posée ici, côté serveur : jamais d’animation ni de classe JS pour la lever. */}
              <i style={{ width: `${l.largeur}%` }} />
            </span>
            <span className={s.valeur}>{l.heures}</span>
            {"plusGrosGain" in l ? <span className={s.tag}>{l.plusGrosGain}</span> : null}
          </li>
        ))}
      </ol>
      <p className={s.total}>
        <span>{remplacerJetons(c.total.phrase)}</span>
        <span aria-hidden="true">=</span>
        <b>{remplacerJetons(c.total.montant)}</b>
        <span>{c.total.suite}</span>
      </p>
      <p className={s.prix}>
        {remplacerJetons(c.prix.avant)} <b>{remplacerJetons(c.prix.montant)}</b>
        {c.prix.apres}
      </p>
      <div className={s["ruban-bloc"]}>
        <Ruban />
      </div>
    </figure>
  );
}
