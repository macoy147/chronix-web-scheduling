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

    // Update profile name and avatar with actual user data
    function updateProfileInfo() {
        const currentUser = AuthHelper.getCurrentUser();
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
                profileAvatar.src = currentUser.profilePicture.startsWith('http') 
                    ? currentUser.profilePicture 
                    : currentUser.profilePicture;
            }
        }
    }

    // Fetch user data to get updated profile information
    async function fetchUserData() {
        try {
            const userId = AuthHelper.getUserId();
            if (userId) {
                const res = await fetch(`/user/${userId}`);
                if (res.ok) {
                    const userData = await res.json();
                    // Update session storage with fresh data
                    AuthHelper.storeUserSession(userData);
                    updateProfileInfo();
                }
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }

    // Initial profile update
    updateProfileInfo();
    fetchUserData();

    // Bubble Notification
    function showBubbleMessage(msg, type = "success") {
        const bubble = document.getElementById('roomBubbleMessage');
        if (!bubble) return;
        
        bubble.textContent = msg;
        bubble.classList.remove("show", "success", "error");
        bubble.classList.add(type);
        void bubble.offsetWidth;
        bubble.classList.add("show");
        setTimeout(() => {
            bubble.classList.remove("show");
        }, 2700);
    }

    // Fetch sections for dropdowns
    async function fillSectionDropdowns(selectedDay = "None", selectedNight = "None") {
        const daySelect = document.getElementById('daySectionSelect');
        const nightSelect = document.getElementById('nightSectionSelect');
        
        if (!daySelect || !nightSelect) return;
        
        // Clear existing options except "None"
        daySelect.innerHTML = '<option value="None">None</option>';
        nightSelect.innerHTML = '<option value="None">None</option>';
        
        try {
            const res = await fetch('/sections');
            const data = await res.json();
            
            data.forEach(section => {
                const option = document.createElement('option');
                option.value = section.sectionName;
                option.textContent = section.sectionName;
                
                // Clone for day section
                const dayOption = option.cloneNode(true);
                if (section.sectionName === selectedDay) dayOption.selected = true;
                daySelect.appendChild(dayOption);
                
                // Clone for night section
                const nightOption = option.cloneNode(true);
                if (section.sectionName === selectedNight) nightOption.selected = true;
                nightSelect.appendChild(nightOption);
            });
        } catch {
            // fallback - keep only "None" option
        }
    }

    // Modal logic
    const modal = document.getElementById('roomModal');
    const openBtn = document.getElementById('openRoomModal');
    const closeBtn = document.getElementById('closeRoomModal');
    const form = document.getElementById('roomForm');
    const submitBtn = form ? form.querySelector('.modal-submit') : null;
    let editMode = false;
    let editingId = null;

    if (openBtn) {
        openBtn.onclick = async () => {
            editMode = false;
            editingId = null;
            if (form) form.reset();
            await fillSectionDropdowns();
            
            const modalTitle = modal ? modal.querySelector('h3') : null;
            if (modalTitle) modalTitle.textContent = 'Create New Room';
            
            if (submitBtn) submitBtn.textContent = 'Create';
            if (modal) modal.style.display = 'flex';
        };
    }

    if (closeBtn) {
        closeBtn.onclick = () => { 
            if (modal) modal.style.display = 'none'; 
        };
    }

    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    // CRUD logic
    async function loadRooms() {
        const tbody = document.getElementById('roomsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
        try {
            const res = await fetch('/rooms');
            const data = await res.json();
            if (Array.isArray(data) && data.length) {
                tbody.innerHTML = '';
                data.forEach(room => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${room.roomName || ''}</td>
                        <td>${room.building || ''}</td>
                        <td>${room.roomType || ''}</td>
                        <td>${room.capacity || 0}</td>
                        <td>${room.daySection || 'None'}</td>
                        <td>${room.nightSection || 'None'}</td>
                        <td><span class="status-badge ${getStatusClass(room.status)}">${room.status || 'Available'}</span></td>
                        <td>
                            <span class="action-link edit" data-id="${room._id}" title="Edit"><i class="bi bi-pencil"></i></span>
                            <span class="action-link delete" data-id="${room._id}" title="Delete"><i class="bi bi-trash"></i></span>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
                tbody.querySelectorAll('.edit').forEach(btn => {
                    btn.onclick = () => openEditModal(btn.getAttribute('data-id'));
                });
                tbody.querySelectorAll('.delete').forEach(btn => {
                    btn.onclick = () => handleDelete(btn.getAttribute('data-id'));
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="8">No rooms found.</td></tr>';
            }
        } catch {
            tbody.innerHTML = '<tr><td colspan="8">Error loading rooms.</td></tr>';
        }
    }

    function getStatusClass(status) {
        switch (status) {
            case 'Available': return 'status-available';
            case 'Under Maintenance': return 'status-maintenance';
            case 'Occupied': return 'status-occupied';
            default: return 'status-available';
        }
    }

    // Form submit
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const data = {
                roomName: form.roomName.value.trim(),
                building: form.building.value,
                roomType: form.roomType.value,
                capacity: parseInt(form.capacity.value) || 0,
                daySection: form.daySection.value,
                nightSection: form.nightSection.value,
                status: form.status.value
            };
            
            if (!data.roomName || !data.building || !data.roomType || !data.capacity) {
                showBubbleMessage("Please fill all required fields.", "error");
                return;
            }
            
            try {
                let url = '/rooms';
                let method = 'POST';
                if (editMode) {
                    url += `/${editingId}`;
                    method = 'PUT';
                }
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await res.json();
                if (res.ok) {
                    showBubbleMessage(editMode ? "Room updated successfully." : "Room created successfully.", "success");
                    if (modal) modal.style.display = 'none';
                    if (form) form.reset();
                    loadRooms();
                } else {
                    showBubbleMessage(result.error || (editMode ? "Failed to update room." : "Failed to create room."), "error");
                }
            } catch {
                showBubbleMessage("Failed to save room.", "error");
            }
        };
    }

    // Edit modal
    async function openEditModal(id) {
        try {
            const res = await fetch('/rooms');
            const data = await res.json();
            const room = data.find(r => r._id === id);
            if (!room) return;
            
            editMode = true;
            editingId = id;
            
            if (form) {
                form.roomName.value = room.roomName || '';
                form.building.value = room.building || '';
                form.roomType.value = room.roomType || '';
                form.capacity.value = room.capacity || 0;
                form.status.value = room.status || 'Available';
            }
            
            // Fill section dropdowns with current values
            await fillSectionDropdowns(room.daySection || "None", room.nightSection || "None");
            
            const modalTitle = modal ? modal.querySelector('h3') : null;
            if (modalTitle) modalTitle.textContent = 'Edit Room';
            
            if (submitBtn) submitBtn.textContent = 'Save Changes';
            if (modal) modal.style.display = 'flex';
        } catch {
            showBubbleMessage("Error loading room for edit.", "error");
        }
    }

    // Delete modal
    const deleteModal = document.getElementById('deleteRoomModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteRoomBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteRoomBtn');
    const deleteModalText = document.getElementById('deleteModalText');
    let deleteRoomId = null;

    async function handleDelete(id) {
        let room = null;
        try {
            const res = await fetch('/rooms');
            const data = await res.json();
            room = data.find(r => r._id === id);
        } catch {}
        deleteRoomId = id;
        
        if (deleteModalText) {
            deleteModalText.textContent = room
                ? `Are you sure you want to delete "${room.roomName}"?`
                : 'Are you sure you want to delete this room?';
        }
        
        if (deleteModal) deleteModal.style.display = 'flex';
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.onclick = () => {
            if (deleteModal) deleteModal.style.display = 'none';
            deleteRoomId = null;
        };
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.onclick = async () => {
            if (!deleteRoomId) return;
            try {
                const res = await fetch(`/rooms/${deleteRoomId}`, {
                    method: 'DELETE'
                });
                const result = await res.json();
                if (res.ok) {
                    showBubbleMessage("Room deleted successfully.", "success");
                    loadRooms();
                } else {
                    showBubbleMessage(result.error || "Failed to delete room.", "error");
                }
            } catch {
                showBubbleMessage("Failed to delete room.", "error");
            }
            if (deleteModal) deleteModal.style.display = 'none';
            deleteRoomId = null;
        };
    }

    if (deleteModal) {
        deleteModal.addEventListener('click', function(e) {
            if (e.target === deleteModal) {
                deleteModal.style.display = 'none';
                deleteRoomId = null;
            }
        });
    }

    // Initial load
    fillSectionDropdowns();
    loadRooms();
});