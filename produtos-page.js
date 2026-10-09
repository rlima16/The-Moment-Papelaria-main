import { db } from './firebase-auth.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { createProductCard, categoryLabel, categoryIcon } from './shared-functions.js';

// Carrega todos os produtos UMA vez e faz busca, filtro, ordenação e paginação no navegador.
// Com ~120 produtos isso é mais rápido, gasta menos leituras do Firebase e permite
// busca sem acento e por parte da palavra ("soni" encontra "Sonic", "monica" encontra "Mônica").

const PRODUCTS_PER_PAGE = 20;

let allProducts = [];
let searchQuery = '';
let currentSortOrder = 'title-asc';
let selectedCategory = null;
let currentPage = 0;

const normalize = (text) => String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();


function getFilteredProducts() {
    let list = allProducts;

    if (searchQuery) {
        const terms = normalize(searchQuery).split(' ').filter(Boolean);
        list = list.filter(p => {
            const haystack = p._search;
            return terms.every(term => haystack.includes(term));
        });
    } else if (selectedCategory) {
        list = list.filter(p => p.category === selectedCategory);
    }

    const sorted = [...list];
    switch (currentSortOrder) {
        case 'title-desc': sorted.sort((a, b) => b.title.localeCompare(a.title, 'pt-BR')); break;
        case 'price-asc':  sorted.sort((a, b) => a.price - b.price || a.title.localeCompare(b.title, 'pt-BR')); break;
        case 'price-desc': sorted.sort((a, b) => b.price - a.price || a.title.localeCompare(b.title, 'pt-BR')); break;
        default:           sorted.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    }
    return sorted;
}

function render() {
    const productsList = document.getElementById('all-products-list');
    const paginationControls = document.getElementById('pagination-controls');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageInfo = document.getElementById('page-info');
    const pageTitle = document.querySelector('.page-hero h1');

    const filtered = getFilteredProducts();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE));
    if (currentPage > totalPages - 1) currentPage = totalPages - 1;

    const subtitle = document.getElementById('page-subtitle');
    const countEl = document.getElementById('results-count');
    if (searchQuery) {
        pageTitle.textContent = `Resultados para "${searchQuery}"`;
        if (subtitle) subtitle.textContent = 'Arquivos encontrados para a sua busca.';
    } else if (selectedCategory) {
        pageTitle.textContent = `Arquivos de ${categoryLabel(selectedCategory)}`;
        if (subtitle) subtitle.textContent = `Topos de bolo com o tema ${categoryLabel(selectedCategory)}, prontos para cortar na sua Silhouette.`;
    } else {
        pageTitle.textContent = 'Todos os arquivos';
        if (subtitle) subtitle.textContent = 'Arquivos digitais .studio3 prontos para cortar na sua Silhouette.';
    }
    if (countEl) countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'arquivo encontrado' : 'arquivos encontrados'}`;

    productsList.innerHTML = '';
    if (filtered.length === 0) {
        productsList.innerHTML = `
            <div class="empty-results">
                <i class="fas fa-magnifying-glass big"></i>
                <p>Não encontramos nenhum produto${searchQuery ? ` para "<strong></strong>"` : ''}.</p>
                <p>Não achou o tema que queria? Fale com a gente — podemos ter o arquivo ou criar um novo!</p>
                <a class="btn" href="https://wa.me/551120504970" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> Pedir pelo WhatsApp</a>
                ${searchQuery ? '<a class="btn btn-secondary" href="/produtos">Ver todos os produtos</a>' : ''}
            </div>`;
        const strong = productsList.querySelector('strong');
        if (strong) strong.textContent = searchQuery; // evita injetar HTML do que foi digitado
    } else {
        const start = currentPage * PRODUCTS_PER_PAGE;
        filtered.slice(start, start + PRODUCTS_PER_PAGE).forEach(p => productsList.appendChild(createProductCard(p)));
    }

    if (paginationControls) paginationControls.style.display = totalPages > 1 ? 'flex' : 'none';
    if (prevPageBtn) prevPageBtn.disabled = currentPage === 0;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages - 1;
    if (pageInfo) pageInfo.textContent = `Página ${currentPage + 1} de ${totalPages}`;
}

function createCategoryFilters() {
    const filtersContainer = document.getElementById('category-filters');
    if (!filtersContainer) return;

    const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))]
        .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), 'pt-BR'));
    // "Diversos" sempre por último
    const idx = categories.indexOf('Diversos');
    if (idx > -1) { categories.splice(idx, 1); categories.push('Diversos'); }

    filtersContainer.innerHTML = '';
    const makeButton = (category, text) => {
        const button = document.createElement('button');
        const icon = document.createElement('i');
        icon.className = `fas ${category ? categoryIcon(category) : 'fa-border-all'}`;
        button.append(icon, document.createTextNode(text));
        if (category === selectedCategory && !searchQuery) button.classList.add('active');
        button.addEventListener('click', () => {
            selectedCategory = category;
            searchQuery = '';
            currentPage = 0;
            history.replaceState(null, '', '/produtos' + (category ? `?categoria=${encodeURIComponent(category)}` : ''));
            filtersContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            render();
            button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
        filtersContainer.appendChild(button);
    };
    makeButton(null, 'Ver Todos');
    categories.forEach(c => makeButton(c, categoryLabel(c)));
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    searchQuery = (urlParams.get('search') || '').trim();
    selectedCategory = urlParams.get('categoria') || null;

    const searchInput = document.querySelector('.header-search input');
    if (searchInput && searchQuery) searchInput.value = searchQuery;

    const sortOptions = document.getElementById('sort-options');
    if (sortOptions) {
        sortOptions.addEventListener('change', (event) => {
            currentSortOrder = event.target.value;
            currentPage = 0;
            render();
        });
    }

    const scrollToTop = () => document.querySelector('.toolbar')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('next-page-btn')?.addEventListener('click', () => { currentPage++; render(); scrollToTop(); });
    document.getElementById('prev-page-btn')?.addEventListener('click', () => { if (currentPage > 0) { currentPage--; render(); scrollToTop(); } });

    const productsList = document.getElementById('all-products-list');

    try {
        const snapshot = await getDocs(collection(db, 'products'));
        allProducts = snapshot.docs.map(doc => {
            const data = doc.data();
            const product = { id: doc.id, ...data, price: Number(data.price) || 0, title: data.title || '' };
            product._search = normalize([product.title, product.category, categoryLabel(product.category), (data.keywords || []).join(' ')].join(' '));
            return product;
        });
        createCategoryFilters();
        render();
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        productsList.innerHTML = '<p>Ocorreu um erro ao carregar os produtos. Atualize a página ou fale com a gente pelo WhatsApp.</p>';
    }
});
