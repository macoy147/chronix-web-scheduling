// public/js/admin-dashboard.js - FIXED VERSION
import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';
import AuthGuard from './auth-guard.js';


// Simple auth helper since AuthGuard might not be loading properly
 

document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin Dashboard loaded');
    
    // Check authentication first
    if (!AuthGuard.checkAuthentication('admin')) {
        return;
    }

    // Global state management
    const dashboardState = {
        data: {
            students: [],
            teachers: [],
            rooms: [],
            schedules: [],
            subjects: [],
            sections: [],
            lastUpdate: null
        },
        charts: {
            studentDistribution: null,
            roomUtilization: null,
            scheduleDensity: null
        },
        filters: {
            studentDistributionType: 'section',
            roomChartType: 'status',
            scheduleDensityType: 'day'
        }
    };

    // Initialize the dashboard
    initializeDashboard();

    // Profile dropdown functionality
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

    // Refresh button functionality
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            refreshDashboardData();
        });
    }

    // Filter event listeners
    const studentDistributionType = document.getElementById('studentDistributionType');
    if (studentDistributionType) {
        studentDistributionType.addEventListener('change', function() {
            dashboardState.filters.studentDistributionType = this.value;
            renderStudentDistributionChart();
        });
    }

    const roomChartType = document.getElementById('roomChartType');
    if (roomChartType) {
        roomChartType.addEventListener('change', function() {
            dashboardState.filters.roomChartType = this.value;
            renderRoomUtilizationChart();
        });
    }

    const scheduleDensityType = document.getElementById('scheduleDensityType');
    if (scheduleDensityType) {
        scheduleDensityType.addEventListener('change', function() {
            dashboardState.filters.scheduleDensityType = this.value;
            renderScheduleDensityChart();
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
            if (profileAvatar) {
                if (currentUser.profilePicture) {
                    profileAvatar.src = currentUser.profilePicture.startsWith('http') 
                        ? currentUser.profilePicture 
                        : currentUser.profilePicture;
                } else {
                    profileAvatar.src = '/img/default_admin_avatar.png';
                }
            }
        }
    }

    // Initialize dashboard
    async function initializeDashboard() {
        showLoadingOverlay();
        updateProfileInfo();
        
        try {
            await loadAllData();
            initializeDashboardComponents();
            setupAutoRefresh();
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            showError('Failed to load dashboard data. Please check your connection and try again.');
        } finally {
            hideLoadingOverlay();
        }
    }

    // Load all data from MongoDB
    async function loadAllData() {
        try {
            console.log('Starting data load from server...');
            
            // Load students
            const studentsResponse = await fetch('/users/students');
            if (!studentsResponse.ok) throw new Error('Failed to fetch students');
            const studentsData = await studentsResponse.json();
            const students = Array.isArray(studentsData) ? studentsData : [];
            console.log(`Loaded ${students.length} students`);

            // Load teachers
            const teachersResponse = await fetch('/teachers');
            if (!teachersResponse.ok) throw new Error('Failed to fetch teachers');
            const teachers = await teachersResponse.json();
            console.log(`Loaded ${teachers.length} teachers`);

            // Load rooms
            const roomsResponse = await fetch('/rooms');
            if (!roomsResponse.ok) throw new Error('Failed to fetch rooms');
            const rooms = await roomsResponse.json();
            console.log(`Loaded ${rooms.length} rooms`);

            // Load schedules
            const schedulesResponse = await fetch('/schedules');
            if (!schedulesResponse.ok) throw new Error('Failed to fetch schedules');
            const schedules = await schedulesResponse.json();
            console.log(`Loaded ${schedules.length} schedules`);

            // Load subjects
            const subjectsResponse = await fetch('/subjects');
            if (!subjectsResponse.ok) throw new Error('Failed to fetch subjects');
            const subjects = await subjectsResponse.json();
            console.log(`Loaded ${subjects.length} subjects`);

            // Load sections
            const sectionsResponse = await fetch('/sections');
            if (!sectionsResponse.ok) throw new Error('Failed to fetch sections');
            const sections = await sectionsResponse.json();
            console.log(`Loaded ${sections.length} sections`);

            dashboardState.data = {
                students,
                teachers,
                rooms,
                schedules,
                subjects,
                sections,
                lastUpdate: new Date()
            };

            console.log('All data loaded successfully');

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            throw error;
        }
    }

    // Initialize dashboard components
    function initializeDashboardComponents() {
        updateKPICards();
        updateRecentActivity();
        renderAllCharts();
        updateLastUpdated();
    }

    // Update KPI cards with real data
    function updateKPICards() {
        const { students, teachers, rooms, schedules } = dashboardState.data;

        // Total Students
        const totalStudentsEl = document.getElementById('totalStudents');
        if (totalStudentsEl) totalStudentsEl.textContent = students.length;
        updateTrend('studentsTrend', students.length, 0);

        // Total Teachers
        const totalTeachersEl = document.getElementById('totalTeachers');
        if (totalTeachersEl) totalTeachersEl.textContent = teachers.length;
        updateTrend('teachersTrend', teachers.length, 0);

        // Available Rooms
        const availableRooms = rooms.filter(room => room.status === 'Available').length;
        const totalRooms = rooms.length;
        const availableRoomsEl = document.getElementById('availableRooms');
        if (availableRoomsEl) availableRoomsEl.textContent = availableRooms;
        const totalRoomsEl = document.getElementById('totalRooms');
        if (totalRoomsEl) totalRoomsEl.textContent = totalRooms;
        updateTrend('roomsTrend', availableRooms, 0);

        // Active Schedules
        const activeSchedulesEl = document.getElementById('activeSchedules');
        if (activeSchedulesEl) activeSchedulesEl.textContent = schedules.length;
        updateTrend('schedulesTrend', schedules.length, 0);
    }

    // Update trend indicators
    function updateTrend(elementId, currentValue, previousValue) {
        const trendElement = document.getElementById(elementId);
        if (!trendElement) return;
        
        const difference = currentValue - previousValue;
        
        if (difference > 0) {
            trendElement.innerHTML = `<i class="bi bi-arrow-up"></i> <span>+${difference}</span>`;
            trendElement.className = 'kpi-trend positive';
        } else if (difference < 0) {
            trendElement.innerHTML = `<i class="bi bi-arrow-down"></i> <span>${difference}</span>`;
            trendElement.className = 'kpi-trend negative';
        } else {
            trendElement.innerHTML = `<i class="bi bi-dash"></i> <span>No change</span>`;
            trendElement.className = 'kpi-trend neutral';
        }
    }

    // [Keep all the chart rendering functions the same as before...]
    // Student Distribution Chart
    function renderStudentDistributionChart() {
        const ctx = document.getElementById('studentDistributionChart');
        if (!ctx) return;
        
        const context = ctx.getContext('2d');
        const type = dashboardState.filters.studentDistributionType;
        
        // Destroy existing chart
        if (dashboardState.charts.studentDistribution) {
            dashboardState.charts.studentDistribution.destroy();
        }

        let labels, data, backgroundColor;

        switch (type) {
            case 'section':
                const sectionData = aggregateStudentsBySection();
                labels = sectionData.labels;
                data = sectionData.data;
                backgroundColor = generateCTUColors(labels.length);
                break;

            case 'year':
                const yearData = aggregateStudentsByYear();
                labels = yearData.labels;
                data = yearData.data;
                backgroundColor = ['#3E8EDE', '#4BB543', '#FF6835', '#8B5CF6'];
                break;

            case 'program':
                const programData = aggregateStudentsByProgram();
                labels = programData.labels;
                data = programData.data;
                backgroundColor = generateCTUColors(labels.length);
                break;
        }

        dashboardState.charts.studentDistribution = new Chart(context, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Number of Students',
                    data: data,
                    backgroundColor: backgroundColor,
                    borderColor: backgroundColor.map(color => color.replace('0.8', '1')),
                    borderWidth: 0,
                    borderRadius: 6,
                    maxBarThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#555'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        },
                        ticks: {
                            color: '#555',
                            stepSize: Math.max(1, Math.ceil(Math.max(...data) / 5))
                        }
                    }
                }
            }
        });
    }

    // Room Utilization Chart
    function renderRoomUtilizationChart() {
        const ctx = document.getElementById('roomUtilizationChart');
        if (!ctx) return;
        
        const context = ctx.getContext('2d');
        const type = dashboardState.filters.roomChartType;
        
        if (dashboardState.charts.roomUtilization) {
            dashboardState.charts.roomUtilization.destroy();
        }

        let labels, data, backgroundColor;

        switch (type) {
            case 'status':
                const statusData = aggregateRoomsByStatus();
                labels = statusData.labels;
                data = statusData.data;
                backgroundColor = ['#4BB543', '#FF6835', '#D8000C'];
                break;

            case 'building':
                const buildingData = aggregateRoomsByBuilding();
                labels = buildingData.labels;
                data = buildingData.data;
                backgroundColor = generateCTUColors(labels.length);
                break;

            case 'type':
                const typeData = aggregateRoomsByType();
                labels = typeData.labels;
                data = typeData.data;
                backgroundColor = ['#3E8EDE', '#8B5CF6', '#EC4899'];
                break;
        }

        dashboardState.charts.roomUtilization = new Chart(context, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColor,
                    borderColor: '#FFFFFF',
                    borderWidth: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#555',
                            font: {
                                size: 12
                            },
                            padding: 15
                        }
                    }
                }
            }
        });
    }

    // Schedule Density Chart
    function renderScheduleDensityChart() {
        const ctx = document.getElementById('scheduleDensityChart');
        if (!ctx) return;
        
        const context = ctx.getContext('2d');
        const type = dashboardState.filters.scheduleDensityType;
        
        if (dashboardState.charts.scheduleDensity) {
            dashboardState.charts.scheduleDensity.destroy();
        }

        let labels, data, backgroundColor;

        switch (type) {
            case 'day':
                const dayData = aggregateSchedulesByDay();
                labels = dayData.labels;
                data = dayData.data;
                backgroundColor = generateCTUColors(labels.length, 0.7);
                break;

            case 'type':
                const scheduleTypeData = aggregateSchedulesByType();
                labels = scheduleTypeData.labels;
                data = scheduleTypeData.data;
                backgroundColor = ['#3E8EDE', '#8B5CF6'];
                break;
        }

        dashboardState.charts.scheduleDensity = new Chart(context, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Number of Schedules',
                    data: data,
                    backgroundColor: backgroundColor,
                    borderColor: backgroundColor.map(color => color.replace('0.7', '1')),
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#555'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        },
                        ticks: {
                            color: '#555',
                            stepSize: Math.max(1, Math.ceil(Math.max(...data) / 5))
                        }
                    }
                }
            }
        });
    }

    // [Keep all the data aggregation functions the same...]
    function aggregateStudentsBySection() {
        const sectionCounts = {};
        dashboardState.data.students.forEach(student => {
            const section = student.section || 'Unassigned';
            sectionCounts[section] = (sectionCounts[section] || 0) + 1;
        });

        const entries = Object.entries(sectionCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        return {
            labels: entries.map(([section]) => section),
            data: entries.map(([, count]) => count)
        };
    }

    function aggregateStudentsByYear() {
        const yearCounts = { 
            '1st Year': 0, 
            '2nd Year': 0, 
            '3rd Year': 0, 
            '4th Year': 0,
            'Unassigned': 0
        };
        
        dashboardState.data.students.forEach(student => {
            let yearLevel = 'Unassigned';
            
            if (student.section) {
                const section = dashboardState.data.sections.find(s => s.sectionName === student.section);
                if (section && section.yearLevel) {
                    yearLevel = `${section.yearLevel} Year`;
                }
            }
            
            yearCounts[yearLevel] = (yearCounts[yearLevel] || 0) + 1;
        });

        if (yearCounts['Unassigned'] === 0) {
            delete yearCounts['Unassigned'];
        }

        return {
            labels: Object.keys(yearCounts),
            data: Object.values(yearCounts)
        };
    }

    function aggregateStudentsByProgram() {
        const programCounts = {};
        
        dashboardState.data.students.forEach(student => {
            let program = 'Unassigned';
            
            if (student.section) {
                const section = dashboardState.data.sections.find(s => s.sectionName === student.section);
                if (section && section.programID) {
                    program = section.programID;
                }
            }
            
            programCounts[program] = (programCounts[program] || 0) + 1;
        });

        const entries = Object.entries(programCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);

        return {
            labels: entries.map(([program]) => program),
            data: entries.map(([, count]) => count)
        };
    }

    function aggregateRoomsByStatus() {
        const statusCounts = { 'Available': 0, 'Under Maintenance': 0, 'Occupied': 0 };
        dashboardState.data.rooms.forEach(room => {
            statusCounts[room.status] = (statusCounts[room.status] || 0) + 1;
        });

        return {
            labels: Object.keys(statusCounts),
            data: Object.values(statusCounts)
        };
    }

    function aggregateRoomsByBuilding() {
        const buildingCounts = {};
        dashboardState.data.rooms.forEach(room => {
            buildingCounts[room.building] = (buildingCounts[room.building] || 0) + 1;
        });

        return {
            labels: Object.keys(buildingCounts),
            data: Object.values(buildingCounts)
        };
    }

    function aggregateRoomsByType() {
        const typeCounts = {};
        dashboardState.data.rooms.forEach(room => {
            typeCounts[room.roomType] = (typeCounts[room.roomType] || 0) + 1;
        });

        return {
            labels: Object.keys(typeCounts),
            data: Object.values(typeCounts)
        };
    }

    function aggregateSchedulesByDay() {
        const dayCounts = {
            'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
            'Thursday': 0, 'Friday': 0, 'Saturday': 0
        };
        
        if (dashboardState.data.schedules && dashboardState.data.schedules.length > 0) {
            dashboardState.data.schedules.forEach(schedule => {
                if (schedule.day && dayCounts.hasOwnProperty(schedule.day)) {
                    dayCounts[schedule.day]++;
                }
            });
        }

        return {
            labels: Object.keys(dayCounts),
            data: Object.values(dayCounts)
        };
    }

    function aggregateSchedulesByType() {
        const typeCounts = { 
            'Lecture': 0, 
            'Lab': 0,
            'Unknown': 0 
        };
        
        if (dashboardState.data.schedules && dashboardState.data.schedules.length > 0) {
            dashboardState.data.schedules.forEach(schedule => {
                let scheduleType = 'Unknown';
                
                if (schedule.scheduleType) {
                    scheduleType = schedule.scheduleType;
                } else if (schedule.subject) {
                    const subject = dashboardState.data.subjects.find(s => s._id === schedule.subject._id || s._id === schedule.subject);
                    if (subject && subject.lecHours && subject.labHours) {
                        scheduleType = parseInt(subject.labHours) > 0 ? 'Lab' : 'Lecture';
                    }
                }
                
                scheduleType = scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1).toLowerCase();
                
                if (scheduleType === 'Lecture' || scheduleType === 'Lab') {
                    typeCounts[scheduleType] = (typeCounts[scheduleType] || 0) + 1;
                } else {
                    typeCounts['Unknown'] = (typeCounts['Unknown'] || 0) + 1;
                }
            });
        }

        if (typeCounts['Unknown'] === 0) {
            delete typeCounts['Unknown'];
        }

        return {
            labels: Object.keys(typeCounts),
            data: Object.values(typeCounts)
        };
    }

    // Update recent activity
    function updateRecentActivity() {
        const activityContainer = document.getElementById('recentActivity');
        if (!activityContainer) return;
        
        const { students, teachers, rooms, schedules, sections, subjects } = dashboardState.data;

        const activities = [];

        // Helper function to create activity object
        const createActivity = (icon, text, timestamp, type = 'info') => {
            return {
                icon,
                text,
                timestamp: timestamp ? new Date(timestamp) : new Date(),
                time: formatTimeAgo(timestamp),
                type
            };
        };

        // Student activities
        students.forEach(student => {
            if (student.lastLogin) {
                activities.push(createActivity(
                    'person-check',
                    `Student ${student.fullname} logged in`,
                    student.lastLogin,
                    'success'
                ));
            }
            
            const registrationDate = student.createdAt || student.registrationDate;
            if (registrationDate) {
                activities.push(createActivity(
                    'person-plus',
                    `New student registered: ${student.fullname}`,
                    registrationDate,
                    'info'
                ));
            }
        });

        // Teacher activities
        teachers.forEach(teacher => {
            if (teacher.lastLogin) {
                activities.push(createActivity(
                    'person-check',
                    `Teacher ${teacher.fullname} logged in`,
                    teacher.lastLogin,
                    'success'
                ));
            }
        });

        // Room activities
        rooms.forEach(room => {
            if (room.updatedAt && room.status === 'Under Maintenance') {
                activities.push(createActivity(
                    'tools',
                    `Room ${room.roomName} set to maintenance`,
                    room.updatedAt,
                    'warning'
                ));
            }
            
            if (room.createdAt) {
                activities.push(createActivity(
                    'building-add',
                    `New room added: ${room.roomName}`,
                    room.createdAt,
                    'info'
                ));
            }
        });

        // Schedule activities
        schedules.forEach(schedule => {
            if (schedule.createdAt) {
                const subjectName = schedule.subject?.descriptiveTitle || schedule.subject?.courseCode || 'Unknown Subject';
                activities.push(createActivity(
                    'calendar-plus',
                    `Schedule created for ${subjectName}`,
                    schedule.createdAt,
                    'info'
                ));
            }
        });

        // Section activities
        sections.forEach(section => {
            if (section.createdAt) {
                activities.push(createActivity(
                    'layers',
                    `New section created: ${section.sectionName}`,
                    section.createdAt,
                    'info'
                ));
            }
        });

        // Subject activities
        subjects.forEach(subject => {
            if (subject.createdAt) {
                activities.push(createActivity(
                    'book',
                    `New subject added: ${subject.courseCode}`,
                    subject.createdAt,
                    'info'
                ));
            }
        });

        // Sort activities by timestamp in descending order (newest first)
        activities.sort((a, b) => b.timestamp - a.timestamp);

        // Limit to 6 most recent activities
        const recentActivities = activities.slice(0, 6);

        // If no activities, show a default message
        if (recentActivities.length === 0) {
            recentActivities.push(createActivity(
                'info-circle',
                'No recent activity recorded',
                new Date(),
                'info'
            ));
        }

        activityContainer.innerHTML = recentActivities.map(activity => `
            <div class="activity-item ${activity.type}">
                <i class="bi bi-${activity.icon}"></i>
                <div class="activity-content">
                    <span class="activity-text">${activity.text}</span>
                    <span class="activity-time">${activity.time}</span>
                </div>
            </div>
        `).join('');
    }

    // Enhanced utility function to format time ago
    function formatTimeAgo(dateString) {
        if (!dateString) return 'Unknown time';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffSecs < 60) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }

    // Update last updated timestamp
    function updateLastUpdated() {
        const lastUpdatedElement = document.getElementById('lastUpdated');
        if (lastUpdatedElement && dashboardState.data.lastUpdate) {
            lastUpdatedElement.textContent = `Last updated: ${dashboardState.data.lastUpdate.toLocaleTimeString()}`;
        }
    }

    async function refreshDashboardData() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.classList.add('loading');
        }
        
        try {
            await loadAllData();
            initializeDashboardComponents();
            showNotification('Dashboard updated successfully', 'success');
        } catch (error) {
            console.error('Error refreshing dashboard:', error);
            showNotification('Failed to refresh dashboard data', 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.classList.remove('loading');
            }
        }
    }

    function setupAutoRefresh() {
        // Auto-refresh every 5 minutes
        setInterval(() => {
            refreshDashboardData();
        }, 5 * 60 * 1000);
    }

    // Utility functions
    function generateCTUColors(count, opacity = 1) {
        const ctuColors = [
            '#3E8EDE', '#4BB543', '#FF6835', '#8B5CF6', '#06D6A0',
            '#F2D283', '#002D62', '#A3000C', '#6366F1', '#84CC16'
        ];
        
        return ctuColors.slice(0, count).map(color => {
            if (opacity < 1) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${opacity})`;
            }
            return color;
        });
    }

    // UI Utility Functions
    function showLoadingOverlay() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    }

    function hideLoadingOverlay() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            z-index: 10000;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: 'Inter', sans-serif;
        `;
        
        if (type === 'success') {
            notification.style.backgroundColor = '#4BB543';
        } else {
            notification.style.backgroundColor = '#D8000C';
        }

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    function showError(message) {
        showNotification(message, 'error');
    }

    // Render all charts
    function renderAllCharts() {
        renderStudentDistributionChart();
        renderRoomUtilizationChart();
        renderScheduleDensityChart();
    }
});