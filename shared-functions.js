// shared-functions.js — funções usadas em todas as páginas

// Endereços limpos: se alguém abrir /pagina.html, mostra só /pagina na barra de endereço
if (/\.html$/.test(window.location.pathname)) {
    const limpo = window.location.pathname.replace(/index\.html$/, '').replace(/\.html$/, '');
    history.replaceState(null, '', limpo + window.location.search + window.location.hash);
}

let cart = [];
try { cart = JSON.parse(sessionStorage.getItem('shoppingCart')) || []; } catch (e) { cart = []; }

function saveCartToSession() {
    try { sessionStorage.setItem('shoppingCart', JSON.stringify(cart)); } catch (e) { /* navegação privada */ }
}

export const formatPrice = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

// Nome bonito (com acento) e ícone de cada categoria salva no banco
export const CATEGORY_INFO = {
    'Herois':          { label: 'Heróis',          icon: 'fa-mask' },
    'Princesas':       { label: 'Princesas',       icon: 'fa-crown' },
    'Anime':           { label: 'Anime',           icon: 'fa-dragon' },
    'Disney':          { label: 'Disney',          icon: 'fa-wand-magic-sparkles' },
    'Turma da Monica': { label: 'Turma da Mônica', icon: 'fa-children' },
    'Desenhos':        { label: 'Desenhos',        icon: 'fa-palette' },
    'Jogos':           { label: 'Jogos',           icon: 'fa-gamepad' },
    'Carros':          { label: 'Carros',          icon: 'fa-car-side' },
    'Cha de Bebe':     { label: 'Chá de Bebê',     icon: 'fa-baby' },
    'Diversos':        { label: 'Diversos',        icon: 'fa-cake-candles' },
};
export const categoryLabel = (c) => (CATEGORY_INFO[c] && CATEGORY_INFO[c].label) || c || '';
export const categoryIcon = (c) => (CATEGORY_INFO[c] && CATEGORY_INFO[c].icon) || 'fa-star';

export const isInCart = (id) => cart.some(item => item.id === id);

export function updateCartInfo() {
    const countEl = document.getElementById('cart-count');
    const totalEl = document.getElementById('cart-total-value');
    const total = cart.reduce((sum, item) => sum + Number(item.price), 0);
    if (countEl) {
        countEl.textContent = cart.length;
        countEl.classList.toggle('hidden', cart.length === 0);
    }
    if (totalEl) totalEl.textContent = formatPrice(total);
}

// Mostra um aviso rápido na tela (substitui os alert())
export function showToast(message, withCartLink = false) {
    let toast = document.getElementById('site-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'site-toast';
        toast.className = 'site-toast';
        toast.setAttribute('role', 'status');
        document.body.appendChild(toast);
    }
    toast.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = message;
    toast.appendChild(span);
    if (withCartLink) {
        const link = document.createElement('a');
        link.href = '/carrinho';
        link.textContent = 'Ver carrinho →';
        toast.appendChild(link);
    }
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}
window.showToast = showToast;

function markButtonsInCart(id) {
    document.querySelectorAll(`[data-add-id="${id}"]`).forEach(btn => {
        btn.classList.add('in-cart');
        btn.innerHTML = '<i class="fas fa-check"></i> No carrinho';
    });
}

window.addToCart = function(event, productObject) {
    if (!productObject) return;

    // Arquivo digital: não faz sentido comprar o mesmo arquivo duas vezes
    if (isInCart(productObject.id)) {
        showToast('Este arquivo já está no seu carrinho.', true);
        return;
    }

    cart.push({
        id: productObject.id,
        title: productObject.title,
        price: Number(productObject.price),
        image: productObject.image
    });
    saveCartToSession();
    updateCartInfo();
    markButtonsInCart(productObject.id);
    showToast(`"${productObject.title}" foi adicionado ao carrinho!`, true);

    const badge = document.querySelector('#cart-link-header .action-icon');
    if (badge) { badge.classList.remove('cart-pop'); void badge.offsetWidth; badge.classList.add('cart-pop'); }

    // Animação da imagem "voando" até o carrinho
    const card = event?.target?.closest('.card');
    const productImage = card ? card.querySelector('img') : document.getElementById('product-image');
    const endElement = document.querySelector('#cart-link-header .action-icon');
    if (!productImage || !endElement) return;
    const flyingImage = productImage.cloneNode();
    flyingImage.removeAttribute('id');
    flyingImage.classList.add('flying-image');
    document.body.appendChild(flyingImage);
    const startRect = productImage.getBoundingClientRect();
    const endRect = endElement.getBoundingClientRect();
    flyingImage.style.left = `${startRect.left}px`;
    flyingImage.style.top = `${startRect.top}px`;
    flyingImage.style.width = `${startRect.width}px`;
    flyingImage.style.height = `${startRect.height}px`;
    requestAnimationFrame(() => {
        flyingImage.style.left = `${endRect.left + 8}px`;
        flyingImage.style.top = `${endRect.top + 8}px`;
        flyingImage.style.width = '26px';
        flyingImage.style.height = '26px';
        flyingImage.style.opacity = '0.2';
    });
    setTimeout(() => flyingImage.remove(), 650);
};

// Card de produto padrão (usado na home, catálogo e relacionados)
export function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'card';
    const inCart = isInCart(product.id);
    card.innerHTML = `
        <a href="/produto-detalhe?id=${encodeURIComponent(product.id)}" class="card-link">
            <div class="card-media">
                <span class="digital-badge"><i class="fas fa-file-arrow-down"></i> Digital</span>
                <img src="${product.image}" alt="" loading="lazy" decoding="async">
            </div>
            <h3></h3>
        </a>
        <div class="card-footer">
            <div class="card-price"><strong>${formatPrice(product.price)}</strong><small>à vista</small></div>
            <button class="btn add-to-cart-btn${inCart ? ' in-cart' : ''}" data-add-id="${product.id}">
                ${inCart ? '<i class="fas fa-check"></i> No carrinho' : '<i class="fa-solid fa-bag-shopping"></i> Adicionar'}
            </button>
        </div>
    `;
    card.querySelector('h3').textContent = product.title;
    card.querySelector('img').alt = product.title;
    card.querySelector('.add-to-cart-btn').addEventListener('click', (event) => {
        if (isInCart(product.id)) { window.location.href = '/carrinho'; return; }
        window.addToCart(event, product);
    });
    return card;
}

window.openLightbox = function(src) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    if (lb && img) { img.src = src; lb.classList.remove('hidden'); }
};
window.closeLightbox = function() {
    const lb = document.getElementById('lightbox');
    if (lb) lb.classList.add('hidden');
};

// Animação suave das seções ao rolar a página
export function observeReveal(root = document) {
    const items = root.querySelectorAll('.reveal:not(.is-visible)');
    if (!('IntersectionObserver' in window)) { items.forEach(el => el.classList.add('is-visible')); return; }
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(el => io.observe(el));
}

function setupSearch() {
    const searchInput = document.querySelector('.header-search input');
    const searchButton = document.querySelector('.header-search button');
    if (!searchInput || !searchButton) return;
    const performSearch = () => {
        const q = searchInput.value.trim();
        if (q) window.location.href = `/produtos?search=${encodeURIComponent(q)}`;
    };
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') performSearch(); });
}

function setupAccountMenu() {
    const container = document.getElementById('user-actions-container');
    const dropdown = document.getElementById('user-dropdown');
    const authLink = document.getElementById('auth-link');
    if (!container) return;
    const isLoggedIn = () => authLink && authLink.classList.contains('hidden');
    const handle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLoggedIn()) {
            dropdown && dropdown.classList.toggle('hidden');
        } else if (typeof window.openAuthModal === 'function') {
            window.openAuthModal();
        }
    };
    container.addEventListener('click', handle);
    container.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') handle(e); });
    window.addEventListener('click', () => { if (dropdown) dropdown.classList.add('hidden'); });
    if (dropdown) dropdown.addEventListener('click', (e) => e.stopPropagation());
}

// Fecha o modal de login com ESC ou clicando fora
function setupModalClose() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal && window.closeAuthModal) window.closeAuthModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (window.closeAuthModal) window.closeAuthModal();
        window.closeLightbox();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    updateCartInfo();
    setupSearch();
    setupAccountMenu();
    setupModalClose();
    observeReveal();
});
