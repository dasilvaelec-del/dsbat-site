// =====================================================================
// tests/vmc-verrou.test.js — LOT 1 (M57) : FILET DE SÉCURITÉ VMC (verrouillage)
// =====================================================================
// Verrouille le COMPORTEMENT ACTUEL de la VMC avant toute évolution V1.1.
// AUCUN changement fonctionnel : ce fichier ne fait que LIRE et exécuter le code
// existant. Couvre :
//   A. métier pur (js/moteurs/vmc.js) : getVmcPourPiece, _vmcRole,
//      controlesOublisVmc (proposition SF opt-in), verifierVMC (cohérence) ;
//   B. dimensionnementVMC + VMC_PARAMS (catalogue Runtime) : simple flux par
//      défaut, DF seulement si doubleFlux=true, VMC_ENTREE_AIR ≠ insufflation ;
//   C. compatibilité électrique + agrégation (Runtime composé) :
//      vmc oui==defaillante (b.vmc=true), non (b.vmc=false), somme des bouches ;
//   D. verrou statique du mapping électrique dans moteur-devis.js.
// Les parties B/C sont SKIP proprement si le Runtime privé n'est pas monté.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0, skip = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const codes = (list) => (list || []).map(x => x.code);

globalThis.metiersActifs = ['vmc'];
globalThis.chantier = { typeProjet: 'renov' };

// ---------- A. Métier pur (js/moteurs/vmc.js) -----------------------
// getVmcPourPiece : pièces humides → bouche + entrée d'air ; principales → entrée d'air ; autres → rien
['sdb', 'sde', 'wc', 'cuisine', 'cave'].forEach(id =>
  A(eq(codes(VMC.getVmcPourPiece(id)), ['VMC_BOUCHE', 'VMC_ENTREE_AIR']), 'getVmcPourPiece(' + id + ') = bouche + entrée d\'air'));
['salon', 'salle_manger', 'chambre', 'bureau'].forEach(id =>
  A(eq(codes(VMC.getVmcPourPiece(id)), ['VMC_ENTREE_AIR']), 'getVmcPourPiece(' + id + ') = entrée d\'air seule'));
A(eq(codes(VMC.getVmcPourPiece('entree')), []), 'getVmcPourPiece(entree) = aucune prestation VMC');

// _vmcRole
['cuisine', 'sdb', 'sde', 'wc', 'cave'].forEach(id => A(VMC._vmcRole(id) === 'extraction', '_vmcRole(' + id + ') = extraction'));
['salon', 'salle_manger', 'chambre', 'bureau'].forEach(id => A(VMC._vmcRole(id) === 'balayage', '_vmcRole(' + id + ') = balayage'));
A(VMC._vmcRole('entree') === null, '_vmcRole(entree) = null');

// controlesOublisVmc : proposition opt-in (SF), avec anti-doublon et respect du refus
const pieceHumide = (cfg, ign) => ({ id: 'sdb', nom: 'Salle de bain', config: { vmc: Object.assign({}, cfg) }, _oublisIgnoresVmc: ign || {} });
{
  const prop = VMC.controlesOublisVmc(pieceHumide({}));
  A(prop.some(s => s.code === 'VMC_BOUCHE' && s.qty === 1 && s.unite === 'U'), 'humide vide → propose VMC_BOUCHE (opt-in)');
  A(!VMC.controlesOublisVmc(pieceHumide({ VMC_BOUCHE: 1 })).some(s => s.code === 'VMC_BOUCHE'), 'bouche déjà en config → non reproposée (anti-doublon)');
  A(!VMC.controlesOublisVmc(pieceHumide({}, { VMC_BOUCHE: true })).some(s => s.code === 'VMC_BOUCHE'), 'bouche refusée → non reproposée');
}
{
  const prin = { id: 'chambre', nom: 'Chambre', config: { vmc: {} } };
  A(VMC.controlesOublisVmc(prin).some(s => s.code === 'VMC_ENTREE_AIR'), 'pièce principale vide → propose VMC_ENTREE_AIR');
}

// verifierVMC : cohérence actuelle
A(eq(VMC.verifierVMC([{ id: 'sdb', nom: 'SDB', config: {} }], []), []), 'verifierVMC sans métier vmc → aucune alerte');
{
  const al = VMC.verifierVMC([{ id: 'sdb', nom: 'SDB', config: { vmc: {} } }], ['vmc']);
  A(al.some(a => /bouche d'extraction/.test(a.texte)), 'humide sans bouche → alerte');
  A(al.some(a => /aucune bouche/.test(a.texte)), 'aucune bouche → « centrale ne sera pas chiffrée »');
}
A(!VMC.verifierVMC([{ id: 'sdb', nom: 'SDB', config: { vmc: { VMC_BOUCHE: 1 } } }], ['vmc']).some(a => /aucune bouche/.test(a.texte)),
  'bouche présente → pas d\'alerte « aucune bouche »');

// ---------- D. Verrou statique du mapping électrique -----------------
const MOTEUR = fs.readFileSync(path.join(RACINE, 'js', 'moteur-devis.js'), 'utf8');
A(/chantier\.vmc && chantier\.vmc !== 'non'/.test(MOTEUR), 'moteur-devis : mapping b.vmc = (chantier.vmc !== \'non\') verrouillé');
A(/bouches \+= /.test(MOTEUR) && /entreesAir \+= /.test(MOTEUR), 'moteur-devis : agrégation bouches/entrées d\'air présente');

// ---------- B. dimensionnementVMC + VMC_PARAMS (Runtime) ------------
function requireRuntime(rel) {
  const cands = [process.env.DSBAT_CATALOGUE_DIR, path.join(RACINE, '..', '..', 'dsbat-runtime'), path.join(RACINE, '..', '..', '..', 'dsbat-runtime')].filter(Boolean);
  for (const base of cands) { try { return require(path.join(base, rel)); } catch (e) {} }
  return null;
}
const prix = requireRuntime(path.join('runtime', 'moteur-prive', 'prix.js'));
if (!prix || typeof prix.dimensionnementVMC !== 'function') {
  skip++; console.log('  ⏭️  SKIP B : catalogue Runtime non monté (dimensionnementVMC indisponible).');
} else {
  const sf = prix.dimensionnementVMC({ bouches: 2, entreesAir: 1, debitTotal: 60 });
  A(sf && sf.type === 'simple flux', 'dimensionnementVMC défaut = simple flux');
  A(sf && codes(sf.composition).includes('VMC_CAISSON_SF') && !codes(sf.composition).includes('VMC_CAISSON_DF'), 'SF : caisson SF, pas de caisson DF');
  A(prix.dimensionnementVMC({ bouches: 0 }) === null, 'aucune bouche → pas de centrale (null)');
  const df = prix.dimensionnementVMC({ bouches: 2, entreesAir: 2, debitTotal: 60, doubleFlux: true });
  A(df && df.type === 'double flux' && codes(df.composition).includes('VMC_CAISSON_DF'), 'doubleFlux=true → caisson DF (branche DF déjà prête)');
  A(prix.VMC_PARAMS && prix.VMC_PARAMS.systeme === 'hygroB', 'VMC_PARAMS.systeme = hygroB (état actuel)');
  A(prix.VMC_PARAMS && prix.VMC_PARAMS.doubleFlux && prix.VMC_PARAMS.doubleFlux.caissonCode === 'VMC_CAISSON_DF', 'VMC_PARAMS.doubleFlux prévu (caisson DF)');
}

// ---------- C. Compat. électrique + agrégation (Runtime composé) ----
const composer = requireRuntime(path.join('runtime', 'src', 'composer.js'));
const Modele = requireRuntime(path.join('js', 'modele-projet.js'));
const fixtures = requireRuntime(path.join('tests', 'golden-master', 'fixtures.js'));
if (!composer || !Modele || !fixtures) {
  skip++; console.log('  ⏭️  SKIP C : Runtime composé/fixtures non montés.');
} else {
  const { api } = composer.composerRuntime();
  const base = fixtures.find(c => c.nom === 'sdb_complete') || fixtures[1];
  const devisPourVmc = (val) => {
    const cas = JSON.parse(JSON.stringify(base));
    cas.chantier.vmc = val;
    const projet = Modele.creerProjetDSBAT({ chantier: cas.chantier, pieces: cas.piecesSelectionnees, metiers: cas.metiersActifs, id: 'vmc-' + val });
    const r = api.traiter({ methode: 'POST', chemin: '/v1/projets/calcul', corps: projet });
    return r.corps && r.corps.projet && r.corps.projet.resultats && r.corps.projet.resultats.devis;
  };
  const dOui = devisPourVmc('oui'), dDef = devisPourVmc('defaillante'), dNon = devisPourVmc('non');
  A(dOui && dDef && dNon, 'C : les 3 devis (oui/defaillante/non) sont calculés (aucun crash)');
  // Invariant central : defaillante == oui (b.vmc=true dans les deux cas)
  A(eq(dOui.tableau, dDef.tableau), 'compat élec : vmc=oui et vmc=defaillante → même tableau (b.vmc=true)');
  // Agrégation des bouches : 2 bouches en config → D.vmc.bouches = 2
  {
    const cas = JSON.parse(JSON.stringify(base));
    const humides = (cas.piecesSelectionnees || []).filter(p => ['sdb', 'sde', 'wc', 'cuisine', 'cave'].includes(p.id)).slice(0, 2);
    if (humides.length >= 1) {
      humides.forEach(p => { p.config = p.config || {}; p.config.vmc = Object.assign({}, p.config.vmc, { VMC_BOUCHE: 1 }); });
      const metiers = (cas.metiersActifs || []).includes('vmc') ? cas.metiersActifs : cas.metiersActifs.concat('vmc');
      const projet = Modele.creerProjetDSBAT({ chantier: cas.chantier, pieces: cas.piecesSelectionnees, metiers: metiers, id: 'vmc-agg' });
      const r = api.traiter({ methode: 'POST', chemin: '/v1/projets/calcul', corps: projet });
      const d = r.corps && r.corps.projet && r.corps.projet.resultats && r.corps.projet.resultats.devis;
      A(d && d.vmc && d.vmc.bouches === humides.length, 'agrégation : ' + humides.length + ' bouche(s) config → D.vmc.bouches = ' + humides.length);
      A(d && d.vmc && d.vmc.type === 'simple flux', 'agrégation : centrale = simple flux (comportement actuel)');
    } else { skip++; console.log('  ⏭️  SKIP agrégation : fixture sans pièce humide.'); }
  }
}

const total = ok + ko;
console.log('\nVMC verrou (LOT 1) : ' + ok + '/' + total + ' assertions' + (skip ? ' · ' + skip + ' bloc(s) SKIP' : '') + (ko ? ' · ' + ko + ' ÉCHEC(S)' : ''));
if (ko === 0) console.log('✅ Filet de sécurité VMC en place (comportement actuel verrouillé, aucun changement fonctionnel)');
else process.exit(1);
