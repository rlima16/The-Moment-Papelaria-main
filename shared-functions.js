// shared-functions.js (VERSÃO FINAL CENTRALIZADA)

let cart = JSON.parse(sessionStorage.getItem('shoppingCart')) || [];

function saveCartToSession() {
    sessionStorage.setItem('shoppingCart', JSON.stringify(cart));
}

export function updateCartInfo() {
    const cartCountElement = document.getElementById('cart-count');
    const cartTotalValueElement = document.getElementById('cart-total-value');
    if (!cartCountElement || !cartTotalValueElement) return;
    const total = cart.reduce((sum, item) => sum + Number(item.price), 0);
    cartCountElement.textContent = cart.length;
    cartTotalValueElement.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

window.addToCart = function(event, productObject) {
    if (!productObject) return;
    cart.push(productObject);
    saveCartToSession();
    updateCartInfo();
    const card = event.target.closest('.card');
    if (!card) return;
    const productImage = card.querySelector('img');
    const endElement = document.querySelector('.fa-bag-shopping');
    if (!productImage || !endElement) return;
    const flyingImage = productImage.cloneNode();
    flyingImage.classList.add('flying-image');
    document.body.appendChild(flyingImage);
    const startRect = productImage.getBoundingClientRect();
    const endRect = endElement.getBoundingClientRect();
    flyingImage.style.left = `${startRect.left}px`;
    flyingImage.style.top = `${startRect.top}px`;
    flyingImage.style.width = `${startRect.width}px`;
    requestAnimationFrame(() => {
        flyingImage.style.left = `${endRect.left + 15}px`;
        flyingImage.style.top = `${endRect.top + 10}px`;
        flyingImage.style.width = '20px';
        flyingImage.style.opacity = '0';
    });
    setTimeout(() => { flyingImage.remove(); }, 600);
};

window.openLightbox = function(src) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    if (lb && img) { img.src = src; lb.classList.remove('hidden'); }
};

window.closeLightbox = function() {
    const lb = document.getElementById('lightbox');
    if (lb) lb.classList.add('hidden');
};

// NO ARQUIVO shared-functions.js
// SUBSTITUA A LÓGICA DO BOTÃO FLUTUANTE POR ESTA:

// Pega TODOS os botões flutuantes
const floatingBtns = document.querySelectorAll('.floating-btn');

// Escuta o evento de rolagem da página
window.addEventListener('scroll', () => {
    // Se encontrou botões
    if (floatingBtns.length > 0) {
        // Para cada botão encontrado...
        floatingBtns.forEach(btn => {
            // Se o usuário rolou mais de 200 pixels para baixo
            if (window.scrollY > 200) {
                // Mostra o botão
                btn.classList.add('show');
            } else {
                // Esconde o botão
                btn.classList.remove('show');
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    updateCartInfo();
    setupSearch(); 
    const authLink = document.getElementById('auth-link');
    if (authLink) {
        authLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof window.openAuthModal === 'function') { window.openAuthModal(); }
        });
    }
    const menuTrigger = document.getElementById('user-menu-trigger');
    const dropdown = document.getElementById('user-dropdown');
    if (menuTrigger && dropdown) {
        menuTrigger.addEventListener('click', (event) => {
            event.stopPropagation();
            dropdown.classList.toggle('hidden');
        });
    }
});

window.addEventListener('click', () => {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        dropdown.classList.add('hidden');
    }
});

function setupSearch() {
    const searchInput = document.querySelector('.header-search input');
    const searchButton = document.querySelector('.header-search button');
    if (!searchInput || !searchButton) return;
    const performSearch = () => {
        const query = searchInput.value.trim();
        if (query) { window.location.href = `produtos.html?search=${encodeURIComponent(query)}`; }
    };
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') { performSearch(); }
    });
}