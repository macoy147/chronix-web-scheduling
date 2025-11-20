document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.ctu-header');

    // Example: Add a class to the header when scrolling
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) { 
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // If you want a scrolled header effect, add this to your CSS:
    /*
    .ctu-header.scrolled {
        padding: 10px 0;
        background: linear-gradient(90deg, var(--ctu-dark-blue) 0%, rgba(193, 155, 38, 0.9) 100%); // Slightly transparent gradient
    }
    */

    // Example: Simple console log for button click
    const ctaButton = document.querySelector('.cta-button');
    if (ctaButton) {
        ctaButton.addEventListener('click', () => {
            console.log('Get Started button clicked!');
            // You could navigate to another page here, e.g., window.location.href = 'dashboard.html';
        });
    }

    // Example: Dynamic copyright year in the footer (if you have one)
    const currentYear = new Date().getFullYear();
    const footer = document.querySelector('.ctu-footer .container');
    if (footer) {
        footer.innerHTML = `&copy; ${currentYear} CHRONIX. BSIT 3A - GROUP 4 | Marco Montellano | Rheina Ompoy | Raniza
        Pepito | Kenneth Brian Tangkay`;
    }
});

