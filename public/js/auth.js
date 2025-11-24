// public/js/auth.js - UPDATED VERSION WITH IMPROVED NOTIFICATIONS

import API_BASE_URL from './api-config.js';

// Simple session storage helper
const AuthHelper = {
    storeUserSession(userData) {
        try {
            console.log('Storing user session:', userData);
            // Ensure all required fields are stored
            const sessionData = {
                _id: userData._id,
                fullname: userData.fullname,
                email: userData.email,
                userrole: userData.userrole,
                ctuid: userData.ctuid,
                profilePicture: userData.profilePicture || '',
                lastLogin: userData.lastLogin,
                birthdate: userData.birthdate || '',
                gender: userData.gender || '',
                section: userData.section || '',
                room: userData.room || ''
            };
            
            sessionStorage.setItem('currentUser', JSON.stringify(sessionData));
            sessionStorage.setItem('isAuthenticated', 'true');
            sessionStorage.setItem('userRole', userData.userrole);
            sessionStorage.setItem('userId', userData._id);
            
            // Verify the data was stored correctly
            const storedData = sessionStorage.getItem('currentUser');
            if (!storedData) {
                console.error('Failed to store user session data');
                return false;
            }
            
            console.log('User session stored successfully:', JSON.parse(storedData));
            
            // Trigger a custom event to notify other components
            window.dispatchEvent(new CustomEvent('userLoggedIn', { 
                detail: sessionData 
            }));
            
            return true;
        } catch (err) {
            console.error('Session storage failed:', err);
            return false;
        }
    },
    
    logout() {
        // Trigger logout event before clearing session
        window.dispatchEvent(new CustomEvent('userLoggedOut'));
        
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('userId');
        
        // Add fade out effect
        document.body.style.opacity = '0';
        setTimeout(() => {
            window.location.href = 'auth.html?mode=signin';
        }, 300);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('Auth script loaded successfully');
    console.log('Current page:', window.location.pathname.split('/').pop());
    console.log('Session storage data:', {
        isAuthenticated: sessionStorage.getItem('isAuthenticated'),
        userRole: sessionStorage.getItem('userRole'),
        userId: sessionStorage.getItem('userId'),
        currentUser: sessionStorage.getItem('currentUser') ? JSON.parse(sessionStorage.getItem('currentUser')) : null
    });
    
    // DOM Elements
    const signUpButton = document.getElementById('signUp');
    const signInButton = document.getElementById('signIn');
    const mobileSignUpButton = document.getElementById('signUpMobile');
    const mobileSignInButton = document.getElementById('signInMobile');
    const container = document.getElementById('authContainer');
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    const debugToggle = document.getElementById('debugToggle');

    // Initialize the page
    initializePage();

    function initializePage() {
        // Set initial panel state based on URL
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        
        if (mode === 'signup') {
            toggleSlide(true);
        } else if (mode === 'signin') {
            toggleSlide(false);
        }

        // Load dropdown data
        loadRoomsAndSections();
        // Setup event listeners
        setupEventListeners();
        // Add loading animation
        addLoadingAnimation();
    }

    function setupEventListeners() {
        // Panel toggle buttons
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

        // Password visibility toggles
        setupPasswordToggles();
        // Form submissions
        setupFormHandlers();
        // User role change handler
        setupUserRoleHandler();
        // Add keyboard navigation
        setupKeyboardNavigation();
    }

    function setupPasswordToggles() {
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
    }

    function setupFormHandlers() {
        // Registration form
        if (registerForm) {
            registerForm.addEventListener('submit', handleRegistration);
        }
        // Login form
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
    }

    function setupUserRoleHandler() {
        const userRoleSelect = document.getElementById('userRoleSelect');
        const roomSelect = document.getElementById('roomSelect');
        const sectionSelect = document.getElementById('sectionSelect');

        if (userRoleSelect) {
            userRoleSelect.addEventListener('change', function() {
                const isTeacher = this.value === 'teacher';
                const isStudent = this.value === 'student';

                // Show/hide room and section based on role
                if (roomSelect) {
                    const roomWrapper = roomSelect.closest('.row-two-fields');
                    if (roomWrapper) {
                        roomWrapper.style.display = isTeacher ? 'flex' : 'none';
                    }
                }

                if (sectionSelect) {
                    const sectionWrapper = sectionSelect.closest('.row-two-fields');
                    if (sectionWrapper) {
                        sectionWrapper.style.display = isStudent ? 'flex' : 'none';
                    }
                }

                // Update placeholders
                const ctuIdInput = registerForm.querySelector('input[name="ctuid"]');
                if (ctuIdInput) {
                    ctuIdInput.placeholder = isTeacher ? 'Faculty ID' : 'Student ID';
                }
            });
        }
    }

    function setupKeyboardNavigation() {
        // Add Enter key navigation between form fields
        const formInputs = document.querySelectorAll('input, select, button');
        formInputs.forEach((input, index) => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && input.type !== 'submit') {
                    e.preventDefault();
                    const nextInput = formInputs[index + 1];
                    if (nextInput) {
                        nextInput.focus();
                    }
                }
            });
        });
    }

    function addLoadingAnimation() {
        // Add subtle loading animation to forms
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.style.opacity = '0';
            form.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                form.style.transition = 'all 0.5s ease';
                form.style.opacity = '1';
                form.style.transform = 'translateY(0)';
            }, 100);
        });
    }

    // Function to set the container class for sliding
    function toggleSlide(isSignUp) {
        if (isSignUp) {
            container.classList.add('right-panel-active');
            // Load rooms and sections when switching to sign up
            setTimeout(() => {
                loadRoomsAndSections();
            }, 500);
        } else {
            container.classList.remove('right-panel-active');
        }

        // Update URL without page reload
        const url = new URL(window.location);
        url.searchParams.set('mode', isSignUp ? 'signup' : 'signin');
        window.history.replaceState({}, '', url);
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
            showNotification('Failed to load form data. Please refresh the page.', 'error');
        }
    }

    // Enhanced Messenger-style notification system
    function showNotification(message, type = "success") {
        // Remove existing notification
        const existingNotif = document.getElementById("customNotif");
        if (existingNotif) {
            existingNotif.remove();
        }

        // Create new notification
        const notif = document.createElement("div");
        notif.id = "customNotif";
        notif.className = `messenger-notif ${type}`;
        
        // Create notification content with icon
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
        notif.innerHTML = `
            <div class="notif-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="notif-content">
                <span class="notif-message">${message}</span>
            </div>
        `;
        
        // Add messenger-style styling
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 320px;
            min-width: 280px;
            padding: 12px 16px;
            border-radius: 18px;
            color: white;
            z-index: 10000;
            font-weight: 500;
            font-size: 14px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 12px;
            font-family: 'Inter', sans-serif;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            transform: translateX(100%) scale(0.8);
            opacity: 0;
            animation: messengerSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        `;
        
        // Set background based on type
        if (type === "success") {
            notif.style.background = 'linear-gradient(135deg, #00C851, #007E33)';
        } else {
            notif.style.background = 'linear-gradient(135deg, #FF4444, #CC0000)';
        }

        // Add messenger-style animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes messengerSlideIn {
                0% {
                    transform: translateX(100%) scale(0.8);
                    opacity: 0;
                }
                60% {
                    transform: translateX(-10px) scale(1.02);
                    opacity: 1;
                }
                100% {
                    transform: translateX(0) scale(1);
                    opacity: 1;
                }
            }
            
            @keyframes messengerSlideOut {
                0% {
                    transform: translateX(0) scale(1);
                    opacity: 1;
                }
                100% {
                    transform: translateX(100%) scale(0.8);
                    opacity: 0;
                }
            }
            
            @keyframes messengerPulse {
                0%, 100% { 
                    transform: scale(1); 
                }
                50% { 
                    transform: scale(1.05); 
                }
            }
            
            .messenger-notif {
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .messenger-notif:hover {
                transform: translateY(-2px) scale(1.02);
                box-shadow: 0 6px 25px rgba(0,0,0,0.2), 0 3px 12px rgba(0,0,0,0.15);
            }
            
            .notif-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.2);
                flex-shrink: 0;
            }
            
            .notif-icon i {
                font-size: 12px;
            }
            
            .notif-content {
                flex: 1;
                min-width: 0;
            }
            
            .notif-message {
                display: block;
                line-height: 1.4;
                word-wrap: break-word;
            }
        `;
        
        if (!document.getElementById('messenger-notif-styles')) {
            style.id = 'messenger-notif-styles';
            document.head.appendChild(style);
        }

        document.body.appendChild(notif);

        // Add click to dismiss
        notif.addEventListener('click', () => {
            dismissNotification(notif);
        });

        // Auto-dismiss after 4 seconds with messenger-style animation
        setTimeout(() => {
            dismissNotification(notif);
        }, 4000);
    }

    function dismissNotification(notif) {
        if (notif && notif.parentNode) {
            notif.style.animation = 'messengerSlideOut 0.3s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards';
            setTimeout(() => {
                if (notif.parentNode) {
                    notif.parentNode.removeChild(notif);
                }
            }, 300);
        }
    }

    // Enhanced registration form handler
    async function handleRegistration(e) {
        e.preventDefault();
        const form = e.target;
        const submitButton = form.querySelector('button[type="submit"]');
        
        // Disable submit button and show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
        
        const password = form.password.value;
        const confirmPassword = form.confirmpassword.value;

        if (password !== confirmPassword) {
            showNotification("Passwords do not match. Please re-enter.", "error");
            resetSubmitButton(submitButton, 'Sign Up');
            return;
        }

        // Enhanced validation
        const requiredFields = ['fullname', 'email', 'userrole', 'ctuid', 'birthdate', 'gender'];
        const missingFields = requiredFields.filter(field => !form[field].value);
        
        if (missingFields.length > 0) {
            showNotification(`Please fill in all required fields: ${missingFields.join(', ')}`, "error");
            resetSubmitButton(submitButton, 'Sign Up');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(form.email.value)) {
            showNotification("Please enter a valid email address.", "error");
            resetSubmitButton(submitButton, 'Sign Up');
            return;
        }

        // Password strength validation
        if (password.length < 6) {
            showNotification("Password must be at least 6 characters long.", "error");
            resetSubmitButton(submitButton, 'Sign Up');
            return;
        }

        const data = {
            fullname: form.fullname.value.trim(),
            email: form.email.value.trim().toLowerCase(),
            userrole: form.userrole.value,
            ctuid: form.ctuid.value.trim(),
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
                showNotification('Registration successful! You can now log in.', "success");
                form.reset();
                // Reset password visibility
                document.getElementById('signupPassword').type = 'password';
                document.querySelector('[data-target="signupPassword"]').innerHTML = '<i class="fas fa-eye"></i>';
                document.getElementById('signupConfirmPassword').type = 'password';
                document.querySelector('[data-target="signupConfirmPassword"]').innerHTML = '<i class="fas fa-eye"></i>';
                
                // Switch to login form after successful registration
                setTimeout(() => {
                    toggleSlide(false);
                }, 1500);
            } else {
                if (result.error && result.error.includes('ID already exists')) {
                    showNotification("This Student/Faculty ID is already registered. Please use a different ID.", "error");
                } else if (result.error && result.error.includes('email already exists')) {
                    showNotification("This email is already registered. Please use a different email.", "error");
                } else {
                    showNotification(result.error || "Registration failed. Please try again.", "error");
                }
            }
        } catch (error) {
            console.error('Registration error:', error);
            showNotification("Registration failed. Please check your connection and try again.", "error");
        } finally {
            resetSubmitButton(submitButton, 'Sign Up');
        }
    }

    // Enhanced login form handler
    async function handleLogin(e) {
        e.preventDefault();
        const form = e.target;
        const submitButton = form.querySelector('button[type="submit"]');
        
        // Disable submit button and show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
        
        const email = form.querySelector('input[type="email"]').value.trim().toLowerCase();
        const password = form.querySelector('input[type="password"]').value;
        console.log('Login attempt:', { email });

        // Basic validation
        if (!email || !password) {
            showNotification("Please enter both email and password.", "error");
            resetSubmitButton(submitButton, 'Sign In');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showNotification("Please enter a valid email address.", "error");
            resetSubmitButton(submitButton, 'Sign In');
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
                
                // Store user session with enhanced function
                if (AuthHelper.storeUserSession(result.user)) {
                    showNotification('Welcome back, ' + result.user.fullname + '!', "success");
                    
                    form.reset();
                    document.getElementById('loginPassword').type = 'password';
                    document.querySelector('[data-target="loginPassword"]').innerHTML = '<i class="fas fa-eye"></i>';
                    
                    // Add success animation
                    container.style.animation = 'successPulse 0.5s ease';
                    
                    // Redirect based on role with a small delay to ensure session is stored
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
                    }, 1500);
                } else {
                    showNotification("Login successful but session storage failed. Please try again.", "error");
                }
                
            } else {
                console.log('Login failed:', result.error);
                showNotification(result.error || "Login failed. Please check your credentials.", "error");
                
                // Add shake animation to form on failed login
                form.style.animation = 'shake 0.5s ease';
                setTimeout(() => {
                    form.style.animation = '';
                }, 500);
            }
            
        } catch (error) {
            console.error('Network error during login:', error);
            showNotification("Cannot connect to server. Please check your connection and try again.", "error");
        } finally {
            resetSubmitButton(submitButton, 'Sign In');
        }
    }

    // Helper function to reset submit button
    function resetSubmitButton(button, originalText) {
        button.disabled = false;
        button.innerHTML = originalText;
    }

    // Check if user is already logged in
    const isAuthenticated = sessionStorage.getItem('isAuthenticated');
    const userRole = sessionStorage.getItem('userRole');
    
    if (isAuthenticated === 'true' && userRole) {
        console.log('User already authenticated, redirecting...');
        // Add fade out effect
        document.body.style.opacity = '0';
        setTimeout(() => {
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
                default:
                    window.location.href = "index.html";
            }
        }, 300);
    }

    // Add custom animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
        }
        @keyframes successPulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
});

// Make AuthHelper available globally for other scripts
window.AuthHelper = AuthHelper;

// Listen for authentication events
window.addEventListener('userLoggedIn', (e) => {
    console.log('User logged in:', e.detail);
});

window.addEventListener('userLoggedOut', () => {
    console.log('User logged out');
});