// script.js ATUALIZADO

// Importa as ferramentas do Firebase
import { db } from './firebase-auth.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";


// A função do carrossel agora também é "async"
async function displayCarousel() {
    const carouselWrapper = document.getElementById('carousel-wrapper');
    if (!carouselWrapper) return;

    try {
        // 1. Cria uma consulta que busca na coleção "products" ONDE o campo "featured" é igual a "true"
        const q = query(collection(db, "products"), where("featured", "==", true));
        const querySnapshot = await getDocs(q);
        
        const featuredProducts = [];
        querySnapshot.forEach((doc) => {
            featuredProducts.push({ id: doc.id, ...doc.data() });
        });

        carouselWrapper.innerHTML = '';

        // 2. Cria um slide para cada produto encontrado
        featuredProducts.forEach(product => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.innerHTML = `<img src="${product.image}" alt="${product.title}" onclick="window.openLightbox('${product.image}')">`;
            carouselWrapper.appendChild(slide);
        });
        
        // 3. Inicializa o Swiper
        if (typeof Swiper !== "undefined") {
            new Swiper(".swiper", {
                effect: 'fade',
                autoplay: { delay: 3500, disableOnInteraction: false },
                loop: true,
                navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
                pagination: { el: '.swiper-pagination', clickable: true },
            });
        }

    } catch (error) {
        console.error("Erro ao buscar produtos para o carrossel:", error);
    }
}

// Executa quando a página carrega
document.addEventListener('DOMContentLoaded', displayCarousel);