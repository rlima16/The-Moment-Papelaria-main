import { db } from './firebase-auth.js';
import { doc, getDoc, collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { createProductCard, formatPrice, categoryLabel, isInCart } from './shared-functions.js';

/**
 * Produtos relacionados: prioriza a mesma categoria e completa com outros.
 * Busca só o necessário em vez de baixar o catálogo inteiro.
 */
async function displayRelatedProducts(currentProduct) {
    const relatedList = document.getElementById('related-products-list');
    if (!relatedList) return;

    try {
        let candidates = [];
        if (currentProduct.category) {
            const sameCategory = await getDocs(query(collection(db, "products"), where("category", "==", currentProduct.category), limit(12)));
            candidates = sameCategory.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        candidates = candidates.filter(p => p.id !== currentProduct.id).sort(() => 0.5 - Math.random());

        if (candidates.length < 4) {
            const featured = await getDocs(query(collection(db, "products"), where("featured", "==", true), limit(20)));
            const extra = featured.docs.map(d => ({ id: d.id, ...d.data() }))
                .filter(p => p.id !== currentProduct.id && !candidates.some(c => c.id === p.id))
                .sort(() => 0.5 - Math.random());
            candidates = candidates.concat(extra);
        }

        relatedList.innerHTML = '';
        candidates.slice(0, 4).forEach(product => relatedList.appendChild(createProductCard(product)));
    } catch (error) {
        console.error("Erro ao buscar produtos relacionados:", error);
    }
}

function setMeta(selector, attr, value) {
    let el = document.head.querySelector(selector);
    if (!el) {
        el = document.createElement('meta');
        const [, key, name] = selector.match(/\[(\w+)="([^"]+)"\]/);
        el.setAttribute(key, name);
        document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
}

// --- LÓGICA PRINCIPAL DA PÁGINA ---
document.addEventListener('DOMContentLoaded', async () => {
    const loadingMessage = document.getElementById('loading-message');
    const productContainer = document.getElementById('product-detail-container');

    try {
        const productId = new URLSearchParams(window.location.search).get('id');
        if (!productId) {
            loadingMessage.innerHTML = 'Produto não encontrado. <a href="/produtos">Ver todos os produtos</a>';
            return;
        }

        const docSnap = await getDoc(doc(db, "products", productId));
        if (!docSnap.exists()) {
            loadingMessage.innerHTML = 'Produto não encontrado. <a href="/produtos">Ver todos os produtos</a>';
            return;
        }

        const product = { id: docSnap.id, ...docSnap.data() };

        const img = document.getElementById('product-image');
        img.src = product.image;
        img.alt = product.title;
        document.getElementById('product-title').textContent = product.title;
        document.getElementById('product-price').textContent = formatPrice(product.price);

        // Descrição própria do produto (campo "description" cadastrado no painel admin)
        if (product.description) {
            const custom = document.getElementById('product-custom-description');
            custom.textContent = product.description; // textContent: seguro contra HTML
            custom.classList.remove('hidden');
        }

        document.title = `${product.title} – Arquivo .studio3 para Silhouette | The Moment`;
        const desc = `${product.title}: arquivo digital .studio3 para cortar na Silhouette. ${formatPrice(product.price)} com pagamento via Pix.`;
        setMeta('meta[name="description"]', 'content', desc);
        setMeta('meta[property="og:title"]', 'content', product.title);
        setMeta('meta[property="og:description"]', 'content', desc);
        setMeta('meta[property="og:image"]', 'content', product.image);

        img.addEventListener('click', () => window.openLightbox(product.image));

        if (product.category) {
            const chip = document.getElementById('product-category');
            const link = document.getElementById('product-category-link');
            chip.textContent = categoryLabel(product.category);
            link.textContent = categoryLabel(product.category);
            link.href = `/produtos?categoria=${encodeURIComponent(product.category)}`;
        }

        const wa = document.getElementById('whatsapp-question');
        if (wa) wa.href = `https://wa.me/551120504970?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre o arquivo "${product.title}".`)}`;

        const addBtn = document.getElementById('add-to-cart-btn');
        const setInCart = () => { addBtn.innerHTML = '<i class="fas fa-check"></i> No carrinho — finalizar compra'; };
        if (isInCart(product.id)) setInCart();
        addBtn.addEventListener('click', (event) => {
            if (isInCart(product.id)) { window.location.href = '/carrinho'; return; }
            window.addToCart(event, product);
            setInCart();
        });

        loadingMessage.classList.add('hidden');
        productContainer.classList.remove('hidden');

        displayRelatedProducts(product);
    } catch (error) {
        console.error("Erro ao buscar detalhes do produto:", error);
        loadingMessage.textContent = 'Ocorreu um erro ao carregar o produto. Atualize a página.';
    }
});
