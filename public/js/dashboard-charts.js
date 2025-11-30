// dashboard-charts.js - Chart management with proper lifecycle
// Improvement #2: Performance - Proper chart updates instead of recreation
// Improvement #6: Memory leak fixes - Proper cleanup

import { generateCTUColors, sanitizeHTML } from './dashboard-utils.js';
import { detectFeatures } from './dashboard-utils.js';

const features = detectFeatures();

/**
 * Chart Manager to handle chart lifecycle and prevent memory leaks
 * Improvement #6: Fix memory leaks from chart instances
 */
class ChartManager {
    constructor() {
        this.charts = new Map();
        this.observers = new Map();
    }

    /**
     * Create or update a chart
     * Improvement #2: Update data instead of destroying/recreating
     */
    createOrUpdate(canvasId, config) {
        if (!features.chartJS) {
            console.warn('Chart.js not available');
            this.showChartFallback(canvasId);
            return null;
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas ${canvasId} not found`);
            return null;
        }

        const ctx = canvas.getContext('2d');
        
        // If chart exists, update its data instead of recreating
        if (this.charts.has(canvasId)) {
            const chart = this.charts.get(canvasId);
            
            // Update data
            chart.data.labels = config.data.labels;
            chart.data.datasets = config.data.datasets;
            
            // Smooth update animation
            chart.update('active');
            
            return chart;
        }

        // Create new chart
        try {
            const chart = new Chart(ctx, config);
            this.charts.set(canvasId, chart);
            return chart;
        } catch (error) {
            console.error(`Failed to create chart ${canvasId}:`, error);
            this.showChartFallback(canvasId);
            return null;
        }
    }

    /**
     * Destroy a specific chart and clean up
     * Improvement #6: Proper cleanup to prevent memory leaks
     */
    destroy(canvasId) {
        if (this.charts.has(canvasId)) {
            const chart = this.charts.get(canvasId);
            chart.destroy();
            this.charts.delete(canvasId);
        }
    }

    /**
     * Destroy all charts
     * Improvement #6: Cleanup on page unload
     */
    destroyAll() {
        this.charts.forEach((chart, id) => {
            chart.destroy();
        });
        this.charts.clear();
        
        // Disconnect all observers
        this.observers.forEach((observer, id) => {
            observer.disconnect();
        });
        this.observers.clear();
    }

    /**
     * Get chart instance
     */
    get(canvasId) {
        return this.charts.get(canvasId);
    }

    /**
     * Check if chart exists
     */
    has(canvasId) {
        return this.charts.has(canvasId);
    }

    /**
     * Show fallback UI when Chart.js is not available
     * Improvement #10: Progressive enhancement
     */
    showChartFallback(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const container = canvas.closest('.chart-wrapper');
        if (!container) return;

        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; text-align: center; padding: 20px;">
                <div>
                    <i class="bi bi-bar-chart" style="font-size: 3rem; margin-bottom: 10px;"></i>
                    <p>Chart visualization unavailable</p>
                    <small>Please enable JavaScript or use a modern browser</small>
                </div>
            </div>
        `;
    }

    /**
     * Setup lazy loading for charts
     * Improvement #2: Performance - Lazy load charts
     */
    setupLazyLoading(canvasId, renderCallback) {
        if (!features.intersectionObserver) {
            // Fallback: render immediately
            renderCallback();
            return;
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    renderCallback();
                    observer.unobserve(entry.target);
                    this.observers.delete(canvasId);
                }
            });
        }, { threshold: 0.1 });

        observer.observe(canvas);
        this.observers.set(canvasId, observer);
    }
}

// Export singleton instance
export const chartManager = new ChartManager();

/**
 * Data aggregation functions
 */
export function aggregateStudentsBySection(students) {
    const sectionCounts = {};
    students.forEach(student => {
        const section = sanitizeHTML(student.section || 'Unassigned');
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

export function aggregateStudentsByYear(students, sections) {
    const yearCounts = { 
        '1st Year': 0, 
        '2nd Year': 0, 
        '3rd Year': 0, 
        '4th Year': 0,
        'Unassigned': 0
    };
    
    students.forEach(student => {
        let yearLevel = 'Unassigned';
        
        if (student.section) {
            const section = sections.find(s => s.sectionName === student.section);
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

export function aggregateStudentsByProgram(students, sections) {
    const programCounts = {};
    
    students.forEach(student => {
        let program = 'Unassigned';
        
        if (student.section) {
            const section = sections.find(s => s.sectionName === student.section);
            if (section && section.programID) {
                program = sanitizeHTML(section.programID);
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

export function aggregateRoomsByStatus(rooms) {
    const statusCounts = { 'Available': 0, 'Under Maintenance': 0, 'Occupied': 0 };
    rooms.forEach(room => {
        const status = room.status || 'Available';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return {
        labels: Object.keys(statusCounts),
        data: Object.values(statusCounts)
    };
}

export function aggregateRoomsByBuilding(rooms) {
    const buildingCounts = {};
    rooms.forEach(room => {
        const building = sanitizeHTML(room.building || 'Unknown');
        buildingCounts[building] = (buildingCounts[building] || 0) + 1;
    });

    return {
        labels: Object.keys(buildingCounts),
        data: Object.values(buildingCounts)
    };
}

export function aggregateRoomsByType(rooms) {
    const typeCounts = {};
    rooms.forEach(room => {
        const type = sanitizeHTML(room.roomType || 'Unknown');
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    return {
        labels: Object.keys(typeCounts),
        data: Object.values(typeCounts)
    };
}

export function aggregateSchedulesByDay(schedules) {
    const dayCounts = {
        'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
        'Thursday': 0, 'Friday': 0, 'Saturday': 0
    };
    
    schedules.forEach(schedule => {
        if (schedule.day && dayCounts.hasOwnProperty(schedule.day)) {
            dayCounts[schedule.day]++;
        }
    });

    return {
        labels: Object.keys(dayCounts),
        data: Object.values(dayCounts)
    };
}

export function aggregateSchedulesByType(schedules, subjects) {
    const typeCounts = { 
        'Lecture': 0, 
        'Lab': 0,
        'Unknown': 0 
    };
    
    schedules.forEach(schedule => {
        let scheduleType = 'Unknown';
        
        if (schedule.scheduleType) {
            scheduleType = schedule.scheduleType;
        } else if (schedule.subject) {
            const subject = subjects.find(s => 
                s._id === schedule.subject._id || s._id === schedule.subject
            );
            if (subject && subject.lecHours && subject.labHours) {
                scheduleType = parseInt(subject.labHours) > 0 ? 'Lab' : 'Lecture';
            }
        }
        
        scheduleType = scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1).toLowerCase();
        
        if (scheduleType === 'Lecture' || scheduleType === 'Lab') {
            typeCounts[scheduleType]++;
        } else {
            typeCounts['Unknown']++;
        }
    });

    if (typeCounts['Unknown'] === 0) {
        delete typeCounts['Unknown'];
    }

    return {
        labels: Object.keys(typeCounts),
        data: Object.values(typeCounts)
    };
}

/**
 * Common chart options
 */
export function getCommonChartOptions(type = 'bar') {
    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 800,
            easing: 'easeInOutQuart'
        },
        plugins: {
            legend: {
                display: type === 'doughnut',
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
                displayColors: type === 'doughnut'
            }
        }
    };

    if (type === 'bar') {
        baseOptions.scales = {
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
                    }
                }
            }
        };
    } else if (type === 'doughnut') {
        baseOptions.cutout = '65%';
    }

    return baseOptions;
}

// Cleanup on page unload
// Improvement #6: Prevent memory leaks
window.addEventListener('beforeunload', () => {
    chartManager.destroyAll();
});
