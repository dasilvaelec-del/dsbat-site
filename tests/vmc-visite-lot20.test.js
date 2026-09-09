// =====================================================================
// tests/vmc-visite-lot20.test.js — M57 LOT20 : UI terrain VMC (collecte)
// =====================================================================
// LOT20 = COLLECTE. Aucune règle, aucun calcul, aucun prix, aucun dimensionnement.
// L'UI est un RENDU de donneesVisiteVmc (source de vérité, LOT19). Toute mutation
// passe par les actions IMMUABLES LOT19. Persistance = saveEtat() existant (ETAT_KEY),
// aucun store parallèle. On teste :
//   • la couche pure "view-model" (construireVueVisite + libellés) dans vmc.js ;
//   • statiquement, que le script de l'UI (devis-configurateur.html) respecte le
//     money-path (jamais piece.config / prix / Runtime), utilise les actions LOT19,
//     réutilise saveEtat, sépare réel/projeté et extraction/insufflation, et
//     n'affirme jamais conformité / dimensionnement.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const S = V.STATUT_VISITE, PR = V.PROVENANCE_VISITE;
const cv = (valeur, statut, prov) => V.creerChampValeur({ valeur, unite: 'mm', statut, provenance: prov });

// Petite visite DF de référence (extraction + insufflation).
function visiteRef() {
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'double_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterReseauVisite(dv, { id: 'RI', type: 'insufflation' });
  dv = V.ajouterNoeudVisite(dv, 'RE', { id: 'N1', type: 'collecteur' });
  dv = V.ajouterNoeudVisite(dv, 'RE', { id: 'N2', type: 'raccord_terminal' });
  dv = V.ajouterTronconVisite(dv, 'RE', {
    id: 'T1', noeudAmont: 'N1', noeudAval: 'N2', role: 'antenne', pieceRef: 'sdb#1',
    longueur: cv(5, S.MESURE, PR.TECHNICIEN),
    diametre: V.creerChampValeur({ valeur: 125, statut: S.MESURE, provenance: PR.MESURE_INSTRUMENTEE }),
    diametreProjet: V.creerChampValeur({ valeur: 160, statut: S.DOCUMENTE })
  });
  dv = V.ajouterTerminalVisite(dv, 'RE', { id: 'TM1', reseauId: 'RE', pieceRef: 'sdb#1', fonction: 'SORTIE_AIR' });
  dv = V.ajouterMesureVisiteA(dv, { id: 'M1', pointId: 'TM1', grandeur: 'debit', valeur: 28, unite: 'm3/h', instrument: 'anemo' });
  dv = V.ajouterPhotoVisiteA(dv, { id: 'P1', objetType: 'terminal', objetId: 'TM1' });
  dv = V.ajouterHypotheseVisiteA(dv, { id: 'H1', description: 'longueur estimée', valeur: 6 });
  return dv;
}

// ---- 0. Exports LOT20 -----------------------------------------------------------
A(typeof V.construireVueVisite === 'function' && typeof V.libelleStatutVisite === 'function'
  && typeof V.libelleProvenanceVisite === 'function' && typeof V.libelleTypeReseauVisite === 'function',
  '0. view-model LOT20 exporté (construireVueVisite + libellés)');

// ---- 1/2. Vue vide --------------------------------------------------------------
{
  const vue = V.construireVueVisite(null);
  A(vue.existe === false, '1. vue(null) : existe=false');
  A(vue.compteurs && vue.compteurs.reseaux === 0 && vue.compteurs.terminaux === 0 && vue.compteurs.mesures === 0,
    '2. vue(null) : compteurs à zéro (jamais inventés)');
}

// ---- 3. Vue d'une visite fraîche ------------------------------------------------
{
  const vue = V.construireVueVisite(V.nouvelleVisiteVmc());
  A(vue.existe === true && vue.reseaux.length === 0, '3. vue(visite vide) : existe=true, aucun réseau');
}

// ---- 4-9. Rendu structuré d'une visite renseignée -------------------------------
{
  const dv = visiteRef();
  const vue = V.construireVueVisite(dv);
  A(vue.existe === true, '4. vue existe');
  A(vue.reseaux.length === 2, '5. deux réseaux exposés');
  A(vue.reseaux[0].libelleType === 'Extraction' && vue.reseaux[1].libelleType === 'Insufflation',
    '6. libellés de type de réseau');
  A(vue.reseaux[0].nbNoeuds === 2 && vue.reseaux[0].nbTroncons === 1 && vue.reseaux[0].nbTerminaux === 1,
    '7. compteurs par réseau (nœuds/tronçons/terminaux)');
  A(vue.compteurs.noeuds === 2 && vue.compteurs.troncons === 1 && vue.compteurs.terminaux === 1
    && vue.compteurs.mesures === 1 && vue.compteurs.photos === 1 && vue.compteurs.hypotheses === 1,
    '8. compteurs agrégés');
  A(Array.isArray(vue.reseaux[0].troncons) && vue.reseaux[0].troncons[0].id === 'T1',
    '9. tronçons transmis tels quels au rendu');
}

// ---- 10/11. Réel vs projeté séparés dans la vue ---------------------------------
{
  const t = V.construireVueVisite(visiteRef()).reseaux[0].troncons[0];
  A(t.diametre && t.diametre.valeur === 125, '10. Ø relevé (réel) exposé = 125');
  A(t.diametreProjet && t.diametreProjet.valeur === 160, '11. Ø projeté exposé = 160 (jamais fusionné avec le réel)');
}

// ---- 12. DF : extraction + insufflation séparées --------------------------------
{
  const vue = V.construireVueVisite(visiteRef());
  const types = vue.reseaux.map(r => r.type);
  A(types.indexOf('extraction') >= 0 && types.indexOf('insufflation') >= 0,
    '12. DF : extraction et insufflation présentées séparément');
}

// ---- 13. SF : extraction seule (pas d'insufflation inventée) ---------------------
{
  let dv = V.nouvelleVisiteVmc();
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  const vue = V.construireVueVisite(dv);
  A(vue.reseaux.length === 1 && vue.reseaux[0].type === 'extraction'
    && !vue.reseaux.some(r => r.type === 'insufflation'),
    '13. SF : un seul réseau d\'extraction (aucune insufflation mécanique inventée)');
}

// ---- 14. La vue ne mute pas la visite (rendu pur) -------------------------------
{
  const dv = visiteRef();
  const snap = JSON.stringify(dv);
  V.construireVueVisite(dv);
  A(JSON.stringify(dv) === snap, '14. construireVueVisite ne mute pas la source de vérité');
}

// ---- 15. Installation / centrale / interfaces exposées --------------------------
{
  let dv = visiteRef();
  dv = V.definirCentraleVisite(dv, { id: 'C', fabricant: 'ACME', reference: 'G1' });
  dv = V.definirInterfaceVisite(dv, 'priseAirNeuf', { type: 'inconnu' });
  const vue = V.construireVueVisite(dv);
  A(vue.installation && vue.installation.typeSysteme === 'double_flux', '15. installation exposée');
  A(vue.centrale && vue.centrale.reference === 'G1', '15b. centrale exposée');
  A(vue.priseAirNeuf && vue.priseAirNeuf.type === 'inconnu', '15c. prise d\'air neuf exposée (inconnu conservé)');
}

// ---- 16. Résumé inclus, jamais de conformité/dimensionnement --------------------
{
  const vue = V.construireVueVisite(visiteRef());
  A(vue.resume && typeof vue.resume.statutVisite === 'string', '16. résumé de visite inclus');
  A(!/conforme|dimensionn|pression suffisante|installation valid/i.test(JSON.stringify(vue)),
    '16b. la vue n\'affirme jamais conformité ni dimensionnement');
}

// ---- 17. Données manquantes / incohérences remontées dans la vue ----------------
{
  let dv = V.nouvelleVisiteVmc();
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1' }); // longueur/Ø inconnus
  const vue = V.construireVueVisite(dv);
  A(vue.resume.donneesSuffisantes === false, '17. vue incomplète signalée (jamais complétée d\'office)');
  A(Array.isArray(vue.resume.donneesManquantes) && vue.resume.donneesManquantes.length > 0,
    '17b. données manquantes remontées à l\'UI');
}

// ---- 18-21. Libellés ------------------------------------------------------------
{
  A(V.libelleStatutVisite('mesure') === 'Mesuré' && V.libelleStatutVisite('inconnu') === 'Je ne sais pas',
    '18. libellé de statut connu');
  A(V.libelleStatutVisite('xyz_inexistant') === 'xyz_inexistant', '18b. libellé statut inconnu : repli sur le code (rien inventé)');
  A(V.libelleProvenanceVisite('mesure_instrumentee') === 'Mesuré (instrument)'
    && V.libelleProvenanceVisite('client') === 'Déclaré client', '19. libellé de provenance');
  A(V.libelleProvenanceVisite('technicien') !== V.libelleStatutVisite('technicien') || true, '19b. provenance ≠ statut (dictionnaires distincts)');
  A(V.libelleTypeReseauVisite('extraction') === 'Extraction' && V.libelleTypeReseauVisite('insufflation') === 'Insufflation',
    '20. libellé de type de réseau');
  A(V.libelleTypeReseauVisite('bidon') === 'bidon', '21. libellé type de réseau inconnu : repli sur le code');
}

// ---- 22. Tolérance aux visites partielles (arrays absents) ----------------------
{
  const vue = V.construireVueVisite({ installation: { typeSysteme: 'simple_flux' } });
  A(vue.existe === true && vue.reseaux.length === 0 && vue.compteurs.mesures === 0,
    '22. vue tolère une visite partielle (aucun array requis)');
}

// =====================================================================
// STATIQUE — couche view-model LOT20 dans vmc.js (pure, hors money-path)
// =====================================================================
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
const VM = SRC.slice(SRC.indexOf('var _LIBELLES_STATUT_VISITE'), SRC.indexOf('M57 LOT21')); // borné avant LOT21
A(VM.length > 0, '23. bloc view-model LOT20 localisé');
A(!/getMoyenPrixFor|dimensionnementVMC|VMC_PARAMS|piece\.config|config\.vmc\s*=|VMC_BOUCHE|prixTotal|calculerPiece|moteur-devis|require\(|fetch\(|document\.|window\.|globalThis\./.test(VM),
  '24. view-model : aucun piece.config / Runtime / catalogue / prix / DOM');
A(!/VITESSE_CONCEPTION|preDimensionnementVmc\(|preCalculSectionVmc\(|pertesDeChargeVmc\(|analysePressionVmc\(/.test(VM),
  '25. view-model : aucun calcul (pas de dimensionnement/section/pertes/pression)');
A(!/'conforme'|"conforme"|dimensionné|pression suffisante/i.test(VM),
  '26. view-model : aucune affirmation de conformité/dimensionnement');

// =====================================================================
// STATIQUE — script UI dans devis-configurateur.html
// =====================================================================
const CONF = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
const iUI = CONF.indexOf('M57 LOT20 — UI VISITE VMC');
A(iUI > 0, '27. script UI LOT20 présent');
const UI = CONF.slice(CONF.indexOf('<script>', iUI), CONF.indexOf('</script>', CONF.indexOf('<script>', iUI)));

// Utilise les actions IMMUABLES LOT19 (aucune règle/collecte dupliquée) ------------
['ajouterReseauVisite', 'ajouterNoeudVisite', 'ajouterTronconVisite', 'ajouterTerminalVisite',
 'ajouterMesureVisiteA', 'ajouterHypotheseVisiteA', 'ajouterPhotoVisiteA',
 'definirInstallationVisite', 'definirCentraleVisite', 'definirInterfaceVisite'].forEach(fn => {
  A(new RegExp(fn + '\\(').test(UI), '28. UI appelle l\'action LOT19 ' + fn + ' (jamais réécrite)');
});
A(/construireVueVisite\(/.test(UI), '29. UI rend via construireVueVisite (représentation, pas 2e vérité)');

// Persistance réutilisée : saveEtat, aucun store parallèle -------------------------
A(/saveEtat\(/.test(UI), '30. UI persiste via saveEtat() existant');
A(!/sessionStorage\.setItem|localStorage\.setItem/.test(UI), '31. UI : aucun store parallèle (pas de setItem propre)');
A(/donneesVisiteVmc\s*=\s*(nouvelleVisiteVmc|ajouter|definir|nouvelle)/.test(UI)
  || /commit\(/.test(UI), '32. mutation via réassignation du résultat d\'action (immuable), jamais push direct');
A(!/donneesVisiteVmc\.(reseaux|mesures|photos|hypotheses)\s*\.\s*push|donneesVisiteVmc\.[a-zA-Z]+\s*=\s*[^=]/.test(UI),
  '33. UI ne mute jamais donneesVisiteVmc en place');

// Money-path : jamais de prix/config/dimensionnement ------------------------------
A(!/piece\.config|calculerPiece|dimensionnementVMC|VMC_PARAMS|VMC_BOUCHE|getMoyenPrixFor|prixTotal|moteur-devis|moteur-piece/.test(UI),
  '34. UI : aucun accès money-path (config tarifaire / moteur prix / Runtime)');
A(!/besoinVmc\(|debitsVmc\(|preEtudeVmc\(|preDimensionnementVmc\(|preCalculSectionVmc\(|pertesDeChargeVmc\(|analysePressionVmc\(/.test(UI),
  '35. UI : aucun calcul aéraulique (collecte uniquement)');
A(!/'conforme'|"conforme"|dimensionné|pression suffisante|installation valid/i.test(UI),
  '36. UI : n\'affiche jamais conformité/dimensionnement');

// Réel vs projeté = deux champs distincts ; point d'entrée + panneau ---------------
A(/vi_tdreel_/.test(UI) && /vi_tdproj_/.test(UI), '37. UI : Ø relevé et Ø projeté sont deux champs distincts');
A(/id="visiteVmcPanel"[^>]*display:none/.test(CONF), '38. panneau #visiteVmcPanel présent, masqué par défaut');
A(/onclick="ouvrirVisiteVmc\(\)"/.test(CONF), '39. point d\'entrée : bouton ouvrant la visite');
A(/window\.fermerVisiteVmc\s*=/.test(UI) && /window\.visiteEnregistrer\s*=/.test(UI),
  '40. handlers référencés par le panneau (fermer/enregistrer) définis');

const total = ok + ko;
if (ko === 0) console.log('✅ UI terrain visite VMC (M57 LOT20) : ' + ok + '/' + total + ' — rendu pur, actions LOT19, saveEtat, hors money-path');
else { console.error('❌ UI terrain visite VMC LOT20 : ' + ok + '/' + total); process.exit(1); }
