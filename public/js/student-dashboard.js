import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    if (!AuthGuard.checkAuthentication('student')) {
        return;
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

    // Profile dropdown
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

    // Logout functionality
    document.getElementById('studentLogoutBtn').addEventListener('click', function(e) {
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

        document.getElementById('studentProfileBtn').addEventListener('click', function(e) {
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
            currentStudent = currentUser;
            const firstName = currentUser.fullname?.split(' ')[0] || 'Student';
            
            // Update navigation profile
            const profileName = document.getElementById('studentProfileName');
            if (profileName) {
                profileName.innerHTML = `${firstName} <i class="bi bi-chevron-down"></i>`;
            }
            
            const profileAvatar = document.getElementById('studentProfileAvatar');
            if (profileAvatar && currentUser.profilePicture) {
                profileAvatar.src = `http://localhost:3001${currentUser.profilePicture}`;
            }

            // Update greeting
            document.getElementById('studentGreetingName').textContent = firstName;
        }
    }

    // Fetch student data
    async function fetchStudentData() {
        try {
            const userId = AuthGuard.getUserId();
            if (userId) {
                const res = await fetch(`http://localhost:3001/user/${userId}`);
                if (res.ok) {
                    const userData = await res.json();
                    AuthGuard.storeUserSession(userData);
                    currentStudent = userData;
                    updateProfileInfo();
                    await loadSectionsData();
                    await loadStudentSchedules();
                    updateDashboard();
                } else {
                    throw new Error('Failed to fetch student data');
                }
            }
        } catch (error) {
            console.error('Error fetching student data:', error);
            showNotification('Error loading student data', 'error');
        }
    }

    // Load sections data to find student's section
    async function loadSectionsData() {
        try {
            const res = await fetch('http://localhost:3001/sections');
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
            const res = await fetch('http://localhost:3001/schedules');
            if (res.ok) {
                allSchedules = await res.json();
                // Filter schedules for current student's section
                studentSchedules = allSchedules.filter(schedule => {
                    const studentSection = currentStudent.section;
                    const scheduleSectionName = schedule.section.sectionName || schedule.section;
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
            const subjectId = schedule.subject._id || schedule.subject;
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
        if (!studentSchedules.length) {
            console.log('No schedules found for student');
            return;
        }

        const academicLoad = calculateAcademicLoad(studentSchedules);
        
        // Update stats cards
        document.getElementById('totalSubjects').textContent = academicLoad.totalSubjects;
        document.getElementById('lectureHours').textContent = academicLoad.lectureHours;
        document.getElementById('labHours').textContent = academicLoad.labHours;
        
        // Update student section
        const studentSection = currentStudent.section || 'Not assigned';
        document.getElementById('studentSection').textContent = studentSection;

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

    // Update today's schedule with better sorting
    function updateTodaysSchedule() {
        const todayScheduleList = document.getElementById('todayScheduleList');
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
            const roomName = schedule.room.roomName || schedule.room;
            const subjectCode = schedule.subject.courseCode || schedule.subject;
            const teacherName = schedule.teacher.fullname || schedule.teacher;
            
            return `
                <div class="schedule-item-today ${schedule.scheduleType}">
                    <div class="schedule-time">
                        ${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}
                    </div>
                    <div class="schedule-details">
                        <div class="schedule-subject">${subjectCode}</div>
                        <div class="schedule-meta">${teacherName} • ${roomName} • ${schedule.scheduleType.charAt(0).toUpperCase() + schedule.scheduleType.slice(1)}</div>
                    </div>
                    <div class="schedule-section">${currentStudent.section || 'No Section'}</div>
                </div>
            `;
        }).join('');
    }

    // Update weekly preview
    function updateWeeklyPreview() {
        const weeklyPreview = document.getElementById('weeklyPreview');
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
                            const subjectCode = schedule.subject.courseCode || schedule.subject;
                            const teacherName = schedule.teacher.fullname || schedule.teacher;
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
                    profileAvatar.src = `http://localhost:3001${currentStudent.profilePicture}`;
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
                    const teacherName = schedule.teacher.fullname || schedule.teacher;
                    const roomName = schedule.room.roomName || schedule.room;
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
                    <p>No classes for ${currentDay}</p>
                </div>
            `;
            return;
        }

        dailySchedule.innerHTML = daySchedules.map(schedule => {
            const subjectCode = schedule.subject.courseCode || schedule.subject;
            const descriptiveTitle = schedule.subject.descriptiveTitle || '';
            const roomName = schedule.room.roomName || schedule.room;
            const teacherName = schedule.teacher.fullname || schedule.teacher;
            const timeDisplay = `${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}`;
            
            return `
                <div class="daily-schedule-item ${schedule.scheduleType}">
                    <div class="schedule-time">${timeDisplay}</div>
                    <div class="schedule-details">
                        <div class="schedule-subject">${subjectCode}${descriptiveTitle ? ' - ' + descriptiveTitle : ''}</div>
                        <div class="schedule-meta">${teacherName} • ${roomName} • ${schedule.scheduleType.charAt(0).toUpperCase() + schedule.scheduleType.slice(1)}</div>
                    </div>
                    <div class="schedule-section">${currentStudent.section || 'No Section'}</div>
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

    // Save Profile Changes with better validation
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
            formData.append('section', currentStudent.section || '');
            formData.append('room', currentStudent.room || '');

            // Add profile picture if selected
            if (selectedFile) {
                formData.append('profilePicture', selectedFile);
            }

            const response = await fetch(`http://localhost:3001/user/${userId}`, {
                method: 'PUT',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update profile');
            }

            const updatedUser = await response.json();
            
            // Update session storage and current student data
            AuthGuard.storeUserSession(updatedUser);
            currentStudent = updatedUser;
            
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
        const navAvatar = document.getElementById('studentProfileAvatar');
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
        if (currentStudent && currentStudent.profilePicture) {
            const profileAvatar = document.getElementById('profileViewAvatar');
            if (profileAvatar) {
                profileAvatar.src = `http://localhost:3001${currentStudent.profilePicture}`;
            }
        }
        
        showNotification('Changes cancelled', 'success');
    });

    // Notification system
    function showNotification(message, type = 'success') {
        const notification = document.getElementById('studentNotification');
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
            await fetchStudentData();
            showNotification('Dashboard loaded successfully!', 'success');
        } catch (error) {
            console.error('Error initializing app:', error);
            showNotification('Error loading dashboard', 'error');
        }
    }

    // Start the application
    initializeApp();
});
