// admin.js (VERSÃO FINAL CORRIGIDA)

import { auth, db } from './firebase-auth.js?v=20261013';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, deleteDoc, getDoc, updateDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// 👇 E-mails que podem abrir o painel (adicione o da sua esposa aqui, se quiser)
const ADMIN_EMAILS = ['rodrigoalveslima5533@gmail.com'];
const PAYMENT_API_URL = 'https://the-moment-papelaria-main.rodrigoalveslima5533.workers.dev';

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
    resetFileFields(null);
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
    const description = (document.getElementById('product-description')?.value || '').trim();
    const normalizedTitle = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const keywords = normalizedTitle.split(' ').filter(word => word && word !== '-');
    const productData = {
        title: name, price: price, image: imageUrl,
        featured: isFeatured, category: category, keywords: keywords,
        description: description
    };
    const arquivo = document.getElementById('product-file').files[0];
    const previa = document.getElementById('product-preview').files[0];
    formButton.disabled = true;
    formButton.textContent = 'Salvando...';
    try {
        let productId = currentlyEditingId;
        if (productId) {
            await updateDoc(doc(db, "products", productId), productData);
        } else {
            const ref = await addDoc(collection(db, "products"), productData);
            productId = ref.id;
        }
        if (arquivo) {
            formButton.textContent = 'Enviando arquivo...';
            await enviarArquivoProduto(productId, arquivo, 'arquivo');
            await updateDoc(doc(db, "products", productId), { hasFile: true, fileName: arquivo.name });
        }
        if (previa) {
            formButton.textContent = 'Enviando prévia...';
            await enviarArquivoProduto(productId, previa, 'previa');
            await updateDoc(doc(db, "products", productId), { previewName: previa.name });
        }
        alert(`Produto "${name}" salvo com sucesso!${arquivo ? ' Arquivo enviado ✔' : ''}`);
        showManageView();
    } catch (error) {
        console.error("Erro ao salvar produto: ", error);
        alert("Ocorreu um erro ao salvar: " + (error.message || error));
    } finally {
        formButton.disabled = false;
        formButton.textContent = currentlyEditingId ? "Salvar Alterações" : "Adicionar Produto";
    }
});

// Envia o arquivo do topo (ou a prévia) para o servidor de arquivos (Cloudflare)
async function enviarArquivoProduto(productId, file, tipo) {
    if (file.size > 25 * 1024 * 1024) throw new Error(`"${file.name}" tem mais de 25 MB.`);
    const token = await auth.currentUser.getIdToken();
    const resp = await fetch(`${PAYMENT_API_URL}/admin/arquivo?produto=${encodeURIComponent(productId)}&tipo=${tipo}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': file.type || 'application/octet-stream',
            'X-Nome-Arquivo': encodeURIComponent(file.name)
        },
        body: file
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `Falha ao enviar ${file.name}`);
    return data;
}

function resetFileFields(product) {
    document.getElementById('product-file').value = '';
    document.getElementById('product-preview').value = '';
    document.getElementById('product-file-status').textContent = product && product.fileName
        ? `Arquivo atual: ${product.fileName} (escolha outro para substituir)` : 'Nenhum arquivo enviado ainda.';
    document.getElementById('product-preview-status').textContent = product && product.previewName
        ? `Prévia atual: ${product.previewName}` : 'Sem prévia: o cliente vê a foto do produto.';
}

async function loadProductsForManagement() {
    productsListContainer.innerHTML = '<p>Carregando produtos...</p>';
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        let tableHtml = `<table class="product-manage-list"><tr><th>Imagem</th><th>Nome</th><th>Categoria</th><th>Preço</th><th>Arquivo</th><th>Ações</th></tr>`;
        if (querySnapshot.empty) {
            tableHtml += '<tr><td colspan="6">Nenhum produto cadastrado.</td></tr>';
        } else {
            querySnapshot.forEach((doc) => {
                const product = doc.data();
                tableHtml += `
                    <tr>
                        <td><img src="${product.image}" alt="${product.title}"></td>
                        <td>${product.title}</td>
                        <td>${product.category || 'N/A'}</td>
                        <td>R$ ${Number(product.price).toFixed(2)}</td>
                        <td>${product.hasFile ? '<span class="status-badge ok">✔ enviado</span>' : '<span class="status-badge wait">falta</span>'}</td>
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
            const cat = product.category || "";
            document.getElementById('product-category').value = (cat === 'Disney' || cat === 'Turma da Monica') ? 'Personagens' : cat;
            document.getElementById('product-featured').checked = product.featured || false;
            const descriptionField = document.getElementById('product-description');
            if (descriptionField) descriptionField.value = product.description || '';
            resetFileFields(product);
            
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

// ===================== LOGIN DO PAINEL =====================
const loginBox = document.getElementById('admin-login');
const panel = document.getElementById('admin-panel');
const loginMsg = document.getElementById('admin-login-msg');
let painelIniciado = false;

onAuthStateChanged(auth, (user) => {
    const autorizado = user && ADMIN_EMAILS.includes(String(user.email || '').toLowerCase());
    if (autorizado) {
        loginBox.classList.add('hidden');
        panel.classList.remove('hidden');
        if (!painelIniciado) { painelIniciado = true; showOrdersView(); }
    } else {
        panel.classList.add('hidden');
        loginBox.classList.remove('hidden');
        if (user) loginMsg.textContent = `A conta ${user.email} não tem acesso ao painel.`;
    }
});
window.closeAuthModal = () => {}; // o login do painel não usa o modal do site

// ===================== PEDIDOS =====================
const ordersView = document.getElementById('orders-view');
const showOrdersBtn = document.getElementById('show-orders-view-btn');
const ordersContainer = document.getElementById('orders-list-container');
const ordersFilter = document.getElementById('orders-filter');
const STATUS_OPCOES = ['Aguardando Pagamento', 'Pago', 'Entregue', 'Pagamento recusado', 'Cancelado', 'Reembolsado'];
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const badgeClass = (st) => {
    const s = String(st || '').toLowerCase();
    if (s === 'pago' || s === 'entregue') return 'ok';
    if (s.includes('recusado') || s.includes('cancelado') || s.includes('reembolsado')) return 'bad';
    return 'wait';
};
const TIPO_PAGAMENTO = { credit_card: 'cartão de crédito', debit_card: 'cartão de débito', bank_transfer: 'Pix', account_money: 'saldo Mercado Pago' };
let pedidosCache = [];

function setActive(btn) {
    [showOrdersBtn, showAddBtn, showManageBtn].forEach(b => b && b.classList.remove('active'));
    btn.classList.add('active');
}

function showOrdersView() {
    ordersView.classList.remove('hidden');
    addView.classList.add('hidden');
    manageView.classList.add('hidden');
    setActive(showOrdersBtn);
    loadOrders();
}
showOrdersBtn.addEventListener('click', showOrdersView);
showAddBtn.addEventListener('click', () => { ordersView.classList.add('hidden'); showOrdersBtn.classList.remove('active'); });
showManageBtn.addEventListener('click', () => { ordersView.classList.add('hidden'); showOrdersBtn.classList.remove('active'); });
document.getElementById('orders-refresh').addEventListener('click', loadOrders);
ordersFilter.addEventListener('change', renderOrders);

async function loadOrders() {
    ordersContainer.innerHTML = '<p>Carregando pedidos...</p>';
    try {
        const snap = await getDocs(query(collection(db, 'pedidos'), orderBy('createdAt', 'desc'), limit(150)));
        pedidosCache = snap.docs.map(d => ({ id: d.id, ...d.data(), mp: null }));
        renderOrders();
        // Consulta o Mercado Pago para os pedidos pagos por lá
        const ids = pedidosCache.filter(p => p.paymentMethod === 'Mercado Pago').map(p => p.id).slice(0, 50);
        if (!ids.length) return;
        const resp = await fetch(`${PAYMENT_API_URL}/status`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids })
        });
        if (!resp.ok) return;
        const result = await resp.json();
        for (const p of pedidosCache) {
            const info = result[p.id];
            if (!info) continue;
            p.mp = info;
            // Marca como "Pago" automaticamente quando o Mercado Pago aprovou
            if (info.status === 'Pago' && !['Pago', 'Entregue'].includes(p.status)) {
                try { await updateDoc(doc(db, 'pedidos', p.id), { status: 'Pago', mpPaymentId: info.mpPaymentId }); p.status = 'Pago'; } catch (e) { console.warn(e); }
            }
        }
        renderOrders();
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        ordersContainer.innerHTML = error && error.code === 'permission-denied'
            ? '<p>Sem permissão para ler os pedidos. É preciso liberar o acesso do administrador nas regras do Firestore.</p>'
            : '<p>Erro ao carregar os pedidos. Clique em Atualizar para tentar de novo.</p>';
    }
}

function renderOrders() {
    const filtro = ordersFilter.value;
    const lista = pedidosCache.filter(p => {
        if (filtro === 'pagos') return p.status === 'Pago';
        if (filtro === 'pendentes') return !['Entregue', 'Cancelado', 'Reembolsado', 'Pagamento recusado'].includes(p.status);
        return true;
    });
    if (!lista.length) { ordersContainer.innerHTML = '<p>Nenhum pedido aqui. 🎉</p>'; return; }

    ordersContainer.innerHTML = `<div class="orders-cards">${lista.map(p => {
        const data = p.createdAt && p.createdAt.toDate ? p.createdAt.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
        const itens = (p.items || []).map(i => `<li>${esc(i.title)} <span>${brl(i.price)}</span></li>`).join('');
        const mp = p.paymentMethod === 'Mercado Pago'
            ? (p.mp ? (p.mp.status ? `<span class="status-badge ${badgeClass(p.mp.status)}">${esc(p.mp.status)}</span>${p.mp.paymentType ? ` <small>${esc(TIPO_PAGAMENTO[p.mp.paymentType] || p.mp.paymentType)}</small>` : ''}${p.mp.statusDetail && p.mp.mpStatus === 'rejected' ? ` <small title="motivo da recusa">(${esc(p.mp.statusDetail)})</small>` : ''}` : '<small>sem pagamento ainda</small>') : '<small>consultando...</small>')
            : '<small>Pix manual: confira no banco</small>';
        const opcoes = STATUS_OPCOES.map(o => `<option${o === p.status ? ' selected' : ''}>${o}</option>`).join('');
        const tel = '551120504970';
        return `
        <div class="order-admin-card">
            <div class="oac-head">
                <div><strong>${esc(p.orderId)}</strong> <small>${data}</small></div>
                <div class="oac-total">${brl(p.total)}</div>
            </div>
            <div class="oac-body">
                <div><small>Cliente</small><br>${esc(p.userName)}<br><a href="mailto:${esc(p.userEmail)}">${esc(p.userEmail)}</a></div>
                <div><small>Itens</small><ul>${itens}</ul></div>
                <div><small>Forma de pagamento</small><br>${esc(p.paymentMethod || 'Pix manual')}<br><small>Mercado Pago:</small> ${mp}</div>
            </div>
            <div class="oac-foot">
                <label>Status: <select data-status-id="${p.id}">${opcoes}</select></label>
                <span class="status-badge ${badgeClass(p.status)}">${esc(p.status)}</span>
            </div>
        </div>`;
    }).join('')}</div>`;

    ordersContainer.querySelectorAll('[data-status-id]').forEach(sel => sel.addEventListener('change', async () => {
        const id = sel.dataset.statusId;
        try {
            await updateDoc(doc(db, 'pedidos', id), { status: sel.value });
            const p = pedidosCache.find(x => x.id === id); if (p) p.status = sel.value;
            renderOrders();
        } catch (e) {
            alert('Não foi possível mudar o status: ' + (e.message || e));
        }
    }));
}
