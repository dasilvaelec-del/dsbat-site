// =====================================================================
// tests/vmc-visite-lot19.test.js — M57 LOT19 : collecte + persistance visite VMC
// =====================================================================
// Couche PURE de collecte (actions immuables) + persistance/reprise + normalisation.
// donneesVisite = source de vérité. Aucun calcul, aucune écriture piece.config, aucun prix.
// La persistance réelle (saveEtat/restaurerEtat) est vérifiée statiquement (additif, hors config).
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const V = require(path.join(RACINE, 'js', 'moteurs', 'vmc-public.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const S = V.STATUT_VISITE, PR = V.PROVENANCE_VISITE;
const cv = (valeur, statut, prov) => V.creerChampValeur({ valeur, unite: 'mm', statut, provenance: prov });
// Simule un aller-retour de persistance (sérialisation JSON réelle).
const roundtrip = (dv) => V.restaurerVisiteVmc(JSON.parse(JSON.stringify(V.serialiserVisiteVmc(dv))));

A(typeof V.nouvelleVisiteVmc === 'function' && typeof V.ajouterReseauVisite === 'function', '0. LOT19 exporté');

// ---- 1/2. Visite vide + installation --------------------------------------------
{
  let dv = V.nouvelleVisiteVmc();
  A(dv.reseaux.length === 0 && dv.mesures.length === 0, '1. visite vide créée');
  dv = V.definirInstallationVisite(dv, { typeSysteme: 'double_flux', statutInstallation: 'existante', intervenant: 'T' });
  A(dv.installation.typeSysteme === 'double_flux', '2. installation renseignée');
}

// ---- 3-11. Collecte progressive (actions immuables) -----------------------------
{
  let dv = V.nouvelleVisiteVmc();
  const avant = JSON.stringify(dv);
  const dv2 = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  A(JSON.stringify(dv) === avant, '3. action immuable : la visite d\'entrée n\'est pas mutée');
  A(dv2.reseaux.length === 1 && dv2.reseaux[0].type === 'extraction', '3. réseau créé');
  let d = V.ajouterNoeudVisite(dv2, 'RE', { id: 'N1', type: 'raccord_centrale' });
  d = V.ajouterNoeudVisite(d, 'RE', { id: 'N2', type: 'raccord_terminal' });
  A(d.reseaux[0].noeuds.length === 2, '4. nœuds créés');
  d = V.ajouterTronconVisite(d, 'RE', { id: 'T1', noeudAmont: 'N1', noeudAval: 'N2', longueur: cv(5, S.MESURE) });
  A(d.reseaux[0].troncons[0].noeudAmont === 'N1' && d.reseaux[0].troncons[0].noeudAval === 'N2', '5/6. tronçon + liaison amont/aval');
  const dSing = V.ajouterTronconVisite(d, 'RE', { id: 'T2', singularites: [{ id: 'S1', type: 'coude' }] });
  A(dSing.reseaux[0].troncons[1].singularites[0].geometrie === 'inconnu', '7. singularité (géométrie inconnue tolérée)');
  d = V.ajouterTerminalVisite(d, 'RE', { id: 'TM1', pieceRef: 'sdb#1', fonction: 'SORTIE_AIR' });
  A(d.reseaux[0].terminaux[0].pieceRef === 'sdb#1', '8. terminal associé à pieceRef existant');
  d = V.definirCentraleVisite(d, { id: 'C', fabricant: 'ACME', reference: 'G1' });
  A(d.centrale.reference === 'G1', '9. centrale (référence de rattachement)');
  d = V.definirInterfaceVisite(d, 'priseAirNeuf', { type: 'inconnu' });
  d = V.definirInterfaceVisite(d, 'rejet', { placement: 'toiture' });
  A(d.priseAirNeuf.type === 'inconnu' && d.rejet.type === 'rejet', '10/11. prise air neuf (inconnu conservé) + rejet');
}

// ---- 12/13/14/15. Mesure / mesure sans instrument / hypothèse / photo -----------
{
  let dv = V.nouvelleVisiteVmc();
  dv = V.ajouterMesureVisiteA(dv, { id: 'M1', grandeur: 'debit', valeur: 28, unite: 'm3/h', instrument: 'anemo' });
  A(dv.mesures[0].statut === 'mesure' && dv.mesures[0].provenance === 'mesure_instrumentee', '12. mesure instrumentée');
  dv = V.ajouterMesureVisiteA(dv, { id: 'M2', grandeur: 'debit', valeur: 30, unite: 'm3/h' });
  A(dv.mesures[1].statut === 'releve_declaratif', '13. mesure sans instrument → déclarative (jamais instrumentée)');
  dv = V.ajouterHypotheseVisiteA(dv, { id: 'H1', description: 'longueur estimée', valeur: 6 });
  A(dv.hypotheses[0].provenance === 'hypothese' && dv.hypotheses[0].statut === 'a_verifier', '14. hypothèse séparée');
  dv = V.ajouterPhotoVisiteA(dv, { id: 'P1', objetType: 'troncon', objetId: 'T1' });
  A(dv.photos[0].objetType === 'troncon' && dv.photos[0].objetId === 'T1', '15/40. photo rattachée à un objet');
}

// ---- 16-19. Statuts inconnu / non_accessible / non_mesure / a_verifier ----------
{
  const t = V.creerTronconVisite({ longueur: V.creerChampValeur({ statut: S.NON_ACCESSIBLE }), diametre: V.creerChampValeur({ statut: S.A_VERIFIER }) });
  A(V.creerTronconVisite({}).longueur.statut === 'inconnu', '16. défaut = inconnu');
  A(t.longueur.statut === 'non_accessible' && t.longueur.valeur === null, '17. non_accessible (valeur null, pas 0)');
  A(V.creerTronconVisite({ section: V.creerChampValeur({ statut: S.NON_MESURE }) }).section.statut === 'non_mesure', '18. non_mesure');
  A(t.diametre.statut === 'a_verifier', '19. a_verifier');
}

// ---- 20/21. Provenance ≠ statut ; réel ≠ projeté --------------------------------
{
  const c = V.creerChampValeur({ valeur: 125, statut: S.MESURE, provenance: PR.MESURE_INSTRUMENTEE });
  A(c.statut === 'mesure' && c.provenance === 'mesure_instrumentee' && c.statut !== c.provenance, '20. provenance distincte du statut');
  const t = V.creerTronconVisite({ diametre: V.creerChampValeur({ valeur: 100, statut: S.MESURE }), diametreProjet: V.creerChampValeur({ valeur: 160, statut: S.DOCUMENTE }) });
  A(t.diametre.valeur === 100 && t.diametreProjet.valeur === 160, '21. réel (100) ≠ projeté (160)');
}

// ---- 22/23/24. Contradiction conservée / non arbitrée / référence tracée ---------
{
  const diam = V.creerChampObserve([{ valeur: 125, statut: S.RELEVE_DECLARATIF, provenance: PR.CLIENT }, { valeur: 160, statut: S.DOCUMENTE, provenance: PR.DOCUMENT_EXISTANT }], null);
  A(diam.observations.length === 2, '22. deux observations contradictoires conservées');
  const norm = V.normaliserVisiteVersReseau({ reseaux: [{ type: 'extraction', troncons: [V.creerTronconVisite({ id: 'T', longueur: cv(4, S.MESURE), diametre: diam })] }] });
  A(norm.donneesReseau.reseaux[0].troncons[0].diametre === null && norm.incoherences.length > 0, '23. contradiction non arbitrée → null + incohérence (pas de choix silencieux)');
  const diamRef = V.creerChampObserve(diam.observations, { valeur: 125, statut: S.RELEVE_DECLARATIF, choisiePar: 'technicien', raison: 'plaque conduit' });
  const norm2 = V.normaliserVisiteVersReseau({ reseaux: [{ type: 'extraction', troncons: [V.creerTronconVisite({ id: 'T', longueur: cv(4, S.MESURE), diametre: diamRef })] }] });
  A(norm2.donneesReseau.reseaux[0].troncons[0].diametre === 125, '24. référence explicite tracée → valeur utilisée');
}

// ---- 25/26/27/28. Persistance / restauration / IDs / références croisées ---------
{
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'double_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterReseauVisite(dv, { id: 'RI', type: 'insufflation' }); // DF : deux réseaux
  dv = V.ajouterNoeudVisite(dv, 'RE', { id: 'N1', type: 'collecteur' });
  dv = V.ajouterNoeudVisite(dv, 'RE', { id: 'N2', type: 'raccord_terminal' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', noeudAmont: 'N1', noeudAval: 'N2', role: 'antenne', pieceRef: 'sdb#1', longueur: cv(5.2, S.MESURE, PR.TECHNICIEN), diametre: V.creerChampValeur({ valeur: 125, statut: S.MESURE, provenance: PR.MESURE_INSTRUMENTEE }), diametreProjet: V.creerChampValeur({ valeur: 160, statut: S.DOCUMENTE }), typeConduit: 'souple' });
  dv = V.ajouterTerminalVisite(dv, 'RE', { id: 'TM1', pieceRef: 'sdb#1', fonction: 'SORTIE_AIR', reseauId: 'RE' });
  dv = V.ajouterMesureVisiteA(dv, { id: 'M1', pointId: 'TM1', grandeur: 'debit', valeur: 28, unite: 'm3/h', instrument: 'anemo' });
  dv = V.ajouterPhotoVisiteA(dv, { id: 'P1', objetType: 'terminal', objetId: 'TM1' });

  const rt = roundtrip(dv);
  A(JSON.stringify(rt) === JSON.stringify(dv), '25/26. persistance → restauration : équivalence exacte');
  A(rt.reseaux[0].id === 'RE' && rt.reseaux[0].troncons[0].id === 'T1' && rt.reseaux[0].terminaux[0].id === 'TM1', '27. IDs conservés');
  A(rt.reseaux[0].troncons[0].noeudAmont === 'N1' && rt.photos[0].objetId === 'TM1' && rt.mesures[0].pointId === 'TM1', '28. références croisées conservées');
  A(rt.reseaux[0].troncons[0].diametre.valeur === 125 && rt.reseaux[0].troncons[0].diametreProjet.valeur === 160, '25. réel + projeté conservés séparément');
  A(rt.reseaux[0].troncons[0].diametre.provenance === 'mesure_instrumentee' && rt.mesures[0].statut === 'mesure', '25. provenance/statut conservés');
  A(rt.reseaux[0].type === 'extraction' && rt.reseaux[1].type === 'insufflation', '32. DF : extraction + insufflation séparées après restauration');
}

// ---- 29/30. Normalisation + données inconnues → null/manque (jamais 0) -----------
{
  let dv = V.nouvelleVisiteVmc();
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1' /* longueur/diamètre inconnus */ });
  const res = V.resumeVisiteVmc(dv);
  A(res.statutVisite === 'incomplet' && res.donneesSuffisantes === false, '42. validation structurée : incomplet');
  A(res.donneesReseau.reseaux[0].troncons[0].longueur === null && res.donneesManquantes.some(d => /longueur/.test(d.champ)), '30. inconnu → null + manque signalé (jamais 0)');
  A(!/conforme|dimensionn|pression suffisante|installation valid/i.test(JSON.stringify(res)), '29. aucune conclusion de conformité/dimensionnement');
}

// ---- 36. Non-mutation lors de la normalisation ----------------------------------
{
  const dv = V.nouvelleVisiteVmc({ reseaux: [{ type: 'extraction', troncons: [{ id: 'T', longueur: { valeur: 4, statut: 'mesure' } }] }] });
  const snap = JSON.stringify(dv);
  V.normaliserVisiteVersReseau(dv); V.resumeVisiteVmc(dv);
  A(JSON.stringify(dv) === snap, '36. normalisation ne mute pas la visite');
}

// ---- 37/38. Visite partielle sauvegardable + reprise -----------------------------
{
  let dv = V.nouvelleVisiteVmc({ installation: { typeSysteme: 'simple_flux' } });
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  dv = V.ajouterTronconVisite(dv, 'RE', { id: 'T1', role: 'antenne', pieceRef: 'sdb#1', longueur: V.creerChampValeur({ statut: S.NON_ACCESSIBLE }) }); // partielle
  const rt = roundtrip(dv);
  A(rt.reseaux[0].troncons[0].longueur.statut === 'non_accessible', '37/38. visite partielle sauvegardée puis reprise (statut préservé)');
}

// ---- 31. SF : extraction + admission passive (pas de réseau mécanique d'insufflation)
{
  // Le modèle de visite ne fabrique pas de réseau insufflation en SF (type doit être fourni).
  let dv = V.nouvelleVisiteVmc();
  dv = V.ajouterReseauVisite(dv, { id: 'RE', type: 'extraction' });
  A(dv.reseaux.length === 1 && dv.reseaux[0].type === 'extraction' && !dv.reseaux.some(r => r.type === 'insufflation'), '31. SF : extraction seule (pas d\'insufflation mécanique inventée)');
}

// ---- 33/34/35. Aucune écriture piece.config / Runtime / catalogue (statique) -----
const SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteurs', 'vmc-public.js'), 'utf8');
const BLOC = SRC.slice(SRC.indexOf('function nouvelleVisiteVmc('));
A(!/getMoyenPrixFor|dimensionnementVMC|piece\.config|config\.vmc\s*=|VMC_BOUCHE|prixTotal|calculerPiece|moteur-devis|require\(|fetch\(|document\.|window\.|globalThis\./.test(BLOC), '33/34/35. couche LOT19 : aucun piece.config/Runtime/catalogue/prix/DOM');

// ---- Wiring persistance dans le configurateur (additif, hors piece.config) --------
const CONF = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
A(/donneesVisite:\s*donneesVisiteVmc/.test(CONF), 'wiring : saveEtat sérialise donneesVisite (additif)');
A(/if \(etat\.donneesVisite\) donneesVisiteVmc = etat\.donneesVisite/.test(CONF), 'wiring : restaurerEtat restaure donneesVisite');
A(!/piece\.config[^\n]*donneesVisite|donneesVisite[^\n]*piece\.config/.test(CONF), 'wiring : visite JAMAIS dans piece.config');

const total = ok + ko;
if (ko === 0) console.log('✅ Collecte/persistance visite VMC (M57 LOT19) : ' + ok + '/' + total + ' — actions immuables, persistance/reprise, hors money-path');
else { console.error('❌ Collecte/persistance visite VMC LOT19 : ' + ok + '/' + total); process.exit(1); }
