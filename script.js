// script.js (Versão Final com Carrossel Corrigido)

// Lista de imagens do carrossel
const carouselImages = [
    'https://down-bs-br.img.susercontent.com/br-11134210-7r98o-mbkd16ucq6bce5.webp',
    'https://down-bs-br.img.susercontent.com/br-11134210-7r98o-mbkd16ucaq5e1a.webp',
    'https://down-bs-br.img.susercontent.com/br-11134210-7r98o-mbkd16ucaq2g28.webp',
];

// Executa as funções quando o DOM da página estiver pronto
document.addEventListener('DOMContentLoaded', function () {
    displayCarousel();
    setupSearch();
});

// Função para criar e inicializar o carrossel
// Dentro do arquivo script.js

function displayCarousel() {
    const carouselWrapper = document.getElementById('carousel-wrapper');
    if (!carouselWrapper) return;

    carouselWrapper.innerHTML = '';

    carouselImages.forEach(imageUrl => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = `<img src="${imageUrl}" alt="Imagem do Carrossel" onclick="window.openLightbox('${imageUrl}')">`;
        carouselWrapper.appendChild(slide);
    });

    if (typeof Swiper !== "undefined") {
        
        // A MUDANÇA É AQUI: de ".mySwiper" para ".swiper"
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

