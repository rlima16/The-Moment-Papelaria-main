// produtos-page.js
import { products } from './products-data.js';
import { updateCartInfo } from './shared-functions.js';

document.addEventListener('DOMContentLoaded', () => {
    displayAllProducts();
    window.addEventListener('cartUpdated', updateCartInfo);
});

function displayAllProducts() {
    const productsList = document.getElementById('all-products-list');
    if (!productsList) return;

    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search')?.toLowerCase() || '';
    
    const filteredProducts = searchQuery
        ? products.filter(p => p.title.toLowerCase().includes(searchQuery))
        : products;

    productsList.innerHTML = '';
    if (filteredProducts.length === 0) {
        productsList.innerHTML = `<p>Nenhum produto encontrado para "${searchQuery}".</p>`;
        return;
    }

    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img src="${product.image}" alt="${product.title}">
            <h3>${product.title}</h3>
            <p>R$ ${Number(product.price).toFixed(2).replace('.', ',')}</p>
            <button class="btn">Adicionar ao Carrinho</button>
        `;
        card.querySelector('img').addEventListener('click', () => window.openLightbox(product.image));
        card.querySelector('button').addEventListener('click', (event) => window.addToCart(event, product.id));
        productsList.appendChild(card);
    });
}