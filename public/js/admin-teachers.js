// admin-teachers.js - ENHANCED VERSION WITH FIXES
import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';
import AuthGuard from './auth-guard.js';
import ProfilePictureManager from './profile-picture-manager.js';

// Prevent browser caching for this page
if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.href);
}

// Check if page was reloaded
if (performance.navigation.type === 1) {
    console.log('Page was reloaded, will force fresh data fetch');
    sessionStorage.setItem('forceRefreshTeachers', 'true');
}

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    if (!AuthGuard.checkAuthentication('admin')) {
        return;
    }

    // State management
    let teachers = [];
    let schedules = [];
    let sections = [];
    let rooms = [];
    let currentTeacherId = null;
    let currentView = 'weekly';
    let currentShift = 'all';
    let currentEditingTeacherId = null;
    
    // Initialize Profile Picture Manager
    const profilePicManager = new ProfilePictureManager({
        maxFileSize: 2 * 1024 * 1024, // 2MB
        acceptedFormats: ['image/jpeg', 'image/png', 'image/jpg'],
        onSuccess: (newPictureUrl, userId) => {
            showNotification('Profile picture updated successfully!', 'success');
            // Update the preview in edit modal
            const editPic = document.getElementById('editTeacherProfilePic');
            if (editPic) {
                editPic.src = newPictureUrl || '/img/default_teacher_avatar.png';
                // Add success indicator animation
                editPic.style.border = '3px solid #4BB543';
                setTimeout(() => {
                    editPic.style.border = '';
                }, 2000);
            }
            // Show/hide remove button
            const removeBtn = document.getElementById('removeTeacherPhotoBtn');
            if (removeBtn) {
                removeBtn.style.display = newPictureUrl ? 'inline-flex' : 'none';
            }
            // Update background gradient
            const profilePictureSection = document.querySelector('.profile-picture-section');
            if (profilePictureSection && newPictureUrl) {
                profilePictureSection.style.background = 'linear-gradient(135deg, #f8f9fb 0%, #e8f5e9 100%)';
            }
            // Reload teachers to update table
            loadTeachers(true);
        },
        onError: (errorMessage) => {
            showNotification(errorMessage, 'error');
        }
    });
    let currentDayIndex = 0;
    let teacherToDelete = null;

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

    // Load all data - UPDATED WITH FIXES
    async function loadAllData(forceRefresh = false) {
        try {
            console.log('🔄 Loading all teacher data...');
            showLoadingState(true);
            await Promise.all([
                loadTeachers(forceRefresh),
                loadSchedules(forceRefresh),
                loadSections(forceRefresh),
                loadRooms(forceRefresh)
            ]);
            console.log('✅ All data loaded successfully');
            renderTeachersTable();
            showLoadingState(false);
        } catch (error) {
            console.error('Error loading data:', error);
            showBubbleMessage('Error loading teacher data', 'error');
            showLoadingState(false);
        }
    }

    async function loadTeachers(forceRefresh = false) {
        try {
            console.log('Fetching teachers from server...');
            const url = forceRefresh ? `/teachers?_t=${Date.now()}` : `/teachers?_=${Date.now()}`;
            
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                cache: 'no-store',
                credentials: 'same-origin'
            });
            
            if (res.ok) {
                teachers = await res.json();
                console.log('✅ Teachers data received from server:', teachers.length, 'teachers');
                console.log('📊 First 3 teachers:', teachers.slice(0, 3));
            } else {
                console.error('Failed to load teachers');
                teachers = [];
            }
        } catch (error) {
            console.error('Error loading teachers:', error);
            teachers = [];
        }
    }

    async function loadSchedules(forceRefresh = false) {
        try {
            const url = forceRefresh ? `/schedules?_t=${Date.now()}` : `/schedules?_=${Date.now()}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
                cache: 'no-store'
            });
            if (res.ok) {
                schedules = await res.json();
                console.log('✅ Loaded schedules for teachers:', schedules.length, 'schedules');
            } else {
                console.error('Failed to load schedules');
                schedules = [];
            }
        } catch (error) {
            console.error('Error loading schedules:', error);
            schedules = [];
        }
    }

    async function loadSections(forceRefresh = false) {
        try {
            const url = forceRefresh ? `/sections?_t=${Date.now()}` : `/sections?_=${Date.now()}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
                cache: 'no-store'
            });
            if (res.ok) {
                sections = await res.json();
                console.log('✅ Loaded sections:', sections.length, 'sections');
            } else {
                console.error('Failed to load sections');
                sections = [];
            }
        } catch (error) {
            console.error('Error loading sections:', error);
            sections = [];
        }
    }

    async function loadRooms(forceRefresh = false) {
        try {
            const url = forceRefresh ? `/rooms?_t=${Date.now()}` : `/rooms?_=${Date.now()}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
                cache: 'no-store'
            });
            if (res.ok) {
                rooms = await res.json();
                console.log('✅ Loaded rooms:', rooms.length, 'rooms');
            } else {
                console.error('Failed to load rooms');
                rooms = [];
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
            rooms = [];
        }
    }

    // Get teacher schedules count
    function getTeacherSchedulesCount(teacherId) {
        return schedules.filter(schedule => 
            (schedule.teacher._id || schedule.teacher) === teacherId
        ).length;
    }

    // Get teacher status (active if they have schedules)
    function getTeacherStatus(teacherId) {
        const scheduleCount = getTeacherSchedulesCount(teacherId);
        return scheduleCount > 0 ? 'active' : 'inactive';
    }

    // Safe data display function
    function safeDisplay(data, fallback = 'N/A') {
        return data && data !== '' ? data : fallback;
    }

    // Update statistics cards
    function updateStatistics() {
        const totalTeachersEl = document.getElementById('totalTeachers');
        const activeTeachersEl = document.getElementById('activeTeachers');
        const inactiveTeachersEl = document.getElementById('inactiveTeachers');
        const totalTeachingHoursEl = document.getElementById('totalTeachingHours');

        if (!totalTeachersEl || !activeTeachersEl || !inactiveTeachersEl || !totalTeachingHoursEl) return;

        // Calculate statistics
        const totalTeachers = teachers.length;
        let activeCount = 0;
        let inactiveCount = 0;
        let totalHours = 0;

        teachers.forEach(teacher => {
            const status = getTeacherStatus(teacher._id);
            if (status === 'active') {
                activeCount++;
            } else {
                inactiveCount++;
            }

            // Calculate total teaching hours for this teacher
            const teacherSchedules = schedules.filter(schedule => 
                (schedule.teacher._id || schedule.teacher) === teacher._id
            );
            
            teacherSchedules.forEach(schedule => {
                if (schedule.startTime && schedule.endTime) {
                    const start = new Date(`2000-01-01 ${schedule.startTime}`);
                    const end = new Date(`2000-01-01 ${schedule.endTime}`);
                    const hours = (end - start) / (1000 * 60 * 60);
                    totalHours += hours;
                }
            });
        });

        // Update the DOM
        totalTeachersEl.textContent = totalTeachers;
        activeTeachersEl.textContent = activeCount;
        inactiveTeachersEl.textContent = inactiveCount;
        totalTeachingHoursEl.textContent = Math.round(totalHours);
    }

    // Render teachers table
    function renderTeachersTable() {
        const tbody = document.getElementById('teachersTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (teachers.length === 0) {
            showEmptyState(true);
            updateStatistics();
            return;
        }

        showEmptyState(false);

        teachers.forEach(teacher => {
            const scheduleCount = getTeacherSchedulesCount(teacher._id);
            const status = getTeacherStatus(teacher._id);
            const advisorySection = teacher.advisorySection || teacher.section || '-';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${safeDisplay(teacher.fullname)}</td>
                <td>${safeDisplay(teacher.email)}</td>
                <td>${safeDisplay(teacher.ctuid)}</td>
                <td>${safeDisplay(advisorySection)}</td>
                <td>${scheduleCount}</td>
                <td><span class="status-badge status-${status}">${status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-view" onclick="openTeacherSchedule('${teacher._id}')">
                            <i class="bi bi-eye"></i> View Schedule
                        </button>
                        <button class="btn-edit" onclick="openEditTeacher('${teacher._id}')">
                            <i class="bi bi-pencil"></i> 
                        </button>
                        <button class="btn-delete" onclick="openDeleteTeacher('${teacher._id}')">
                            <i class="bi bi-trash"></i> 
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Update statistics
        updateStatistics();

        // Apply current filters after rendering
        applyFilters();
    }

    // Combined filter function for search and status
    function applyFilters() {
        const searchTerm = document.getElementById('teacherSearch')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        const rows = document.querySelectorAll('#teachersTableBody tr');
        let hasVisibleRows = false;

        rows.forEach(row => {
            const teacherName = row.cells[0]?.textContent.toLowerCase() || '';
            const email = row.cells[1]?.textContent.toLowerCase() || '';
            const ctuid = row.cells[2]?.textContent.toLowerCase() || '';
            // cells[0]=name, cells[1]=email, cells[2]=ctuid, cells[3]=section, cells[4]=schedules, cells[5]=status
            const statusBadge = row.cells[5]?.querySelector('.status-badge');
            const teacherStatus = statusBadge ? statusBadge.textContent.toLowerCase() : '';

            const matchesSearch = teacherName.includes(searchTerm) || 
                                  email.includes(searchTerm) || 
                                  ctuid.includes(searchTerm);
            const matchesStatus = !statusFilter || teacherStatus === statusFilter;

            const matchesAll = matchesSearch && matchesStatus;

            row.style.display = matchesAll ? '' : 'none';
            if (matchesAll) hasVisibleRows = true;
        });

        showEmptyState(!hasVisibleRows && teachers.length > 0);
    }

    // Open teacher schedule modal
    window.openTeacherSchedule = function(teacherId) {
        currentTeacherId = teacherId;
        const teacher = teachers.find(t => t._id === teacherId);
        
        if (!teacher) {
            showBubbleMessage('Teacher not found', 'error');
            return;
        }

        // Update modal teacher info with safe display
        const modalTeacherName = document.getElementById('modalTeacherName');
        const modalTeacherEmail = document.getElementById('modalTeacherEmail');
        const modalTeacherId = document.getElementById('modalTeacherId');
        const modalAdvisorySection = document.getElementById('modalAdvisorySection');
        const teacherScheduleTitle = document.getElementById('teacherScheduleTitle');
        
        if (modalTeacherName) modalTeacherName.textContent = safeDisplay(teacher.fullname);
        if (modalTeacherEmail) modalTeacherEmail.textContent = safeDisplay(teacher.email);
        if (modalTeacherId) modalTeacherId.textContent = safeDisplay(teacher.ctuid);
        if (modalAdvisorySection) modalAdvisorySection.textContent = safeDisplay(teacher.advisorySection || teacher.section, 'Not assigned');
        if (teacherScheduleTitle) teacherScheduleTitle.textContent = `${safeDisplay(teacher.fullname)}'s Schedule`;

        // Load teacher avatar if available
        const avatar = document.getElementById('modalTeacherAvatar');
        if (avatar && teacher.profilePicture && teacher.profilePicture !== '') {
            avatar.src = teacher.profilePicture.startsWith('http') 
                ? teacher.profilePicture 
                : teacher.profilePicture;
        } else if (avatar) {
            avatar.src = '/img/default_teacher_avatar.png';
        }

        // Render schedule
        renderTeacherSchedule(teacherId);
        
        // Show modal
        const scheduleModal = document.getElementById('teacherScheduleModal');
        if (scheduleModal) scheduleModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    // Open edit teacher modal
    window.openEditTeacher = async function(teacherId) {
        const teacher = teachers.find(t => t._id === teacherId);
        
        if (!teacher) {
            showBubbleMessage('Teacher not found', 'error');
            return;
        }

        // Store current editing teacher ID
        currentEditingTeacherId = teacherId;

        // Populate form with teacher data
        const editFullName = document.getElementById('editFullName');
        const editEmail = document.getElementById('editEmail');
        const editCtuid = document.getElementById('editCtuid');
        const editBirthdate = document.getElementById('editBirthdate');
        const editGender = document.getElementById('editGender');
        const editSection = document.getElementById('editSection');
        const editRoom = document.getElementById('editRoom');
        const editTeacherModalTitle = document.getElementById('editTeacherModalTitle');
        
        // Populate profile picture with enhanced visibility
        const editTeacherProfilePic = document.getElementById('editTeacherProfilePic');
        const removeTeacherPhotoBtn = document.getElementById('removeTeacherPhotoBtn');
        const profilePictureSection = document.querySelector('.profile-picture-section');
        
        if (editTeacherProfilePic) {
            // Show loading state
            editTeacherProfilePic.style.opacity = '0.5';
            
            // Set the image source
            const imageUrl = teacher.profilePicture || '/img/default_teacher_avatar.png';
            editTeacherProfilePic.src = imageUrl;
            
            // Handle image load success
            editTeacherProfilePic.onload = function() {
                this.style.opacity = '1';
                this.style.transition = 'opacity 0.3s ease';
                console.log('✅ Profile picture loaded successfully');
            };
            
            // Handle image load error
            editTeacherProfilePic.onerror = function() {
                console.error('❌ Failed to load profile picture');
                this.src = '/img/default_teacher_avatar.png';
                this.style.opacity = '1';
                showNotification('Profile picture failed to load. Showing default image.', 'warning');
            };
        }
        
        // Show/hide remove button based on whether teacher has a profile picture
        if (removeTeacherPhotoBtn) {
            removeTeacherPhotoBtn.style.display = teacher.profilePicture ? 'inline-flex' : 'none';
        }
        
        // Add visual indicator if profile picture exists
        if (profilePictureSection && teacher.profilePicture) {
            profilePictureSection.style.background = 'linear-gradient(135deg, #f8f9fb 0%, #e8f5e9 100%)';
        } else if (profilePictureSection) {
            profilePictureSection.style.background = 'linear-gradient(135deg, #f8f9fb 0%, #ffffff 100%)';
        }
        
        if (editFullName) editFullName.value = safeDisplay(teacher.fullname, '');
        if (editEmail) editEmail.value = safeDisplay(teacher.email, '');
        if (editCtuid) editCtuid.value = safeDisplay(teacher.ctuid, '');
        if (editBirthdate) editBirthdate.value = safeDisplay(teacher.birthdate, '');
        if (editGender) editGender.value = safeDisplay(teacher.gender, '');

        // Populate Section dropdown - fetch available sections from server
        if (editSection) {
            editSection.innerHTML = '<option value="">Loading sections...</option>';
            editSection.disabled = true;
            
            // Get the current teacher's advisory section
            const currentTeacherSection = teacher.advisorySection || teacher.section;
            
            console.log('📋 Fetching available sections for edit modal:');
            console.log('   Current teacher ID:', teacher._id);
            console.log('   Current teacher section:', currentTeacherSection);
            
            try {
                // Fetch available sections from the new API endpoint
                const response = await fetch(`/sections/available-for-advisory?teacherId=${teacher._id}&_t=${Date.now()}`, {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    },
                    cache: 'no-store'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const availableSections = data.availableSections || [];
                    
                    console.log(`✅ Received ${availableSections.length} available sections from server`);
                    console.log(`   Total sections: ${data.totalSections}`);
                    console.log(`   Assigned sections: ${data.assignedSections}`);
                    console.log(`   Current teacher section: ${data.currentTeacherSection || 'none'}`);
                    
                    // Clear and repopulate dropdown
                    editSection.innerHTML = '<option value="">No Advisory Section</option>';
                    
                    if (availableSections.length === 0) {
                        // No sections available
                        const option = document.createElement('option');
                        option.value = '';
                        option.textContent = 'No sections available for assignment';
                        option.disabled = true;
                        editSection.appendChild(option);
                        
                        // Show info message if teacher doesn't have a current section
                        if (!currentTeacherSection) {
                            showBubbleMessage('All sections currently have assigned advisers', 'info');
                        }
                    } else {
                        // Add info option at the top
                        const infoOption = document.createElement('option');
                        infoOption.value = '';
                        infoOption.textContent = `--- ${availableSections.length} Available Section${availableSections.length !== 1 ? 's' : ''} ---`;
                        infoOption.disabled = true;
                        infoOption.style.fontWeight = 'bold';
                        infoOption.style.color = '#3E8EDE';
                        editSection.appendChild(infoOption);
                        
                        // Populate with available sections
                        availableSections.forEach(section => {
                            const option = document.createElement('option');
                            option.value = section.sectionName;
                            
                            // Add indicator if this is the current teacher's section
                            const isCurrentSection = section.sectionName === currentTeacherSection;
                            const currentIndicator = isCurrentSection ? ' ✓ Current' : '';
                            const availableIndicator = !isCurrentSection ? ' ✓ Available' : '';
                            
                            option.textContent = `${section.sectionName} (Year ${section.yearLevel} - ${section.shift})${currentIndicator}${availableIndicator}`;
                            
                            // Style current section differently
                            if (isCurrentSection) {
                                option.style.fontWeight = 'bold';
                                option.style.backgroundColor = '#e8f5e9';
                            }
                            
                            editSection.appendChild(option);
                            
                            console.log(`   ✅ Available: ${section.sectionName}${currentIndicator}`);
                        });
                    }
                    
                    // Set the current value
                    editSection.value = safeDisplay(currentTeacherSection, '');
                    editSection.disabled = false;
                    
                } else {
                    console.error('❌ Failed to fetch available sections');
                    editSection.innerHTML = '<option value="">Error loading sections</option>';
                    editSection.disabled = false;
                    showBubbleMessage('Failed to load available sections', 'error');
                }
            } catch (error) {
                console.error('❌ Error fetching available sections:', error);
                editSection.innerHTML = '<option value="">Error loading sections</option>';
                editSection.disabled = false;
                showBubbleMessage('Error loading sections. Please try again.', 'error');
            }
        }

        // Populate Room dropdown
        if (editRoom) {
            editRoom.innerHTML = '<option value="">No Room Assigned</option>';
            rooms.forEach(room => {
                const option = document.createElement('option');
                option.value = room.roomName;
                option.textContent = `${room.roomName} (${room.building})`;
                editRoom.appendChild(option);
            });
            editRoom.value = safeDisplay(teacher.room, '');
        }

        // Show and populate the teacher info display
        const infoDisplay = document.getElementById('teacherInfoDisplay');
        if (infoDisplay) {
            const advisorySection = teacher.advisorySection || teacher.section;
            
            if (advisorySection) {
                infoDisplay.style.display = 'block';
                
                // Find the section object to get year level and shift
                const sectionObj = sections.find(s => s.sectionName === advisorySection);
                
                // Populate Year Level
                const yearLevelEl = document.getElementById('displayTeacherYearLevel');
                if (yearLevelEl) {
                    const yearLevel = sectionObj?.yearLevel || 'N/A';
                    yearLevelEl.textContent = yearLevel !== 'N/A' ? `Year ${yearLevel}` : 'N/A';
                }
                
                // Populate Advisory Section
                const sectionEl = document.getElementById('displayTeacherSection');
                if (sectionEl) {
                    const shift = sectionObj?.shift || '';
                    sectionEl.textContent = shift ? `${advisorySection} (${shift} Shift)` : advisorySection;
                }
                
                // Populate Room
                const roomEl = document.getElementById('displayTeacherRoom');
                if (roomEl) {
                    if (teacher.room) {
                        const roomObj = rooms.find(r => r.roomName === teacher.room);
                        const roomType = roomObj?.roomType || '';
                        roomEl.textContent = roomType ? `${teacher.room} (${roomType})` : teacher.room;
                    } else {
                        roomEl.textContent = 'No Room Assigned';
                    }
                }
                
                // Populate Building
                const buildingEl = document.getElementById('displayTeacherBuilding');
                if (buildingEl) {
                    if (teacher.room) {
                        const roomObj = rooms.find(r => r.roomName === teacher.room);
                        const building = roomObj?.building || 'N/A';
                        buildingEl.textContent = building;
                    } else {
                        buildingEl.textContent = 'N/A';
                    }
                }
                
                console.log('✅ Teacher info display populated:', {
                    yearLevel: sectionObj?.yearLevel,
                    section: advisorySection,
                    room: teacher.room,
                    building: rooms.find(r => r.roomName === teacher.room)?.building
                });
            } else {
                // Hide info display if teacher has no advisory section
                infoDisplay.style.display = 'none';
            }
        }

        // Add event listeners for auto-sync between Section and Room with validation
        if (editSection && editRoom) {
            // When section changes, auto-fill corresponding room and validate
            editSection.addEventListener('change', async function() {
                const selectedSection = this.value;
                
                // Remove any previous validation styling
                this.style.borderColor = '';
                
                if (selectedSection) {
                    // Validate that this section is still available (real-time check)
                    try {
                        const response = await fetch(`/sections/available-for-advisory?teacherId=${teacher._id}&_t=${Date.now()}`, {
                            method: 'GET',
                            headers: {
                                'Cache-Control': 'no-cache',
                                'Pragma': 'no-cache'
                            },
                            cache: 'no-store'
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            const isAvailable = data.availableSections.some(s => s.sectionName === selectedSection);
                            
                            if (!isAvailable && selectedSection !== (teacher.advisorySection || teacher.section)) {
                                // Section is no longer available
                                this.style.borderColor = '#d8000c';
                                showBubbleMessage(`Warning: Section ${selectedSection} may have been assigned to another teacher`, 'warning');
                            } else {
                                this.style.borderColor = '#4BB543';
                                setTimeout(() => {
                                    this.style.borderColor = '';
                                }, 2000);
                            }
                        }
                    } catch (error) {
                        console.warn('Could not validate section availability:', error);
                    }
                    
                    // Find room where this section is assigned
                    const assignedRoom = rooms.find(room => 
                        room.daySection === selectedSection || room.nightSection === selectedSection
                    );
                    if (assignedRoom) {
                        editRoom.value = assignedRoom.roomName;
                        console.log(`✅ Auto-filled room: ${assignedRoom.roomName} for section: ${selectedSection}`);
                    } else {
                        console.log(`⚠️ No room found for section: ${selectedSection}`);
                    }
                } else {
                    // If no section selected, clear room
                    editRoom.value = '';
                }
            });

            // When room changes, auto-fill corresponding section
            editRoom.addEventListener('change', function() {
                const selectedRoom = this.value;
                if (selectedRoom) {
                    // Find the room object
                    const roomObj = rooms.find(room => room.roomName === selectedRoom);
                    if (roomObj) {
                        // Check if current section value matches either daySection or nightSection
                        const currentSection = editSection.value;
                        
                        // If current section doesn't match room's sections, update it
                        if (roomObj.daySection && roomObj.daySection !== 'None' && 
                            roomObj.daySection !== currentSection) {
                            editSection.value = roomObj.daySection;
                            console.log(`✅ Auto-filled section: ${roomObj.daySection} for room: ${selectedRoom}`);
                        } else if (roomObj.nightSection && roomObj.nightSection !== 'None' && 
                                   roomObj.nightSection !== currentSection) {
                            editSection.value = roomObj.nightSection;
                            console.log(`✅ Auto-filled section: ${roomObj.nightSection} for room: ${selectedRoom}`);
                        }
                    }
                } else {
                    // If no room selected, clear section
                    editSection.value = '';
                }
            });
        }

        // Set current teacher ID for form submission
        currentTeacherId = teacherId;
        if (editTeacherModalTitle) editTeacherModalTitle.textContent = `Edit ${safeDisplay(teacher.fullname)}`;

        // Show modal
        const editModal = document.getElementById('editTeacherModal');
        if (editModal) editModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    // Open delete teacher modal
    window.openDeleteTeacher = function(teacherId) {
        const teacher = teachers.find(t => t._id === teacherId);
        
        if (!teacher) {
            showBubbleMessage('Teacher not found', 'error');
            return;
        }

        teacherToDelete = teacher;
        const scheduleCount = getTeacherSchedulesCount(teacherId);

        // Update confirmation text
        const deleteConfirmationText = document.getElementById('deleteConfirmationText');
        if (deleteConfirmationText) {
            deleteConfirmationText.textContent = 
                `Are you sure you want to delete ${safeDisplay(teacher.fullname)}? This action cannot be undone.`;
        }
        
        // Update schedule count warning
        const scheduleWarning = document.getElementById('scheduleCountWarning');
        if (scheduleWarning) scheduleWarning.textContent = scheduleCount;
        
        // Show/hide warning based on schedule count
        const warningInfo = document.querySelector('.teacher-warning-info');
        if (warningInfo) warningInfo.style.display = scheduleCount > 0 ? 'block' : 'none';

        // Show modal
        const deleteModal = document.getElementById('deleteTeacherModal');
        if (deleteModal) deleteModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    // ==================== ADD TEACHER ====================
    
    // Open Add Teacher Modal
    const addTeacherBtn = document.getElementById('addTeacherBtn');
    if (addTeacherBtn) {
        addTeacherBtn.addEventListener('click', function() {
            const addTeacherModal = document.getElementById('addTeacherModal');
            if (addTeacherModal) {
                addTeacherModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
                
                // Populate sections and rooms dropdowns
                populateAddTeacherSections();
                populateAddTeacherRooms();
            }
        });
    }
    
    // Close Add Teacher Modal
    const closeAddTeacherModal = document.getElementById('closeAddTeacherModal');
    const cancelAddTeacher = document.getElementById('cancelAddTeacher');
    
    if (closeAddTeacherModal) {
        closeAddTeacherModal.addEventListener('click', closeAddTeacherModalFunc);
    }
    if (cancelAddTeacher) {
        cancelAddTeacher.addEventListener('click', closeAddTeacherModalFunc);
    }
    
    function closeAddTeacherModalFunc() {
        const addTeacherModal = document.getElementById('addTeacherModal');
        if (addTeacherModal) {
            addTeacherModal.style.display = 'none';
            document.body.style.overflow = 'auto';
            
            // Reset form
            const addTeacherForm = document.getElementById('addTeacherForm');
            if (addTeacherForm) addTeacherForm.reset();
            
            // Reset profile preview
            const preview = document.getElementById('addTeacherProfilePreview');
            if (preview) preview.src = './img/default_teacher_avatar.png';
        }
    }
    
    // Populate sections dropdown for Add Teacher
    function populateAddTeacherSections() {
        const select = document.getElementById('addTeacherSection');
        if (!select) return;
        
        select.innerHTML = '<option value="">No Advisory Section</option>';
        
        // Filter sections to only show those without advisers
        sections.forEach(section => {
            // Check if this section already has an adviser using multiple methods:
            // 1. Check section's adviserTeacher field
            // 2. Check if any teacher has this section as their advisorySection
            const sectionHasAdviserField = section.adviserTeacher && section.adviserTeacher !== '';
            const hasAdviserFromTeachers = teachers.some(t => 
                t.advisorySection === section.sectionName || t.section === section.sectionName
            );
            
            const hasAdviser = sectionHasAdviserField || hasAdviserFromTeachers;
            
            // Only show section if it has no adviser
            if (!hasAdviser) {
                const option = document.createElement('option');
                option.value = section.sectionName;
                option.textContent = `${section.sectionName} (${section.shift})`;
                select.appendChild(option);
            }
        });
    }
    
    // Populate rooms dropdown for Add Teacher
    function populateAddTeacherRooms() {
        const select = document.getElementById('addTeacherRoom');
        if (!select) return;
        
        select.innerHTML = '<option value="">No Room Assigned</option>';
        rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room.roomName;
            option.textContent = `${room.roomName} - ${room.building}`;
            select.appendChild(option);
        });
    }
    
    // Profile picture preview for Add Teacher
    const addTeacherProfilePicture = document.getElementById('addTeacherProfilePicture');
    if (addTeacherProfilePicture) {
        addTeacherProfilePicture.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.getElementById('addTeacherProfilePreview');
                    if (preview) preview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Add Teacher Form Submission
    const addTeacherForm = document.getElementById('addTeacherForm');
    if (addTeacherForm) {
        addTeacherForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const fullname = document.getElementById('addTeacherFullName')?.value.trim();
            const email = document.getElementById('addTeacherEmail')?.value.trim();
            const ctuid = document.getElementById('addTeacherCtuid')?.value.trim();
            const birthdate = document.getElementById('addTeacherBirthdate')?.value;
            const gender = document.getElementById('addTeacherGender')?.value;
            const section = document.getElementById('addTeacherSection')?.value;
            const room = document.getElementById('addTeacherRoom')?.value;
            const profilePictureInput = document.getElementById('addTeacherProfilePicture');
            
            // Basic validation
            if (!fullname || !email || !ctuid) {
                showBubbleMessage('Please fill in all required fields', 'error');
                return;
            }
            
            const registerData = {
                fullname,
                email,
                ctuid,
                userrole: 'teacher',
                password: ctuid, // Default password is CTU ID
                birthdate: birthdate || '',
                gender: gender || '',
                section: section || '',
                room: room || ''
            };
            
            try {
                const res = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(registerData)
                });
                
                const result = await res.json();
                
                if (res.ok) {
                    // Upload profile picture if selected
                    if (profilePictureInput?.files[0] && result.user?._id) {
                        const formData = new FormData();
                        formData.append('profilePicture', profilePictureInput.files[0]);
                        try {
                            await fetch(`/upload-profile-picture/${result.user._id}`, {
                                method: 'POST',
                                body: formData
                            });
                        } catch (uploadError) {
                            console.warn('Profile picture upload failed:', uploadError);
                        }
                    }
                    
                    showBubbleMessage('Teacher added successfully!', 'success');
                    closeAddTeacherModalFunc();
                    
                    console.log('🔄 Forcing data refresh after teacher creation...');
                    
                    // Wait for database to sync
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Force reload with aggressive cache busting
                    await loadAllData(true);
                    
                    console.log('✅ Data refresh complete. Total teachers now:', teachers.length);
                } else {
                    showBubbleMessage(result.error || 'Failed to add teacher', 'error');
                }
            } catch (error) {
                console.error('Error adding teacher:', error);
                showBubbleMessage('Failed to add teacher. Please try again.', 'error');
            }
        });
    }

    // Edit teacher form submission - FIXED VERSION
    const editTeacherForm = document.getElementById('editTeacherForm');
    if (editTeacherForm) {
        editTeacherForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                fullname: document.getElementById('editFullName').value,
                email: document.getElementById('editEmail').value,
                ctuid: document.getElementById('editCtuid').value,
                birthdate: document.getElementById('editBirthdate').value,
                gender: document.getElementById('editGender').value,
                section: document.getElementById('editSection').value,
                room: document.getElementById('editRoom').value
            };

            console.log('Submitting teacher update:', formData); // Debug log

            // Basic validation
            if (!formData.fullname || !formData.email || !formData.ctuid) {
                showBubbleMessage('Please fill in all required fields', 'error');
                return;
            }

            try {
                const res = await fetch(`/user/${currentTeacherId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                if (res.ok) {
                    const result = await res.json();
                    const updatedTeacher = result.user || result; // Handle both response formats
                    
                    console.log('✅ Teacher updated:', updatedTeacher);
                    
                    showBubbleMessage('Teacher updated successfully!', 'success');
                    const editModal = document.getElementById('editTeacherModal');
                    if (editModal) editModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                    
                    console.log('🔄 Forcing data refresh after teacher update...');
                    
                    // Wait for database to sync
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Force reload with aggressive cache busting
                    await loadAllData(true);
                    
                    console.log('✅ Data refresh complete. Total teachers now:', teachers.length);
                } else {
                    const error = await res.json();
                    showBubbleMessage(error.error || 'Failed to update teacher', 'error');
                }
            } catch (error) {
                console.error('Error updating teacher:', error);
                showBubbleMessage('Failed to update teacher', 'error');
            }
        });
    }

    // Delete teacher confirmation
    const confirmDeleteTeacher = document.getElementById('confirmDeleteTeacher');
    if (confirmDeleteTeacher) {
        confirmDeleteTeacher.addEventListener('click', async function() {
            if (!teacherToDelete) return;

            try {
                const res = await fetch(`/user/${teacherToDelete._id}`, {
                    method: 'DELETE'
                });

                if (res.ok) {
                    showBubbleMessage('Teacher deleted successfully!', 'success');
                    const deleteModal = document.getElementById('deleteTeacherModal');
                    if (deleteModal) deleteModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                    
                    console.log('🔄 Forcing data refresh after teacher deletion...');
                    
                    // Wait for database to sync
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Force reload with aggressive cache busting
                    await loadAllData(true);
                    
                    console.log('✅ Data refresh complete. Total teachers now:', teachers.length);
                } else {
                    const error = await res.json();
                    showBubbleMessage(error.error || 'Failed to delete teacher', 'error');
                }
            } catch (error) {
                console.error('Error deleting teacher:', error);
                showBubbleMessage('Failed to delete teacher', 'error');
            }
        });
    }

    // Close modals
    const closeTeacherScheduleModal = document.getElementById('closeTeacherScheduleModal');
    if (closeTeacherScheduleModal) {
        closeTeacherScheduleModal.addEventListener('click', function() {
            const modal = document.getElementById('teacherScheduleModal');
            if (modal) modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }

    // Profile Picture Button Event Listeners
    const changeTeacherPhotoBtn = document.getElementById('changeTeacherPhotoBtn');
    if (changeTeacherPhotoBtn) {
        changeTeacherPhotoBtn.addEventListener('click', function() {
            if (currentEditingTeacherId) {
                const teacher = teachers.find(t => t._id === currentEditingTeacherId);
                if (teacher) {
                    profilePicManager.open(
                        currentEditingTeacherId,
                        teacher.profilePicture,
                        'teacher'
                    );
                }
            }
        });
    }

    const editTeacherPicOverlay = document.getElementById('editTeacherPicOverlay');
    if (editTeacherPicOverlay) {
        editTeacherPicOverlay.addEventListener('click', function() {
            if (currentEditingTeacherId) {
                const teacher = teachers.find(t => t._id === currentEditingTeacherId);
                if (teacher) {
                    profilePicManager.open(
                        currentEditingTeacherId,
                        teacher.profilePicture,
                        'teacher'
                    );
                }
            }
        });
    }

    const removeTeacherPhotoBtn = document.getElementById('removeTeacherPhotoBtn');
    if (removeTeacherPhotoBtn) {
        removeTeacherPhotoBtn.addEventListener('click', async function() {
            if (!currentEditingTeacherId) return;
            
            if (confirm('Are you sure you want to remove this profile picture? The default avatar will be restored.')) {
                try {
                    // Show loading state
                    const editPic = document.getElementById('editTeacherProfilePic');
                    if (editPic) {
                        editPic.style.opacity = '0.5';
                    }
                    
                    const response = await fetch(`/delete-profile-picture/${currentEditingTeacherId}`, {
                        method: 'DELETE'
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        showNotification('Profile picture removed successfully!', 'success');
                        // Update preview with animation
                        if (editPic) {
                            editPic.src = '/img/default_teacher_avatar.png';
                            editPic.style.opacity = '1';
                            editPic.style.border = '3px solid #4BB543';
                            setTimeout(() => {
                                editPic.style.border = '';
                            }, 2000);
                        }
                        // Hide remove button
                        removeTeacherPhotoBtn.style.display = 'none';
                        // Update background
                        const profilePictureSection = document.querySelector('.profile-picture-section');
                        if (profilePictureSection) {
                            profilePictureSection.style.background = 'linear-gradient(135deg, #f8f9fb 0%, #ffffff 100%)';
                        }
                        // Reload teachers
                        loadTeachers(true);
                    } else {
                        throw new Error(result.error || 'Failed to remove profile picture');
                    }
                } catch (error) {
                    console.error('Error removing profile picture:', error);
                    showNotification(error.message || 'Failed to remove profile picture', 'error');
                    // Reset opacity on error
                    const editPic = document.getElementById('editTeacherProfilePic');
                    if (editPic) {
                        editPic.style.opacity = '1';
                    }
                }
            }
        });
    }

    const closeEditTeacherModal = document.getElementById('closeEditTeacherModal');
    if (closeEditTeacherModal) {
        closeEditTeacherModal.addEventListener('click', function() {
            const modal = document.getElementById('editTeacherModal');
            if (modal) modal.style.display = 'none';
            // Hide teacher info display
            const infoDisplay = document.getElementById('teacherInfoDisplay');
            if (infoDisplay) infoDisplay.style.display = 'none';
            currentEditingTeacherId = null;
            document.body.style.overflow = 'auto';
        });
    }

    const cancelEditTeacher = document.getElementById('cancelEditTeacher');
    if (cancelEditTeacher) {
        cancelEditTeacher.addEventListener('click', function() {
            const modal = document.getElementById('editTeacherModal');
            if (modal) modal.style.display = 'none';
            // Hide teacher info display
            const infoDisplay = document.getElementById('teacherInfoDisplay');
            if (infoDisplay) infoDisplay.style.display = 'none';
            currentEditingTeacherId = null;
            document.body.style.overflow = 'auto';
        });
    }

    const closeDeleteTeacherModal = document.getElementById('closeDeleteTeacherModal');
    if (closeDeleteTeacherModal) {
        closeDeleteTeacherModal.addEventListener('click', function() {
            const modal = document.getElementById('deleteTeacherModal');
            if (modal) modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }

    const cancelDeleteTeacher = document.getElementById('cancelDeleteTeacher');
    if (cancelDeleteTeacher) {
        cancelDeleteTeacher.addEventListener('click', function() {
            const modal = document.getElementById('deleteTeacherModal');
            if (modal) modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }

    // Close modals when clicking outside
    const teacherScheduleModal = document.getElementById('teacherScheduleModal');
    if (teacherScheduleModal) {
        teacherScheduleModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }

    const editTeacherModal = document.getElementById('editTeacherModal');
    if (editTeacherModal) {
        editTeacherModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }

    const deleteTeacherModal = document.getElementById('deleteTeacherModal');
    if (deleteTeacherModal) {
        deleteTeacherModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }

    // Render teacher schedule
    function renderTeacherSchedule(teacherId) {
        const teacherSchedules = schedules.filter(schedule => 
            (schedule.teacher._id || schedule.teacher) === teacherId
        );

        // Calculate statistics
        calculateScheduleStatistics(teacherSchedules);

        // Render based on current view
        if (currentView === 'weekly') {
            renderWeeklySchedule(teacherSchedules);
        } else {
            renderDailySchedule(teacherSchedules);
        }
    }

    // Calculate schedule statistics
    function calculateScheduleStatistics(teacherSchedules) {
        let lectureHours = 0;
        let labHours = 0;

        teacherSchedules.forEach(schedule => {
            const duration = calculateScheduleDuration(schedule);
            if (schedule.scheduleType === 'lecture') {
                lectureHours += duration;
            } else if (schedule.scheduleType === 'lab') {
                labHours += duration;
            }
        });

        const lectureCount = document.getElementById('lectureCount');
        const labCount = document.getElementById('labCount');
        const totalHours = document.getElementById('totalHours');
        
        if (lectureCount) lectureCount.textContent = lectureHours.toFixed(1);
        if (labCount) labCount.textContent = labHours.toFixed(1);
        if (totalHours) totalHours.textContent = (lectureHours + labHours).toFixed(1);
    }

    // Calculate schedule duration (reuse from schedules.js)
    function calculateScheduleDuration(schedule) {
        let [startH, startM] = schedule.startTime.split(':').map(Number);
        let [endH, endM] = schedule.endTime.split(':').map(Number);

        if (schedule.startPeriod === 'PM' && startH !== 12) startH += 12;
        if (schedule.startPeriod === 'AM' && startH === 12) startH = 0;
        if (schedule.endPeriod === 'PM' && endH !== 12) endH += 12;
        if (schedule.endPeriod === 'AM' && endH === 12) endH = 0;

        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        return (endMinutes - startMinutes) / 60;
    }

    // Render weekly schedule
    function renderWeeklySchedule(teacherSchedules) {
        const weeklyGrid = document.getElementById('weeklyGrid');
        if (!weeklyGrid) return;
        
        weeklyGrid.innerHTML = '';

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        // Get current day for highlighting
        const today = new Date();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = dayNames[today.getDay()];
        
        days.forEach(day => {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'weekly-day';
            
            // Add 'is-today' class if this is the current day
            if (day === currentDay) {
                dayDiv.classList.add('is-today');
            }
            
            dayDiv.innerHTML = `<h5>${day}</h5>`;

            const daySchedules = teacherSchedules.filter(schedule => 
                schedule.day === day && 
                (currentShift === 'all' || schedule.section.shift.toLowerCase() === currentShift)
            );

            // Sort by start time
            daySchedules.sort((a, b) => {
                let aStart = parseInt(a.startTime.replace(':', ''));
                if (a.startPeriod === 'PM' && aStart < 1200) aStart += 1200;
                let bStart = parseInt(b.startTime.replace(':', ''));
                if (b.startPeriod === 'PM' && bStart < 1200) bStart += 1200;
                return aStart - bStart;
            });

            if (daySchedules.length === 0) {
                dayDiv.innerHTML += '<div class="empty-schedule"><i class="bi bi-calendar-x"></i><p>No classes</p></div>';
            } else {
                daySchedules.forEach(schedule => {
                    const item = document.createElement('div');
                    item.className = `schedule-item-small ${schedule.scheduleType || 'lecture'}`;
                    
                    const timeDisplay = `${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}`;
                    item.innerHTML = `
                        <div><strong>${safeDisplay(schedule.subject.courseCode)}</strong></div>
                        <div class="time-badge">${timeDisplay}</div>
                        <div style="font-size: 0.85em; margin-top: 4px;">${safeDisplay(schedule.section.sectionName)}</div>
                        <div style="font-size: 0.85em;">${safeDisplay(schedule.room.roomName)}</div>
                    `;
                    
                    item.title = `${safeDisplay(schedule.subject.courseCode)} - ${safeDisplay(schedule.section.sectionName)} (${safeDisplay(schedule.room.roomName)})`;
                    dayDiv.appendChild(item);
                });
            }

            weeklyGrid.appendChild(dayDiv);
        });
    }

    // Render daily schedule
    function renderDailySchedule(teacherSchedules) {
        const dailySchedule = document.getElementById('dailySchedule');
        if (!dailySchedule) return;
        
        dailySchedule.innerHTML = '';

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[currentDayIndex];
        
        const currentDayDisplay = document.getElementById('currentDayDisplay');
        if (currentDayDisplay) currentDayDisplay.textContent = currentDay;

        const daySchedules = teacherSchedules.filter(schedule => 
            schedule.day === currentDay && 
            (currentShift === 'all' || schedule.section.shift.toLowerCase() === currentShift)
        );

        // Sort by start time
        daySchedules.sort((a, b) => {
            let aStart = parseInt(a.startTime.replace(':', ''));
            if (a.startPeriod === 'PM' && aStart < 1200) aStart += 1200;
            let bStart = parseInt(b.startTime.replace(':', ''));
            if (b.startPeriod === 'PM' && bStart < 1200) bStart += 1200;
            return aStart - bStart;
        });

        if (daySchedules.length === 0) {
            dailySchedule.innerHTML = `
                <div class="empty-schedule">
                    <i class="bi bi-calendar-x"></i>
                    <p>No schedules for ${currentDay}</p>
                </div>
            `;
            return;
        }

        daySchedules.forEach(schedule => {
            const item = document.createElement('div');
            item.className = `daily-schedule-item ${schedule.scheduleType}`;
            
            const timeDisplay = `${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}`;
            item.innerHTML = `
                <div class="schedule-time">${timeDisplay}</div>
                <div class="schedule-details">
                    <div class="schedule-subject">${safeDisplay(schedule.subject.courseCode)} - ${safeDisplay(schedule.subject.descriptiveTitle)}</div>
                    <div class="schedule-meta">${safeDisplay(schedule.room.roomName)} • ${schedule.scheduleType.charAt(0).toUpperCase() + schedule.scheduleType.slice(1)}</div>
                </div>
                <div class="schedule-section">${safeDisplay(schedule.section.sectionName)}</div>
            `;
            
            dailySchedule.appendChild(item);
        });
    }

    // View toggle
    const scheduleViewSelect = document.getElementById('scheduleViewSelect');
    if (scheduleViewSelect) {
        scheduleViewSelect.addEventListener('change', function() {
            currentView = this.value;
            updateScheduleView();
        });
    }

    function updateScheduleView() {
        const weeklyView = document.getElementById('weeklyScheduleView');
        const dailyView = document.getElementById('dailyScheduleView');

        if (currentView === 'weekly') {
            if (weeklyView) weeklyView.style.display = 'block';
            if (dailyView) dailyView.style.display = 'none';
        } else {
            if (weeklyView) weeklyView.style.display = 'none';
            if (dailyView) dailyView.style.display = 'block';
        }

        if (currentTeacherId) {
            renderTeacherSchedule(currentTeacherId);
        }
    }

    // Shift toggle
    document.querySelectorAll('.shift-btn-small').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.shift-btn-small').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentShift = this.dataset.shift;
            
            if (currentTeacherId) {
                renderTeacherSchedule(currentTeacherId);
            }
        });
    });

    // Daily navigation
    const prevDayBtn = document.getElementById('prevDayBtn');
    if (prevDayBtn) {
        prevDayBtn.addEventListener('click', function() {
            currentDayIndex = (currentDayIndex - 1 + 6) % 6;
            if (currentTeacherId) {
                renderTeacherSchedule(currentTeacherId);
            }
        });
    }

    const nextDayBtn = document.getElementById('nextDayBtn');
    if (nextDayBtn) {
        nextDayBtn.addEventListener('click', function() {
            currentDayIndex = (currentDayIndex + 1) % 6;
            if (currentTeacherId) {
                renderTeacherSchedule(currentTeacherId);
            }
        });
    }

    // Search and status filter listeners (both call applyFilters)
    // Populate filter dropdowns
    function populateFilterDropdowns() {
        // Populate section filter
        const sectionFilter = document.getElementById('sectionFilter');
        if (sectionFilter) {
            sectionFilter.innerHTML = '<option value="">All Advisory Sections</option>';
            const uniqueSections = [...new Set(teachers.map(t => t.section).filter(s => s))];
            uniqueSections.sort().forEach(sectionName => {
                const option = document.createElement('option');
                option.value = sectionName;
                option.textContent = sectionName;
                sectionFilter.appendChild(option);
            });
        }
        
        // Populate room filter
        const roomFilter = document.getElementById('roomFilter');
        if (roomFilter) {
            roomFilter.innerHTML = '<option value="">All Rooms</option>';
            const uniqueRooms = [...new Set(teachers.map(t => t.room).filter(r => r))];
            uniqueRooms.sort().forEach(roomName => {
                const option = document.createElement('option');
                option.value = roomName;
                option.textContent = roomName;
                roomFilter.appendChild(option);
            });
        }
    }

    const teacherSearch = document.getElementById('teacherSearch');
    if (teacherSearch) {
        teacherSearch.addEventListener('input', applyFilters);
    }

    const sectionFilter = document.getElementById('sectionFilter');
    if (sectionFilter) {
        sectionFilter.addEventListener('change', applyFilters);
    }

    const roomFilter = document.getElementById('roomFilter');
    if (roomFilter) {
        roomFilter.addEventListener('change', applyFilters);
    }

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }

    // Loading state
    function showLoadingState(show) {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) loadingState.style.display = show ? 'block' : 'none';
    }

    // Empty state
    function showEmptyState(show) {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.style.display = show ? 'block' : 'none';
    }

    // Bubble notification
    function showBubbleMessage(msg, type = "success") {
        const bubble = document.getElementById('teacherBubbleMessage');
        if (!bubble) return;
        
        bubble.textContent = msg;
        bubble.className = "section-bubble-message";
        bubble.classList.add(type);
        void bubble.offsetWidth;
        bubble.classList.add("show");
        
        setTimeout(() => {
            bubble.classList.remove("show");
        }, 3000);
    }

    // Initial load - check if we need to force refresh
    const forceInitialRefresh = sessionStorage.getItem('forceRefreshTeachers') === 'true';
    if (forceInitialRefresh) {
        sessionStorage.removeItem('forceRefreshTeachers');
        console.log('Forcing initial refresh due to page reload');
        loadAllData(true);
    } else {
        loadAllData();
    }
});