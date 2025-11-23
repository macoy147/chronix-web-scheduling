// public/js/admin-profile.js - UPDATED FOR BASE64 IMAGE SUPPORT
import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';
import AuthGuard from './auth-guard.js';

// Profile picture helper - UPDATED FOR BASE64 SUPPORT
const ProfilePictureHelper = {
    getProfilePictureUrl(profilePicturePath) {
        if (!profilePicturePath) {
            return '/img/default_admin_avatar.png';
        }
        
        // Check if it's a base64 data URL
        if (profilePicturePath.startsWith('data:image/')) {
            return profilePicturePath;
        }
        
        if (profilePicturePath.startsWith('http')) {
            return profilePicturePath;
        }
        
        if (profilePicturePath.startsWith('/')) {
            return profilePicturePath;
        }
        
        // For backward compatibility with old file paths
        if (profilePicturePath.includes('profile-')) {
            return '/uploads/' + profilePicturePath;
        }
        
        return '/img/default_admin_avatar.png';
    },
    
    validateFile(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 5 * 1024 * 1024;
        
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
    showNotification(message, type = 'success', duration = 5000) {
        let notification = document.getElementById('notification');
        if (!notification) {
            notification = this.createNotificationElement();
        }
        
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, duration);
        
        console.log(`🔔 ${type.toUpperCase()}: ${message}`);
    },
    
    createNotificationElement() {
        const notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
        return notification;
    }
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('🏁 Admin Profile loaded - Initializing...');
    
    // Use AuthGuard for authentication check
    if (!AuthGuard.checkAuthentication('admin')) {
        return;
    }

    // Initialize notification system
    NotificationHelper.createNotificationElement();

    // Debug: Log current user info
    const currentUser = AuthGuard.getCurrentUser();
    console.log('👤 Current user from AuthGuard:', currentUser);

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

    // Logout functionality - Use AuthGuard's logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            AuthGuard.logout();
        });
    }

    // Update profile name and avatar in navigation
    function updateProfileInfo() {
        const currentUser = AuthGuard.getCurrentUser();
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
            
            console.log('🔄 Profile info updated in navigation');
        }
    }

    // Load user profile data
    async function loadUserProfile() {
        try {
            const userId = AuthGuard.getUserId();
            if (!userId) {
                console.error('❌ No user ID found from AuthGuard');
                NotificationHelper.showNotification('User not authenticated. Please sign in again.', 'error');
                setTimeout(() => AuthGuard.redirectToLogin(), 2000);
                return;
            }

            console.log('🔄 Loading user profile for ID:', userId);
            
            const response = await fetch(`${API_BASE_URL}/user/${userId}`);
            
            if (response.status === 401) {
                NotificationHelper.showNotification('Session expired. Please sign in again.', 'error');
                setTimeout(() => AuthGuard.redirectToLogin(), 2000);
                return;
            }
            
            if (!response.ok) {
                throw new Error(`Failed to fetch user data: ${response.status} ${response.statusText}`);
            }

            const userData = await response.json();
            console.log('✅ User data loaded:', userData);
            
            populateProfileFields(userData);
            
            // Update session storage with fresh data using AuthGuard
            AuthGuard.storeUserSession(userData);
            updateProfileInfo();
            
        } catch (error) {
            console.error('❌ Error loading user profile:', error);
            
            if (error.message.includes('401') || error.message.includes('unauthorized')) {
                NotificationHelper.showNotification('Session expired. Please sign in again.', 'error');
                setTimeout(() => AuthGuard.redirectToLogin(), 2000);
            } else {
                NotificationHelper.showNotification('Failed to load profile data: ' + error.message, 'error');
            }
        }
    }

    // Populate profile fields with user data
    function populateProfileFields(userData) {
        console.log('📝 Populating profile fields with:', userData);
        
        // Basic info
        const fullNameEl = document.getElementById('fullName');
        if (fullNameEl) fullNameEl.value = userData.fullname || '';
        
        const emailEl = document.getElementById('email');
        if (emailEl) emailEl.value = userData.email || '';
        
        const userRoleEl = document.getElementById('userRole');
        if (userRoleEl) userRoleEl.textContent = userData.userrole ? userData.userrole.charAt(0).toUpperCase() + userData.userrole.slice(1) : 'Administrator';
        
        // Profile picture
        const profilePicture = document.getElementById('profilePicture');
        if (profilePicture) {
            const pictureUrl = ProfilePictureHelper.getProfilePictureUrl(userData.profilePicture);
            console.log('🖼️ Setting profile picture to:', pictureUrl);
            profilePicture.src = pictureUrl;
        }

        // Account details
        document.getElementById('userId').textContent = userData._id || '-';
        document.getElementById('ctuid').textContent = userData.ctuid || '-';
        document.getElementById('gender').textContent = userData.gender || '-';
        
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
                    profilePictureInput.value = '';
                    selectedFile = null;
                }
            }
        });
    }

    // Save profile changes - USING AuthGuard
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async function() {
            const saveBtn = this;
            const originalText = saveBtn.innerHTML;
            
            try {
                const userId = AuthGuard.getUserId();
                if (!userId) {
                    throw new Error('User not authenticated. Please sign in again.');
                }

                console.log('🔄 Starting profile update for user:', userId);

                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';

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
                    console.log('📤 Uploading profile picture:', selectedFile.name);
                }

                console.log('🔄 Saving profile changes to server...');
                
                const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
                    method: 'PUT',
                    body: formData
                });

                if (response.status === 401) {
                    throw new Error('Session expired. Please sign in again.');
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    let errorData;
                    try {
                        errorData = JSON.parse(errorText);
                    } catch {
                        errorData = { error: errorText };
                    }
                    throw new Error(errorData.error || `Server error: ${response.status}`);
                }

                const result = await response.json();
                const updatedUser = result.user;
                const changes = result.changes || [];
                
                console.log('✅ Profile update successful:', updatedUser);
                
                // Update session storage using AuthGuard
                AuthGuard.storeUserSession(updatedUser);
                
                // Update all profile pictures
                updateAllProfilePictures(updatedUser.profilePicture);
                
                // Update navigation profile info
                updateProfileInfo();
                
                // Show detailed notification
                if (changes.length > 0) {
                    NotificationHelper.showNotification(
                        `Profile updated successfully! Changes: ${changes.join(', ')}`, 
                        'success', 
                        6000
                    );
                } else {
                    NotificationHelper.showNotification('Profile updated successfully!', 'success');
                }
                
                selectedFile = null;
                if (profilePictureInput) {
                    profilePictureInput.value = '';
                }
                
            } catch (error) {
                console.error('❌ Error updating profile:', error);
                
                if (error.message.includes('Session expired') || error.message.includes('not authenticated')) {
                    NotificationHelper.showNotification(error.message, 'error');
                    setTimeout(() => AuthGuard.redirectToLogin(), 2000);
                } else {
                    NotificationHelper.showNotification(error.message || 'Failed to update profile', 'error');
                }
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
        console.log('🔄 Updating all profile pictures to:', imageUrl);
        
        const profilePicture = document.getElementById('profilePicture');
        if (profilePicture) {
            profilePicture.src = imageUrl;
        }
        
        const navAvatar = document.getElementById('profileAvatar');
        if (navAvatar) {
            navAvatar.src = imageUrl;
        }
    }

    // Cancel changes
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
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
    
    console.log('✅ Admin Profile initialization complete');
});