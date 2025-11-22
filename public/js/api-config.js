
// Centralized API configuration

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://chronix-web-scheduling.onrender.com' 
  : 'http://localhost:3001';

export default API_BASE_URL;