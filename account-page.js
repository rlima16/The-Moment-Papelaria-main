import { auth, db } from './firebase-auth.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

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

async function fetchUserOrders(userId) {
    const historyContainer = document.getElementById('order-history-container');
    const noOrdersMessage = document.getElementById('no-orders-message');
    
    // Cria uma consulta ao Firestore para buscar pedidos do usuário logado, ordenados pelo mais recente
    const ordersRef = collection(db, "pedidos");
    const q = query(ordersRef, where("userId", "==", userId), orderBy("createdAt", "desc"));

    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            // Se não encontrar pedidos, mostra a mensagem
            noOrdersMessage.classList.remove('hidden');
            return;
        }

        let ordersHtml = '';
        querySnapshot.forEach(doc => {
            const order = doc.data();
            const orderDate = order.createdAt.toDate().toLocaleDateString('pt-BR');
            
            // Cria a lista de itens do pedido
            const itemsList = order.items.map(item => 
                `<li>${item.title} - R$ ${Number(item.price).toFixed(2).replace('.', ',')}</li>`
            ).join('');

            // Monta o card de cada pedido
            ordersHtml += `
                <div class="order-card">
                    <div class="order-header">
                        <span>Pedido: <strong>${order.orderId}</strong></span>
                        <span>Data: <strong>${orderDate}</strong></span>
                    </div>
                    <div class="order-body">
                        <p><strong>Status:</strong> ${order.status}</p>
                        <p><strong>Total:</strong> R$ ${Number(order.total).toFixed(2).replace('.', ',')}</p>
                        <p><strong>Itens:</strong></p>
                        <ul>${itemsList}</ul>
                    </div>
                </div>
            `;
        });

        historyContainer.innerHTML = ordersHtml;

    } catch (error) {
        console.error("Erro ao buscar pedidos:", error);
        historyContainer.innerHTML = "<p>Ocorreu um erro ao carregar seus pedidos. Tente novamente mais tarde.</p>";
    }
}