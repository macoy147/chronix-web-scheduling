// dashboard-ui.js - UI components and interactions
// Improvement #1: Error handling with better UI feedback
// Improvement #7: Loading skeletons instead of showing 0

import { sanitizeHTML, createRipple } from './dashboard-utils.js';

/**
 * Show loading skeleton for KPI cards
 * Improvement #7: Better loading states
 */
export function showKPISkeletons() {
    const kpiCards = document.querySelectorAll('.kpi-card');
    kpiCards.forEach(card => {
        card.classList.add('skeleton-loading');
        const valueEl = card.querySelector('.kpi-value');
        if (valueEl) {
            valueEl.innerHTML = '<div class="skeleton-box"></div>';
        }
    });
}

/**
 * Hide loading skeleton
 */
export function hideKPISkeletons() {
    const kpiCards = document.querySelectorAll('.kpi-card');
    kpiCards.forEach(card => {
        card.classList.remove('skeleton-loading');
    });
}

/**
 * Animate counter with easing
 */
export function animateCounter(elementId, targetValue, duration = 1000) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startValue = 0;
    const startTime = performance.now();
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out quart
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOutQuart);
        
        element.textContent = currentValue.toLocaleString();
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }
    
    requestAnimationFrame(updateCounter);
}

/**
 * Update trend indicator with animation
 */
export function updateTrend(elementId, currentValue, previousValue) {
    const trendElement = document.getElementById(elementId);
    if (!trendElement) return;
    
    const difference = currentValue - previousValue;
    
    trendElement.style.opacity = '0';
    setTimeout(() => {
        if (difference > 0) {
            trendElement.innerHTML = `<i class="bi bi-arrow-up" aria-hidden="true"></i> <span>+${difference}</span>`;
            trendElement.className = 'kpi-trend positive';
        } else if (difference < 0) {
            trendElement.innerHTML = `<i class="bi bi-arrow-down" aria-hidden="true"></i> <span>${difference}</span>`;
            trendElement.className = 'kpi-trend negative';
        } else {
            trendElement.innerHTML = `<i class="bi bi-dash" aria-hidden="true"></i> <span>No change</span>`;
            trendElement.className = 'kpi-trend neutral';
        }
        trendElement.style.opacity = '1';
    }, 200);
}

/**
 * Show loading overlay
 */
export function showLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.style.opacity = '1';
        }, 10);
    }
}

/**
 * Hide loading overlay
 */
export function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 300);
    }
}

/**
 * Enhanced notification system
 * Improvement #1: Better user feedback
 */
export function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    // Sanitize message
    const safeMessage = sanitizeHTML(message);
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');
    
    const iconMap = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <i class="bi bi-${iconMap[type] || 'info-circle'}" aria-hidden="true"></i>
            <span>${safeMessage}</span>
        </div>
    `;
    
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // Remove after duration
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

/**
 * Show error with retry option
 * Improvement #1: Error boundaries with retry
 */
export function showErrorWithRetry(message, onRetry) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-boundary';
    errorContainer.innerHTML = `
        <div class="error-boundary-content">
            <i class="bi bi-exclamation-triangle" style="font-size: 3rem; color: #D8000C; margin-bottom: 1rem;"></i>
            <h3>Oops! Something went wrong</h3>
            <p>${sanitizeHTML(message)}</p>
            <div class="error-actions">
                <button class="btn-retry" id="errorRetryBtn">
                    <i class="bi bi-arrow-clockwise"></i> Try Again
                </button>
                <button class="btn-dismiss" id="errorDismissBtn">
                    Dismiss
                </button>
            </div>
        </div>
    `;
    
    // Add to main container
    const mainContainer = document.querySelector('.admin-center-container');
    if (mainContainer) {
        mainContainer.insertBefore(errorContainer, mainContainer.firstChild);
    } else {
        document.body.appendChild(errorContainer);
    }
    
    // Setup event listeners
    const retryBtn = document.getElementById('errorRetryBtn');
    const dismissBtn = document.getElementById('errorDismissBtn');
    
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            errorContainer.remove();
            if (onRetry) onRetry();
        });
    }
    
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            errorContainer.remove();
        });
    }
}

/**
 * Show connection status
 */
export function updateConnectionStatus(isOnline) {
    const connectionStatus = document.getElementById('connectionStatus');
    
    if (connectionStatus) {
        if (isOnline) {
            connectionStatus.textContent = 'Back online';
            connectionStatus.className = 'connection-status online';
            setTimeout(() => {
                connectionStatus.textContent = '';
                connectionStatus.className = 'connection-status';
            }, 3000);
        } else {
            connectionStatus.textContent = 'You are currently offline';
            connectionStatus.className = 'connection-status offline';
        }
    }
}

/**
 * Update last updated timestamp
 */
export function updateLastUpdated(timestamp) {
    const lastUpdatedElement = document.getElementById('lastUpdated');
    if (lastUpdatedElement && timestamp) {
        lastUpdatedElement.style.opacity = '0';
        setTimeout(() => {
            lastUpdatedElement.textContent = `Last updated: ${timestamp.toLocaleTimeString()}`;
            lastUpdatedElement.style.opacity = '1';
        }, 200);
    }
}

/**
 * Animate chart transition
 */
export function animateChartTransition(chartId) {
    const chartContainer = document.getElementById(chartId)?.closest('.chart-container');
    if (chartContainer) {
        chartContainer.style.opacity = '0.5';
        chartContainer.style.transform = 'scale(0.95)';
        setTimeout(() => {
            chartContainer.style.transition = 'all 0.3s ease';
            chartContainer.style.opacity = '1';
            chartContainer.style.transform = 'scale(1)';
        }, 50);
    }
}

/**
 * Setup profile dropdown
 */
export function setupProfileDropdown() {
    const profileDropdown = document.querySelector('.admin-profile-dropdown');
    if (!profileDropdown) return;
    
    profileDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        const isOpen = profileDropdown.classList.toggle('open');
        profileDropdown.setAttribute('aria-expanded', isOpen);
        createRipple(e, this);
    });

    // Keyboard navigation
    profileDropdown.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const isOpen = profileDropdown.classList.toggle('open');
            profileDropdown.setAttribute('aria-expanded', isOpen);
        } else if (e.key === 'Escape') {
            profileDropdown.classList.remove('open');
            profileDropdown.setAttribute('aria-expanded', 'false');
        }
    });

    // Close on outside click
    document.addEventListener('click', function() {
        profileDropdown.classList.remove('open');
        profileDropdown.setAttribute('aria-expanded', 'false');
    });
}

/**
 * Setup keyboard shortcuts
 * Improvement #4: Accessibility - Keyboard navigation
 */
export function setupKeyboardShortcuts(callbacks) {
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + R to refresh
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            if (callbacks.refresh) callbacks.refresh();
        }
        
        // Escape to close dropdowns
        if (e.key === 'Escape') {
            document.querySelector('.admin-profile-dropdown')?.classList.remove('open');
        }
        
        // Focus management for accessibility
        if (e.key === 'Tab') {
            document.documentElement.classList.add('keyboard-navigation');
        }
    });

    document.addEventListener('mousedown', function() {
        document.documentElement.classList.remove('keyboard-navigation');
    });
}

/**
 * Initialize tooltips
 * Improvement #4: Accessibility
 */
export function initializeTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
        const showTooltip = function(e) {
            const tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.textContent = this.getAttribute('data-tooltip');
            tooltip.setAttribute('role', 'tooltip');
            document.body.appendChild(tooltip);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
            
            setTimeout(() => tooltip.classList.add('show'), 10);
        };
        
        const hideTooltip = function() {
            const tooltip = document.querySelector('.custom-tooltip');
            if (tooltip) {
                tooltip.classList.remove('show');
                setTimeout(() => tooltip.remove(), 200);
            }
        };
        
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
        element.addEventListener('focus', showTooltip);
        element.addEventListener('blur', hideTooltip);
    });
}

/**
 * Add page entrance animations
 */
export function addPageAnimations() {
    const cards = document.querySelectorAll('.kpi-card, .chart-container, .actions-card, .activity-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
}
