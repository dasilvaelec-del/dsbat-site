// =====================================================================
// tests/vmc-etat-pose-lot30a.test.js — M57 LOT30-A : données d'état de pose (flexible)
// =====================================================================
// donneesPose = OBSERVATION terrain qualitative de l'état de pose d'un conduit (surtout flexible).
// PUREMENT données : aucune conversion en %/coefficient/rugosité/perte, aucun calcul. Conservée de
// la visite → normalisation → persistence, avec provenance/statut LOT18. typeConduit inchangé.
// Compatibilité : ancienne visite sans donneesPose → null (jamais transformée). Hors money-path.
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const cv = (val) => V.creerChampValeur({ valeur: val, statut: V.STATUT_VISITE.MESURE });
function tronconFlex(pose) {
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(8), diametre: cv(80), typeConduit: 'souple', donneesPose: pose });
  return dv;
}

A(typeof V.creerDonneesPose === 'function' && typeof V.ETAT_POSE_VISITE === 'object', '0. couche LOT30-A exportée');

// ---- 1. Tronçon SANS données de pose → null (pas de structure fabriquée) ----------
{
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', typeConduit: 'souple' });
  A(dv.reseaux[0].troncons[0].donneesPose === null, '1. tronçon sans donneesPose → null');
}

// ---- 2-7. États de pose qualitatifs conservés ------------------------------------
['entierement_deploye', 'partiellement_comprime', 'fortement_comprime', 'affaisse', 'ecrase', 'inconnu'].forEach(function (etat, i) {
  const t = tronconFlex({ etatPose: etat, provenance: 'technicien', statut: 'documente' }).reseaux[0].troncons[0];
  A(t.donneesPose && t.donneesPose.etatPose === etat, (2 + i) + '. état de pose « ' + etat + ' » conservé');
});

// ---- 8/9/10. Compression / déformation / courbure qualitatives --------------------
{
  const t = tronconFlex({ compression: 'faible', deformation: 'legere', courbure: 'importante', statut: 'estime', provenance: 'technicien' }).reseaux[0].troncons[0];
  A(t.donneesPose.compression === 'faible', '8. compression qualitative conservée');
  A(t.donneesPose.deformation === 'legere', '9. déformation qualitative conservée');
  A(t.donneesPose.courbure === 'importante', '10. courbure qualitative conservée');
}

// ---- 11/12. Provenance / statut conservés (LOT18) --------------------------------
{
  const t = tronconFlex({ etatPose: 'affaisse', provenance: 'technicien', statut: 'documente' }).reseaux[0].troncons[0];
  A(t.donneesPose.provenance === 'technicien', '11. provenance conservée');
  A(t.donneesPose.statut === 'documente', '12. statut conservé');
  // défaut statut = inconnu (une observation n'est pas une mesure instrumentée par défaut)
  A(V.creerDonneesPose({ etatPose: 'affaisse' }).statut === 'inconnu', '12b. statut par défaut = inconnu (jamais mesure implicite)');
}

// ---- 13/14. Aucune conversion % / aucun coefficient hydraulique ------------------
{
  const t = tronconFlex({ etatPose: 'fortement_comprime', compression: 'importante', courbure: 'faible', provenance: 'technicien', statut: 'estime' }).reseaux[0].troncons[0];
  A(!/[0-9]\s*%/.test(JSON.stringify(t.donneesPose)), '13. aucune conversion en pourcentage');
  A(!/coefficient|rugosite|perte|vitesse|diametreHydraulique|rayon\s*=/.test(JSON.stringify(t.donneesPose)), '14. aucun coefficient / grandeur hydraulique dérivée');
}

// ---- 15. Normalisation conserve les données (aucune transformation) ---------------
{
  const dv = tronconFlex({ etatPose: 'affaisse', compression: 'importante', deformation: 'legere', courbure: 'faible', provenance: 'technicien', statut: 'documente' });
  const norm = V.normaliserVisiteVersReseau(dv);
  const p = norm.donneesReseau.reseaux[0].troncons[0].donneesPose;
  A(p && p.etatPose === 'affaisse' && p.compression === 'importante' && p.provenance === 'technicien' && p.statut === 'documente', '15. normalisation conserve donneesPose (identique, provenance/statut inclus)');
}

// ---- 16. Persistence save→restore conserve les données ---------------------------
{
  const dv = tronconFlex({ etatPose: 'ecrase', compression: 'importante', deformation: 'importante', courbure: 'aucune', provenance: 'photo_interpretee', statut: 'a_verifier' });
  const rt = V.restaurerVisiteVmc(JSON.parse(JSON.stringify(V.serialiserVisiteVmc(dv))));
  const p = rt.reseaux[0].troncons[0].donneesPose;
  A(p && p.etatPose === 'ecrase' && p.courbure === 'aucune' && p.provenance === 'photo_interpretee' && p.statut === 'a_verifier', '16. persistence save→restore conserve donneesPose');
}

// ---- 17. Ancienne visite sans donneesPose → jamais transformée --------------------
{
  // Reconstruction directe d'un objet "ancien" sans donneesPose.
  const ancienne = V.creerDonneesVisite({ reseaux: [{ type: 'extraction', troncons: [{ id: 'T1', typeConduit: 'souple' }] }] });
  const t = ancienne.reseaux[0].troncons[0];
  A(t.donneesPose === null && t.typeConduit === 'souple', '17. ancienne visite (flexible) sans état de pose → donneesPose null, jamais « entierement_deploye » inventé');
}

// ---- 18. Non-mutation ------------------------------------------------------------
{
  const dv = tronconFlex({ etatPose: 'affaisse', provenance: 'technicien', statut: 'documente' });
  const snap = JSON.stringify(dv);
  V.normaliserVisiteVersReseau(dv); V.serialiserVisiteVmc(dv);
  A(JSON.stringify(dv) === snap, '18. entrée non mutée (normalisation / sérialisation)');
}

// ---- 19/20/21/22. SF / DF extraction / insufflation séparés ----------------------
{
  const t = tronconFlex({ etatPose: 'affaisse', provenance: 'technicien', statut: 'documente' }).reseaux[0].troncons[0];
  A(t.donneesPose.etatPose === 'affaisse', '19. SF : donneesPose porté par le tronçon');
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'double_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterReseauVisite(dv, { id: 'RI', type: 'insufflation' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'E1', typeConduit: 'souple', donneesPose: { etatPose: 'partiellement_comprime', provenance: 'technicien', statut: 'estime' } });
  dv = V.ajouterTronconVisite(dv, 'RI', { id: 'I1', typeConduit: 'souple', donneesPose: { etatPose: 'entierement_deploye', provenance: 'technicien', statut: 'documente' } });
  const norm = V.normaliserVisiteVersReseau(dv);
  const ext = norm.donneesReseau.reseaux.filter(r => r.type === 'extraction')[0];
  const ins = norm.donneesReseau.reseaux.filter(r => r.type === 'insufflation')[0];
  A(ext.troncons[0].donneesPose.etatPose === 'partiellement_comprime', '20. DF extraction : pose propre conservée');
  A(ins.troncons[0].donneesPose.etatPose === 'entierement_deploye', '21. DF insufflation : pose propre conservée');
  A(ext.troncons[0].donneesPose.etatPose !== ins.troncons[0].donneesPose.etatPose, '22. réseaux séparés : aucune pose partagée entre extraction et insufflation');
}

// ---- 23-26. Aucun impact money-path / LOT25 / LOT27 / LOT28-29 -------------------
{
  const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc.js'), 'utf8');
  // Le contrat donneesPose ne référence aucun money-path.
  const iPose = SRC.indexOf('function creerDonneesPose');
  const BLOC = SRC.slice(iPose, SRC.indexOf('function creerTronconVisite'));
  A(BLOC.length > 0 && !/piece\.config|calculerPiece|moteur-devis|prix|catalogue|dimensionnementVMC/.test(BLOC), '23. donneesPose : hors money-path');
  // LOT25 (moteur Darcy) : aucune référence à donneesPose / etatPose.
  const L25 = SRC.slice(SRC.indexOf('function calculerPerteLineaireVmc'), SRC.indexOf('function adaptateurReferentielPertesVmc'));
  A(!/donneesPose|etatPose|compression|courbure/.test(L25), '24. LOT25 inchangé : ne consomme aucune donnée de pose');
  // Adaptateur LOT27/25 : idem.
  const ADA = SRC.slice(SRC.indexOf('function adaptateurReferentielPertesVmc'), SRC.indexOf('function adaptateurReferentielPertesVmc') + 2000);
  A(!/donneesPose|etatPose/.test(ADA), '25. adaptateur inchangé : aucune donnée de pose consommée');
  // LOT28/29 dérivation/graphe : la pose n'entre pas dans la topologie ni les débits.
  const L28 = SRC.slice(SRC.indexOf('function deriverDebitsTronconsVmc'), SRC.indexOf('function deriverDebitsTronconsVmc') + 3000);
  A(!/donneesPose|etatPose/.test(L28), '26. LOT28/29 inchangés : débits/graphe indépendants de l\'état de pose');
}

const total = ok + ko;
if (ko === 0) console.log('✅ Données d\'état de pose flexible (M57 LOT30-A) : ' + ok + '/' + total + ' — observation qualitative pure, conservée (visite→normalisation→persistence), aucune interprétation, hors money-path');
else { console.error('❌ État de pose LOT30-A : ' + ok + '/' + total); process.exit(1); }
