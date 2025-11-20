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

    // Update profile name and avatar with actual user data
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

    // Fetch user data to get updated profile information
    async function fetchUserData() {
        try {
            const userId = AuthGuard.getUserId();
            if (userId) {
                const res = await fetch(`http://localhost:3001/user/${userId}`);
                if (res.ok) {
                    const userData = await res.json();
                    // Update session storage with fresh data
                    AuthGuard.storeUserSession(userData);
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
        
        // Clear existing options except "None"
        daySelect.innerHTML = '<option value="None">None</option>';
        nightSelect.innerHTML = '<option value="None">None</option>';
        
        try {
            const res = await fetch('http://localhost:3001/sections');
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
    const submitBtn = form.querySelector('.modal-submit');
    let editMode = false;
    let editingId = null;

    openBtn.onclick = async () => {
        editMode = false;
        editingId = null;
        form.reset();
        await fillSectionDropdowns();
        modal.querySelector('h3').textContent = 'Create New Room';
        submitBtn.textContent = 'Create';
        modal.style.display = 'flex';
    };

    closeBtn.onclick = () => { modal.style.display = 'none'; };
    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.style.display = 'none';
    });

    // CRUD logic
    async function loadRooms() {
        const tbody = document.getElementById('roomsTableBody');
        tbody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
        try {
            const res = await fetch('http://localhost:3001/rooms');
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
            let url = 'http://localhost:3001/rooms';
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
                modal.style.display = 'none';
                form.reset();
                loadRooms();
            } else {
                showBubbleMessage(result.error || (editMode ? "Failed to update room." : "Failed to create room."), "error");
            }
        } catch {
            showBubbleMessage("Failed to save room.", "error");
        }
    };

    // Edit modal
    async function openEditModal(id) {
        try {
            const res = await fetch('http://localhost:3001/rooms');
            const data = await res.json();
            const room = data.find(r => r._id === id);
            if (!room) return;
            editMode = true;
            editingId = id;
            form.roomName.value = room.roomName || '';
            form.building.value = room.building || '';
            form.roomType.value = room.roomType || '';
            form.capacity.value = room.capacity || 0;
            form.status.value = room.status || 'Available';
            
            // Fill section dropdowns with current values
            await fillSectionDropdowns(room.daySection || "None", room.nightSection || "None");
            
            modal.querySelector('h3').textContent = 'Edit Room';
            submitBtn.textContent = 'Save Changes';
            modal.style.display = 'flex';
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
            const res = await fetch('http://localhost:3001/rooms');
            const data = await res.json();
            room = data.find(r => r._id === id);
        } catch {}
        deleteRoomId = id;
        deleteModalText.textContent = room
            ? `Are you sure you want to delete "${room.roomName}"?`
            : 'Are you sure you want to delete this room?';
        deleteModal.style.display = 'flex';
    }

    cancelDeleteBtn.onclick = () => {
        deleteModal.style.display = 'none';
        deleteRoomId = null;
    };

    confirmDeleteBtn.onclick = async () => {
        if (!deleteRoomId) return;
        try {
            const res = await fetch(`http://localhost:3001/rooms/${deleteRoomId}`, {
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
        deleteModal.style.display = 'none';
        deleteRoomId = null;
    };

    deleteModal.addEventListener('click', function(e) {
        if (e.target === deleteModal) {
            deleteModal.style.display = 'none';
            deleteRoomId = null;
        }
    });

    // Initial load
    fillSectionDropdowns();
    loadRooms();
});
