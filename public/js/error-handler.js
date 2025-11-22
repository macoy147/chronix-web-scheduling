// public/js/error-handler.js
export const handleApiError = (error) => {
  console.error('API Error:', error);
  
  let message = 'An unexpected error occurred.';
  if (error.message) {
    message = error.message;
  }

  // Create and show a notification bubble
  const notification = document.createElement('div');
  notification.className = 'notification error'; // Use your existing CSS class
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed; 
    top: 80px; 
    right: 20px; 
    z-index: 10000; 
    background: #D8000C; 
    color: white; 
    padding: 12px 20px; 
    border-radius: 8px;
  `;

  document.body.appendChild(notification);

  // Remove after 4 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 4000);
};