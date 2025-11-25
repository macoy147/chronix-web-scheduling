import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';

document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.ctu-header');
    const ctaButton = document.querySelector('.cta-button');
    
    // Header scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) { 
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // CTA button with ripple effect
    if (ctaButton) {
        ctaButton.addEventListener('click', (e) => {
            console.log('Get Started button clicked!');
            createRipple(e, ctaButton);
            // Navigation is handled by onclick attribute in HTML
        });
    }

    // Animate stats on scroll
    const statsSection = document.querySelector('.stats-section');
    if (statsSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateStats();
                    observer.unobserve(entry.target);
                }
            });
        });
        observer.observe(statsSection);
    }

    // Testimonial carousel
    const testimonialCards = document.querySelectorAll('.testimonial-card');
    if (testimonialCards.length > 0) {
        // Show first testimonial initially
        testimonialCards.forEach((card, index) => {
            card.style.display = index === 0 ? 'block' : 'none';
        });

        // Change testimonial every 5 seconds
        setInterval(() => {
            const visibleCard = document.querySelector('.testimonial-card[style*="block"]');
            const currentIndex = Array.from(testimonialCards).indexOf(visibleCard);
            const nextIndex = (currentIndex + 1) % testimonialCards.length;
            
            visibleCard.style.display = 'none';
            testimonialCards[nextIndex].style.display = 'block';
        }, 5000);
    }

    // Update copyright year
    const currentYear = new Date().getFullYear();
    const footer = document.querySelector('.ctu-footer .container');
    if (footer) {
        footer.innerHTML = `&copy; ${currentYear} CHRONIX. BSIT 3A - GROUP 4 | Marco Montellano | Rheina Ompoy | Raniza Pepito | Kenneth Brian Tangkay`;
    }
});

// Create ripple effect for buttons
function createRipple(event, button) {
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');
    
    button.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// Animate statistics numbers
function animateStats() {
    const statNumbers = document.querySelectorAll('.stat-number');
    
    statNumbers.forEach(stat => {
        const text = stat.innerText;
        const target = parseInt(text.replace(/\D/g, ''));
        const suffix = text.replace(/\d+/g, '');
        let current = 0;
        const increment = target / 50;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                stat.innerText = text;
                clearInterval(timer);
            } else {
                stat.innerText = Math.floor(current) + suffix;
            }
        }, 30);
    });
}
