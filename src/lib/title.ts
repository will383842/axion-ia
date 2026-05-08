// Utilitaire partagé pour découper un titre en `lead` + `em` (em rendu en
// serif italique terracotta dans Section / display-editorial).
//
// Règle :
// 1. Si le titre contient « : » (FR) ou « : » (EN), on coupe au séparateur :
//    la partie après le « : » devient l'em (gold case « IA Custom : quand
//    est-ce vraiment nécessaire ? »).
// 2. Sinon on italicise les 2 derniers mots si le titre fait 4+ mots,
//    sinon le dernier mot. Cela donne une accroche sobre cohérente avec
//    le pattern /blog index `display-editorial` + serif italique.
//
// Initialement extrait de /blog/[slug]/page.tsx (commit 7b1a071) pour être
// réutilisable sur /cas-concrets/[slug], /faq/[slug], /comparaisons/[slug],
// et tout futur template de slug dont les titres viennent de la data.

export function splitTitleEm(title: string): { lead: string; em: string } {
  const colonFr = title.indexOf(" : ");
  if (colonFr > 0) {
    return { lead: title.slice(0, colonFr + 1), em: title.slice(colonFr + 3) };
  }
  const colonEn = title.indexOf(": ");
  if (colonEn > 0) {
    return { lead: title.slice(0, colonEn + 1), em: title.slice(colonEn + 2) };
  }
  const words = title.trim().split(/\s+/);
  if (words.length <= 2) return { lead: "", em: title };
  const emCount = words.length >= 4 ? 2 : 1;
  return {
    lead: words.slice(0, words.length - emCount).join(" "),
    em: words.slice(words.length - emCount).join(" "),
  };
}
