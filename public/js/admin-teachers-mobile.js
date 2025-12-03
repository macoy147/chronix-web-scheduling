/**
 * Admin Teachers Mobile JavaScript
 */

import AuthGuard from './auth-guard.js';

// State management
let allTeachers = [];
let allSchedules = [];
let currentTeacherId = null;
let currentScheduleView = 'weekly';
let currentDayIndex = 0;
let currentTeacherSchedules = [];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

document.addEventListener('DOMContentLoaded', async function() {
    if (!AuthGuard.checkAuthentication('admin')) return;
    initializeMobileMenu();
    initializeEventListeners();
    updateMobileProfileInfo();
    await loadTeachers();
});

function initializeMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileSideMenu = document.getElementById('mobileSideMenu');
    const mobileSideMenuClose = document.getElementById('mobileSideMenuClose');
    const mobileOverlay = document.getElementById('mobileOverlay');

    function openMobileMenu() {
        mobileSideMenu?.classList.add('open');
        mobileOverlay?.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
        mobileSideMenu?.classList.remove('open');
        mobileOverlay?.classList.remove('open');
        document.body.style.overflow = '';
    }

    mobileMenuBtn?.addEventListener('click', openMobileMenu);
    mobileSideMenuClose?.addEventListener('click', closeMobileMenu);
    mobileOverlay?.addEventListener('click', closeMobileMenu);
    document.querySelectorAll('.mobile-side-menu-links a').forEach(link => link.addEventListener('click', closeMobileMenu));

    document.getElementById('mobileLogoutBtn')?.addEventListener('click', function(e) {
        e.preventDefault();
        if (confirm('Are you sure you want to logout?')) AuthGuard.logout();
    });
}

function updateMobileProfileInfo() {
    const currentUser = AuthGuard.getCurrentUser();
    if (currentUser) {
        const mobileProfileName = document.getElementById('mobileProfileName');
        if (mobileProfileName) mobileProfileName.textContent = currentUser.fullname;
        
        // Update profile avatar in side menu
        const mobileProfileAvatar = document.getElementById('mobileProfileAvatar');
        if (mobileProfileAvatar && currentUser.profilePicture) {
            mobileProfileAvatar.src = currentUser.profilePicture.startsWith('http') 
                ? currentUser.profilePicture 
                : currentUser.profilePicture;
        } else if (mobileProfileAvatar) {
            mobileProfileAvatar.src = '/img/default_admin_avatar.png';
        }
        
        // Update profile avatar in header (top bar)
        const mobileHeaderProfileAvatar = document.getElementById('mobileHeaderProfileAvatar');
        if (mobileHeaderProfileAvatar && currentUser.profilePicture) {
            mobileHeaderProfileAvatar.src = currentUser.profilePicture.startsWith('http') 
                ? currentUser.profilePicture 
                : currentUser.profilePicture;
        } else if (mobileHeaderProfileAvatar) {
            mobileHeaderProfileAvatar.src = '/img/default_admin_avatar.png';
        }
    }
}

function initializeEventListeners() {
    // Search with debounce
    const searchInput = document.getElementById('mobileTeacherSearch');
    let searchTimeout;
    searchInput?.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => applyFilters(), 300);
    });

    // Modal close buttons
    document.getElementById('closeScheduleModal')?.addEventListener('click', closeScheduleModal);
    document.getElementById('closeTeacherDetailsModal')?.addEventListener('click', closeTeacherDetailsModal);

    // Schedule view toggle
    document.querySelectorAll('.schedule-view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.schedule-view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderScheduleView(this.dataset.view);
        });
    });

    // Keyboard - close modals on Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeScheduleModal();
            closeTeacherDetailsModal();
        }
    });

    // Close modals when clicking outside
    document.getElementById('teacherDetailsModal')?.addEventListener('click', function(e) {
        if (e.target === this) {
            closeTeacherDetailsModal();
        }
    });

    document.getElementById('scheduleModal')?.addEventListener('click', function(e) {
        if (e.target === this) {
            closeScheduleModal();
        }
    });
}

// ==================== DATA LOADING ====================

async function loadTeachers() {
    try {
        const teachersRes = await fetch('/teachers');
        if (teachersRes.ok) {
            allTeachers = await teachersRes.json();
        }
        
        try {
            const schedulesRes = await fetch('/schedules');
            if (schedulesRes.ok) {
                allSchedules = await schedulesRes.json();
            }
        } catch (err) {
            console.log('Could not load schedules for stats');
        }
        
        updateStats();
        displayTeachers(allTeachers);
    } catch (error) {
        console.error('Error loading teachers:', error);
        document.getElementById('mobileTeachersList').innerHTML = `
            <div class="loading-state">
                <i class="bi bi-exclamation-triangle" style="font-size: 2rem; display: block; margin-bottom: 10px;"></i>
                <span>Error loading teachers</span>
            </div>
        `;
    }
}

function updateStats() {
    const totalTeachers = allTeachers.length;
    let activeCount = 0;
    let inactiveCount = 0;
    let totalHours = 0;

    allTeachers.forEach(teacher => {
        const hasSchedules = allSchedules.some(schedule => 
            (schedule.teacher._id || schedule.teacher) === teacher._id
        );
        
        if (hasSchedules) {
            activeCount++;
        } else {
            inactiveCount++;
        }

        // Calculate total teaching hours for this teacher
        const teacherSchedules = allSchedules.filter(schedule => 
            (schedule.teacher._id || schedule.teacher) === teacher._id
        );
        
        teacherSchedules.forEach(schedule => {
            if (schedule.startTime && schedule.endTime) {
                const duration = calculateDuration(
                    schedule.startTime, 
                    schedule.startPeriod, 
                    schedule.endTime, 
                    schedule.endPeriod
                );
                totalHours += duration;
            }
        });
    });

    document.getElementById('totalTeachers').textContent = totalTeachers;
    document.getElementById('activeTeachers').textContent = activeCount;
    document.getElementById('inactiveTeachers').textContent = inactiveCount;
    document.getElementById('totalTeachingHours').textContent = Math.round(totalHours);
}

function displayTeachers(teachers) {
    const list = document.getElementById('mobileTeachersList');
    if (!teachers || teachers.length === 0) {
        list.innerHTML = `
            <div class="loading-state">
                <i class="bi bi-inbox" style="font-size: 2rem; display: block; margin-bottom: 10px;"></i>
                <span>No teachers found</span>
            </div>
        `;
        return;
    }

    list.innerHTML = '';
    teachers.forEach(teacher => {
        const advisorySection = teacher.advisorySection || teacher.section || 'No advisory section';
        const card = document.createElement('div');
        card.className = 'mobile-teacher-card';
        card.innerHTML = `
            <div class="mobile-teacher-header">
                <img src="${teacher.profilePicture || '/img/default_admin_avatar.png'}" 
                     alt="${teacher.fullname}" 
                     class="mobile-teacher-avatar">
                <div class="mobile-teacher-info">
                    <div class="mobile-teacher-name">${teacher.fullname}</div>
                    <div class="mobile-teacher-id">${teacher.ctuid}</div>
                </div>
            </div>
            <div class="mobile-teacher-details">
                <div class="mobile-teacher-detail">
                    <i class="bi bi-envelope"></i>
                    <span>${teacher.email}</span>
                </div>
                <div class="mobile-teacher-detail">
                    <i class="bi bi-people"></i>
                    <span>${advisorySection}</span>
                </div>
                <div class="mobile-teacher-detail">
                    <i class="bi bi-telephone"></i>
                    <span>${teacher.phone || 'No phone'}</span>
                </div>
                <div class="mobile-teacher-detail">
                    <i class="bi bi-building"></i>
                    <span>${teacher.department || 'No department'}</span>
                </div>
            </div>
            <div class="mobile-teacher-actions">
                <button class="mobile-teacher-action-btn view" onclick="viewTeacher('${teacher._id}')">
                    <i class="bi bi-eye"></i> View
                </button>
                <button class="mobile-teacher-action-btn schedule" onclick="viewSchedule('${teacher._id}')">
                    <i class="bi bi-calendar"></i> Schedule
                </button>
            </div>
        `;
        list.appendChild(card);
    });
}

function applyFilters() {
    const searchTerm = document.getElementById('mobileTeacherSearch')?.value.toLowerCase() || '';

    let filtered = allTeachers;

    if (searchTerm) {
        filtered = filtered.filter(t => 
            t.fullname.toLowerCase().includes(searchTerm) ||
            t.email.toLowerCase().includes(searchTerm) ||
            t.ctuid.toLowerCase().includes(searchTerm)
        );
    }

    displayTeachers(filtered);
}

// ==================== TEACHER ACTIONS ====================

window.viewTeacher = async function(id) {
    const teacher = allTeachers.find(t => t._id === id);
    if (!teacher) {
        alert('Teacher not found');
        return;
    }

    currentTeacherId = id;

    // Load teacher's schedules
    try {
        const res = await fetch('/schedules');
        if (res.ok) {
            const allSchedules = await res.json();
            currentTeacherSchedules = allSchedules.filter(s => 
                (s.teacher._id || s.teacher) === id
            );
        }
    } catch (error) {
        console.error('Error loading schedules:', error);
        currentTeacherSchedules = [];
    }

    openTeacherDetailsModal(teacher);
};

window.viewSchedule = async function(teacherId) {
    currentTeacherId = teacherId;
    const teacher = allTeachers.find(t => t._id === teacherId);
    
    if (!teacher) {
        alert('Teacher not found');
        return;
    }

    try {
        const res = await fetch('/schedules');
        if (res.ok) {
            const allSchedules = await res.json();
            currentTeacherSchedules = allSchedules.filter(s => 
                (s.teacher._id || s.teacher) === teacherId
            );
            
            if (currentTeacherSchedules.length === 0) {
                alert('No schedules found for this teacher');
                return;
            }
            
            openScheduleModal(teacher);
        }
    } catch (error) {
        console.error('Error loading schedule:', error);
        alert('Error loading schedule');
    }
};

// ==================== TEACHER DETAILS MODAL ====================

function openTeacherDetailsModal(teacher) {
    const modal = document.getElementById('teacherDetailsModal');
    if (!modal) return;

    // Set teacher basic info
    document.getElementById('detailsTeacherName').textContent = teacher.fullname;
    document.getElementById('detailsTeacherId').textContent = teacher.ctuid;
    document.getElementById('detailsTeacherAvatar').src = teacher.profilePicture || '/img/default_admin_avatar.png';

    // Set personal information
    document.getElementById('detailsFullName').textContent = teacher.fullname;
    document.getElementById('detailsEmail').textContent = teacher.email;
    document.getElementById('detailsPhone').textContent = teacher.phone || 'Not provided';
    document.getElementById('detailsDepartment').textContent = teacher.department || 'Not assigned';

    // Set teaching information
    const advisorySection = teacher.advisorySection || teacher.section || 'No advisory section';
    document.getElementById('detailsAdvisorySection').textContent = advisorySection;

    // Calculate teaching stats
    const uniqueSubjects = new Set();
    let totalHours = 0;

    currentTeacherSchedules.forEach(schedule => {
        if (schedule.subject) {
            const subjectId = schedule.subject._id || schedule.subject;
            uniqueSubjects.add(subjectId);
        }
        
        if (schedule.startTime && schedule.endTime) {
            const duration = calculateDuration(
                schedule.startTime, 
                schedule.startPeriod, 
                schedule.endTime, 
                schedule.endPeriod
            );
            totalHours += duration;
        }
    });

    document.getElementById('detailsTotalSubjects').textContent = uniqueSubjects.size;
    document.getElementById('detailsTeachingHours').textContent = `${Math.round(totalHours)} hrs`;

    // Set status
    const statusElement = document.getElementById('detailsStatus');
    const hasSchedules = currentTeacherSchedules.length > 0;
    statusElement.innerHTML = hasSchedules 
        ? '<span class="status-badge">Active</span>' 
        : '<span class="status-badge inactive">Inactive</span>';

    // Display assigned subjects
    displayTeacherSubjects();

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function displayTeacherSubjects() {
    const container = document.getElementById('detailsSubjectsList');
    if (!container) return;

    if (currentTeacherSchedules.length === 0) {
        container.innerHTML = '<p class="details-empty">No subjects assigned</p>';
        return;
    }

    // Group schedules by subject
    const subjectMap = new Map();
    currentTeacherSchedules.forEach(schedule => {
        if (schedule.subject) {
            const subjectId = schedule.subject._id || schedule.subject;
            if (!subjectMap.has(subjectId)) {
                subjectMap.set(subjectId, {
                    subject: schedule.subject,
                    sections: new Set(),
                    schedules: []
                });
            }
            const subjectData = subjectMap.get(subjectId);
            if (schedule.section) {
                subjectData.sections.add(schedule.section.sectionName || 'N/A');
            }
            subjectData.schedules.push(schedule);
        }
    });

    container.innerHTML = '';
    subjectMap.forEach((data, subjectId) => {
        const subject = data.subject;
        const card = document.createElement('div');
        card.className = 'details-subject-card';
        
        const sectionsArray = Array.from(data.sections);
        const totalHours = data.schedules.reduce((sum, s) => {
            return sum + calculateDuration(s.startTime, s.startPeriod, s.endTime, s.endPeriod);
        }, 0);

        card.innerHTML = `
            <div class="details-subject-code">${subject.courseCode || 'N/A'}</div>
            <div class="details-subject-title">${subject.courseTitle || ''}</div>
            <div class="details-subject-meta">
                <span><i class="bi bi-layers"></i> ${sectionsArray.length} section(s)</span>
                <span><i class="bi bi-clock"></i> ${Math.round(totalHours)} hrs/week</span>
                <span><i class="bi bi-calendar-week"></i> ${data.schedules.length} schedule(s)</span>
            </div>
        `;
        container.appendChild(card);
    });
}

function closeTeacherDetailsModal() {
    const modal = document.getElementById('teacherDetailsModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

window.viewScheduleFromDetails = function() {
    closeTeacherDetailsModal();
    const teacher = allTeachers.find(t => t._id === currentTeacherId);
    if (teacher && currentTeacherSchedules.length > 0) {
        openScheduleModal(teacher);
    } else {
        alert('No schedules available for this teacher');
    }
};

// ==================== SCHEDULE MODAL ====================

function openScheduleModal(teacher) {
    const modal = document.getElementById('scheduleModal');
    if (!modal) return;

    // Set teacher info
    document.getElementById('scheduleTeacherName').textContent = teacher.fullname;
    document.getElementById('scheduleTeacherSection').textContent = teacher.department || 'No department';
    document.getElementById('scheduleTeacherAvatar').src = teacher.profilePicture || '/img/default_admin_avatar.png';

    // Calculate hours
    calculateScheduleHours();

    // Reset to weekly view
    currentScheduleView = 'weekly';
    currentDayIndex = 0;
    document.querySelectorAll('.schedule-view-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.schedule-view-btn[data-view="weekly"]')?.classList.add('active');

    // Render schedule
    renderScheduleView('weekly');

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeScheduleModal() {
    const modal = document.getElementById('scheduleModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    currentTeacherId = null;
    currentTeacherSchedules = [];
}

function calculateScheduleHours() {
    let lectureHours = 0;
    let labHours = 0;

    currentTeacherSchedules.forEach(schedule => {
        const duration = calculateDuration(schedule.startTime, schedule.startPeriod, schedule.endTime, schedule.endPeriod);
        if (schedule.scheduleType === 'Lab') {
            labHours += duration;
        } else {
            lectureHours += duration;
        }
    });

    document.getElementById('scheduleLectureHours').textContent = lectureHours;
    document.getElementById('scheduleLabHours').textContent = labHours;
    document.getElementById('scheduleTotalHours').textContent = lectureHours + labHours;
}

function calculateDuration(startTime, startPeriod, endTime, endPeriod) {
    const start = convertTo24Hour(startTime, startPeriod);
    const end = convertTo24Hour(endTime, endPeriod);
    return end - start;
}

function convertTo24Hour(time, period) {
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours + (minutes / 60);
}

function renderScheduleView(view) {
    currentScheduleView = view;
    const content = document.getElementById('scheduleContent');
    if (!content) return;

    if (view === 'weekly') {
        renderWeeklyView(content);
    } else {
        renderDailyView(content);
    }
}

function renderWeeklyView(container) {
    const grid = document.createElement('div');
    grid.className = 'weekly-schedule-grid';

    DAYS.forEach(day => {
        const daySchedules = currentTeacherSchedules.filter(s => s.day === day);
        const column = document.createElement('div');
        column.className = 'schedule-day-column';
        
        const header = document.createElement('div');
        header.className = 'schedule-day-header';
        header.textContent = day.substring(0, 3);
        
        const content = document.createElement('div');
        content.className = 'schedule-day-content';
        
        if (daySchedules.length === 0) {
            content.innerHTML = '<div class="no-class">No classes</div>';
        } else {
            daySchedules.sort((a, b) => {
                const timeA = convertTo24Hour(a.startTime, a.startPeriod);
                const timeB = convertTo24Hour(b.startTime, b.startPeriod);
                return timeA - timeB;
            });
            
            daySchedules.forEach(schedule => {
                const card = document.createElement('div');
                card.className = `schedule-card ${schedule.scheduleType === 'Lab' ? 'lab' : ''}`;
                card.innerHTML = `
                    <div class="schedule-time">${schedule.startTime} ${schedule.startPeriod}</div>
                    <div class="schedule-subject">${schedule.subject?.courseCode || 'N/A'}</div>
                    <div class="schedule-room">${schedule.section?.sectionName || 'N/A'}</div>
                    <div class="schedule-room">${schedule.room?.roomName || 'N/A'}</div>
                `;
                content.appendChild(card);
            });
        }
        
        column.appendChild(header);
        column.appendChild(content);
        grid.appendChild(column);
    });

    container.innerHTML = '';
    container.appendChild(grid);
}

function renderDailyView(container) {
    const view = document.createElement('div');
    view.className = 'daily-schedule-view';

    const nav = document.createElement('div');
    nav.className = 'daily-nav';
    nav.innerHTML = `
        <button class="daily-nav-btn" id="prevDay"><i class="bi bi-chevron-left"></i></button>
        <h3 class="daily-current-day">${DAYS[currentDayIndex]}</h3>
        <button class="daily-nav-btn" id="nextDay"><i class="bi bi-chevron-right"></i></button>
    `;

    const list = document.createElement('div');
    list.className = 'daily-schedule-list';

    const daySchedules = currentTeacherSchedules.filter(s => s.day === DAYS[currentDayIndex]);
    
    if (daySchedules.length === 0) {
        list.innerHTML = '<div class="no-class-daily"><i class="bi bi-calendar-x"></i><p>No classes scheduled</p></div>';
    } else {
        daySchedules.sort((a, b) => {
            const timeA = convertTo24Hour(a.startTime, a.startPeriod);
            const timeB = convertTo24Hour(b.startTime, b.startPeriod);
            return timeA - timeB;
        });
        
        daySchedules.forEach(schedule => {
            const card = document.createElement('div');
            card.className = `daily-schedule-card ${schedule.scheduleType === 'Lab' ? 'lab' : ''}`;
            card.innerHTML = `
                <div class="daily-schedule-time">
                    <i class="bi bi-clock"></i>
                    ${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}
                </div>
                <div class="daily-schedule-subject">${schedule.subject?.courseCode || 'N/A'}</div>
                <div class="daily-schedule-title">${schedule.subject?.courseTitle || ''}</div>
                <div class="daily-schedule-meta">
                    <span><i class="bi bi-layers"></i> ${schedule.section?.sectionName || 'N/A'}</span>
                    <span><i class="bi bi-door-open"></i> ${schedule.room?.roomName || 'N/A'}</span>
                    <span class="schedule-type-badge ${schedule.scheduleType === 'Lab' ? 'lab' : 'lecture'}">
                        ${schedule.scheduleType || 'Lecture'}
                    </span>
                </div>
            `;
            list.appendChild(card);
        });
    }

    view.appendChild(nav);
    view.appendChild(list);
    container.innerHTML = '';
    container.appendChild(view);

    // Add navigation event listeners
    document.getElementById('prevDay')?.addEventListener('click', () => {
        currentDayIndex = (currentDayIndex - 1 + DAYS.length) % DAYS.length;
        renderDailyView(container);
    });

    document.getElementById('nextDay')?.addEventListener('click', () => {
        currentDayIndex = (currentDayIndex + 1) % DAYS.length;
        renderDailyView(container);
    });
}
