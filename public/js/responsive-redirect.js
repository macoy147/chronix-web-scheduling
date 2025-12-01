// public/js/responsive-redirect.js

/**
 * Handles responsive redirection between desktop and mobile pages.
 * This module automatically redirects the user to the appropriate version
 * of a page based on screen width, with a cooldown to prevent loops.
 */

const BREAKPOINT = 767;
const REDIRECT_COOLDOWN = 1000; // 1 second

let lastRedirectTime = 0;

/**
 * Checks if the current screen size is considered mobile.
 * @returns {boolean}
 */
function isMobileScreen() {
    return window.innerWidth <= BREAKPOINT;
}

/**
 * Checks if the current URL is for a mobile page.
 * @returns {boolean}
 */
function isMobilePage() {
    return window.location.pathname.includes('-mobile');
}

/**
 * Performs the redirect to the mobile version of the current page.
 */
function redirectToMobile() {
    const currentPath = window.location.pathname;
    // Replace .html with -mobile.html
    const mobilePath = currentPath.replace('.html', '-mobile.html');
    console.log(`Redirecting to mobile: ${mobilePath}`);
    window.location.href = mobilePath;
}

/**
 * Performs the redirect to the desktop version of the current page.
 */
function redirectToDesktop() {
    const currentPath = window.location.pathname;
    // Replace -mobile.html with .html
    const desktopPath = currentPath.replace('-mobile.html', '.html');
    console.log(`Redirecting to desktop: ${desktopPath}`);
    window.location.href = desktopPath;
}

/**
 * The main logic to check screen size and redirect if necessary.
 */
function checkAndRedirect() {
    const now = Date.now();
    if (now - lastRedirectTime < REDIRECT_COOLDOWN) {
        return; // Still in cooldown period
    }

    const mobileScreen = isMobileScreen();
    const mobilePage = isMobilePage();

    if (mobileScreen && !mobilePage) {
        // Screen is mobile, but we're on the desktop page
        lastRedirectTime = now;
        redirectToMobile();
    } else if (!mobileScreen && mobilePage) {
        // Screen is desktop, but we're on the mobile page
        lastRedirectTime = now;
        redirectToDesktop();
    }
}

/**
 * Initializes the responsive redirection logic.
 */
export function initResponsiveRedirect() {
    // Check on initial page load
    checkAndRedirect();

    // Add a debounced listener for window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(checkAndRedirect, 250); // Wait 250ms after resizing stops
    });
}