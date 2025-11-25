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
        
        // DOM Elements
        const registerForm = document.getElementById('registerForm');
        const loginForm = document.getElementById('loginForm');

        // Mobile detection and optimizations
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        if (isMobile) {
            document.body.classList.add('mobile-device');
            // Prevent double-tap zoom on iOS
            let lastTouchEnd = 0;
            document.addEventListener('touchend', (e) => {
                const now = Date.now();
                if (now - lastTouchEnd <= 300) {
                    e.preventDefault();
                }
                lastTouchEnd = now;
            }, false);
        }

        if (isIOS) {
            document.body.classList.add('ios-device');
            // Fix iOS viewport height issue
            const setVH = () => {
                const vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', `${vh}px`);
            };
            setVH();
            window.addEventListener('resize', setVH);
            window.addEventListener('orientationchange', setVH);
        }

        // Fade in page on load
        document.body.style.opacity = '0';
        setTimeout(() => {
            document.body.style.transition = 'opacity 0.8s ease';
            document.body.style.opacity = '1';
        }, 100);

        // Smooth navigation for home button with enhanced animation
        const homeButton = document.getElementById('homeButton');
        if (homeButton) {
            homeButton.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Add exit animation class
                document.body.classList.add('page-exit');
                
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 600);
            });
        }

        // Check for mode parameter from landing page
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        
        if (mode === 'signup') {
            // Set hash to trigger Sign Up page
            setTimeout(() => {
                window.location.hash = '#t2';
            }, 300);
        } else if (!window.location.hash || window.location.hash === '') {
            // Default to Sign In
            window.location.hash = '#t1';
        }

        // Initialize the page
        initializePage();

        function initializePage() {
            // Load dropdown data
            loadRoomsAndSections();
            // Setup event listeners
            setupEventListeners();
            // Add loading animation
            addLoadingAnimation();
        }

        function setupEventListeners() {
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

            // Add touch feedback for mobile
            if (isMobile) {
                document.querySelectorAll('.auth-button, .ghost-button, .home-button, .toggle-password').forEach(element => {
                    element.addEventListener('touchstart', function() {
                        this.style.transform = 'scale(0.95)';
                    }, { passive: true });
                    
                    element.addEventListener('touchend', function() {
                        setTimeout(() => {
                            this.style.transform = '';
                        }, 100);
                    }, { passive: true });
                });
            }
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

            // Add mobile-specific input improvements
            if (isMobile) {
                const inputs = document.querySelectorAll('input, select');
                inputs.forEach(input => {
                    // Prevent zoom on focus for iOS
                    input.addEventListener('focus', function() {
                        this.style.fontSize = '16px';
                    });
                    
                    // Add visual feedback on touch
                    input.addEventListener('touchstart', function() {
                        this.style.borderColor = 'var(--ctu-soft-gold)';
                    }, { passive: true });
                    
                    input.addEventListener('touchend', function() {
                        setTimeout(() => {
                            if (document.activeElement !== this) {
                                this.style.borderColor = '';
                            }
                        }, 200);
                    }, { passive: true });
                });
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
                showNotification('Failed to load form data. Please refresh the page.', 'error');
            }
        }

        // Enhanced notification system
        function showNotification(message, type = "success") {
            // Remove existing notification
            const existingNotif = document.querySelector('.messenger-notif');
            if (existingNotif) {
                existingNotif.remove();
            }

            // Create new notification
            const notif = document.createElement("div");
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

            document.body.appendChild(notif);

            // Trigger animation
            setTimeout(() => {
                notif.classList.add('show');
            }, 10);

            // Add click to dismiss
            notif.addEventListener('click', () => {
                dismissNotification(notif);
            });

            // Auto-dismiss after 4 seconds
            setTimeout(() => {
                dismissNotification(notif);
            }, 4000);
        }

        function dismissNotification(notif) {
            if (notif && notif.parentNode) {
                notif.classList.remove('show');
                setTimeout(() => {
                    if (notif.parentNode) {
                        notif.parentNode.removeChild(notif);
                    }
                }, 400);
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
                        window.location.hash = '#t1';
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