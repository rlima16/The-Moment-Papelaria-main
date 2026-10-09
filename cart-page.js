// cart-page.js ATUALIZADO NOVAMENTE

import { auth, db, collection, addDoc, serverTimestamp } from './firebase-auth.js?v=20261012';

// 👇 Endereço do servidor de pagamentos (Cloudflare Worker). Troque depois de publicar o Worker.
const PAYMENT_API_URL = 'https://the-moment-papelaria-main.rodrigoalveslima5533.workers.dev';

async function criarPagamento(dados) {
    if (PAYMENT_API_URL.includes('COLE-AQUI')) {
        throw new Error('Pagamento indisponível no momento. Tente novamente em instantes.');
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

async function postApi(caminho, dados) {
    const resp = await fetch(`${PAYMENT_API_URL}${caminho}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || 'Não foi possível concluir agora. Tente novamente.');
    return data;
}

let cart = [];
let lastOrderData = null; // pedido em andamento (tela do Pix)
let pixTimer = null;

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
    // Voltou do Mercado Pago depois de pagar com cartão: mostra a mesma tela do Pix
    const params = new URLSearchParams(window.location.search);
    const retorno = params.get('pagamento');
    if (retorno === 'aprovado' || retorno === 'pendente') {
        renderRetornoCartao(retorno, params.get('external_reference') || '');
        return;
    }
    renderCartView();
}

// Tela de retorno do cartão (igual à do Pix): aprovado na hora, ou aguardando e conferindo sozinho
function renderRetornoCartao(retorno, docId) {
    const container = document.querySelector('.cart-page-container');
    if (!container) return;
    lastOrderData = { docId };
    const hero = document.querySelector('.page-hero');
    if (hero) hero.classList.add('hidden');
    container.innerHTML = `
        <div class="panel pix-payment-view" id="pix-view">
            <div class="pix-step">
                <div class="success-icon"><i class="fa-regular fa-credit-card"></i></div>
                <h1>Confirmando seu pagamento...</h1>
                <p class="pix-checking"><i class="fas fa-spinner fa-spin"></i> Só um instante, estamos falando com o Mercado Pago.</p>
                <a href="/" class="pix-back">Voltar para o site</a>
            </div>
        </div>`;
    window.scrollTo({ top: 0 });

    if (retorno === 'aprovado' && !docId) { pagamentoAprovado(); return; }
    let tentativas = 0;
    const conferir = async () => {
        tentativas++;
        try {
            const result = await postApi('/status', { ids: [docId] });
            const info = result[docId];
            if (info && info.status === 'Pago') { clearInterval(pixTimer); pagamentoAprovado(); return; }
            if (info && ['Cancelado', 'Pagamento recusado'].includes(info.status)) {
                clearInterval(pixTimer);
                const view = document.getElementById('pix-view');
                if (view) view.innerHTML = `
                    <div class="pix-step">
                        <div class="success-icon bad"><i class="fas fa-xmark"></i></div>
                        <h1>Pagamento não aprovado</h1>
                        <p>O cartão foi recusado. Você pode tentar de novo com outro cartão ou pagar com Pix.</p>
                        <a href="/carrinho" class="btn btn-lg">Tentar novamente</a>
                        <a href="/" class="btn btn-lg btn-outline">Voltar para o site</a>
                    </div>`;
                return;
            }
        } catch (e) { /* tenta de novo */ }
        if (retorno === 'aprovado' && tentativas >= 3) { clearInterval(pixTimer); pagamentoAprovado(); return; }
        const msg = document.querySelector('#pix-view .pix-checking');
        if (msg && tentativas >= 2) msg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pagamento em análise pelo Mercado Pago. Esta tela muda sozinha quando for aprovado.';
    };
    conferir();
    clearInterval(pixTimer);
    pixTimer = setInterval(conferir, 4000);
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
                    <p>Você está comprando <strong>arquivos digitais (.studio3)</strong>. Assim que o pagamento for aprovado, eles ficam disponíveis para <strong>baixar na sua área do cliente</strong>.</p>
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
                                <input type="radio" name="pagamento" value="pix" checked>
                                <span class="po-body">
                                    <strong><i class="fa-brands fa-pix"></i> Pix</strong>
                                    <small>QR Code aqui mesmo · aprovação em segundos · topo liberado na hora</small>
                                </span>
                            </label>
                            <label class="payment-option">
                                <input type="radio" name="pagamento" value="cartao">
                                <span class="po-body">
                                    <strong><i class="fa-regular fa-credit-card"></i> Cartão de crédito ou débito</strong>
                                    <small>Pagamento seguro pelo Mercado Pago · topo liberado na hora</small>
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

// TELA 2: PIX NA PRÓPRIA LOJA (QR Code + confirmação automática)
function renderPixScreen(pix) {
    const container = document.querySelector('.cart-page-container');
    if (!container || !lastOrderData) return;
    const hero = document.querySelector('.page-hero');
    if (hero) hero.classList.add('hidden');

    container.innerHTML = `
        <div class="panel pix-payment-view" id="pix-view">
            <div class="pix-step" id="pix-waiting">
                <div class="success-icon"><i class="fa-brands fa-pix"></i></div>
                <h1>Pague ${fmt(pix.valor)} com Pix</h1>
                <p>Pedido <strong>${escapeHtml(lastOrderData.orderId)}</strong> · válido por <strong id="pix-countdown">30:00</strong></p>
                ${pix.qrCodeBase64 ? `<img class="pix-qr" src="data:image/png;base64,${pix.qrCodeBase64}" alt="QR Code Pix">` : ''}
                <ol class="pix-how">
                    <li>Abra o app do seu banco e escolha <strong>Pix → Ler QR Code</strong> ou <strong>Pix Copia e Cola</strong>.</li>
                    <li>Pague o valor de <strong>${fmt(pix.valor)}</strong>.</li>
                    <li>Pronto! Esta tela muda sozinha quando o pagamento for aprovado.</li>
                </ol>
                <div class="pix-key-container">
                    <p style="margin:0"><strong>Pix Copia e Cola:</strong></p>
                    <div class="input-group">
                        <input type="text" id="pix-code" value="${escapeHtml(pix.qrCode)}" readonly>
                        <button class="btn-copy" id="pix-copy"><i class="fa-regular fa-copy"></i> Copiar</button>
                    </div>
                </div>
                <p class="pix-checking"><i class="fas fa-spinner fa-spin"></i> Aguardando o pagamento...</p>
                <a href="/" class="pix-back">Voltar para o site</a>
            </div>
        </div>
    `;
    document.getElementById('pix-copy').addEventListener('click', copiarCodigoPix);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // contador de validade
    const fim = Date.now() + 30 * 60 * 1000;
    const countdown = document.getElementById('pix-countdown');
    const tick = setInterval(() => {
        const rest = Math.max(0, fim - Date.now());
        if (countdown) countdown.textContent = `${String(Math.floor(rest / 60000)).padStart(2, '0')}:${String(Math.floor(rest / 1000) % 60).padStart(2, '0')}`;
        if (!rest) clearInterval(tick);
    }, 1000);

    // confere o pagamento a cada 4 segundos
    clearInterval(pixTimer);
    pixTimer = setInterval(async () => {
        try {
            const result = await postApi('/status', { ids: [lastOrderData.docId] });
            const info = result[lastOrderData.docId];
            if (info && info.status === 'Pago') {
                clearInterval(pixTimer); clearInterval(tick);
                pagamentoAprovado();
            } else if (info && ['Cancelado', 'Pagamento recusado'].includes(info.status)) {
                clearInterval(pixTimer);
                document.querySelector('.pix-checking').innerHTML = 'O Pix expirou ou foi cancelado. <a href="/carrinho">Gerar um novo</a>';
            }
        } catch (e) { /* tenta de novo no próximo ciclo */ }
    }, 4000);
}

function pagamentoAprovado() {
    cart = [];
    try { sessionStorage.removeItem('shoppingCart'); } catch (e) { /* ignora */ }
    updateCartHeaderInfo();
    const badge = document.getElementById('cart-count');
    if (badge) badge.classList.add('hidden');
    const view = document.getElementById('pix-view');
    if (!view) return;
    view.innerHTML = `
        <div class="pix-step pix-approved">
            <div class="success-icon ok"><i class="fas fa-check"></i></div>
            <h1>Pagamento aprovado! 🎉</h1>
            <p>Obrigada pela compra! Seu topo já está liberado na sua área do cliente, pronto para baixar.</p>
            <a href="/minha-conta" class="btn btn-lg"><i class="fa-solid fa-download"></i> Baixar meus topos</a>
            <a href="/" class="btn btn-lg btn-outline">Voltar para o site</a>
        </div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function copiarCodigoPix() {
    const input = document.getElementById('pix-code');
    if (!input) return;
    try { await navigator.clipboard.writeText(input.value); }
    catch (e) { input.select(); input.setSelectionRange(0, 99999); document.execCommand('copy'); }
    window.showToast && window.showToast('Código Pix copiado! Cole no app do seu banco.');
}

// AÇÃO PRINCIPAL: CONFIRMA O PEDIDO (sem alterações)
// Confere os dígitos verificadores do CPF
function cpfValido(valor) {
    const cpf = String(valor || '').replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf) || cpf === '12345678909') return false;
    const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(cpf[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

async function sendOrder() {
    const form = document.getElementById('customer-form');
    const cpfInput = document.getElementById('cpf');
    if (cpfInput) cpfInput.setCustomValidity(cpfInput.value && !cpfValido(cpfInput.value) ? 'CPF inválido. Confira os números.' : '');
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

    const metodo = (document.querySelector('input[name="pagamento"]:checked') || {}).value || 'pix';
    confirmBtn.innerHTML = metodo === 'pix'
        ? '<i class="fas fa-spinner fa-spin"></i> Gerando o Pix...'
        : '<i class="fas fa-spinner fa-spin"></i> Abrindo o Mercado Pago...';
    try {
        // 1) registra o pedido para ele aparecer na área do cliente
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
            paymentType: metodo === 'pix' ? 'Pix' : 'Cartão',
            createdAt: serverTimestamp()
        };
        const ref = await addDoc(collection(db, "pedidos"), pedido);
        const dados = {
            orderDocId: ref.id,
            orderId: pedido.orderId,
            itemIds: cart.map(item => item.id).filter(Boolean),
            nome: pedido.userName,
            email: pedido.userEmail,
            cpf: pedido.userCpf
        };
        if (metodo === 'pix') {
            // 2a) Pix: QR Code aqui mesmo, e a tela muda sozinha quando pagar
            const pix = await postApi('/pix', dados);
            lastOrderData = { ...pedido, docId: ref.id };
            renderPixScreen(pix);
        } else {
            // 2b) Cartão: página segura do Mercado Pago
            const result = await criarPagamento(dados);
            window.location.href = result.checkoutUrl;
        }
    } catch (e) {
        console.error('Erro ao iniciar pagamento:', e);
        if (window.showToast) window.showToast(e.message || 'Não foi possível iniciar o pagamento. Tente novamente.');
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-lock"></i> Ir para o pagamento';
    }
}


// --- FUNÇÕES AUXILIARES ---

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
