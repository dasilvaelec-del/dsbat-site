// tests/ux-accordeon-metiers-ferme.test.js — UX Configuration : tous les corps de
// métier FERMÉS par défaut. Exécute les vraies fonctions renderMetierSection /
// toggleSection extraites du configurateur. Aucun contenu/moteur modifié.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// --- Extraction d'une fonction top-level du HTML (jusqu'à la prochaine `function `) ---
function extraireFonction(nom) {
  const start = HTML.indexOf('function ' + nom + '(');
  if (start === -1) return null;
  const next = HTML.indexOf('\nfunction ', start + 1);
  return HTML.slice(start, next === -1 ? undefined : next);
}

// --- État initial réel = classe CSS `open` (pas un simple masquage visuel) ---
A(/\.metier-section-body\s*\{\s*display:\s*none;/.test(HTML), 'CSS : corps de section masqué par défaut (display:none)');
A(/\.metier-section\.open\s+\.metier-section-body\s*\{\s*display:\s*block;/.test(HTML), 'CSS : corps visible UNIQUEMENT si la classe .open est présente (vrai état accordéon)');

// --- Aucune section n'est rendue avec la classe open ---
A(!/metier-section open/.test(HTML), 'aucune section métier construite avec la classe "open" (aucun métier ouvert par défaut)');

// ===== Exécuter le vrai renderMetierSection sur les sections auto (peinture/sols) =====
const srcRender = extraireFonction('renderMetierSection');
A(!!srcRender, 'renderMetierSection extractible');
// stubs de contenu : on ne teste QUE l'état d'ouverture, pas le contenu interne
const sandbox = {
  renderPeintureAuto: () => '<!--PEINTURE_CONTENU-->',
  renderSolsAuto: () => '<!--SOLS_CONTENU-->'
};
const vm = require('vm');
vm.createContext(sandbox);
vm.runInContext(srcRender + '\nthis.__render = renderMetierSection;', sandbox);
const render = sandbox.__render;

const secPeinture = { metier: 'peinture', auto: true, autoType: 'peinture', icon: '🎨', label: 'Revêtement mural' };
const secSols = { metier: 'sols', auto: true, autoType: 'sols', icon: '🪵', label: 'Revêtement de sol' };
const htmlP = render(secPeinture, 0);
const htmlS = render(secSols, 0);

// 2. Peinture fermée
A(/class="metier-section"/.test(htmlP) && !/metier-section open/.test(htmlP), '2. Peinture : rendue FERMÉE (class="metier-section", pas de open)');
// 3. Revêtements de sol fermé
A(/class="metier-section"/.test(htmlS) && !/metier-section open/.test(htmlS), '3. Revêtements de sol : rendu FERMÉ');
// 1. au chargement, aucun métier ouvert (les deux seules sections auto-ouvertes ne le sont plus)
A(!/metier-section open/.test(htmlP + htmlS), '1. au chargement initial : aucun métier ouvert');
// 7. contenu inchangé : le corps et les rendus internes sont toujours présents
A(/<div class="metier-section-body">/.test(htmlP) && htmlP.includes('<!--PEINTURE_CONTENU-->'), '7. contenu Peinture inchangé (corps + renderPeintureAuto toujours appelés)');
A(/<div class="metier-section-body">/.test(htmlS) && htmlS.includes('<!--SOLS_CONTENU-->'), '7. contenu Sols inchangé (corps + renderSolsAuto toujours appelés)');
// en-tête + chevron toujours présents (accordéon inchangé)
A(/toggleSection\('sec_0_peinture'\)/.test(htmlP) && /class="chevron"/.test(htmlP), 'en-tête + flèche conservés (toggleSection câblé)');

// 4. Les autres métiers (branche non-auto) restent fermés : la source ne construit
//    QUE des `class="metier-section"` (aucun `open`), déjà vérifié globalement + ici :
const brancheNonAuto = srcRender.slice(srcRender.lastIndexOf('return `'));
A(/class="metier-section"/.test(brancheNonAuto) && !/metier-section open/.test(brancheNonAuto), '4. autres métiers (électricité/plomberie/VMC/chauffage/…) : rendus fermés');

// ===== 5 & 6 : toggleSection ouvre puis ferme (comportement générique conservé) =====
const srcToggle = extraireFonction('toggleSection');
A(!!srcToggle, 'toggleSection extractible');
function classListShim() {
  const set = new Set();
  return {
    _set: set,
    add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c),
    toggle: c => { if (set.has(c)) { set.delete(c); return false; } set.add(c); return true; }
  };
}
const el = { classList: classListShim() };
const sb2 = { document: { getElementById: () => el } };
vm.createContext(sb2);
vm.runInContext(srcToggle + '\nthis.__toggle = toggleSection;', sb2);
const toggle = sb2.__toggle;
A(el.classList.contains('open') === false, 'état initial de l\'élément = fermé');
toggle('sec_0_peinture');
A(el.classList.contains('open') === true, '5. un clic ouvre le métier (classe open ajoutée)');
toggle('sec_0_peinture');
A(el.classList.contains('open') === false, '6. un second clic ferme le métier (classe open retirée)');

console.log('ux-accordeon-metiers-ferme : ' + ok + ' OK, ' + ko + ' KO');
process.exit(ko ? 1 : 0);
