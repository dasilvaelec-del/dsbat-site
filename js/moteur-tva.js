// =====================================================================
// js/moteur-tva.js — Règle fiscale : taux et libellé de TVA — MISSION A04 (Phase 2)
// =====================================================================
// Déplacé VERBATIM depuis devis-configurateur.html. AUCUNE logique modifiée.
// Fonctions PURES au sens DOM (aucun accès HTML). Dépendance résolue à l'APPEL :
// la globale `chantier`. Chargé comme <script src> (script classique) : tauxTVA
// et labelTVA restent globaux et accessibles depuis le script inline et moteur-devis.js.
// =====================================================================

function tauxTVA() {
  const ch = chantier || {};
  // Locaux non-habitation (commercial / bureau) -> 20 %
  if (ch.typeBien === 'local') return 0.20;
  // Construction neuve ou extension/agrandissement -> 20 %
  if (ch.typeProjet === 'neuf' || ch.typeProjet === 'extension') return 0.20;
  // Rénovation d'un logement de + de 2 ans -> 10 %
  return 0.10;
}
function labelTVA() {
  return tauxTVA() === 0.20 ? 'TVA 20 % (neuf / extension / local pro)' : 'TVA 10 % (rénovation logement)';
}

// Export Node (tests) + exposition navigateur (globaux pour les scripts classiques).
if (typeof module !== 'undefined' && module.exports) module.exports = { tauxTVA, labelTVA };
