import { db } from './firebase-auth.js';
import { collection, query, orderBy, limit, getDocs, startAfter, where } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const productsPerPage = 20;
let lastVisibleProduct = null;
let pageHistory = [null];
let currentPageIndex = 0;
let isFetching = false;
let searchQuery = '';

async function fetchAndDisplayProducts() {
    if (isFetching) return;
    isFetching = true;

    const productsList = document.getElementById('all-products-list');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageTitle = document.querySelector('.produtos h1');
    const paginationControls = document.getElementById('pagination-controls');

    if (!productsList) return;

    productsList.innerHTML = '<p>Carregando produtos...</p>';
    if (paginationControls) paginationControls.classList.add('hidden');

    try {
        let finalQuery;
        let baseQuery;

        if (searchQuery) {
            if (pageTitle) pageTitle.textContent = `Resultados para "${searchQuery}"`;
            const searchTerms = searchQuery.toLowerCase().split(' ').filter(term => term);
            finalQuery = query(collection(db, "products"), where("keywords", "array-contains-any", searchTerms));
            if (paginationControls) paginationControls.classList.add('hidden');
        } else {
            if (pageTitle) pageTitle.textContent = 'Todos os Nossos Produtos';
            if (paginationControls) paginationControls.classList.remove('hidden');

            const startAtDoc = pageHistory[currentPageIndex];
            baseQuery = query(collection(db, "products"), orderBy("title"));
            
            if (startAtDoc) {
                finalQuery = query(baseQuery, startAfter(startAtDoc), limit(productsPerPage));
            } else {
                finalQuery = query(baseQuery, limit(productsPerPage));
            }
        }

        const querySnapshot = await getDocs(finalQuery);
        
        const products = [];
        querySnapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
        });

        productsList.innerHTML = '';
        lastVisibleProduct = querySnapshot.docs[querySnapshot.docs.length - 1];

        if (products.length === 0) {
            productsList.innerHTML = `<p>Nenhum produto encontrado.</p>`;
        } else {
            products.forEach(product => {
                const card = document.createElement('div');
                card.className = 'card';
                
                // --- AJUSTE APLICADO AQUI ---
                card.innerHTML = `
                    <a href="produto-detalhe.html?id=${product.id}" class="card-link">
                        <img src="${product.image}" alt="${product.title}">
                        <h3>${product.title}</h3>
                    </a>
                    <p>R$ ${Number(product.price).toFixed(2).replace('.', ',')}</p>
                    <button class="btn">Adicionar ao Carrinho</button>
                `;
                // --- FIM DO AJUSTE ---

                // A linha abaixo para o lightbox não é mais necessária, pois o link cuida do clique
                // card.querySelector('img').addEventListener('click', () => window.openLightbox(product.image));
                
                card.querySelector('button').addEventListener('click', (event) => window.addToCart(event, product));
                productsList.appendChild(card);
            });
        }

        if (!searchQuery) {
            if (prevPageBtn) prevPageBtn.disabled = (currentPageIndex === 0);
            if (nextPageBtn) nextPageBtn.disabled = (querySnapshot.docs.length < productsPerPage);
        }

    } catch (error) {
        console.error("Ocorreu um erro ao buscar os produtos:", error);
        if(productsList) productsList.innerHTML = `<p>Ocorreu um erro ao carregar os produtos. Tente novamente mais tarde.</p>`;
    } finally {
        isFetching = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    searchQuery = urlParams.get('search') || '';
    
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');

    if(nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (lastVisibleProduct && currentPageIndex === pageHistory.length - 1) {
                pageHistory.push(lastVisibleProduct);
            }
            currentPageIndex++;
            fetchAndDisplayProducts();
        });
    }
    
    if(prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPageIndex > 0) {
                currentPageIndex--;
                pageHistory.pop();
                fetchAndDisplayProducts();
            }
        });
    }

    fetchAndDisplayProducts();
});