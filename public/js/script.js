import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';

// Smooth navigation function
window.smoothNavigate = function(url) {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        window.location.href = url;
    }, 500);
};

document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.ctu-header');
    const ctaButton = document.querySelector('.cta-button');
    
    // Fade in page on load
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.8s ease';
        document.body.style.opacity = '1';
    }, 100);
    
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
        });
    }

    // Add smooth transition to navigation links
    document.querySelectorAll('.smooth-transition').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            smoothNavigate(href);
        });
    });

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
        const target = parseInt(stat.getAttribute('data-target'));
        let current = 0;
        const increment = target / 50;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                stat.innerText = target;
                clearInterval(timer);
            } else {
                stat.innerText = Math.floor(current);
            }
        }, 30);
    });
}