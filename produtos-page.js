import { db } from './firebase-auth.js';
import { collection, query, orderBy, limit, getDocs, startAfter, where } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

let productsPerPage = 20;
let lastVisibleProduct = null;
let pageHistory = [null];
let currentPageIndex = 0;
let isFetching = false;
let searchQuery = '';
let currentSortOrder = 'title-asc';
let selectedCategory = null;

async function fetchAndDisplayProducts() {
    if (isFetching) return;
    isFetching = true;

    const productsList = document.getElementById('all-products-list');
    const paginationControls = document.getElementById('pagination-controls');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageTitle = document.querySelector('.produtos h1');
    const toolbar = document.querySelector('.toolbar');
    
    productsList.innerHTML = '<p>Carregando produtos...</p>';
    if (paginationControls) paginationControls.style.display = 'none';

    try {
        let finalQuery;
        
        if (searchQuery) {
            if (toolbar) toolbar.style.display = 'none';
            if (paginationControls) paginationControls.style.display = 'none';
            pageTitle.textContent = `Resultados para "${searchQuery}"`;
            const searchTerms = searchQuery.toLowerCase().split(' ').filter(term => term);
            finalQuery = query(collection(db, "products"), where("keywords", "array-contains-any", searchTerms));
        } else {
            if (toolbar) toolbar.style.display = 'flex';
            if (paginationControls) paginationControls.style.display = 'block';
            pageTitle.textContent = 'Todos os Nossos Produtos';
            
            const startAtDoc = pageHistory[currentPageIndex];
            
            let sortField = 'title';
            let sortDirection = 'asc';
            if (currentSortOrder === 'title-desc') { sortDirection = 'desc'; } 
            else if (currentSortOrder === 'price-asc') { sortField = 'price'; } 
            else if (currentSortOrder === 'price-desc') { sortField = 'price'; sortDirection = 'desc'; }
            
            let baseQuery;
            if (selectedCategory) {
                baseQuery = query(collection(db, "products"), where("category", "==", selectedCategory), orderBy(sortField, sortDirection));
            } else {
                baseQuery = query(collection(db, "products"), orderBy(sortField, sortDirection));
            }
            
            if (startAtDoc) {
                finalQuery = query(baseQuery, startAfter(startAtDoc), limit(productsPerPage));
            } else {
                finalQuery = query(baseQuery, limit(productsPerPage));
            }
        }

        const querySnapshot = await getDocs(finalQuery);
        const products = [];
        querySnapshot.forEach((doc) => { products.push({ id: doc.id, ...doc.data() }); });
        productsList.innerHTML = '';
        lastVisibleProduct = querySnapshot.docs[querySnapshot.docs.length - 1];

        if (products.length === 0) {
            productsList.innerHTML = `<p>Nenhum produto encontrado.</p>`;
        } else {
            products.forEach(product => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `<a href="produto-detalhe.html?id=${product.id}" class="card-link"><img src="${product.image}" alt="${product.title}"><h3>${product.title}</h3></a><p>R$ ${Number(product.price).toFixed(2).replace('.', ',')}</p><button class="btn">Adicionar ao Carrinho</button>`;
                card.querySelector('button').addEventListener('click', (event) => window.addToCart(event, product));
                productsList.appendChild(card);
            });
        }
        if (!searchQuery) {
            if (prevPageBtn) prevPageBtn.disabled = (currentPageIndex === 0);
            if (nextPageBtn) nextPageBtn.disabled = (querySnapshot.docs.length < productsPerPage);
        }
    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
        productsList.innerHTML = `<p>Ocorreu um erro ao carregar os produtos. Verifique o console.</p>`;
    } finally {
        isFetching = false;
    }
}

async function createCategoryFilters() {
    const filtersContainer = document.getElementById('category-filters');
    if (!filtersContainer) return;
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const categories = new Set();
        querySnapshot.forEach((doc) => {
            if (doc.data().category) { categories.add(doc.data().category); }
        });
        filtersContainer.innerHTML = '';
        const allButton = document.createElement('button');
        allButton.textContent = 'Ver Todos';
        allButton.classList.add('active');
        allButton.addEventListener('click', () => { handleCategoryClick(null, allButton); });
        filtersContainer.appendChild(allButton);
        categories.forEach(category => {
            const button = document.createElement('button');
            button.textContent = category;
            button.addEventListener('click', () => { handleCategoryClick(category, button); });
            filtersContainer.appendChild(button);
        });
    } catch (error) {
        console.error("Erro ao criar filtros de categoria:", error);
    }
}

function handleCategoryClick(category, clickedButton) {
    selectedCategory = category;
    currentPageIndex = 0;
    pageHistory = [null];
    lastVisibleProduct = null;
    document.querySelectorAll('#category-filters button').forEach(btn => btn.classList.remove('active'));
    clickedButton.classList.add('active');
    fetchAndDisplayProducts();
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    searchQuery = urlParams.get('search') || '';
    
    const sortOptions = document.getElementById('sort-options');
    if (sortOptions) {
        sortOptions.addEventListener('change', (event) => {
            currentSortOrder = event.target.value;
            currentPageIndex = 0; pageHistory = [null]; lastVisibleProduct = null;
            fetchAndDisplayProducts();
        });
    }
    
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    if(nextPageBtn) nextPageBtn.addEventListener('click', () => {
        if (lastVisibleProduct && currentPageIndex === pageHistory.length - 1) { pageHistory.push(lastVisibleProduct); }
        currentPageIndex++;
        fetchAndDisplayProducts();
    });
    if(prevPageBtn) prevPageBtn.addEventListener('click', () => {
        if (currentPageIndex > 0) {
            currentPageIndex--; pageHistory.pop();
            fetchAndDisplayProducts();
        }
    });

    createCategoryFilters();
    fetchAndDisplayProducts();
});