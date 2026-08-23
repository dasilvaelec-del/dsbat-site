// =====================================================================
// tests/contexte-projet.test.js — Preuves du Contexte Projet (AIC-001 / M2)
// =====================================================================
// Vérifie que construireContexte() est une VUE DÉRIVÉE pure :
//  • distinction déclaré / calculé / déduit ;
//  • aucune écriture dans l'entrée, aucun accès DOM, aucun prix ;
//  • accepte {chantier,pieces,metiers}, un dsbat.projet, ou les globales ;
//  • classifications et écart de surface corrects ;
//  • emplacements réservés vides (aucun consommateur branché).
// Hors ligne, in-process. N'importe aucun moteur.
// =====================================================================

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CTX = require(path.join(ROOT, 'js', 'contexte-projet.js'));
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

const piece = (o) => Object.assign({ id: 'salon', nom: 'Salon', numero: 1, dims: { l: 4, la: 3, h: 2.5, fenetres: 1, portes: 1 }, config: {} }, o);

// Jeu d'entrée représentatif
const entree = {
  chantier: { typeBien: 'maison', typeLogement: 'principal', surface: 70, pieces: '3', ageBati: 'ancien', etatLieux: 'moyen', tableauExistant: 'inconnu', codePostal: '77400' },
  metiers: ['electricite', 'peinture'],
  pieces: [
    piece({ id: 'salon', nom: 'Salon', dims: { l: 5, la: 4, h: 2.5, fenetres: 1, portes: 1 }, config: { electricite: { ELEC_PL_SA: 1 } } }),   // 20 m²
    piece({ id: 'chambre', nom: 'Chambre 1', numero: 1, dims: { l: 4, la: 3, h: 2.5, fenetres: 1, portes: 1 }, config: {} }),                    // 12
    piece({ id: 'chambre', nom: 'Chambre 2', numero: 2, dims: { l: 3, la: 3, h: 2.5, fenetres: 1, portes: 1 }, config: {} }),                    // 9
    piece({ id: 'sdb', nom: 'Salle de bain', dims: { l: 2, la: 2, h: 2.5, fenetres: 0, portes: 1 }, config: {} }),                               // 4
    piece({ id: 'terrasse', nom: 'Terrasse', dims: { l: 3, la: 2, h: 2.5, fenetres: 0, portes: 1 }, config: {} })                                // 6
  ]
};
// somme configurée = 20+12+9+4+6 = 51 ; déclarée = 70 ; écart = -19 → 27% sous
const gel = JSON.stringify(entree);
const ctx = CTX.construireContexte(entree);

// 1) Structure & distinction des trois natures de données
A(ctx.$vue === 'dsbat.contexte', 'marqueur $vue présent');
A(ctx.declare && ctx.calcule && ctx.deduit, 'blocs declare / calcule / deduit présents');
A(ctx.declare.surfaceTotaleDeclaree === 70, 'DÉCLARÉ : surface déclarée = 70');
A(ctx.calcule.surfaceConfiguree === 51, 'CALCULÉ : surface configurée = 51 (somme l×la)');
A(ctx.declare.surfaceTotaleDeclaree !== ctx.calcule.surfaceConfiguree, 'distinction déclarée ≠ configurée conservée');
A(ctx.declare.typologie === 'T3', 'DÉCLARÉ : typologie = T3 (reformat, pas de "F")');

// 2) Écart de surface (donnée calculée)
A(ctx.calcule.ecartSurface && ctx.calcule.ecartSurface.pourcentage === 27, 'CALCULÉ : écart 27 % (|51-70|/70)');
A(ctx.calcule.ecartSurface.sens === 'sous', 'CALCULÉ : sens = sous-métrage');
A(ctx.calcule.nbPiecesParType.chambre === 2, 'CALCULÉ : 2 chambres comptées');

// 3) Déductions (classifications mécaniques)
A(ctx.deduit.piecesPrincipalesPresentes.sort().join(',') === 'chambre,salon', 'DÉDUIT : principales = salon, chambre');
A(ctx.deduit.piecesHumidesPresentes.join(',') === 'sdb', 'DÉDUIT : humides = sdb');
A(ctx.deduit.aExterieur === true && ctx.deduit.exterieursPresents.join(',') === 'terrasse', 'DÉDUIT : extérieur = terrasse');
A(ctx.deduit.profilRenovation === null && ctx.deduit.profilLogistique === null, 'DÉDUIT : profils NON inventés (null)');

// 4) Emplacements réservés vides (aucun consommateur branché en M2)
A(Array.isArray(ctx.incoherences) && ctx.incoherences.length === 0, 'RÉSERVÉ : incoherences vide');
A(Array.isArray(ctx.recommandations) && ctx.recommandations.length === 0, 'RÉSERVÉ : recommandations vide');
A(Array.isArray(ctx.hypotheses) && ctx.hypotheses.length === 0, 'RÉSERVÉ : hypotheses vide');
A(Array.isArray(ctx._pointsAtraiter) && ctx._pointsAtraiter.length > 0, 'points à traiter documentés');

// 5) Pureté : aucune écriture dans l'entrée, aucun prix exposé
A(JSON.stringify(entree) === gel, 'PURETÉ : entrée inchangée après appel');
const brut = JSON.stringify(ctx);
A(brut.indexOf('totalHT') === -1, 'AUCUN prix : "totalHT" absent de la vue');
A(brut.indexOf('"config"') === -1, 'vue légère : détail config brut non recopié');

// 6) Accepte un dsbat.projet et les globales
const projetLike = { $contrat: 'dsbat.projet', chantier: entree.chantier, pieces: entree.pieces, metiers: entree.metiers };
A(CTX.construireContexte(projetLike).calcule.surfaceConfiguree === 51, 'accepte un dsbat.projet');
globalThis.chantier = entree.chantier; globalThis.piecesSelectionnees = entree.pieces; globalThis.metiersActifs = entree.metiers;
A(CTX.construireContexte().declare.surfaceTotaleDeclaree === 70, 'accepte les globales (aucun argument)');

// 7) Robustesse : entrée vide
const vide = CTX.construireContexte({ chantier: {}, pieces: [], metiers: [] });
A(vide.calcule.surfaceConfiguree === 0 && vide.calcule.ecartSurface === null, 'robuste : entrée vide → 0 / écart null');

const total = ok + ko;
if (ko === 0) console.log('✅ Contexte Projet (M2) : ' + ok + '/' + total + ' — vue dérivée pure, distinction déclaré/calculé/déduit OK');
else console.error('❌ Contexte Projet : ' + ok + '/' + total);
process.exit(ko === 0 ? 0 : 1);
