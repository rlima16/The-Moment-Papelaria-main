import { db } from './firebase-auth.js';
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

/**
 * Função para buscar e exibir os produtos relacionados
 */
async function displayRelatedProducts(currentProductId) {
    const relatedList = document.getElementById('related-products-list');
    if (!relatedList) return;

    try {
        // 1. Busca todos os produtos
        const querySnapshot = await getDocs(collection(db, "products"));
        let allProducts = [];
        querySnapshot.forEach((doc) => {
            allProducts.push({ id: doc.id, ...doc.data() });
        });

        // 2. Filtra para remover o produto que já está na página
        let relatedProducts = allProducts.filter(p => p.id !== currentProductId);

        // 3. Embaralha o array de produtos restantes
        relatedProducts.sort(() => 0.5 - Math.random());

        // 4. Pega apenas os 4 primeiros produtos do array embaralhado
        relatedProducts = relatedProducts.slice(0, 4);
        
        relatedList.innerHTML = ''; // Limpa a área

        // 5. Cria os cards para os produtos relacionados
        relatedProducts.forEach(product => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <a href="produto-detalhe.html?id=${product.id}" class="card-link">
                    <img src="${product.image}" alt="${product.title}">
                    <h3>${product.title}</h3>
                </a>
                <p>R$ ${Number(product.price).toFixed(2).replace('.', ',')}</p>
                <button class="btn">Adicionar ao Carrinho</button>
            `;
            card.querySelector('button').addEventListener('click', (event) => window.addToCart(event, product));
            relatedList.appendChild(card);
        });

    } catch (error) {
        console.error("Erro ao buscar produtos relacionados:", error);
    }
}


// --- LÓGICA PRINCIPAL DA PÁGINA ---
document.addEventListener('DOMContentLoaded', async () => {
    const loadingMessage = document.getElementById('loading-message');
    const productContainer = document.getElementById('product-detail-container');

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');

        if (!productId) {
            loadingMessage.textContent = 'Produto não encontrado.';
            return;
        }

        const docRef = doc(db, "products", productId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const product = { id: docSnap.id, ...docSnap.data() };
            
            document.getElementById('product-image').src = product.image;
            document.getElementById('product-image').alt = product.title;
            document.getElementById('product-title').textContent = product.title;
            document.getElementById('product-price').textContent = `R$ ${Number(product.price).toFixed(2).replace('.', ',')}`;
            document.title = `${product.title} - The Moment`;

            document.getElementById('add-to-cart-btn').addEventListener('click', (event) => {
                window.addToCart(event, product);
                alert(`"${product.title}" foi adicionado ao carrinho!`);
            });

            loadingMessage.classList.add('hidden');
            productContainer.classList.remove('hidden');

            // --- CHAMA A NOVA FUNÇÃO ---
            // Após carregar o produto principal, busca os relacionados
            displayRelatedProducts(productId);

        } else {
            loadingMessage.textContent = 'Produto não encontrado.';
        }
    } catch (error) {
        console.error("Erro ao buscar detalhes do produto:", error);
        loadingMessage.textContent = 'Ocorreu um erro ao carregar o produto.';
    }
});