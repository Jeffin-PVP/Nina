// Comportamento do menu lateral no mobile (backdrop, Esc, resize, acessibilidade).
(() => {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('btn-mobile-menu');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !toggle) return;

    const sync = () => toggle.setAttribute('aria-expanded', String(sidebar.classList.contains('open')));
    const close = () => { sidebar.classList.remove('open'); sync(); };

    new MutationObserver(sync).observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    backdrop?.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    window.matchMedia('(min-width: 721px)').addEventListener('change', e => { if (e.matches) close(); });
    sync();
})();
