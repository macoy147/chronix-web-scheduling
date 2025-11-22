document.addEventListener('DOMContentLoaded', () => {
    const signUpButton = document.getElementById('signUp');
    const signInButton = document.getElementById('signIn');
    const mobileSignUpButton = document.getElementById('signUpMobile');
    const mobileSignInButton = document.getElementById('signInMobile');
    const container = document.getElementById('authContainer');

    // Function to set the container class for sliding
    function toggleSlide(isSignUp) {
        if (isSignUp) {
            container.classList.add('right-panel-active');
            // Load dropdown data when sign up form becomes active
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
            // Load rooms - CHANGED from http://localhost:3001/rooms
            const roomsResponse = await fetch('/rooms');
            if (roomsResponse.ok) {
                const rooms = await roomsResponse.json();
                const roomSelect = document.getElementById('roomSelect');
                roomSelect.innerHTML = '<option value="" selected>Select Room</option>';
                
                rooms.forEach(room => {
                    const option = document.createElement('option');
                    option.value = room.roomName;
                    option.textContent = `${room.roomName} (${room.building})`;
                    roomSelect.appendChild(option);
                });
            }

            // Load sections - CHANGED from http://localhost:3001/sections
            const sectionsResponse = await fetch('/sections');
            if (sectionsResponse.ok) {
                const sections = await sectionsResponse.json();
                const sectionSelect = document.getElementById('sectionSelect');
                sectionSelect.innerHTML = '<option value="" selected>Select Section</option>';
                
                sections.forEach(section => {
                    const option = document.createElement('option');
                    option.value = section.sectionName;
                    option.textContent = `${section.sectionName} (Year ${section.yearLevel})`;
                    sectionSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading dropdown data:', error);
            // Fallback: keep the dropdowns with just the default option
        }
    }

    // Load dropdown data when page loads (for when sign up is default)
    loadRoomsAndSections();

    // Desktop/Tablet Buttons
    signUpButton.addEventListener('click', () => toggleSlide(true));
    signInButton.addEventListener('click', () => toggleSlide(false));
    mobileSignUpButton.addEventListener('click', (e) => {
        e.preventDefault(); 
        toggleSlide(true);
    });
    mobileSignInButton.addEventListener('click', (e) => {
        e.preventDefault(); 
        toggleSlide(false);
    });

    // On page load, check for ?mode=signup or ?mode=signin
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
            const targetId = eye.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    eye.innerHTML = '<i class="fas fa-eye-slash"></i>';
                } else {
                    input.type = 'password';
                    eye.innerHTML = '<i class="fas fa-eye"></i>';
                }
            }
        });
    });

    // Show custom notification
    function showNotification(message, type = "success") {
        let notif = document.getElementById("customNotif");
        if (!notif) {
            notif = document.createElement("div");
            notif.id = "customNotif";
            notif.className = "custom-notif";
            document.body.appendChild(notif);
        }
        notif.textContent = message;
        notif.classList.remove("success", "error");
        notif.classList.add(type);
        notif.style.display = "block";
        setTimeout(() => { notif.style.display = "none"; }, 3000);
    }

    // Fallback session store if AuthGuard is not available
    function fallbackStoreUserSession(userData) {
        try {
            console.log('Using fallback session storage for user', userData.email);
            sessionStorage.setItem('currentUser', JSON.stringify(userData));
            sessionStorage.setItem('isAuthenticated', 'true');
            sessionStorage.setItem('userRole', userData.userrole);
            sessionStorage.setItem('userId', userData._id);
        } catch (err) {
            console.error('Fallback session storage failed', err);
        }
    }

    // Registration with password match check and new fields
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const password = form.password.value;
        const confirmPassword = form.confirmpassword.value;

        if (password !== confirmPassword) {
            showNotification("Passwords do not match. Please re-enter.", "error");
            return;
        }

        // Basic validation for required fields
        if (!form.fullname.value || !form.email.value || !form.userrole.value || !form.ctuid.value || !form.birthdate.value || !form.gender.value) {
            showNotification("Please fill in all required fields.", "error");
            return;
        }

        // Collect all fields including new room and section
        const data = {
            fullname: form.fullname.value,
            email: form.email.value,
            userrole: form.userrole.value,
            ctuid: form.ctuid.value,
            password: password,
            birthdate: form.birthdate.value,
            gender: form.gender.value,
            section: form.section.value || '', // Optional field
            room: form.room.value || '' // Optional field
        };

        try {
            // CHANGED from http://localhost:3001/register
            const res = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await res.json();
            
            if (res.ok) {
                showNotification('Registered! You can now log in.', "success");
                form.reset();
                document.getElementById('signupPassword').type = 'password';
                document.querySelector('[data-target="signupPassword"]').innerHTML = '<i class="fas fa-eye"></i>';
                document.getElementById('signupConfirmPassword').type = 'password';
                document.querySelector('[data-target="signupConfirmPassword"]').innerHTML = '<i class="fas fa-eye"></i>';
                toggleSlide(false);
            } else {
                // Enhanced error handling for duplicate IDs
                if (result.error && result.error.includes('ID already exists')) {
                    showNotification("This Student/Faculty ID is already registered. Please use a different ID.", "error");
                    // Highlight the CTU ID field
                    const ctuidInput = form.querySelector('input[name="ctuid"]');
                    ctuidInput.style.border = '2px solid #D8000C';
                    ctuidInput.focus();
                    setTimeout(() => {
                        ctuidInput.style.border = '';
                    }, 3000);
                } else if (result.error && result.error.includes('email already exists')) {
                    showNotification("This email is already registered. Please use a different email.", "error");
                    // Highlight the email field
                    const emailInput = form.querySelector('input[type="email"]');
                    emailInput.style.border = '2px solid #D8000C';
                    emailInput.focus();
                    setTimeout(() => {
                        emailInput.style.border = '';
                    }, 3000);
                } else {
                    showNotification(result.error || "Registration failed.", "error");
                }
            }
        } catch (error) {
            console.error('Registration error:', error);
            showNotification("Registration failed. Please try again.", "error");
        }
    });

    // Login with role-based redirect based on database user role
    // Login with comprehensive error handling
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const emailInput = form.querySelector('input[type="email"]');
        const passwordInput = form.querySelector('input[type="password"]');
        
        const email = emailInput.value;
        const password = passwordInput.value;

        console.log('🔄 Login form submitted:', { email, password: password ? '***' : 'missing' });

        // Basic validation
        if (!email || !password) {
            showNotification("Please enter both email and password.", "error");
            return;
        }

        const data = { email, password };

        try {
            console.log('📤 Sending login request to server...');
            
            // CHANGED from http://localhost:3001/login
            const res = await fetch('/login', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            console.log('📥 Server response status:', res.status);
            
            let result;
            try {
                result = await res.json();
                console.log('📥 Server response data:', result);
            } catch (parseError) {
                console.error('❌ Failed to parse server response:', parseError);
                showNotification("Server response error. Please try again.", "error");
                return;
            }

            if (res.ok) {
                console.log('✅ Login successful, storing session...');
                
                // Prefer using AuthGuard if available, otherwise fallback
                if (window.AuthGuard && typeof AuthGuard.storeUserSession === 'function') {
                    try {
                        AuthGuard.storeUserSession(result.user);
                    } catch (storeError) {
                        console.error('Error when calling AuthGuard.storeUserSession:', storeError);
                        fallbackStoreUserSession(result.user);
                    }
                } else {
                    console.warn('AuthGuard not available; using fallback session storage');
                    fallbackStoreUserSession(result.user);
                }

                showNotification('Welcome, ' + result.user.fullname, "success");
                
                form.reset();
                document.getElementById('loginPassword').type = 'password';
                document.querySelector('[data-target="loginPassword"]').innerHTML = '<i class="fas fa-eye"></i>';
                
                // Role-based redirect
                setTimeout(() => {
                    console.log('🔄 Redirecting to:', result.user.userrole + ' dashboard');
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
                console.log('❌ Login failed:', result.error);
                showNotification(result.error || "Login failed. Please check your credentials.", "error");
            }
            
        } catch (error) {
            console.error('💥 Network error during login:', error);
            
            // Test if server is reachable - CHANGED from http://localhost:3001/test
            try {
                const testRes = await fetch('/test');
                if (testRes.ok) {
                    showNotification("Login failed. Please check your credentials.", "error");
                } else {
                    showNotification("Cannot connect to server. Please check if the server is running.", "error");
                }
            } catch (testError) {
                showNotification("Cannot connect to server. Please check if the backend is deployed.", "error");
            }
        }
    });

    // Real-time CTU ID validation (optional enhancement)
    const ctuidInput = document.querySelector('input[name="ctuid"]');
    if (ctuidInput) {
        ctuidInput.addEventListener('blur', async function() {
            const ctuid = this.value.trim();
            if (ctuid.length > 0) {
                try {
                    // You could add an API endpoint to check ID availability in real-time
                    // For now, we'll rely on the form submission validation
                    console.log('CTU ID entered:', ctuid);
                } catch (error) {
                    console.log('Real-time ID check not implemented');
                }
            }
        });
    }
});