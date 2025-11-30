import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';
import AuthGuard from './auth-guard.js';


// Simple auth helper
 

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    if (!AuthGuard.checkAuthentication('admin')) {
        return;
    }

    // State management
    let currentYearLevel = '';
    let currentSection = ''; // Selected section ID
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

    // Year Level Selector
    const yearLevelSelect = document.getElementById('yearLevelSelect');
    if (yearLevelSelect) {
        yearLevelSelect.addEventListener('change', function() {
            currentYearLevel = this.value;
            if (currentSection && currentYearLevel) {
                renderSubjectAssignments();
                renderCalendar();
            } else {
                clearSubjectAssignments();
                renderCalendar(); // Clear calendar
            }
        });
    }

    // Section Filter Selector
    const sectionFilterSelect = document.getElementById('sectionFilterSelect');
    if (sectionFilterSelect) {
        sectionFilterSelect.addEventListener('change', function() {
            currentSection = this.value;
            
            // Auto-set year level based on selected section
            if (currentSection) {
                const selectedSection = sections.find(s => s._id === currentSection);
                if (selectedSection) {
                    currentYearLevel = selectedSection.yearLevel.toString();
                    if (yearLevelSelect) {
                        yearLevelSelect.value = currentYearLevel;
                    }
                }
            }
            
            if (currentSection && currentYearLevel) {
                renderSubjectAssignments();
                renderCalendar();
                updateStatistics();
            } else {
                clearSubjectAssignments();
                renderCalendar(); // Clear calendar
                updateStatistics();
            }
        });
    }

    // Populate section filter dropdown with ALL sections grouped by year
    function populateSectionFilter() {
        const select = document.getElementById('sectionFilterSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select Year and Section</option>';
        
        // Group sections by year level
        const sectionsByYear = {};
        sections.forEach(section => {
            const year = section.yearLevel;
            if (!sectionsByYear[year]) {
                sectionsByYear[year] = [];
            }
            sectionsByYear[year].push(section);
        });
        
        // Sort years
        const years = Object.keys(sectionsByYear).sort((a, b) => parseInt(a) - parseInt(b));
        
        // Create optgroups for each year
        years.forEach(year => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = `━━━ Year ${year} ━━━`;
            
            // Sort sections within year by shift, then name
            const yearSections = sectionsByYear[year].sort((a, b) => {
                if (a.shift !== b.shift) {
                    return a.shift.localeCompare(b.shift);
                }
                return a.sectionName.localeCompare(b.sectionName);
            });
            
            yearSections.forEach(section => {
                const option = document.createElement('option');
                option.value = section._id;
                option.textContent = `${section.sectionName} (${section.shift})`;
                optgroup.appendChild(option);
            });
            
            select.appendChild(optgroup);
        });
    }

    // Calendar Navigation - Week-based
    const prevWeekBtn = document.getElementById('prevWeekBtn');
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', function() {
            currentDate.setDate(currentDate.getDate() - 7);
            renderCalendar();
            updateStatistics();
        });
    }

    const nextWeekBtn = document.getElementById('nextWeekBtn');
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', function() {
            currentDate.setDate(currentDate.getDate() + 7);
            renderCalendar();
            updateStatistics();
        });
    }

    // Today button
    const todayBtn = document.getElementById('todayBtn');
    if (todayBtn) {
        todayBtn.addEventListener('click', function() {
            currentDate = new Date();
            renderCalendar();
            updateStatistics();
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
            
            // Populate section filter after sections are loaded
            populateSectionFilter();
            
            // Update statistics dashboard
            updateStatistics();
            
            renderCalendar();
            // Initialize with empty subject assignments if no year level or section selected
            if (currentYearLevel && currentSection) {
                renderSubjectAssignments();
            } else {
                clearSubjectAssignments();
            }
        } catch (error) {
            console.error('Error loading data:', error);
            showBubbleMessage('Error loading schedule data', 'error');
        }
    }

    // Update Statistics Dashboard
    function updateStatistics() {
        // Total Schedules
        const totalSchedules = schedules.length;
        document.getElementById('totalSchedulesCount').textContent = totalSchedules;

        // Room Utilization
        const totalRooms = rooms.length;
        const usedRooms = new Set(schedules.map(s => s.room._id || s.room)).size;
        const roomUtilization = totalRooms > 0 ? Math.round((usedRooms / totalRooms) * 100) : 0;
        document.getElementById('roomUtilization').textContent = `${roomUtilization}%`;

        // Teacher Workload (average hours per teacher)
        const teacherHours = {};
        schedules.forEach(schedule => {
            const teacherId = schedule.teacher._id || schedule.teacher;
            if (!teacherHours[teacherId]) {
                teacherHours[teacherId] = 0;
            }
            const duration = calculateDuration(schedule.startTime, schedule.endTime);
            teacherHours[teacherId] += duration;
        });
        const avgHours = Object.keys(teacherHours).length > 0 
            ? Math.round(Object.values(teacherHours).reduce((a, b) => a + b, 0) / Object.keys(teacherHours).length) 
            : 0;
        document.getElementById('teacherWorkload').textContent = `${avgHours}h`;

        // Schedule Completion (for current section if selected)
        let completionPercentage = 0;
        if (currentSection && currentYearLevel) {
            const sectionSubjects = subjects.filter(s => s.yearLevel === parseInt(currentYearLevel));
            const scheduledSubjects = new Set(
                schedules
                    .filter(s => (s.section._id || s.section) === currentSection)
                    .map(s => s.subject._id || s.subject)
            );
            completionPercentage = sectionSubjects.length > 0 
                ? Math.round((scheduledSubjects.size / sectionSubjects.length) * 100) 
                : 0;
        }
        document.getElementById('scheduleCompletion').textContent = `${completionPercentage}%`;

        // Conflicts Detection
        const conflicts = detectAllConflicts();
        document.getElementById('conflictsCount').textContent = conflicts.length;
        
        // Make conflicts card clickable
        const conflictsCard = document.querySelector('.stat-conflict');
        if (conflictsCard) {
            conflictsCard.onclick = () => {
                if (conflicts.length > 0) {
                    showConflictsModal(conflicts);
                } else {
                    showBubbleMessage('No conflicts detected!', 'success');
                }
            };
        }
    }

    // Calculate duration in hours
    function calculateDuration(startTime, endTime) {
        const start = timeToMinutes(startTime);
        const end = timeToMinutes(endTime);
        return Math.round((end - start) / 60);
    }

    // Detect all conflicts in the system
    function detectAllConflicts() {
        const conflicts = [];
        
        schedules.forEach((schedule, index) => {
            const startMinutes = timeToMinutes(schedule.startTime);
            const endMinutes = timeToMinutes(schedule.endTime);
            
            schedules.forEach((otherSchedule, otherIndex) => {
                if (index >= otherIndex) return; // Skip self and already checked pairs
                
                if (schedule.day !== otherSchedule.day) return; // Different days
                
                const otherStartMinutes = timeToMinutes(otherSchedule.startTime);
                const otherEndMinutes = timeToMinutes(otherSchedule.endTime);
                
                const hasTimeOverlap = (startMinutes < otherEndMinutes && endMinutes > otherStartMinutes);
                
                if (hasTimeOverlap) {
                    // Check for teacher conflict
                    if ((schedule.teacher._id || schedule.teacher) === (otherSchedule.teacher._id || otherSchedule.teacher)) {
                        conflicts.push({
                            type: 'teacher',
                            schedule1: schedule,
                            schedule2: otherSchedule,
                            message: `Teacher conflict: ${schedule.teacher.fullname || 'Teacher'} on ${schedule.day}`
                        });
                    }
                    
                    // Check for room conflict
                    if ((schedule.room._id || schedule.room) === (otherSchedule.room._id || otherSchedule.room)) {
                        conflicts.push({
                            type: 'room',
                            schedule1: schedule,
                            schedule2: otherSchedule,
                            message: `Room conflict: ${schedule.room.roomName || 'Room'} on ${schedule.day}`
                        });
                    }
                    
                    // Check for section conflict
                    if ((schedule.section._id || schedule.section) === (otherSchedule.section._id || otherSchedule.section)) {
                        conflicts.push({
                            type: 'section',
                            schedule1: schedule,
                            schedule2: otherSchedule,
                            message: `Section conflict: ${schedule.section.sectionName || 'Section'} on ${schedule.day}`
                        });
                    }
                }
            });
        });
        
        return conflicts;
    }

    // Show conflicts modal
    function showConflictsModal(conflicts) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        
        const conflictsList = conflicts.map((c, i) => `
            <div class="conflict-item" style="padding: 12px; background: #ffebee; border-left: 4px solid #d32f2f; margin-bottom: 8px; border-radius: 4px;">
                <strong>${i + 1}. ${c.type.toUpperCase()} CONFLICT</strong>
                <p style="margin: 4px 0;">${c.message}</p>
                <small style="color: #666;">
                    ${c.schedule1.startTime} - ${c.schedule1.endTime} vs 
                    ${c.schedule2.startTime} - ${c.schedule2.endTime}
                </small>
            </div>
        `).join('');
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
                <h3 style="color: #d32f2f; display: flex; align-items: center; gap: 8px;">
                    <i class="bi bi-exclamation-triangle"></i>
                    Schedule Conflicts Detected (${conflicts.length})
                </h3>
                <div style="margin: 20px 0;">
                    ${conflictsList}
                </div>
                <div class="modal-actions">
                    <button type="button" class="modal-cancel" id="closeConflictsModal">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        
        const closeBtn = modal.querySelector('#closeConflictsModal');
        closeBtn.onclick = () => {
            document.body.removeChild(modal);
            document.body.style.overflow = 'auto';
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                document.body.style.overflow = 'auto';
            }
        };
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

        if (!currentSection) {
            container.innerHTML = '<div class="no-selection">Select a section to see subject progress.</div>';
            return;
        }

        const filteredSubjects = subjects.filter(s => s.yearLevel === parseInt(currentYearLevel));
        const selectedSection = sections.find(s => s._id === currentSection);

        if (filteredSubjects.length === 0) {
            container.innerHTML = '<div class="no-selection">No subjects for this year level.</div>';
            return;
        }

        if (!selectedSection) {
            container.innerHTML = '<div class="no-selection">Section not found.</div>';
            return;
        }

        filteredSubjects.forEach(subject => {
            const card = document.createElement('div');
            card.className = 'subject-assignment-card';

            const allocated = calculateAllocatedHours(subject._id, currentSection);
            const total = parseFloat(subject.totalHours) || 0;
            const progressHtml = `${selectedSection.sectionName} - ${selectedSection.shift}: ${allocated}/${total} hours`;

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

    // Render calendar with filters for year level and section
    function renderCalendar() {
        const grid = document.getElementById('calendarGrid');
        if (!grid) return;

        grid.innerHTML = '';

        // Update week range display
        const weekRangeEl = document.getElementById('currentWeekRange');
        const weekNumberEl = document.getElementById('weekNumber');
        
        if (weekRangeEl) {
            const startOfWeek = getStartOfWeek(currentDate);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 5); // Saturday
            
            const formatDate = (date) => {
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            };
            
            weekRangeEl.textContent = `Week of ${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`;
        }
        
        if (weekNumberEl) {
            const weekNum = getWeekNumber(currentDate);
            weekNumberEl.textContent = `Week ${weekNum}`;
        }

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = new Date();
        const todayDay = today.toLocaleDateString('en-US', { weekday: 'long' });
        
        days.forEach(day => {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';
            
            // Highlight today
            if (day === todayDay && isCurrentWeek(currentDate)) {
                dayDiv.classList.add('is-today');
            }
            
            // Detect conflicts for this day
            const dayConflicts = detectDayConflicts(day);
            const conflictCount = dayConflicts.length;
            
            if (conflictCount > 0) {
                dayDiv.classList.add('has-conflict');
            }
            
            const headerHTML = conflictCount > 0 
                ? `<h4>${day} <span class="conflict-badge"><i class="bi bi-exclamation-triangle"></i> ${conflictCount}</span></h4>`
                : `<h4>${day}</h4>`;
            
            dayDiv.innerHTML = headerHTML;

            if (currentYearLevel !== '' && currentSection !== '') {
                const daySchedules = schedules.filter(s => 
                    s.day === day &&
                    (s.section._id || s.section) === currentSection
                );

                // Sort schedules by start time
                daySchedules.sort((a, b) => {
                    let aStart = parseInt(a.startTime.replace(':', ''));
                    if (a.startPeriod === 'PM' && !a.startTime.startsWith('12')) aStart += 1200;
                    let bStart = parseInt(b.startTime.replace(':', ''));
                    if (b.startPeriod === 'PM' && !b.startTime.startsWith('12')) bStart += 1200;
                    return aStart - bStart;
                });

                daySchedules.forEach(schedule => {
                    const item = document.createElement('div');
                    item.className = `schedule-item ${schedule.scheduleType}`;
                    
                    // Check if this specific schedule has conflicts
                    const hasConflict = scheduleHasConflict(schedule);
                    if (hasConflict) {
                        item.classList.add('has-conflict');
                    }
                    
                    // Ensure time is displayed in 12-hour format with AM/PM
                    const startTime = schedule.startTime || '00:00';
                    const endTime = schedule.endTime || '00:00';
                    const startPeriod = schedule.startPeriod || 'AM';
                    const endPeriod = schedule.endPeriod || 'PM';
                    
                    const timeDisplay = `${startTime} ${startPeriod} - ${endTime} ${endPeriod}`;
                    const subjectCode = schedule.subject.courseCode || 'N/A';
                    const teacherName = schedule.teacher.fullname || 'No Teacher';
                    const roomName = schedule.room.roomName || 'No Room';
                    
                    item.textContent = `${timeDisplay}: ${subjectCode} (${teacherName}) - ${roomName}`;
                    item.onclick = () => showScheduleDetails(schedule);
                    dayDiv.appendChild(item);
                });
            }

            grid.appendChild(dayDiv);
        });
    }

    // Helper: Get start of week (Monday)
    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        return new Date(d.setDate(diff));
    }

    // Helper: Get week number
    function getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    // Helper: Check if date is in current week
    function isCurrentWeek(date) {
        const today = new Date();
        const startOfWeek = getStartOfWeek(today);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        
        const checkDate = new Date(date);
        return checkDate >= startOfWeek && checkDate <= endOfWeek;
    }

    // Detect conflicts for a specific day
    function detectDayConflicts(day) {
        const daySchedules = schedules.filter(s => s.day === day);
        const conflicts = [];
        
        daySchedules.forEach((schedule, index) => {
            daySchedules.forEach((otherSchedule, otherIndex) => {
                if (index >= otherIndex) return;
                
                const startMinutes = timeToMinutes(schedule.startTime);
                const endMinutes = timeToMinutes(schedule.endTime);
                const otherStartMinutes = timeToMinutes(otherSchedule.startTime);
                const otherEndMinutes = timeToMinutes(otherSchedule.endTime);
                
                const hasTimeOverlap = (startMinutes < otherEndMinutes && endMinutes > otherStartMinutes);
                
                if (hasTimeOverlap) {
                    if ((schedule.teacher._id || schedule.teacher) === (otherSchedule.teacher._id || otherSchedule.teacher) ||
                        (schedule.room._id || schedule.room) === (otherSchedule.room._id || otherSchedule.room) ||
                        (schedule.section._id || schedule.section) === (otherSchedule.section._id || otherSchedule.section)) {
                        conflicts.push({ schedule, otherSchedule });
                    }
                }
            });
        });
        
        return conflicts;
    }

    // Check if a specific schedule has conflicts
    function scheduleHasConflict(schedule) {
        return schedules.some(otherSchedule => {
            if (schedule._id === otherSchedule._id) return false;
            if (schedule.day !== otherSchedule.day) return false;
            
            const startMinutes = timeToMinutes(schedule.startTime);
            const endMinutes = timeToMinutes(schedule.endTime);
            const otherStartMinutes = timeToMinutes(otherSchedule.startTime);
            const otherEndMinutes = timeToMinutes(otherSchedule.endTime);
            
            const hasTimeOverlap = (startMinutes < otherEndMinutes && endMinutes > otherStartMinutes);
            
            if (hasTimeOverlap) {
                return (schedule.teacher._id || schedule.teacher) === (otherSchedule.teacher._id || otherSchedule.teacher) ||
                       (schedule.room._id || schedule.room) === (otherSchedule.room._id || otherSchedule.room) ||
                       (schedule.section._id || schedule.section) === (otherSchedule.section._id || otherSchedule.section);
            }
            
            return false;
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
            
            // AUTO-SELECT SECTION: If user has already selected a section from the filter dropdown,
            // automatically pre-select it in the modal's section dropdown
            if (currentSection) {
                const sectionSelect = document.getElementById('sectionSelect');
                if (sectionSelect) {
                    sectionSelect.value = currentSection;
                    // Trigger the change event to update hours info and auto-select room
                    const changeEvent = new Event('change');
                    sectionSelect.dispatchEvent(changeEvent);
                    console.log('Auto-selected section:', currentSection);
                }
            }
            
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
            // Reset form
            if (form) form.reset();
            // Hide conflict alert
            hideConflictAlert();
            // Hide hours info
            if (subjectHoursInfo) subjectHoursInfo.style.display = 'none';
            // Close modal
            if (scheduleModal) scheduleModal.style.display = 'none';
            document.body.style.overflow = 'auto';
            // Reset edit mode
            editMode = false;
            editingScheduleId = null;
        };
    }

    if (scheduleModal) {
        scheduleModal.addEventListener('click', function(e) {
            if (e.target === scheduleModal) {
                // Reset form
                if (form) form.reset();
                // Hide conflict alert
                hideConflictAlert();
                // Hide hours info
                if (subjectHoursInfo) subjectHoursInfo.style.display = 'none';
                // Close modal
                scheduleModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                // Reset edit mode
                editMode = false;
                editingScheduleId = null;
            }
        });
    }

    // Update hours info when subject or section changes
    if (subjectSelect) {
        subjectSelect.addEventListener('change', updateHoursInfo);
    }
    if (sectionSelect) {
        sectionSelect.addEventListener('change', () => {
            updateHoursInfo();
            autoSelectRoomForSection();
        });
    }
    
    // Auto-select room based on section
    function autoSelectRoomForSection() {
        const sectionId = sectionSelect?.value;
        const roomSelect = document.getElementById('roomSelect');
        
        if (!sectionId || !roomSelect) return;
        
        const section = sections.find(s => s._id === sectionId);
        if (!section) return;
        
        // Find room assigned to this section based on shift
        const assignedRoom = rooms.find(room => {
            if (section.shift.toLowerCase() === 'day') {
                return room.daySection === section.sectionName;
            } else if (section.shift.toLowerCase() === 'night') {
                return room.nightSection === section.sectionName;
            }
            return false;
        });
        
        if (assignedRoom) {
            roomSelect.value = assignedRoom._id;
            console.log(`Auto-selected room: ${assignedRoom.roomName} for section: ${section.sectionName}`);
        }
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

    // Convert time to minutes for comparison
    function timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    // Convert minutes back to time string
    function minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
    
    // Convert schedule time to 24-hour format for comparison
    function scheduleTimeTo24Hour(schedule) {
        let [hours, minutes] = schedule.startTime.split(':').map(Number);
        if (schedule.startPeriod === 'PM' && hours !== 12) hours += 12;
        if (schedule.startPeriod === 'AM' && hours === 12) hours = 0;
        const startTime24 = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        
        [hours, minutes] = schedule.endTime.split(':').map(Number);
        if (schedule.endPeriod === 'PM' && hours !== 12) hours += 12;
        if (schedule.endPeriod === 'AM' && hours === 12) hours = 0;
        const endTime24 = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        
        return { startTime24, endTime24 };
    }
    
    // Check for schedule conflicts
    function checkScheduleConflicts(formData) {
        const conflicts = [];
        const startMinutes = timeToMinutes(formData.startTime);
        const endMinutes = timeToMinutes(formData.endTime);
        
        // Filter schedules for the same day, excluding current schedule if editing
        const daySchedules = schedules.filter(s => 
            s.day === formData.day && 
            (!editMode || s._id !== editingScheduleId)
        );
        
        // CRITICAL CONSTRAINT: Check if another teacher is already assigned to this subject in this section
        // This check is independent of time/day - it's a global constraint
        const subjectSectionConflict = schedules.find(s => 
            (s.subject._id || s.subject) === formData.subject &&
            (s.section._id || s.section) === formData.section &&
            (s.teacher._id || s.teacher) !== formData.teacher &&
            (!editMode || s._id !== editingScheduleId)
        );
        
        if (subjectSectionConflict) {
            const subject = subjects.find(sub => (sub._id === formData.subject));
            const section = sections.find(sec => (sec._id === formData.section));
            const existingTeacher = teachers.find(t => (t._id === (subjectSectionConflict.teacher._id || subjectSectionConflict.teacher)));
            
            conflicts.push({
                type: 'subject-teacher-constraint',
                schedule: subjectSectionConflict,
                message: `${subject?.courseCode || 'This subject'} in section ${section?.sectionName || 'this section'} is already assigned to ${existingTeacher?.fullname || 'another teacher'}. Only one teacher can teach a subject per section.`,
                critical: true // Mark as critical - cannot be overridden
            });
        }
        
        daySchedules.forEach(schedule => {
            // Convert existing schedule to 24-hour format for comparison
            const { startTime24, endTime24 } = scheduleTimeTo24Hour(schedule);
            const schedStartMinutes = timeToMinutes(startTime24);
            const schedEndMinutes = timeToMinutes(endTime24);
            
            // Check for time overlap
            const hasTimeOverlap = (startMinutes < schedEndMinutes && endMinutes > schedStartMinutes);
            
            if (hasTimeOverlap) {
                // Check teacher conflict
                if ((schedule.teacher._id || schedule.teacher) === formData.teacher) {
                    conflicts.push({
                        type: 'teacher',
                        schedule: schedule,
                        message: `Teacher ${schedule.teacher.fullname} is already teaching ${schedule.subject.courseCode} at this time`
                    });
                }
                
                // Check room conflict
                if ((schedule.room._id || schedule.room) === formData.room) {
                    conflicts.push({
                        type: 'room',
                        schedule: schedule,
                        message: `${schedule.room.roomName} is already occupied by ${schedule.subject.courseCode} at this time`
                    });
                }
                
                // Check section conflict
                if ((schedule.section._id || schedule.section) === formData.section) {
                    conflicts.push({
                        type: 'section',
                        schedule: schedule,
                        message: `Section ${schedule.section.sectionName} already has ${schedule.subject.courseCode} scheduled at this time`
                    });
                }
            }
        });
        
        return conflicts;
    }
    
    // Suggest alternative time slots
    function suggestAlternativeTimeSlots(formData, conflicts) {
        const startMinutes = timeToMinutes(formData.startTime);
        const endMinutes = timeToMinutes(formData.endTime);
        const duration = endMinutes - startMinutes;
        
        // Get all schedules for the same day
        const daySchedules = schedules.filter(s => 
            s.day === formData.day &&
            (!editMode || s._id !== editingScheduleId)
        );
        
        // Create a list of busy time slots (convert to 24-hour format)
        const busySlots = daySchedules.map(s => {
            const { startTime24, endTime24 } = scheduleTimeTo24Hour(s);
            return {
                start: timeToMinutes(startTime24),
                end: timeToMinutes(endTime24),
                teacher: s.teacher._id || s.teacher,
                room: s.room._id || s.room,
                section: s.section._id || s.section
            };
        });
        
        // Define working hours (7 AM to 9 PM)
        const workStart = 7 * 60; // 7:00 AM
        const workEnd = 21 * 60;  // 9:00 PM
        
        const suggestions = [];
        
        // Try slots near the requested time (within 2 hours before and after)
        const searchStart = Math.max(workStart, startMinutes - 120);
        const searchEnd = Math.min(workEnd - duration, startMinutes + 120);
        
        for (let testStart = searchStart; testStart <= searchEnd; testStart += 30) {
            const testEnd = testStart + duration;
            
            // Check if this slot conflicts with any existing schedule
            let hasConflict = false;
            
            for (const busy of busySlots) {
                const hasTimeOverlap = (testStart < busy.end && testEnd > busy.start);
                
                if (hasTimeOverlap) {
                    // Check if it conflicts with our teacher, room, or section
                    if (busy.teacher === formData.teacher || 
                        busy.room === formData.room || 
                        busy.section === formData.section) {
                        hasConflict = true;
                        break;
                    }
                }
            }
            
            if (!hasConflict) {
                suggestions.push({
                    startTime: minutesToTime(testStart),
                    endTime: minutesToTime(testEnd),
                    distance: Math.abs(testStart - startMinutes) // Distance from original time
                });
                
                // Limit to 3 suggestions
                if (suggestions.length >= 3) break;
            }
        }
        
        // Sort by distance from original time
        suggestions.sort((a, b) => a.distance - b.distance);
        
        return suggestions;
    }
    
    // Display conflict alert with suggestions
    function displayConflictAlert(conflicts, suggestions) {
        const conflictAlert = document.getElementById('conflictAlert');
        const conflictDetails = document.getElementById('conflictDetails');
        const recommendationsDiv = document.getElementById('recommendations');
        
        if (!conflictAlert || !conflictDetails || !recommendationsDiv) return;
        
        // Check if there are critical conflicts (subject-teacher constraint)
        const hasCriticalConflict = conflicts.some(c => c.critical);
        
        // Show conflict details
        const conflictMessages = conflicts.map(c => c.message).join('; ');
        conflictDetails.textContent = conflictMessages;
        
        // If there's a critical conflict, don't show time suggestions (they won't help)
        if (hasCriticalConflict) {
            recommendationsDiv.innerHTML = `
                <div class="critical-conflict-notice">
                    <strong>⚠️ Critical Constraint Violation</strong>
                    <p>This conflict cannot be resolved by changing the time. You must either:</p>
                    <ul>
                        <li>Select a different teacher for this subject-section combination, OR</li>
                        <li>Remove the existing schedule for this subject-section before assigning a new teacher</li>
                    </ul>
                </div>
            `;
        } else {
            // Show suggestions for time-based conflicts
            if (suggestions.length > 0) {
                recommendationsDiv.innerHTML = `
                    <strong>Suggested alternative times:</strong>
                    <div class="suggestion-list">
                        ${suggestions.map((sug, index) => `
                            <button type="button" class="suggestion-btn" data-start="${sug.startTime}" data-end="${sug.endTime}">
                                ${sug.startTime} - ${sug.endTime}
                            </button>
                        `).join('')}
                    </div>
                `;
                
                // Add click handlers for suggestions
                recommendationsDiv.querySelectorAll('.suggestion-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        document.getElementById('startTime').value = this.dataset.start;
                        document.getElementById('endTime').value = this.dataset.end;
                        conflictAlert.style.display = 'none';
                        showBubbleMessage('Time updated to suggested slot. Please review and submit again.', 'info');
                    });
                });
            } else {
                recommendationsDiv.innerHTML = '<p>No alternative time slots available nearby. Please choose a different time manually.</p>';
            }
        }
        
        conflictAlert.style.display = 'block';
    }
    
    // Hide conflict alert
    function hideConflictAlert() {
        const conflictAlert = document.getElementById('conflictAlert');
        if (conflictAlert) conflictAlert.style.display = 'none';
    }
    
    // Convert 24-hour time to 12-hour format with AM/PM
    function convertTo12Hour(time24) {
        const [hours24, minutes] = time24.split(':').map(Number);
        let hours12 = hours24 % 12;
        if (hours12 === 0) hours12 = 12;
        const period = hours24 >= 12 ? 'PM' : 'AM';
        const time12 = `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        return { time: time12, period };
    }
    
    // Form submit
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            // Hide previous conflict alerts
            hideConflictAlert();
            
            const startTime24 = document.getElementById('startTime').value;
            const endTime24 = document.getElementById('endTime').value;
            
            // Convert to 12-hour format for backend
            const startConverted = convertTo12Hour(startTime24);
            const endConverted = convertTo12Hour(endTime24);
            
            const formData = {
                subject: document.getElementById('subjectSelect').value,
                teacher: document.getElementById('teacherSelect').value,
                section: document.getElementById('sectionSelect').value,
                room: document.getElementById('roomSelect').value,
                day: document.getElementById('daySelect').value,
                startTime: startConverted.time,
                endTime: endConverted.time,
                startPeriod: startConverted.period,
                endPeriod: endConverted.period,
                scheduleType: document.querySelector('input[name="scheduleType"]:checked').value
            };

            // Basic validation
            if (!formData.subject || !formData.teacher || !formData.section || !formData.room || !formData.day || !startTime24 || !endTime24) {
                showBubbleMessage('Please fill all required fields.', 'error');
                return;
            }
            
            // Validate time range using 24-hour format
            const startMinutes = timeToMinutes(startTime24);
            const endMinutes = timeToMinutes(endTime24);
            
            if (endMinutes <= startMinutes) {
                showBubbleMessage('End time must be after start time.', 'error');
                return;
            }
            
            // Check for conflicts using 24-hour format
            const conflictCheckData = {
                ...formData,
                startTime: startTime24,
                endTime: endTime24
            };
            
            const conflicts = checkScheduleConflicts(conflictCheckData);
            
            if (conflicts.length > 0) {
                const suggestions = suggestAlternativeTimeSlots(conflictCheckData, conflicts);
                displayConflictAlert(conflicts, suggestions);
                showBubbleMessage('Schedule conflict detected! Please review the suggestions below.', 'error');
                return;
            }

            try {
                let url = '/schedules';
                let method = 'POST';
                if (editMode) {
                    url += `/${editingScheduleId}`;
                    method = 'PUT';
                }

                console.log('Submitting schedule data:', formData);

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
                
                // Convert old format (with AM/PM) to 24-hour format if needed
                let startTime = schedule.startTime;
                let endTime = schedule.endTime;
                
                if (schedule.startPeriod && schedule.endPeriod) {
                    // Convert from 12-hour to 24-hour format
                    startTime = convertTo24Hour(schedule.startTime, schedule.startPeriod);
                    endTime = convertTo24Hour(schedule.endTime, schedule.endPeriod);
                }
                
                document.getElementById('startTime').value = startTime;
                document.getElementById('endTime').value = endTime;
                document.querySelector(`input[name="scheduleType"][value="${schedule.scheduleType}"]`).checked = true;
            }
            
            // Helper function to convert 12-hour to 24-hour format
            function convertTo24Hour(time, period) {
                let [hours, minutes] = time.split(':').map(Number);
                
                if (period === 'PM' && hours !== 12) {
                    hours += 12;
                } else if (period === 'AM' && hours === 12) {
                    hours = 0;
                }
                
                return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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
                updateStatistics();
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

    // Export schedule functionality
    async function setupExportButton() {
        const exportBtn = document.getElementById('exportScheduleBtn');
        if (!exportBtn) return;

        exportBtn.addEventListener('click', async function() {
            try {
                if (!schedules || schedules.length === 0) {
                    showBubbleMessage('No schedules to export', 'error');
                    return;
                }

                // Filter schedules based on current selection
                let schedulesToExport = schedules;
                let exportDescription = 'All Schedules';
                let filename = 'all_schedules';

                // If year level and section are selected, filter schedules
                if (currentYearLevel !== '' && currentSection !== '') {
                    schedulesToExport = schedules.filter(s => 
                        (s.section._id || s.section) === currentSection
                    );

                    // Get section details for better naming
                    const selectedSection = sections.find(s => s._id === currentSection);
                    if (selectedSection) {
                        exportDescription = `${selectedSection.sectionName} (${selectedSection.shift})`;
                        filename = `schedule_${selectedSection.sectionName.replace(/\s+/g, '_')}_${selectedSection.shift}`;
                    }
                } else if (currentYearLevel !== '') {
                    // If only year level is selected, filter by year level
                    schedulesToExport = schedules.filter(s => {
                        const section = sections.find(sec => (sec._id === s.section._id || sec._id === s.section));
                        return section && section.yearLevel === parseInt(currentYearLevel);
                    });
                    exportDescription = `Year ${currentYearLevel} Schedules`;
                    filename = `schedules_year_${currentYearLevel}`;
                }

                if (schedulesToExport.length === 0) {
                    showBubbleMessage('No schedules to export with current filter', 'error');
                    return;
                }

                // Import the export module
                const { default: scheduleExporter } = await import('./schedule-export.js');

                // Prepare user info
                const currentUser = AuthGuard.getCurrentUser();
                const userInfo = {
                    name: currentUser?.fullname || 'Administrator',
                    role: 'Administrator',
                    section: exportDescription,
                    ctuid: currentUser?.ctuid || 'N/A',
                    profilePicture: currentUser?.profilePicture || null
                };

                // Show export dialog
                const result = await scheduleExporter.showExportDialog(
                    schedulesToExport,
                    userInfo,
                    filename
                );

                if (result) {
                    showBubbleMessage(
                        `${exportDescription} exported successfully as ${result.toUpperCase()}! (${schedulesToExport.length} schedule${schedulesToExport.length !== 1 ? 's' : ''})`,
                        'success'
                    );
                }
            } catch (error) {
                console.error('Export error:', error);
                showBubbleMessage(
                    'Failed to export schedules: ' + error.message,
                    'error'
                );
            }
        });
    }

    // Initial load
    loadAllData();
    setupExportButton();
});