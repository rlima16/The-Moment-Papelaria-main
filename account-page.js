// account-page.js — Área do cliente: topos comprados (baixar / visualizar) e histórico de pedidos

import { auth, db } from './firebase-auth.js?v=20261011';
import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Servidor de pagamentos e arquivos (Cloudflare)
const PAYMENT_API_URL = 'https://the-moment-papelaria-main.rodrigoalveslima5533.workers.dev';
const FINAL_STATUSES = ['pago', 'entregue', 'cancelado', 'reembolsado'];
const WHATSAPP = 'https://wa.me/551120504970';

const escapeHtml = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const isPaid = (status) => ['pago', 'entregue'].includes(String(status || '').toLowerCase());
const statusClass = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'pago' || s === 'entregue') return 'ok';
    if (s.includes('recusado') || s.includes('cancelado') || s.includes('reembolsado')) return 'bad';
    return 'wait';
};

// ---------- Retorno do Mercado Pago ----------
const retornoPagamento = new URLSearchParams(window.location.search).get('pagamento');
if (retornoPagamento === 'aprovado' || retornoPagamento === 'pendente') {
    try { sessionStorage.removeItem('shoppingCart'); } catch (e) { /* ignora */ }
    document.addEventListener('DOMContentLoaded', () => {
        const count = document.getElementById('cart-count');
        if (count) { count.textContent = '0'; count.classList.add('hidden'); }
        const total = document.getElementById('cart-total-value');
        if (total) total.textContent = 'R$ 0,00';
        const container = document.querySelector('.account-page-container');
        if (!container) return;
        const box = document.createElement('div');
        box.className = 'payment-return ' + (retornoPagamento === 'aprovado' ? 'ok' : 'wait');
        box.innerHTML = retornoPagamento === 'aprovado'
            ? '<i class="fas fa-circle-check"></i><div><strong>Pagamento aprovado! 🎉</strong><p>Seu topo já está liberado logo abaixo, em <strong>Arquivos comprados</strong>. É só clicar em <strong>Baixar arquivo</strong>.</p></div>'
            : '<i class="fas fa-hourglass-half"></i><div><strong>Pagamento em processamento</strong><p>Assim que o Mercado Pago confirmar, seu topo aparece aqui para baixar. Pix costuma levar poucos segundos; atualize a página.</p></div>';
        container.prepend(box);
    });
}

// ---------- Login ----------
auth.onAuthStateChanged(user => {
    const welcome = document.getElementById('welcome-message');
    if (user) {
        if (welcome) welcome.textContent = `Olá, ${user.email.split('@')[0]}! Aqui ficam todos os topos que você comprou.`;
        carregarAreaDoCliente(user.uid);
    } else {
        if (welcome) welcome.innerHTML = 'Entre na sua conta para ver seus topos. <a href="#" id="login-cta">Entrar</a>';
        document.getElementById('my-files-grid').innerHTML = '';
        document.getElementById('order-history-container').innerHTML = '';
        const cta = document.getElementById('login-cta');
        if (cta) cta.addEventListener('click', (e) => { e.preventDefault(); window.openAuthModal && window.openAuthModal(); });
        setTimeout(() => window.openAuthModal && window.openAuthModal(), 300);
    }
});

let pedidos = [];

async function carregarAreaDoCliente(uid) {
    const filesGrid = document.getElementById('my-files-grid');
    filesGrid.innerHTML = '<div class="skeleton-card"><div class="sk-img"></div><div class="sk-line"></div></div>'.repeat(3);
    try {
        const snap = await getDocs(query(collection(db, "pedidos"), where("userId", "==", uid), orderBy("createdAt", "desc")));
        pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderPedidos();
        await atualizarStatusMercadoPago();
        renderPedidos();
        await renderArquivos();
    } catch (error) {
        console.error("Erro ao buscar pedidos:", error);
        filesGrid.innerHTML = '';
        document.getElementById('order-history-container').innerHTML = "<p>Ocorreu um erro ao carregar seus pedidos. Atualize a página.</p>";
    }
}

// Pergunta ao Mercado Pago se os pedidos já foram pagos e atualiza o status
async function atualizarStatusMercadoPago() {
    const ids = pedidos.filter(p => p.paymentMethod === 'Mercado Pago' && !FINAL_STATUSES.includes(String(p.status || '').toLowerCase())).map(p => p.id);
    if (!ids.length) return;
    try {
        const resp = await fetch(`${PAYMENT_API_URL}/status`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids })
        });
        if (!resp.ok) return;
        const result = await resp.json();
        for (const p of pedidos) {
            const info = result[p.id];
            if (!info || !info.status || info.status === p.status) continue;
            p.status = info.status;
            try { await updateDoc(doc(db, "pedidos", p.id), { status: info.status, mpPaymentId: info.mpPaymentId || '' }); } catch (e) { /* sem permissão: tudo bem */ }
        }
    } catch (e) {
        console.warn('Não foi possível consultar o Mercado Pago agora.', e);
    }
}

// ---------- Histórico de pedidos ----------
function renderPedidos() {
    const container = document.getElementById('order-history-container');
    const vazio = document.getElementById('no-orders-message');
    if (!pedidos.length) { container.innerHTML = ''; vazio.classList.remove('hidden'); return; }
    vazio.classList.add('hidden');
    container.innerHTML = pedidos.map(order => {
        const data = order.createdAt && order.createdAt.toDate ? order.createdAt.toDate().toLocaleDateString('pt-BR') : '';
        const itens = (order.items || []).map(i => `<li>${escapeHtml(i.title)} - ${brl(i.price)}</li>`).join('');
        return `
            <div class="order-card">
                <div class="order-header">
                    <span>Pedido: <strong>${escapeHtml(order.orderId)}</strong></span>
                    <span>Data: <strong>${data}</strong></span>
                </div>
                <div class="order-body">
                    <p><strong>Status:</strong> <span class="status-badge ${statusClass(order.status)}">${escapeHtml(order.status)}</span></p>
                    <p><strong>Total:</strong> ${brl(order.total)}</p>
                    <ul>${itens}</ul>
                </div>
            </div>`;
    }).join('');
}

// ---------- Arquivos comprados ----------
async function renderArquivos() {
    const grid = document.getElementById('my-files-grid');
    const vazio = document.getElementById('no-files-message');

    // Um card por topo (se comprou o mesmo topo duas vezes, mostra uma vez só)
    const vistos = new Map();
    const aguardando = [];
    for (const p of pedidos) {
        for (const item of (p.items || [])) {
            if (!item || !item.id) continue;
            if (isPaid(p.status)) {
                if (!vistos.has(item.id)) vistos.set(item.id, { item, pedido: p });
            } else if (!['cancelado', 'reembolsado', 'pagamento recusado'].includes(String(p.status || '').toLowerCase())) {
                aguardando.push({ item, pedido: p });
            }
        }
    }

    const comprados = [...vistos.values()];
    if (!comprados.length && !aguardando.length) {
        grid.innerHTML = '';
        vazio.classList.remove('hidden');
        return;
    }
    vazio.classList.add('hidden');

    // Busca os dados atuais dos produtos (foto, se o arquivo já foi enviado, prévia)
    const infos = {};
    await Promise.all([...new Set([...comprados, ...aguardando].map(c => c.item.id))].map(async (id) => {
        try { const s = await getDoc(doc(db, "products", id)); if (s.exists()) infos[id] = s.data(); } catch (e) { /* ignora */ }
    }));

    const cardComprado = ({ item, pedido }) => {
        const info = infos[item.id] || {};
        const img = info.image || item.image || '';
        const manual = pedido.paymentMethod !== 'Mercado Pago';
        let acoes;
        if (manual) {
            acoes = `<a class="btn btn-whatsapp" href="${WHATSAPP}?text=${encodeURIComponent('Olá! Quero receber o arquivo do pedido ' + (pedido.orderId || ''))}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> Receber pelo WhatsApp</a>`;
        } else if (info.hasFile === false || (!info.hasFile && Object.keys(info).length)) {
            acoes = `<p class="file-wait"><i class="fa-regular fa-clock"></i> Estamos preparando este arquivo. Ele aparece aqui em breve!</p>`;
        } else {
            acoes = `
                <button class="btn" data-baixar="${item.id}" data-pedido="${pedido.id}"><i class="fa-solid fa-download"></i> Baixar arquivo</button>
                <button class="btn btn-outline" data-ver="${item.id}" data-pedido="${pedido.id}" data-img="${escapeHtml(img)}"><i class="fa-regular fa-eye"></i> Visualizar</button>`;
        }
        return `
            <div class="file-card">
                <div class="file-media">${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(item.title)}" loading="lazy">` : ''}<span class="file-badge ok"><i class="fas fa-check"></i> Liberado</span></div>
                <div class="file-info">
                    <h3>${escapeHtml(item.title)}</h3>
                    <small>Pedido ${escapeHtml(pedido.orderId)} · .studio3</small>
                    <div class="file-actions">${acoes}</div>
                </div>
            </div>`;
    };
    const cardAguardando = ({ item, pedido }) => {
        const img = (infos[item.id] || {}).image || item.image || '';
        return `
            <div class="file-card waiting">
                <div class="file-media">${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(item.title)}" loading="lazy">` : ''}<span class="file-badge wait"><i class="fa-regular fa-clock"></i> Aguardando pagamento</span></div>
                <div class="file-info">
                    <h3>${escapeHtml(item.title)}</h3>
                    <small>Pedido ${escapeHtml(pedido.orderId)}</small>
                    <p class="file-wait">Libera automaticamente quando o pagamento for aprovado.</p>
                </div>
            </div>`;
    };

    grid.innerHTML = comprados.map(cardComprado).join('') + aguardando.map(cardAguardando).join('');
    grid.querySelectorAll('[data-baixar]').forEach(b => b.addEventListener('click', () => baixar(b)));
    grid.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => visualizar(b)));
}

async function pedirArquivo(produto, pedido, modo) {
    const token = await auth.currentUser.getIdToken();
    const resp = await fetch(`${PAYMENT_API_URL}/arquivo?produto=${encodeURIComponent(produto)}&pedido=${encodeURIComponent(pedido)}&modo=${modo}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        const err = new Error(data.error || 'Não foi possível abrir o arquivo agora.');
        err.status = resp.status;
        throw err;
    }
    const nome = decodeURIComponent(resp.headers.get('X-Nome-Arquivo') || `${produto}.studio3`);
    return { blob: await resp.blob(), nome };
}

async function baixar(btn) {
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparando...';
    try {
        const { blob, nome } = await pedirArquivo(btn.dataset.baixar, btn.dataset.pedido, 'baixar');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = nome;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        window.showToast && window.showToast(`Download iniciado: ${nome}`);
    } catch (e) {
        window.showToast && window.showToast(e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

async function visualizar(btn) {
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Abrindo...';
    try {
        const { blob } = await pedirArquivo(btn.dataset.ver, btn.dataset.pedido, 'ver');
        const url = URL.createObjectURL(blob);
        if (blob.type === 'application/pdf') {
            const w = window.open(url, '_blank');
            if (!w) window.location.href = url;
        } else {
            window.openLightbox(url);
        }
    } catch (e) {
        if (e.status === 404) {
            // Sem prévia cadastrada: mostra a foto do topo
            if (btn.dataset.img) window.openLightbox(btn.dataset.img);
            window.showToast && window.showToast('O arquivo .studio3 abre no Silhouette Studio. Aqui você vê a foto do topo.');
        } else {
            window.showToast && window.showToast(e.message);
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}
