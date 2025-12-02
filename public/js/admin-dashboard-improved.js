// admin-dashboard-improved.js - Main dashboard controller
// ALL 10 IMPROVEMENTS IMPLEMENTED

import AuthGuard from './auth-guard.js';
import { cache } from './dashboard-cache.js';
import { loadDashboardData, rateLimiter } from './dashboard-api.js';
import pdfExporter from './dashboard-pdf-export.js';
import { chartManager, aggregateStudentsBySection, aggregateStudentsByYear, aggregateStudentsByProgram,
         aggregateRoomsByStatus, aggregateRoomsByBuilding, aggregateRoomsByType,
         aggregateSchedulesByDay, aggregateSchedulesByType, getBarChartConfig, getDonutChartConfig, getRadialBarChartConfig } from './dashboard-charts-apex.js';
import { showKPISkeletons, hideKPISkeletons, animateCounter, updateTrend, showLoadingOverlay,
         hideLoadingOverlay, showNotification, showErrorWithRetry, updateConnectionStatus,
         updateLastUpdated, animateChartTransition, setupProfileDropdown, setupKeyboardShortcuts,
         initializeTooltips, addPageAnimations } from './dashboard-ui.js';
import { sanitizeChartFilter, formatTimeAgo, debounce, createRipple, trackUserInteraction,
         sanitizeHTML, generateCTUColors } from './dashboard-utils.js';

/**
 * Dashboard State Management
 * Improvement #8: Better code organization
 */
class DashboardState {
    constructor() {
        this.data = {
            students: [],
            teachers: [],
            rooms: [],
            schedules: [],
            subjects: [],
            sections: [],
            lastUpdate: null
        };
        this.filters = {
            studentDistributionType: 'section',
            roomChartType: 'status',
            scheduleDensityType: 'day'
        };
        this.isLoading = false;
        this.isOnline = navigator.onLine;
        this.autoRefreshInterval = null;
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

    // Improvement #6: Cleanup method to prevent memory leaks
    cleanup() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }
}

// Initialize dashboard state
const dashboardState = new DashboardState();

/**
 * Main Dashboard Initialization
 */
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Admin Dashboard (Improved) loaded');
    
    // Check authentication first
    if (!AuthGuard.checkAuthentication('admin')) {
        return;
    }

    try {
        await initializeDashboard();
    } catch (error) {
        console.error('Fatal error initializing dashboard:', error);
        showErrorWithRetry(
            'Failed to initialize dashboard. Please check your connection.',
            () => window.location.reload()
        );
    }
});

/**
 * Initialize Dashboard
 * Improvement #1: Better error handling with try-catch
 */
async function initializeDashboard() {
    showLoadingOverlay();
    showKPISkeletons();
    
    try {
        // Setup UI components
        updateProfileInfo();
        setupProfileDropdown();
        setupEventListeners();
        setupConnectionMonitoring();
        setupKeyboardShortcuts({ refresh: refreshDashboard });
        initializeTooltips();
        
        // Load data
        await loadData();
        
        // Render dashboard
        await renderDashboard();
        
        // Setup auto-refresh
        setupAutoRefresh();
        
        // Add animations
        addPageAnimations();
        
        showNotification('Dashboard loaded successfully', 'success');
        trackUserInteraction('dashboard_load', 'dashboard', 'success');
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        
        // Try to load from cache as fallback
        const cachedData = cache.get('dashboard_data');
        if (cachedData) {
            dashboardState.updateData(cachedData);
            await renderDashboard();
            showNotification('Loaded from cache (offline mode)', 'warning', 5000);
        } else {
            showErrorWithRetry(
                'Unable to load dashboard data. Please check your internet connection.',
                () => initializeDashboard()
            );
        }
        
        trackUserInteraction('dashboard_load', 'dashboard', 'error');
    } finally {
        hideLoadingOverlay();
        hideKPISkeletons();
    }
}

/**
 * Load dashboard data
 * Improvement #7: Better data loading with caching
 */
async function loadData(forceRefresh = false) {
    if (!dashboardState.isOnline && !forceRefresh) {
        throw new Error('No internet connection');
    }

    // Check rate limit
    // Improvement #5: Rate limiting
    if (!rateLimiter.canMakeRequest()) {
        const waitTime = Math.ceil(rateLimiter.getWaitTime() / 1000);
        throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds.`);
    }

    const data = await loadDashboardData(forceRefresh);
    dashboardState.updateData(data);
    
    return data;
}

/**
 * Render dashboard components
 */
async function renderDashboard() {
    updateKPICards();
    renderAllCharts();
    updateRecentActivity();
    updateLastUpdated(dashboardState.data.lastUpdate);
}

/**
 * Update KPI cards with animation
 */
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

    // Update trends (using 0 as previous for now - could be enhanced with historical data)
    updateTrend('studentsTrend', students.length, 0);
    updateTrend('teachersTrend', teachers.length, 0);
    updateTrend('roomsTrend', availableRooms, 0);
    updateTrend('schedulesTrend', schedules.length, 0);
}

/**
 * Render all charts with lazy loading
 * Improvement #2: Lazy loading and proper chart updates
 */
function renderAllCharts() {
    // Setup lazy loading for each chart
    chartManager.setupLazyLoading('studentDistributionChart', () => {
        renderStudentDistributionChart();
    });
    
    chartManager.setupLazyLoading('roomUtilizationChart', () => {
        renderRoomUtilizationChart();
    });
    
    chartManager.setupLazyLoading('scheduleDensityChart', () => {
        renderScheduleDensityChart();
    });
}

/**
 * Render student distribution chart with ApexCharts
 * Improvement #2: Update instead of recreate
 * ENHANCED: Now uses MongoDB aggregated data for accuracy
 */
function renderStudentDistributionChart() {
    const type = dashboardState.filters.studentDistributionType;
    const { students, sections, chartData } = dashboardState.data;
    
    console.log('renderStudentDistributionChart called with type:', type);
    console.log('Data available:', {
        students: students?.length,
        sections: sections?.length,
        hasChartData: !!chartData,
        chartDataKeys: chartData ? Object.keys(chartData) : []
    });
    
    let aggregatedData;
    switch (type) {
        case 'section':
            console.log('Rendering by section');
            aggregatedData = aggregateStudentsBySection(students, chartData);
            break;
        case 'year':
            console.log('Rendering by year');
            aggregatedData = aggregateStudentsByYear(students, sections, chartData);
            break;
        case 'program':
            console.log('Rendering by program');
            aggregatedData = aggregateStudentsByProgram(students, sections, chartData);
            break;
        default:
            console.log('Rendering by section (default)');
            aggregatedData = aggregateStudentsBySection(students, chartData);
    }

    console.log('Aggregated data:', aggregatedData);

    const config = getBarChartConfig(aggregatedData.labels, aggregatedData.data, 'Students');
    chartManager.createOrUpdate('studentDistributionChart', config);
    
    console.log('Chart updated successfully');
}

/**
 * Render room utilization chart with ApexCharts - DONUT CHART
 * ENHANCED: Now uses MongoDB aggregated data for accuracy
 */
function renderRoomUtilizationChart() {
    const type = dashboardState.filters.roomChartType;
    const { rooms, chartData } = dashboardState.data;
    
    console.log('renderRoomUtilizationChart called with type:', type);
    console.log('Data available:', {
        rooms: rooms?.length,
        hasChartData: !!chartData,
        chartDataKeys: chartData ? Object.keys(chartData) : []
    });
    
    let aggregatedData;
    let colors;
    
    switch (type) {
        case 'status':
            console.log('Rendering by status');
            aggregatedData = aggregateRoomsByStatus(rooms, chartData);
            colors = ['#4BB543', '#FF6835', '#D8000C'];
            break;
        case 'building':
            console.log('Rendering by building');
            aggregatedData = aggregateRoomsByBuilding(rooms, chartData);
            colors = ['#3E8EDE', '#8B5CF6', '#EC4899', '#F2D283', '#00D4FF', '#FF6B9D'];
            break;
        case 'type':
            console.log('Rendering by type');
            aggregatedData = aggregateRoomsByType(rooms, chartData);
            colors = ['#3E8EDE', '#8B5CF6', '#EC4899'];
            break;
        default:
            console.log('Rendering by status (default)');
            aggregatedData = aggregateRoomsByStatus(rooms, chartData);
            colors = ['#4BB543', '#FF6835', '#D8000C'];
    }

    console.log('Aggregated room data:', aggregatedData);

    // Use donut chart for clean, professional look
    const config = getDonutChartConfig(aggregatedData.labels, aggregatedData.data, colors);
    chartManager.createOrUpdate('roomUtilizationChart', config);
    
    console.log('Room chart updated successfully');
}

/**
 * Render schedule density chart with ApexCharts
 * ENHANCED: Now uses MongoDB aggregated data for accuracy
 */
function renderScheduleDensityChart() {
    const type = dashboardState.filters.scheduleDensityType;
    const { schedules, subjects, chartData } = dashboardState.data;
    
    console.log('renderScheduleDensityChart called with type:', type);
    console.log('Data available:', {
        schedules: schedules?.length,
        subjects: subjects?.length,
        hasChartData: !!chartData,
        chartDataKeys: chartData ? Object.keys(chartData) : []
    });
    
    let aggregatedData;
    
    switch (type) {
        case 'day':
            console.log('Rendering by day');
            aggregatedData = aggregateSchedulesByDay(schedules, chartData);
            break;
        case 'type':
            console.log('Rendering by type');
            aggregatedData = aggregateSchedulesByType(schedules, subjects, chartData);
            break;
        default:
            console.log('Rendering by day (default)');
            aggregatedData = aggregateSchedulesByDay(schedules, chartData);
    }

    console.log('Aggregated schedule data:', aggregatedData);

    const config = getBarChartConfig(aggregatedData.labels, aggregatedData.data, 'Schedules');
    chartManager.createOrUpdate('scheduleDensityChart', config);
    
    console.log('Schedule chart updated successfully');
}

/**
 * Update recent activity
 * Improvement #5: XSS prevention with sanitization
 */
function updateRecentActivity() {
    const activityContainer = document.getElementById('recentActivity');
    if (!activityContainer) return;
    
    const { students, teachers, rooms, schedules } = dashboardState.data;
    const activities = [];

    // Collect activities (limited to prevent performance issues)
    students.slice(0, 5).forEach(student => {
        if (student.lastLogin) {
            activities.push({
                icon: 'person-check',
                text: `Student ${sanitizeHTML(student.fullname || 'Unknown')} logged in`,
                timestamp: new Date(student.lastLogin),
                type: 'success'
            });
        }
    });

    teachers.slice(0, 3).forEach(teacher => {
        if (teacher.lastLogin) {
            activities.push({
                icon: 'person-check',
                text: `Teacher ${sanitizeHTML(teacher.fullname || 'Unknown')} logged in`,
                timestamp: new Date(teacher.lastLogin),
                type: 'success'
            });
        }
    });

    rooms.slice(0, 3).forEach(room => {
        if (room.status === 'Under Maintenance') {
            activities.push({
                icon: 'tools',
                text: `Room ${sanitizeHTML(room.roomName || 'Unknown')} under maintenance`,
                timestamp: room.updatedAt ? new Date(room.updatedAt) : new Date(),
                type: 'warning'
            });
        }
    });

    schedules.slice(0, 3).forEach(schedule => {
        if (schedule.createdAt) {
            const subjectName = schedule.subject?.descriptiveTitle || schedule.subject?.courseCode || 'Unknown';
            activities.push({
                icon: 'calendar-plus',
                text: `Schedule created for ${sanitizeHTML(subjectName)}`,
                timestamp: new Date(schedule.createdAt),
                type: 'info'
            });
        }
    });

    // Sort by timestamp
    activities.sort((a, b) => b.timestamp - a.timestamp);

    // Limit to 6 most recent
    const recentActivities = activities.slice(0, 6);

    if (recentActivities.length === 0) {
        recentActivities.push({
            icon: 'info-circle',
            text: 'No recent activity recorded',
            timestamp: new Date(),
            type: 'info'
        });
    }

    // Render with fade animation
    activityContainer.style.opacity = '0';
    
    setTimeout(() => {
        // Use textContent for safety, not innerHTML
        activityContainer.innerHTML = '';
        
        recentActivities.forEach((activity, index) => {
            const activityItem = document.createElement('div');
            activityItem.className = `activity-item ${activity.type}`;
            activityItem.style.animationDelay = `${index * 0.1}s`;
            activityItem.setAttribute('tabindex', '0');
            
            const icon = document.createElement('i');
            icon.className = `bi bi-${activity.icon}`;
            icon.setAttribute('aria-hidden', 'true');
            
            const content = document.createElement('div');
            content.className = 'activity-content';
            
            const text = document.createElement('span');
            text.className = 'activity-text';
            text.textContent = activity.text; // Safe - already sanitized
            
            const time = document.createElement('span');
            time.className = 'activity-time';
            time.textContent = formatTimeAgo(activity.timestamp);
            
            content.appendChild(text);
            content.appendChild(time);
            activityItem.appendChild(icon);
            activityItem.appendChild(content);
            activityContainer.appendChild(activityItem);
        });
        
        activityContainer.style.opacity = '1';
    }, 300);
}

/**
 * Setup event listeners
 * Improvement #2: Debounced filter changes
 */
function setupEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
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
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function(e) {
            createRipple(e, this);
            refreshDashboard();
        });
    }

    // Export Data button - PDF Export
    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', async function(e) {
            createRipple(e, this);
            await exportDashboardData();
        });
    }

    // Chart filters - removed debouncing for immediate response
    const studentDistributionType = document.getElementById('studentDistributionType');
    if (studentDistributionType) {
        studentDistributionType.addEventListener('change', function() {
            console.log('Student distribution dropdown changed to:', this.value);
            const value = sanitizeChartFilter('studentDistributionType', this.value);
            dashboardState.updateFilter('studentDistributionType', value);
            console.log('Filter updated in state:', dashboardState.filters.studentDistributionType);
            
            // Animate transition
            animateChartTransition('studentDistributionChart');
            
            // Render chart after animation
            setTimeout(() => {
                console.log('Rendering chart with new filter');
                renderStudentDistributionChart();
            }, 300);
            
            trackUserInteraction('filter_change', 'student_distribution', value);
        });
    }

    const roomChartType = document.getElementById('roomChartType');
    if (roomChartType) {
        roomChartType.addEventListener('change', function() {
            console.log('Room chart dropdown changed to:', this.value);
            const value = sanitizeChartFilter('roomChartType', this.value);
            dashboardState.updateFilter('roomChartType', value);
            console.log('Filter updated in state:', dashboardState.filters.roomChartType);
            
            // Animate transition
            animateChartTransition('roomUtilizationChart');
            
            // Render chart after animation
            setTimeout(() => {
                console.log('Rendering room chart with new filter');
                renderRoomUtilizationChart();
            }, 300);
            
            trackUserInteraction('filter_change', 'room_utilization', value);
        });
    }

    const scheduleDensityType = document.getElementById('scheduleDensityType');
    if (scheduleDensityType) {
        scheduleDensityType.addEventListener('change', function() {
            console.log('Schedule chart dropdown changed to:', this.value);
            const value = sanitizeChartFilter('scheduleDensityType', this.value);
            dashboardState.updateFilter('scheduleDensityType', value);
            console.log('Filter updated in state:', dashboardState.filters.scheduleDensityType);
            
            // Animate transition
            animateChartTransition('scheduleDensityChart');
            
            // Render chart after animation
            setTimeout(() => {
                console.log('Rendering schedule chart with new filter');
                renderScheduleDensityChart();
            }, 300);
            
            trackUserInteraction('filter_change', 'schedule_density', value);
        });
    }

    // Export button is now in HTML, no need to create it dynamically
}

/**
 * Old export functions removed - now using PDF export dialog
 */

/**
 * Export Dashboard Data as PDF - New function for export button
 */
async function exportDashboardData() {
    try {
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

/**
 * Update profile info
 */
function updateProfileInfo() {
    const currentUser = AuthGuard.getCurrentUser();
    if (currentUser) {
        const firstName = sanitizeHTML(currentUser.fullname.split(' ')[0]);
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
                profileAvatar.src = currentUser.profilePicture || '/img/default_admin_avatar.png';
                profileAvatar.style.opacity = '1';
            }, 200);
        }
    }
}

/**
 * Refresh dashboard
 */
async function refreshDashboard() {
    if (dashboardState.isLoading || !dashboardState.isOnline) {
        showNotification('Cannot refresh while offline or already refreshing', 'warning');
        return;
    }
    
    dashboardState.setLoading(true);
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.classList.add('loading');
        refreshBtn.disabled = true;
    }
    
    try {
        await loadData(true);
        await renderDashboard();
        showNotification('Dashboard updated successfully', 'success');
        trackUserInteraction('manual_refresh', 'dashboard', 'success');
    } catch (error) {
        console.error('Error refreshing dashboard:', error);
        showNotification(error.message || 'Failed to refresh dashboard', 'error');
        trackUserInteraction('manual_refresh', 'dashboard', 'error');
    } finally {
        dashboardState.setLoading(false);
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
        dashboardState.setOnline(isOnline);
        updateConnectionStatus(isOnline);
        
        if (isOnline) {
            refreshDashboard();
        }
    }

    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
}

/**
 * Setup auto-refresh
 * Improvement #6: Proper cleanup of intervals
 */
function setupAutoRefresh() {
    // Clear existing interval if any
    if (dashboardState.autoRefreshInterval) {
        clearInterval(dashboardState.autoRefreshInterval);
    }
    
    // Auto-refresh every 5 minutes
    dashboardState.autoRefreshInterval = setInterval(() => {
        if (!document.hidden && dashboardState.isOnline && !dashboardState.isLoading) {
            console.log('Auto-refreshing dashboard...');
            refreshDashboard();
        }
    }, 5 * 60 * 1000);
}

/**
 * Cleanup on page unload
 * Improvement #6: Prevent memory leaks
 */
window.addEventListener('beforeunload', () => {
    dashboardState.cleanup();
    chartManager.destroyAll();
});

// Handle visibility change to pause/resume auto-refresh
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('Dashboard hidden, pausing auto-refresh');
    } else {
        console.log('Dashboard visible, resuming auto-refresh');
    }
});
