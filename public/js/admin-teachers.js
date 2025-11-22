import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    if (!AuthGuard.checkAuthentication('admin')) {
        return;
    }

    // State management
    let teachers = [];
    let schedules = [];
    let currentTeacherId = null;
    let currentView = 'weekly';
    let currentShift = 'all';
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
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        AuthGuard.logout();
    });

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
                profileAvatar.src = `http://localhost:3001${currentUser.profilePicture}`;
            }
        }
    }

    // Fetch user data
    async function fetchUserData() {
        try {
            const userId = AuthGuard.getUserId();
            if (userId) {
                const res = await fetch(`http://localhost:3001/user/${userId}`);
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

    // Load all data
    async function loadAllData() {
        try {
            showLoadingState(true);
            await Promise.all([
                loadTeachers(),
                loadSchedules()
            ]);
            renderTeachersTable();
            showLoadingState(false);
        } catch (error) {
            console.error('Error loading data:', error);
            showBubbleMessage('Error loading teacher data', 'error');
            showLoadingState(false);
        }
    }

    async function loadTeachers() {
        try {
            const res = await fetch('http://localhost:3001/teachers');
            if (res.ok) {
                teachers = await res.json();
                console.log('Loaded teachers with full data:', teachers);
            } else {
                console.error('Failed to load teachers');
                teachers = [];
            }
        } catch (error) {
            console.error('Error loading teachers:', error);
            teachers = [];
        }
    }

    async function loadSchedules() {
        try {
            const res = await fetch('http://localhost:3001/schedules');
            if (res.ok) {
                schedules = await res.json();
                console.log('Loaded schedules for teachers:', schedules);
            } else {
                console.error('Failed to load schedules');
                schedules = [];
            }
        } catch (error) {
            console.error('Error loading schedules:', error);
            schedules = [];
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

    // Render teachers table
    function renderTeachersTable() {
        const tbody = document.getElementById('teachersTableBody');
        tbody.innerHTML = '';

        if (teachers.length === 0) {
            showEmptyState(true);
            return;
        }

        showEmptyState(false);

        teachers.forEach(teacher => {
            const scheduleCount = getTeacherSchedulesCount(teacher._id);
            const status = getTeacherStatus(teacher._id);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${safeDisplay(teacher.fullname)}</td>
                <td>${safeDisplay(teacher.email)}</td>
                <td>${safeDisplay(teacher.ctuid)}</td>
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

        // Apply current filters after rendering
        applyFilters();
    }

    // Combined filter function for search and status
    function applyFilters() {
        const searchTerm = document.getElementById('teacherSearch').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;
        const rows = document.querySelectorAll('#teachersTableBody tr');
        let hasVisibleRows = false;

        rows.forEach(row => {
            const teacherName = row.cells[0].textContent.toLowerCase();
            const email = row.cells[1].textContent.toLowerCase();
            const ctuid = row.cells[2].textContent.toLowerCase();
            const statusBadge = row.cells[4].querySelector('.status-badge');
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
        document.getElementById('modalTeacherName').textContent = safeDisplay(teacher.fullname);
        document.getElementById('modalTeacherEmail').textContent = safeDisplay(teacher.email);
        document.getElementById('modalTeacherId').textContent = safeDisplay(teacher.ctuid);
        document.getElementById('teacherScheduleTitle').textContent = `${safeDisplay(teacher.fullname)}'s Schedule`;

        // Load teacher avatar if available
        const avatar = document.getElementById('modalTeacherAvatar');
        if (teacher.profilePicture && teacher.profilePicture !== '') {
            avatar.src = `http://localhost:3001${teacher.profilePicture}`;
        } else {
            avatar.src = './img/default_teacher_avatar.png';
        }

        // Render schedule
        renderTeacherSchedule(teacherId);
        
        // Show modal
        document.getElementById('teacherScheduleModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    // Open edit teacher modal
    window.openEditTeacher = function(teacherId) {
        const teacher = teachers.find(t => t._id === teacherId);
        
        if (!teacher) {
            showBubbleMessage('Teacher not found', 'error');
            return;
        }

        // Populate form with teacher data
        document.getElementById('editFullName').value = safeDisplay(teacher.fullname, '');
        document.getElementById('editEmail').value = safeDisplay(teacher.email, '');
        document.getElementById('editCtuid').value = safeDisplay(teacher.ctuid, '');
        document.getElementById('editBirthdate').value = safeDisplay(teacher.birthdate, '');
        document.getElementById('editGender').value = safeDisplay(teacher.gender, '');
        document.getElementById('editSection').value = safeDisplay(teacher.section, '');
        document.getElementById('editRoom').value = safeDisplay(teacher.room, '');

        // Set current teacher ID for form submission
        currentTeacherId = teacherId;
        document.getElementById('editTeacherModalTitle').textContent = `Edit ${safeDisplay(teacher.fullname)}`;

        // Show modal
        document.getElementById('editTeacherModal').style.display = 'flex';
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
        document.getElementById('deleteConfirmationText').textContent = 
            `Are you sure you want to delete ${safeDisplay(teacher.fullname)}? This action cannot be undone.`;
        
        // Update schedule count warning
        const scheduleWarning = document.getElementById('scheduleCountWarning');
        scheduleWarning.textContent = scheduleCount;
        
        // Show/hide warning based on schedule count
        const warningInfo = document.querySelector('.teacher-warning-info');
        warningInfo.style.display = scheduleCount > 0 ? 'block' : 'none';

        // Show modal
        document.getElementById('deleteTeacherModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    // Edit teacher form submission - FIXED VERSION
    document.getElementById('editTeacherForm').addEventListener('submit', async function(e) {
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
            const res = await fetch(`http://localhost:3001/user/${currentTeacherId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                const updatedTeacher = await res.json();
                showBubbleMessage('Teacher updated successfully!', 'success');
                document.getElementById('editTeacherModal').style.display = 'none';
                document.body.style.overflow = 'auto';
                
                // Update local teachers array and re-render
                const teacherIndex = teachers.findIndex(t => t._id === currentTeacherId);
                if (teacherIndex !== -1) {
                    teachers[teacherIndex] = updatedTeacher;
                }
                renderTeachersTable();
            } else {
                const error = await res.json();
                showBubbleMessage(error.error || 'Failed to update teacher', 'error');
            }
        } catch (error) {
            console.error('Error updating teacher:', error);
            showBubbleMessage('Failed to update teacher', 'error');
        }
    });

    // Delete teacher confirmation
    document.getElementById('confirmDeleteTeacher').addEventListener('click', async function() {
        if (!teacherToDelete) return;

        try {
            const res = await fetch(`http://localhost:3001/user/${teacherToDelete._id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                showBubbleMessage('Teacher deleted successfully!', 'success');
                document.getElementById('deleteTeacherModal').style.display = 'none';
                document.body.style.overflow = 'auto';
                
                // Reload data to reflect changes
                await loadAllData();
            } else {
                const error = await res.json();
                showBubbleMessage(error.error || 'Failed to delete teacher', 'error');
            }
        } catch (error) {
            console.error('Error deleting teacher:', error);
            showBubbleMessage('Failed to delete teacher', 'error');
        }
    });

    // Close modals
    document.getElementById('closeTeacherScheduleModal').addEventListener('click', function() {
        document.getElementById('teacherScheduleModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    document.getElementById('closeEditTeacherModal').addEventListener('click', function() {
        document.getElementById('editTeacherModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    document.getElementById('cancelEditTeacher').addEventListener('click', function() {
        document.getElementById('editTeacherModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    document.getElementById('closeDeleteTeacherModal').addEventListener('click', function() {
        document.getElementById('deleteTeacherModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    document.getElementById('cancelDeleteTeacher').addEventListener('click', function() {
        document.getElementById('deleteTeacherModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    // Close modals when clicking outside
    document.getElementById('teacherScheduleModal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

    document.getElementById('editTeacherModal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

    document.getElementById('deleteTeacherModal').addEventListener('click', function(e) {
        if (e.target === this) {
            this.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

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

        document.getElementById('lectureCount').textContent = lectureHours.toFixed(1);
        document.getElementById('labCount').textContent = labHours.toFixed(1);
        document.getElementById('totalHours').textContent = (lectureHours + labHours).toFixed(1);
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
        weeklyGrid.innerHTML = '';

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        days.forEach(day => {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'weekly-day';
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

            daySchedules.forEach(schedule => {
                const item = document.createElement('div');
                item.className = `schedule-item-small ${schedule.scheduleType}`;
                
                const timeDisplay = `${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}`;
                item.innerHTML = `
                    <div><strong>${safeDisplay(schedule.subject.courseCode)}</strong></div>
                    <div>${safeDisplay(schedule.section.sectionName)}</div>
                    <div>${safeDisplay(schedule.room.roomName)}</div>
                    <div><small>${timeDisplay}</small></div>
                `;
                
                item.title = `${safeDisplay(schedule.subject.courseCode)} - ${safeDisplay(schedule.section.sectionName)} (${safeDisplay(schedule.room.roomName)})`;
                dayDiv.appendChild(item);
            });

            weeklyGrid.appendChild(dayDiv);
        });
    }

    // Render daily schedule
    function renderDailySchedule(teacherSchedules) {
        const dailySchedule = document.getElementById('dailySchedule');
        dailySchedule.innerHTML = '';

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[currentDayIndex];
        
        document.getElementById('currentDayDisplay').textContent = currentDay;

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
    document.getElementById('scheduleViewSelect').addEventListener('change', function() {
        currentView = this.value;
        updateScheduleView();
    });

    function updateScheduleView() {
        const weeklyView = document.getElementById('weeklyScheduleView');
        const dailyView = document.getElementById('dailyScheduleView');

        if (currentView === 'weekly') {
            weeklyView.style.display = 'block';
            dailyView.style.display = 'none';
        } else {
            weeklyView.style.display = 'none';
            dailyView.style.display = 'block';
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
    document.getElementById('prevDayBtn').addEventListener('click', function() {
        currentDayIndex = (currentDayIndex - 1 + 6) % 6;
        if (currentTeacherId) {
            renderTeacherSchedule(currentTeacherId);
        }
    });

    document.getElementById('nextDayBtn').addEventListener('click', function() {
        currentDayIndex = (currentDayIndex + 1) % 6;
        if (currentTeacherId) {
            renderTeacherSchedule(currentTeacherId);
        }
    });

    // Search and status filter listeners (both call applyFilters)
    document.getElementById('teacherSearch').addEventListener('input', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);

    // Loading state
    function showLoadingState(show) {
        const loadingState = document.getElementById('loadingState');
        loadingState.style.display = show ? 'block' : 'none';
    }

    // Empty state
    function showEmptyState(show) {
        const emptyState = document.getElementById('emptyState');
        emptyState.style.display = show ? 'block' : 'none';
    }

    // Bubble notification
    function showBubbleMessage(msg, type = "success") {
        const bubble = document.getElementById('teacherBubbleMessage');
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

