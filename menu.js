// menu.js – Gestion du menu burger avec accessibilité renforcée

(function() {
  function initMenu() {
    const menu = document.getElementById('menu');
    const btn = document.getElementById('menuBtn');
    if (!menu || !btn) return;

    // Fonction pour gérer le focus des liens
    function setMenuFocusable(isOpen) {
      const links = menu.querySelectorAll('a');
      links.forEach(link => {
        if (isOpen) {
          link.removeAttribute('tabindex');
        } else {
          link.setAttribute('tabindex', '-1');
        }
      });
    }

    // Initialisation : menu fermé, liens non focusables
    setMenuFocusable(false);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen);
      menu.setAttribute('aria-hidden', !isOpen);
      setMenuFocusable(isOpen);
    });

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-hidden', 'true');
        setMenuFocusable(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-hidden', 'true');
        setMenuFocusable(false);
        btn.focus(); // Remet le focus sur le bouton
      }
    });

    // Gestion des clics sur les liens pour fermer le menu
    menu.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-hidden', 'true');
        setMenuFocusable(false);
      }
    });
  }

  // Apparition des sections au défilement (fix : sans ça, les .section restent en opacity:0)
  function revealSections() {
    const sections = document.querySelectorAll('.section');
    if (!sections.length) return;

    // Navigateur sans IntersectionObserver : on affiche tout directement
    if (!('IntersectionObserver' in window)) {
      sections.forEach(function (s) { s.classList.add('visible'); });
      return;
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    sections.forEach(function (s) { obs.observe(s); });

    // Révèle immédiatement ce qui est déjà à l'écran au chargement
    requestAnimationFrame(function () {
      sections.forEach(function (s) {
        if (s.getBoundingClientRect().top < window.innerHeight * 0.9) {
          s.classList.add('visible');
        }
      });
    });

    // Filet de sécurité : après 1,2 s, tout est visible quoi qu'il arrive
    setTimeout(function () {
      sections.forEach(function (s) { s.classList.add('visible'); });
    }, 1200);
  }

  function init() {
    initMenu();
    revealSections();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();