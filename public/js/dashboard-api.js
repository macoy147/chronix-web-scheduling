// dashboard-api.js - API calls with retry and error handling
// Improvement #1: Better error handling
// Improvement #7: Consistent data loading

import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';
import { cache } from './dashboard-cache.js';

/**
 * API call with retry mechanism and timeout
 * Improvement #1: Error handling with retry
 */
export async function fetchWithRetry(url, options = {}, retries = 3, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                return await response.json();
            } else if (response.status === 404) {
                // Don't retry on 404
                throw new Error(`Resource not found: ${url}`);
            } else if (response.status >= 500) {
                // Retry on server errors
                throw new Error(`Server error: ${response.status}`);
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            
            if (i === retries - 1) {
                throw error;
            }
            
            console.warn(`Attempt ${i + 1} failed, retrying...`, error.message);
            
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, i), 5000)));
        }
    }
    
    throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

/**
 * Load all dashboard data with caching
 * Improvement #7: Better data loading strategy
 * ENHANCED: Now uses MongoDB aggregation endpoints for accurate chart data
 */
export async function loadDashboardData(forceRefresh = false) {
    // Check cache first unless force refresh
    if (!forceRefresh) {
        const cachedData = cache.get('dashboard_data');
        if (cachedData) {
            console.log('Loading data from cache');
            return {
                ...cachedData,
                fromCache: true
            };
        }
    }
    
    try {
        console.log('Loading fresh data from server...');
        
        // Load all data concurrently for better performance
        const [students, teachers, rooms, schedules, subjects, sections, 
               studentsPerSection, studentsPerYear, studentsPerProgram,
               schedulesPerDay, schedulesPerType, roomStats] = await Promise.all([
            fetchWithRetry(`${API_BASE_URL}/users/students`).catch(() => []),
            fetchWithRetry(`${API_BASE_URL}/teachers`).catch(() => []),
            fetchWithRetry(`${API_BASE_URL}/rooms`).catch(() => []),
            fetchWithRetry(`${API_BASE_URL}/schedules`).catch(() => []),
            fetchWithRetry(`${API_BASE_URL}/subjects`).catch(() => []),
            fetchWithRetry(`${API_BASE_URL}/sections`).catch(() => []),
            // NEW: MongoDB aggregation endpoints for accurate chart data
            fetchWithRetry(`${API_BASE_URL}/students-per-section`).catch(() => []),
            fetchWithRetry(`${API_BASE_URL}/students-per-year`).catch(() => []),
            fetchWithRetry(`${API_BASE_URL}/students-per-program`).catch(() => []),
            fetchWithRetry(`${API_BASE_URL}/schedules-per-day`).catch(() => []),
            fetchWithRetry(`${API_BASE_URL}/schedules-per-type`).catch(() => []),
            fetchWithRetry(`${API_BASE_URL}/room-stats`).catch(() => ({}))
        ]);

        const data = {
            students: Array.isArray(students) ? students : [],
            teachers: Array.isArray(teachers) ? teachers : [],
            rooms: Array.isArray(rooms) ? rooms : [],
            schedules: Array.isArray(schedules) ? schedules : [],
            subjects: Array.isArray(subjects) ? subjects : [],
            sections: Array.isArray(sections) ? sections : [],
            // NEW: Pre-aggregated chart data from MongoDB
            chartData: {
                studentsPerSection: Array.isArray(studentsPerSection) ? studentsPerSection : [],
                studentsPerYear: Array.isArray(studentsPerYear) ? studentsPerYear : [],
                studentsPerProgram: Array.isArray(studentsPerProgram) ? studentsPerProgram : [],
                schedulesPerDay: Array.isArray(schedulesPerDay) ? schedulesPerDay : [],
                schedulesPerType: Array.isArray(schedulesPerType) ? schedulesPerType : [],
                roomStats: roomStats || {}
            },
            lastUpdate: new Date(),
            fromCache: false
        };

        // Cache the data
        cache.set('dashboard_data', data);

        console.log('Data loaded successfully:', {
            students: data.students.length,
            teachers: data.teachers.length,
            rooms: data.rooms.length,
            schedules: data.schedules.length,
            chartDataLoaded: true
        });

        return data;
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        
        // Try to return cached data as fallback
        const cachedData = cache.get('dashboard_data');
        if (cachedData) {
            console.warn('Using stale cached data due to error');
            return {
                ...cachedData,
                fromCache: true,
                stale: true
            };
        }
        
        throw error;
    }
}

/**
 * Export data to CSV
 * Improvement #9: Missing critical features - Data export
 */
export function exportToCSV(data, filename) {
    try {
        if (!data || data.length === 0) {
            throw new Error('No data to export');
        }
        
        // Get headers from first object
        const headers = Object.keys(data[0]);
        
        // Create CSV content
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header];
                    // Escape quotes and wrap in quotes if contains comma
                    const stringValue = String(value ?? '');
                    return stringValue.includes(',') || stringValue.includes('"') 
                        ? `"${stringValue.replace(/"/g, '""')}"` 
                        : stringValue;
                }).join(',')
            )
        ].join('\n');
        
        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        return true;
    } catch (error) {
        console.error('Export to CSV failed:', error);
        throw error;
    }
}

/**
 * Rate limiter for API calls
 * Improvement #5: Security - Rate limiting
 */
class RateLimiter {
    constructor(maxRequests = 10, timeWindow = 60000) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = [];
    }
    
    canMakeRequest() {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.timeWindow);
        
        if (this.requests.length < this.maxRequests) {
            this.requests.push(now);
            return true;
        }
        
        return false;
    }
    
    getWaitTime() {
        if (this.requests.length === 0) return 0;
        
        const oldestRequest = Math.min(...this.requests);
        const waitTime = this.timeWindow - (Date.now() - oldestRequest);
        
        return Math.max(0, waitTime);
    }
}

export const rateLimiter = new RateLimiter();
