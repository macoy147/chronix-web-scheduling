class AuthGuard {
    static checkAuthentication(requiredRole = null) {
        const isAuthenticated = sessionStorage.getItem('isAuthenticated');
        const userRole = sessionStorage.getItem('userRole');
        const currentUser = sessionStorage.getItem('currentUser');
        
        console.log('Auth check:', { 
            isAuthenticated, 
            userRole, 
            requiredRole,
            currentUserExists: !!currentUser,
            currentPage: window.location.pathname.split('/').pop()
        });
        
        if (!isAuthenticated || isAuthenticated !== 'true') {
            console.error('Authentication failed: User not authenticated');
            this.redirectToLogin();
            return false;
        }
        
        if (!currentUser) {
            console.error('Authentication failed: No user data in session');
            this.redirectToLogin();
            return false;
        }
        
        if (requiredRole && userRole !== requiredRole) {
            console.error(`Authentication failed: Required role ${requiredRole}, but user has role ${userRole}`);
            this.redirectToLogin('Unauthorized access. You do not have permission to view this page.');
            return false;
        }
        
        console.log('Authentication successful');
        return true;
    }
    
    static redirectToLogin(message = 'Please sign in to access this page') {
        sessionStorage.setItem('loginRedirectMessage', message);
        window.location.href = 'auth.html?mode=signin';
    }
    
    static getCurrentUser() {
        const userData = sessionStorage.getItem('currentUser');
        return userData ? JSON.parse(userData) : null;
    }
    
    static getUserId() {
        const user = this.getCurrentUser();
        return user ? user._id : null;
    }
    
    static logout() {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('userId');
        window.location.href = 'auth.html?mode=signin';
    }
    
    static showLoginMessage() {
        const message = sessionStorage.getItem('loginRedirectMessage');
        if (message) {
            // You can implement a notification system here
            console.log(message);
            sessionStorage.removeItem('loginRedirectMessage');
        }
    }
    
    // Check if user has specific role
    static hasRole(role) {
        const userRole = sessionStorage.getItem('userRole');
        return userRole === role;
    }
    
    // Get user role
    static getUserRole() {
        return sessionStorage.getItem('userRole');
    }
    
    // Store user session with additional data
    static storeUserSession(userData) {
        console.log('Storing user session:', userData); // Debug log
        sessionStorage.setItem('currentUser', JSON.stringify(userData));
        sessionStorage.setItem('isAuthenticated', 'true');
        sessionStorage.setItem('userRole', userData.userrole);
        sessionStorage.setItem('userId', userData._id);
    }
}

// Auto-check authentication on page load for protected pages
document.addEventListener('DOMContentLoaded', function() {
    // Check if current page requires authentication (all pages except auth.html and index.html)
    const currentPage = window.location.pathname.split('/').pop();
    const publicPages = ['index.html', 'auth.html', ''];
    
    console.log('Current page:', currentPage); // Debug log
    
    if (!publicPages.includes(currentPage)) {
        // Define role requirements for each page
        const roleRequirements = {
            'admin-dashboard.html': 'admin',
            'admin-subjects.html': 'admin', 
            'admin-sections.html': 'admin',
            'admin-rooms.html': 'admin',
            'admin-schedules.html': 'admin',
            'admin-students.html': 'admin',
            'admin-teachers.html': 'admin',
            'admin-profile.html': 'admin',
            'teacher-dashboard.html': 'teacher',
            'student-dashboard.html': 'student'  // This was the missing line
        };
        
        const requiredRole = roleRequirements[currentPage] || null;
        console.log('Required role for', currentPage, ':', requiredRole); // Debug log
        AuthGuard.checkAuthentication(requiredRole);
    } else if (currentPage === 'auth.html') {
        // If user is already authenticated and tries to access auth page, redirect to appropriate dashboard
        const isAuthenticated = sessionStorage.getItem('isAuthenticated');
        const userRole = sessionStorage.getItem('userRole');
        
        console.log('Auth page check:', { isAuthenticated, userRole }); // Debug log
        
        if (isAuthenticated === 'true') {
            switch(userRole) {
                case 'admin':
                    window.location.href = 'admin-dashboard.html';
                    break;
                case 'teacher':
                    window.location.href = 'teacher-dashboard.html';
                    break;
                case 'student':
                    window.location.href = 'student-dashboard.html';
                    break;
                default:
                    window.location.href = 'index.html';
            }
        }
    }
});

// Export the class for use in other modules
export default AuthGuard;