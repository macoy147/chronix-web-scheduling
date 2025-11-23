// public/js/admin-profile.js - ENHANCED VERSION WITH NOTIFICATIONS
import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';

// Simple auth helper
const AuthHelper = {
    checkAuthentication(requiredRole = null) {
        const isAuthenticated = sessionStorage.getItem('isAuthenticated');
        const userRole = sessionStorage.getItem('userRole');
        
        console.log('Auth check:', { isAuthenticated, userRole, requiredRole });
        
        if (!isAuthenticated || isAuthenticated !== 'true') {
            this.redirectToLogin();
            return false;
        }
        
        if (requiredRole && userRole !== requiredRole) {
            this.redirectToLogin('Unauthorized access.');
            return false;
        }
        
        return true;
    },
    
    redirectToLogin(message = 'Please sign in') {
        sessionStorage.setItem('loginRedirectMessage', message);
        window.location.href = 'auth.html?mode=signin';
    },
    
    getCurrentUser() {
        const userData = sessionStorage.getItem('currentUser');
        return userData ? JSON.parse(userData) : null;
    },
    
    getUserId() {
        const user = this.getCurrentUser();
        return user ? user._id : null;
    },
    
    logout() {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('userId');
        window.location.href = 'auth.html?mode=signin';
    },
    
    storeUserSession(userData) {
        sessionStorage.setItem('currentUser', JSON.stringify(userData));
        sessionStorage.setItem('isAuthenticated', 'true');
        sessionStorage.setItem('userRole', userData.userrole);
        sessionStorage.setItem('userId', userData._id);
    }
};

// Profile picture helper
const ProfilePictureHelper = {
    // Get full profile picture URL
    getProfilePictureUrl(profilePicturePath) {
        if (!profilePicturePath) {
            return '/img/default_admin_avatar.png';
        }
        
        // If it's already a full URL, return as is
        if (profilePicturePath.startsWith('http')) {
            return profilePicturePath;
        }
        
        // If it's a relative path, make it absolute
        if (profilePicturePath.startsWith('/')) {
            return profilePicturePath;
        }
        
        // Default fallback
        return '/img/default_admin_avatar.png';
    },
    
    // Validate file before upload
    validateFile(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        if (!validTypes.includes(file.type)) {
            throw new Error('Please select a valid image file (JPEG, PNG, GIF, WebP)');
        }
        
        if (file.size > maxSize) {
            throw new Error('Image size must be less than 5MB');
        }
        
        return true;
    }
};

// Notification helper
const NotificationHelper = {
    // Show notification to user
    showNotification(message, type = 'success', duration = 5000) {
        const notification = document.getElementById('notification');
        if (!notification) {
            this.createNotificationElement();
        }
        
        const notificationEl = document.getElementById('notification');
        notificationEl.textContent = message;
        notificationEl.className = `notification ${type} show`;
        
        // Auto hide after duration
        setTimeout(() => {
            notificationEl.classList.remove('show');
        }, duration);
        
        // Also log to console
        console.log(`🔔 ${type.toUpperCase()}: ${message}`);
    },
    
    // Create notification element if it doesn't exist
    createNotificationElement() {
        const notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
    },
    
    // Fetch user notifications
    async fetchUserNotifications(userId) {
        try {
            const response = await fetch(`${API_BASE_URL}/notifications/${userId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch notifications');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }
    },
    
    // Mark notification as read
    async markNotificationAsRead(notificationId) {
        try {
            const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
                method: 'PUT'
            });
            return response.ok;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            return false;
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin Profile loaded');
    
    // Check authentication first
    if (!AuthHelper.checkAuthentication('admin')) {
        return;
    }

    // Initialize notification system
    NotificationHelper.createNotificationElement();

    // Profile dropdown
    const profileDropdown = document.querySelector('.admin-profile-dropdown');
    if (profileDropdown) {
        profileDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
            profileDropdown.classList.toggle('open');
        });
        document.addEventListener('click', function() {
            profileDropdown.classList.remove('open');
        });
    }

    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            AuthHelper.logout();
        });
    }

    // Update profile name and avatar in navigation
    function updateProfileInfo() {
        const currentUser = AuthHelper.getCurrentUser();
        if (currentUser) {
            const firstName = currentUser.fullname?.split(' ')[0] || 'Admin';
            const profileName = document.getElementById('profileName');
            if (profileName) {
                profileName.innerHTML = `${firstName} <i class="bi bi-chevron-down"></i>`;
            }

            const profileAvatar = document.getElementById('profileAvatar');
            if (profileAvatar) {
                profileAvatar.src = ProfilePictureHelper.getProfilePictureUrl(currentUser.profilePicture);
            }
        }
    }

    // Load user profile data
    async function loadUserProfile() {
        try {
            const userId = AuthHelper.getUserId();
            if (!userId) {
                NotificationHelper.showNotification('User not authenticated', 'error');
                return;
            }

            const response = await fetch(`${API_BASE_URL}/user/${userId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch user data');
            }

            const userData = await response.json();
            populateProfileFields(userData);
            
            // Update session storage with fresh data
            AuthHelper.storeUserSession(userData);
            updateProfileInfo();
            
        } catch (error) {
            console.error('Error loading user profile:', error);
            NotificationHelper.showNotification('Failed to load profile data', 'error');
        }
    }

    // Populate profile fields with user data
    function populateProfileFields(userData) {
        // Basic info
        const fullNameEl = document.getElementById('fullName');
        if (fullNameEl) fullNameEl.value = userData.fullname || '';
        
        const emailEl = document.getElementById('email');
        if (emailEl) emailEl.value = userData.email || '';
        
        const userRoleEl = document.getElementById('userRole');
        if (userRoleEl) userRoleEl.textContent = userData.userrole ? userData.userrole.charAt(0).toUpperCase() + userData.userrole.slice(1) : 'Administrator';
        
        // Profile picture - use helper function
        const profilePicture = document.getElementById('profilePicture');
        if (profilePicture) {
            profilePicture.src = ProfilePictureHelper.getProfilePictureUrl(userData.profilePicture);
        }

        // Account details
        const userIdEl = document.getElementById('userId');
        if (userIdEl) userIdEl.textContent = userData._id || '-';
        
        const ctuidEl = document.getElementById('ctuid');
        if (ctuidEl) ctuidEl.textContent = userData.ctuid || '-';
        
        const genderEl = document.getElementById('gender');
        if (genderEl) genderEl.textContent = userData.gender || '-';
        
        // Format birthdate
        const birthdateEl = document.getElementById('birthdate');
        if (birthdateEl) {
            if (userData.birthdate) {
                const date = new Date(userData.birthdate);
                birthdateEl.textContent = date.toLocaleDateString();
            } else {
                birthdateEl.textContent = '-';
            }
        }

        // Last login
        const lastLoginEl = document.getElementById('lastLogin');
        if (lastLoginEl) {
            if (userData.lastLogin) {
                const lastLoginDate = new Date(userData.lastLogin);
                lastLoginEl.textContent = lastLoginDate.toLocaleString();
            } else {
                lastLoginEl.textContent = 'Never';
            }
        }
    }

    // Profile picture upload
    const profilePictureInput = document.getElementById('profilePictureInput');
    const profilePicture = document.getElementById('profilePicture');
    let selectedFile = null;

    if (profilePictureInput) {
        profilePictureInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                try {
                    // Validate file using helper
                    ProfilePictureHelper.validateFile(file);
                    selectedFile = file;
                    
                    // Preview the image
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        if (profilePicture) {
                            profilePicture.src = e.target.result;
                        }
                    };
                    reader.readAsDataURL(file);
                    
                    NotificationHelper.showNotification('Profile picture selected. Click "Save Changes" to upload.', 'success');
                } catch (error) {
                    NotificationHelper.showNotification(error.message, 'error');
                    profilePictureInput.value = ''; // Clear the invalid file
                }
            }
        });
    }

    // Save profile changes
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async function() {
            const saveBtn = this;
            const originalText = saveBtn.innerHTML;
            
            try {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';

                const userId = AuthHelper.getUserId();
                if (!userId) {
                    throw new Error('User not authenticated');
                }

                const formData = new FormData();
                
                // Add basic profile data
                const fullName = document.getElementById('fullName').value.trim();
                if (!fullName) {
                    throw new Error('Full name is required');
                }
                
                formData.append('fullname', fullName);
                
                const emailEl = document.getElementById('email');
                if (emailEl) {
                    const email = emailEl.value.trim();
                    if (!email) {
                        throw new Error('Email is required');
                    }
                    formData.append('email', email);
                }

                // Add profile picture if selected
                if (selectedFile) {
                    formData.append('profilePicture', selectedFile);
                }

                const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
                    method: 'PUT',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to update profile');
                }

                const result = await response.json();
                const updatedUser = result.user;
                const changes = result.changes || [];
                
                // Update session storage
                AuthHelper.storeUserSession(updatedUser);
                
                // Update all profile pictures
                updateAllProfilePictures(updatedUser.profilePicture);
                
                // Update navigation profile info
                updateProfileInfo();
                
                // Show detailed notification about changes
                if (changes.length > 0) {
                    NotificationHelper.showNotification(
                        `Profile updated successfully! Changes: ${changes.join(', ')}`, 
                        'success', 
                        6000
                    );
                } else {
                    NotificationHelper.showNotification('Profile updated successfully!', 'success');
                }
                
                selectedFile = null; // Reset selected file
                if (profilePictureInput) {
                    profilePictureInput.value = ''; // Clear the file input
                }
                
                // Fetch and show recent notifications
                setTimeout(() => {
                    checkForNewNotifications(userId);
                }, 1000);
                
            } catch (error) {
                console.error('Error updating profile:', error);
                NotificationHelper.showNotification(error.message || 'Failed to update profile', 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
            }
        });
    }

    // Helper function to update all profile pictures
    function updateAllProfilePictures(profilePicturePath) {
        if (!profilePicturePath) return;
        
        const imageUrl = ProfilePictureHelper.getProfilePictureUrl(profilePicturePath);
        
        // Update profile view avatar
        const profilePicture = document.getElementById('profilePicture');
        if (profilePicture) {
            profilePicture.src = imageUrl;
        }
        
        // Update navigation avatar
        const navAvatar = document.getElementById('profileAvatar');
        if (navAvatar) {
            navAvatar.src = imageUrl;
        }
    }

    // Check for new notifications
    async function checkForNewNotifications(userId) {
        try {
            const notifications = await NotificationHelper.fetchUserNotifications(userId);
            const unreadNotifications = notifications.filter(n => !n.read);
            
            if (unreadNotifications.length > 0) {
                // Show a summary of recent notifications
                const recentNotifications = unreadNotifications.slice(0, 3);
                recentNotifications.forEach(notification => {
                    setTimeout(() => {
                        NotificationHelper.showNotification(
                            `📢 ${notification.title}: ${notification.message}`,
                            'success',
                            5000
                        );
                    }, 1000);
                });
                
                // Mark them as read after showing
                setTimeout(async () => {
                    for (const notification of recentNotifications) {
                        await NotificationHelper.markNotificationAsRead(notification._id);
                    }
                }, 6000);
            }
        } catch (error) {
            console.error('Error checking notifications:', error);
        }
    }

    // Cancel changes
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            // Reload the profile data to reset any changes
            loadUserProfile();
            selectedFile = null;
            if (profilePictureInput) {
                profilePictureInput.value = '';
            }
            NotificationHelper.showNotification('Changes cancelled', 'info');
        });
    }

    // Initial load
    updateProfileInfo();
    loadUserProfile();
    
    // Check for notifications on page load
    const userId = AuthHelper.getUserId();
    if (userId) {
        setTimeout(() => {
            checkForNewNotifications(userId);
        }, 2000);
    }
});