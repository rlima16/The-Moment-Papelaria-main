// script.js ATUALIZADO com carrossel de feedbacks

import { db } from './firebase-auth.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// --- INICIALIZAÇÃO QUANDO A PÁGINA CARREGA ---
document.addEventListener('DOMContentLoaded', function () {
    displayProductCarousel(); // Inicia o carrossel de produtos
    displayTestimonialCarousel(); // Inicia o carrossel de feedbacks
});


// --- FUNÇÃO DO CARROSSEL DE PRODUTOS ---
async function displayProductCarousel() {
    const carouselWrapper = document.getElementById('carousel-wrapper');
    if (!carouselWrapper) return;

    try {
        const q = query(collection(db, "products"), where("featured", "==", true));
        const querySnapshot = await getDocs(q);
        const featuredProducts = [];
        querySnapshot.forEach((doc) => {
            featuredProducts.push({ id: doc.id, ...doc.data() });
        });

        carouselWrapper.innerHTML = '';
        featuredProducts.forEach(product => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.innerHTML = `<img src="${product.image}" alt="${product.title}" onclick="window.openLightbox('${product.image}')">`;
            carouselWrapper.appendChild(slide);
        });
        
        // Inicializa o Swiper dos produtos
        new Swiper(".swiper:not(.testimonialSwiper)", { // Seletor para não conflitar
            slidesPerView: 2,
            spaceBetween: 20,
            autoplay: { delay: 3500, disableOnInteraction: false },
            loop: true,
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
            pagination: { el: '.swiper-pagination', clickable: true },
        });

    } catch (error) {
        console.error("Erro ao buscar produtos para o carrossel:", error);
    }
}


// --- NOVA FUNÇÃO DO CARROSSEL DE FEEDBACKS ---
function displayTestimonialCarousel() {
    // 👇 COLOQUE AQUI OS NOMES DOS SEUS ARQUIVOS DE IMAGEM 👇
    const testimonialImages = [
        'images/feedback1.jpg',
        'images/feedback2.jpg',
        'images/feedback3.jpg',
        'images/feedback4.jpg',
        'images/feedback5.jpg',
        'images/feedback6.jpg',
        'images/feedback7.jpg',
        'images/feedback8.jpg',
        'images/feedback9.jpg' 
        // Adicione mais imagens aqui, se tiver
    ];

    const testimonialWrapper = document.getElementById('testimonial-wrapper');
    if (!testimonialWrapper) return;

    testimonialWrapper.innerHTML = '';

    testimonialImages.forEach(imageUrl => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        // ADICIONAMOS O onclick AQUI PARA ABRIR O LIGHTBOX
        slide.innerHTML = `<img src="${imageUrl}" alt="Feedback de cliente" onclick="window.openLightbox('${imageUrl}')">`;
        testimonialWrapper.appendChild(slide);
    });

    // Inicializa o Swiper dos feedbacks
    new Swiper(".testimonialSwiper", {
        slidesPerView: 1, // Mostra 1 por vez no celular
        spaceBetween: 30,
        loop: true,
        autoplay: {
            delay: 4000,
            disableOnInteraction: false,
        },
        pagination: {
            el: ".swiper-pagination",
            clickable: true,
        },
        // Mostra mais de 1 em telas maiores
        breakpoints: {
            // Quando a tela for 768px ou maior
            768: {
                slidesPerView: 2,
                spaceBetween: 40,
            },
            // Quando a tela for 1024px ou maior
            1024: {
                slidesPerView: 3,
                spaceBetween: 50,
            },
        },
    });
}