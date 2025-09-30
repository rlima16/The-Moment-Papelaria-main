// firebase-auth.js (versão completa com Autenticação + Firestore + Login funcionando)

// Importa as funções necessárias do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBhiNkiR7D_xI_W_2L2bLUG3gC1--HUn18",
    authDomain: "the-moment-b3e02.firebaseapp.com",
    projectId: "the-moment-b3e02",
    storageBucket: "the-moment-b3e02.appspot.com",
    messagingSenderId: "263728888202",
    appId: "1:263728888202:web:50fb8ce5b910a80a1e3073",
    measurementId: "G-4LP2H73973"
};

// --- INICIALIZAÇÃO ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Exporta para outros scripts se necessário
export { auth, db, collection, addDoc, serverTimestamp };

// --- GERENCIADOR DE ESTADO DO USUÁRIO ---
// SUBSTITUA A FUNÇÃO onAuthStateChanged INTEIRA POR ESTA:

// SUBSTITUA A onAuthStateChanged INTEIRA PELA VERSÃO ABAIXO:

onAuthStateChanged(auth, (user) => {
    const authLink = document.getElementById('auth-link');
    const userMenuTrigger = document.getElementById('user-menu-trigger');
    const userInfo = document.getElementById('user-info');

    if (user) {
        // --- SE O USUÁRIO ESTIVER LOGADO ---
        authLink.classList.add('hidden'); // Esconde "Login | Cadastre-se"
        userMenuTrigger.classList.remove('hidden'); // Mostra o menu do usuário
        userInfo.textContent = `Olá, ${user.email.split('@')[0]}`; // Define o nome

    } else {
        // --- SE O USUÁRIO ESTIVER DESLOGADO ---
        authLink.classList.remove('hidden'); // Mostra "Login | Cadastre-se"
        userMenuTrigger.classList.add('hidden'); // Esconde o menu do usuário
        
        // Garante que o dropdown também feche ao deslogar
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
    }
});

// --- EVENT LISTENERS ---
// Toda a lógica de formulários
document.addEventListener('DOMContentLoaded', () => {

    // ===== LOGIN =====
    const loginForm  = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');



if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // evita recarregar a página

        const email    = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();

        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.closeAuthModal(); // <--- ADICIONE ESTA LINHA AQUI
            // onAuthStateChanged cuidará da interface
        } catch (err) {
            console.error(err);
            if (loginError) {
                loginError.textContent = traduzErroFirebase(err.code);
                loginError.classList.remove('hidden');
            }
        }
    });
}

    // ===== CADASTRO (opcional) =====
    const signupForm  = document.getElementById('signup-form');
    const signupError = document.getElementById('signup-error');

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email    = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value.trim();

            try {
                await createUserWithEmailAndPassword(auth, email, password);
                // Aqui você poderia também salvar dados no Firestore, se desejar
            } catch (err) {
                console.error(err);
                if (signupError) {
                    signupError.textContent = traduzErroFirebase(err.code);
                    signupError.classList.remove('hidden');
                }
            }
        });
    }

    // ===== LOGOUT =====
    const logoutBtn = document.getElementById('logout-link');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await signOut(auth);
        });
    }
});

// Função para mensagens mais amigáveis
function traduzErroFirebase(code) {
    switch (code) {
        case "auth/invalid-email":      return "E-mail inválido.";
        case "auth/user-not-found":     return "Usuário não encontrado.";
        case "auth/wrong-password":     return "Senha incorreta.";
        case "auth/email-already-in-use": return "E-mail já cadastrado.";
        default: return "Não foi possível completar a ação.";
    }
}

// no final do arquivo firebase-auth.js (após definir onAuthStateChanged e listeners):
// garante que as funções existam (são chamadas pelo shared-functions.js)
window.openAuthModal = window.openAuthModal || function() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  document.getElementById('register-view')?.classList.add('hidden');
  document.getElementById('login-view')?.classList.remove('hidden');
  modal.classList.remove('hidden');
};
window.closeAuthModal = window.closeAuthModal || function() {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.classList.add('hidden');
};
window.showRegisterView = window.showRegisterView || function() {
  document.getElementById('login-view')?.classList.add('hidden');
  document.getElementById('register-view')?.classList.remove('hidden');
};
window.showLoginView = window.showLoginView || function() {
  document.getElementById('register-view')?.classList.add('hidden');
  document.getElementById('login-view')?.classList.remove('hidden');
};

// --- LÓGICA PARA EXIBIR O MENU DROPDOWN DO USUÁRIO ---

// Executa quando o conteúdo da página é carregado
document.addEventListener('DOMContentLoaded', () => {

    const menuTrigger = document.getElementById('user-menu-trigger');
    const dropdown = document.getElementById('user-dropdown');

    // Verifica se os dois elementos existem na página
    if (menuTrigger && dropdown) {
        
        // Adiciona um "escutador" de clique no gatilho do menu ("Olá, nome")
        menuTrigger.addEventListener('click', (event) => {
            // Impede que o clique se propague para outros elementos
            event.stopPropagation();
            
            // Mostra ou esconde o menu dropdown
            dropdown.classList.toggle('hidden');
        });
    }
});

// Adiciona um "escutador" de clique na janela inteira
window.addEventListener('click', (event) => {
    const dropdown = document.getElementById('user-dropdown');

    // Se o dropdown estiver visível, esconde-o (efeito de fechar ao clicar fora)
    if (dropdown && !dropdown.classList.contains('hidden')) {
        dropdown.classList.add('hidden');
    }
});