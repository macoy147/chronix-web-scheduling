// error-handler.js
class ErrorHandler {
    static handleApiError(error, userMessage = 'An unexpected error occurred') {
        console.error('API Error:', error);
        
        // Network errors
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            return 'Network error: Cannot connect to server. Please check your internet connection and try again.';
        }
        
        // Timeout errors
        if (error.name === 'AbortError') {
            return 'Request timeout: The server took too long to respond. Please try again.';
        }
        
        // Server errors (5xx)
        if (error.status >= 500) {
            return 'Server error: Please try again later or contact support if the problem persists.';
        }
        
        // Client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
            switch (error.status) {
                case 400:
                    return 'Bad request: Please check your input and try again.';
                case 401:
                    return 'Unauthorized: Please log in again.';
                case 403:
                    return 'Forbidden: You do not have permission to perform this action.';
                case 404:
                    return 'Resource not found.';
                default:
                    return userMessage;
            }
        }
        
        // Return the user-friendly message for other cases
        return userMessage;
    }
    
    static showErrorNotification(message, type = 'error') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.error-notification');
        existingNotifications.forEach(notif => notif.remove());
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `error-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">
                    ${type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#f8d7da' : type === 'warning' ? '#fff3cd' : '#d1ecf1'};
            color: ${type === 'error' ? '#721c24' : type === 'warning' ? '#856404' : '#0c5460'};
            border: 1px solid ${type === 'error' ? '#f5c6cb' : type === 'warning' ? '#ffeaa7' : '#bee5eb'};
            border-radius: 8px;
            padding: 16px;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            animation: slideIn 0.3s ease-out;
        `;
        
        // Add close button styles
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            margin-left: 10px;
            color: inherit;
        `;
        
        // Add content styles
        const content = notification.querySelector('.notification-content');
        content.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        return notification;
    }
    
    static handleFormError(formElement, fieldErrors) {
        // Clear previous errors
        this.clearFormErrors(formElement);
        
        // Add errors to specific fields
        Object.keys(fieldErrors).forEach(fieldName => {
            const field = formElement.querySelector(`[name="${fieldName}"]`);
            if (field) {
                const errorElement = document.createElement('div');
                errorElement.className = 'field-error';
                errorElement.textContent = fieldErrors[fieldName];
                errorElement.style.cssText = `
                    color: #D8000C;
                    font-size: 12px;
                    margin-top: 4px;
                    font-weight: 500;
                `;
                
                field.style.borderColor = '#D8000C';
                field.parentNode.appendChild(errorElement);
            }
        });
    }
    
    static clearFormErrors(formElement) {
        // Remove existing error messages
        const existingErrors = formElement.querySelectorAll('.field-error');
        existingErrors.forEach(error => error.remove());
        
        // Reset field borders
        const fields = formElement.querySelectorAll('input, select, textarea');
        fields.forEach(field => {
            field.style.borderColor = '';
        });
    }
    
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    static validatePassword(password) {
        if (password.length < 6) {
            return 'Password must be at least 6 characters long';
        }
        return null;
    }
    
    static validateRequired(fieldValue, fieldName) {
        if (!fieldValue || fieldValue.trim() === '') {
            return `${fieldName} is required`;
        }
        return null;
    }
    
    // Global error handler for uncaught errors
    static setupGlobalErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.showErrorNotification('An unexpected error occurred. Please refresh the page.');
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showErrorNotification('An unexpected error occurred. Please try again.');
        });
    }
}

// Export individual functions for backward compatibility
export function handleApiError(error, userMessage = 'An unexpected error occurred') {
    return ErrorHandler.handleApiError(error, userMessage);
}

export function showErrorNotification(message, type = 'error') {
    return ErrorHandler.showErrorNotification(message, type);
}

export function handleFormError(formElement, fieldErrors) {
    return ErrorHandler.handleFormError(formElement, fieldErrors);
}

export function clearFormErrors(formElement) {
    return ErrorHandler.clearFormErrors(formElement);
}

export function validateEmail(email) {
    return ErrorHandler.validateEmail(email);
}

export function validatePassword(password) {
    return ErrorHandler.validatePassword(password);
}

export function validateRequired(fieldValue, fieldName) {
    return ErrorHandler.validateRequired(fieldValue, fieldName);
}

export function setupGlobalErrorHandling() {
    return ErrorHandler.setupGlobalErrorHandling();
}

export default ErrorHandler;