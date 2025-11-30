import AuthGuard from './auth-guard.js';

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    if (!AuthGuard.checkAuthentication('admin')) {
        return;
    }

    // Skip desktop initialization if on mobile page
    if (window.location.pathname.includes('-mobile')) {
        console.log('Mobile page detected, skipping desktop rooms.js initialization');
        return;
    }

    // State management
    let rooms = [];
    let sections = [];
    let editMode = false;
    let editingId = null;
    let activeFilters = {
        building: null,
        roomType: null,
        status: null,
        capacity: null
    };

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
            AuthGuard.logout();
        });
    }

    // Update profile info
    function updateProfileInfo() {
        const currentUser = AuthGuard.getCurrentUser();
        if (currentUser) {
            const firstName = currentUser.fullname.split(' ')[0];
            const profileName = document.getElementById('profileName');
            if (profileName) {
                profileName.innerHTML = `${firstName} <i class="bi bi-chevron-down"></i>`;
            }
            const profileAvatar = document.getElementById('profileAvatar');
            if (profileAvatar && currentUser.profilePicture) {
                profileAvatar.src = currentUser.profilePicture.startsWith('http') 
                    ? currentUser.profilePicture 
                    : currentUser.profilePicture;
            }
        }
    }

    // Fetch user data
    async function fetchUserData() {
        try {
            const userId = AuthGuard.getUserId();
            if (userId) {
                const res = await fetch(`/user/${userId}`);
                if (res.ok) {
                    const userData = await res.json();
                    AuthGuard.storeUserSession(userData);
                    updateProfileInfo();
                }
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }

    // Initialize
    updateProfileInfo();
    fetchUserData();

    // Modal error display functions
    function showModalError(message) {
        const errorAlert = document.getElementById('roomModalError');
        const errorText = document.getElementById('roomModalErrorText');
        
        if (errorAlert && errorText) {
            errorText.textContent = message;
            errorAlert.style.display = 'flex';
            
            const modalContent = document.querySelector('#roomModal .modal-content');
            if (modalContent) {
                modalContent.scrollTop = 0;
            }
        }
    }

    function hideModalError() {
        const errorAlert = document.getElementById('roomModalError');
        if (errorAlert) {
            errorAlert.style.display = 'none';
        }
    }

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

    // Load all data
    async function loadAllData() {
        try {
            await Promise.all([
                loadRooms(),
                loadSections()
            ]);
            updateStatistics();
            renderRoomsTable();
            setupSearchFunctionality();
            setupFilterDropdown();
            setupExportButton();
        } catch (error) {
            console.error('Error loading data:', error);
            showBubbleMessage('Error loading room data', 'error');
        }
    }

    // Update statistics cards
    function updateStatistics() {
        const total = rooms.length;
        const available = rooms.filter(r => r.status === 'Available').length;
        const occupied = rooms.filter(r => r.status === 'Occupied').length;
        const maintenance = rooms.filter(r => r.status === 'Under Maintenance').length;

        document.getElementById('totalRooms').textContent = total;
        document.getElementById('availableRooms').textContent = available;
        document.getElementById('occupiedRooms').textContent = occupied;
        document.getElementById('maintenanceRooms').textContent = maintenance;
    }

    // Load sections
    async function loadSections() {
        try {
            const res = await fetch('/sections');
            if (res.ok) {
                sections = await res.json();
                console.log('Loaded sections:', sections);
            } else {
                console.error('Failed to load sections');
                sections = [];
            }
        } catch (error) {
            console.error('Error loading sections:', error);
            sections = [];
        }
    }

    // Fetch sections for dropdowns with smart filtering
    async function fillSectionDropdowns(selectedDay = "None", selectedNight = "None") {
        const daySelect = document.getElementById('daySectionSelect');
        const nightSelect = document.getElementById('nightSectionSelect');
        
        if (!daySelect || !nightSelect) return;
        
        // Clear existing options except "None"
        daySelect.innerHTML = '<option value="None">None</option>';
        nightSelect.innerHTML = '<option value="None">None</option>';
        
        // Get sections already assigned to rooms (excluding current room if editing)
        const assignedDaySections = rooms
            .filter(r => (!editMode || r._id !== editingId) && r.daySection && r.daySection !== 'None')
            .map(r => r.daySection);
        
        const assignedNightSections = rooms
            .filter(r => (!editMode || r._id !== editingId) && r.nightSection && r.nightSection !== 'None')
            .map(r => r.nightSection);
        
        // Populate day sections (filter out already assigned day sections)
        sections.forEach(section => {
            const dayOption = document.createElement('option');
            dayOption.value = section.sectionName;
            dayOption.textContent = section.sectionName;
            
            if (section.sectionName === selectedDay) {
                dayOption.selected = true;
            } else if (assignedDaySections.includes(section.sectionName)) {
                dayOption.disabled = true;
                dayOption.textContent += ' (Already assigned)';
            }
            
            daySelect.appendChild(dayOption);
        });
        
        // Populate night sections (filter out already assigned night sections)
        sections.forEach(section => {
            const nightOption = document.createElement('option');
            nightOption.value = section.sectionName;
            nightOption.textContent = section.sectionName;
            
            if (section.sectionName === selectedNight) {
                nightOption.selected = true;
            } else if (assignedNightSections.includes(section.sectionName)) {
                nightOption.disabled = true;
                nightOption.textContent += ' (Already assigned)';
            }
            
            nightSelect.appendChild(nightOption);
        });
        
        // Show helper text
        const dayHelperText = daySelect.nextElementSibling;
        const nightHelperText = nightSelect.nextElementSibling;
        
        if (dayHelperText) {
            const availableDay = sections.length - assignedDaySections.length;
            dayHelperText.innerHTML = `<i class="bi bi-info-circle"></i> ${availableDay} section(s) available for day shift`;
        }
        
        if (nightHelperText) {
            const availableNight = sections.length - assignedNightSections.length;
            nightHelperText.innerHTML = `<i class="bi bi-info-circle"></i> ${availableNight} section(s) available for night shift`;
        }
    }

    // Setup search functionality
    function setupSearchFunctionality() {
        const searchInput = document.getElementById('roomsSearchInput');
        if (!searchInput) return;

        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterRooms(searchTerm);
        });
    }

    // Filter rooms based on search term
    function filterRooms(searchTerm) {
        const tbody = document.getElementById('roomsTableBody');
        if (!tbody) return;

        if (searchTerm === '' && rooms.length > 0) {
            const dataRows = Array.from(tbody.getElementsByTagName('tr')).filter(row => row.cells.length > 1);
            if (dataRows.length === 0) {
                renderRoomsTable();
                return;
            }
        }

        const rows = tbody.getElementsByTagName('tr');
        let visibleCount = 0;
        let hasNoResultsRow = false;

        Array.from(rows).forEach(row => {
            if (row.cells.length === 1) {
                hasNoResultsRow = true;
                return;
            }

            const roomName = row.cells[0]?.textContent.toLowerCase() || '';
            const building = row.cells[1]?.textContent.toLowerCase() || '';
            const roomType = row.cells[2]?.textContent.toLowerCase() || '';
            const capacity = row.cells[3]?.textContent.toLowerCase() || '';
            const daySection = row.cells[4]?.textContent.toLowerCase() || '';
            const nightSection = row.cells[5]?.textContent.toLowerCase() || '';

            const matches = roomName.includes(searchTerm) ||
                          building.includes(searchTerm) ||
                          roomType.includes(searchTerm) ||
                          capacity.includes(searchTerm) ||
                          daySection.includes(searchTerm) ||
                          nightSection.includes(searchTerm);

            if (matches || searchTerm === '') {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });

        if (hasNoResultsRow) {
            const noResultsRow = Array.from(rows).find(row => row.cells.length === 1);
            if (noResultsRow) {
                noResultsRow.remove();
            }
        }

        if (visibleCount === 0 && searchTerm !== '') {
            const noResultsRow = document.createElement('tr');
            noResultsRow.innerHTML = `
                <td colspan="8" style="text-align: center; padding: 48px 24px; color: #999; font-style: italic;">
                    No rooms found matching "${searchTerm}". Try a different search term.
                </td>
            `;
            tbody.appendChild(noResultsRow);
        }
    }

    // Modal logic
    const modal = document.getElementById('roomModal');
    const openBtn = document.getElementById('openRoomModal');
    const closeBtn = document.getElementById('closeRoomModal');
    const form = document.getElementById('roomForm');
    const submitBtn = form ? form.querySelector('.modal-submit') : null;

    if (openBtn) {
        openBtn.onclick = async () => {
            editMode = false;
            editingId = null;
            if (form) form.reset();
            hideModalError();
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
            hideModalError();
        };
    }

    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
                hideModalError();
            }
        });
    }

    // Check for duplicate room name
    function checkDuplicateRoom(roomName, excludeId = null) {
        return rooms.some(room => 
            room.roomName.toLowerCase() === roomName.toLowerCase() &&
            (!excludeId || room._id !== excludeId)
        );
    }

    // Validate capacity constraints
    function validateCapacity(capacity, roomType) {
        const warnings = [];
        
        if (capacity < 10) {
            warnings.push('Very low capacity. Is this correct?');
        } else if (capacity > 100) {
            warnings.push('Very high capacity. Verify this is accurate.');
        }
        
        // Room type specific warnings
        if (roomType === 'Computer Lab' && capacity > 60) {
            warnings.push('Computer labs typically have 40-60 capacity.');
        } else if (roomType === 'Lab' && capacity > 40) {
            warnings.push('Lab rooms typically have 20-40 capacity.');
        }
        
        return warnings;
    }

    // Load rooms
    async function loadRooms() {
        const tbody = document.getElementById('roomsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
        try {
            const res = await fetch('/rooms');
            const data = await res.json();
            rooms = Array.isArray(data) ? data : [];
            
            if (rooms.length > 0) {
                renderRoomsTable();
            } else {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 48px 24px; color: #999; font-style: italic;">
                            No rooms found. Create your first room to get started.
                        </td>
                    </tr>
                `;
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
            tbody.innerHTML = '<tr><td colspan="8">Error loading rooms.</td></tr>';
            rooms = [];
        }
    }

    // Render rooms table
    function renderRoomsTable() {
        const tbody = document.getElementById('roomsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        rooms.forEach(room => {
            const tr = document.createElement('tr');
            
            // Capacity indicator with color coding
            let capacityDisplay = room.capacity || 0;
            let capacityClass = '';
            if (room.capacity < 20) {
                capacityClass = 'capacity-low';
            } else if (room.capacity >= 50) {
                capacityClass = 'capacity-high';
            }
            
            tr.innerHTML = `
                <td>${room.roomName || ''}</td>
                <td>${room.building || ''}</td>
                <td><span class="room-type-badge room-type-${(room.roomType || '').toLowerCase().replace(/\s+/g, '-')}">${room.roomType || ''}</span></td>
                <td><span class="${capacityClass}">${capacityDisplay}</span></td>
                <td>${room.daySection || 'None'}</td>
                <td>${room.nightSection || 'None'}</td>
                <td><span class="status-badge ${getStatusClass(room.status)}">${room.status || 'Available'}</span></td>
                <td class="action-cell">
                    <i class="bi bi-pencil action-link edit" onclick="openEditRoom('${room._id}')" title="Edit Room"></i>
                    <i class="bi bi-trash action-link delete" onclick="openDeleteRoom('${room._id}')" title="Delete Room"></i>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function getStatusClass(status) {
        switch (status) {
            case 'Available': return 'status-available';
            case 'Under Maintenance': return 'status-maintenance';
            case 'Occupied': return 'status-occupied';
            default: return 'status-available';
        }
    }

    // Setup capacity warning
    function setupCapacityWarning() {
        const capacityInput = document.querySelector('input[name="capacity"]');
        const roomTypeSelect = document.querySelector('select[name="roomType"]');
        const warningDiv = document.getElementById('capacityWarning');
        const warningText = document.getElementById('capacityWarningText');
        
        if (!capacityInput || !warningDiv) return;

        function checkCapacity() {
            const capacity = parseInt(capacityInput.value);
            const roomType = roomTypeSelect ? roomTypeSelect.value : '';
            
            if (!capacity || capacity <= 0) {
                warningDiv.style.display = 'none';
                return;
            }
            
            const warnings = validateCapacity(capacity, roomType);
            
            if (warnings.length > 0) {
                warningDiv.style.display = 'block';
                warningText.textContent = warnings.join(' ');
            } else {
                warningDiv.style.display = 'none';
            }
        }

        capacityInput.addEventListener('input', checkCapacity);
        if (roomTypeSelect) {
            roomTypeSelect.addEventListener('change', checkCapacity);
        }
    }

    // Form submit
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            hideModalError();
            
            const data = {
                roomName: form.roomName.value.trim(),
                building: form.building.value,
                roomType: form.roomType.value,
                capacity: parseInt(form.capacity.value) || 0,
                daySection: form.daySection.value,
                nightSection: form.nightSection.value,
                status: form.status.value
            };
            
            // Validation
            if (!data.roomName || !data.building || !data.roomType || !data.capacity) {
                showModalError("Please fill all required fields.");
                return;
            }
            
            if (data.capacity <= 0) {
                showModalError("Capacity must be greater than 0.");
                return;
            }
            
            // Check for duplicate room name
            if (checkDuplicateRoom(data.roomName, editingId)) {
                showModalError(`Room "${data.roomName}" already exists. Please use a different name.`);
                return;
            }
            
            // Validate section assignments
            if (data.daySection !== 'None' && data.nightSection !== 'None' && data.daySection === data.nightSection) {
                showModalError("Cannot assign the same section to both day and night shifts.");
                return;
            }
            
            // Capacity warnings
            const warnings = validateCapacity(data.capacity, data.roomType);
            if (warnings.length > 0 && !editMode) {
                if (!confirm(`${warnings.join(' ')} Continue anyway?`)) {
                    return;
                }
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
                    showBubbleMessage(editMode ? "Room updated successfully!" : "Room created successfully!", "success");
                    if (modal) modal.style.display = 'none';
                    if (form) form.reset();
                    hideModalError();
                    await loadAllData();
                } else {
                    showModalError(result.error || (editMode ? "Failed to update room." : "Failed to create room."));
                }
            } catch (error) {
                console.error('Error saving room:', error);
                showModalError("Network error. Please check your connection and try again.");
            }
        };
    }

    // Edit modal
    window.openEditRoom = async function(id) {
        const room = rooms.find(r => r._id === id);
        if (!room) {
            showBubbleMessage('Room not found', 'error');
            return;
        }
        
        editMode = true;
        editingId = id;
        
        hideModalError();
        
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
        
        // Setup features for edit mode
        setTimeout(() => {
            setupCapacityWarning();
        }, 100);
    };

    // Delete modal
    const deleteModal = document.getElementById('deleteRoomModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteRoomBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteRoomBtn');
    const deleteModalText = document.getElementById('deleteModalText');
    let deleteRoomId = null;

    window.openDeleteRoom = function(id) {
        const room = rooms.find(r => r._id === id);
        if (!room) {
            showBubbleMessage('Room not found', 'error');
            return;
        }

        deleteRoomId = id;
        
        if (deleteModalText) {
            deleteModalText.textContent = 
                `Are you sure you want to delete room "${room.roomName}"? This action cannot be undone.`;
        }
        
        if (deleteModal) deleteModal.style.display = 'flex';
    };

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
                    showBubbleMessage("Room deleted successfully!", "success");
                    if (deleteModal) deleteModal.style.display = 'none';
                    deleteRoomId = null;
                    await loadAllData();
                } else {
                    showBubbleMessage(result.error || "Failed to delete room.", "error");
                }
            } catch (error) {
                console.error('Error deleting room:', error);
                showBubbleMessage("Failed to delete room.", "error");
            }
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

    // Setup cascading filter dropdown
    function setupFilterDropdown() {
        const filterBtn = document.getElementById('filterBtn');
        const filterDropdown = document.getElementById('filterDropdown');
        const filterValuesDropdown = document.getElementById('filterValuesDropdown');
        
        if (!filterBtn || !filterDropdown) return;

        filterBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            filterDropdown.classList.toggle('show');
            filterValuesDropdown.classList.remove('show');
        });

        const filterOptions = filterDropdown.querySelectorAll('.filter-option');
        filterOptions.forEach(option => {
            option.addEventListener('click', function(e) {
                e.stopPropagation();
                const filterType = this.dataset.filter;
                showFilterValues(filterType);
            });
        });

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.filter-dropdown-container')) {
                filterDropdown.classList.remove('show');
                filterValuesDropdown.classList.remove('show');
            }
        });
    }

    function showFilterValues(filterType) {
        const filterValuesDropdown = document.getElementById('filterValuesDropdown');
        if (!filterValuesDropdown) return;

        let values = [];
        let labels = {};

        switch(filterType) {
            case 'building':
                values = [...new Set(rooms.map(r => r.building))].sort();
                values.forEach(v => labels[v] = v.replace('College of Technology(CoTe) Building', 'CoTe').replace('College of Education(CoEd) Building', 'CoEd'));
                break;
            case 'roomType':
                values = [...new Set(rooms.map(r => r.roomType))].sort();
                values.forEach(v => labels[v] = v);
                break;
            case 'status':
                values = ['Available', 'Occupied', 'Under Maintenance'];
                values.forEach(v => labels[v] = v);
                break;
            case 'capacity':
                values = ['small', 'medium', 'large'];
                labels = { 'small': 'Small (< 30)', 'medium': 'Medium (30-50)', 'large': 'Large (> 50)' };
                break;
        }

        filterValuesDropdown.innerHTML = values.map(value => `
            <div class="filter-value-option ${activeFilters[filterType] === value ? 'selected' : ''}" 
                 data-filter-type="${filterType}" 
                 data-value="${value}">
                ${activeFilters[filterType] === value ? '<i class="bi bi-check-circle-fill"></i>' : ''}
                ${labels[value] || value}
            </div>
        `).join('');

        filterValuesDropdown.querySelectorAll('.filter-value-option').forEach(option => {
            option.addEventListener('click', function(e) {
                e.stopPropagation();
                const type = this.dataset.filterType;
                const value = this.dataset.value;
                applyFilter(type, value);
            });
        });

        filterValuesDropdown.classList.add('show');
    }

    function applyFilter(filterType, value) {
        if (activeFilters[filterType] === value) {
            activeFilters[filterType] = null;
        } else {
            activeFilters[filterType] = value;
        }

        updateActiveFiltersDisplay();
        applyAllFilters();
        
        document.getElementById('filterDropdown').classList.remove('show');
        document.getElementById('filterValuesDropdown').classList.remove('show');
    }

    function updateActiveFiltersDisplay() {
        const container = document.getElementById('activeFilters');
        if (!container) return;

        const filterLabels = {
            building: { 
                'College of Technology(CoTe) Building': 'CoTe', 
                'College of Education(CoEd) Building': 'CoEd' 
            },
            roomType: {},
            status: { 'Available': 'Available', 'Occupied': 'Occupied', 'Under Maintenance': 'Maintenance' },
            capacity: { 'small': 'Small', 'medium': 'Medium', 'large': 'Large' }
        };

        const activeTags = Object.entries(activeFilters)
            .filter(([key, value]) => value !== null)
            .map(([key, value]) => {
                const label = filterLabels[key]?.[value] || value;
                return `
                    <div class="filter-tag">
                        <span>${label}</span>
                        <i class="bi bi-x-circle" onclick="removeFilter('${key}')"></i>
                    </div>
                `;
            });

        if (activeTags.length > 0) {
            container.innerHTML = activeTags.join('') + 
                '<button class="clear-all-filters" onclick="clearAllFilters()">Clear All</button>';
        } else {
            container.innerHTML = '';
        }

        const filterBtn = document.getElementById('filterBtn');
        const filterBtnText = document.getElementById('filterBtnText');
        if (activeTags.length > 0) {
            filterBtn.classList.add('active');
            filterBtnText.textContent = `Filtered (${activeTags.length})`;
        } else {
            filterBtn.classList.remove('active');
            filterBtnText.textContent = 'Filter By';
        }
    }

    window.removeFilter = function(filterType) {
        activeFilters[filterType] = null;
        updateActiveFiltersDisplay();
        applyAllFilters();
    };

    window.clearAllFilters = function() {
        Object.keys(activeFilters).forEach(key => activeFilters[key] = null);
        updateActiveFiltersDisplay();
        applyAllFilters();
    };

    function applyAllFilters() {
        const tbody = document.getElementById('roomsTableBody');
        if (!tbody) return;

        const rows = tbody.getElementsByTagName('tr');
        let visibleCount = 0;

        Array.from(rows).forEach(row => {
            if (row.cells.length === 1) return;

            let matches = true;

            if (activeFilters.building) {
                const buildingText = row.cells[1]?.textContent || '';
                matches = matches && buildingText === activeFilters.building;
            }

            if (activeFilters.roomType) {
                const roomTypeText = row.cells[2]?.textContent || '';
                matches = matches && roomTypeText === activeFilters.roomType;
            }

            if (activeFilters.status) {
                const statusText = row.cells[6]?.textContent || '';
                matches = matches && statusText === activeFilters.status;
            }

            if (activeFilters.capacity) {
                const capacityText = parseInt(row.cells[3]?.textContent || '0');
                if (activeFilters.capacity === 'small') {
                    matches = matches && capacityText < 30;
                } else if (activeFilters.capacity === 'medium') {
                    matches = matches && capacityText >= 30 && capacityText <= 50;
                } else if (activeFilters.capacity === 'large') {
                    matches = matches && capacityText > 50;
                }
            }

            row.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });

        const searchTerm = document.getElementById('roomsSearchInput')?.value || '';
        if (visibleCount === 0 && (Object.values(activeFilters).some(v => v !== null) || searchTerm)) {
            const existingNoResults = Array.from(rows).find(row => row.cells.length === 1);
            if (existingNoResults) existingNoResults.remove();
            
            const noResultsRow = document.createElement('tr');
            noResultsRow.innerHTML = `
                <td colspan="8" style="text-align: center; padding: 48px 24px; color: #999; font-style: italic;">
                    No rooms match the current filters. Try adjusting your filters.
                </td>
            `;
            tbody.appendChild(noResultsRow);
        }
    }

    // Setup export button
    function setupExportButton() {
        const exportBtn = document.getElementById('exportBtn');
        if (!exportBtn) return;

        exportBtn.addEventListener('click', function() {
            exportToCSV();
        });
    }

    function exportToCSV() {
        const tbody = document.getElementById('roomsTableBody');
        const rows = Array.from(tbody.getElementsByTagName('tr')).filter(row => {
            return row.cells.length > 1 && row.style.display !== 'none';
        });

        if (rows.length === 0) {
            showBubbleMessage('No rooms to export', 'error');
            return;
        }

        const headers = ['Room Name', 'Building', 'Room Type', 'Capacity', 'Day Section', 'Night Section', 'Status'];
        
        const csvData = rows.map(row => {
            return [
                row.cells[0]?.textContent || '',
                row.cells[1]?.textContent || '',
                row.cells[2]?.textContent || '',
                row.cells[3]?.textContent || '',
                row.cells[4]?.textContent || '',
                row.cells[5]?.textContent || '',
                row.cells[6]?.textContent || ''
            ].map(cell => `"${cell}"`).join(',');
        });

        const csv = [headers.join(','), ...csvData].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `rooms_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showBubbleMessage(`Exported ${rows.length} room(s) to CSV`, 'success');
    }

    // Initial load
    loadAllData();
});