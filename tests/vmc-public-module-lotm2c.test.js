// =====================================================================
// tests/vmc-public-module-lotm2c.test.js — Module public VMC (site)
// =====================================================================
// Vérifie le module PUBLIC vmc-public.js, SANS aucune dépendance au moteur physique
// (le moteur vmc.js a été retiré du site en M5 ; la physique vit dans dsbat-runtime).
//   • PURETÉ : vmc-public.js ne contient AUCUNE physique (Darcy/Colebrook, pertes,
//     graphe physique, pression, marges, synthèse, référentiels de calcul, ζ/ε) ;
//   • FERMETURE : le module se charge seul, expose l'API publique, n'exporte aucune physique ;
//   • FONCTIONNEL PUBLIC : les fonctions publiques s'exécutent et renvoient des formes cohérentes ;
//   • AUCUNE PERTE DE DONNÉES : provenance, statuts, unités, nœuds/arêtes de graphe et état de
//     pose survivent à la collecte / sérialisation / vue / normalisation.
// Aucune parité locale avec un second moteur : la parité physique est validée côté Runtime.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const P = require(path.join(RACINE, 'js', 'moteurs', 'vmc-public.js'));   // module public (seul moteur VMC du site)

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const S = P.STATUT_VISITE;
const cv = (val) => P.creerChampValeur({ valeur: val, statut: S.MESURE });
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- 1. PURETÉ : aucune physique dans le fichier public --------------------------
{
  const brut = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc-public.js'), 'utf8');
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
  A(!/function\s+(preEtudeVmc|etudeDarcyVmc|calculerPerteLineaireVmc)/.test(src), '1b. aucune déclaration de fonction physique');
  A(brut.length < 40000, '1c. module public compact (' + brut.length + ' o)');
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
  ['etudierVisiteVmc', 'etudeDarcyVmc', 'syntheseEtudeVmc', 'calculerPerteLineaireVmc', 'analysePressionVmc'].forEach(n =>
    A(typeof P[n] === 'undefined', '2c. ' + n + ' NON exporté par le module public'));
}

// ---- 3. FONCTIONNEL PUBLIC : les règles qualitatives s'exécutent (sans parité locale) --
{
  const pieces = [{ id: 'sdb', numero: 1 }, { id: 'cuisine', numero: 1 }, { id: 'salon', numero: 1 }, { id: 'chambre', numero: 1 }];
  const ctx = { solution: 'simple_flux', nbPiecesPrincipales: 3, intention: 'creer', perimetre: 'complet' };
  A(Array.isArray(P.getVmcPourPiece('sdb')), '3a. getVmcPourPiece renvoie une liste');
  A(Array.isArray(P.controlesOublisVmc({ id: 'sdb', config: {} })), '3b. controlesOublisVmc renvoie une liste');
  A(Array.isArray(P.champsReleveVisite('double_flux')), '3c. champsReleveVisite renvoie une liste');
  const obl = P.obligationsVmc(pieces, ctx);
  A(obl != null && typeof obl === 'object', '3d. obligationsVmc renvoie un objet');
  const besoin = P.besoinVmc(pieces, ctx);
  A(besoin != null && typeof besoin === 'object', '3e. besoinVmc renvoie un objet');
  const debits = P.debitsVmc(besoin, ctx);
  A(debits != null && typeof debits === 'object', '3f. debitsVmc renvoie un objet');
  const topo = P.topologieVmc(pieces, ctx, besoin, debits);
  A(topo != null && typeof topo === 'object' && 'flux' in topo, '3g. topologieVmc renvoie une topologie qualitative');
}

// ---- 4. AUCUNE PERTE DE DONNÉES (collecte → sérialisation → vue → normalisation) --
{
  let dv = P.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = P.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  ['nA', 'nB'].forEach(id => { dv = P.ajouterNoeudVisite(dv, 'RE', { id: id }); });
  dv = P.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'collecteur', pieceRef: 'sdb#1',
    noeudAmont: 'nA', noeudAval: 'nB', longueur: cv(6), diametre: cv(125), typeConduit: 'acier_galvanise',
    debit: cv(45), donneesPose: { etat: 'rigide', accessibilite: 'accessible' },
    singularites: [{ type: 'coude', geometrie: 'coude_90', quantite: cv(2) }] });
  dv = P.ajouterTerminalVisite(dv, 'RE', { id: 'b1', pieceRef: 'sdb#1', noeudId: 'nA', fonction: 'SORTIE_AIR', debit: cv(45) });
  A(dv && dv.reseaux && dv.reseaux[0].troncons.length === 1 && dv.reseaux[0].terminaux.length === 1, '4a. visite riche construite (builders publics)');
  // Sérialisation aller-retour sans perte
  const round = P.restaurerVisiteVmc(P.serialiserVisiteVmc(dv));
  A(eq(round, dv), '4b. sérialisation/restauration sans perte (mesures/observations conservées)');
  // Normalisation conserve provenance/graphe/état de pose/unités
  const norm = P.normaliserVisiteVersReseau(dv);
  const t = norm.donneesReseau.reseaux[0].troncons[0];
  A(t.noeudAmont === 'nA' && t.noeudAval === 'nB', '4c. arêtes de graphe (LOT29) conservées');
  A(t.donneesPose != null && eq(t.donneesPose, dv.reseaux[0].troncons[0].donneesPose), '4d. état de pose (LOT30-A) conservé tel quel');
  A(t.longueur === 6 && t.diametre === 125 && t.debit === 45, '4e. valeurs relevées conservées (unités préservées)');
  // Vue + résumé + validation de forme produisent des formes cohérentes
  const vue = P.construireVueVisite(dv);
  A(vue && vue.existe === true && vue.compteurs && vue.compteurs.troncons === 1, '4f. vue UI cohérente (compteurs)');
  const res = P.resumeVisiteVmc(dv);
  A(res && 'statutVisite' in res && res.donneesReseau != null, '4g. résumé cohérent');
  const val = P.validerDonneesVisite(dv);
  A(val && typeof val.valide === 'boolean' && Array.isArray(val.donneesManquantes), '4h. validation de forme cohérente');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Module public VMC (site) : ' + ok + '/' + total + ' — sans physique, API publique fermée, fonctionnel public, aucune perte de données de visite');
else { console.error('❌ Module public VMC : ' + ok + '/' + total); process.exit(1); }
