import { db } from './firebase-auth.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const loadingMessage = document.getElementById('loading-message');
    const productContainer = document.getElementById('product-detail-container');

    try {
        // 1. Pega o ID do produto da URL (ex: ?id=XYZ123)
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');

        if (!productId) {
            loadingMessage.textContent = 'Produto não encontrado.';
            return;
        }

        // 2. Busca o documento específico do produto no Firestore
        const docRef = doc(db, "products", productId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const product = { id: docSnap.id, ...docSnap.data() };
            
            // 3. Preenche o HTML com as informações do produto
            document.getElementById('product-image').src = product.image;
            document.getElementById('product-image').alt = product.title;
            document.getElementById('product-title').textContent = product.title;
            document.getElementById('product-price').textContent = `R$ ${Number(product.price).toFixed(2).replace('.', ',')}`;
            document.title = `${product.title} - The Moment`; // Atualiza o título da aba do navegador

            // 4. Ativa o botão "Adicionar ao Carrinho"
            document.getElementById('add-to-cart-btn').addEventListener('click', (event) => {
                window.addToCart(event, product);
                alert(`"${product.title}" foi adicionado ao carrinho!`);
            });

            // Mostra o conteúdo e esconde a mensagem de "carregando"
            loadingMessage.classList.add('hidden');
            productContainer.classList.remove('hidden');

        } else {
            loadingMessage.textContent = 'Produto não encontrado.';
        }
    } catch (error) {
        console.error("Erro ao buscar detalhes do produto:", error);
        loadingMessage.textContent = 'Ocorreu um erro ao carregar o produto.';
    }
});