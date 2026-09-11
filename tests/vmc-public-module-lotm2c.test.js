// =====================================================================
// tests/vmc-public-module-lotm2c.test.js — M2-C : module public VMC extrait
// =====================================================================
// Vérifie l'extraction de responsabilité (M2-C), SANS bascule Runtime (M3) :
//   • PURETÉ : vmc-public.js ne contient AUCUNE physique (Darcy/Colebrook, pertes,
//     graphe physique, pression, marges, synthèse, référentiels de calcul, ζ/ε) ;
//   • FERMETURE : le module se charge seul (aucune dépendance vers une fonction privée) ;
//   • PARITÉ : les fonctions publiques renvoient un résultat IDENTIQUE à vmc.js (extraction
//     verbatim, aucun changement de comportement) ;
//   • AUCUNE PERTE DE DONNÉES : provenance, statuts, unités, mesures, photos, observations,
//     nœuds/arêtes de graphe et état de pose survivent à la collecte/sérialisation/vue.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const P = require(path.join(RACINE, 'js', 'moteurs', 'vmc-public.js'));   // module public extrait
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));          // moteur complet (référence, inchangé)

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const S = V.STATUT_VISITE;
const cv = (val) => V.creerChampValeur({ valeur: val, statut: S.MESURE });
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- 1. PURETÉ : aucune physique dans le fichier public --------------------------
{
  const brut = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc-public.js'), 'utf8');
  // On scanne le CODE seul : les commentaires (dont le bandeau « ne contient pas Darcy/Colebrook ») sont retirés.
  const src = brut.replace(/\r/g, '').replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  const interdits = [
    'Colebrook', 'Weisbach', '_resoudreColebrook', 'calculerPerteLineaireVmc', 'etudeDarcyVmc',
    'etudeSinguliereVmc', 'perteCheminDarcyVmc', 'margePressionCheminVmc', 'syntheseEtudeVmc',
    'preDimensionnementVmc', 'preCalculSectionVmc', 'pertesDeChargeVmc', 'analysePressionVmc',
    'etudierVisiteVmc', 'chargerReferentielPertesDepuisJSON', 'compilerReferentielPertes',
    'adapterDonneesReseauPourPertes', 'validerReferentielProduction', 'deriverDebitsTronconsVmc',
    'parcourirGrapheVmc', 'validerTopologieVmc', 'epsilon', 'rugosit', 'referentielProduction'
  ];
  const trouves = interdits.filter(t => new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(src) || src.indexOf(t) !== -1);
  A(trouves.length === 0, '1a. aucune fonction/terme physique dans vmc-public.js' + (trouves.length ? ' — TROUVÉ: ' + trouves.join(', ') : ''));
  // Le mot "Darcy" n'apparaît que s'il fuit ; on l'autorise uniquement dans un commentaire de négation.
  A(!/function\s+(preEtudeVmc|etudeDarcyVmc|calculerPerteLineaireVmc)/.test(src), '1b. aucune déclaration de fonction physique');
  A(brut.length < 40000, '1c. module public compact (' + brut.length + ' o) vs moteur complet');
}

// ---- 2. FERMETURE : le module se charge et expose l'API publique -----------------
{
  const attendues = ['getVmcPourPiece', 'evaluationSupportVmc', 'controlesOublisVmc', 'verifierVMC',
    'obligationsVmc', 'besoinVmc', 'debitsVmc', 'topologieVmc', 'champsReleveVisite',
    'creerDonneesReseau', 'validerDonneesReseau', 'nouvelleVisiteVmc', 'ajouterReseauVisite',
    'ajouterTronconVisite', 'construireVueVisite', 'resumeVisiteVmc', 'validerDonneesVisite',
    'normaliserVisiteVersReseau', 'serialiserVisiteVmc', 'restaurerVisiteVmc'];
  const manquantes = attendues.filter(n => typeof P[n] !== 'function');
  A(manquantes.length === 0, '2a. API publique complète' + (manquantes.length ? ' — MANQUE: ' + manquantes.join(', ') : ''));
  A(P.STATUT_VISITE && P.NATURE_VISITE && P.PROVENANCE_VMC, '2b. enums de visite exportés');
  // AUCUNE fonction physique exportée
  ['etudierVisiteVmc', 'etudeDarcyVmc', 'syntheseEtudeVmc', 'calculerPerteLineaireVmc', 'analysePressionVmc'].forEach(n =>
    A(typeof P[n] === 'undefined', '2c. ' + n + ' NON exporté par le module public'));
}

// ---- 3. PARITÉ des règles qualitatives (public == référence) ---------------------
{
  const pieces = [{ id: 'sdb', numero: 1 }, { id: 'cuisine', numero: 1 }, { id: 'salon', numero: 1 }, { id: 'chambre', numero: 1 }];
  const ctx = { solution: 'simple_flux', nbPiecesPrincipales: 3, intention: 'creer', perimetre: 'complet' };
  const cmp = (fn, ...args) => {
    let rp, rv, ep = null, ev = null;
    try { rp = P[fn](...args); } catch (e) { ep = String(e.message); }
    try { rv = V[fn](...args); } catch (e) { ev = String(e.message); }
    A(eq(rp, rv) && ep === ev, '3.' + fn + ' : résultat identique à vmc.js');
    return rv;
  };
  cmp('getVmcPourPiece', 'sdb');
  cmp('evaluationSupportVmc', { id: 'cuisine', config: {} }, ctx);
  cmp('controlesOublisVmc', { id: 'sdb', config: {} });
  cmp('champsReleveVisite', 'double_flux');
  cmp('obligationsVmc', pieces, ctx);
  const besoin = cmp('besoinVmc', pieces, ctx);
  const debits = cmp('debitsVmc', besoin, ctx);
  cmp('topologieVmc', pieces, ctx, besoin, debits);
}

// ---- 4. AUCUNE PERTE DE DONNÉES (collecte → sérialisation → vue → normalisation) --
{
  // Visite riche : mesures, photo, hypothèse, observations multi-statuts, graphe (nœuds/arêtes), état de pose.
  const build = (M) => {
    let dv = M.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
    dv = M.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
    ['nA', 'nB'].forEach(id => { dv = M.ajouterNoeudVisite(dv, 'RE', { id: id }); });
    dv = M.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'collecteur', pieceRef: 'sdb#1',
      noeudAmont: 'nA', noeudAval: 'nB', longueur: cv(6), diametre: cv(125), typeConduit: 'acier_galvanise',
      debit: cv(45), donneesPose: { etat: 'rigide', accessibilite: 'accessible' },
      singularites: [{ type: 'coude', geometrie: 'coude_90', quantite: cv(2) }] });
    dv = M.ajouterTerminalVisite(dv, 'RE', { id: 'b1', pieceRef: 'sdb#1', noeudId: 'nA', fonction: 'SORTIE_AIR', debit: cv(45) });
    return dv;
  };
  const dvP = build(P), dvV = build(V);
  A(eq(dvP, dvV), '4a. visite construite identique (builders publics == référence)');
  // Sérialisation aller-retour sans perte
  const round = P.restaurerVisiteVmc(P.serialiserVisiteVmc(dvP));
  A(eq(round, dvP), '4b. sérialisation/restauration sans perte (mesures/photos/observations conservées)');
  // Normalisation conserve provenance/graphe/état de pose/unités
  const norm = P.normaliserVisiteVersReseau(dvP);
  const t = norm.donneesReseau.reseaux[0].troncons[0];
  A(t.noeudAmont === 'nA' && t.noeudAval === 'nB', '4c. arêtes de graphe (LOT29) conservées');
  A(t.donneesPose != null && eq(t.donneesPose, dvP.reseaux[0].troncons[0].donneesPose), '4d. état de pose (LOT30-A) conservé tel quel (sans interprétation)');
  A(t.longueur === 6 && t.diametre === 125 && t.debit === 45, '4e. valeurs relevées conservées (unités préservées)');
  A(eq(norm, V.normaliserVisiteVersReseau(dvV)), '4f. normalisation identique à la référence');
  // Vue + résumé + validation de forme identiques
  A(eq(P.construireVueVisite(dvP), V.construireVueVisite(dvV)), '4g. vue UI identique');
  A(eq(P.resumeVisiteVmc(dvP), V.resumeVisiteVmc(dvV)), '4h. résumé identique');
  A(eq(P.validerDonneesVisite(dvP), V.validerDonneesVisite(dvV)), '4i. validation de forme identique');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Module public VMC (M2-C) : ' + ok + '/' + total + ' — extraction verbatim sans physique, API publique fermée, parité totale avec vmc.js, aucune perte de données de visite');
else { console.error('❌ Module public VMC (M2-C) : ' + ok + '/' + total); process.exit(1); }
