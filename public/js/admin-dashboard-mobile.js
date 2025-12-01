// admin-dashboard-mobile.js - Mobile dashboard with all fixes applied
// Uses the same improved logic as desktop version

import AuthGuard from './auth-guard.js';
import { cache } from './dashboard-cache.js';
import { loadDashboardData, rateLimiter } from './dashboard-api.js';
import { chartManager, aggregateStudentsBySection, aggregateStudentsByYear, aggregateStudentsByProgram,
         aggregateRoomsByStatus, aggregateRoomsByBuilding, aggregateRoomsByType,
         aggregateSchedulesByDay, aggregateSchedulesByType, getBarChartConfig, getDonutChartConfig } from './dashboard-charts-apex.js';
import { showNotification, updateConnectionStatus, animateCounter, updateTrend } from './dashboard-ui.js';
import { sanitizeChartFilter, sanitizeHTML, formatTimeAgo, createRipple, trackUserInteraction } from './dashboard-utils.js';

/**
 * Mobile Dashboard State Management
 */
class MobileDashboardState {
    constructor() {
        this.data = {
            students: [],
            teachers: [],
            rooms: [],
            schedules: [],
            subjects: [],
            sections: [],
            chartData: {},
            lastUpdate: null
        };
        this.filters = {
            studentDistributionType: 'section',
            roomChartType: 'status',
            scheduleDensityType: 'day'
        };
        this.isLoading = false;
        this.isOnline = navigator.onLine;
    }

    updateData(newData) {
        this.data = { ...this.data, ...newData };
    }

    updateFilter(filterName, value) {
        this.filters[filterName] = value;
    }

    setLoading(loading) {
        this.isLoading = loading;
    }

    setOnline(online) {
        this.isOnline = online;
    }
}

// Initialize mobile dashboard state
const mobileDashboardState = new MobileDashboardState();

/**
 * Main Mobile Dashboard Initialization
 */
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Mobile Admin Dashboard loaded');
    
    // Check authentication first
    if (!AuthGuard.checkAuthentication('admin')) {
        return;
    }

    try {
        await initializeMobileDashboard();
    } catch (error) {
        console.error('Fatal error initializing mobile dashboard:', error);
        showNotification('Failed to initialize dashboard. Please check your connection.', 'error');
    }
});

/**
 * Initialize Mobile Dashboard
 */
async function initializeMobileDashboard() {
    showMobileLoadingOverlay();
    
    try {
        // Setup UI components
        updateMobileProfileInfo();
        setupMobileSideMenu();
        setupMobileEventListeners();
        setupConnectionMonitoring();
        
        // Load data
        await loadData();
        
        // Render dashboard
        await renderMobileDashboard();
        
        showNotification('Dashboard loaded successfully', 'success');
        trackUserInteraction('dashboard_load', 'mobile_dashboard', 'success');
        
    } catch (error) {
        console.error('Error initializing mobile dashboard:', error);
        
        // Try to load from cache as fallback
        const cachedData = cache.get('dashboard_data');
        if (cachedData) {
            mobileDashboardState.updateData(cachedData);
            await renderMobileDashboard();
            showNotification('Loaded from cache (offline mode)', 'warning', 5000);
        } else {
            showNotification('Unable to load dashboard data. Please check your internet connection.', 'error');
        }
        
        trackUserInteraction('dashboard_load', 'mobile_dashboard', 'error');
    } finally {
        hideMobileLoadingOverlay();
    }
}

/**
 * Load dashboard data
 */
async function loadData(forceRefresh = false) {
    if (!mobileDashboardState.isOnline && !forceRefresh) {
        throw new Error('No internet connection');
    }

    // Check rate limit
    if (!rateLimiter.canMakeRequest()) {
        const waitTime = Math.ceil(rateLimiter.getWaitTime() / 1000);
        throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds.`);
    }

    const data = await loadDashboardData(forceRefresh);
    mobileDashboardState.updateData(data);
    
    return data;
}

/**
 * Render mobile dashboard components
 */
async function renderMobileDashboard() {
    updateMobileKPICards();
    renderAllMobileCharts();
    updateMobileRecentActivity();
    updateMobileLastUpdated();
}

/**
 * Update mobile KPI cards
 */
function updateMobileKPICards() {
    const { students, teachers, rooms, schedules } = mobileDashboardState.data;

    // Animate counters
    animateCounter('mobileTotalStudents', students.length);
    animateCounter('mobileTotalTeachers', teachers.length);
    
    const availableRooms = rooms.filter(room => room.status === 'Available').length;
    const totalRooms = rooms.length;
    animateCounter('mobileAvailableRooms', availableRooms);
    animateCounter('mobileTotalRooms', totalRooms);
    
    animateCounter('mobileActiveSchedules', schedules.length);

    // Update trends
    updateTrend('mobileStudentsTrend', students.length, 0);
    updateTrend('mobileTeachersTrend', teachers.length, 0);
    updateTrend('mobileRoomsTrend', availableRooms, 0);
    updateTrend('mobileSchedulesTrend', schedules.length, 0);
}

/**
 * Render all mobile charts
 */
function renderAllMobileCharts() {
    renderMobileStudentDistributionChart();
    renderMobileRoomUtilizationChart();
    renderMobileScheduleDensityChart();
}

/**
 * Render mobile student distribution chart
 */
function renderMobileStudentDistributionChart() {
    const type = mobileDashboardState.filters.studentDistributionType;
    const { students, sections, chartData } = mobileDashboardState.data;
    
    console.log('renderMobileStudentDistributionChart called with type:', type);
    
    let aggregatedData;
    switch (type) {
        case 'section':
            aggregatedData = aggregateStudentsBySection(students, chartData);
            break;
        case 'year':
            aggregatedData = aggregateStudentsByYear(students, sections, chartData);
            break;
        case 'program':
            aggregatedData = aggregateStudentsByProgram(students, sections, chartData);
            break;
        default:
            aggregatedData = aggregateStudentsBySection(students, chartData);
    }

    // Limit to top 6 for mobile
    const labels = aggregatedData.labels.slice(0, 6);
    const data = aggregatedData.data.slice(0, 6);

    const config = getBarChartConfig(labels, data, 'Students');
    
    // Mobile-specific adjustments
    config.chart.height = 200;
    config.chart.toolbar = { show: false };
    config.dataLabels.enabled = false; // Hide data labels on mobile for cleaner look
    
    chartManager.createOrUpdate('mobileStudentDistributionChart', config);
    console.log('Mobile student chart updated successfully');
}

/**
 * Render mobile room utilization chart
 */
function renderMobileRoomUtilizationChart() {
    const type = mobileDashboardState.filters.roomChartType;
    const { rooms, chartData } = mobileDashboardState.data;
    
    console.log('renderMobileRoomUtilizationChart called with type:', type);
    
    let aggregatedData;
    let colors;
    
    switch (type) {
        case 'status':
            aggregatedData = aggregateRoomsByStatus(rooms, chartData);
            colors = ['#4BB543', '#FF6835', '#D8000C'];
            break;
        case 'building':
            aggregatedData = aggregateRoomsByBuilding(rooms, chartData);
            colors = ['#3E8EDE', '#8B5CF6', '#EC4899', '#F2D283', '#00D4FF', '#FF6B9D'];
            break;
        case 'type':
            aggregatedData = aggregateRoomsByType(rooms, chartData);
            colors = ['#3E8EDE', '#8B5CF6', '#EC4899'];
            break;
        default:
            aggregatedData = aggregateRoomsByStatus(rooms, chartData);
            colors = ['#4BB543', '#FF6835', '#D8000C'];
    }

    const config = getDonutChartConfig(aggregatedData.labels, aggregatedData.data, colors);
    
    // Mobile-specific adjustments
    config.chart.height = 250;
    config.chart.toolbar = { show: false };
    config.plotOptions.pie.donut.size = '60%';
    config.legend.position = 'bottom';
    config.legend.fontSize = '11px';
    
    chartManager.createOrUpdate('mobileRoomUtilizationChart', config);
    console.log('Mobile room chart updated successfully');
}

/**
 * Render mobile schedule density chart
 */
function renderMobileScheduleDensityChart() {
    const type = mobileDashboardState.filters.scheduleDensityType;
    const { schedules, subjects, chartData } = mobileDashboardState.data;
    
    console.log('renderMobileScheduleDensityChart called with type:', type);
    
    let aggregatedData;
    
    switch (type) {
        case 'day':
            aggregatedData = aggregateSchedulesByDay(schedules, chartData);
            break;
        case 'type':
            aggregatedData = aggregateSchedulesByType(schedules, subjects, chartData);
            break;
        default:
            aggregatedData = aggregateSchedulesByDay(schedules, chartData);
    }

    const config = getBarChartConfig(aggregatedData.labels, aggregatedData.data, 'Schedules');
    
    // Mobile-specific adjustments
    config.chart.height = 200;
    config.chart.toolbar = { show: false };
    config.dataLabels.enabled = false;
    
    chartManager.createOrUpdate('mobileScheduleDensityChart', config);
    console.log('Mobile schedule chart updated successfully');
}

/**
 * Update mobile recent activity
 */
function updateMobileRecentActivity() {
    const activityContainer = document.getElementById('mobileRecentActivity');
    if (!activityContainer) return;
    
    const { students, teachers, rooms, schedules } = mobileDashboardState.data;
    const activities = [];

    // Collect activities (limited for mobile)
    students.slice(0, 3).forEach(student => {
        if (student.lastLogin) {
            activities.push({
                icon: 'person-check',
                text: `Student ${sanitizeHTML(student.fullname || 'Unknown')} logged in`,
                timestamp: new Date(student.lastLogin),
                type: 'success'
            });
        }
    });

    teachers.slice(0, 2).forEach(teacher => {
        if (teacher.lastLogin) {
            activities.push({
                icon: 'person-check',
                text: `Teacher ${sanitizeHTML(teacher.fullname || 'Unknown')} logged in`,
                timestamp: new Date(teacher.lastLogin),
                type: 'success'
            });
        }
    });

    // Sort by timestamp and limit to 4 for mobile
    activities.sort((a, b) => b.timestamp - a.timestamp);
    const recentActivities = activities.slice(0, 4);

    if (recentActivities.length === 0) {
        recentActivities.push({
            icon: 'info-circle',
            text: 'No recent activity recorded',
            timestamp: new Date(),
            type: 'info'
        });
    }

    // Render
    activityContainer.innerHTML = '';
    
    recentActivities.forEach((activity, index) => {
        const activityItem = document.createElement('div');
        activityItem.className = `mobile-activity-item ${activity.type}`;
        
        const icon = document.createElement('i');
        icon.className = `bi bi-${activity.icon}`;
        
        const content = document.createElement('div');
        content.className = 'mobile-activity-content';
        
        const text = document.createElement('span');
        text.className = 'mobile-activity-text';
        text.textContent = activity.text;
        
        const time = document.createElement('span');
        time.className = 'mobile-activity-time';
        time.textContent = formatTimeAgo(activity.timestamp);
        
        content.appendChild(text);
        content.appendChild(time);
        activityItem.appendChild(icon);
        activityItem.appendChild(content);
        activityContainer.appendChild(activityItem);
    });
}

/**
 * Setup mobile event listeners
 */
function setupMobileEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('mobileLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                showNotification('Logging out...', 'info');
                setTimeout(() => AuthGuard.logout(), 1000);
            }
        });
    }

    // Refresh button
    const refreshBtn = document.getElementById('mobileRefreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function(e) {
            createRipple(e, this);
            refreshMobileDashboard();
        });
    }

    // Chart filters - immediate response (no debouncing)
    const studentDistributionType = document.getElementById('mobileStudentDistributionType');
    if (studentDistributionType) {
        studentDistributionType.addEventListener('change', function() {
            console.log('Mobile student distribution dropdown changed to:', this.value);
            const value = sanitizeChartFilter('studentDistributionType', this.value);
            mobileDashboardState.updateFilter('studentDistributionType', value);
            renderMobileStudentDistributionChart();
            trackUserInteraction('filter_change', 'mobile_student_distribution', value);
        });
    }

    const roomChartType = document.getElementById('mobileRoomChartType');
    if (roomChartType) {
        roomChartType.addEventListener('change', function() {
            console.log('Mobile room chart dropdown changed to:', this.value);
            const value = sanitizeChartFilter('roomChartType', this.value);
            mobileDashboardState.updateFilter('roomChartType', value);
            renderMobileRoomUtilizationChart();
            trackUserInteraction('filter_change', 'mobile_room_utilization', value);
        });
    }

    const scheduleDensityType = document.getElementById('mobileScheduleDensityType');
    if (scheduleDensityType) {
        scheduleDensityType.addEventListener('change', function() {
            console.log('Mobile schedule chart dropdown changed to:', this.value);
            const value = sanitizeChartFilter('scheduleDensityType', this.value);
            mobileDashboardState.updateFilter('scheduleDensityType', value);
            renderMobileScheduleDensityChart();
            trackUserInteraction('filter_change', 'mobile_schedule_density', value);
        });
    }
}

/**
 * Setup mobile side menu
 */
function setupMobileSideMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sideMenu = document.getElementById('mobileSideMenu');
    const closeBtn = document.getElementById('mobileSideMenuClose');
    const overlay = document.getElementById('mobileOverlay');

    if (menuBtn && sideMenu) {
        menuBtn.addEventListener('click', () => {
            sideMenu.classList.add('open');
            if (overlay) overlay.classList.add('open');
        });
    }

    if (closeBtn && sideMenu) {
        closeBtn.addEventListener('click', () => {
            sideMenu.classList.remove('open');
            if (overlay) overlay.classList.remove('open');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sideMenu.classList.remove('open');
            overlay.classList.remove('open');
        });
    }
}

/**
 * Update mobile profile info
 */
function updateMobileProfileInfo() {
    const currentUser = AuthGuard.getCurrentUser();
    if (currentUser) {
        const firstName = sanitizeHTML(currentUser.fullname.split(' ')[0]);
        const profileName = document.getElementById('mobileProfileName');
        if (profileName) {
            profileName.textContent = firstName;
        }

        const profileAvatar = document.getElementById('mobileProfileAvatar');
        if (profileAvatar) {
            profileAvatar.src = currentUser.profilePicture || '/img/default_admin_avatar.png';
        }
    }
}

/**
 * Refresh mobile dashboard
 */
async function refreshMobileDashboard() {
    if (mobileDashboardState.isLoading || !mobileDashboardState.isOnline) {
        showNotification('Cannot refresh while offline or already refreshing', 'warning');
        return;
    }
    
    mobileDashboardState.setLoading(true);
    const refreshBtn = document.getElementById('mobileRefreshBtn');
    if (refreshBtn) {
        refreshBtn.classList.add('loading');
        refreshBtn.disabled = true;
    }
    
    try {
        await loadData(true);
        await renderMobileDashboard();
        showNotification('Dashboard updated successfully', 'success');
        trackUserInteraction('manual_refresh', 'mobile_dashboard', 'success');
    } catch (error) {
        console.error('Error refreshing mobile dashboard:', error);
        showNotification(error.message || 'Failed to refresh dashboard', 'error');
        trackUserInteraction('manual_refresh', 'mobile_dashboard', 'error');
    } finally {
        mobileDashboardState.setLoading(false);
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
            refreshBtn.disabled = false;
        }
    }
}

/**
 * Setup connection monitoring
 */
function setupConnectionMonitoring() {
    function handleConnectionChange() {
        const isOnline = navigator.onLine;
        mobileDashboardState.setOnline(isOnline);
        updateConnectionStatus(isOnline);
        
        if (isOnline) {
            refreshMobileDashboard();
        }
    }

    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
}

/**
 * Update mobile last updated timestamp
 */
function updateMobileLastUpdated() {
    const lastUpdatedElement = document.getElementById('mobileLastUpdated');
    if (lastUpdatedElement && mobileDashboardState.data.lastUpdate) {
        lastUpdatedElement.textContent = `Updated ${formatTimeAgo(mobileDashboardState.data.lastUpdate)}`;
    }
}

/**
 * Show mobile loading overlay
 */
function showMobileLoadingOverlay() {
    const overlay = document.getElementById('mobileLoadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

/**
 * Hide mobile loading overlay
 */
function hideMobileLoadingOverlay() {
    const overlay = document.getElementById('mobileLoadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', () => {
    chartManager.destroyAll();
});
