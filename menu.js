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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMenu);
  } else {
    initMenu();
  }
})();