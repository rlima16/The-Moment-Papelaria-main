// produtos-page.js ATUALIZADO COM PAGINAÇÃO COMPLETA (ANTERIOR E PRÓXIMA)

import { db } from './firebase-auth.js';
import { collection, query, orderBy, limit, getDocs, startAfter } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// --- VARIÁVEIS DE CONTROLE DA PAGINAÇÃO ---
const productsPerPage = 20;
let pageHistory = [null]; // Guarda o ponto de início de cada página. 'null' é o início da primeira.
let currentPageIndex = 0; // Indica em qual página estamos no histórico.
let lastVisibleProduct = null; // Guarda o último produto da página atual.
let isFetching = false;

/**
 * Função principal que busca e desenha os produtos na tela.
 * A direção da navegação é controlada pelo currentPageIndex.
 */
async function fetchAndDisplayProducts() {
    if (isFetching) return;
    isFetching = true;

    const productsList = document.getElementById('all-products-list');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    
    productsList.innerHTML = '<p>Carregando produtos...</p>';
    prevPageBtn.disabled = true; // Desabilita os botões durante o carregamento
    nextPageBtn.disabled = true;

    try {
        const startAtDoc = pageHistory[currentPageIndex]; // Pega o ponto de início da página atual no histórico
        let productQuery;

        if (startAtDoc) {
            productQuery = query(collection(db, "products"), orderBy("title"), startAfter(startAtDoc), limit(productsPerPage));
        } else {
            // Se o ponto de início for 'null', é a primeira página
            productQuery = query(collection(db, "products"), orderBy("title"), limit(productsPerPage));
        }

        const querySnapshot = await getDocs(productQuery);
        const products = [];
        querySnapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
        });

        productsList.innerHTML = '';

        if (products.length > 0) {
            lastVisibleProduct = querySnapshot.docs[querySnapshot.docs.length - 1]; // Guarda o último item desta página
            products.forEach(product => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <img src="${product.image}" alt="${product.title}">
                    <h3>${product.title}</h3>
                    <p>R$ ${Number(product.price).toFixed(2).replace('.', ',')}</p>
                    <button class="btn">Adicionar ao Carrinho</button>
                `;
                card.querySelector('img').addEventListener('click', () => window.openLightbox(product.image));
                card.querySelector('button').addEventListener('click', (event) => window.addToCart(event, product));
                productsList.appendChild(card);
            });
        }

        // Atualiza o estado dos botões
        prevPageBtn.disabled = (currentPageIndex === 0); // Desabilita "Anterior" se estiver na primeira página
        nextPageBtn.disabled = (querySnapshot.docs.length < productsPerPage); // Desabilita "Próxima" se for a última página

    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
        productsList.innerHTML = `<p>Ocorreu um erro ao carregar os produtos.</p>`;
    } finally {
        isFetching = false;
    }
}

// --- INICIALIZAÇÃO DA PÁGINA ---
document.addEventListener('DOMContentLoaded', () => {
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');

    // Ação do botão "Próxima Página"
    nextPageBtn.addEventListener('click', () => {
        // Antes de buscar, adiciona o último item da pág. atual como o início da próxima
        if (lastVisibleProduct && currentPageIndex === pageHistory.length - 1) {
            pageHistory.push(lastVisibleProduct);
        }
        currentPageIndex++;
        fetchAndDisplayProducts();
    });
    
    // Ação do botão "Página Anterior"
    prevPageBtn.addEventListener('click', () => {
        if (currentPageIndex > 0) {
            currentPageIndex--;
            // Remove o ponto de início da página que estávamos para que o histórico fique correto
            if (pageHistory.length > currentPageIndex + 1) {
                pageHistory.pop();
            }
            fetchAndDisplayProducts();
        }
    });

    // Carrega a primeira página de produtos
    fetchAndDisplayProducts();
});