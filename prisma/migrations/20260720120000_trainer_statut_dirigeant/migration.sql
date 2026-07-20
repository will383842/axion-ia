-- Statut formateur « dirigeant » : l'OF lui-même anime des formations.
-- Ni salarié (aucun contrat de travail requis), ni sous-traitant (aucune vigilance
-- URSSAF ni RC pro requise). Compétences justifiées par CV + diplômes (indicateur 21) ;
-- compté « interne » au BPF, comme un salarié.
-- Migration ADDITIVE : ADD VALUE sur un enum PG (sûr, valeur non utilisée dans la même migration).
ALTER TYPE "TrainerStatut" ADD VALUE 'dirigeant';
