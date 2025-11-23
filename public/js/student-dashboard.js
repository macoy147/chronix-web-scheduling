import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';
import AuthGuard from './auth-guard.js';

// Profile picture helper - UPDATED FOR BASE64 SUPPORT
const ProfilePictureHelper = {
    getProfilePictureUrl(profilePicturePath) {
        if (!profilePicturePath) {
            return './img/default_student_avatar.png';
        }
        
        // Check if it's a base64 data URL
        if (profilePicturePath.startsWith('data:image/')) {
            return profilePicturePath;
        }
        
        if (profilePicturePath.startsWith('http')) {
            return profilePicturePath;
        }
        
        if (profilePicturePath.startsWith('/')) {
            return profilePicturePath;
        }
        
        // For backward compatibility with old file paths
        if (profilePicturePath.includes('profile-')) {
            return '/uploads/' + profilePicturePath;
        }
        
        return './img/default_student_avatar.png';
    },
    
    validateFile(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 5 * 1024 * 1024;
        
        if (!validTypes.includes(file.type)) {
            throw new Error('Please select a valid image file (JPEG, PNG, GIF, WebP)');
        }
        
        if (file.size > maxSize) {
            throw new Error('Image size must be less than 5MB');
        }
        
        return true;
    }
};

// Notification helper
const NotificationHelper = {
    showNotification(message, type = 'success', duration = 5000) {
        let notification = document.getElementById('studentNotification');
        if (!notification) {
            notification = this.createNotificationElement();
        }
        
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, duration);
        
        console.log(`🔔 ${type.toUpperCase()}: ${message}`);
    },
    
    createNotificationElement() {
        const notification = document.createElement('div');
        notification.id = 'studentNotification';
        notification.className = 'notification';
        document.body.appendChild(notification);
        return notification;
    }
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('🏁 Student Dashboard loaded - Initializing...');
    
    // Use AuthGuard for authentication check
    if (!AuthGuard.checkAuthentication('student')) {
        return;
    }

    // Initialize notification system
    NotificationHelper.createNotificationElement();

    // Debug: Log current user info
    const currentUser = AuthGuard.getCurrentUser();
    console.log('👤 Current user from AuthGuard:', currentUser);

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

    // Logout functionality - Use AuthGuard's logout
    const logoutBtn = document.getElementById('studentLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            AuthGuard.logout();
        });
    }

    // Update profile name and avatar in navigation
    function updateProfileInfo() {
        const currentUser = AuthGuard.getCurrentUser();
        if (currentUser) {
            currentStudent = currentUser;
            const firstName = currentUser.fullname?.split(' ')[0] || 'Student';
            const profileName = document.getElementById('studentProfileName');
            if (profileName) {
                profileName.innerHTML = `${firstName} <i class="bi bi-chevron-down"></i>`;
            }

            const profileAvatar = document.getElementById('studentProfileAvatar');
            if (profileAvatar) {
                profileAvatar.src = ProfilePictureHelper.getProfilePictureUrl(currentUser.profilePicture);
            }
            
            console.log('🔄 Profile info updated in navigation');
        }
    }

    // Load user profile data
    async function loadUserProfile() {
        try {
            const userId = AuthGuard.getUserId();
            if (!userId) {
                console.error('❌ No user ID found from AuthGuard');
                NotificationHelper.showNotification('User not authenticated. Please sign in again.', 'error');
                setTimeout(() => AuthGuard.redirectToLogin(), 2000);
                return;
            }

            console.log('🔄 Loading user profile for ID:', userId);
            
            const response = await fetch(`${API_BASE_URL}/user/${userId}`);
            
            if (response.status === 401) {
                NotificationHelper.showNotification('Session expired. Please sign in again.', 'error');
                setTimeout(() => AuthGuard.redirectToLogin(), 2000);
                return;
            }
            
            if (!response.ok) {
                throw new Error(`Failed to fetch user data: ${response.status} ${response.statusText}`);
            }

            const userData = await response.json();
            console.log('✅ User data loaded:', userData);
            
            populateProfileFields(userData);
            
            // Update session storage with fresh data using AuthGuard
            AuthGuard.storeUserSession(userData);
            updateProfileInfo();
            
            // Load additional data
            await loadSectionsData();
            await loadStudentSchedules();
            updateDashboard();
            
        } catch (error) {
            console.error('❌ Error loading user profile:', error);
            
            if (error.message.includes('401') || error.message.includes('unauthorized')) {
                NotificationHelper.showNotification('Session expired. Please sign in again.', 'error');
                setTimeout(() => AuthGuard.redirectToLogin(), 2000);
            } else {
                NotificationHelper.showNotification('Failed to load profile data: ' + error.message, 'error');
            }
        }
    }

    // Populate profile fields with user data
    function populateProfileFields(userData) {
        console.log('📝 Populating profile fields with:', userData);
        
        // Basic info
        const fullNameEl = document.getElementById('profileFullName');
        if (fullNameEl) fullNameEl.value = userData.fullname || '';
        
        const emailEl = document.getElementById('profileEmail');
        if (emailEl) emailEl.value = userData.email || '';
        
        const userRoleEl = document.getElementById('profileUserRole');
        if (userRoleEl) userRoleEl.textContent = userData.userrole ? userData.userrole.charAt(0).toUpperCase() + userData.userrole.slice(1) : 'Student';
        
        // Profile picture
        const profilePicture = document.getElementById('profileViewAvatar');
        if (profilePicture) {
            const pictureUrl = ProfilePictureHelper.getProfilePictureUrl(userData.profilePicture);
            console.log('🖼️ Setting profile picture to:', pictureUrl);
            profilePicture.src = pictureUrl;
        }

        // Update profile view elements
        document.getElementById('profileViewName').textContent = userData.fullname || 'Student';
        document.getElementById('profileViewEmail').textContent = userData.email || 'No email provided';
        document.getElementById('profileViewRole').textContent = 'Student';

        // Personal information
        document.getElementById('profileCtuid').value = userData.ctuid || '';
        document.getElementById('profileBirthdate').value = userData.birthdate || '';
        document.getElementById('profileGender').value = userData.gender || '';

        // Update greeting
        const greetingName = document.getElementById('studentGreetingName');
        if (greetingName) {
            const firstName = userData.fullname?.split(' ')[0] || 'Student';
            greetingName.textContent = firstName;
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

    // Navigation
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
                renderScheduleViews();
            });
        }

        // Profile link
        const profileLink = document.getElementById('profileLink');
        if (profileLink) {
            profileLink.addEventListener('click', function(e) {
                e.preventDefault();
                switchView('profileView');
                updateNavActive(this);
                updateProfileView();
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

    // Calculate schedule duration
    function calculateScheduleDuration(schedule) {
        const { startTime, endTime, startPeriod, endPeriod } = schedule;
        
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
        
        const durationMinutes = endMinutes >= startMinutes 
            ? endMinutes - startMinutes 
            : (1440 - startMinutes) + endMinutes;
        
        return durationMinutes / 60;
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
        });
        
        const distinctSubjects = Array.from(subjectMap.values());
        const totalSubjects = distinctSubjects.length;
        
        const lectureHours = distinctSubjects.reduce((total, subjectInfo) => total + subjectInfo.lecHours, 0);
        const labHours = distinctSubjects.reduce((total, subjectInfo) => total + subjectInfo.labHours, 0);
        const totalWeeklyHours = lectureHours + labHours;
        
        return {
            totalSubjects,
            lectureHours: Math.round(lectureHours * 10) / 10,
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
            document.getElementById('totalSubjects').textContent = '0';
            document.getElementById('lectureHours').textContent = '0';
            document.getElementById('labHours').textContent = '0';
            document.getElementById('studentSection').textContent = currentStudent?.section || 'Not assigned';
            
            updateTodaysSchedule();
            updateWeeklyPreview();
            return;
        }

        const academicLoad = calculateAcademicLoad(studentSchedules);
        
        document.getElementById('totalSubjects').textContent = academicLoad.totalSubjects;
        document.getElementById('lectureHours').textContent = academicLoad.lectureHours;
        document.getElementById('labHours').textContent = academicLoad.labHours;
        
        const studentSection = currentStudent?.section || 'Not assigned';
        document.getElementById('studentSection').textContent = studentSection;

        updateTodaysSchedule();
        updateWeeklyPreview();
        updateProfileView();
    }

    // Update today's schedule
    function updateTodaysSchedule() {
        const todayScheduleList = document.getElementById('todayScheduleList');
        if (!todayScheduleList) return;
        
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        
        const todaysSchedules = studentSchedules.filter(schedule => 
            schedule.day === today
        ).sort((a, b) => {
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
                .slice(0, 3);
            
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
                </div>
            `;
        }).join('');
    }

    // Update profile view
    function updateProfileView() {
        if (!currentStudent) {
            console.log('No student data available');
            return;
        }

        try {
            // Update academic information
            const academicLoad = calculateAcademicLoad(studentSchedules);
            
            document.getElementById('profileClassSection').textContent = currentStudent.section || 'Not assigned';
            document.getElementById('profileAssignedRoom').textContent = currentStudent.room || 'Not assigned';
            document.getElementById('profileTotalSubjects').textContent = academicLoad.totalSubjects;
            document.getElementById('profileWeeklyHours').textContent = academicLoad.totalWeeklyHours;

            // Update account information
            document.getElementById('profileLastLogin').textContent = currentStudent.lastLogin ? 
                new Date(currentStudent.lastLogin).toLocaleString() : 'Never';
            document.getElementById('profileAccountCreated').textContent = currentStudent.createdAt ? 
                new Date(currentStudent.createdAt).toLocaleDateString() : 'Unknown';

        } catch (error) {
            console.error('Error updating profile view:', error);
            NotificationHelper.showNotification('Error loading profile data', 'error');
        }
    }

    // Profile picture upload
    const profilePictureInput = document.getElementById('profilePictureInput');
    const profilePicture = document.getElementById('profileViewAvatar');

    if (profilePictureInput && profilePicture) {
        profilePictureInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                try {
                    ProfilePictureHelper.validateFile(file);
                    selectedFile = file;
                    
                    // Preview the image
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        if (profilePicture) {
                            profilePicture.src = e.target.result;
                        }
                    };
                    reader.readAsDataURL(file);
                    
                    NotificationHelper.showNotification('Profile picture selected. Click "Save Changes" to upload.', 'success');
                } catch (error) {
                    NotificationHelper.showNotification(error.message, 'error');
                    profilePictureInput.value = '';
                    selectedFile = null;
                }
            }
        });
    }

    // Save profile changes - USING AuthGuard
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async function() {
            const saveBtn = this;
            const originalText = saveBtn.innerHTML;
            
            try {
                const userId = AuthGuard.getUserId();
                if (!userId) {
                    throw new Error('User not authenticated. Please sign in again.');
                }

                console.log('🔄 Starting profile update for user:', userId);

                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';

                const formData = new FormData();
                
                // Add basic profile data
                const fullName = document.getElementById('profileFullName').value.trim();
                if (!fullName) {
                    throw new Error('Full name is required');
                }
                
                formData.append('fullname', fullName);
                
                const emailEl = document.getElementById('profileEmail');
                if (emailEl) {
                    const email = emailEl.value.trim();
                    if (!email) {
                        throw new Error('Email is required');
                    }
                    formData.append('email', email);
                }

                // Add additional fields
                formData.append('ctuid', document.getElementById('profileCtuid').value.trim());
                formData.append('birthdate', document.getElementById('profileBirthdate').value);
                formData.append('gender', document.getElementById('profileGender').value);
                formData.append('section', currentStudent?.section || '');
                formData.append('room', currentStudent?.room || '');

                // Add profile picture if selected
                if (selectedFile) {
                    formData.append('profilePicture', selectedFile);
                    console.log('📤 Uploading profile picture:', selectedFile.name);
                }

                console.log('🔄 Saving profile changes to server...');
                
                const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
                    method: 'PUT',
                    body: formData
                });

                if (response.status === 401) {
                    throw new Error('Session expired. Please sign in again.');
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    let errorData;
                    try {
                        errorData = JSON.parse(errorText);
                    } catch {
                        errorData = { error: errorText };
                    }
                    throw new Error(errorData.error || `Server error: ${response.status}`);
                }

                const result = await response.json();
                const updatedUser = result.user;
                const changes = result.changes || [];
                
                console.log('✅ Profile update successful:', updatedUser);
                
                // Update session storage using AuthGuard
                AuthGuard.storeUserSession(updatedUser);
                currentStudent = updatedUser;
                
                // Update all profile pictures
                updateAllProfilePictures(updatedUser.profilePicture);
                
                // Update navigation profile info
                updateProfileInfo();
                
                // Update profile view
                updateProfileView();
                
                // Show detailed notification
                if (changes.length > 0) {
                    NotificationHelper.showNotification(
                        `Profile updated successfully! Changes: ${changes.join(', ')}`, 
                        'success', 
                        6000
                    );
                } else {
                    NotificationHelper.showNotification('Profile updated successfully!', 'success');
                }
                
                selectedFile = null;
                if (profilePictureInput) {
                    profilePictureInput.value = '';
                }
                
            } catch (error) {
                console.error('❌ Error updating profile:', error);
                
                if (error.message.includes('Session expired') || error.message.includes('not authenticated')) {
                    NotificationHelper.showNotification(error.message, 'error');
                    setTimeout(() => AuthGuard.redirectToLogin(), 2000);
                } else {
                    NotificationHelper.showNotification(error.message || 'Failed to update profile', 'error');
                }
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
            }
        });
    }

    // Helper function to update all profile pictures
    function updateAllProfilePictures(profilePicturePath) {
        if (!profilePicturePath) return;
        
        const imageUrl = ProfilePictureHelper.getProfilePictureUrl(profilePicturePath);
        console.log('🔄 Updating all profile pictures to:', imageUrl);
        
        const profilePicture = document.getElementById('profileViewAvatar');
        if (profilePicture) {
            profilePicture.src = imageUrl;
        }
        
        const navAvatar = document.getElementById('studentProfileAvatar');
        if (navAvatar) {
            navAvatar.src = imageUrl;
        }
    }

    // Cancel changes
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            loadUserProfile();
            selectedFile = null;
            if (profilePictureInput) {
                profilePictureInput.value = '';
            }
            NotificationHelper.showNotification('Changes cancelled', 'info');
        });
    }

    // Schedule view functions
    function renderScheduleViews() {
        if (!studentSchedules.length) {
            console.log('No schedules to render');
            document.getElementById('scheduleLectureCount').textContent = '0';
            document.getElementById('scheduleLabCount').textContent = '0';
            document.getElementById('scheduleTotalHours').textContent = '0';
            return;
        }

        const academicLoad = calculateAcademicLoad(studentSchedules);
        
        document.getElementById('scheduleLectureCount').textContent = academicLoad.lectureHours;
        document.getElementById('scheduleLabCount').textContent = academicLoad.labHours;
        document.getElementById('scheduleTotalHours').textContent = academicLoad.totalWeeklyHours;

        if (currentView === 'weekly') {
            renderWeeklySchedule();
        } else {
            renderDailySchedule();
        }
    }

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
                    
                    dayDiv.appendChild(item);
                });
            }

            weeklyGrid.appendChild(dayDiv);
        });
    }

    // Add your other schedule functions (renderDailySchedule, etc.) here

    // Initialize the application
    async function initializeApp() {
        try {
            updateProfileInfo();
            await loadUserProfile();
            NotificationHelper.showNotification('Dashboard loaded successfully!', 'success');
        } catch (error) {
            console.error('Error initializing app:', error);
            NotificationHelper.showNotification('Error loading dashboard: ' + error.message, 'error');
        }
    }

    // Start the application
    initializeApp();
});