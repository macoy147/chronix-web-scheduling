// dashboard-utils.js - Utility functions for dashboard
// Improvement #8: Better code organization - Separated utilities

/**
 * Secure data sanitization to prevent XSS attacks
 * Improvement #5: Security - Input sanitization
 */
export function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Sanitize chart filter values
 * Improvement #5: Security - Whitelist validation
 */
export function sanitizeChartFilter(type, value) {
    const allowedValues = {
        studentDistributionType: ['section', 'year', 'program'],
        roomChartType: ['status', 'building', 'type'],
        scheduleDensityType: ['day', 'type']
    };
    
    return allowedValues[type]?.includes(value) ? value : allowedValues[type][0];
}

/**
 * Generate CTU color palette
 */
export function generateCTUColors(count, opacity = 1) {
    const ctuColors = [
        '#3E8EDE', '#4BB543', '#FF6835', '#8B5CF6', '#06D6A0',
        '#F2D283', '#002D62', '#A3000C', '#6366F1', '#84CC16'
    ];
    
    return ctuColors.slice(0, count).map(color => {
        if (opacity < 1) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }
        return color;
    });
}

/**
 * Format time ago with proper handling
 * Improvement #7: Better data handling
 */
export function formatTimeAgo(dateString) {
    if (!dateString) return 'Unknown time';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';
        
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffSecs < 60) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Unknown time';
    }
}

/**
 * Debounce function to prevent excessive calls
 * Improvement #2: Performance optimization
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function for scroll/resize events
 * Improvement #2: Performance optimization
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Create ripple effect on button click
 */
export function createRipple(event, element) {
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    
    element.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

/**
 * Analytics tracking wrapper
 */
export function trackUserInteraction(action, category, label) {
    console.log(`User Interaction: ${action} - ${category} - ${label}`);
    
    // Google Analytics integration if available
    if (typeof gtag !== 'undefined') {
        gtag('event', action, {
            event_category: category,
            event_label: label
        });
    }
}

/**
 * Feature detection for progressive enhancement
 * Improvement #10: Browser compatibility
 */
export function detectFeatures() {
    return {
        intersectionObserver: 'IntersectionObserver' in window,
        localStorage: (() => {
            try {
                const test = '__test__';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch (e) {
                return false;
            }
        })(),
        serviceWorker: 'serviceWorker' in navigator,
        fetch: 'fetch' in window,
        chartJS: typeof Chart !== 'undefined'
    };
}
