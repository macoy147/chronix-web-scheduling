// public/sw.js - Service Worker with Network-First Strategy for Development
const CACHE_NAME = 'chronix-dashboard-v1.1.5'; // Increment version to force update - fix status filter
const urlsToCache = [
    '/',
    '/index.html',
    '/css/style.css',
    '/css/admin-dashboard.css',
    '/js/admin-dashboard.js',
    '/js/api-config.js',
    '/js/error-handler.js',
    '/js/auth-guard.js',
    '/js/script.js',
    '/img/default_admin_avatar.png',
    '/img/img/CTU_new_logo-removebg-preview.png',
    '/img/img/CHRONIX_LOGO.png',
    '/admin-dashboard.html'
];

self.addEventListener('install', function(event) {
    console.log('Service Worker installing...');
    // Skip waiting to activate immediately
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch(function(error) {
                console.log('Cache addAll failed:', error);
            })
    );
});

self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);
    
    // NEVER cache API calls - always fetch fresh data
    if (url.pathname.startsWith('/sections') ||
        url.pathname.startsWith('/schedules') ||
        url.pathname.startsWith('/subjects') ||
        url.pathname.startsWith('/rooms') ||
        url.pathname.startsWith('/teachers') ||
        url.pathname.startsWith('/students') ||
        url.pathname.startsWith('/users') ||
        url.pathname.startsWith('/api/')) {
        
        event.respondWith(
            fetch(event.request, {
                cache: 'no-store'
            })
        );
        return;
    }
    
    // Network-first strategy for HTML, CSS, and JS files (always get fresh content)
    // DO NOT CACHE during development to see changes immediately
    if (url.pathname.endsWith('.html') || 
        url.pathname.endsWith('.css') || 
        url.pathname.endsWith('.js') ||
        url.pathname.includes('/js/') ||
        url.pathname.includes('/css/')) {
        
        event.respondWith(
            fetch(event.request, {
                cache: 'no-store'
            })
            .catch(function() {
                // If network fails, try cache as fallback
                return caches.match(event.request);
            })
        );
    } else {
        // Cache-first strategy for images and other static assets
        event.respondWith(
            caches.match(event.request)
                .then(function(response) {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request).then(function(response) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(function(cache) {
                            cache.put(event.request, responseToCache);
                        });
                        return response;
                    });
                })
                .catch(function() {
                    return caches.match('/offline.html');
                })
        );
    }
});

self.addEventListener('activate', function(event) {
    console.log('Service Worker activating...');
    // Take control of all pages immediately
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});