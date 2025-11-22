import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';

// Centralized error handling
export const handleApiError = (error) => {
  console.error('API Error:', error);
  // Show user-friendly error message
  showNotification(error.message || 'An error occurred', 'error');
};