// Centralized error handling
export const handleApiError = (error) => {
  console.error('API Error:', error);
  // Show user-friendly error message
  showNotification(error.message || 'An error occurred', 'error');
};