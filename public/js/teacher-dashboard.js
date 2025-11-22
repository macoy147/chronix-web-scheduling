import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';


document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    if (!AuthGuard.checkAuthentication('teacher')) {
        return;
    }

    // State management
    let currentTeacher = null;
    let teacherSchedules = [];
    let allSchedules = [];
    let allSections = [];
    let currentView = 'weekly';
    let currentShift = 'all';
    let currentDayIndex = 0;
    let selectedFile = null;

    // Profile dropdown
    const profileDropdown = document.querySelector('.teacher-profile-dropdown');
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
    document.getElementById('teacherLogoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        AuthGuard.logout();
    });

    // Navigation
    setupNavigation();

    function setupNavigation() {
        document.getElementById('dashboardLink').addEventListener('click', function(e) {
            e.preventDefault();
            switchView('dashboardView');
            updateNavActive(this);
        });

        document.getElementById('scheduleLink').addEventListener('click', function(e) {
            e.preventDefault();
            switchView('scheduleView');
            updateNavActive(this);
            renderScheduleViews(); // Refresh schedule data when switching to schedule view
        });

        document.getElementById('profileLink').addEventListener('click', function(e) {
            e.preventDefault();
            switchView('profileView');
            updateNavActive(this);
            updateProfileView(); // Refresh profile data when switching to profile view
        });

        document.getElementById('teacherProfileBtn').addEventListener('click', function(e) {
            e.preventDefault();
            switchView('profileView');
            updateNavActive(document.getElementById('profileLink'));
            updateProfileView();
        });

        document.getElementById('viewFullScheduleBtn').addEventListener('click', function(e) {
            e.preventDefault();
            switchView('scheduleView');
            updateNavActive(document.getElementById('scheduleLink'));
            renderScheduleViews();
        });
    }

    function switchView(viewId) {
        document.querySelectorAll('.view-section').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(viewId).classList.add('active');
    }

    function updateNavActive(clickedElement) {
        document.querySelectorAll('.nav-links li').forEach(li => {
            li.classList.remove('active');
        });
        clickedElement.parentElement.classList.add('active');
    }

    // Update profile info in navigation
    function updateProfileInfo() {
        const currentUser = AuthGuard.getCurrentUser();
        if (currentUser) {
            currentTeacher = currentUser;
            const firstName = currentUser.fullname?.split(' ')[0] || 'Teacher';
            
            // Update navigation profile
            const profileName = document.getElementById('teacherProfileName');
            if (profileName) {
                profileName.innerHTML = `${firstName} <i class="bi bi-chevron-down"></i>`;
            }
            
            const profileAvatar = document.getElementById('teacherProfileAvatar');
            if (profileAvatar && currentUser.profilePicture) {
                profileAvatar.src = `http://localhost:3001${currentUser.profilePicture}`;
            }

            // Update greeting
            document.getElementById('teacherGreetingName').textContent = firstName;
        }
    }

    // Fetch teacher data
    async function fetchTeacherData() {
        try {
            const userId = AuthGuard.getUserId();
            if (userId) {
                const res = await fetch(`${API_BASE_URL}/user/${userId}`);
                if (res.ok) {
                    const userData = await res.json();
                    AuthGuard.storeUserSession(userData);
                    currentTeacher = userData;
                    updateProfileInfo();
                    await loadSectionsData();
                    await loadTeacherSchedules();
                    updateDashboard();
                } else {
                    throw new Error('Failed to fetch teacher data');
                }
            }
        } catch (error) {
            console.error('Error fetching teacher data:', error);
            showNotification('Error loading teacher data', 'error');
        }
    }

    // Load sections data to find advisory sections
    async function loadSectionsData() {
        try {
            const res = await fetch('http://localhost:3001/sections');
            if (res.ok) {
                allSections = await res.json();
                console.log('Loaded sections for advisory check:', allSections);
            } else {
                console.error('Failed to load sections');
                allSections = [];
            }
        } catch (error) {
            console.error('Error loading sections:', error);
            allSections = [];
        }
    }

    // Load teacher schedules
    async function loadTeacherSchedules() {
        try {
            const res = await fetch('http://localhost:3001/schedules');
            if (res.ok) {
                allSchedules = await res.json();
                // Filter schedules for current teacher
                teacherSchedules = allSchedules.filter(schedule => {
                    const teacherId = schedule.teacher._id || schedule.teacher;
                    return teacherId === currentTeacher._id;
                });
                console.log('Loaded teacher schedules:', teacherSchedules);
            } else {
                console.error('Failed to load schedules');
                teacherSchedules = [];
            }
        } catch (error) {
            console.error('Error loading schedules:', error);
            teacherSchedules = [];
        }
    }

    // IMPROVED: Find advisory sections for current teacher
    function findAdvisorySections() {
        if (!currentTeacher || !allSections.length) return [];
        
        // Find sections where this teacher is the adviser
        const advisorySections = allSections.filter(section => {
            // Check both ID and fullname matching
            const isAdviserById = section.adviserTeacher === currentTeacher._id;
            const isAdviserByName = section.adviserTeacher === currentTeacher.fullname;
            return isAdviserById || isAdviserByName;
        });
        
        console.log('Advisory sections found:', advisorySections);
        return advisorySections;
    }

    // IMPROVED: Calculate schedule duration with proper AM/PM handling
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

    // IMPROVED: Calculate teaching load with better grouping
    function calculateTeachingLoad(schedules) {
        const classMap = new Map();
        
        schedules.forEach(schedule => {
            const subjectId = schedule.subject._id || schedule.subject;
            const sectionId = schedule.section._id || schedule.section;
            const classKey = `${subjectId}-${sectionId}`;
            
            if (!classMap.has(classKey)) {
                classMap.set(classKey, {
                    subject: schedule.subject,
                    section: schedule.section,
                    lecHours: 0,
                    labHours: 0,
                    sessions: []
                });
            }
            
            const classInfo = classMap.get(classKey);
            const duration = calculateScheduleDuration(schedule);
            
            if (schedule.scheduleType === 'lecture') {
                classInfo.lecHours += duration;
            } else if (schedule.scheduleType === 'lab') {
                classInfo.labHours += duration;
            }
            
            classInfo.sessions.push({
                day: schedule.day,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                startPeriod: schedule.startPeriod,
                endPeriod: schedule.endPeriod,
                duration: duration,
                room: schedule.room
            });
        });
        
        const distinctClasses = Array.from(classMap.values());
        const totalClasses = distinctClasses.length;
        
        // Calculate total weekly hours
        const lectureHours = distinctClasses.reduce((total, classInfo) => total + classInfo.lecHours, 0);
        const labHours = distinctClasses.reduce((total, classInfo) => total + classInfo.labHours, 0);
        const totalWeeklyHours = lectureHours + labHours;
        
        return {
            totalClasses,
            lectureHours: Math.round(lectureHours * 10) / 10, // Round to 1 decimal
            labHours: Math.round(labHours * 10) / 10,
            totalWeeklyHours: Math.round(totalWeeklyHours * 10) / 10,
            distinctClasses
        };
    }

    // Update dashboard with teacher data
    function updateDashboard() {
        if (!teacherSchedules.length) {
            console.log('No schedules found for teacher');
            return;
        }

        const teachingLoad = calculateTeachingLoad(teacherSchedules);
        
        // Update stats cards
        document.getElementById('totalClasses').textContent = teachingLoad.totalClasses;
        document.getElementById('lectureHours').textContent = teachingLoad.lectureHours;
        document.getElementById('labHours').textContent = teachingLoad.labHours;
        
        // Update advisory section
        const advisorySections = findAdvisorySections();
        let advisoryDisplay = 'Not assigned';
        
        if (advisorySections.length > 0) {
            advisoryDisplay = advisorySections.map(section => section.sectionName).join(', ');
        }
        
        document.getElementById('advisorySection').textContent = advisoryDisplay;

        // Update schedule displays
        updateTodaysSchedule();
        updateWeeklyPreview();
        
        // Update current date
        const currentDate = new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        document.getElementById('currentDateDisplay').textContent = currentDate;
    }

    // IMPROVED: Update today's schedule with better sorting
    function updateTodaysSchedule() {
        const todayScheduleList = document.getElementById('todayScheduleList');
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        
        const todaysSchedules = teacherSchedules.filter(schedule => 
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
            const roomName = schedule.room.roomName || schedule.room;
            const sectionName = schedule.section.sectionName || schedule.section;
            const subjectCode = schedule.subject.courseCode || schedule.subject;
            
            return `
                <div class="schedule-item-today ${schedule.scheduleType}">
                    <div class="schedule-time">
                        ${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}
                    </div>
                    <div class="schedule-details">
                        <div class="schedule-subject">${subjectCode}</div>
                        <div class="schedule-meta">${roomName} • ${schedule.scheduleType.charAt(0).toUpperCase() + schedule.scheduleType.slice(1)}</div>
                    </div>
                    <div class="schedule-section">${sectionName}</div>
                </div>
            `;
        }).join('');
    }

    // Update weekly preview
    function updateWeeklyPreview() {
        const weeklyPreview = document.getElementById('weeklyPreview');
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        weeklyPreview.innerHTML = days.map(day => {
            const daySchedules = teacherSchedules
                .filter(schedule => schedule.day === day)
                .slice(0, 3); // Show only first 3 classes per day for preview
            
            return `
                <div class="weekly-day-preview">
                    <h5>${day}</h5>
                    ${daySchedules.length > 0 ? 
                        daySchedules.map(schedule => {
                            const subjectCode = schedule.subject.courseCode || schedule.subject;
                            const sectionName = schedule.section.sectionName || schedule.section;
                            return `
                                <div class="schedule-item-preview ${schedule.scheduleType}">
                                    <strong>${subjectCode}</strong><br>
                                    <small>${schedule.startTime} ${schedule.startPeriod} - ${sectionName}</small>
                                </div>
                            `;
                        }).join('') : 
                        '<p style="color: var(--ctu-text-secondary); font-size: 0.9em; text-align: center;">No classes</p>'
                    }
                    ${teacherSchedules.filter(schedule => schedule.day === day).length > 3 ? 
                        `<p style="color: var(--ctu-light-blue); font-size: 0.8em; text-align: center; margin-top: 8px;">
                            +${teacherSchedules.filter(schedule => schedule.day === day).length - 3} more
                        </p>` : ''
                    }
                </div>
            `;
        }).join('');
    }

    // IMPROVED: Update profile view with better data handling
    function updateProfileView() {
        if (!currentTeacher) {
            console.log('No teacher data available');
            return;
        }

        try {
            // Update avatar and basic info
            const profileAvatar = document.getElementById('profileViewAvatar');
            if (profileAvatar) {
                if (currentTeacher.profilePicture) {
                    profileAvatar.src = `http://localhost:3001${currentTeacher.profilePicture}`;
                } else {
                    profileAvatar.src = './img/default_teacher_avatar.png';
                }
            }

            document.getElementById('profileViewName').textContent = currentTeacher.fullname || 'Teacher';
            document.getElementById('profileViewEmail').textContent = currentTeacher.email || 'No email provided';
            document.getElementById('profileViewRole').textContent = 'Teacher';

            // Update personal information (editable fields)
            document.getElementById('profileFullName').value = currentTeacher.fullname || '';
            document.getElementById('profileCtuid').value = currentTeacher.ctuid || '';
            document.getElementById('profileEmail').value = currentTeacher.email || '';
            document.getElementById('profileBirthdate').value = currentTeacher.birthdate || '';
            document.getElementById('profileGender').value = currentTeacher.gender || '';

            // Update teaching information
            const advisorySections = findAdvisorySections();
            let advisoryDisplay = 'Not assigned';
            
            if (advisorySections.length > 0) {
                advisoryDisplay = advisorySections.map(section => section.sectionName).join(', ');
            }
            
            const teachingLoad = calculateTeachingLoad(teacherSchedules);
            
            document.getElementById('profileAdvisorySection').textContent = advisoryDisplay;
            document.getElementById('profileAssignedRoom').textContent = currentTeacher.room || 'Not assigned';
            document.getElementById('profileTotalClasses').textContent = teachingLoad.totalClasses;
            document.getElementById('profileWeeklyHours').textContent = teachingLoad.totalWeeklyHours;

            // Update account information
            document.getElementById('profileUserRole').textContent = currentTeacher.userrole ? 
                currentTeacher.userrole.charAt(0).toUpperCase() + currentTeacher.userrole.slice(1) : 'Teacher';
            document.getElementById('profileLastLogin').textContent = currentTeacher.lastLogin ? 
                new Date(currentTeacher.lastLogin).toLocaleString() : 'Never';
            document.getElementById('profileAccountCreated').textContent = currentTeacher.createdAt ? 
                new Date(currentTeacher.createdAt).toLocaleDateString() : 'Unknown';

        } catch (error) {
            console.error('Error updating profile view:', error);
            showNotification('Error loading profile data', 'error');
        }
    }

    // Render schedule views
    function renderScheduleViews() {
        if (!teacherSchedules.length) {
            console.log('No schedules to render');
            return;
        }

        const teachingLoad = calculateTeachingLoad(teacherSchedules);
        
        // Update schedule statistics
        document.getElementById('scheduleLectureCount').textContent = teachingLoad.lectureHours;
        document.getElementById('scheduleLabCount').textContent = teachingLoad.labHours;
        document.getElementById('scheduleTotalHours').textContent = teachingLoad.totalWeeklyHours;

        // Render based on current view
        if (currentView === 'weekly') {
            renderWeeklySchedule();
        } else {
            renderDailySchedule();
        }
    }

    // IMPROVED: Render weekly schedule with better data handling
    function renderWeeklySchedule() {
        const weeklyGrid = document.getElementById('weeklyGrid');
        if (!weeklyGrid) return;

        weeklyGrid.innerHTML = '';

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        days.forEach(day => {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'weekly-day';
            dayDiv.innerHTML = `<h5>${day}</h5>`;

            const daySchedules = teacherSchedules.filter(schedule => {
                const matchesDay = schedule.day === day;
                const matchesShift = currentShift === 'all' || 
                    (schedule.section.shift && schedule.section.shift.toLowerCase() === currentShift);
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
                    
                    const subjectCode = schedule.subject.courseCode || schedule.subject;
                    const sectionName = schedule.section.sectionName || schedule.section;
                    const roomName = schedule.room.roomName || schedule.room;
                    const timeDisplay = `${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}`;
                    
                    item.innerHTML = `
                        <div><strong>${subjectCode}</strong></div>
                        <div>${sectionName}</div>
                        <div>${roomName}</div>
                        <div><small>${timeDisplay}</small></div>
                    `;
                    
                    item.title = `${subjectCode} - ${sectionName} (${roomName})`;
                    dayDiv.appendChild(item);
                });
            }

            weeklyGrid.appendChild(dayDiv);
        });
    }

    // IMPROVED: Render daily schedule
    function renderDailySchedule() {
        const dailySchedule = document.getElementById('dailySchedule');
        if (!dailySchedule) return;

        dailySchedule.innerHTML = '';

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[currentDayIndex];
        
        document.getElementById('currentDayDisplay').textContent = currentDay;

        const daySchedules = teacherSchedules.filter(schedule => {
            const matchesDay = schedule.day === currentDay;
            const matchesShift = currentShift === 'all' || 
                (schedule.section.shift && schedule.section.shift.toLowerCase() === currentShift);
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
                    <p>No schedules for ${currentDay}</p>
                </div>
            `;
            return;
        }

        dailySchedule.innerHTML = daySchedules.map(schedule => {
            const subjectCode = schedule.subject.courseCode || schedule.subject;
            const descriptiveTitle = schedule.subject.descriptiveTitle || '';
            const roomName = schedule.room.roomName || schedule.room;
            const sectionName = schedule.section.sectionName || schedule.section;
            const timeDisplay = `${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}`;
            
            return `
                <div class="daily-schedule-item ${schedule.scheduleType}">
                    <div class="schedule-time">${timeDisplay}</div>
                    <div class="schedule-details">
                        <div class="schedule-subject">${subjectCode}${descriptiveTitle ? ' - ' + descriptiveTitle : ''}</div>
                        <div class="schedule-meta">${roomName} • ${schedule.scheduleType.charAt(0).toUpperCase() + schedule.scheduleType.slice(1)}</div>
                    </div>
                    <div class="schedule-section">${sectionName}</div>
                </div>
            `;
        }).join('');
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
    document.getElementById('prevDayBtn').addEventListener('click', function() {
        currentDayIndex = (currentDayIndex - 1 + 6) % 6;
        renderScheduleViews();
    });

    document.getElementById('nextDayBtn').addEventListener('click', function() {
        currentDayIndex = (currentDayIndex + 1) % 6;
        renderScheduleViews();
    });

    // Profile Picture Upload
    const profilePictureInput = document.getElementById('profilePictureInput');
    const profilePicture = document.getElementById('profileViewAvatar');

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

    // IMPROVED: Save Profile Changes with better validation
    document.getElementById('saveProfileBtn').addEventListener('click', async function() {
        const saveBtn = this;
        const originalText = saveBtn.innerHTML;
        
        try {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';

            const userId = AuthGuard.getUserId();
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
            
            // Update session storage and current teacher data
            AuthGuard.storeUserSession(updatedUser);
            currentTeacher = updatedUser;
            
            // Update all profile pictures
            updateProfilePictures(updatedUser.profilePicture);
            
            // Update navigation and greeting
            updateProfileInfo();
            
            showNotification('Profile updated successfully!', 'success');
            
            // Reset file selection
            selectedFile = null;
            profilePictureInput.value = '';
            
        } catch (error) {
            console.error('Error updating profile:', error);
            showNotification(error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    });

    // Helper function to update profile pictures everywhere
    function updateProfilePictures(profilePicturePath) {
        if (!profilePicturePath) return;
        
        const imageUrl = `http://localhost:3001${profilePicturePath}`;
        
        // Update profile view avatar
        const profileAvatar = document.getElementById('profileViewAvatar');
        if (profileAvatar) {
            profileAvatar.src = imageUrl;
        }
        
        // Update navigation avatar
        const navAvatar = document.getElementById('teacherProfileAvatar');
        if (navAvatar) {
            navAvatar.src = imageUrl;
        }
    }

    // Cancel changes
    document.getElementById('cancelBtn').addEventListener('click', function() {
        updateProfileView();
        selectedFile = null;
        profilePictureInput.value = '';
        
        // Reset profile picture to original
        if (currentTeacher && currentTeacher.profilePicture) {
            const profileAvatar = document.getElementById('profileViewAvatar');
            if (profileAvatar) {
                profileAvatar.src = `http://localhost:3001${currentTeacher.profilePicture}`;
            }
        }
        
        showNotification('Changes cancelled', 'success');
    });

    // IMPROVED: Notification system
    function showNotification(message, type = 'success') {
        const notification = document.getElementById('teacherNotification');
        if (!notification) return;
        
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
            await fetchTeacherData();
            showNotification('Dashboard loaded successfully!', 'success');
        } catch (error) {
            console.error('Error initializing app:', error);
            showNotification('Error loading dashboard', 'error');
        }
    }

    // Start the application
    initializeApp();
});
