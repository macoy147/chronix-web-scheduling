/**
 * Admin Students Mobile JavaScript - ENHANCED WITH FIXES
 * Status is automatically determined by whether student has schedules
 */

import AuthGuard from './auth-guard.js';

// Prevent browser caching for this page
if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.href);
}

// Check if page was reloaded
if (performance.navigation.type === 1) {
    console.log('Page was reloaded, will force fresh data fetch');
    sessionStorage.setItem('forceRefreshStudentsMobile', 'true');
}

// State management
let allStudents = [];
let allSections = [];
let allSchedules = [];
let currentPage = 1;
const STUDENTS_PER_PAGE = 10;
let currentStudentId = null;
let isLoading = false;

// Schedule view state
let currentScheduleView = 'weekly';
let currentDayIndex = 0;
let currentStudentSchedules = [];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

document.addEventListener('DOMContentLoaded', async function() {
    if (!AuthGuard.checkAuthentication('admin')) return;
    initializeMobileMenu();
    initializeEventListeners();
    updateMobileProfileInfo();
    
    // Initial load - check if we need to force refresh
    const forceInitialRefresh = sessionStorage.getItem('forceRefreshStudentsMobile') === 'true';
    if (forceInitialRefresh) {
        sessionStorage.removeItem('forceRefreshStudentsMobile');
        console.log('Forcing initial refresh due to page reload (mobile)');
        await loadAllData(true);
    } else {
        await loadAllData();
    }
});

function initializeMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileSideMenu = document.getElementById('mobileSideMenu');
    const mobileSideMenuClose = document.getElementById('mobileSideMenuClose');
    const mobileOverlay = document.getElementById('mobileOverlay');

    function openMobileMenu() {
        mobileSideMenu?.classList.add('open');
        mobileOverlay?.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
        mobileSideMenu?.classList.remove('open');
        mobileOverlay?.classList.remove('open');
        document.body.style.overflow = '';
    }

    mobileMenuBtn?.addEventListener('click', openMobileMenu);
    mobileSideMenuClose?.addEventListener('click', closeMobileMenu);
    mobileOverlay?.addEventListener('click', closeMobileMenu);
    document.querySelectorAll('.mobile-side-menu-links a').forEach(link => link.addEventListener('click', closeMobileMenu));

    document.getElementById('mobileLogoutBtn')?.addEventListener('click', function(e) {
        e.preventDefault();
        if (confirm('Are you sure you want to logout?')) AuthGuard.logout();
    });
}

function updateMobileProfileInfo() {
    const currentUser = AuthGuard.getCurrentUser();
    if (currentUser) {
        const mobileProfileName = document.getElementById('mobileProfileName');
        if (mobileProfileName) mobileProfileName.textContent = currentUser.fullname;
        
        // Update profile avatar in side menu
        const mobileProfileAvatar = document.getElementById('mobileProfileAvatar');
        if (mobileProfileAvatar && currentUser.profilePicture) {
            mobileProfileAvatar.src = currentUser.profilePicture.startsWith('http') 
                ? currentUser.profilePicture 
                : currentUser.profilePicture;
        } else if (mobileProfileAvatar) {
            mobileProfileAvatar.src = '/img/default_admin_avatar.png';
        }
        
        // Update profile avatar in header (top bar)
        const mobileHeaderProfileAvatar = document.getElementById('mobileHeaderProfileAvatar');
        if (mobileHeaderProfileAvatar && currentUser.profilePicture) {
            mobileHeaderProfileAvatar.src = currentUser.profilePicture.startsWith('http') 
                ? currentUser.profilePicture 
                : currentUser.profilePicture;
        } else if (mobileHeaderProfileAvatar) {
            mobileHeaderProfileAvatar.src = '/img/default_admin_avatar.png';
        }
    }
}

function initializeEventListeners() {
    // Search with debounce
    const searchInput = document.getElementById('mobileStudentSearch');
    let searchTimeout;
    searchInput?.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => { currentPage = 1; displayStudents(); }, 300);
    });

    // Filters
    document.getElementById('mobileYearLevelFilter')?.addEventListener('change', () => { currentPage = 1; displayStudents(); });
    document.getElementById('mobileSectionFilter')?.addEventListener('change', () => { currentPage = 1; displayStudents(); });
    document.getElementById('mobileStatusFilter')?.addEventListener('change', () => { currentPage = 1; displayStudents(); });

    // Buttons
    document.getElementById('mobileAddStudentBtn')?.addEventListener('click', openAddStudentModal);
    document.getElementById('loadMoreBtn')?.addEventListener('click', loadMoreStudents);

    // Modal close buttons
    document.getElementById('closeAddStudentModal')?.addEventListener('click', closeAddStudentModal);
    document.getElementById('cancelAddStudent')?.addEventListener('click', closeAddStudentModal);
    document.getElementById('closeScheduleModal')?.addEventListener('click', closeScheduleModal);
    document.getElementById('closeEditStudentModal')?.addEventListener('click', closeEditStudentModal);
    document.getElementById('cancelEditStudent')?.addEventListener('click', closeEditStudentModal);

    // Forms
    document.getElementById('addStudentForm')?.addEventListener('submit', handleAddStudent);
    document.getElementById('editStudentForm')?.addEventListener('submit', handleEditStudent);

    // Profile picture
    document.getElementById('addProfilePicture')?.addEventListener('change', handleProfilePicturePreview);
    document.getElementById('editProfilePicture')?.addEventListener('change', handleEditProfilePicturePreview);

    // Schedule view toggle
    document.querySelectorAll('.schedule-view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.schedule-view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderScheduleView(this.dataset.view);
        });
    });

    // Keyboard - close modals on Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAddStudentModal();
            closeEditStudentModal();
            closeScheduleModal();
        }
    });
}

// ==================== DATA LOADING - UPDATED WITH FIXES ====================

async function loadAllData(forceRefresh = false) {
    showLoading(true);
    try {
        console.log('🔄 Loading all student data (mobile)...');
        await Promise.all([
            loadStudents(forceRefresh), 
            loadSections(forceRefresh), 
            loadSchedules(forceRefresh)
        ]);
        console.log('✅ All data loaded successfully (mobile)');
        populateSectionFilter();
        displayStudents();
        updateStatistics();
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Error loading data', 'error');
    } finally {
        showLoading(false);
    }
}

async function loadStudents(forceRefresh = false) {
    try {
        console.log('Fetching students from server (mobile)...');
        const url = forceRefresh ? `/users/students?_t=${Date.now()}` : `/users/students?_=${Date.now()}`;
        
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'X-Requested-With': 'XMLHttpRequest'
            },
            cache: 'no-store',
            credentials: 'same-origin'
        });
        
        if (res.ok) {
            const fetchedStudents = await res.json();
            allStudents = fetchedStudents.filter(s => s && s._id);
            console.log(`✅ Students data received from server (mobile): ${allStudents.length} students`);
        } else {
            console.error('Failed to load students:', res.status);
            allStudents = [];
        }
    } catch (error) {
        console.error('Error loading students:', error);
        allStudents = [];
    }
}

async function loadSections(forceRefresh = false) {
    try {
        const url = forceRefresh ? `/sections?_t=${Date.now()}` : `/sections?_=${Date.now()}`;
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            cache: 'no-store'
        });
        if (res.ok) {
            allSections = await res.json();
            console.log('✅ Loaded sections (mobile):', allSections.length);
        }
    } catch (error) {
        allSections = [];
    }
}

async function loadSchedules(forceRefresh = false) {
    try {
        const url = forceRefresh ? `/schedules?_t=${Date.now()}` : `/schedules?_=${Date.now()}`;
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            cache: 'no-store'
        });
        if (res.ok) {
            allSchedules = await res.json();
            console.log('✅ Loaded schedules (mobile):', allSchedules.length);
        }
    } catch (error) {
        allSchedules = [];
    }
}

function populateSectionFilter() {
    const select = document.getElementById('mobileSectionFilter');
    if (!select) return;
    select.innerHTML = '<option value="">All Sections</option>';
    allSections.forEach(section => {
        const option = document.createElement('option');
        option.value = section.sectionName;
        option.textContent = section.sectionName;
        select.appendChild(option);
    });
}

// Helper function to populate section dropdowns with optional year level filter
function populateSectionDropdown(selectId, filterYearLevel = null, includeYearInText = true) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    const currentValue = select.value; // Preserve current selection if possible
    select.innerHTML = '<option value="">Select Section</option>';
    
    // Filter sections by year level if specified
    const filteredSections = filterYearLevel 
        ? allSections.filter(s => s.yearLevel === parseInt(filterYearLevel))
        : allSections;
    
    filteredSections.forEach(section => {
        const option = document.createElement('option');
        option.value = section.sectionName;
        option.textContent = includeYearInText 
            ? `${section.sectionName} (Year ${section.yearLevel})`
            : section.sectionName;
        option.setAttribute('data-year-level', section.yearLevel);
        select.appendChild(option);
    });
    
    // Restore selection if it still exists in filtered list
    if (currentValue && filteredSections.some(s => s.sectionName === currentValue)) {
        select.value = currentValue;
    }
}

// Helper function to extract year level from section name (e.g., "1A" -> 1, "2B" -> 2)
function extractYearLevelFromSection(sectionName) {
    if (!sectionName) return null;
    const match = sectionName.match(/^(\d+)/);
    return match ? parseInt(match[1]) : null;
}

// Helper function to auto-fill year level based on section
function autoFillYearLevelFromSection(sectionValue, yearLevelSelectId) {
    const yearLevel = extractYearLevelFromSection(sectionValue);
    if (yearLevel) {
        const yearLevelSelect = document.getElementById(yearLevelSelectId);
        if (yearLevelSelect) {
            yearLevelSelect.value = yearLevel.toString();
            console.log(`✅ Auto-filled Year Level: ${yearLevel} from Section: ${sectionValue}`);
        }
    }
}

// Helper function to filter sections based on year level
function filterSectionsByYearLevel(yearLevel, sectionSelectId) {
    if (yearLevel) {
        populateSectionDropdown(sectionSelectId, yearLevel, true);
        console.log(`✅ Filtered sections for Year Level: ${yearLevel}`);
    } else {
        populateSectionDropdown(sectionSelectId, null, true); // Show all sections
    }
}

// Setup bidirectional sync between Section and Year Level dropdowns
function setupSectionYearLevelSync(sectionSelectId, yearLevelSelectId) {
    const sectionSelect = document.getElementById(sectionSelectId);
    const yearLevelSelect = document.getElementById(yearLevelSelectId);
    
    if (!sectionSelect || !yearLevelSelect) return;
    
    // Remove existing listeners to avoid duplicates
    const newSectionSelect = sectionSelect.cloneNode(true);
    const newYearLevelSelect = yearLevelSelect.cloneNode(true);
    sectionSelect.parentNode.replaceChild(newSectionSelect, sectionSelect);
    yearLevelSelect.parentNode.replaceChild(newYearLevelSelect, yearLevelSelect);
    
    // When section changes, auto-fill year level
    newSectionSelect.addEventListener('change', function() {
        if (this.value) {
            autoFillYearLevelFromSection(this.value, yearLevelSelectId);
        }
    });
    
    // When year level changes, filter sections
    newYearLevelSelect.addEventListener('change', function() {
        filterSectionsByYearLevel(this.value, sectionSelectId);
    });
}

// ==================== HELPER FUNCTIONS ====================

// Status is automatically determined - active if student has section with schedules
function getStudentStatus(student) {
    if (!student.section) return 'inactive';
    const hasSchedules = allSchedules.some(s => s.section?.sectionName === student.section);
    return hasSchedules ? 'active' : 'inactive';
}

function getYearLevel(student) {
    if (student.yearLevel) return parseInt(student.yearLevel);
    if (student.section) {
        const section = allSections.find(s => s.sectionName === student.section);
        if (section?.yearLevel) return parseInt(section.yearLevel);
        const match = student.section.match(/\b(\d+)/);
        if (match) return parseInt(match[1]);
    }
    return null;
}

function updateStatistics() {
    const total = allStudents.length;
    const active = allStudents.filter(s => getStudentStatus(s) === 'active').length;
    const inactive = total - active;

    const totalEl = document.getElementById('totalStudentsCount');
    const activeEl = document.getElementById('activeStudentsCount');
    const inactiveEl = document.getElementById('inactiveStudentsCount');
    
    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (inactiveEl) inactiveEl.textContent = inactive;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ==================== FILTERING & DISPLAY ====================

function getFilteredStudents() {
    const searchTerm = document.getElementById('mobileStudentSearch')?.value.toLowerCase() || '';
    const yearFilter = document.getElementById('mobileYearLevelFilter')?.value || '';
    const sectionFilter = document.getElementById('mobileSectionFilter')?.value || '';
    const statusFilter = document.getElementById('mobileStatusFilter')?.value || '';

    return allStudents.filter(student => {
        const matchesSearch = !searchTerm || 
            student.fullname?.toLowerCase().includes(searchTerm) ||
            student.email?.toLowerCase().includes(searchTerm) ||
            student.ctuid?.toLowerCase().includes(searchTerm);
        const yearLevel = getYearLevel(student);
        const matchesYear = !yearFilter || yearLevel === parseInt(yearFilter);
        const matchesSection = !sectionFilter || student.section === sectionFilter;
        const status = getStudentStatus(student);
        const matchesStatus = !statusFilter || status === statusFilter;
        return matchesSearch && matchesYear && matchesSection && matchesStatus;
    });
}

function displayStudents() {
    const list = document.getElementById('mobileStudentsList');
    if (!list) return;

    const filtered = getFilteredStudents();
    const endIndex = currentPage * STUDENTS_PER_PAGE;
    const studentsToShow = filtered.slice(0, endIndex);

    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-state"><i class="bi bi-inbox"></i><span>No students found</span></div>`;
        updateLoadMoreButton(false);
        return;
    }

    list.innerHTML = '';
    studentsToShow.forEach((student, index) => {
        // Validate student data before rendering
        if (!student || !student._id) {
            console.warn('⚠️ Skipping invalid student data:', student);
            return;
        }
        const card = createStudentCard(student, index);
        list.appendChild(card);
    });

    updateLoadMoreButton(endIndex < filtered.length);
    updateStatistics();
}

function createStudentCard(student, index) {
    const status = getStudentStatus(student);
    const yearLevel = getYearLevel(student);
    
    const card = document.createElement('div');
    card.className = 'mobile-student-card';
    card.setAttribute('role', 'article');
    card.setAttribute('tabindex', '0');
    
    card.innerHTML = `
        <div class="mobile-student-header">
            <img src="${student.profilePicture || '/img/default_admin_avatar.png'}" 
                 alt="Profile picture of ${student.fullname}" 
                 class="mobile-student-avatar"
                 onerror="this.src='/img/default_admin_avatar.png'">
            <div class="mobile-student-info">
                <div class="mobile-student-name">${escapeHtml(student.fullname)}</div>
                <div class="mobile-student-id">${escapeHtml(student.ctuid || 'No ID')}</div>
            </div>
            <span class="status-badge status-${status}">${status}</span>
        </div>
        <div class="mobile-student-details">
            <div class="mobile-student-detail">
                <i class="bi bi-envelope"></i>
                <span>${escapeHtml(student.email)}</span>
            </div>
            <div class="mobile-student-detail">
                <i class="bi bi-layers"></i>
                <span>${escapeHtml(student.section || 'No section')}</span>
            </div>
            <div class="mobile-student-detail">
                <i class="bi bi-mortarboard"></i>
                <span>Year ${yearLevel || 'N/A'}</span>
            </div>
            <div class="mobile-student-detail">
                <i class="bi bi-gender-ambiguous"></i>
                <span>${capitalizeFirst(student.gender) || 'Not specified'}</span>
            </div>
        </div>
        <div class="mobile-student-actions">
            <button class="mobile-action-btn schedule" onclick="viewStudentSchedule('${student._id}')">
                <i class="bi bi-calendar"></i> Schedule
            </button>
            <button class="mobile-action-btn edit" onclick="openEditStudent('${student._id}')">
                <i class="bi bi-pencil"></i> Edit
            </button>
            <button class="mobile-action-btn delete" onclick="confirmDeleteStudent('${student._id}')">
                <i class="bi bi-trash"></i>
            </button>
        </div>
    `;

    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            viewStudentSchedule(student._id);
        }
    });

    return card;
}

function loadMoreStudents() {
    currentPage++;
    displayStudents();
}

function updateLoadMoreButton(show) {
    const btn = document.getElementById('loadMoreBtn');
    if (btn) btn.style.display = show ? 'block' : 'none';
}

// ==================== VALIDATION ====================

function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validateCtuid(ctuid) { return /^[A-Za-z0-9-]{6,15}$/.test(ctuid); }
function validateFullName(name) { return name && name.trim().length >= 2; }
function validateBirthdate(date) {
    if (!date) return true;
    const birthDate = new Date(date);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    return age >= 15 && age <= 100;
}

function checkDuplicateCtuid(ctuid, excludeId = null) {
    return allStudents.some(s => s.ctuid?.toLowerCase() === ctuid.toLowerCase() && s._id !== excludeId);
}

function checkDuplicateEmail(email, excludeId = null) {
    return allStudents.some(s => s.email?.toLowerCase() === email.toLowerCase() && s._id !== excludeId);
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.classList.add('error');
    let errorEl = field.parentElement.querySelector('.field-error');
    if (!errorEl) {
        errorEl = document.createElement('span');
        errorEl.className = 'field-error';
        field.parentElement.appendChild(errorEl);
    }
    errorEl.textContent = message;
}

function clearAllErrors(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    form.querySelectorAll('.field-error').forEach(el => el.remove());
}

// ==================== ADD STUDENT ====================

function openAddStudentModal() {
    const modal = document.getElementById('addStudentModal');
    if (!modal) return;

    document.getElementById('addStudentForm')?.reset();
    document.getElementById('addProfilePreview')?.setAttribute('src', '/img/default_admin_avatar.png');
    clearAllErrors('addStudentForm');
    
    // Populate sections dropdown
    populateSectionDropdown('addSection', null, true);
    
    // Setup smart auto-fill listeners for Add Student form
    setupSectionYearLevelSync('addSection', 'addYearLevel');

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('addFullName')?.focus(), 100);
}

function closeAddStudentModal() {
    const modal = document.getElementById('addStudentModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

async function handleAddStudent(e) {
    e.preventDefault();
    clearAllErrors('addStudentForm');
    
    const fullname = document.getElementById('addFullName')?.value.trim();
    const email = document.getElementById('addEmail')?.value.trim();
    const ctuid = document.getElementById('addCtuid')?.value.trim();
    const birthdate = document.getElementById('addBirthdate')?.value;
    const gender = document.getElementById('addGender')?.value;
    const section = document.getElementById('addSection')?.value;
    const yearLevel = document.getElementById('addYearLevel')?.value;
    const profilePictureInput = document.getElementById('addProfilePicture');

    let hasErrors = false;

    if (!validateFullName(fullname)) { showFieldError('addFullName', 'Full name must be at least 2 characters'); hasErrors = true; }
    if (!validateEmail(email)) { showFieldError('addEmail', 'Please enter a valid email address'); hasErrors = true; }
    else if (checkDuplicateEmail(email)) { showFieldError('addEmail', 'This email is already registered'); hasErrors = true; }
    if (!validateCtuid(ctuid)) { showFieldError('addCtuid', 'CTU ID must be 6-15 alphanumeric characters'); hasErrors = true; }
    else if (checkDuplicateCtuid(ctuid)) { showFieldError('addCtuid', 'This CTU ID is already registered'); hasErrors = true; }
    if (!validateBirthdate(birthdate)) { showFieldError('addBirthdate', 'Student must be between 15 and 100 years old'); hasErrors = true; }

    if (hasErrors) { showToast('Please fix the errors in the form', 'error'); return; }

    const registerData = {
        fullname, email, ctuid,
        userrole: 'student',
        password: ctuid,
        birthdate: birthdate || '',
        gender: gender || '',
        section: section || '',
        yearLevel: yearLevel || ''
    };

    try {
        showLoading(true);
        const res = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registerData)
        });

        const result = await res.json();

        if (res.ok) {
            if (profilePictureInput?.files[0] && result.user?._id) {
                const formData = new FormData();
                formData.append('profilePicture', profilePictureInput.files[0]);
                try { await fetch(`/upload-profile-picture/${result.user._id}`, { method: 'POST', body: formData }); }
                catch (uploadError) { console.warn('Profile picture upload failed:', uploadError); }
            }
            
            showToast('Student added successfully!', 'success');
            closeAddStudentModal();
            
            console.log('🔄 Forcing data refresh after student creation (mobile)...');
            await new Promise(resolve => setTimeout(resolve, 500));
            await loadAllData(true);
            console.log('✅ Data refresh complete (mobile). Total students now:', allStudents.length);
        } else {
            showToast(result.error || 'Failed to add student', 'error');
        }
    } catch (error) {
        console.error('Error adding student:', error);
        showToast('Failed to add student. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

// ==================== EDIT STUDENT ====================

window.openEditStudent = function(studentId) {
    const student = allStudents.find(s => s && s._id === studentId);
    if (!student || !student._id) { 
        console.error('❌ Student not found or invalid:', studentId);
        showToast('Student not found. Refreshing data...', 'error'); 
        loadAllData();
        return; 
    }

    currentStudentId = studentId;
    const modal = document.getElementById('editStudentModal');
    if (!modal) return;

    clearAllErrors('editStudentForm');
    document.getElementById('editFullName').value = student.fullname || '';
    document.getElementById('editEmail').value = student.email || '';
    document.getElementById('editCtuid').value = student.ctuid || '';
    document.getElementById('editBirthdate').value = student.birthdate || '';
    document.getElementById('editGender').value = student.gender || '';
    
    // Set year level first
    const studentYearLevel = student.yearLevel || extractYearLevelFromSection(student.section);
    document.getElementById('editYearLevel').value = studentYearLevel || '';
    
    const preview = document.getElementById('editProfilePreview');
    if (preview) preview.src = student.profilePicture || '/img/default_admin_avatar.png';

    // Populate sections dropdown (filter by year level if available)
    populateSectionDropdown('editSection', studentYearLevel, true);
    
    // Set section value after populating
    const sectionSelect = document.getElementById('editSection');
    if (sectionSelect && student.section) {
        sectionSelect.value = student.section;
    }
    
    // Setup smart auto-fill listeners for Edit Student form
    setupSectionYearLevelSync('editSection', 'editYearLevel');

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('editFullName')?.focus(), 100);
};

function closeEditStudentModal() {
    const modal = document.getElementById('editStudentModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    currentStudentId = null;
}

async function handleEditStudent(e) {
    e.preventDefault();
    if (!currentStudentId) return;
    
    clearAllErrors('editStudentForm');
    
    const fullname = document.getElementById('editFullName')?.value.trim();
    const email = document.getElementById('editEmail')?.value.trim();
    const ctuid = document.getElementById('editCtuid')?.value.trim();
    const birthdate = document.getElementById('editBirthdate')?.value;
    const gender = document.getElementById('editGender')?.value;
    const section = document.getElementById('editSection')?.value;
    const yearLevel = document.getElementById('editYearLevel')?.value;
    const profilePictureInput = document.getElementById('editProfilePicture');

    let hasErrors = false;

    if (!validateFullName(fullname)) { showFieldError('editFullName', 'Full name must be at least 2 characters'); hasErrors = true; }
    if (!validateEmail(email)) { showFieldError('editEmail', 'Please enter a valid email address'); hasErrors = true; }
    else if (checkDuplicateEmail(email, currentStudentId)) { showFieldError('editEmail', 'This email is already registered'); hasErrors = true; }
    if (!validateCtuid(ctuid)) { showFieldError('editCtuid', 'CTU ID must be 6-15 alphanumeric characters'); hasErrors = true; }
    else if (checkDuplicateCtuid(ctuid, currentStudentId)) { showFieldError('editCtuid', 'This CTU ID is already registered'); hasErrors = true; }
    if (!validateBirthdate(birthdate)) { showFieldError('editBirthdate', 'Student must be between 15 and 100 years old'); hasErrors = true; }

    if (hasErrors) { showToast('Please fix the errors in the form', 'error'); return; }

    const updateData = { fullname, email, ctuid, birthdate, gender, section, yearLevel };

    try {
        showLoading(true);
        
        if (profilePictureInput?.files[0]) {
            const formData = new FormData();
            formData.append('profilePicture', profilePictureInput.files[0]);
            const uploadRes = await fetch(`/upload-profile-picture/${currentStudentId}`, { method: 'POST', body: formData });
            if (uploadRes.ok) {
                const uploadResult = await uploadRes.json();
                updateData.profilePicture = uploadResult.profilePicture;
            }
        }

        const res = await fetch(`/user/${currentStudentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        if (res.ok) {
            const updatedData = await res.json();
            showToast('Student updated successfully!', 'success');
            closeEditStudentModal();
            
            console.log('🔄 Forcing data refresh after student update (mobile)...');
            await new Promise(resolve => setTimeout(resolve, 500));
            await loadAllData(true);
            console.log('✅ Data refresh complete (mobile). Total students now:', allStudents.length);
        } else {
            const error = await res.json();
            showToast(error.error || 'Failed to update student', 'error');
        }
    } catch (error) {
        console.error('Error updating student:', error);
        showToast('Failed to update student. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

// ==================== DELETE STUDENT ====================

window.confirmDeleteStudent = function(studentId) {
    const student = allStudents.find(s => s && s._id === studentId);
    if (!student || !student._id) {
        console.error('❌ Student not found or invalid:', studentId);
        showToast('Student not found. Refreshing data...', 'error');
        loadAllData();
        return;
    }

    if (confirm(`Are you sure you want to delete ${student.fullname}? This action cannot be undone.`)) {
        deleteStudent(studentId);
    }
};

async function deleteStudent(studentId) {
    try {
        showLoading(true);
        
        const studentToDelete = allStudents.find(s => s._id === studentId);
        const studentName = studentToDelete?.fullname || 'Unknown';
        
        console.log(`🗑️ Attempting to delete student: ${studentName} (ID: ${studentId})`);
        
        const res = await fetch(`/user/${studentId}`, { 
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (res.ok) {
            console.log(`✅ Student deleted successfully: ${studentName}`);
            showToast('Student deleted successfully!', 'success');
            
            // Force reload fresh data from server to ensure consistency
            await loadStudents();
            await loadSchedules();
            
            // Update statistics and refresh display
            updateStatistics();
            displayStudents();
        } else {
            const error = await res.json();
            console.error(`❌ Failed to delete student: ${error.error}`);
            showToast(error.error || 'Failed to delete student', 'error');
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        showToast('Failed to delete student. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

// ==================== SCHEDULE VIEWING ====================

window.viewStudentSchedule = function(studentId) {
    const student = allStudents.find(s => s._id === studentId);
    if (!student) { showToast('Student not found', 'error'); return; }

    if (!student.section) { showToast('This student is not assigned to any section', 'error'); return; }

    currentStudentSchedules = allSchedules.filter(s => s.section?.sectionName === student.section);

    if (currentStudentSchedules.length === 0) { showToast('No schedules found for this section', 'error'); return; }

    document.getElementById('scheduleStudentName').textContent = student.fullname;
    document.getElementById('scheduleStudentSection').textContent = student.section;
    
    const avatar = document.getElementById('scheduleStudentAvatar');
    if (avatar) avatar.src = student.profilePicture || '/img/default_admin_avatar.png';

    updateScheduleStatistics();
    currentScheduleView = 'weekly';
    currentDayIndex = 0;
    renderScheduleView('weekly');

    const modal = document.getElementById('scheduleModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

function closeScheduleModal() {
    const modal = document.getElementById('scheduleModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function updateScheduleStatistics() {
    let lectureHours = 0, labHours = 0;
    currentStudentSchedules.forEach(schedule => {
        const duration = calculateDuration(schedule);
        if (schedule.scheduleType === 'lecture') lectureHours += duration;
        else if (schedule.scheduleType === 'lab') labHours += duration;
    });

    const lectureEl = document.getElementById('scheduleLectureHours');
    const labEl = document.getElementById('scheduleLabHours');
    const totalEl = document.getElementById('scheduleTotalHours');
    
    if (lectureEl) lectureEl.textContent = lectureHours.toFixed(1);
    if (labEl) labEl.textContent = labHours.toFixed(1);
    if (totalEl) totalEl.textContent = (lectureHours + labHours).toFixed(1);
}

function calculateDuration(schedule) {
    let [startH, startM] = schedule.startTime.split(':').map(Number);
    let [endH, endM] = schedule.endTime.split(':').map(Number);
    if (schedule.startPeriod === 'PM' && startH !== 12) startH += 12;
    if (schedule.startPeriod === 'AM' && startH === 12) startH = 0;
    if (schedule.endPeriod === 'PM' && endH !== 12) endH += 12;
    if (schedule.endPeriod === 'AM' && endH === 12) endH = 0;
    return ((endH * 60 + endM) - (startH * 60 + startM)) / 60;
}

function renderScheduleView(view) {
    currentScheduleView = view;
    document.querySelectorAll('.schedule-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    const container = document.getElementById('scheduleContent');
    if (!container) return;

    if (view === 'weekly') renderWeeklySchedule(container);
    else renderDailySchedule(container);
}

function renderWeeklySchedule(container) {
    container.innerHTML = `
        <div class="weekly-schedule-grid">
            ${DAYS.map(day => {
                const daySchedules = currentStudentSchedules
                    .filter(s => s.day === day)
                    .sort((a, b) => sortByTime(a, b));
                
                return `
                    <div class="schedule-day-column">
                        <div class="schedule-day-header">${day.substring(0, 3)}</div>
                        <div class="schedule-day-content">
                            ${daySchedules.length === 0 ? '<div class="no-class">No class</div>' :
                                daySchedules.map(s => createScheduleCard(s)).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderDailySchedule(container) {
    const currentDay = DAYS[currentDayIndex];
    const daySchedules = currentStudentSchedules
        .filter(s => s.day === currentDay)
        .sort((a, b) => sortByTime(a, b));

    container.innerHTML = `
        <div class="daily-schedule-view">
            <div class="daily-nav">
                <button class="daily-nav-btn" id="prevDayBtn"><i class="bi bi-chevron-left"></i></button>
                <h4 class="daily-current-day">${currentDay}</h4>
                <button class="daily-nav-btn" id="nextDayBtn"><i class="bi bi-chevron-right"></i></button>
            </div>
            <div class="daily-schedule-list">
                ${daySchedules.length === 0 ? 
                    `<div class="no-class-daily"><i class="bi bi-calendar-x"></i><p>No classes on ${currentDay}</p></div>` :
                    daySchedules.map(s => createDailyScheduleCard(s)).join('')}
            </div>
        </div>
    `;

    document.getElementById('prevDayBtn')?.addEventListener('click', () => navigateDay(-1));
    document.getElementById('nextDayBtn')?.addEventListener('click', () => navigateDay(1));
}

function navigateDay(direction) {
    currentDayIndex = (currentDayIndex + direction + DAYS.length) % DAYS.length;
    renderScheduleView('daily');
}

function sortByTime(a, b) {
    let aStart = parseInt(a.startTime.replace(':', ''));
    if (a.startPeriod === 'PM' && aStart < 1200) aStart += 1200;
    let bStart = parseInt(b.startTime.replace(':', ''));
    if (b.startPeriod === 'PM' && bStart < 1200) bStart += 1200;
    return aStart - bStart;
}

function createScheduleCard(schedule) {
    const time = `${schedule.startTime} ${schedule.startPeriod}`;
    const subject = schedule.subject?.courseCode || 'N/A';
    const type = schedule.scheduleType || 'lecture';
    return `<div class="schedule-card ${type}">
        <div class="schedule-time">${time}</div>
        <div class="schedule-subject">${escapeHtml(subject)}</div>
        <div class="schedule-room">${escapeHtml(schedule.room?.roomName || 'TBA')}</div>
    </div>`;
}

function createDailyScheduleCard(schedule) {
    const timeRange = `${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}`;
    const subject = schedule.subject?.courseCode || 'N/A';
    const title = schedule.subject?.descriptiveTitle || '';
    const teacher = schedule.teacher?.fullname || 'TBA';
    const room = schedule.room?.roomName || 'TBA';
    const type = schedule.scheduleType || 'lecture';
    
    return `<div class="daily-schedule-card ${type}">
        <div class="daily-schedule-time"><i class="bi bi-clock"></i> ${timeRange}</div>
        <div class="daily-schedule-info">
            <div class="daily-schedule-subject">${escapeHtml(subject)}</div>
            <div class="daily-schedule-title">${escapeHtml(title)}</div>
            <div class="daily-schedule-meta">
                <span><i class="bi bi-person"></i> ${escapeHtml(teacher)}</span>
                <span><i class="bi bi-door-open"></i> ${escapeHtml(room)}</span>
                <span class="schedule-type-badge ${type}">${capitalizeFirst(type)}</span>
            </div>
        </div>
    </div>`;
}

// ==================== PROFILE PICTURE HANDLING ====================

function handleProfilePicturePreview(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image file', 'error'); e.target.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be less than 5MB', 'error'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (event) => {
        const preview = document.getElementById('addProfilePreview');
        if (preview) preview.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function handleEditProfilePicturePreview(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image file', 'error'); e.target.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be less than 5MB', 'error'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (event) => {
        const preview = document.getElementById('editProfilePreview');
        if (preview) preview.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// ==================== UTILITY FUNCTIONS ====================

function showLoading(show) {
    const loader = document.getElementById('mobileLoader');
    if (loader) loader.style.display = show ? 'flex' : 'none';
    isLoading = show;
}

function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.mobile-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `mobile-toast ${type}`;
    toast.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i><span>${escapeHtml(message)}</span>`;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Export functions for global access
window.viewStudentSchedule = window.viewStudentSchedule;
window.openEditStudent = window.openEditStudent;
window.confirmDeleteStudent = window.confirmDeleteStudent;
