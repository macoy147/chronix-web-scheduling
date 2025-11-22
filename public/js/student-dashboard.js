import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';

// Import AuthGuard (assuming it's available globally, but let's check)
// If AuthGuard is not available, we'll create a fallback

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first - with fallback
    let authCheck = true;
    if (typeof AuthGuard !== 'undefined') {
        if (!AuthGuard.checkAuthentication('student')) {
            return;
        }
    } else {
        console.warn('AuthGuard not found, proceeding without authentication check');
        // You might want to redirect to login here
        // window.location.href = '/login.html';
    }

    // State management
    let currentStudent = null;
    let studentSchedules = [];
    let allSchedules = [];
    let allSections = [];
    let currentView = 'weekly';
    let currentShift = 'all';
    let currentDayIndex = 0;
    let selectedFile = null;

    // Profile dropdown - with safety check
    const profileDropdown = document.querySelector('.student-profile-dropdown');
    if (profileDropdown) {
        profileDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
            profileDropdown.classList.toggle('open');
        });
        document.addEventListener('click', function() {
            profileDropdown.classList.remove('open');
        });
    }

    // Logout functionality - with safety check
    const logoutBtn = document.getElementById('studentLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof AuthGuard !== 'undefined') {
                AuthGuard.logout();
            } else {
                // Fallback logout
                sessionStorage.clear();
                localStorage.clear();
                window.location.href = '/login.html';
            }
        });
    }

    // Navigation - improved with error handling
    setupNavigation();

    function setupNavigation() {
        // Dashboard link
        const dashboardLink = document.getElementById('dashboardLink');
        if (dashboardLink) {
            dashboardLink.addEventListener('click', function(e) {
                e.preventDefault();
                switchView('dashboardView');
                updateNavActive(this);
            });
        }

        // Schedule link
        const scheduleLink = document.getElementById('scheduleLink');
        if (scheduleLink) {
            scheduleLink.addEventListener('click', function(e) {
                e.preventDefault();
                switchView('scheduleView');
                updateNavActive(this);
                renderScheduleViews(); // Refresh schedule data when switching to schedule view
            });
        }

        // Profile link
        const profileLink = document.getElementById('profileLink');
        if (profileLink) {
            profileLink.addEventListener('click', function(e) {
                e.preventDefault();
                switchView('profileView');
                updateNavActive(this);
                updateProfileView(); // Refresh profile data when switching to profile view
            });
        }

        // Student profile button
        const studentProfileBtn = document.getElementById('studentProfileBtn');
        if (studentProfileBtn) {
            studentProfileBtn.addEventListener('click', function(e) {
                e.preventDefault();
                switchView('profileView');
                const profileLink = document.getElementById('profileLink');
                if (profileLink) updateNavActive(profileLink);
                updateProfileView();
            });
        }

        // View full schedule button
        const viewFullScheduleBtn = document.getElementById('viewFullScheduleBtn');
        if (viewFullScheduleBtn) {
            viewFullScheduleBtn.addEventListener('click', function(e) {
                e.preventDefault();
                switchView('scheduleView');
                const scheduleLink = document.getElementById('scheduleLink');
                if (scheduleLink) updateNavActive(scheduleLink);
                renderScheduleViews();
            });
        }
    }

    function switchView(viewId) {
        document.querySelectorAll('.view-section').forEach(view => {
            view.classList.remove('active');
        });
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
        }
    }

    function updateNavActive(clickedElement) {
        document.querySelectorAll('.nav-links li').forEach(li => {
            li.classList.remove('active');
        });
        if (clickedElement && clickedElement.parentElement) {
            clickedElement.parentElement.classList.add('active');
        }
    }

    // Update profile info in navigation
    function updateProfileInfo() {
        let currentUser = null;
        
        // Get current user with fallback
        if (typeof AuthGuard !== 'undefined') {
            currentUser = AuthGuard.getCurrentUser();
        } else {
            // Fallback: try to get from sessionStorage
            const userData = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
            if (userData) {
                currentUser = JSON.parse(userData);
            }
        }
        
        if (currentUser) {
            currentStudent = currentUser;
            const firstName = currentUser.fullname?.split(' ')[0] || 'Student';
            
            // Update navigation profile
            const profileName = document.getElementById('studentProfileName');
            if (profileName) {
                profileName.innerHTML = `${firstName} <i class="bi bi-chevron-down"></i>`;
            }
            
            const profileAvatar = document.getElementById('studentProfileAvatar');
            if (profileAvatar && currentUser.profilePicture) {
                profileAvatar.src = `${API_BASE_URL}${currentUser.profilePicture}`;
            }

            // Update greeting
            const greetingName = document.getElementById('studentGreetingName');
            if (greetingName) {
                greetingName.textContent = firstName;
            }
        }
    }

    // Get user ID with fallback
    function getUserId() {
        if (typeof AuthGuard !== 'undefined') {
            return AuthGuard.getUserId();
        } else {
            // Fallback: try to get from storage
            const userData = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
            if (userData) {
                const user = JSON.parse(userData);
                return user._id;
            }
            return null;
        }
    }

    // Store user session with fallback
    function storeUserSession(userData) {
        if (typeof AuthGuard !== 'undefined') {
            AuthGuard.storeUserSession(userData);
        } else {
            // Fallback: store in sessionStorage
            sessionStorage.setItem('currentUser', JSON.stringify(userData));
        }
    }

    // Fetch student data
    async function fetchStudentData() {
        try {
            const userId = getUserId();
            if (userId) {
                const res = await fetch(`${API_BASE_URL}/user/${userId}`);
                if (res.ok) {
                    const userData = await res.json();
                    storeUserSession(userData);
                    currentStudent = userData;
                    updateProfileInfo();
                    await loadSectionsData();
                    await loadStudentSchedules();
                    updateDashboard();
                } else {
                    throw new Error('Failed to fetch student data');
                }
            } else {
                throw new Error('No user ID found');
            }
        } catch (error) {
            console.error('Error fetching student data:', error);
            showNotification('Error loading student data: ' + error.message, 'error');
        }
    }

    // Load sections data to find student's section
    async function loadSectionsData() {
        try {
            const res = await fetch(`${API_BASE_URL}/sections`);
            if (res.ok) {
                allSections = await res.json();
                console.log('Loaded sections for student:', allSections);
            } else {
                console.error('Failed to load sections');
                allSections = [];
            }
        } catch (error) {
            console.error('Error loading sections:', error);
            allSections = [];
        }
    }

    // Load student schedules based on their section
    async function loadStudentSchedules() {
        try {
            const res = await fetch(`${API_BASE_URL}/schedules`);
            if (res.ok) {
                allSchedules = await res.json();
                // Filter schedules for current student's section
                studentSchedules = allSchedules.filter(schedule => {
                    const studentSection = currentStudent.section;
                    if (!studentSection) return false;
                    
                    const scheduleSectionName = schedule.section?.sectionName || schedule.section;
                    return scheduleSectionName === studentSection;
                });
                console.log('Loaded student schedules:', studentSchedules);
            } else {
                console.error('Failed to load schedules');
                studentSchedules = [];
            }
        } catch (error) {
            console.error('Error loading schedules:', error);
            studentSchedules = [];
        }
    }

    // Calculate schedule duration with proper AM/PM handling
    function calculateScheduleDuration(schedule) {
        const { startTime, endTime, startPeriod, endPeriod } = schedule;
        
        // Convert to 24-hour format for easier calculation
        const convertTo24Hour = (time, period) => {
            let [hours, minutes] = time.split(':').map(Number);
            
            if (period === 'PM' && hours !== 12) {
                hours += 12;
            } else if (period === 'AM' && hours === 12) {
                hours = 0;
            }
            
            return hours * 60 + minutes;
        };

        const startMinutes = convertTo24Hour(startTime, startPeriod);
        const endMinutes = convertTo24Hour(endTime, endPeriod);
        
        // Handle overnight schedules (unlikely but possible)
        const durationMinutes = endMinutes >= startMinutes 
            ? endMinutes - startMinutes 
            : (1440 - startMinutes) + endMinutes; // 1440 minutes in a day
        
        return durationMinutes / 60; // Convert to hours
    }

    // Calculate academic load
    function calculateAcademicLoad(schedules) {
        const subjectMap = new Map();
        
        schedules.forEach(schedule => {
            const subjectId = schedule.subject?._id || schedule.subject;
            if (!subjectId) return;
            
            const subjectKey = subjectId;
            
            if (!subjectMap.has(subjectKey)) {
                subjectMap.set(subjectKey, {
                    subject: schedule.subject,
                    lecHours: 0,
                    labHours: 0,
                    sessions: []
                });
            }
            
            const subjectInfo = subjectMap.get(subjectKey);
            const duration = calculateScheduleDuration(schedule);
            
            if (schedule.scheduleType === 'lecture') {
                subjectInfo.lecHours += duration;
            } else if (schedule.scheduleType === 'lab') {
                subjectInfo.labHours += duration;
            }
            
            subjectInfo.sessions.push({
                day: schedule.day,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                startPeriod: schedule.startPeriod,
                endPeriod: schedule.endPeriod,
                duration: duration,
                room: schedule.room,
                teacher: schedule.teacher
            });
        });
        
        const distinctSubjects = Array.from(subjectMap.values());
        const totalSubjects = distinctSubjects.length;
        
        // Calculate total weekly hours
        const lectureHours = distinctSubjects.reduce((total, subjectInfo) => total + subjectInfo.lecHours, 0);
        const labHours = distinctSubjects.reduce((total, subjectInfo) => total + subjectInfo.labHours, 0);
        const totalWeeklyHours = lectureHours + labHours;
        
        return {
            totalSubjects,
            lectureHours: Math.round(lectureHours * 10) / 10, // Round to 1 decimal
            labHours: Math.round(labHours * 10) / 10,
            totalWeeklyHours: Math.round(totalWeeklyHours * 10) / 10,
            distinctSubjects
        };
    }

    // Update dashboard with student data
    function updateDashboard() {
        // Update current date
        const currentDateDisplay = document.getElementById('currentDateDisplay');
        if (currentDateDisplay) {
            const currentDate = new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            currentDateDisplay.textContent = currentDate;
        }

        if (!studentSchedules.length) {
            console.log('No schedules found for student');
            // Set default values
            document.getElementById('totalSubjects').textContent = '0';
            document.getElementById('lectureHours').textContent = '0';
            document.getElementById('labHours').textContent = '0';
            document.getElementById('studentSection').textContent = currentStudent?.section || 'Not assigned';
            
            updateTodaysSchedule();
            updateWeeklyPreview();
            return;
        }

        const academicLoad = calculateAcademicLoad(studentSchedules);
        
        // Update stats cards
        document.getElementById('totalSubjects').textContent = academicLoad.totalSubjects;
        document.getElementById('lectureHours').textContent = academicLoad.lectureHours;
        document.getElementById('labHours').textContent = academicLoad.labHours;
        
        // Update student section
        const studentSection = currentStudent?.section || 'Not assigned';
        document.getElementById('studentSection').textContent = studentSection;

        // Update schedule displays
        updateTodaysSchedule();
        updateWeeklyPreview();
    }

    // Update today's schedule with better sorting
    function updateTodaysSchedule() {
        const todayScheduleList = document.getElementById('todayScheduleList');
        if (!todayScheduleList) return;
        
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        
        const todaysSchedules = studentSchedules.filter(schedule => 
            schedule.day === today
        ).sort((a, b) => {
            // Convert times to comparable numbers
            const getTimeValue = (schedule) => {
                let timeValue = parseInt(schedule.startTime.replace(':', ''));
                if (schedule.startPeriod === 'PM' && timeValue < 1200) timeValue += 1200;
                if (schedule.startPeriod === 'AM' && timeValue === 1200) timeValue = 0;
                return timeValue;
            };
            
            return getTimeValue(a) - getTimeValue(b);
        });

        if (todaysSchedules.length === 0) {
            todayScheduleList.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-calendar-x"></i>
                    <p>No classes scheduled for today</p>
                </div>
            `;
            return;
        }

        todayScheduleList.innerHTML = todaysSchedules.map(schedule => {
            const roomName = schedule.room?.roomName || schedule.room || 'No room';
            const subjectCode = schedule.subject?.courseCode || schedule.subject || 'No subject';
            const teacherName = schedule.teacher?.fullname || schedule.teacher || 'No teacher';
            
            return `
                <div class="schedule-item-today ${schedule.scheduleType}">
                    <div class="schedule-time">
                        ${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}
                    </div>
                    <div class="schedule-details">
                        <div class="schedule-subject">${subjectCode}</div>
                        <div class="schedule-meta">${teacherName} • ${roomName} • ${schedule.scheduleType.charAt(0).toUpperCase() + schedule.scheduleType.slice(1)}</div>
                    </div>
                    <div class="schedule-section">${currentStudent?.section || 'No Section'}</div>
                </div>
            `;
        }).join('');
    }

    // Update weekly preview
    function updateWeeklyPreview() {
        const weeklyPreview = document.getElementById('weeklyPreview');
        if (!weeklyPreview) return;
        
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        weeklyPreview.innerHTML = days.map(day => {
            const daySchedules = studentSchedules
                .filter(schedule => schedule.day === day)
                .slice(0, 3); // Show only first 3 classes per day for preview
            
            return `
                <div class="weekly-day-preview">
                    <h5>${day}</h5>
                    ${daySchedules.length > 0 ? 
                        daySchedules.map(schedule => {
                            const subjectCode = schedule.subject?.courseCode || schedule.subject || 'No subject';
                            const teacherName = schedule.teacher?.fullname || schedule.teacher || 'No teacher';
                            return `
                                <div class="schedule-item-preview ${schedule.scheduleType}">
                                    <strong>${subjectCode}</strong><br>
                                    <small>${schedule.startTime} ${schedule.startPeriod} - ${teacherName}</small>
                                </div>
                            `;
                        }).join('') : 
                        '<p style="color: var(--ctu-text-secondary); font-size: 0.9em; text-align: center;">No classes</p>'
                    }
                    ${studentSchedules.filter(schedule => schedule.day === day).length > 3 ? 
                        `<p style="color: var(--ctu-light-blue); font-size: 0.8em; text-align: center; margin-top: 8px;">
                            +${studentSchedules.filter(schedule => schedule.day === day).length - 3} more
                        </p>` : ''
                    }
                </div>
            `;
        }).join('');
    }

    // Update profile view with better data handling
    function updateProfileView() {
        if (!currentStudent) {
            console.log('No student data available');
            return;
        }

        try {
            // Update avatar and basic info
            const profileAvatar = document.getElementById('profileViewAvatar');
            if (profileAvatar) {
                if (currentStudent.profilePicture) {
                    profileAvatar.src = `${API_BASE_URL}${currentStudent.profilePicture}`;
                } else {
                    profileAvatar.src = './img/default_student_avatar.png';
                }
            }

            document.getElementById('profileViewName').textContent = currentStudent.fullname || 'Student';
            document.getElementById('profileViewEmail').textContent = currentStudent.email || 'No email provided';
            document.getElementById('profileViewRole').textContent = 'Student';

            // Update personal information (editable fields)
            document.getElementById('profileFullName').value = currentStudent.fullname || '';
            document.getElementById('profileCtuid').value = currentStudent.ctuid || '';
            document.getElementById('profileEmail').value = currentStudent.email || '';
            document.getElementById('profileBirthdate').value = currentStudent.birthdate || '';
            document.getElementById('profileGender').value = currentStudent.gender || '';

            // Update academic information
            const academicLoad = calculateAcademicLoad(studentSchedules);
            
            document.getElementById('profileClassSection').textContent = currentStudent.section || 'Not assigned';
            document.getElementById('profileAssignedRoom').textContent = currentStudent.room || 'Not assigned';
            document.getElementById('profileTotalSubjects').textContent = academicLoad.totalSubjects;
            document.getElementById('profileWeeklyHours').textContent = academicLoad.totalWeeklyHours;

            // Update account information
            document.getElementById('profileUserRole').textContent = currentStudent.userrole ? 
                currentStudent.userrole.charAt(0).toUpperCase() + currentStudent.userrole.slice(1) : 'Student';
            document.getElementById('profileLastLogin').textContent = currentStudent.lastLogin ? 
                new Date(currentStudent.lastLogin).toLocaleString() : 'Never';
            document.getElementById('profileAccountCreated').textContent = currentStudent.createdAt ? 
                new Date(currentStudent.createdAt).toLocaleDateString() : 'Unknown';

        } catch (error) {
            console.error('Error updating profile view:', error);
            showNotification('Error loading profile data', 'error');
        }
    }

    // Render schedule views
    function renderScheduleViews() {
        if (!studentSchedules.length) {
            console.log('No schedules to render');
            // Set default values
            document.getElementById('scheduleLectureCount').textContent = '0';
            document.getElementById('scheduleLabCount').textContent = '0';
            document.getElementById('scheduleTotalHours').textContent = '0';
            return;
        }

        const academicLoad = calculateAcademicLoad(studentSchedules);
        
        // Update schedule statistics
        document.getElementById('scheduleLectureCount').textContent = academicLoad.lectureHours;
        document.getElementById('scheduleLabCount').textContent = academicLoad.labHours;
        document.getElementById('scheduleTotalHours').textContent = academicLoad.totalWeeklyHours;

        // Render based on current view
        if (currentView === 'weekly') {
            renderWeeklySchedule();
        } else {
            renderDailySchedule();
        }
    }

    // Render weekly schedule with better data handling
    function renderWeeklySchedule() {
        const weeklyGrid = document.getElementById('weeklyGrid');
        if (!weeklyGrid) return;

        weeklyGrid.innerHTML = '';

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        days.forEach(day => {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'weekly-day';
            dayDiv.innerHTML = `<h5>${day}</h5>`;

            const daySchedules = studentSchedules.filter(schedule => {
                const matchesDay = schedule.day === day;
                const matchesShift = currentShift === 'all' || 
                    (schedule.section?.shift && schedule.section.shift.toLowerCase() === currentShift);
                return matchesDay && matchesShift;
            });

            // Sort by start time
            daySchedules.sort((a, b) => {
                const getTimeValue = (schedule) => {
                    let timeValue = parseInt(schedule.startTime.replace(':', ''));
                    if (schedule.startPeriod === 'PM' && timeValue < 1200) timeValue += 1200;
                    if (schedule.startPeriod === 'AM' && timeValue === 1200) timeValue = 0;
                    return timeValue;
                };
                return getTimeValue(a) - getTimeValue(b);
            });

            if (daySchedules.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'empty-schedule-day';
                emptyMsg.innerHTML = '<small>No classes</small>';
                dayDiv.appendChild(emptyMsg);
            } else {
                daySchedules.forEach(schedule => {
                    const item = document.createElement('div');
                    item.className = `schedule-item-small ${schedule.scheduleType}`;
                    
                    const subjectCode = schedule.subject?.courseCode || schedule.subject || 'No subject';
                    const teacherName = schedule.teacher?.fullname || schedule.teacher || 'No teacher';
                    const roomName = schedule.room?.roomName || schedule.room || 'No room';
                    const timeDisplay = `${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}`;
                    
                    item.innerHTML = `
                        <div><strong>${subjectCode}</strong></div>
                        <div>${teacherName}</div>
                        <div>${roomName}</div>
                        <div><small>${timeDisplay}</small></div>
                    `;
                    
                    item.title = `${subjectCode} - ${teacherName} (${roomName})`;
                    dayDiv.appendChild(item);
                });
            }

            weeklyGrid.appendChild(dayDiv);
        });
    }

    // Render daily schedule
    function renderDailySchedule() {
        const dailySchedule = document.getElementById('dailySchedule');
        if (!dailySchedule) return;

        dailySchedule.innerHTML = '';

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[currentDayIndex];
        
        document.getElementById('currentDayDisplay').textContent = currentDay;

        const daySchedules = studentSchedules.filter(schedule => {
            const matchesDay = schedule.day === currentDay;
            const matchesShift = currentShift === 'all' || 
                (schedule.section?.shift && schedule.section.shift.toLowerCase() === currentShift);
            return matchesDay && matchesShift;
        });

        // Sort by start time
        daySchedules.sort((a, b) => {
            const getTimeValue = (schedule) => {
                let timeValue = parseInt(schedule.startTime.replace(':', ''));
                if (schedule.startPeriod === 'PM' && timeValue < 1200) timeValue += 1200;
                if (schedule.startPeriod === 'AM' && timeValue === 1200) timeValue = 0;
                return timeValue;
            };
            return getTimeValue(a) - getTimeValue(b);
        });

        if (daySchedules.length === 0) {
            dailySchedule.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-calendar-x"></i>
                    <p>No classes for ${currentDay}</p>
                </div>
            `;
            return;
        }

        dailySchedule.innerHTML = daySchedules.map(schedule => {
            const subjectCode = schedule.subject?.courseCode || schedule.subject || 'No subject';
            const descriptiveTitle = schedule.subject?.descriptiveTitle || '';
            const roomName = schedule.room?.roomName || schedule.room || 'No room';
            const teacherName = schedule.teacher?.fullname || schedule.teacher || 'No teacher';
            const timeDisplay = `${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}`;
            
            return `
                <div class="daily-schedule-item ${schedule.scheduleType}">
                    <div class="schedule-time">${timeDisplay}</div>
                    <div class="schedule-details">
                        <div class="schedule-subject">${subjectCode}${descriptiveTitle ? ' - ' + descriptiveTitle : ''}</div>
                        <div class="schedule-meta">${teacherName} • ${roomName} • ${schedule.scheduleType.charAt(0).toUpperCase() + schedule.scheduleType.slice(1)}</div>
                    </div>
                    <div class="schedule-section">${currentStudent?.section || 'No Section'}</div>
                </div>
            `;
        }).join('');
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

        renderScheduleViews();
    }

    // Shift toggle
    document.querySelectorAll('.shift-btn-small').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.shift-btn-small').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentShift = this.dataset.shift;
            renderScheduleViews();
        });
    });

    // Daily navigation
    const prevDayBtn = document.getElementById('prevDayBtn');
    if (prevDayBtn) {
        prevDayBtn.addEventListener('click', function() {
            currentDayIndex = (currentDayIndex - 1 + 6) % 6;
            renderScheduleViews();
        });
    }

    const nextDayBtn = document.getElementById('nextDayBtn');
    if (nextDayBtn) {
        nextDayBtn.addEventListener('click', function() {
            currentDayIndex = (currentDayIndex + 1) % 6;
            renderScheduleViews();
        });
    }

    // Profile Picture Upload
    const profilePictureInput = document.getElementById('profilePictureInput');
    const profilePicture = document.getElementById('profileViewAvatar');

    if (profilePictureInput && profilePicture) {
        profilePictureInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    showNotification('Please select a valid image file (JPEG, PNG, etc.)', 'error');
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
                
                showNotification('Profile picture selected. Click "Save Changes" to upload.', 'success');
            }
        });
    }

    // Save Profile Changes with better validation
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async function() {
            const saveBtn = this;
            const originalText = saveBtn.innerHTML;
            
            try {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';

                const userId = getUserId();
                if (!userId) {
                    throw new Error('User not authenticated');
                }

                const fullName = document.getElementById('profileFullName').value.trim();
                if (!fullName) {
                    throw new Error('Full name is required');
                }

                const email = document.getElementById('profileEmail').value.trim();
                if (!email) {
                    throw new Error('Email is required');
                }

                // Basic email validation
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    throw new Error('Please enter a valid email address');
                }

                const formData = new FormData();
                formData.append('fullname', fullName);
                formData.append('email', email);
                formData.append('ctuid', document.getElementById('profileCtuid').value.trim());
                formData.append('birthdate', document.getElementById('profileBirthdate').value);
                formData.append('gender', document.getElementById('profileGender').value);
                formData.append('section', currentStudent?.section || '');
                formData.append('room', currentStudent?.room || '');

                // Add profile picture if selected
                if (selectedFile) {
                    formData.append('profilePicture', selectedFile);
                }

                const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
                    method: 'PUT',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to update profile');
                }

                const updatedUser = await response.json();
                
                // Update session storage and current student data
                storeUserSession(updatedUser);
                currentStudent = updatedUser;
                
                // Update all profile pictures
                updateProfilePictures(updatedUser.profilePicture);
                
                // Update navigation and greeting
                updateProfileInfo();
                
                showNotification('Profile updated successfully!', 'success');
                
                // Reset file selection
                selectedFile = null;
                if (profilePictureInput) profilePictureInput.value = '';
                
            } catch (error) {
                console.error('Error updating profile:', error);
                showNotification(error.message, 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
            }
        });
    }

    // Helper function to update profile pictures everywhere
    function updateProfilePictures(profilePicturePath) {
        if (!profilePicturePath) return;
        
        const imageUrl = `${API_BASE_URL}${profilePicturePath}`;
        
        // Update profile view avatar
        const profileAvatar = document.getElementById('profileViewAvatar');
        if (profileAvatar) {
            profileAvatar.src = imageUrl;
        }
        
        // Update navigation avatar
        const navAvatar = document.getElementById('studentProfileAvatar');
        if (navAvatar) {
            navAvatar.src = imageUrl;
        }
    }

    // Cancel changes
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            updateProfileView();
            selectedFile = null;
            if (profilePictureInput) profilePictureInput.value = '';
            
            // Reset profile picture to original
            if (currentStudent && currentStudent.profilePicture) {
                const profileAvatar = document.getElementById('profileViewAvatar');
                if (profileAvatar) {
                    profileAvatar.src = `${API_BASE_URL}${currentStudent.profilePicture}`;
                }
            }
            
            showNotification('Changes cancelled', 'success');
        });
    }

    // Notification system
    function showNotification(message, type = 'success') {
        const notification = document.getElementById('studentNotification');
        if (!notification) {
            // Create notification element if it doesn't exist
            const newNotification = document.createElement('div');
            newNotification.id = 'studentNotification';
            newNotification.className = `notification ${type}`;
            newNotification.textContent = message;
            newNotification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 4px;
                color: white;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s;
            `;
            if (type === 'success') {
                newNotification.style.backgroundColor = '#28a745';
            } else {
                newNotification.style.backgroundColor = '#dc3545';
            }
            document.body.appendChild(newNotification);
            
            // Show notification
            setTimeout(() => {
                newNotification.style.opacity = '1';
            }, 100);
            
            // Auto-hide after 4 seconds
            setTimeout(() => {
                newNotification.style.opacity = '0';
                setTimeout(() => {
                    if (newNotification.parentNode) {
                        newNotification.parentNode.removeChild(newNotification);
                    }
                }, 300);
            }, 4000);
            return;
        }
        
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        
        // Auto-hide after 4 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 4000);
    }

    // Initialize the application
    async function initializeApp() {
        try {
            updateProfileInfo();
            await fetchStudentData();
            showNotification('Dashboard loaded successfully!', 'success');
        } catch (error) {
            console.error('Error initializing app:', error);
            showNotification('Error loading dashboard: ' + error.message, 'error');
        }
    }

    // Start the application
    initializeApp();
});