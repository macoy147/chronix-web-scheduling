// public/js/auth.js - UPDATED VERSION
import API_BASE_URL from './api-config.js';

// Simple session storage helper
const AuthHelper = {
    storeUserSession(userData) {
        try {
            console.log('Storing user session:', userData);
            sessionStorage.setItem('currentUser', JSON.stringify(userData));
            sessionStorage.setItem('isAuthenticated', 'true');
            sessionStorage.setItem('userRole', userData.userrole);
            sessionStorage.setItem('userId', userData._id);
            return true;
        } catch (err) {
            console.error('Session storage failed:', err);
            return false;
        }
    },
    
    logout() {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('userId');
        window.location.href = 'auth.html?mode=signin';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('Auth script loaded successfully');
    
    const signUpButton = document.getElementById('signUp');
    const signInButton = document.getElementById('signIn');
    const mobileSignUpButton = document.getElementById('signUpMobile');
    const mobileSignInButton = document.getElementById('signInMobile');
    const container = document.getElementById('authContainer');

    // Function to set the container class for sliding
    function toggleSlide(isSignUp) {
        if (isSignUp) {
            container.classList.add('right-panel-active');
            setTimeout(() => {
                loadRoomsAndSections();
            }, 500);
        } else {
            container.classList.remove('right-panel-active');
        }
    }

    // Load rooms and sections from server
    async function loadRoomsAndSections() {
        try {
            console.log('Loading rooms and sections...');
            
            // Load rooms
            const roomsResponse = await fetch('/rooms');
            if (roomsResponse.ok) {
                const rooms = await roomsResponse.json();
                const roomSelect = document.getElementById('roomSelect');
                if (roomSelect) {
                    roomSelect.innerHTML = '<option value="" selected>Select Room</option>';
                    rooms.forEach(room => {
                        const option = document.createElement('option');
                        option.value = room.roomName;
                        option.textContent = `${room.roomName} (${room.building})`;
                        roomSelect.appendChild(option);
                    });
                }
            } else {
                console.warn('Failed to load rooms:', roomsResponse.status);
            }

            // Load sections
            const sectionsResponse = await fetch('/sections');
            if (sectionsResponse.ok) {
                const sections = await sectionsResponse.json();
                const sectionSelect = document.getElementById('sectionSelect');
                if (sectionSelect) {
                    sectionSelect.innerHTML = '<option value="" selected>Select Section</option>';
                    sections.forEach(section => {
                        const option = document.createElement('option');
                        option.value = section.sectionName;
                        option.textContent = `${section.sectionName} (Year ${section.yearLevel})`;
                        sectionSelect.appendChild(option);
                    });
                }
            } else {
                console.warn('Failed to load sections:', sectionsResponse.status);
            }
        } catch (error) {
            console.error('Error loading dropdown data:', error);
        }
    }

    // Load dropdown data when page loads
    loadRoomsAndSections();

    // Event listeners for form toggling
    if (signUpButton) signUpButton.addEventListener('click', () => toggleSlide(true));
    if (signInButton) signInButton.addEventListener('click', () => toggleSlide(false));
    if (mobileSignUpButton) mobileSignUpButton.addEventListener('click', (e) => {
        e.preventDefault(); 
        toggleSlide(true);
    });
    if (mobileSignInButton) mobileSignInButton.addEventListener('click', (e) => {
        e.preventDefault(); 
        toggleSlide(false);
    });

    // Handle URL parameters for mode
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'signup') {
        toggleSlide(true);
    } else if (mode === 'signin') {
        toggleSlide(false);
    }

    // Password visibility toggle
    document.querySelectorAll('.toggle-password').forEach(function (eye) {
        eye.addEventListener('click', function () {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    this.innerHTML = '<i class="fas fa-eye-slash"></i>';
                } else {
                    input.type = 'password';
                    this.innerHTML = '<i class="fas fa-eye"></i>';
                }
            }
        });
    });

    // Notification system
    function showNotification(message, type = "success") {
        // Remove existing notification
        const existingNotif = document.getElementById("customNotif");
        if (existingNotif) {
            existingNotif.remove();
        }

        // Create new notification
        const notif = document.createElement("div");
        notif.id = "customNotif";
        notif.className = `custom-notif ${type}`;
        notif.textContent = message;
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            z-index: 10000;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: block;
            font-family: 'Inter', sans-serif;
        `;
        
        if (type === "success") {
            notif.style.backgroundColor = "#4BB543";
        } else {
            notif.style.backgroundColor = "#D8000C";
        }

        document.body.appendChild(notif);

        // Remove after 3 seconds
        setTimeout(() => {
            if (notif.parentNode) {
                notif.parentNode.removeChild(notif);
            }
        }, 3000);
    }

    // Registration form handler
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const password = form.password.value;
            const confirmPassword = form.confirmpassword.value;

            if (password !== confirmPassword) {
                showNotification("Passwords do not match. Please re-enter.", "error");
                return;
            }

            // Basic validation
            if (!form.fullname.value || !form.email.value || !form.userrole.value || !form.ctuid.value || !form.birthdate.value || !form.gender.value) {
                showNotification("Please fill in all required fields.", "error");
                return;
            }

            const data = {
                fullname: form.fullname.value,
                email: form.email.value,
                userrole: form.userrole.value,
                ctuid: form.ctuid.value,
                password: password,
                birthdate: form.birthdate.value,
                gender: form.gender.value,
                section: form.section.value || '',
                room: form.room.value || ''
            };

            try {
                console.log('Registering user:', data);
                const res = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await res.json();
                
                if (res.ok) {
                    showNotification('Registered! You can now log in.', "success");
                    form.reset();
                    // Reset password visibility
                    document.getElementById('signupPassword').type = 'password';
                    document.querySelector('[data-target="signupPassword"]').innerHTML = '<i class="fas fa-eye"></i>';
                    document.getElementById('signupConfirmPassword').type = 'password';
                    document.querySelector('[data-target="signupConfirmPassword"]').innerHTML = '<i class="fas fa-eye"></i>';
                    toggleSlide(false);
                } else {
                    if (result.error && result.error.includes('ID already exists')) {
                        showNotification("This Student/Faculty ID is already registered. Please use a different ID.", "error");
                    } else if (result.error && result.error.includes('email already exists')) {
                        showNotification("This email is already registered. Please use a different email.", "error");
                    } else {
                        showNotification(result.error || "Registration failed.", "error");
                    }
                }
            } catch (error) {
                console.error('Registration error:', error);
                showNotification("Registration failed. Please try again.", "error");
            }
        });
    }

    // Login form handler
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const email = form.querySelector('input[type="email"]').value;
            const password = form.querySelector('input[type="password"]').value;

            console.log('Login attempt:', { email });

            // Basic validation
            if (!email || !password) {
                showNotification("Please enter both email and password.", "error");
                return;
            }

            try {
                console.log('Sending login request...');
                const res = await fetch('/login', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                
                console.log('Login response status:', res.status);
                const result = await res.json();
                
                if (res.ok) {
                    console.log('Login successful:', result.user);
                    
                    // Store user session
                    if (AuthHelper.storeUserSession(result.user)) {
                        showNotification('Welcome, ' + result.user.fullname, "success");
                        
                        form.reset();
                        document.getElementById('loginPassword').type = 'password';
                        document.querySelector('[data-target="loginPassword"]').innerHTML = '<i class="fas fa-eye"></i>';
                        
                        // Redirect based on role
                        setTimeout(() => {
                            switch(result.user.userrole) {
                                case 'admin':
                                    window.location.href = "admin-dashboard.html";
                                    break;
                                case 'teacher':
                                    window.location.href = "teacher-dashboard.html";
                                    break;
                                case 'student':
                                    window.location.href = "student-dashboard.html";
                                    break;
                                default:
                                    window.location.href = "index.html";
                            }
                        }, 1000);
                    } else {
                        showNotification("Login successful but session storage failed.", "error");
                    }
                    
                } else {
                    console.log('Login failed:', result.error);
                    showNotification(result.error || "Login failed. Please check your credentials.", "error");
                }
                
            } catch (error) {
                console.error('Network error during login:', error);
                showNotification("Cannot connect to server. Please try again later.", "error");
            }
        });
    }

    // Check if user is already logged in
    const isAuthenticated = sessionStorage.getItem('isAuthenticated');
    const userRole = sessionStorage.getItem('userRole');
    
    if (isAuthenticated === 'true' && userRole) {
        console.log('User already authenticated, redirecting...');
        switch(userRole) {
            case 'admin':
                window.location.href = "admin-dashboard.html";
                break;
            case 'teacher':
                window.location.href = "teacher-dashboard.html";
                break;
            case 'student':
                window.location.href = "student-dashboard.html";
                break;
        }
    }
});

// Make AuthHelper available globally for other scripts
window.AuthHelper = AuthHelper;