// cart-page.js ATUALIZADO NOVAMENTE

import { auth, db, collection, addDoc, serverTimestamp } from './firebase-auth.js';

// 👇 Endereço do servidor de pagamentos (Cloudflare Worker). Troque depois de publicar o Worker.
const PAYMENT_API_URL = 'https://the-moment-papelaria-main.rodrigoalveslima5533.workers.dev';

async function criarPagamento(dados) {
    if (PAYMENT_API_URL.includes('COLE-AQUI')) {
        throw new Error('Pagamento com cartão ainda não configurado. Escolha "Pix pela chave".');
    }
    const resp = await fetch(`${PAYMENT_API_URL}/criar-pagamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.checkoutUrl) throw new Error(data.error || 'Não foi possível abrir o pagamento. Tente novamente.');
    return data;
}

let cart = [];
let lastOrderData = null; // Esta variável vai guardar os dados do último pedido

document.addEventListener('DOMContentLoaded', () => {
    loadCartFromSession();
});

// Quando o cliente faz login/logout, atualiza o aviso do carrinho
auth.onAuthStateChanged(() => {
    if (!lastOrderData) renderCartView();
});

// Voltou do Mercado Pago sem concluir o pagamento
if (new URLSearchParams(window.location.search).get('pagamento') === 'falhou') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => window.showToast && window.showToast('O pagamento não foi concluído. Você pode tentar de novo ou escolher outra forma.'), 400);
    });
}

function loadCartFromSession() {
    const cartData = sessionStorage.getItem('shoppingCart');
    if (cartData) {
        try { cart = JSON.parse(cartData); } catch (e) { cart = []; }
    }
    renderCartView();
}

const fmt = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const escapeHtml = (t) => String(t || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// TELA 1: CARRINHO + DADOS DO CLIENTE
function renderCartView() {
    const container = document.querySelector('.cart-page-container');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="panel empty-cart">
                <i class="fa-solid fa-bag-shopping"></i>
                <h2>Seu carrinho está vazinho</h2>
                <p>Que tal escolher o tema da próxima festa?</p>
                <a href="/produtos" class="btn btn-lg">Ver arquivos <i class="fas fa-arrow-right"></i></a>
            </div>`;
        updateCartHeaderInfo();
        return;
    }

    const total = cart.reduce((sum, item) => sum + Number(item.price), 0);
    const itemsHtml = cart.map((item, index) => `
        <div class="cart-item">
            ${item.image ? `<img src="${escapeHtml(item.image)}" alt="">` : '<div class="ph"><i class="fas fa-image"></i></div>'}
            <div>
                <h3>${escapeHtml(item.title)}</h3>
                <div class="meta"><i class="fas fa-file-arrow-down"></i> Arquivo digital .studio3</div>
                <button class="remove-btn-page" onclick="removeFromCart(${index})"><i class="fa-regular fa-trash-can"></i> Remover</button>
            </div>
            <div class="price">${fmt(item.price)}</div>
        </div>`).join('');

    const loggedIn = !!auth.currentUser;
    container.innerHTML = `
        <div class="cart-layout">
            <div class="panel">
                <h2>Seus arquivos (${cart.length})</h2>
                ${itemsHtml}
                <a href="/produtos" class="link-continuar-comprando"><i class="fas fa-arrow-left"></i> Continuar comprando</a>
            </div>

            <div class="panel" id="checkout-container">
                <h2>Finalizar pedido</h2>
                <div class="summary-row"><span>Subtotal</span><span>${fmt(total)}</span></div>
                <div class="summary-row"><span>Entrega</span><span>Digital · grátis</span></div>
                <div class="summary-row total"><span>Total</span><span>${fmt(total)}</span></div>

                <div class="digital-info-banner" style="margin:18px 0">
                    <i class="fas fa-circle-info"></i>
                    <p>Você está comprando <strong>arquivos digitais (.studio3)</strong>. Nenhum item físico será enviado.</p>
                </div>

                ${loggedIn ? '' : `
                <div class="login-required-notice">
                    <p><strong>Entre na sua conta para finalizar.</strong> Assim você acompanha seus pedidos em "Minha conta".</p>
                    <button type="button" class="btn" onclick="window.openAuthModal && window.openAuthModal()">Entrar ou criar conta</button>
                </div>`}

                <form id="customer-form">
                    <div class="form-group"><label for="nome">Nome completo</label><input type="text" id="nome" name="nome" autocomplete="name" required></div>
                    <div class="form-group"><label for="email">E-mail para contato</label><input type="email" id="email" name="email" autocomplete="email" value="${escapeHtml(auth.currentUser?.email || '')}" required></div>
                    <div class="form-group"><label for="cpf">CPF</label><input type="text" id="cpf" name="cpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" required></div>
                    <p class="form-privacy-note">Seus dados são usados apenas para identificar o pedido. Veja nossa <a href="/ajuda#privacidade">política de privacidade</a>.</p>

                    <div class="form-group">
                        <label>Forma de pagamento</label>
                        <div class="payment-options">
                            <label class="payment-option">
                                <input type="radio" name="pagamento" value="mercadopago" checked>
                                <span class="po-body">
                                    <strong><i class="fa-regular fa-credit-card"></i> Cartão de crédito, débito ou Pix</strong>
                                    <small>Pagamento seguro pelo Mercado Pago · confirmação automática</small>
                                </span>
                            </label>
                            <label class="payment-option">
                                <input type="radio" name="pagamento" value="pix-manual">
                                <span class="po-body">
                                    <strong><i class="fa-brands fa-pix"></i> Pix pela chave (manual)</strong>
                                    <small>Você paga e envia o comprovante pelo WhatsApp</small>
                                </span>
                            </label>
                        </div>
                    </div>
                </form>
                <button type="button" id="confirm-order-btn" class="btn btn-lg"><i class="fas fa-lock"></i> Ir para o pagamento</button>
                <p class="secure-note"><i class="fas fa-lock"></i> Os dados do cartão são digitados no ambiente seguro do Mercado Pago</p>
            </div>
        </div>`;

    const cpf = document.getElementById('cpf');
    cpf.addEventListener('input', () => {
        const d = cpf.value.replace(/\D/g, '').slice(0, 11);
        cpf.value = d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    });
    document.getElementById('confirm-order-btn').addEventListener('click', sendOrder);
    updateCartHeaderInfo();
}

// TELA 2: PAGAMENTO PIX
function renderPixPaymentView() {
    const container = document.querySelector('.cart-page-container');
    if (!container || !lastOrderData) return;

    const hero = document.querySelector('.page-hero');
    if (hero) hero.classList.add('hidden');

    container.innerHTML = `
        <div class="panel pix-payment-view">
            <div class="success-icon"><i class="fas fa-check"></i></div>
            <h1>Pedido registrado!</h1>
            <p>Pedido <strong>${escapeHtml(lastOrderData.orderId)}</strong>. Agora é só pagar via Pix:</p>
            <div class="pix-amount">${fmt(lastOrderData.total)}</div>

            <img src="pix.png" alt="QR Code Pix">

            <div class="pix-key-container">
                <p style="margin:0"><strong>Ou use a chave Pix (e-mail):</strong></p>
                <div class="input-group">
                    <input type="text" id="pix-key-display" value="adm@themomentoficial.shop" readonly>
                    <button class="btn-copy" onclick="copyPixKey()"><i class="fa-regular fa-copy"></i> Copiar</button>
                </div>
            </div>

            <div class="next-steps">
                <h2>Como receber seu arquivo</h2>
                <ol>
                    <li>Pague o valor acima via Pix (QR Code ou chave).</li>
                    <li>Clique no botão abaixo e envie o <strong>comprovante</strong> pelo WhatsApp.</li>
                    <li>Assim que confirmarmos o pagamento, enviamos seu arquivo. Atendimento de segunda a sexta, das 9h às 18h.</li>
                </ol>
                <p>Acompanhe o status em <a href="/minha-conta">Minha conta</a>.</p>
            </div>

            <button type="button" class="btn btn-lg btn-whatsapp" onclick="sendOrderToWhatsapp()"><i class="fab fa-whatsapp"></i> Enviar comprovante pelo WhatsApp</button>
            <a href="/" class="btn btn-lg btn-outline">Voltar à loja</a>
        </div>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// AÇÃO PRINCIPAL: CONFIRMA O PEDIDO (sem alterações)
async function sendOrder() {
    const form = document.getElementById('customer-form');
    if (!form || !form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const confirmBtn = document.getElementById('confirm-order-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processando...';

    const user = auth.currentUser;
    if (!user) {
        if (window.openAuthModal) window.openAuthModal();
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-lock"></i> Ir para o pagamento';
        return;
    }

    const metodo = (document.querySelector('input[name="pagamento"]:checked') || {}).value || 'mercadopago';
    if (metodo === 'mercadopago') {
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Abrindo o Mercado Pago...';
        try {
            // 1) registra o pedido (igual ao Pix) para ele aparecer em "Minha conta"
            const pedido = {
                userId: user.uid,
                userName: document.getElementById('nome').value,
                userEmail: document.getElementById('email').value,
                userCpf: document.getElementById('cpf').value,
                orderId: "TM-" + Date.now(),
                items: [...cart],
                total: cart.reduce((sum, item) => sum + Number(item.price), 0),
                status: "Aguardando Pagamento",
                paymentMethod: "Mercado Pago",
                createdAt: serverTimestamp()
            };
            const ref = await addDoc(collection(db, "pedidos"), pedido);
            // 2) pede ao servidor o link de pagamento do Mercado Pago
            const result = await criarPagamento({
                orderDocId: ref.id,
                orderId: pedido.orderId,
                itemIds: cart.map(item => item.id).filter(Boolean),
                nome: pedido.userName,
                email: pedido.userEmail,
                cpf: pedido.userCpf
            });
            window.location.href = result.checkoutUrl;
        } catch (e) {
            console.error('Erro ao iniciar pagamento:', e);
            if (window.showToast) window.showToast(e.message || 'Não foi possível abrir o pagamento. Tente novamente.');
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fas fa-lock"></i> Ir para o pagamento';
        }
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
        confirmBtn.innerHTML = '<i class="fas fa-lock"></i> Ir para o pagamento';
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
                  `Segue o comprovante do pagamento via Pix. Aguardo a confirmação e o envio do arquivo. 😊`;

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

window.copyPixKey = async function() {
    const pixKeyInput = document.getElementById('pix-key-display');
    if (!pixKeyInput) return;
    try {
        await navigator.clipboard.writeText(pixKeyInput.value);
    } catch (e) {
        pixKeyInput.select();
        pixKeyInput.setSelectionRange(0, 99999);
        document.execCommand('copy');
    }
    if (window.showToast) window.showToast('Chave Pix copiada!'); else alert('Chave PIX copiada!');
}