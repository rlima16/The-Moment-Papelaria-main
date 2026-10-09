import { auth, db } from './firebase-auth.js';
import { collection, query, where, getDocs, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Mesmo endereço usado no carrinho (servidor de pagamentos no Cloudflare)
const PAYMENT_API_URL = 'https://the-moment-papelaria-main.rodrigoalveslima5533.workers.dev';
const FINAL_STATUSES = ['pago', 'entregue', 'cancelado', 'reembolsado'];

// Retorno do Mercado Pago: mostra aviso e esvazia o carrinho
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
            ? '<i class="fas fa-circle-check"></i><div><strong>Pagamento aprovado! 🎉</strong><p>Obrigada pela compra. Em breve enviaremos seu arquivo. Se quiser agilizar, <a href="https://wa.me/551120504970" target="_blank" rel="noopener noreferrer">chame no WhatsApp</a>.</p></div>'
            : '<i class="fas fa-hourglass-half"></i><div><strong>Pagamento em processamento</strong><p>Assim que o Mercado Pago confirmar, atualizamos o status do seu pedido.</p></div>';
        container.prepend(box);
    });
}

const statusClass = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'pago' || s === 'entregue') return 'ok';
    if (s.includes('recusado') || s.includes('cancelado')) return 'bad';
    return 'wait';
};

// Observa o estado de autenticação
auth.onAuthStateChanged(user => {
    if (user) {
        // Se o usuário está logado, mostra a mensagem de boas-vindas e busca os pedidos
        const welcomeMessage = document.getElementById('welcome-message');
        if (welcomeMessage) {
            welcomeMessage.textContent = `Bem-vindo(a) de volta, ${user.email}!`;
        }
        fetchUserOrders(user.uid);
    } else {
        // Se o usuário não está logado, redireciona para a página inicial
        console.log("Usuário não logado. Redirecionando...");
        window.location.href = 'index.html';
    }
});

const escapeHtml = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function fetchUserOrders(userId) {
    const historyContainer = document.getElementById('order-history-container');
    const noOrdersMessage = document.getElementById('no-orders-message');

    // Pedidos do usuário logado, do mais recente para o mais antigo
    const q = query(collection(db, "pedidos"), where("userId", "==", userId), orderBy("createdAt", "desc"));

    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            noOrdersMessage.classList.remove('hidden');
            return;
        }

        let ordersHtml = '';
        const paraConsultar = [];
        querySnapshot.forEach(d => {
            const order = d.data();
            const orderDate = order.createdAt && order.createdAt.toDate ? order.createdAt.toDate().toLocaleDateString('pt-BR') : '';
            const itemsList = (order.items || []).map(item =>
                `<li>${escapeHtml(item.title)} - R$ ${Number(item.price).toFixed(2).replace('.', ',')}</li>`
            ).join('');

            if (order.paymentMethod === 'Mercado Pago' && !FINAL_STATUSES.includes(String(order.status || '').toLowerCase())) {
                paraConsultar.push(d.id);
            }

            ordersHtml += `
                <div class="order-card" data-order-id="${d.id}">
                    <div class="order-header">
                        <span>Pedido: <strong>${escapeHtml(order.orderId)}</strong></span>
                        <span>Data: <strong>${orderDate}</strong></span>
                    </div>
                    <div class="order-body">
                        <p><strong>Status:</strong> <span class="status-badge ${statusClass(order.status)}">${escapeHtml(order.status)}</span>${order.paymentMethod ? ` · ${escapeHtml(order.paymentMethod)}` : ''}</p>
                        <p><strong>Total:</strong> R$ ${Number(order.total).toFixed(2).replace('.', ',')}</p>
                        <p><strong>Itens:</strong></p>
                        <ul>${itemsList}</ul>
                    </div>
                </div>
            `;
        });

        historyContainer.innerHTML = ordersHtml;
        if (paraConsultar.length) atualizarStatusMercadoPago(paraConsultar);

    } catch (error) {
        console.error("Erro ao buscar pedidos:", error);
        historyContainer.innerHTML = "<p>Ocorreu um erro ao carregar seus pedidos. Tente novamente mais tarde.</p>";
    }
}

// Pergunta ao Mercado Pago se os pedidos já foram pagos e atualiza a tela (e o pedido)
async function atualizarStatusMercadoPago(ids) {
    try {
        const resp = await fetch(`${PAYMENT_API_URL}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        if (!resp.ok) return;
        const result = await resp.json();
        for (const id of ids) {
            const info = result[id];
            if (!info || !info.status) continue;
            const badge = document.querySelector(`[data-order-id="${id}"] .status-badge`);
            if (badge) {
                badge.textContent = info.status;
                badge.className = `status-badge ${statusClass(info.status)}`;
            }
            try {
                await updateDoc(doc(db, "pedidos", id), { status: info.status, mpPaymentId: info.mpPaymentId || '' });
            } catch (e) { /* sem permissão para gravar: a tela já mostra o status certo */ }
        }
    } catch (e) {
        console.warn('Não foi possível consultar o Mercado Pago agora.', e);
    }
}
