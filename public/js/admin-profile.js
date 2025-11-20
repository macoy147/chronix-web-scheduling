document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    if (!AuthGuard.checkAuthentication('admin')) {
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
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        AuthGuard.logout();
    });

    // Update profile name and avatar in navigation
    function updateProfileInfo() {
        const currentUser = AuthGuard.getCurrentUser();
        if (currentUser) {
            // Get first name from fullname
            const firstName = currentUser.fullname.split(' ')[0];
            const profileName = document.getElementById('profileName');
            if (profileName) {
                profileName.innerHTML = `${firstName} <i class="bi bi-chevron-down"></i>`;
            }

            // Update profile picture if available
            const profileAvatar = document.getElementById('profileAvatar');
            if (profileAvatar && currentUser.profilePicture) {
                profileAvatar.src = `http://localhost:3001${currentUser.profilePicture}`;
            }
        }
    }

    // Notification system
    function showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
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
            const userId = AuthGuard.getUserId();
            if (!userId) {
                showNotification('User not authenticated', 'error');
                return;
            }

            const response = await fetch(`http://localhost:3001/user/${userId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch user data');
            }

            const userData = await response.json();
            populateProfileFields(userData);
            
            // Update session storage with fresh data
            AuthGuard.storeUserSession(userData);
            updateProfileInfo();
            
        } catch (error) {
            console.error('Error loading user profile:', error);
            showNotification('Failed to load profile data', 'error');
        }
    }

    // Populate profile fields with user data
    function populateProfileFields(userData) {
        // Basic info
        document.getElementById('fullName').value = userData.fullname || '';
        document.getElementById('email').value = userData.email || '';
        document.getElementById('userRole').textContent = userData.role || 'Administrator';
        
        // Profile picture
        const profilePicture = document.getElementById('profilePicture');
        if (userData.profilePicture) {
            profilePicture.src = `http://localhost:3001${userData.profilePicture}`;
        }

        // Account details
        document.getElementById('userId').textContent = userData._id || '-';
        document.getElementById('ctuid').textContent = userData.ctuid || '-';
        document.getElementById('gender').textContent = userData.gender || '-';
        
        // Format birthdate
        if (userData.birthdate) {
            const date = new Date(userData.birthdate);
            document.getElementById('birthdate').textContent = date.toLocaleDateString();
        } else {
            document.getElementById('birthdate').textContent = '-';
        }

        // Last login
        if (userData.lastLogin) {
            const lastLoginDate = new Date(userData.lastLogin);
            document.getElementById('lastLogin').textContent = lastLoginDate.toLocaleString();
        } else {
            document.getElementById('lastLogin').textContent = 'Never';
        }
    }

    // Profile picture upload
    const profilePictureInput = document.getElementById('profilePictureInput');
    const profilePicture = document.getElementById('profilePicture');
    let selectedFile = null;

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
                profilePicture.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Save profile changes
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    saveProfileBtn.addEventListener('click', async function() {
        try {
            const userId = AuthGuard.getUserId();
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
            formData.append('email', document.getElementById('email').value.trim());

            // Add profile picture if selected
            if (selectedFile) {
                formData.append('profilePicture', selectedFile);
            }

            const response = await fetch(`http://localhost:3001/user/${userId}`, {
                method: 'PUT',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update profile');
            }

            const updatedUser = await response.json();
            
            // Update session storage
            AuthGuard.storeUserSession(updatedUser);
            
            // Update profile picture - handle different scenarios
            if (selectedFile) {
                console.log('Profile picture was uploaded'); // Debug log
                if (updatedUser.profilePicture) {
                    // Server returned new profile picture path
                    const newImageSrc = `http://localhost:3001${updatedUser.profilePicture}`;
                    console.log('Updating profile picture to:', newImageSrc); // Debug log
                    profilePicture.src = newImageSrc;
                } else {
                    // Server didn't return profilePicture field, but we uploaded one
                    // Try to reload user data to get updated profile picture
                    console.log('Server did not return profilePicture, reloading user data...'); // Debug log
                    setTimeout(async () => {
                        try {
                            const userResponse = await fetch(`http://localhost:3001/user/${userId}`);
                            if (userResponse.ok) {
                                const userData = await userResponse.json();
                                if (userData.profilePicture) {
                                    profilePicture.src = `http://localhost:3001${userData.profilePicture}`;
                                    AuthGuard.storeUserSession(userData);
                                }
                            }
                        } catch (error) {
                            console.error('Error reloading user data:', error);
                        }
                    }, 1000); // Wait 1 second for server to process
                }
            }
            
            // Update navigation profile info
            updateProfileInfo();
            
            showNotification('Profile updated successfully!', 'success');
            selectedFile = null; // Reset selected file
            profilePictureInput.value = ''; // Clear the file input
            
        } catch (error) {
            console.error('Error updating profile:', error);
            showNotification(error.message || 'Failed to update profile', 'error');
        }
    });

    // Cancel changes
    const cancelBtn = document.getElementById('cancelBtn');
    cancelBtn.addEventListener('click', function() {
        // Reload the profile data to reset any changes
        loadUserProfile();
        selectedFile = null;
        profilePictureInput.value = '';
        showNotification('Changes cancelled', 'info');
    });

    // Initial load
    updateProfileInfo();
    loadUserProfile();
});