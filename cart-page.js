import { auth, db, collection, addDoc, serverTimestamp } from './firebase-auth.js';

let cart = [];
let lastOrderData = null;

document.addEventListener('DOMContentLoaded', () => {
    loadCartFromSession();
});

function loadCartFromSession() {
    const cartData = sessionStorage.getItem('shoppingCart');
    if (cartData) {
        try { cart = JSON.parse(cartData); } catch (e) { cart = []; }
    }
    renderCartView();
}

// TELA 1: MOSTRA O CARRINHO E O FORMULÁRIO
function renderCartView() {
    const container = document.querySelector('.cart-page-container');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <h1>Resumo do seu Pedido</h1>
            <p>Seu carrinho está vazio.</p>
            <a href="produtos.html" class="btn" style="width: auto; margin: 20px auto; display: block;">Ver produtos</a>`;
    } else {
        const total = cart.reduce((sum, item) => sum + Number(item.price), 0);
        let itemsHtml = '';
        cart.forEach((item, index) => {
            itemsHtml += `<tr><td>${item.title}</td><td>R$ ${Number(item.price).toFixed(2).replace('.', ',')}</td><td><button class="remove-btn-page" onclick="removeFromCart(${index})">Remover</button></td></tr>`;
        });
        container.innerHTML = `
            <h1>Resumo do seu Pedido</h1>
            <a href="produtos.html" class="link-continuar-comprando">‹ Continuar Comprando</a>
            <table id="cart-page-summary">
                <tr><th>Produto</th><th>Preço</th><th>Ação</th></tr>
                ${itemsHtml}
                <tr class="total-row"><td colspan="2"><b>Total</b></td><td><b>R$ ${total.toFixed(2).replace('.', ',')}</b></td></tr>
            </table>
            <div id="checkout-container">
                <h2 style="text-align: center;">Preencha seus Dados para Continuar</h2>
                <form id="customer-form">
                    <div class="form-group"><label for="nome">Nome Completo</label><input type="text" id="nome" name="nome" required></div>
                    <div class="form-group"><label for="email">E-mail para Contato</label><input type="email" id="email" name="email" required></div>
                    <div class="form-group"><label for="cpf">CPF</label><input type="text" id="cpf" name="cpf" required></div>
                </form>
                <button type="button" id="confirm-order-btn" class="btn">Clique para confirmar sua compra</button>
            </div>`;
        document.getElementById('confirm-order-btn').addEventListener('click', sendOrder);
    }
    updateCartHeaderInfo();
}

// TELA 2: MOSTRA AS INFORMAÇÕES DO PIX E AGRADECIMENTO
// NO ARQUIVO cart-page.js
// SUBSTITUA APENAS ESTA FUNÇÃO:

function renderPixPaymentView() {
    const container = document.querySelector('.cart-page-container');
    if (!container || !lastOrderData) return;

    container.innerHTML = `
        <div class="pix-payment-view">
            <h1>Ótimo! Pedido Registrado.</h1>
            <p>Para finalizar, realize o pagamento via PIX para o pedido <strong>${lastOrderData.orderId}</strong></p>
            
            <img src="https://raw.githubusercontent.com/rlima16/The-Moment-Papelaria/refs/heads/main/pix.png" alt="QR Code PIX">
            
            <p><strong>Valor: R$ ${Number(lastOrderData.total).toFixed(2).replace('.', ',')}</strong></p>
            <p><strong>Chave PIX (E-mail):</strong></p>
            
            <div>
                <input type="text" id="pix-key" value="adm@themomentoficial.shop" readonly>
                <button class="btn" onclick="copyPixKey()">Copiar Chave</button>
            </div>
            
            <a href="index.html" class="btn btn-secondary" style="margin-top: 30px; display: inline-block; width: auto;">Voltar à Página Inicial</a>
        </div>
    `;
}

// AÇÃO PRINCIPAL: CONFIRMA O PEDIDO
async function sendOrder() {
    const form = document.getElementById('customer-form');
    if (!form || !form.checkValidity()) {
        alert("Por favor, preencha todos os campos obrigatórios.");
        return;
    }
    const user = auth.currentUser;
    if (!user) { alert("Você precisa estar logado para finalizar um pedido."); return; }

    lastOrderData = {
        userId: user.uid,
        userName: document.getElementById('nome').value,
        userEmail: document.getElementById('email').value,
        userCpf: document.getElementById('cpf').value,
        orderId: "TM-" + Date.now(),
        items: [...cart],
        total: cart.reduce((sum, item) => sum + Number(item.price), 0),
        status: "Aguardando Pagamento",
        createdAt: serverTimestamp()
    };
    
    try {
        await addDoc(collection(db, "pedidos"), lastOrderData);
        
        let orderDescription = lastOrderData.items.map(item => `- ${item.title} (R$ ${item.price.toFixed(2).replace('.',',')})`).join('\n');
        let message = `Olá! 👋 Confirmo meu pedido:\n\n*Nº:* ${lastOrderData.orderId}\n*Cliente:* ${lastOrderData.userName}\n\n*Itens:*\n${orderDescription}\n\n*Total:* R$ ${lastOrderData.total.toFixed(2).replace('.', ',')}`;
        const whatsappUrl = `https://wa.me/551120504970?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        
        // Limpa o carrinho para a próxima compra
        cart = [];
        sessionStorage.removeItem('shoppingCart');
        updateCartHeaderInfo();
        
        // Muda para a tela de pagamento
        renderPixPaymentView();

    } catch (e) {
        console.error("Erro ao salvar o pedido: ", e);
        alert("Houve um erro ao registrar seu pedido.");
    }
}

// FUNÇÕES AUXILIARES
window.removeFromCart = function(itemIndex) {
    cart.splice(itemIndex, 1);
    sessionStorage.setItem('shoppingCart', JSON.stringify(cart));
    renderCartView();
}

function updateCartHeaderInfo() { /* ... */ }
window.copyPixKey = function() { /* ... */ }