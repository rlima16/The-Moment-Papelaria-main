// cart-page.js ATUALIZADO NOVAMENTE

import { auth, db, collection, addDoc, serverTimestamp } from './firebase-auth.js';

let cart = [];
let lastOrderData = null; // Esta variável vai guardar os dados do último pedido

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

// TELA 1: MOSTRA O CARRINHO E O FORMULÁRIO (sem alterações)
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
                <button type="button" id="confirm-order-btn" class="btn">Confirmar Compra e Pagar</button>
            </div>`;
        document.getElementById('confirm-order-btn').addEventListener('click', sendOrder);
    }
    updateCartHeaderInfo();
}

// TELA 2: MOSTRA AS INFORMAÇÕES DO PIX (COM O NOVO BOTÃO)
function renderPixPaymentView() {
    const container = document.querySelector('.cart-page-container');
    if (!container || !lastOrderData) return;

    container.innerHTML = `
        <div class="pix-payment-view">
            <h1>Ótimo! Pedido Registrado.</h1>
            <p>Para finalizar, realize o pagamento via PIX para o pedido <strong>${lastOrderData.orderId}</strong></p>
            
            <img src="https://raw.githubusercontent.com/rlima16/The-Moment-Papelaria/refs/heads/main/pix.png" alt="QR Code PIX" style="max-width: 250px; margin: 20px auto; display: block; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
            
            <p style="font-size: 1.1em; margin-top: 15px;"><strong>Valor: R$ ${Number(lastOrderData.total).toFixed(2).replace('.', ',')}</strong></p>
            
            <div class="pix-key-container">
                <p><strong>Chave PIX (E-mail):</strong></p>
                <div class="input-group">
                    <input type="text" id="pix-key-display" value="adm@themomentoficial.shop" readonly>
                    <button class="btn-copy" onclick="copyPixKey()">Copiar Chave</button>
                </div>
            </div>
            
            <button type="button" class="btn btn-whatsapp" onclick="sendOrderToWhatsapp()" style="margin-top: 20px; background-color: #25D366;">
                <i class="fab fa-whatsapp"></i> Solicitar meu Pedido via Whatsapp
            </button>
            
            <a href="index.html" class="btn btn-secondary" style="margin-top: 15px; display: inline-block; width: auto;">Voltar à Página Inicial</a>
        </div>
    `;
}

// AÇÃO PRINCIPAL: CONFIRMA O PEDIDO (sem alterações)
async function sendOrder() {
    const form = document.getElementById('customer-form');
    if (!form || !form.checkValidity()) {
        form.reportValidity();
        alert("Por favor, preencha todos os campos obrigatórios.");
        return;
    }
    
    const confirmBtn = document.getElementById('confirm-order-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processando...';

    const user = auth.currentUser;
    if (!user) {
        alert("Você precisa estar logado para finalizar um pedido.");
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar Compra e Pagar';
        return;
    }

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
        
        cart = [];
        sessionStorage.removeItem('shoppingCart');
        updateCartHeaderInfo();
        
        renderPixPaymentView();

    } catch (e) {
        console.error("Erro ao salvar o pedido: ", e);
        alert("Houve um erro ao registrar seu pedido. Tente novamente.");
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar Compra e Pagar';
    }
}


// --- FUNÇÕES AUXILIARES ---

// NOVA FUNÇÃO PARA ENVIAR O PEDIDO VIA WHATSAPP
window.sendOrderToWhatsapp = function() {
    if (!lastOrderData) {
        console.error("Dados do pedido não encontrados para enviar via WhatsApp.");
        alert("Erro: não foi possível encontrar os dados do pedido.");
        return;
    }

    // Monta a descrição dos itens
    let orderDescription = lastOrderData.items.map(item => `- ${item.title} (R$ ${Number(item.price).toFixed(2).replace('.',',')})`).join('\n');
    
    // Monta a mensagem completa
    let message = `Olá! 👋 Gostaria de solicitar o meu pedido:\n\n` +
                  `*Nº do Pedido:* ${lastOrderData.orderId}\n` +
                  `*Cliente:* ${lastOrderData.userName}\n\n` +
                  `*Itens do Pedido:*\n${orderDescription}\n\n` +
                  `*Total:* R$ ${lastOrderData.total.toFixed(2).replace('.', ',')}\n\n` +
                  `Já tenho os dados para o pagamento via PIX. Aguardo a confirmação.`;

    // Cria a URL e abre em uma nova aba
    const whatsappUrl = `https://wa.me/551120504970?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}


window.removeFromCart = function(itemIndex) {
    cart.splice(itemIndex, 1);
    sessionStorage.setItem('shoppingCart', JSON.stringify(cart));
    renderCartView();
}

function updateCartHeaderInfo() {
    const cartCount = document.getElementById('cart-count');
    const cartTotalValue = document.getElementById('cart-total-value');
    if (cartCount && cartTotalValue) {
        const total = cart.reduce((sum, item) => sum + Number(item.price), 0);
        cartCount.textContent = cart.length;
        cartTotalValue.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }
}

window.copyPixKey = function() {
    const pixKeyInput = document.getElementById('pix-key-display');
    if (pixKeyInput) {
        pixKeyInput.select();
        pixKeyInput.setSelectionRange(0, 99999);
        document.execCommand('copy');
        alert('Chave PIX copiada!');
    }
}