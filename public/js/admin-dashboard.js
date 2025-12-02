// public/js/admin-dashboard.js - ENHANCED VERSION
import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';
import AuthGuard from './auth-guard.js';
import pdfExporter from './dashboard-pdf-export.js';

// Data caching with TTL
const cache = {
    set: (key, data, ttl = 5 * 60 * 1000) => {
        try {
            const item = {
                data,
                expiry: Date.now() + ttl
            };
            localStorage.setItem(`dashboard_${key}`, JSON.stringify(item));
        } catch (error) {
            console.warn('Cache set failed:', error);
        }
    },
    get: (key) => {
        try {
            const item = localStorage.getItem(`dashboard_${key}`);
            if (!item) return null;
            
            const { data, expiry } = JSON.parse(item);
            if (Date.now() > expiry) {
                localStorage.removeItem(`dashboard_${key}`);
                return null;
            }
            return data;
        } catch (error) {
            console.warn('Cache get failed:', error);
            return null;
        }
    },
    clear: (key) => {
        try {
            localStorage.removeItem(`dashboard_${key}`);
        } catch (error) {
            console.warn('Cache clear failed:', error);
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin Dashboard loaded');
    
    // Check authentication first
    if (!AuthGuard.checkAuthentication('admin')) {
        return;
    }

    // Skip desktop initialization if on mobile page
    if (window.location.pathname.includes('-mobile')) {
        console.log('Mobile page detected, skipping desktop dashboard.js initialization');
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
        },
        isLoading: false,
        isOnline: navigator.onLine
    };

    // Initialize the dashboard
    initializeDashboard();

    // Setup online/offline detection
    setupConnectionMonitoring();

    // Profile dropdown functionality with enhanced animations
    const profileDropdown = document.querySelector('.admin-profile-dropdown');
    if (profileDropdown) {
        profileDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = profileDropdown.classList.toggle('open');
            profileDropdown.setAttribute('aria-expanded', isOpen);
            
            // Add ripple effect
            createRipple(e, this);
        });

        // Keyboard navigation for profile dropdown
        profileDropdown.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const isOpen = profileDropdown.classList.toggle('open');
                profileDropdown.setAttribute('aria-expanded', isOpen);
            } else if (e.key === 'Escape') {
                profileDropdown.classList.remove('open');
                profileDropdown.setAttribute('aria-expanded', 'false');
            }
        });

        document.addEventListener('click', function() {
            profileDropdown.classList.remove('open');
            profileDropdown.setAttribute('aria-expanded', 'false');
        });
    }

    // Logout functionality with confirmation
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (confirm('Are you sure you want to logout?')) {
                showNotification('Logging out...', 'info');
                setTimeout(() => {
                    AuthGuard.logout();
                }, 1000);
            }
        });
    }

    // Enhanced refresh button functionality
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function(e) {
            createRipple(e, this);
            refreshDashboardData();
        });
    }

    // Export data button functionality
    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', async function(e) {
            createRipple(e, this);
            await exportDashboardData();
        });
    }

    // Filter event listeners with smooth transitions
    const studentDistributionType = document.getElementById('studentDistributionType');
    if (studentDistributionType) {
        studentDistributionType.addEventListener('change', function() {
            dashboardState.filters.studentDistributionType = sanitizeChartFilter('studentDistributionType', this.value);
            animateChartTransition('studentDistributionChart');
            setTimeout(() => renderStudentDistributionChart(), 300);
            trackUserInteraction('filter_change', 'student_distribution', this.value);
        });
    }

    const roomChartType = document.getElementById('roomChartType');
    if (roomChartType) {
        roomChartType.addEventListener('change', function() {
            dashboardState.filters.roomChartType = sanitizeChartFilter('roomChartType', this.value);
            animateChartTransition('roomUtilizationChart');
            setTimeout(() => renderRoomUtilizationChart(), 300);
            trackUserInteraction('filter_change', 'room_utilization', this.value);
        });
    }

    const scheduleDensityType = document.getElementById('scheduleDensityType');
    if (scheduleDensityType) {
        scheduleDensityType.addEventListener('change', function() {
            dashboardState.filters.scheduleDensityType = sanitizeChartFilter('scheduleDensityType', this.value);
            animateChartTransition('scheduleDensityChart');
            setTimeout(() => renderScheduleDensityChart(), 300);
            trackUserInteraction('filter_change', 'schedule_density', this.value);
        });
    }

    // Update profile info with animation
    function updateProfileInfo() {
        const currentUser = AuthGuard.getCurrentUser();
        if (currentUser) {
            const firstName = currentUser.fullname.split(' ')[0];
            const profileName = document.getElementById('profileName');
            if (profileName) {
                profileName.style.opacity = '0';
                setTimeout(() => {
                    profileName.innerHTML = `${firstName} <i class="bi bi-chevron-down" aria-hidden="true"></i>`;
                    profileName.style.opacity = '1';
                }, 200);
            }

            const profileAvatar = document.getElementById('profileAvatar');
            if (profileAvatar) {
                profileAvatar.style.opacity = '0';
                setTimeout(() => {
                    if (currentUser.profilePicture) {
                        profileAvatar.src = currentUser.profilePicture.startsWith('http') 
                            ? currentUser.profilePicture 
                            : currentUser.profilePicture;
                    } else {
                        profileAvatar.src = '/img/default_admin_avatar.png';
                    }
                    profileAvatar.style.opacity = '1';
                }, 200);
            }
        }
    }

    // Initialize dashboard with loading animation
    async function initializeDashboard() {
        showLoadingOverlay();
        updateProfileInfo();
        
        try {
            // Try to load from cache first
            const cachedData = cache.get('dashboard_data');
            if (cachedData && dashboardState.isOnline) {
                console.log('Loading data from cache');
                dashboardState.data = { ...cachedData, lastUpdate: new Date() };
                await initializeDashboardComponents();
                showNotification('Loaded cached data', 'info');
            }

            // Always try to fetch fresh data
            if (dashboardState.isOnline) {
                await loadAllData();
                await initializeDashboardComponents();
            }
            
            setupAutoRefresh();
            setupKeyboardShortcuts();
            addPageAnimations();
            initializeLazyCharts();
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            if (!dashboardState.isOnline && !cache.get('dashboard_data')) {
                showError('You are offline and no cached data is available.');
            } else {
                showError('Failed to load dashboard data. Please check your connection and try again.');
            }
        } finally {
            setTimeout(() => hideLoadingOverlay(), 500);
        }
    }

    // Setup connection monitoring
    function setupConnectionMonitoring() {
        const connectionStatus = document.getElementById('connectionStatus');
        
        function updateConnectionStatus() {
            dashboardState.isOnline = navigator.onLine;
            
            if (connectionStatus) {
                if (dashboardState.isOnline) {
                    connectionStatus.textContent = 'Back online';
                    connectionStatus.className = 'connection-status online';
                    setTimeout(() => {
                        connectionStatus.textContent = '';
                        connectionStatus.className = 'connection-status';
                    }, 3000);
                } else {
                    connectionStatus.textContent = 'You are currently offline';
                    connectionStatus.className = 'connection-status offline';
                }
            }
            
            if (dashboardState.isOnline) {
                // Try to refresh data when coming back online
                refreshDashboardData();
            }
        }

        window.addEventListener('online', updateConnectionStatus);
        window.addEventListener('offline', updateConnectionStatus);
        updateConnectionStatus();
    }

    // Load all data from MongoDB with enhanced error handling and retry mechanism
    async function loadAllData() {
        if (!dashboardState.isOnline) {
            throw new Error('No internet connection');
        }

        try {
            console.log('Starting data load from server...');
            
            // Load all data concurrently for better performance
            const [studentsResponse, teachersResponse, roomsResponse, schedulesResponse, subjectsResponse, sectionsResponse] = await Promise.all([
                loadDataWithRetry('/users/students'),
                loadDataWithRetry('/teachers'),
                loadDataWithRetry('/rooms'),
                loadDataWithRetry('/schedules'),
                loadDataWithRetry('/subjects'),
                loadDataWithRetry('/sections')
            ]);

            // Parse data
            const students = Array.isArray(studentsResponse) ? studentsResponse : [];
            const teachers = Array.isArray(teachersResponse) ? teachersResponse : [];
            const rooms = Array.isArray(roomsResponse) ? roomsResponse : [];
            const schedules = Array.isArray(schedulesResponse) ? schedulesResponse : [];
            const subjects = Array.isArray(subjectsResponse) ? subjectsResponse : [];
            const sections = Array.isArray(sectionsResponse) ? sectionsResponse : [];

            const newData = {
                students,
                teachers,
                rooms,
                schedules,
                subjects,
                sections,
                lastUpdate: new Date()
            };

            dashboardState.data = newData;
            
            // Cache the data
            cache.set('dashboard_data', newData);

            console.log('All data loaded successfully');
            trackUserInteraction('data_load', 'dashboard', 'success');

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            trackUserInteraction('data_load', 'dashboard', 'error');
            throw error;
        }
    }

    // Retry mechanism for API calls
    async function loadDataWithRetry(url, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    return await response.json();
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                if (i === retries - 1) throw error;
                console.warn(`Attempt ${i + 1} failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
        throw new Error(`Failed to load data from ${url} after ${retries} attempts`);
    }

    // Lazy loading for charts
    function initializeLazyCharts() {
        const chartObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const chartId = entry.target.id;
                    if (chartId === 'studentDistributionChart' && !dashboardState.charts.studentDistribution) {
                        renderStudentDistributionChart();
                    } else if (chartId === 'roomUtilizationChart' && !dashboardState.charts.roomUtilization) {
                        renderRoomUtilizationChart();
                    } else if (chartId === 'scheduleDensityChart' && !dashboardState.charts.scheduleDensity) {
                        renderScheduleDensityChart();
                    }
                    
                    chartObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.chart-wrapper canvas').forEach(canvas => {
            chartObserver.observe(canvas);
        });
    }

    // Initialize dashboard components with animations
    async function initializeDashboardComponents() {
        updateKPICards();
        updateRecentActivity();
        renderAllCharts();
        updateLastUpdated();
        initializeTooltips();
    }

    // Update KPI cards with animated counters
    function updateKPICards() {
        const { students, teachers, rooms, schedules } = dashboardState.data;

        // Animate counters
        animateCounter('totalStudents', students.length);
        animateCounter('totalTeachers', teachers.length);
        
        const availableRooms = rooms.filter(room => room.status === 'Available').length;
        const totalRooms = rooms.length;
        animateCounter('availableRooms', availableRooms);
        animateCounter('totalRooms', totalRooms);
        
        animateCounter('activeSchedules', schedules.length);

        // Update trends with animations
        updateTrend('studentsTrend', students.length, 0);
        updateTrend('teachersTrend', teachers.length, 0);
        updateTrend('roomsTrend', availableRooms, 0);
        updateTrend('schedulesTrend', schedules.length, 0);
    }

    // Animate counter numbers
    function animateCounter(elementId, targetValue) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const duration = 1000;
        const startValue = 0;
        const startTime = performance.now();
        
        function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOutQuart);
            
            element.textContent = currentValue.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        }
        
        requestAnimationFrame(updateCounter);
    }

    // Update trend indicators with animations
    function updateTrend(elementId, currentValue, previousValue) {
        const trendElement = document.getElementById(elementId);
        if (!trendElement) return;
        
        const difference = currentValue - previousValue;
        
        trendElement.style.opacity = '0';
        setTimeout(() => {
            if (difference > 0) {
                trendElement.innerHTML = `<i class="bi bi-arrow-up" aria-hidden="true"></i> <span>+${difference}</span>`;
                trendElement.className = 'kpi-trend positive';
            } else if (difference < 0) {
                trendElement.innerHTML = `<i class="bi bi-arrow-down" aria-hidden="true"></i> <span>${difference}</span>`;
                trendElement.className = 'kpi-trend negative';
            } else {
                trendElement.innerHTML = `<i class="bi bi-dash" aria-hidden="true"></i> <span>No change</span>`;
                trendElement.className = 'kpi-trend neutral';
            }
            trendElement.style.opacity = '1';
        }, 200);
    }

    // Enhanced Student Distribution Chart
    function renderStudentDistributionChart() {
        const ctx = document.getElementById('studentDistributionChart');
        if (!ctx) return;
        
        const context = ctx.getContext('2d');
        const type = dashboardState.filters.studentDistributionType;
        
        // Destroy existing chart with animation
        if (dashboardState.charts.studentDistribution) {
            dashboardState.charts.studentDistribution.destroy();
        }

        let labels, data, backgroundColor;

        switch (type) {
            case 'section':
                const sectionData = aggregateStudentsBySection();
                labels = sectionData.labels;
                data = sectionData.data;
                backgroundColor = generateCTUColors(labels.length, 0.8);
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
                backgroundColor = generateCTUColors(labels.length, 0.8);
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
                    borderRadius: 8,
                    maxBarThickness: 50
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 45, 98, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Students: ${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#555',
                            font: {
                                size: 12
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        },
                        ticks: {
                            color: '#555',
                            font: {
                                size: 12
                            },
                            stepSize: Math.max(1, Math.ceil(Math.max(...data) / 5))
                        }
                    }
                }
            }
        });
    }

    // Enhanced Room Utilization Chart
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
                backgroundColor = generateCTUColors(labels.length, 0.8);
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
                    borderWidth: 3,
                    hoverOffset: 15,
                    hoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1000,
                    easing: 'easeInOutQuart'
                },
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#555',
                            font: {
                                size: 12,
                                weight: '500'
                            },
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 45, 98, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Enhanced Schedule Density Chart
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
                    borderRadius: 8,
                    maxBarThickness: 50
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart',
                    delay: (context) => {
                        let delay = 0;
                        if (context.type === 'data' && context.mode === 'default') {
                            delay = context.dataIndex * 100;
                        }
                        return delay;
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 45, 98, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Schedules: ${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#555',
                            font: {
                                size: 12
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        },
                        ticks: {
                            color: '#555',
                            font: {
                                size: 12
                            },
                            stepSize: Math.max(1, Math.ceil(Math.max(...data) / 5))
                        }
                    }
                }
            }
        });
    }

    // Data aggregation functions
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

    // Enhanced recent activity with animations
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

        // Fade out current activities
        activityContainer.style.opacity = '0';
        
        setTimeout(() => {
            activityContainer.innerHTML = recentActivities.map((activity, index) => `
                <div class="activity-item ${activity.type}" style="animation-delay: ${index * 0.1}s" tabindex="0">
                    <i class="bi bi-${activity.icon}" aria-hidden="true"></i>
                    <div class="activity-content">
                        <span class="activity-text">${activity.text}</span>
                        <span class="activity-time">${activity.time}</span>
                    </div>
                </div>
            `).join('');
            
            // Fade in new activities
            activityContainer.style.opacity = '1';
        }, 300);
    }

    // Enhanced time formatting
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

    // Update last updated timestamp with animation
    function updateLastUpdated() {
        const lastUpdatedElement = document.getElementById('lastUpdated');
        if (lastUpdatedElement && dashboardState.data.lastUpdate) {
            lastUpdatedElement.style.opacity = '0';
            setTimeout(() => {
                lastUpdatedElement.textContent = `Last updated: ${dashboardState.data.lastUpdate.toLocaleTimeString()}`;
                lastUpdatedElement.style.opacity = '1';
            }, 200);
        }
    }

    // Enhanced refresh functionality
    async function refreshDashboardData() {
        if (dashboardState.isLoading || !dashboardState.isOnline) {
            showNotification('Cannot refresh while offline or already refreshing', 'error');
            return;
        }
        
        dashboardState.isLoading = true;
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.classList.add('loading');
            refreshBtn.disabled = true;
        }
        
        try {
            await loadAllData();
            await initializeDashboardComponents();
            showNotification('Dashboard updated successfully', 'success');
            trackUserInteraction('manual_refresh', 'dashboard', 'success');
        } catch (error) {
            console.error('Error refreshing dashboard:', error);
            showNotification('Failed to refresh dashboard data', 'error');
            trackUserInteraction('manual_refresh', 'dashboard', 'error');
        } finally {
            dashboardState.isLoading = false;
            if (refreshBtn) {
                refreshBtn.classList.remove('loading');
                refreshBtn.disabled = false;
            }
        }
    }

    // Setup auto-refresh with user notification
    function setupAutoRefresh() {
        // Auto-refresh every 5 minutes only when online
        setInterval(() => {
            if (!document.hidden && dashboardState.isOnline) {
                showNotification('Auto-refreshing dashboard...', 'info');
                refreshDashboardData();
            }
        }, 5 * 60 * 1000);
    }

    // Setup keyboard shortcuts
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            // Ctrl/Cmd + R to refresh
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                refreshDashboardData();
            }
            
            // Escape to close dropdowns
            if (e.key === 'Escape') {
                document.querySelector('.admin-profile-dropdown')?.classList.remove('open');
            }
            
            // Focus management for accessibility
            if (e.key === 'Tab') {
                // Ensure focus is visible
                document.documentElement.classList.add('keyboard-navigation');
            }
        });

        document.addEventListener('mousedown', function() {
            document.documentElement.classList.remove('keyboard-navigation');
        });
    }

    // Add page animations
    function addPageAnimations() {
        // Add entrance animations to cards
        const cards = document.querySelectorAll('.kpi-card, .chart-container, .actions-card, .activity-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            setTimeout(() => {
                card.style.transition = 'all 0.5s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    // Initialize tooltips
    function initializeTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', function(e) {
                const tooltip = document.createElement('div');
                tooltip.className = 'custom-tooltip';
                tooltip.textContent = this.getAttribute('data-tooltip');
                document.body.appendChild(tooltip);
                
                const rect = this.getBoundingClientRect();
                tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
                tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
                
                setTimeout(() => tooltip.classList.add('show'), 10);
            });
            
            element.addEventListener('mouseleave', function() {
                const tooltip = document.querySelector('.custom-tooltip');
                if (tooltip) {
                    tooltip.classList.remove('show');
                    setTimeout(() => tooltip.remove(), 200);
                }
            });

            element.addEventListener('focus', function(e) {
                const tooltip = document.createElement('div');
                tooltip.className = 'custom-tooltip';
                tooltip.textContent = this.getAttribute('data-tooltip');
                document.body.appendChild(tooltip);
                
                const rect = this.getBoundingClientRect();
                tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
                tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
                
                setTimeout(() => tooltip.classList.add('show'), 10);
            });

            element.addEventListener('blur', function() {
                const tooltip = document.querySelector('.custom-tooltip');
                if (tooltip) {
                    tooltip.classList.remove('show');
                    setTimeout(() => tooltip.remove(), 200);
                }
            });
        });
    }

    // Animate chart transitions
    function animateChartTransition(chartId) {
        const chartContainer = document.getElementById(chartId)?.closest('.chart-container');
        if (chartContainer) {
            chartContainer.style.opacity = '0.5';
            chartContainer.style.transform = 'scale(0.95)';
            setTimeout(() => {
                chartContainer.style.opacity = '1';
                chartContainer.style.transform = 'scale(1)';
            }, 300);
        }
    }

    // Input sanitization for security
    function sanitizeChartFilter(type, value) {
        const allowedValues = {
            studentDistributionType: ['section', 'year', 'program'],
            roomChartType: ['status', 'building', 'type'],
            scheduleDensityType: ['day', 'type']
        };
        
        return allowedValues[type]?.includes(value) ? value : allowedValues[type][0];
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

    // Create ripple effect
    function createRipple(event, element) {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        element.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    // Enhanced UI Utility Functions
    function showLoadingOverlay() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                loadingOverlay.style.opacity = '1';
            }, 10);
        }
    }

    function hideLoadingOverlay() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 300);
        }
    }

    // Enhanced notification system
    function showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(n => n.remove());
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');
        notification.innerHTML = `
            <div class="notification-content">
                <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}" aria-hidden="true"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    function showError(message) {
        showNotification(message, 'error');
    }

    // Render all charts with staggered animation
    function renderAllCharts() {
        // Charts are now lazy loaded via initializeLazyCharts
    }

    // Analytics tracking
    function trackUserInteraction(action, category, label) {
        // Basic analytics tracking - can be extended with Google Analytics, etc.
        console.log(`User Interaction: ${action} - ${category} - ${label}`);
        
        if (typeof gtag !== 'undefined') {
            gtag('event', action, {
                event_category: category,
                event_label: label
            });
        }
    }

    // Add CSS for animations
    const animationStyles = document.createElement('style');
    animationStyles.textContent = `
        .keyboard-navigation *:focus {
            outline: 2px solid var(--ctu-soft-gold) !important;
            outline-offset: 2px !important;
        }
    `;
    document.head.appendChild(animationStyles);

    /**
     * Export Dashboard Data as PDF
     */
    async function exportDashboardData() {
        try {
            // Show notification
            showNotification('Preparing export options...', 'info');
            
            // Show export dialog and get user choice
            const exportType = await pdfExporter.showExportDialog(dashboardState.data);
            
            if (exportType) {
                showNotification(`${exportType.charAt(0).toUpperCase() + exportType.slice(1)} report generated successfully!`, 'success');
                trackUserInteraction('export_data', 'dashboard', exportType);
            }
        } catch (error) {
            console.error('Export error:', error);
            showNotification('Failed to export data. Please try again.', 'error');
            trackUserInteraction('export_data', 'dashboard', 'error');
        }
    }
});



