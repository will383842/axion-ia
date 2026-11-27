# ADR 0077 — Cliquet de la console admin relevé de 600 à 602 KB

Date : 2026-11-27 · Statut : accepté

## Contexte
La PR #2375 ajoute un écran de console (`barometre-questionnaire` : liste et export des réponses du Baromètre). La somme des page chunks de la console admin passe à 600,03 KB brotli, pour un cliquet à 600 KB : Gate B échoue de 31 octets.

## Décision
Le cliquet « SOMME des page chunks de la CONSOLE ADMIN » passe de 600 à 602 KB. Ces écrans sont authentifiés et hors budget Web Vitals (aucune des 15 pages stratégiques n'est touchée) ; le cliquet reste un garde anti-croissance, la marge laissée est de 2 KB seulement.

## Conséquences
Aucun effet sur les pages publiques. Le prochain écran de console devra soit tenir dans ces 2 KB, soit faire l'objet d'un nouvel ADR.
