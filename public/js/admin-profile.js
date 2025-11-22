// public/js/admin-profile.js - FIXED VERSION
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

document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin Profile loaded');
    
    // Check authentication first
    if (!AuthHelper.checkAuthentication('admin')) {
        return;
    }

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
            const firstName = currentUser.fullname.split(' ')[0];
            const profileName = document.getElementById('profileName');
            if (profileName) {
                profileName.innerHTML = `${firstName} <i class="bi bi-chevron-down"></i>`;
            }

            const profileAvatar = document.getElementById('profileAvatar');
            if (profileAvatar) {
                if (currentUser.profilePicture) {
                    // Use relative path for profile picture
                    profileAvatar.src = currentUser.profilePicture.startsWith('/') 
                        ? currentUser.profilePicture 
                        : '/' + currentUser.profilePicture;
                } else {
                    profileAvatar.src = '/img/default_admin_avatar.png';
                }
            }
        }
    }

    // Notification system
    function showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    // Load user profile data
    async function loadUserProfile() {
        try {
            const userId = AuthHelper.getUserId();
            if (!userId) {
                showNotification('User not authenticated', 'error');
                return;
            }

            const response = await fetch(`/user/${userId}`);
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
            showNotification('Failed to load profile data', 'error');
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
        
        // Profile picture
        const profilePicture = document.getElementById('profilePicture');
        if (profilePicture && userData.profilePicture) {
            profilePicture.src = userData.profilePicture.startsWith('/') 
                ? userData.profilePicture 
                : '/' + userData.profilePicture;
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
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    showNotification('Please select a valid image file', 'error');
                    return;
                }

                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    showNotification('Image size must be less than 5MB', 'error');
                    return;
                }

                selectedFile = file;
                
                // Preview the image
                const reader = new FileReader();
                reader.onload = function(e) {
                    if (profilePicture) {
                        profilePicture.src = e.target.result;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Save profile changes
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async function() {
            try {
                const userId = AuthHelper.getUserId();
                if (!userId) {
                    showNotification('User not authenticated', 'error');
                    return;
                }

                const formData = new FormData();
                
                // Add basic profile data
                const fullName = document.getElementById('fullName').value.trim();
                if (!fullName) {
                    showNotification('Full name is required', 'error');
                    return;
                }
                
                formData.append('fullname', fullName);
                
                const emailEl = document.getElementById('email');
                if (emailEl) {
                    formData.append('email', emailEl.value.trim());
                }

                // Add profile picture if selected
                if (selectedFile) {
                    formData.append('profilePicture', selectedFile);
                }

                const response = await fetch(`/user/${userId}`, {
                    method: 'PUT',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to update profile');
                }

                const updatedUser = await response.json();
                
                // Update session storage
                AuthHelper.storeUserSession(updatedUser);
                
                // Update profile picture
                if (selectedFile && updatedUser.profilePicture) {
                    const newImageSrc = updatedUser.profilePicture.startsWith('/') 
                        ? updatedUser.profilePicture 
                        : '/' + updatedUser.profilePicture;
                    
                    if (profilePicture) {
                        profilePicture.src = newImageSrc;
                    }
                    
                    // Update navigation avatar too
                    const navAvatar = document.getElementById('profileAvatar');
                    if (navAvatar) {
                        navAvatar.src = newImageSrc;
                    }
                }
                
                // Update navigation profile info
                updateProfileInfo();
                
                showNotification('Profile updated successfully!', 'success');
                selectedFile = null; // Reset selected file
                if (profilePictureInput) {
                    profilePictureInput.value = ''; // Clear the file input
                }
                
            } catch (error) {
                console.error('Error updating profile:', error);
                showNotification(error.message || 'Failed to update profile', 'error');
            }
        });
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
            showNotification('Changes cancelled', 'info');
        });
    }

    // Initial load
    updateProfileInfo();
    loadUserProfile();
});