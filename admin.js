// admin.js (VERSÃO FINAL CORRIGIDA)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "SUA_CHAVE_DE_API_CORRETA_AQUI",
    authDomain: "the-moment-b3e02.firebaseapp.com",
    projectId: "the-moment-b3e02",
    storageBucket: "the-moment-b3e02.appspot.com",
    messagingSenderId: "263728888202",
    appId: "1:263728888202:web:50fb8ce5b910a80a1e3073",
    measurementId: "G-4LP2H73973"
};
const app = initializeApp(firebaseConfig, "adminApp");
const db = getFirestore(app);

const addView = document.getElementById('add-product-view');
const manageView = document.getElementById('manage-products-view');
const addProductForm = document.getElementById('add-product-form');
const productsListContainer = document.getElementById('products-list-container');
const showAddBtn = document.getElementById('show-add-view-btn');
const showManageBtn = document.getElementById('show-manage-view-btn');
const formTitle = addView.querySelector('h1');
const formButton = addProductForm.querySelector('button[type="submit"]');
let currentlyEditingId = null;

function showAddView() {
    currentlyEditingId = null;
    formTitle.textContent = "Adicionar Novo Topo de Bolo";
    formButton.textContent = "Adicionar Produto";
    addProductForm.reset();
    addView.classList.remove('hidden');
    manageView.classList.add('hidden');
    showAddBtn.classList.add('active');
    showManageBtn.classList.remove('active');
}

function showManageView() {
    addView.classList.add('hidden');
    manageView.classList.remove('hidden');
    showAddBtn.classList.remove('active');
    showManageBtn.classList.add('active');
    loadProductsForManagement();
}

if (showAddBtn) showAddBtn.addEventListener('click', showAddView);
if (showManageBtn) showManageBtn.addEventListener('click', showManageView);

addProductForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = document.getElementById('product-name').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const imageUrl = document.getElementById('product-image-url').value;
    const category = document.getElementById('product-category').value;
    const isFeatured = document.getElementById('product-featured').checked;
    const normalizedTitle = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const keywords = normalizedTitle.split(' ');
    const productData = {
        title: name, price: price, image: imageUrl,
        featured: isFeatured, category: category, keywords: keywords
    };
    try {
        if (currentlyEditingId) {
            const productRef = doc(db, "products", currentlyEditingId);
            await updateDoc(productRef, productData);
            alert(`Produto "${name}" atualizado com sucesso!`);
        } else {
            await addDoc(collection(db, "products"), productData);
            alert(`Produto "${name}" adicionado com sucesso!`);
        }
        showManageView();
    } catch (error) {
        console.error("Erro ao salvar produto: ", error);
        alert("Ocorreu um erro ao salvar o produto.");
    }
});

async function loadProductsForManagement() {
    productsListContainer.innerHTML = '<p>Carregando produtos...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        let tableHtml = `<table class="product-manage-list"><tr><th>Imagem</th><th>Nome</th><th>Categoria</th><th>Preço</th><th>Ações</th></tr>`;
        if (querySnapshot.empty) {
            tableHtml += '<tr><td colspan="5">Nenhum produto cadastrado.</td></tr>';
        } else {
            querySnapshot.forEach((doc) => {
                const product = doc.data();
                tableHtml += `
                    <tr>
                        <td><img src="${product.image}" alt="${product.title}"></td>
                        <td>${product.title}</td>
                        <td>${product.category || 'N/A'}</td>
                        <td>R$ ${Number(product.price).toFixed(2)}</td>
                        <td class="product-actions">
                            <button class="btn-edit" data-id="${doc.id}">Editar</button>
                            <button class="btn-delete" data-id="${doc.id}">Excluir</button>
                        </td>
                    </tr>`;
            });
        }
        tableHtml += '</table>';
        productsListContainer.innerHTML = tableHtml;
        document.querySelectorAll('.btn-delete').forEach(button => { button.addEventListener('click', handleDeleteClick); });
        document.querySelectorAll('.btn-edit').forEach(button => { button.addEventListener('click', handleEditClick); });
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        productsListContainer.innerHTML = '<p>Erro ao carregar produtos.</p>';
    }
}

// SUBSTITUA A FUNÇÃO ATUAL POR ESTA VERSÃO CORRIGIDA

// SUBSTITUA SUA FUNÇÃO handleEditClick POR ESTA VERSÃO CORRIGIDA:

async function handleEditClick(event) {
    const productId = event.target.dataset.id;
    currentlyEditingId = productId;
    try {
        const docRef = doc(db, "products", productId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const product = docSnap.data();
            
            // Preenche o formulário
            document.getElementById('product-name').value = product.title;
            document.getElementById('product-price').value = product.price;
            document.getElementById('product-image-url').value = product.image;
            document.getElementById('product-category').value = product.category || "";
            document.getElementById('product-featured').checked = product.featured || false;
            
            // Troca a visibilidade das telas
            addView.classList.remove('hidden');
            manageView.classList.add('hidden');
            
            // --- CORREÇÃO DE LÓGICA APLICADA AQUI ---
            // O botão "Adicionar" fica INATIVO
            // O botão "Gerenciar" continua ATIVO
            showAddBtn.classList.remove('active'); 
            showManageBtn.classList.add('active');
            // --- FIM DA CORREÇÃO ---

            // Altera o título e o botão do formulário
            formTitle.textContent = "Editar Produto";
            formButton.textContent = "Salvar Alterações";
        } else {
            alert("Produto não encontrado.");
        }
    } catch (error) {
        console.error("Erro ao buscar produto para edição:", error);
        alert("Ocorreu um erro ao buscar o produto para edição.");
    }
}

async function handleDeleteClick(event) {
    const productId = event.target.dataset.id;
    const productName = event.target.closest('tr').cells[1].textContent;
    if (confirm(`Tem certeza que deseja excluir "${productName}"?`)) {
        try {
            await deleteDoc(doc(db, "products", productId));
            loadProductsForManagement();
        } catch (error) {
            alert('Ocorreu um erro ao excluir o produto.');
        }
    }
}