import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail
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

// Exporta para outros scripts
export { auth, db, collection, addDoc, serverTimestamp };

// --- GERENCIADOR DE ESTADO DO USUÁRIO ---
onAuthStateChanged(auth, (user) => {
    const authLink = document.getElementById('auth-link');
    const userMenuTrigger = document.getElementById('user-menu-trigger');
    const userInfo = document.getElementById('user-info');

    if (user) {
        if(authLink) authLink.classList.add('hidden');
        if(userMenuTrigger) userMenuTrigger.classList.remove('hidden');
        if(userInfo) userInfo.textContent = `Olá, ${user.email.split('@')[0]}`;
    } else {
        if(authLink) authLink.classList.remove('hidden');
        if(userMenuTrigger) userMenuTrigger.classList.add('hidden');
    }
});

// --- EVENT LISTENERS DOS FORMULÁRIOS DE AUTH ---
document.addEventListener('DOMContentLoaded', () => {

    // ===== LOGIN =====
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value.trim();
            try {
                await signInWithEmailAndPassword(auth, email, password);
                closeAuthModal();
            } catch (err) {
                const loginError = document.getElementById('login-error');
                if (loginError) {
                    loginError.textContent = traduzErroFirebase(err.code);
                    loginError.classList.remove('hidden');
                }
            }
        });
    }

    // ===== CADASTRO =====
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value.trim();
            try {
                await createUserWithEmailAndPassword(auth, email, password);
                closeAuthModal();
            } catch (err) {
                const signupError = document.getElementById('signup-error');
                if (signupError) {
                    signupError.textContent = traduzErroFirebase(err.code);
                    signupError.classList.remove('hidden');
                }
            }
        });
    }

    // ===== LOGOUT (agora o listener está aqui) =====
    const logoutBtn = document.getElementById('logout-link');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await signOut(auth);
        });
    }
    
    // ===== ESQUECI A SENHA =====
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = prompt("Digite seu e-mail para redefinir a senha:");
            if (email) {
                try {
                    await sendPasswordResetEmail(auth, email);
                    alert("Link de redefinição enviado! Verifique seu e-mail.");
                } catch (err) {
                    alert("Não foi possível enviar o e-mail. Verifique se o e-mail está correto.");
                }
            }
        });
    }
});


// Função para mensagens de erro amigáveis
function traduzErroFirebase(code) {
    switch (code) {
        case "auth/invalid-email":      return "E-mail inválido.";
        case "auth/user-not-found":     return "Usuário não encontrado.";
        case "auth/wrong-password":     return "Senha incorreta.";
        case "auth/email-already-in-use": return "E-mail já cadastrado.";
        default: return "Ocorreu um erro. Tente novamente.";
    }
}

// Funções globais para controle do Modal
function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    document.getElementById('register-view')?.classList.add('hidden');
    document.getElementById('login-view')?.classList.remove('hidden');
    modal.classList.remove('hidden');
}
function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.add('hidden');
}
function showRegisterView() {
    document.getElementById('login-view')?.classList.add('hidden');
    document.getElementById('register-view')?.classList.remove('hidden');
}
function showLoginView() {
    document.getElementById('register-view')?.classList.add('hidden');
    document.getElementById('login-view')?.classList.remove('hidden');
}
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.showRegisterView = showRegisterView;
window.showLoginView = showLoginView;