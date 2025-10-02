// shared-functions.js
import { products } from './products-data.js';

let cart = JSON.parse(sessionStorage.getItem('shoppingCart')) || [];

function saveCartToSession() {
    sessionStorage.setItem('shoppingCart', JSON.stringify(cart));
}

export function updateCartInfo() {
    const cartCountElement = document.getElementById('cart-count');
    const cartTotalValueElement = document.getElementById('cart-total-value');
    if (cartCountElement) cartCountElement.textContent = cart.length;
    if (cartTotalValueElement) {
        const total = cart.reduce((sum, item) => sum + Number(item.price), 0);
        cartTotalValueElement.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }
}

// NO ARQUIVO shared-functions.js
// SUBSTITUA A FUNÇÃO ATUAL PELA VERSÃO ABAIXO:

window.addToCart = function(event, productId) {
    // Encontra o produto COMPLETO na nossa lista de produtos
    const product = products.find(p => p.id === productId);
    if (!product) {
        console.error("Produto não encontrado!");
        return;
    }
    
    // Adiciona o objeto INTEIRO do produto ao carrinho
    cart.push(product); 
    
    saveCartToSession();
    updateCartInfo();
    
    // Animação...
    const card = event.target.closest('.card');
    if (!card) return;
    const productImage = card.querySelector('img');
    const endElement = document.querySelector('.fa-bag-shopping');
    if (!productImage || !endElement) return;
    
    const startRect = productImage.getBoundingClientRect();
    const endRect = endElement.getBoundingClientRect();
    const flyingImage = productImage.cloneNode();
    
    flyingImage.classList.add('flying-image');
    document.body.appendChild(flyingImage);
    
    flyingImage.style.left = `${startRect.left}px`;
    flyingImage.style.top = `${startRect.top}px`;
    flyingImage.style.width = `${startRect.width}px`;
    flyingImage.style.height = `${startRect.height}px`;
    
    requestAnimationFrame(() => {
        flyingImage.style.left = `${endRect.left + 15}px`;
        flyingImage.style.top = `${endRect.top + 10}px`;
        flyingImage.style.width = '20px';
        flyingImage.style.height = '20px';
        flyingImage.style.opacity = '0';
    });
    
    setTimeout(() => { flyingImage.remove(); }, 600);
};

window.openLightbox = function(src) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    if (lb && img) {
        img.src = src;
        lb.classList.remove('hidden');
    }
};

window.closeLightbox = function() {
    const lb = document.getElementById('lightbox');
    if (lb) lb.classList.add('hidden');
};


// No final do arquivo shared-functions.js

// Inicializa o cabeçalho
document.addEventListener('DOMContentLoaded', () => {
    updateCartInfo();

    // ADICIONE ESTE TRECHO ABAIXO
    const authLink = document.getElementById('auth-link');
    if (authLink) {
        authLink.addEventListener('click', (e) => {
            e.preventDefault(); // Impede que a página recarregue
            if (typeof window.openAuthModal === 'function') {
                window.openAuthModal();
            }
        });
    }

    // 👇 ADICIONE ESTA LINHA 👇
    setupSearch(); 

    const menuTrigger = document.getElementById('user-menu-trigger');
    // ... (resto da lógica do dropdown) ...
});


// Função para fazer a barra de busca funcionar
function setupSearch() {
    const searchInput = document.querySelector('.header-search input');
    const searchButton = document.querySelector('.header-search button');

    if (!searchInput || !searchButton) return;

    const performSearch = () => {
        const query = searchInput.value.trim();
        if (query) {
            window.location.href = `produtos.html?search=${encodeURIComponent(query)}`;
        }
    };

    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            performSearch();
        }
    });
}

// --- LÓGICA DO BOTÃO FLUTUANTE DO WHATSAPP ---

// Pega o botão do WhatsApp
const whatsappBtn = document.getElementById('whatsapp-float-btn');

// Escuta o evento de rolagem da página
window.addEventListener('scroll', () => {
    // Se o botão existir na página
    if (whatsappBtn) {
        // Se o usuário rolou mais de 200 pixels para baixo
        if (window.scrollY > 200) {
            // Mostra o botão
            whatsappBtn.classList.add('show');
        } else {
            // Esconde o botão
            whatsappBtn.classList.remove('show');
        }
    }
});