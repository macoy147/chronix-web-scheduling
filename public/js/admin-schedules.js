import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';
import AuthGuard from './auth-guard.js';


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
    let currentYearLevel = '';
    let currentShift = 'day'; // 'day' or 'night'
    let currentDate = new Date();
    let schedules = [];
    let subjects = [];
    let teachers = [];
    let sections = [];
    let rooms = [];
    let editMode = false;
    let editingScheduleId = null;

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

    // Year Level Selector
    const yearLevelSelect = document.getElementById('yearLevelSelect');
    if (yearLevelSelect) {
        yearLevelSelect.addEventListener('change', function() {
            currentYearLevel = this.value;
            if (currentYearLevel) {
                renderSubjectAssignments();
                renderCalendar();
            } else {
                clearSubjectAssignments();
                renderCalendar(); // Clear calendar
            }
        });
    }

    // Shift Toggle
    const dayShiftBtn = document.getElementById('dayShiftBtn');
    if (dayShiftBtn) {
        dayShiftBtn.addEventListener('click', function() {
            currentShift = 'day';
            updateShiftToggle();
            renderCalendar();
            renderSubjectAssignments();
        });
    }

    const nightShiftBtn = document.getElementById('nightShiftBtn');
    if (nightShiftBtn) {
        nightShiftBtn.addEventListener('click', function() {
            currentShift = 'night';
            updateShiftToggle();
            renderCalendar();
            renderSubjectAssignments();
        });
    }

    function updateShiftToggle() {
        document.querySelectorAll('.shift-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(currentShift + 'ShiftBtn');
        if (activeBtn) activeBtn.classList.add('active');
        
        const calendarContainer = document.querySelector('.calendar-container');
        if (calendarContainer) {
            calendarContainer.className = `calendar-container ${currentShift}-shift`;
        }
    }

    // Calendar Navigation
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', function() {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        });
    }

    const nextMonthBtn = document.getElementById('nextMonthBtn');
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', function() {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        });
    }

    // Load all necessary data
    async function loadAllData() {
        try {
            await Promise.all([
                loadSchedules(),
                loadSubjects(),
                loadTeachers(),
                loadSections(),
                loadRooms()
            ]);
            renderCalendar();
            // Initialize with empty subject assignments if no year level selected
            if (currentYearLevel) {
                renderSubjectAssignments();
            } else {
                clearSubjectAssignments();
            }
            updateShiftToggle();
        } catch (error) {
            console.error('Error loading data:', error);
            showBubbleMessage('Error loading schedule data', 'error');
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

    async function loadSubjects() {
        try {
            const res = await fetch('/subjects');
            if (res.ok) {
                subjects = await res.json();
            }
        } catch (error) {
            console.error('Error loading subjects:', error);
            subjects = [];
        }
    }

    async function loadTeachers() {
        try {
            const res = await fetch('/teachers');
            if (res.ok) {
                teachers = await res.json();
            }
        } catch (error) {
            console.error('Error loading teachers:', error);
            teachers = [];
        }
    }

    async function loadSections() {
        try {
            const res = await fetch('/sections');
            if (res.ok) {
                sections = await res.json();
            }
        } catch (error) {
            console.error('Error loading sections:', error);
            sections = [];
        }
    }

    async function loadRooms() {
        try {
            const res = await fetch('/rooms');
            if (res.ok) {
                rooms = await res.json();
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
            rooms = [];
        }
    }

    // Populate dropdowns (now with year filter)
    function populateSubjectDropdown(yearLevel = null) {
        const select = document.getElementById('subjectSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select Subject</option>';
        subjects.filter(subject => !yearLevel || subject.yearLevel === parseInt(yearLevel))
            .forEach(subject => {
                const option = document.createElement('option');
                option.value = subject._id;
                const displayText = subject.descriptiveTitle.length > 40 
                    ? `${subject.courseCode} - ${subject.descriptiveTitle.substring(0, 37)}...`
                    : `${subject.courseCode} - ${subject.descriptiveTitle}`;
                option.textContent = displayText;
                option.title = `${subject.courseCode} - ${subject.descriptiveTitle}`;
                option.dataset.lecHours = subject.lecHours || 0;
                option.dataset.labHours = subject.labHours || 0;
                select.appendChild(option);
            });
    }

    function populateTeacherDropdown() {
        const select = document.getElementById('teacherSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select Teacher</option>';
        teachers.forEach(teacher => {
            const option = document.createElement('option');
            option.value = teacher._id;
            const displayText = teacher.fullname.length > 30 
                ? `${teacher.fullname.substring(0, 27)}...`
                : teacher.fullname;
            option.textContent = displayText;
            option.title = teacher.fullname;
            select.appendChild(option);
        });
    }

    function populateSectionDropdown(yearLevel = null) {
        const select = document.getElementById('sectionSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select Section</option>';
        sections.filter(section => !yearLevel || section.yearLevel === parseInt(yearLevel))
            .forEach(section => {
                const option = document.createElement('option');
                option.value = section._id;
                const displayText = section.sectionName.length > 30 
                    ? `${section.sectionName.substring(0, 27)}...`
                    : section.sectionName;
                option.textContent = displayText;
                option.title = section.sectionName;
                option.dataset.shift = section.shift; // Add shift data if needed
                select.appendChild(option);
        });
    }

    function populateRoomDropdown() {
        const select = document.getElementById('roomSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select Room</option>';
        rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room._id;
            const displayText = room.roomName.length > 30 
                ? `${room.roomName.substring(0, 27)}...`
                : room.roomName;
            option.textContent = displayText;
            option.title = room.roomName;
            select.appendChild(option);
        });
    }

    // Function to calculate schedule duration in hours
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

    // Function to calculate allocated hours by type for a specific subject and section
    function calculateAllocatedHoursByType(subjectId, sectionId) {
        let lec = 0, lab = 0;
        schedules.filter(s => 
            (s.subject._id || s.subject) === subjectId && 
            (s.section._id || s.section) === sectionId
        ).forEach(s => {
            const dur = calculateScheduleDuration(s);
            if (s.scheduleType === 'lecture') lec += dur;
            else if (s.scheduleType === 'lab') lab += dur;
        });
        return { lec, lab };
    }

    // Function to calculate total allocated hours for a specific subject and section
    function calculateAllocatedHours(subjectId, sectionId) {
        const { lec, lab } = calculateAllocatedHoursByType(subjectId, sectionId);
        return lec + lab;
    }

    // Render subject assignments with per-section progress
    function renderSubjectAssignments() {
        const container = document.getElementById('subjectAssignmentContainer');
        if (!container) return;
        
        container.innerHTML = '';
        if (!currentYearLevel) {
            container.innerHTML = '<div class="no-selection">Select a year level to see subjects.</div>';
            return;
        }

        const filteredSubjects = subjects.filter(s => s.yearLevel === parseInt(currentYearLevel));
        const filteredSections = sections.filter(s => s.yearLevel === parseInt(currentYearLevel))
            .sort((a, b) => a.shift.localeCompare(b.shift));

        if (filteredSubjects.length === 0) {
            container.innerHTML = '<div class="no-selection">No subjects for this year level.</div>';
            return;
        }

        filteredSubjects.forEach(subject => {
            const card = document.createElement('div');
            card.className = 'subject-assignment-card';

            const progressHtml = filteredSections.map(section => {
                const allocated = calculateAllocatedHours(subject._id, section._id);
                const total = parseFloat(subject.totalHours) || 0;
                return `${section.sectionName} - ${section.shift} ${allocated}/${total} hours`;
            }).join(' | ');

            card.innerHTML = `
                <h3>${subject.courseCode} - ${subject.descriptiveTitle}</h3>
                <div class="sections-progress">${progressHtml}</div>
            `;
            container.appendChild(card);
        });
    }

    function clearSubjectAssignments() {
        const container = document.getElementById('subjectAssignmentContainer');
        if (container) container.innerHTML = '';
    }

    // Render calendar with filters for year level and shift
    function renderCalendar() {
        const grid = document.getElementById('calendarGrid');
        if (!grid) return;

        grid.innerHTML = '';

        // Always update month/year
        const currentMonthYear = document.getElementById('currentMonthYear');
        if (currentMonthYear) {
            currentMonthYear.textContent = currentDate.toLocaleString('default', { month: 'long' }) + ' ' + currentDate.getFullYear();
        }

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        days.forEach(day => {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';
            dayDiv.innerHTML = `<h4>${day}</h4>`;

            if (currentYearLevel !== '') {
                const daySchedules = schedules.filter(s => 
                    s.day === day &&
                    s.section.yearLevel === parseInt(currentYearLevel) &&
                    s.section.shift.toLowerCase() === currentShift
                );

                // Sort schedules by start time (basic sort assuming 24h format)
                daySchedules.sort((a, b) => {
                    let aStart = parseInt(a.startTime.replace(':', ''));
                    if (a.startPeriod === 'PM') aStart += 1200;
                    let bStart = parseInt(b.startTime.replace(':', ''));
                    if (b.startPeriod === 'PM') bStart += 1200;
                    return aStart - bStart;
                });

                daySchedules.forEach(schedule => {
                    const item = document.createElement('div');
                    item.className = `schedule-item ${schedule.scheduleType}`;
                    const timeDisplay = `${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}`;
                    item.textContent = `${timeDisplay}: ${schedule.subject.courseCode} (${schedule.teacher.fullname})`;
                    item.onclick = () => showScheduleDetails(schedule);
                    dayDiv.appendChild(item);
                });
            }

            grid.appendChild(dayDiv);
        });
    }

    // Modal logic for create/edit
    const scheduleModal = document.getElementById('scheduleModal');
    const openBtn = document.getElementById('openScheduleModal');
    const closeBtn = document.getElementById('closeScheduleModal');
    const form = document.getElementById('scheduleForm');
    const subjectSelect = document.getElementById('subjectSelect');
    const sectionSelect = document.getElementById('sectionSelect');
    const subjectHoursInfo = document.getElementById('subjectHoursInfo');

    if (openBtn) {
        openBtn.onclick = () => {
            editMode = false;
            editingScheduleId = null;
            if (form) form.reset();
            populateSubjectDropdown(currentYearLevel);
            populateSectionDropdown(currentYearLevel);
            populateTeacherDropdown();
            populateRoomDropdown();
            
            const modalTitle = document.getElementById('scheduleModalTitle');
            if (modalTitle) modalTitle.textContent = 'Create New Schedule';
            
            const submitBtn = document.getElementById('submitScheduleBtn');
            if (submitBtn) submitBtn.textContent = 'Create Schedule';
            
            if (scheduleModal) scheduleModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            if (subjectHoursInfo) subjectHoursInfo.style.display = 'none';
        };
    }

    if (closeBtn) {
        closeBtn.onclick = () => {
            if (scheduleModal) scheduleModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        };
    }

    if (scheduleModal) {
        scheduleModal.addEventListener('click', function(e) {
            if (e.target === scheduleModal) {
                scheduleModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }

    // Update hours info when subject or section changes
    if (subjectSelect) {
        subjectSelect.addEventListener('change', updateHoursInfo);
    }
    if (sectionSelect) {
        sectionSelect.addEventListener('change', updateHoursInfo);
    }

    function updateHoursInfo() {
        if (!subjectSelect || !sectionSelect || !subjectHoursInfo) return;
        
        const subjId = subjectSelect.value;
        const sectId = sectionSelect.value;
        if (!subjId || !sectId) {
            subjectHoursInfo.style.display = 'none';
            return;
        }
        const subject = subjects.find(s => s._id === subjId);
        if (!subject) return;
        const { lec, lab } = calculateAllocatedHoursByType(subjId, sectId);
        const totalAllocated = lec + lab;
        const lecTotal = parseFloat(subject.lecHours) || 0;
        const labTotal = parseFloat(subject.labHours) || 0;
        const total = lecTotal + labTotal;
        
        const lecHoursEl = document.getElementById('lecHours');
        const labHoursEl = document.getElementById('labHours');
        const totalHoursEl = document.getElementById('totalHours');
        const hoursProgressEl = document.getElementById('hoursProgress');
        const progressTextEl = document.getElementById('progressText');
        
        if (lecHoursEl) lecHoursEl.textContent = `${lec}/${lecTotal}`;
        if (labHoursEl) labHoursEl.textContent = `${lab}/${labTotal}`;
        if (totalHoursEl) totalHoursEl.textContent = `${totalAllocated}/${total}`;
        
        const progress = total > 0 ? (totalAllocated / total * 100) : 0;
        if (hoursProgressEl) hoursProgressEl.style.width = `${progress}%`;
        if (progressTextEl) progressTextEl.textContent = `${Math.round(progress)}% scheduled`;
        
        subjectHoursInfo.style.display = 'block';
    }

    // Form submit
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = {
                subject: document.getElementById('subjectSelect').value,
                teacher: document.getElementById('teacherSelect').value,
                section: document.getElementById('sectionSelect').value,
                room: document.getElementById('roomSelect').value,
                day: document.getElementById('daySelect').value,
                startTime: document.getElementById('startTime').value,
                endTime: document.getElementById('endTime').value,
                startPeriod: document.getElementById('startPeriod').value,
                endPeriod: document.getElementById('endPeriod').value,
                scheduleType: document.querySelector('input[name="scheduleType"]:checked').value
            };

            // Basic validation
            if (!formData.subject || !formData.teacher || !formData.section || !formData.room || !formData.day || !formData.startTime || !formData.endTime) {
                showBubbleMessage('Please fill all required fields.', 'error');
                return;
            }

            try {
                let url = '/schedules';
                let method = 'POST';
                if (editMode) {
                    url += `/${editingScheduleId}`;
                    method = 'PUT';
                }

                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                const result = await res.json();

                if (res.ok) {
                    showBubbleMessage(editMode ? 'Schedule updated successfully!' : 'Schedule created successfully!', 'success');
                    if (scheduleModal) scheduleModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                    await loadAllData(); // Reload data to update views
                } else {
                    showBubbleMessage(result.error || 'Failed to save schedule.', 'error');
                }
            } catch (error) {
                console.error('Error saving schedule:', error);
                showBubbleMessage('Failed to save schedule.', 'error');
            }
        };
    }

    // Schedule Details Modal
    function showScheduleDetails(schedule) {
        const modal = document.getElementById('scheduleDetailsModal');
        const details = document.getElementById('scheduleDetails');
        
        if (!modal || !details) return;
        
        details.innerHTML = `
            <div class="detail-item">
                <span class="detail-label">Subject:</span>
                <span class="detail-value">${schedule.subject.courseCode} - ${schedule.subject.descriptiveTitle}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Teacher:</span>
                <span class="detail-value">${schedule.teacher.fullname}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Section:</span>
                <span class="detail-value">${schedule.section.sectionName} (${schedule.section.shift})</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Room:</span>
                <span class="detail-value">${schedule.room.roomName}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Day:</span>
                <span class="detail-value">${schedule.day}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Time:</span>
                <span class="detail-value">${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Type:</span>
                <span class="detail-value">${schedule.scheduleType.charAt(0).toUpperCase() + schedule.scheduleType.slice(1)}</span>
            </div>
        `;
        
        const editBtn = document.getElementById('editScheduleBtn');
        if (editBtn) {
            editBtn.onclick = () => {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
                openEditModal(schedule._id);
            };
        }
        
        const deleteBtn = document.getElementById('deleteScheduleBtn');
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
                handleDeleteSchedule(schedule._id);
            };
        }
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    const closeDetailsModal = document.getElementById('closeDetailsModal');
    if (closeDetailsModal) {
        closeDetailsModal.addEventListener('click', function() {
            const modal = document.getElementById('scheduleDetailsModal');
            if (modal) modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }

    // Edit modal
    async function openEditModal(scheduleId) {
        try {
            const schedule = schedules.find(s => s._id === scheduleId);
            if (!schedule) return;

            editMode = true;
            editingScheduleId = scheduleId;

            // Get the section's shift for filtering
            const scheduleShift = schedule.section.shift.toLowerCase();

            populateSubjectDropdown(currentYearLevel);
            populateSectionDropdown(currentYearLevel, scheduleShift);
            populateTeacherDropdown();
            populateRoomDropdown();

            if (form) {
                document.getElementById('subjectSelect').value = schedule.subject._id;
                document.getElementById('teacherSelect').value = schedule.teacher._id;
                document.getElementById('sectionSelect').value = schedule.section._id;
                document.getElementById('roomSelect').value = schedule.room._id;
                document.getElementById('daySelect').value = schedule.day;
                document.getElementById('startTime').value = schedule.startTime;
                document.getElementById('endTime').value = schedule.endTime;
                document.getElementById('startPeriod').value = schedule.startPeriod;
                document.getElementById('endPeriod').value = schedule.endPeriod;
                document.querySelector(`input[name="scheduleType"][value="${schedule.scheduleType}"]`).checked = true;
            }

            const modalTitle = document.getElementById('scheduleModalTitle');
            if (modalTitle) modalTitle.textContent = 'Edit Schedule';
            
            const submitBtn = document.getElementById('submitScheduleBtn');
            if (submitBtn) submitBtn.textContent = 'Update Schedule';
            
            if (scheduleModal) scheduleModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            // Update hours info
            updateHoursInfo();

        } catch (error) {
            console.error('Error opening edit modal:', error);
            showBubbleMessage('Error loading schedule for editing.', 'error');
        }
    }

    // Delete schedule - FIXED: Reload and re-render properly
    async function handleDeleteSchedule(scheduleId) {
        if (!confirm('Are you sure you want to delete this schedule?')) return;

        try {
            const res = await fetch(`/schedules/${scheduleId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                showBubbleMessage('Schedule deleted successfully!', 'success');
                // CRITICAL FIX: Reload schedules first, then re-render everything
                await loadSchedules();
                renderCalendar();
                renderSubjectAssignments();
            } else {
                showBubbleMessage('Failed to delete schedule.', 'error');
            }
        } catch (error) {
            console.error('Error deleting schedule:', error);
            showBubbleMessage('Failed to delete schedule.', 'error');
        }
    }

    // Bubble notification
    function showBubbleMessage(msg, type = "success") {
        const bubble = document.getElementById('scheduleBubbleMessage');
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