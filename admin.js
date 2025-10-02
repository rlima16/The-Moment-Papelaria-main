// Importa as ferramentas do Firebase que já usamos
import { db, collection, addDoc } from './firebase-auth.js';

// Função executada quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
    const addProductForm = document.getElementById('add-product-form');

    // Escuta o evento de "submit" (envio) do formulário
    addProductForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Impede que a página recarregue

        // Pega os valores dos campos do formulário
        const name = document.getElementById('product-name').value;
        const price = parseFloat(document.getElementById('product-price').value);
        const imageUrl = document.getElementById('product-image-url').value;

        // Monta o objeto do novo produto
        const newProduct = {
            title: name,
            price: price,
            image: imageUrl,
            // Poderíamos adicionar outros campos aqui no futuro, como 'featured'
        };

        try {
            // Tenta adicionar o novo produto à coleção "products" no Firestore
            const docRef = await addDoc(collection(db, "products"), newProduct);
            alert(`Produto "${name}" adicionado com sucesso!`);
            addProductForm.reset(); // Limpa o formulário
        } catch (error) {
            console.error("Erro ao adicionar produto: ", error);
            alert("Ocorreu um erro ao adicionar o produto. Tente novamente.");
        }
    });
});