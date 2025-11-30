// dashboard-cache.js - Data caching with TTL
// Improvement #7: Better data loading and caching
// Improvement #10: Progressive enhancement with fallbacks

import { detectFeatures } from './dashboard-utils.js';

const features = detectFeatures();

/**
 * Cache manager with TTL and fallback for browsers without localStorage
 */
class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.useLocalStorage = features.localStorage;
    }

    /**
     * Set cache item with TTL
     */
    set(key, data, ttl = 5 * 60 * 1000) {
        try {
            const item = {
                data,
                expiry: Date.now() + ttl,
                timestamp: Date.now()
            };
            
            // Always store in memory cache
            this.memoryCache.set(key, item);
            
            // Try localStorage if available
            if (this.useLocalStorage) {
                try {
                    localStorage.setItem(`dashboard_${key}`, JSON.stringify(item));
                } catch (e) {
                    console.warn('localStorage quota exceeded, using memory cache only');
                }
            }
            
            return true;
        } catch (error) {
            console.error('Cache set failed:', error);
            return false;
        }
    }

    /**
     * Get cache item if not expired
     */
    get(key) {
        try {
            // Check memory cache first (faster)
            if (this.memoryCache.has(key)) {
                const item = this.memoryCache.get(key);
                if (Date.now() <= item.expiry) {
                    return item.data;
                } else {
                    this.memoryCache.delete(key);
                }
            }
            
            // Fallback to localStorage
            if (this.useLocalStorage) {
                const item = localStorage.getItem(`dashboard_${key}`);
                if (!item) return null;
                
                const { data, expiry } = JSON.parse(item);
                if (Date.now() > expiry) {
                    localStorage.removeItem(`dashboard_${key}`);
                    return null;
                }
                
                // Restore to memory cache
                this.memoryCache.set(key, { data, expiry });
                return data;
            }
            
            return null;
        } catch (error) {
            console.error('Cache get failed:', error);
            return null;
        }
    }

    /**
     * Clear specific cache item
     */
    clear(key) {
        try {
            this.memoryCache.delete(key);
            
            if (this.useLocalStorage) {
                localStorage.removeItem(`dashboard_${key}`);
            }
            
            return true;
        } catch (error) {
            console.error('Cache clear failed:', error);
            return false;
        }
    }

    /**
     * Clear all dashboard caches
     */
    clearAll() {
        try {
            this.memoryCache.clear();
            
            if (this.useLocalStorage) {
                const keys = Object.keys(localStorage);
                keys.forEach(key => {
                    if (key.startsWith('dashboard_')) {
                        localStorage.removeItem(key);
                    }
                });
            }
            
            return true;
        } catch (error) {
            console.error('Cache clearAll failed:', error);
            return false;
        }
    }

    /**
     * Check if cache exists and is valid
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Get cache age in milliseconds
     */
    getAge(key) {
        try {
            if (this.memoryCache.has(key)) {
                const item = this.memoryCache.get(key);
                return Date.now() - item.timestamp;
            }
            
            if (this.useLocalStorage) {
                const item = localStorage.getItem(`dashboard_${key}`);
                if (item) {
                    const { timestamp } = JSON.parse(item);
                    return Date.now() - timestamp;
                }
            }
            
            return null;
        } catch (error) {
            console.error('Cache getAge failed:', error);
            return null;
        }
    }
}

// Export singleton instance
export const cache = new CacheManager();
