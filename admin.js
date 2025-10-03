// Importa as ferramentas do Firebase que já usamos
import { db, collection, addDoc } from './firebase-auth.js';

// Função executada quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
    const addProductForm = document.getElementById('add-product-form');

    // Escuta o evento de "submit" (envio) do formulário
    addProductForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('product-name').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const imageUrl = document.getElementById('product-image-url').value;

    if (!name || isNaN(price) || !imageUrl) {
        alert("Por favor, preencha todos os campos corretamente.");
        return;
    }

    // --- NOVA LÓGICA DE PALAVRAS-CHAVE ---
    // 1. Deixa o título em letras minúsculas e remove acentos
    const normalizedTitle = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // 2. Quebra o título em um array de palavras
    const keywords = normalizedTitle.split(' ');
    // --- FIM DA NOVA LÓGICA ---

    const newProduct = {
        title: name,
        price: price,
        image: imageUrl,
        keywords: keywords // 3. Salva o array de palavras-chave no produto
    };

    try {
        const docRef = await addDoc(collection(db, "products"), newProduct);
        alert(`Produto "${name}" adicionado com sucesso!`);
        addProductForm.reset();
    } catch (error) {
        console.error("Erro ao adicionar produto: ", error);
        alert("Ocorreu um erro ao adicionar o produto. Tente novamente.");
    }
    });
});