// script.js — página inicial

import { db } from './firebase-auth.js?v=20261009';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { createProductCard } from './shared-functions.js?v=20261009';

document.addEventListener('DOMContentLoaded', () => {
    displayFeaturedProducts();
    displayTestimonialCarousel();
});

// --- OS QUERIDINHOS (produtos marcados como destaque no painel admin) ---
async function displayFeaturedProducts() {
    const grid = document.getElementById('featured-grid');
    if (!grid) return;

    try {
        const snapshot = await getDocs(query(collection(db, "products"), where("featured", "==", true)));
        const featured = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .sort(() => 0.5 - Math.random())   // muda a ordem a cada visita
            .slice(0, 8);

        grid.innerHTML = '';
        if (featured.length === 0) {
            grid.closest('section')?.classList.add('hidden');
            return;
        }
        featured.forEach(product => grid.appendChild(createProductCard(product)));
    } catch (error) {
        console.error("Erro ao buscar produtos em destaque:", error);
        grid.closest('section')?.classList.add('hidden');
    }
}

// --- DEPOIMENTOS (prints de clientes) ---
function displayTestimonialCarousel() {
    // 👇 Para adicionar depoimentos, coloque a imagem na pasta "images" e o nome aqui 👇
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
    ];

    const wrapper = document.getElementById('testimonial-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = '';
    testimonialImages.forEach(imageUrl => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Depoimento de cliente da The Moment';
        img.loading = 'lazy';
        img.addEventListener('click', () => window.openLightbox(imageUrl));
        slide.appendChild(img);
        wrapper.appendChild(slide);
    });

    if (typeof Swiper === 'undefined') return;
    new Swiper(".testimonialSwiper", {
        slidesPerView: 1.15,
        spaceBetween: 16,
        loop: true,
        grabCursor: true,
        autoplay: { delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true },
        pagination: { el: ".testimonialSwiper .swiper-pagination", clickable: true },
        breakpoints: {
            600:  { slidesPerView: 2.2, spaceBetween: 20 },
            1024: { slidesPerView: 3, spaceBetween: 28 },
        },
    });
}
