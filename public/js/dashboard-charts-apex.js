// dashboard-charts-apex.js - Chart management with ApexCharts
// Migrated from Chart.js to ApexCharts for better features and performance

import { generateCTUColors, sanitizeHTML } from './dashboard-utils.js';

/**
 * Chart Manager for ApexCharts
 * Handles chart lifecycle and prevents memory leaks
 */
class ApexChartManager {
    constructor() {
        this.charts = new Map();
        this.observers = new Map();
    }

    /**
     * Create or update an ApexChart
     */
    createOrUpdate(containerId, config) {
        if (typeof ApexCharts === 'undefined') {
            console.warn('ApexCharts not available');
            this.showChartFallback(containerId);
            return null;
        }

        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container ${containerId} not found`);
            return null;
        }

        // If chart exists, destroy and recreate for reliable updates
        if (this.charts.has(containerId)) {
            console.log(`Destroying existing chart: ${containerId}`);
            this.destroy(containerId);
        }

        // Create new chart
        try {
            // Clear container
            container.innerHTML = '';
            
            console.log(`Creating new chart: ${containerId}`, {
                labels: config.xaxis?.categories || config.labels,
                data: config.series
            });
            
            const chart = new ApexCharts(container, config);
            chart.render();
            this.charts.set(containerId, chart);
            
            console.log(`Chart ${containerId} created successfully`);
            return chart;
        } catch (error) {
            console.error(`Failed to create chart ${containerId}:`, error);
            this.showChartFallback(containerId);
            return null;
        }
    }

    /**
     * Destroy a specific chart and clean up
     */
    destroy(containerId) {
        if (this.charts.has(containerId)) {
            const chart = this.charts.get(containerId);
            chart.destroy();
            this.charts.delete(containerId);
        }
    }

    /**
     * Destroy all charts
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
    get(containerId) {
        return this.charts.get(containerId);
    }

    /**
     * Check if chart exists
     */
    has(containerId) {
        return this.charts.has(containerId);
    }

    /**
     * Show fallback UI when ApexCharts is not available
     */
    showChartFallback(containerId) {
        const container = document.getElementById(containerId);
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
     */
    setupLazyLoading(containerId, renderCallback) {
        if (typeof IntersectionObserver === 'undefined') {
            // Fallback: render immediately
            renderCallback();
            return;
        }

        const container = document.getElementById(containerId);
        if (!container) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    renderCallback();
                    observer.unobserve(entry.target);
                    this.observers.delete(containerId);
                }
            });
        }, { threshold: 0.1 });

        observer.observe(container);
        this.observers.set(containerId, observer);
    }
}

// Export singleton instance
export const chartManager = new ApexChartManager();

/**
 * Data aggregation functions - ENHANCED with MongoDB data support
 * These functions now accept either raw data or pre-aggregated MongoDB data
 */
export function aggregateStudentsBySection(students, chartData = null) {
    // If we have pre-aggregated data from MongoDB, use it
    if (chartData && chartData.studentsPerSection && chartData.studentsPerSection.length > 0) {
        const data = chartData.studentsPerSection.slice(0, 8); // Top 8 sections
        return {
            labels: data.map(item => sanitizeHTML(item.section || 'Unassigned')),
            data: data.map(item => item.count || 0)
        };
    }
    
    // Fallback: Calculate from raw student data
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

export function aggregateStudentsByYear(students, sections, chartData = null) {
    console.log('aggregateStudentsByYear called with:', { 
        hasChartData: !!chartData, 
        studentsPerYear: chartData?.studentsPerYear,
        studentsCount: students?.length,
        sectionsCount: sections?.length
    });
    
    // If we have pre-aggregated data from MongoDB, use it
    if (chartData && chartData.studentsPerYear && chartData.studentsPerYear.length > 0) {
        console.log('Using MongoDB aggregated data for year');
        const data = chartData.studentsPerYear.filter(item => item.year !== 'Unassigned' || item.count > 0);
        
        // If no data after filtering, use fallback
        if (data.length === 0) {
            console.log('No year data after filtering, using fallback');
        } else {
            return {
                labels: data.map(item => sanitizeHTML(item.year || 'Unknown')),
                data: data.map(item => item.count || 0)
            };
        }
    }
    
    console.log('Using fallback calculation for year level');
    // Fallback: Calculate from raw student data
    const yearCounts = { 
        '1st Year': 0, 
        '2nd Year': 0, 
        '3rd Year': 0, 
        '4th Year': 0,
        'Unassigned': 0
    };
    
    if (!students || !Array.isArray(students)) {
        console.warn('No students data available');
        return { labels: Object.keys(yearCounts), data: Object.values(yearCounts) };
    }
    
    if (!sections || !Array.isArray(sections)) {
        console.warn('No sections data available');
        return { labels: Object.keys(yearCounts), data: Object.values(yearCounts) };
    }
    
    students.forEach(student => {
        let yearLevel = 'Unassigned';
        
        if (student.section) {
            const section = sections.find(s => s.sectionName === student.section);
            if (section && section.yearLevel) {
                yearLevel = `${section.yearLevel}${getOrdinalSuffix(section.yearLevel)} Year`;
            }
        }
        
        if (yearCounts[yearLevel] !== undefined) {
            yearCounts[yearLevel]++;
        } else {
            yearCounts['Unassigned']++;
        }
    });

    // Remove Unassigned if it's 0
    if (yearCounts['Unassigned'] === 0) {
        delete yearCounts['Unassigned'];
    }

    console.log('Year level aggregation result:', yearCounts);

    return {
        labels: Object.keys(yearCounts),
        data: Object.values(yearCounts)
    };
}

export function aggregateStudentsByProgram(students, sections, chartData = null) {
    console.log('aggregateStudentsByProgram called with:', { 
        hasChartData: !!chartData, 
        studentsPerProgram: chartData?.studentsPerProgram,
        studentsCount: students?.length,
        sectionsCount: sections?.length
    });
    
    // If we have pre-aggregated data from MongoDB, use it
    if (chartData && chartData.studentsPerProgram && chartData.studentsPerProgram.length > 0) {
        console.log('Using MongoDB aggregated data for program');
        const data = chartData.studentsPerProgram.slice(0, 6); // Top 6 programs
        
        if (data.length === 0) {
            console.log('No program data, using fallback');
        } else {
            return {
                labels: data.map(item => sanitizeHTML(item.program || 'Unknown')),
                data: data.map(item => item.count || 0)
            };
        }
    }
    
    console.log('Using fallback calculation for program');
    // Fallback: Calculate from raw student data
    const programCounts = {};
    
    if (!students || !Array.isArray(students)) {
        console.warn('No students data available');
        return { labels: ['No Data'], data: [0] };
    }
    
    if (!sections || !Array.isArray(sections)) {
        console.warn('No sections data available');
        return { labels: ['No Data'], data: [0] };
    }
    
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

    console.log('Program aggregation result:', Object.fromEntries(entries));

    return {
        labels: entries.map(([program]) => program),
        data: entries.map(([, count]) => count)
    };
}

export function aggregateRoomsByStatus(rooms, chartData = null) {
    console.log('aggregateRoomsByStatus called with:', { 
        hasChartData: !!chartData, 
        roomStats: chartData?.roomStats,
        roomsCount: rooms?.length
    });
    
    // If we have pre-aggregated data from MongoDB, use it
    if (chartData && chartData.roomStats && chartData.roomStats.byStatus) {
        console.log('Using MongoDB aggregated data for room status');
        const statusData = chartData.roomStats.byStatus;
        return {
            labels: Object.keys(statusData),
            data: Object.values(statusData)
        };
    }
    
    console.log('Using fallback calculation for room status');
    // Fallback: Calculate from raw room data
    const statusCounts = { 'Available': 0, 'Under Maintenance': 0, 'Occupied': 0 };
    
    if (!rooms || !Array.isArray(rooms)) {
        console.warn('No rooms data available');
        return { labels: Object.keys(statusCounts), data: Object.values(statusCounts) };
    }
    
    rooms.forEach(room => {
        const status = room.status || 'Available';
        if (statusCounts[status] !== undefined) {
            statusCounts[status]++;
        }
    });

    console.log('Room status aggregation result:', statusCounts);

    return {
        labels: Object.keys(statusCounts),
        data: Object.values(statusCounts)
    };
}

export function aggregateRoomsByBuilding(rooms, chartData = null) {
    console.log('aggregateRoomsByBuilding called with:', { 
        hasChartData: !!chartData, 
        roomStats: chartData?.roomStats,
        roomsCount: rooms?.length
    });
    
    // If we have pre-aggregated data from MongoDB, use it
    if (chartData && chartData.roomStats && chartData.roomStats.byBuilding) {
        console.log('Using MongoDB aggregated data for room building');
        const buildingData = chartData.roomStats.byBuilding;
        return {
            labels: Object.keys(buildingData).map(b => sanitizeHTML(b)),
            data: Object.values(buildingData)
        };
    }
    
    console.log('Using fallback calculation for room building');
    // Fallback: Calculate from raw room data
    const buildingCounts = {};
    
    if (!rooms || !Array.isArray(rooms)) {
        console.warn('No rooms data available');
        return { labels: ['No Data'], data: [0] };
    }
    
    rooms.forEach(room => {
        const building = sanitizeHTML(room.building || 'Unknown');
        buildingCounts[building] = (buildingCounts[building] || 0) + 1;
    });

    console.log('Room building aggregation result:', buildingCounts);

    return {
        labels: Object.keys(buildingCounts),
        data: Object.values(buildingCounts)
    };
}

export function aggregateRoomsByType(rooms, chartData = null) {
    console.log('aggregateRoomsByType called with:', { 
        hasChartData: !!chartData, 
        roomStats: chartData?.roomStats,
        roomsCount: rooms?.length
    });
    
    // If we have pre-aggregated data from MongoDB, use it
    if (chartData && chartData.roomStats && chartData.roomStats.byType) {
        console.log('Using MongoDB aggregated data for room type');
        const typeData = chartData.roomStats.byType;
        return {
            labels: Object.keys(typeData).map(t => sanitizeHTML(t)),
            data: Object.values(typeData)
        };
    }
    
    console.log('Using fallback calculation for room type');
    // Fallback: Calculate from raw room data
    const typeCounts = {};
    
    if (!rooms || !Array.isArray(rooms)) {
        console.warn('No rooms data available');
        return { labels: ['No Data'], data: [0] };
    }
    
    rooms.forEach(room => {
        const type = sanitizeHTML(room.roomType || 'Unknown');
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    console.log('Room type aggregation result:', typeCounts);

    return {
        labels: Object.keys(typeCounts),
        data: Object.values(typeCounts)
    };
}

export function aggregateSchedulesByDay(schedules, chartData = null) {
    console.log('aggregateSchedulesByDay called with:', { 
        hasChartData: !!chartData, 
        schedulesPerDay: chartData?.schedulesPerDay,
        schedulesCount: schedules?.length
    });
    
    // If we have pre-aggregated data from MongoDB, use it
    if (chartData && chartData.schedulesPerDay && chartData.schedulesPerDay.length > 0) {
        console.log('Using MongoDB aggregated data for schedules by day');
        const data = chartData.schedulesPerDay;
        return {
            labels: data.map(item => sanitizeHTML(item.day || 'Unknown')),
            data: data.map(item => item.count || 0)
        };
    }
    
    console.log('Using fallback calculation for schedules by day');
    // Fallback: Calculate from raw schedule data
    const dayCounts = {
        'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
        'Thursday': 0, 'Friday': 0, 'Saturday': 0
    };
    
    if (!schedules || !Array.isArray(schedules)) {
        console.warn('No schedules data available');
        return { labels: Object.keys(dayCounts), data: Object.values(dayCounts) };
    }
    
    schedules.forEach(schedule => {
        if (schedule.day && dayCounts.hasOwnProperty(schedule.day)) {
            dayCounts[schedule.day]++;
        }
    });

    console.log('Schedules by day aggregation result:', dayCounts);

    return {
        labels: Object.keys(dayCounts),
        data: Object.values(dayCounts)
    };
}

export function aggregateSchedulesByType(schedules, subjects, chartData = null) {
    console.log('aggregateSchedulesByType called with:', { 
        hasChartData: !!chartData, 
        schedulesPerType: chartData?.schedulesPerType,
        schedulesCount: schedules?.length,
        subjectsCount: subjects?.length
    });
    
    // If we have pre-aggregated data from MongoDB, use it
    if (chartData && chartData.schedulesPerType && chartData.schedulesPerType.length > 0) {
        console.log('Using MongoDB aggregated data for schedules by type');
        const data = chartData.schedulesPerType.filter(item => item.type !== 'Unknown' || item.count > 0);
        
        if (data.length === 0) {
            console.log('No schedule type data after filtering, using fallback');
        } else {
            return {
                labels: data.map(item => sanitizeHTML(item.type || 'Unknown')),
                data: data.map(item => item.count || 0)
            };
        }
    }
    
    console.log('Using fallback calculation for schedules by type');
    // Fallback: Calculate from raw schedule data
    const typeCounts = { 
        'Lecture': 0, 
        'Lab': 0,
        'Unknown': 0 
    };
    
    if (!schedules || !Array.isArray(schedules)) {
        console.warn('No schedules data available');
        return { labels: Object.keys(typeCounts), data: Object.values(typeCounts) };
    }
    
    schedules.forEach(schedule => {
        let scheduleType = 'Unknown';
        
        if (schedule.scheduleType) {
            scheduleType = schedule.scheduleType;
        } else if (schedule.subject && subjects && Array.isArray(subjects)) {
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

    console.log('Schedules by type aggregation result:', typeCounts);

    return {
        labels: Object.keys(typeCounts),
        data: Object.values(typeCounts)
    };
}

/**
 * Get ApexCharts configuration for bar chart - ENHANCED
 */
export function getBarChartConfig(labels, data, title = '') {
    // Create gradient colors for each bar
    const baseColors = ['#3E8EDE', '#FF6835', '#4BB543', '#8B5CF6', '#F2D283', '#EC4899', '#00D4FF', '#FF6B9D'];
    const colors = labels.map((_, i) => baseColors[i % baseColors.length]);
    
    return {
        series: [{
            name: title || 'Count',
            data: data
        }],
        chart: {
            type: 'bar',
            height: '100%',
            fontFamily: 'Inter, sans-serif',
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    selection: false,
                    zoom: false,
                    zoomin: false,
                    zoomout: false,
                    pan: false,
                    reset: false
                },
                export: {
                    csv: {
                        filename: `${title}_data`,
                    },
                    svg: {
                        filename: `${title}_chart`,
                    },
                    png: {
                        filename: `${title}_chart`,
                    }
                }
            },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 1000,
                animateGradually: {
                    enabled: true,
                    delay: 150
                },
                dynamicAnimation: {
                    enabled: true,
                    speed: 400
                }
            },
            dropShadow: {
                enabled: true,
                top: 3,
                left: 0,
                blur: 4,
                opacity: 0.15
            }
        },
        plotOptions: {
            bar: {
                borderRadius: 10,
                borderRadiusApplication: 'end',
                columnWidth: '65%',
                distributed: true,
                dataLabels: {
                    position: 'top'
                }
            }
        },
        colors: colors,
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'light',
                type: 'vertical',
                shadeIntensity: 0.5,
                gradientToColors: colors.map(c => c + 'CC'),
                inverseColors: false,
                opacityFrom: 0.95,
                opacityTo: 0.75,
                stops: [0, 100]
            }
        },
        dataLabels: {
            enabled: true,
            formatter: function(val) {
                return val;
            },
            offsetY: -25,
            style: {
                fontSize: '12px',
                fontWeight: 'bold',
                colors: ['#555']
            },
            background: {
                enabled: true,
                foreColor: '#fff',
                padding: 6,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                opacity: 0.9
            }
        },
        legend: {
            show: false
        },
        xaxis: {
            categories: labels,
            labels: {
                style: {
                    colors: '#6B7280',
                    fontSize: '12px',
                    fontWeight: 500
                },
                rotate: -45,
                rotateAlways: labels.length > 6
            },
            axisBorder: {
                show: true,
                color: '#E5E7EB'
            },
            axisTicks: {
                show: true,
                color: '#E5E7EB'
            }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#6B7280',
                    fontSize: '12px',
                    fontWeight: 500
                },
                formatter: function(val) {
                    return Math.floor(val);
                }
            }
        },
        grid: {
            borderColor: '#F3F4F6',
            strokeDashArray: 3,
            xaxis: {
                lines: {
                    show: false
                }
            },
            yaxis: {
                lines: {
                    show: true
                }
            },
            padding: {
                top: 0,
                right: 10,
                bottom: 0,
                left: 10
            }
        },
        tooltip: {
            theme: 'dark',
            x: {
                show: true
            },
            y: {
                formatter: function(val) {
                    return val.toLocaleString();
                },
                title: {
                    formatter: function(seriesName) {
                        return seriesName + ':';
                    }
                }
            },
            marker: {
                show: true
            },
            style: {
                fontSize: '13px',
                fontFamily: 'Inter, sans-serif'
            }
        },
        states: {
            hover: {
                filter: {
                    type: 'darken',
                    value: 0.15
                }
            },
            active: {
                filter: {
                    type: 'darken',
                    value: 0.25
                }
            }
        }
    };
}

/**
 * Get ApexCharts configuration for radialBar chart - MODERN & IMPRESSIVE
 */
export function getRadialBarChartConfig(labels, data, colors = null) {
    if (!colors) {
        colors = ['#1ab7ea', '#0084ff', '#39539E', '#0077B5'];
    }
    
    // Convert data to percentages if they're raw numbers
    const total = data.reduce((a, b) => a + b, 0);
    const percentages = data.map(val => Math.round((val / total) * 100));
    
    return {
        series: percentages,
        chart: {
            height: 390,
            type: 'radialBar',
            fontFamily: 'Inter, sans-serif',
            toolbar: {
                show: true,
                tools: {
                    download: true
                }
            },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 1500,
                animateGradually: {
                    enabled: true,
                    delay: 200
                },
                dynamicAnimation: {
                    enabled: true,
                    speed: 500
                }
            }
        },
        plotOptions: {
            radialBar: {
                offsetY: 0,
                startAngle: 0,
                endAngle: 270,
                hollow: {
                    margin: 5,
                    size: '30%',
                    background: 'transparent',
                    image: undefined,
                },
                track: {
                    background: '#f2f2f2',
                    strokeWidth: '97%',
                    margin: 5,
                    dropShadow: {
                        enabled: true,
                        top: 2,
                        left: 0,
                        blur: 4,
                        opacity: 0.15
                    }
                },
                dataLabels: {
                    name: {
                        show: false,
                    },
                    value: {
                        show: false,
                    }
                },
                barLabels: {
                    enabled: true,
                    useSeriesColors: true,
                    offsetX: -8,
                    fontSize: '14px',
                    fontWeight: 600,
                    formatter: function(seriesName, opts) {
                        return seriesName + ": " + opts.w.globals.series[opts.seriesIndex] + "%";
                    },
                }
            }
        },
        colors: colors,
        labels: labels,
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'dark',
                type: 'horizontal',
                shadeIntensity: 0.5,
                gradientToColors: colors.map(c => c + 'AA'),
                inverseColors: false,
                opacityFrom: 1,
                opacityTo: 0.8,
                stops: [0, 100]
            }
        },
        stroke: {
            lineCap: 'round'
        },
        legend: {
            show: true,
            floating: true,
            fontSize: '13px',
            fontWeight: 500,
            position: 'left',
            offsetX: 10,
            offsetY: 10,
            labels: {
                useSeriesColors: true,
            },
            markers: {
                size: 0
            },
            formatter: function(seriesName, opts) {
                return seriesName + ": " + opts.w.globals.series[opts.seriesIndex] + "%";
            },
            itemMargin: {
                vertical: 3
            }
        },
        tooltip: {
            enabled: true,
            theme: 'dark',
            y: {
                formatter: function(val, opts) {
                    const actualValue = data[opts.seriesIndex];
                    return `${actualValue} (${val}%)`;
                }
            },
            style: {
                fontSize: '13px',
                fontFamily: 'Inter, sans-serif'
            }
        },
        responsive: [{
            breakpoint: 480,
            options: {
                chart: {
                    height: 300
                },
                legend: {
                    show: false
                }
            }
        }]
    };
}

/**
 * Get ApexCharts configuration for donut chart - ENHANCED & BEAUTIFUL
 */
export function getDonutChartConfig(labels, data, colors = null) {
    if (!colors) {
        colors = ['#3E8EDE', '#FF6835', '#4BB543', '#8B5CF6', '#F2D283', '#EC4899'];
    }
    
    return {
        series: data,
        chart: {
            type: 'donut',
            height: '100%',
            fontFamily: 'Inter, sans-serif',
            toolbar: {
                show: true,
                offsetY: -10,
                tools: {
                    download: true,
                    selection: false,
                    zoom: false,
                    zoomin: false,
                    zoomout: false,
                    pan: false,
                    reset: false
                }
            },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 1000,
                animateGradually: {
                    enabled: true,
                    delay: 150
                },
                dynamicAnimation: {
                    enabled: true,
                    speed: 400
                }
            },
            dropShadow: {
                enabled: true,
                top: 3,
                left: 0,
                blur: 10,
                opacity: 0.15
            }
        },
        labels: labels,
        colors: colors,
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'light',
                type: 'vertical',
                shadeIntensity: 0.35,
                gradientToColors: colors.map(c => c + 'CC'),
                inverseColors: false,
                opacityFrom: 0.95,
                opacityTo: 0.85,
                stops: [0, 100]
            }
        },
        plotOptions: {
            pie: {
                startAngle: 0,
                endAngle: 360,
                expandOnClick: true,
                offsetX: 0,
                offsetY: 0,
                customScale: 1,
                dataLabels: {
                    offset: 0,
                    minAngleToShowLabel: 10
                },
                donut: {
                    size: '65%',
                    background: 'transparent',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '18px',
                            fontWeight: 600,
                            color: '#002D62',
                            offsetY: -10,
                            formatter: function(val) {
                                return val;
                            }
                        },
                        value: {
                            show: true,
                            fontSize: '32px',
                            fontWeight: 800,
                            color: '#002D62',
                            offsetY: 10,
                            formatter: function(val) {
                                return val;
                            }
                        },
                        total: {
                            show: true,
                            showAlways: true,
                            label: 'Total Rooms',
                            fontSize: '15px',
                            fontWeight: 600,
                            color: '#6B7280',
                            formatter: function(w) {
                                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                return total;
                            }
                        }
                    }
                }
            }
        },
        dataLabels: {
            enabled: true,
            formatter: function(val, opts) {
                return opts.w.config.series[opts.seriesIndex];
            },
            style: {
                fontSize: '14px',
                fontWeight: 'bold',
                colors: ['#fff']
            },
            background: {
                enabled: true,
                foreColor: '#fff',
                borderRadius: 4,
                padding: 4,
                opacity: 0.9,
                borderWidth: 0
            },
            dropShadow: {
                enabled: true,
                top: 1,
                left: 1,
                blur: 2,
                opacity: 0.5
            }
        },
        stroke: {
            show: true,
            width: 4,
            colors: ['#fff']
        },
        legend: {
            show: true,
            position: 'bottom',
            horizontalAlign: 'center',
            fontSize: '14px',
            fontWeight: 500,
            offsetY: 5,
            labels: {
                colors: '#374151',
                useSeriesColors: false
            },
            markers: {
                width: 16,
                height: 16,
                strokeWidth: 0,
                strokeColor: '#fff',
                radius: 12,
                offsetX: -5,
                offsetY: 0
            },
            itemMargin: {
                horizontal: 15,
                vertical: 8
            },
            onItemClick: {
                toggleDataSeries: true
            },
            onItemHover: {
                highlightDataSeries: true
            },
            formatter: function(seriesName, opts) {
                const value = opts.w.globals.series[opts.seriesIndex];
                const total = opts.w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(0);
                return `${seriesName}: ${value} (${percentage}%)`;
            }
        },
        tooltip: {
            enabled: true,
            theme: 'dark',
            fillSeriesColor: false,
            style: {
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif'
            },
            y: {
                formatter: function(val, opts) {
                    const total = opts.globals.seriesTotals.reduce((a, b) => a + b, 0);
                    const percentage = ((val / total) * 100).toFixed(1);
                    return `${val} rooms (${percentage}%)`;
                },
                title: {
                    formatter: function(seriesName) {
                        return seriesName;
                    }
                }
            },
            marker: {
                show: true
            }
        },
        states: {
            hover: {
                filter: {
                    type: 'lighten',
                    value: 0.08
                }
            },
            active: {
                allowMultipleDataPointsSelection: false,
                filter: {
                    type: 'darken',
                    value: 0.15
                }
            }
        },
        responsive: [{
            breakpoint: 768,
            options: {
                chart: {
                    height: 320
                },
                legend: {
                    position: 'bottom',
                    fontSize: '12px',
                    itemMargin: {
                        horizontal: 10,
                        vertical: 6
                    }
                },
                plotOptions: {
                    pie: {
                        donut: {
                            size: '60%',
                            labels: {
                                show: true,
                                name: {
                                    fontSize: '16px'
                                },
                                value: {
                                    fontSize: '24px'
                                },
                                total: {
                                    fontSize: '13px'
                                }
                            }
                        }
                    }
                }
            }
        }, {
            breakpoint: 480,
            options: {
                chart: {
                    height: 280
                },
                legend: {
                    position: 'bottom',
                    fontSize: '11px',
                    itemMargin: {
                        horizontal: 8,
                        vertical: 5
                    }
                },
                plotOptions: {
                    pie: {
                        donut: {
                            size: '55%',
                            labels: {
                                show: true,
                                name: {
                                    fontSize: '14px'
                                },
                                value: {
                                    fontSize: '20px'
                                },
                                total: {
                                    fontSize: '12px'
                                }
                            }
                        }
                    }
                },
                dataLabels: {
                    enabled: false
                }
            }
        }]
    };
}

/**
 * Helper function to get ordinal suffix
 */
function getOrdinalSuffix(num) {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    chartManager.destroyAll();
});

export default chartManager;
