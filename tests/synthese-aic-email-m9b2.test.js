// =====================================================================
// tests/synthese-aic-email-m9b2.test.js — Preuves M9-B2 (envoi e-mail de l'AIC)
// =====================================================================
// Deux volets :
//  1) STATIQUE — assertions sur la glue réelle extraite du HTML (source unique AIC,
//     aucun prix/Runtime/WhatsApp/genererPDFConfig, pièce jointe, _cc, consentement,
//     verrou, transport devis inchangé, PDF M9-B1 intact).
//  2) COMPORTEMENTAL — exécution de la VRAIE glue (eval) avec stubs DOM/html2pdf/
//     envoyerEmail pour prouver : consentement obligatoire, e-mail absent→captureModal,
//     destinataire/sujet/_cc, anti-double-clic, verrou concurrent, échec PDF→pas d'envoi,
//     état du bouton. html2pdf/fetch n'existant pas en Node, ils sont stubbés.
// =====================================================================

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'devis-configurateur.html'), 'utf8');
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// ============================ 1) STATIQUE ============================
const iExec = html.indexOf('function __executerPDFAIC(');
const iEnv = html.indexOf('function envoyerSyntheseAIC()');
const iPhase = html.indexOf('// ===== PHASE 3 — RÉCAPITULATIF =====');
const src = html.slice(iExec, iPhase);           // pipeline PDF + M9-B2
const fnEnv = html.slice(iEnv, iPhase);          // envoyerSyntheseAIC + reste
// Code sans commentaires (les commentaires citent volontairement « Runtime/WhatsApp/
// genererPDFConfig » pour dire qu'ils sont ÉVITÉS → on ne scanne que le code exécuté).
const srcCode = src.replace(/\/\/[^\n]*/g, '');

// A : source unique AIC (réutilise __construireAICCourant + rendre, aucun 2ᵉ assemblage)
A(/__construireAICCourant\(\)/.test(src) && /SyntheseAICUIDSBAT\.rendre\(aic\)/.test(src), 'A: source unique — __construireAICCourant + rendre(aic)');
A(src.indexOf('construireAIC(') === -1 || src.indexOf('SyntheseAICDSBAT.construireAIC') === -1, 'A: pas de reconstruction directe de l\'AIC dans M9-B2 (via helper uniquement)');

// B : PDF via le MÊME pipeline factorisé (html2pdf) ; blob pour l'e-mail
A(/__executerPDFAIC\('blob'/.test(fnEnv), 'B: e-mail utilise le pipeline PDF factorisé en mode blob');
A(/outputPdf\('blob'\)/.test(src) && /\.save\(\)/.test(src), 'B: pipeline unique gère outputPdf(blob) ET save() (M9-B1 préservé)');

// C : nom de pièce jointe
A(/envoyerEmail\([^;]*'Synthese_AIC_DSBAT\.pdf'\)/.test(fnEnv.replace(/\n/g, ' ')), 'C: pièce jointe = Synthese_AIC_DSBAT.pdf');

// D/E : destinataire société (endpoint inchangé) + _cc client
A(html.indexOf("MAIL_URL = 'https://formsubmit.co/ajax/contact@dsbat.fr'") !== -1, 'D: destinataire société = endpoint existant (inchangé)');
A(/_cc:\s*email/.test(fnEnv), 'E: e-mail client transmis en _cc');
A(/\/\^\\S\+@\\S\+\\\.\\S\+\$\//.test(html.slice(html.indexOf('function __emailClientValide'), iExec + 0) || html) || /__emailClientValide/.test(fnEnv), 'G: validation e-mail via __emailClientValide (regex)');

// F : e-mail absent/invalide → réutilise ouvrirCaptureModal (pas de nouveau formulaire)
A(/ouvrirCaptureModal\(\)/.test(fnEnv), 'F: absence d\'e-mail → ouvrirCaptureModal() existant');

// H/I : consentement obligatoire, aucun envoi sans consentement
A(/getElementById\('consentEmailAIC'\)/.test(fnEnv) && /!chk\.checked\) return/.test(fnEnv.replace(/\s+/g, ' ')), 'H/I: consentement obligatoire, retour si non coché');

// J/K : verrou anti-double-envoi dédié
A(/var __envoiAICEnCours = false/.test(src) && /if \(__envoiAICEnCours\) return/.test(fnEnv), 'J/K: verrou __envoiAICEnCours (anti double-clic / concurrent)');
A(fnEnv.indexOf('__recapEnvoye') === -1, 'J/K: le verrou M9-B2 ne touche pas __recapEnvoye (e-mail auto du devis)');

// L : aucun prix produit (code exécuté, hors commentaires)
A(!/formatEuro|totalHT|\bttc\b|calculerDevis|getMoyenPrix/i.test(srcCode), 'L: aucun prix / formatEuro / total produit');
A(srcCode.indexOf('€') === -1, 'L: aucun « € » écrit par M9-B2');

// M/N : aucun Runtime ni calcul métier (code exécuté, hors commentaires)
A(!/__obtenirDevisRuntime|Runtime|coefZone|calculerPiece|piece\.totalHT/.test(srcCode), 'M/N: aucun Runtime / calcul métier');

// O : aucun WhatsApp (code exécuté, hors commentaires)
A(!/wa\.me|whatsapp|window\.open/i.test(srcCode), 'O: aucun WhatsApp / window.open');

// P : aucune réutilisation de genererPDFConfig / envoyerNotifications (code exécuté)
A(!/genererPDFConfig|envoyerNotifications/.test(srcCode), 'P: n\'appelle jamais genererPDFConfig / envoyerNotifications');

// R : transport existant non cassé (signature envoyerEmail inchangée)
A(/function envoyerEmail\(subject, fields, pdfBlob, nomPdf\)/.test(html), 'R: envoyerEmail(subject,fields,pdfBlob,nomPdf) inchangé');

// S : PDF M9-B1 toujours téléchargeable
A(/function genererPDFAIC\(\) \{ __executerPDFAIC\('save'\); \}/.test(html), 'S: genererPDFAIC() → __executerPDFAIC(save) (téléchargement conservé)');
A(html.indexOf('onclick="genererPDFAIC()"') !== -1, 'S: bouton « Télécharger la synthèse PDF » toujours présent');

// P (devis) : PDF devis inchangé
A(html.indexOf('function genererPDFConfig()') !== -1 && /Devis_DSBAT_\$\{numero\}\.pdf/.test(html), 'P: PDF devis (genererPDFConfig) présent et inchangé');

// UI : bouton e-mail + case, hors #recapGlobal, bouton initialement désactivé
const iActions = html.indexOf('id="recapAICActions"');
const iBtnMail = html.indexOf('id="btnEnvoiAIC"');
const iConsent = html.indexOf('id="consentEmailAIC"');
const iRecapGlobal = html.indexOf('id="recapGlobal"');
A(iActions !== -1 && iBtnMail > iActions && iConsent > iActions && iBtnMail < iRecapGlobal && iConsent < iRecapGlobal, 'UI: bouton e-mail + consentement dans #recapAICActions, hors #recapGlobal');
A(/id="btnEnvoiAIC"[^>]*disabled/.test(html), 'UI: bouton e-mail initialement désactivé (avant consentement)');
A(html.indexOf("J'accepte l'envoi de cette synthèse par e-mail à DS.BAT") !== -1, 'UI: mention de consentement explicite présente');

// ============================ 2) COMPORTEMENTAL ============================
// Stubs
let emailCalls = [];
let captureOuverte = 0;
let blobResult = { size: 4242 };   // configurable par test
global.envoyerEmail = (subject, fields, pdfBlob, nomPdf) => { emailCalls.push({ subject, fields, pdfBlob, nomPdf }); };
global.ouvrirCaptureModal = () => { captureOuverte++; };
global.SyntheseAICUIDSBAT = { rendre: () => '<div>corps AIC</div>' };
global.__construireAICCourant = () => ({ genereLe: '2026-01-01T00:00:00Z', declare: {}, interprete: {}, confirme: {}, configure: {}, prestations: {}, aVerifierVisite: [] });
const els = {};
function fakeEl() { return { checked: false, disabled: false, textContent: '', style: {}, parentNode: { removeChild() {} } }; }
global.document = {
  getElementById: (id) => (els[id] = els[id] || fakeEl()),
  createElement: () => ({ style: {}, set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; } }),
  body: { appendChild() {}, removeChild() {} },
  head: { appendChild() {} }
};
const worker = {
  from() { return this; },
  set() { return this; },
  outputPdf() { return Promise.resolve(blobResult); },
  save() { return Promise.resolve(); }
};
global.html2pdf = () => worker;
global.window = { html2pdf: global.html2pdf };
let store = {};
global.sessionStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };

// Installer la vraie glue
eval(src);

const tick = () => new Promise((r) => setImmediate(r));
function reset(clientObj, consent) {
  emailCalls = []; captureOuverte = 0; blobResult = { size: 4242 };
  store = {}; if (clientObj) store['client'] = JSON.stringify(clientObj);
  els['btnEnvoiAIC'] = fakeEl();
  els['consentEmailAIC'] = fakeEl(); els['consentEmailAIC'].checked = !!consent;
  __envoiAICEnCours = false;
}

(async function () {
  // I : aucun envoi sans consentement
  reset({ nom: 'Lea', email: 'lea@ex.fr' }, false);
  envoyerSyntheseAIC(); await tick(); await tick();
  A(emailCalls.length === 0, 'I(comportement): case non cochée → aucun envoi');

  // F : consentement OK mais e-mail absent → captureModal, aucun envoi
  reset({ nom: 'Lea' }, true);   // pas d'email
  envoyerSyntheseAIC(); await tick(); await tick();
  A(emailCalls.length === 0 && captureOuverte === 1, 'F(comportement): e-mail absent → ouvrirCaptureModal, aucun envoi');

  // G : e-mail invalide → captureModal
  reset({ nom: 'Lea', email: 'pas-un-email' }, true);
  envoyerSyntheseAIC(); await tick(); await tick();
  A(emailCalls.length === 0 && captureOuverte === 1, 'G(comportement): e-mail invalide → captureModal, aucun envoi');

  // D/E + C : envoi nominal → 1 e-mail, sujet « Synthèse », _cc, pièce jointe
  reset({ nom: 'Lea', email: 'lea@ex.fr' }, true);
  envoyerSyntheseAIC(); await tick(); await tick();
  A(emailCalls.length === 1, 'D(comportement): envoi nominal → 1 e-mail');
  const c0 = emailCalls[0] || { fields: {} };
  A(/Synth[eè]se/i.test(c0.subject) && !/€|devis|TTC|TVA/i.test(c0.subject), 'D: sujet « Synthèse » sans prix/devis');
  A(c0.fields && c0.fields._cc === 'lea@ex.fr', 'E: _cc = e-mail client valide');
  A(c0.nomPdf === 'Synthese_AIC_DSBAT.pdf' && c0.pdfBlob && c0.pdfBlob.size > 0, 'C: pièce jointe = Synthese_AIC_DSBAT.pdf (blob)');
  A(!/€|formatEuro|TTC|TVA|HT/.test(JSON.stringify(c0.fields)), 'L(comportement): corps e-mail sans prix');

  // J/K : anti-double-clic — deux appels synchrones → un seul envoi
  reset({ nom: 'Lea', email: 'lea@ex.fr' }, true);
  envoyerSyntheseAIC(); envoyerSyntheseAIC(); // 2e appel pendant le verrou
  await tick(); await tick();
  A(emailCalls.length === 1, 'J/K(comportement): double appel → un seul envoi (verrou)');

  // U : état du bouton pendant l'envoi puis après
  reset({ nom: 'Lea', email: 'lea@ex.fr' }, true);
  envoyerSyntheseAIC();
  A(els['btnEnvoiAIC'].disabled === true && /Envoi en cours/.test(els['btnEnvoiAIC'].textContent), 'U: bouton désactivé + « Envoi en cours… » pendant l\'opération');
  await tick(); await tick();
  A(/transmise/i.test(els['btnEnvoiAIC'].textContent), 'U: après envoi → « Synthèse transmise »');

  // T : échec génération PDF (blob null) → aucun envoi, bouton restauré
  reset({ nom: 'Lea', email: 'lea@ex.fr' }, true);
  blobResult = null;
  envoyerSyntheseAIC(); await tick(); await tick();
  A(emailCalls.length === 0 && __envoiAICEnCours === false && els['btnEnvoiAIC'].disabled === false, 'T: PDF échoué (blob null) → aucun envoi, verrou libéré, bouton restauré');

  // Q : le mécanisme ne mute pas l'objet AIC (chaîne partagée, rendre pur) — contrôle de non-mutation
  const aicRef = global.__construireAICCourant();
  const gel = JSON.stringify(aicRef);
  global.__construireAICCourant = () => aicRef;
  reset({ nom: 'Lea', email: 'lea@ex.fr' }, true);
  envoyerSyntheseAIC(); await tick(); await tick();
  A(JSON.stringify(aicRef) === gel, 'Q: objet AIC non muté par l\'envoi');

  const total = ok + ko;
  if (ko === 0) console.log('✅ E-mail Synthèse AIC (M9-B2) : ' + ok + '/' + total + ' — source AIC unique, consentement+verrou, sans prix/Runtime/WhatsApp, devis intact');
  else console.error('❌ M9-B2 : ' + ok + '/' + total);
  process.exit(ko === 0 ? 0 : 1);
})();
