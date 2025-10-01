// script.js ATUALIZADO

import { products } from './products-data.js'; // Importa os produtos

// Executa as funções quando a página estiver pronta
document.addEventListener('DOMContentLoaded', function () {
    displayCarousel();
});

// Função para criar e inicializar o carrossel com os produtos em destaque
function displayCarousel() {
    const carouselWrapper = document.getElementById('carousel-wrapper');
    if (!carouselWrapper) return;

    // Filtra apenas os produtos marcados como "featured: true"
    const featuredProducts = products.filter(product => product.featured === true);

    // Limpa o conteúdo antigo do carrossel
    carouselWrapper.innerHTML = '';

    // Cria um slide para cada produto em destaque
    featuredProducts.forEach(product => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        // A imagem agora abre o lightbox, como na página de produtos
        slide.innerHTML = `<img src="${product.image}" alt="${product.title}" onclick="window.openLightbox('${product.image}')">`;
        carouselWrapper.appendChild(slide);
    });

    // Inicializa o Swiper (código do carrossel em si)
    if (typeof Swiper !== "undefined") {
        new Swiper(".swiper", {
            effect: 'fade',
            autoplay: {
                delay: 3500,
                disableOnInteraction: false,
            },
            loop: true,
            navigation: {
              nextEl: '.swiper-button-next',
              prevEl: '.swiper-button-prev'
            },
            pagination: {
              el: '.swiper-pagination',
              clickable: true
            },
        });
    } else {
        console.warn("Biblioteca Swiper não foi carregada.");
    }
}