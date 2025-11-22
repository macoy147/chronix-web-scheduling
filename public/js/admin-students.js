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

    // State management
    let students = [];
    let schedules = [];
    let sections = [];
    let currentStudentId = null;
    let currentView = 'weekly';
    let currentShift = 'all';
    let currentDayIndex = 0;
    let studentToDelete = null;

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

    // Update profile info
    function updateProfileInfo() {
        const currentUser = AuthHelper.getCurrentUser();
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
            const userId = AuthHelper.getUserId();
            if (userId) {
                const res = await fetch(`/user/${userId}`);
                if (res.ok) {
                    const userData = await res.json();
                    AuthHelper.storeUserSession(userData);
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

    // Load all data
    async function loadAllData() {
        try {
            showLoadingState(true);
            await Promise.all([
                loadStudents(),
                loadSchedules(),
                loadSections()
            ]);
            updateStatistics();
            populateSectionFilter();
            renderStudentsTable();
            showLoadingState(false);
        } catch (error) {
            console.error('Error loading data:', error);
            showBubbleMessage('Error loading student data', 'error');
            showLoadingState(false);
        }
    }

    // FIXED: Better student loading with fallback
    async function loadStudents() {
        try {
            console.log('🔄 Attempting to load students from /users/students...');
            let res = await fetch('/users/students');
            
            // If the new endpoint fails, fall back to test-users
            if (!res.ok) {
                console.log('❌ New endpoint failed, falling back to /test-users');
                res = await fetch('/test-users');
                if (res.ok) {
                    const data = await res.json();
                    // Extract students from test-users response
                    students = data.users ? data.users.filter(user => user.userrole === 'student') : [];
                    console.log(`✅ Loaded ${students.length} students from test-users fallback`);
                } else {
                    throw new Error('Both endpoints failed');
                }
            } else {
                students = await res.json();
                console.log(`✅ Loaded ${students.length} students from dedicated endpoint`);
            }
            
            console.log('Students data:', students);
            
            if (students.length === 0) {
                console.warn('⚠️ No students found in the system');
                showBubbleMessage('No students found in the system', 'error');
            }
            
        } catch (error) {
            console.error('❌ Error loading students:', error);
            students = [];
            showBubbleMessage('Failed to load students. Please check the server.', 'error');
        }
    }

    async function loadSchedules() {
        try {
            const res = await fetch('/schedules');
            if (res.ok) {
                schedules = await res.json();
                console.log('Loaded schedules:', schedules);
            } else {
                console.error('Failed to load schedules');
                schedules = [];
            }
        } catch (error) {
            console.error('Error loading schedules:', error);
            schedules = [];
        }
    }

    async function loadSections() {
        try {
            const res = await fetch('/sections');
            if (res.ok) {
                sections = await res.json();
                console.log(`✅ Loaded ${sections.length} sections:`, sections.map(s => s.sectionName));
            } else {
                console.error('Failed to load sections');
                sections = [];
            }
        } catch (error) {
            console.error('Error loading sections:', error);
            sections = [];
        }
    }

    // Update statistics - FIXED: Now correctly counts total sections from sections data
    function updateStatistics() {
        const totalStudents = students.length;
        const activeStudents = students.filter(s => getStudentStatus(s._id) === 'active').length;
        
        // FIXED: Count total sections from sections data, not from student enrollments
        const totalSections = sections.length;
        
        // Count students actually enrolled in sections (for debugging)
        const studentsWithSections = students.filter(s => s.section && s.section.trim() !== '').length;
        const uniqueStudentSections = new Set(students.map(s => s.section).filter(s => s && s.trim() !== '')).size;

        const totalStudentsEl = document.getElementById('totalStudents');
        const activeStudentsEl = document.getElementById('activeStudents');
        const enrolledSectionsEl = document.getElementById('enrolledSections');
        
        if (totalStudentsEl) totalStudentsEl.textContent = totalStudents;
        if (activeStudentsEl) activeStudentsEl.textContent = activeStudents;
        if (enrolledSectionsEl) enrolledSectionsEl.textContent = totalSections;
        
        console.log(`📊 Statistics:`, {
            totalStudents,
            activeStudents, 
            totalSections,
            studentsWithSections,
            uniqueStudentSections,
            sectionsList: sections.map(s => s.sectionName)
        });
    }

    // Populate section filter - FIXED: Use all sections from sections data
    function populateSectionFilter() {
        const select = document.getElementById('sectionFilter');
        if (!select) return;
        
        // FIXED: Use all sections from sections data, not just those with students
        const allSectionNames = sections.map(s => s.sectionName).sort();
        
        select.innerHTML = '<option value="">All Sections</option>';
        
        allSectionNames.forEach(sectionName => {
            const option = document.createElement('option');
            option.value = sectionName;
            option.textContent = sectionName;
            select.appendChild(option);
        });
        
        console.log(`📋 Populated section filter with ${allSectionNames.length} sections from sections data`);
    }

    // Get student schedules based on their section
    function getStudentSchedules(student) {
        if (!student || !student.section) {
            console.log(`No section for student: ${student?.fullname}`);
            return [];
        }
        
        try {
            // Find the section object that matches the student's section
            const studentSection = sections.find(s => s.sectionName === student.section);
            if (!studentSection) {
                console.log(`No section found for: ${student.section}`);
                return [];
            }
            
            // Return schedules that match the student's section
            const studentSchedules = schedules.filter(schedule => {
                try {
                    const scheduleSectionId = schedule.section._id || schedule.section;
                    const studentSectionId = studentSection._id;
                    const match = scheduleSectionId.toString() === studentSectionId.toString();
                    return match;
                } catch (error) {
                    console.error('Error comparing section IDs:', error);
                    return false;
                }
            });
            
            console.log(`Found ${studentSchedules.length} schedules for student ${student.fullname}`);
            return studentSchedules;
        } catch (error) {
            console.error('Error getting student schedules:', error);
            return [];
        }
    }

    // Get student status (active if enrolled in section with schedules)
    function getStudentStatus(studentId) {
        try {
            const student = students.find(s => s._id === studentId);
            if (!student || !student.section) return 'inactive';
            
            const studentSchedules = getStudentSchedules(student);
            const status = studentSchedules.length > 0 ? 'active' : 'inactive';
            console.log(`Student ${student.fullname} status: ${status}`);
            return status;
        } catch (error) {
            console.error('Error getting student status:', error);
            return 'inactive';
        }
    }

    // Get year level from section
    function getYearLevelFromSection(sectionName) {
        if (!sectionName) return 'N/A';
        
        try {
            const section = sections.find(s => s.sectionName === sectionName);
            if (section && section.yearLevel) {
                return `Year ${section.yearLevel}`;
            }
            
            // Fallback: try to extract from section name
            const yearMatch = sectionName.match(/\b(\d+)/);
            if (yearMatch) {
                return `Year ${yearMatch[1]}`;
            }
            
            return 'N/A';
        } catch (error) {
            console.error('Error getting year level:', error);
            return 'N/A';
        }
    }

    // IMPROVED: Safe data display function with better handling
    function safeDisplay(data, fallback = 'N/A') {
        if (data === null || data === undefined || data === '') return fallback;
        if (typeof data === 'string' && data.trim() === '') return fallback;
        return data;
    }

    // Render students table
    function renderStudentsTable() {
        const tbody = document.getElementById('studentsTableBody');
        if (!tbody) {
            console.error('Students table body not found');
            return;
        }

        tbody.innerHTML = '';

        if (students.length === 0) {
            showEmptyState(true);
            console.log('No students to render - showing empty state');
            return;
        }

        showEmptyState(false);
        console.log(`Rendering ${students.length} students to table`);

        students.forEach((student, index) => {
            try {
                const status = getStudentStatus(student._id);
                const yearLevel = getYearLevelFromSection(student.section);

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${safeDisplay(student.fullname)}</td>
                    <td>${safeDisplay(student.email)}</td>
                    <td>${safeDisplay(student.ctuid, 'No ID')}</td>
                    <td>${safeDisplay(student.section, 'Not Assigned')}</td>
                    <td>${yearLevel}</td>
                    <td>${safeDisplay(student.gender, 'Not Specified')}</td>
                    <td><span class="status-badge status-${status}">${status}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-view" onclick="openStudentSchedule('${student._id}')">
                                <i class="bi bi-calendar"></i> Schedule
                            </button>
                            <button class="btn-edit" onclick="openEditStudent('${student._id}')">
                                <i class="bi bi-pencil"></i> 
                            </button>
                            <button class="btn-delete" onclick="openDeleteStudent('${student._id}')">
                                <i class="bi bi-trash"></i> 
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
                
                // Log first few students for debugging
                if (index < 3) {
                    console.log(`Rendered student: ${student.fullname}`, {
                        ctuid: student.ctuid,
                        gender: student.gender,
                        section: student.section,
                        room: student.room
                    });
                }
            } catch (error) {
                console.error('Error rendering student row:', error, student);
            }
        });

        applyFilters();
        console.log('✅ Students table rendered successfully');
    }

    // Combined filter function for search and filters
    function applyFilters() {
        const searchTerm = document.getElementById('studentSearch')?.value.toLowerCase() || '';
        const yearLevelFilter = document.getElementById('yearLevelFilter')?.value || '';
        const sectionFilter = document.getElementById('sectionFilter')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        
        const rows = document.querySelectorAll('#studentsTableBody tr');
        let hasVisibleRows = false;

        rows.forEach(row => {
            try {
                const studentName = row.cells[0]?.textContent.toLowerCase() || '';
                const email = row.cells[1]?.textContent.toLowerCase() || '';
                const ctuid = row.cells[2]?.textContent.toLowerCase() || '';
                const section = row.cells[3]?.textContent || '';
                const yearLevel = row.cells[4]?.textContent || '';
                const statusBadge = row.cells[6]?.querySelector('.status-badge');
                const studentStatus = statusBadge ? statusBadge.textContent.toLowerCase() : '';

                const matchesSearch = studentName.includes(searchTerm) || 
                                    email.includes(searchTerm) || 
                                    ctuid.includes(searchTerm);
                const matchesYearLevel = !yearLevelFilter || yearLevel.includes(yearLevelFilter);
                const matchesSection = !sectionFilter || section === sectionFilter;
                const matchesStatus = !statusFilter || studentStatus === statusFilter;

                const matchesAll = matchesSearch && matchesYearLevel && matchesSection && matchesStatus;

                row.style.display = matchesAll ? '' : 'none';
                if (matchesAll) hasVisibleRows = true;
            } catch (error) {
                console.error('Error applying filters to row:', error);
                row.style.display = 'none';
            }
        });

        showEmptyState(!hasVisibleRows && students.length > 0);
    }

    // Open student schedule modal
    window.openStudentSchedule = function(studentId) {
        currentStudentId = studentId;
        const student = students.find(s => s._id === studentId);
        
        if (!student) {
            showBubbleMessage('Student not found', 'error');
            return;
        }

        // Update modal student info with safe display
        const modalStudentName = document.getElementById('modalStudentName');
        const modalStudentEmail = document.getElementById('modalStudentEmail');
        const modalStudentId = document.getElementById('modalStudentId');
        const modalStudentSection = document.getElementById('modalStudentSection');
        const studentScheduleTitle = document.getElementById('studentScheduleTitle');
        
        if (modalStudentName) modalStudentName.textContent = safeDisplay(student.fullname);
        if (modalStudentEmail) modalStudentEmail.textContent = safeDisplay(student.email);
        if (modalStudentId) modalStudentId.textContent = `CTU ID: ${safeDisplay(student.ctuid, 'No ID')}`;
        if (modalStudentSection) modalStudentSection.textContent = `Section: ${safeDisplay(student.section, 'Not Assigned')}`;
        if (studentScheduleTitle) studentScheduleTitle.textContent = `${safeDisplay(student.fullname)}'s Class Schedule`;

        // Load student avatar if available
        const avatar = document.getElementById('modalStudentAvatar');
        if (avatar && student.profilePicture && student.profilePicture !== '') {
            avatar.src = student.profilePicture.startsWith('http') 
                ? student.profilePicture 
                : student.profilePicture;
        } else if (avatar) {
            avatar.src = '/img/default_student_avatar.png';
        }

        // Render schedule
        renderStudentSchedule(student);
        
        // Show modal
        const scheduleModal = document.getElementById('studentScheduleModal');
        if (scheduleModal) scheduleModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    // Open edit student modal
    window.openEditStudent = function(studentId) {
        const student = students.find(s => s._id === studentId);
        
        if (!student) {
            showBubbleMessage('Student not found', 'error');
            return;
        }

        // Populate form with student data - using safeDisplay with empty string fallback for form fields
        const editFullName = document.getElementById('editFullName');
        const editEmail = document.getElementById('editEmail');
        const editCtuid = document.getElementById('editCtuid');
        const editBirthdate = document.getElementById('editBirthdate');
        const editGender = document.getElementById('editGender');
        const editSection = document.getElementById('editSection');
        const editRoom = document.getElementById('editRoom');
        const editStudentModalTitle = document.getElementById('editStudentModalTitle');
        
        if (editFullName) editFullName.value = safeDisplay(student.fullname, '');
        if (editEmail) editEmail.value = safeDisplay(student.email, '');
        if (editCtuid) editCtuid.value = safeDisplay(student.ctuid, '');
        if (editBirthdate) editBirthdate.value = safeDisplay(student.birthdate, '');
        if (editGender) editGender.value = safeDisplay(student.gender, '');
        if (editSection) editSection.value = safeDisplay(student.section, '');
        if (editRoom) editRoom.value = safeDisplay(student.room, '');

        // Set current student ID for form submission
        currentStudentId = studentId;
        if (editStudentModalTitle) editStudentModalTitle.textContent = `Edit ${safeDisplay(student.fullname)}`;

        // Show modal
        const editModal = document.getElementById('editStudentModal');
        if (editModal) editModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    // Open delete student modal
    window.openDeleteStudent = function(studentId) {
        const student = students.find(s => s._id === studentId);
        
        if (!student) {
            showBubbleMessage('Student not found', 'error');
            return;
        }

        studentToDelete = student;

        // Update confirmation text
        const deleteConfirmationText = document.getElementById('deleteConfirmationText');
        if (deleteConfirmationText) {
            deleteConfirmationText.textContent = 
                `Are you sure you want to delete ${safeDisplay(student.fullname)}? This action cannot be undone.`;
        }

        // Show modal
        const deleteModal = document.getElementById('deleteStudentModal');
        if (deleteModal) deleteModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    // Edit student form submission
    const editStudentForm = document.getElementById('editStudentForm');
    if (editStudentForm) {
        editStudentForm.addEventListener('submit', async function(e) {
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

            console.log('Submitting student update:', formData);

            // Basic validation
            if (!formData.fullname || !formData.email || !formData.ctuid) {
                showBubbleMessage('Please fill in all required fields', 'error');
                return;
            }

            try {
                const res = await fetch(`/user/${currentStudentId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                if (res.ok) {
                    const updatedStudent = await res.json();
                    showBubbleMessage('Student updated successfully!', 'success');
                    const editModal = document.getElementById('editStudentModal');
                    if (editModal) editModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                    
                    // Update local students array and re-render
                    const studentIndex = students.findIndex(s => s._id === currentStudentId);
                    if (studentIndex !== -1) {
                        students[studentIndex] = updatedStudent;
                    }
                    renderStudentsTable();
                    updateStatistics();
                } else {
                    const error = await res.json();
                    showBubbleMessage(error.error || 'Failed to update student', 'error');
                }
            } catch (error) {
                console.error('Error updating student:', error);
                showBubbleMessage('Failed to update student', 'error');
            }
        });
    }

    // Delete student confirmation
    const confirmDeleteStudent = document.getElementById('confirmDeleteStudent');
    if (confirmDeleteStudent) {
        confirmDeleteStudent.addEventListener('click', async function() {
            if (!studentToDelete) return;

            try {
                const res = await fetch(`/user/${studentToDelete._id}`, {
                    method: 'DELETE'
                });

                if (res.ok) {
                    showBubbleMessage('Student deleted successfully!', 'success');
                    const deleteModal = document.getElementById('deleteStudentModal');
                    if (deleteModal) deleteModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                    
                    // Reload data to reflect changes
                    await loadAllData();
                } else {
                    const error = await res.json();
                    showBubbleMessage(error.error || 'Failed to delete student', 'error');
                }
            } catch (error) {
                console.error('Error deleting student:', error);
                showBubbleMessage('Failed to delete student', 'error');
            }
        });
    }

    // Close modals
    const closeStudentScheduleModal = document.getElementById('closeStudentScheduleModal');
    if (closeStudentScheduleModal) {
        closeStudentScheduleModal.addEventListener('click', function() {
            const modal = document.getElementById('studentScheduleModal');
            if (modal) modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }

    const closeEditStudentModal = document.getElementById('closeEditStudentModal');
    if (closeEditStudentModal) {
        closeEditStudentModal.addEventListener('click', function() {
            const modal = document.getElementById('editStudentModal');
            if (modal) modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }

    const cancelEditStudent = document.getElementById('cancelEditStudent');
    if (cancelEditStudent) {
        cancelEditStudent.addEventListener('click', function() {
            const modal = document.getElementById('editStudentModal');
            if (modal) modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }

    const closeDeleteStudentModal = document.getElementById('closeDeleteStudentModal');
    if (closeDeleteStudentModal) {
        closeDeleteStudentModal.addEventListener('click', function() {
            const modal = document.getElementById('deleteStudentModal');
            if (modal) modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }

    const cancelDeleteStudent = document.getElementById('cancelDeleteStudent');
    if (cancelDeleteStudent) {
        cancelDeleteStudent.addEventListener('click', function() {
            const modal = document.getElementById('deleteStudentModal');
            if (modal) modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }

    // Close modals when clicking outside
    const studentScheduleModal = document.getElementById('studentScheduleModal');
    if (studentScheduleModal) {
        studentScheduleModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }

    const editStudentModal = document.getElementById('editStudentModal');
    if (editStudentModal) {
        editStudentModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }

    const deleteStudentModal = document.getElementById('deleteStudentModal');
    if (deleteStudentModal) {
        deleteStudentModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }

    // Render student schedule
    function renderStudentSchedule(student) {
        const studentSchedules = getStudentSchedules(student);

        // Calculate statistics
        calculateScheduleStatistics(studentSchedules);

        // Render based on current view
        if (currentView === 'weekly') {
            renderWeeklySchedule(studentSchedules);
        } else {
            renderDailySchedule(studentSchedules);
        }
    }

    // Calculate schedule statistics
    function calculateScheduleStatistics(studentSchedules) {
        let lectureHours = 0;
        let labHours = 0;

        studentSchedules.forEach(schedule => {
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

    // Calculate schedule duration
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
    function renderWeeklySchedule(studentSchedules) {
        const weeklyGrid = document.getElementById('weeklyGrid');
        if (!weeklyGrid) return;
        
        weeklyGrid.innerHTML = '';

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        days.forEach(day => {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'weekly-day';
            dayDiv.innerHTML = `<h5>${day}</h5>`;

            const daySchedules = studentSchedules.filter(schedule => 
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
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'empty-schedule';
                emptyMsg.innerHTML = '<small>No classes</small>';
                dayDiv.appendChild(emptyMsg);
            } else {
                daySchedules.forEach(schedule => {
                    const item = document.createElement('div');
                    item.className = `schedule-item-small ${schedule.scheduleType}`;
                    
                    const timeDisplay = `${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}`;
                    item.innerHTML = `
                        <div><strong>${safeDisplay(schedule.subject.courseCode)}</strong></div>
                        <div>${safeDisplay(schedule.teacher.fullname)}</div>
                        <div>${safeDisplay(schedule.room.roomName)}</div>
                        <div><small>${timeDisplay}</small></div>
                    `;
                    
                    item.title = `${safeDisplay(schedule.subject.courseCode)} - ${safeDisplay(schedule.subject.descriptiveTitle)}`;
                    dayDiv.appendChild(item);
                });
            }

            weeklyGrid.appendChild(dayDiv);
        });
    }

    // Render daily schedule
    function renderDailySchedule(studentSchedules) {
        const dailySchedule = document.getElementById('dailySchedule');
        if (!dailySchedule) return;
        
        dailySchedule.innerHTML = '';

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[currentDayIndex];
        
        const currentDayDisplay = document.getElementById('currentDayDisplay');
        if (currentDayDisplay) currentDayDisplay.textContent = currentDay;

        const daySchedules = studentSchedules.filter(schedule => 
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
                    <p>No classes for ${currentDay}</p>
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
                    <div class="schedule-meta">${safeDisplay(schedule.teacher.fullname)} • ${safeDisplay(schedule.room.roomName)} • ${schedule.scheduleType.charAt(0).toUpperCase() + schedule.scheduleType.slice(1)}</div>
                </div>
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

        if (currentStudentId) {
            const student = students.find(s => s._id === currentStudentId);
            if (student) {
                renderStudentSchedule(student);
            }
        }
    }

    // Shift toggle
    document.querySelectorAll('.shift-btn-small').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.shift-btn-small').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentShift = this.dataset.shift;
            
            if (currentStudentId) {
                const student = students.find(s => s._id === currentStudentId);
                if (student) {
                    renderStudentSchedule(student);
                }
            }
        });
    });

    // Daily navigation
    const prevDayBtn = document.getElementById('prevDayBtn');
    if (prevDayBtn) {
        prevDayBtn.addEventListener('click', function() {
            currentDayIndex = (currentDayIndex - 1 + 6) % 6;
            if (currentStudentId) {
                const student = students.find(s => s._id === currentStudentId);
                if (student) {
                    renderStudentSchedule(student);
                }
            }
        });
    }

    const nextDayBtn = document.getElementById('nextDayBtn');
    if (nextDayBtn) {
        nextDayBtn.addEventListener('click', function() {
            currentDayIndex = (currentDayIndex + 1) % 6;
            if (currentStudentId) {
                const student = students.find(s => s._id === currentStudentId);
                if (student) {
                    renderStudentSchedule(student);
                }
            }
        });
    }

    // Filter listeners
    const studentSearch = document.getElementById('studentSearch');
    if (studentSearch) {
        studentSearch.addEventListener('input', applyFilters);
    }

    const yearLevelFilter = document.getElementById('yearLevelFilter');
    if (yearLevelFilter) {
        yearLevelFilter.addEventListener('change', applyFilters);
    }

    const sectionFilter = document.getElementById('sectionFilter');
    if (sectionFilter) {
        sectionFilter.addEventListener('change', applyFilters);
    }

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }

    // Loading state
    function showLoadingState(show) {
        const loadingState = document.getElementById('loadingState');
        const tableContainer = document.querySelector('.students-table-container');
        if (loadingState) loadingState.style.display = show ? 'block' : 'none';
        if (tableContainer) {
            tableContainer.style.display = show ? 'none' : 'block';
        }
    }

    // Empty state
    function showEmptyState(show) {
        const emptyState = document.getElementById('emptyState');
        const tableContainer = document.querySelector('.students-table-container');
        if (emptyState) emptyState.style.display = show ? 'block' : 'none';
        if (tableContainer) {
            tableContainer.style.display = show ? 'none' : 'block';
        }
    }

    // Bubble notification
    function showBubbleMessage(msg, type = "success") {
        const bubble = document.getElementById('studentBubbleMessage');
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

    // Initial load
    loadAllData();
});