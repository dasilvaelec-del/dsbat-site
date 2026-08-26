#!/usr/bin/env bash
# outils/publier-vers-public.sh — Synchronisation PRIVÉ → PUBLIC (D01)
# Copie UNIQUEMENT les 12 modules partagés non-secrets vers le dépôt public.
# N'inclut JAMAIS le catalogue (prix.js / pricing.js) ni les baselines de prix.
# Usage : ./outils/publier-vers-public.sh /chemin/vers/dsbat-site
set -euo pipefail
PUBLIC="${1:?chemin du dépôt public requis}"
FICHIERS=(
  js/modele-projet.js js/moteur-devis.js js/moteur-mode.js js/moteur-piece.js
  js/moteur-piece-complet.js js/moteur-revetements.js js/moteur-tva.js
  js/moteurs/peinture.js js/shadow.js js/tarifs-mode.js
  js/vue-tarifaire.js js/vue-tarifaire-data.js
)
for f in "${FICHIERS[@]}"; do
  case "$f" in
    *prix.js|*pricing.js|*moteur-prive*|*reference*|runtime/*)
      echo "REFUS : chemin sensible dans la liste blanche : $f" >&2; exit 2;;
  esac
  cp "$f" "$PUBLIC/$f"
done
echo "Publiés : ${#FICHIERS[@]} modules partagés (aucun secret)."
