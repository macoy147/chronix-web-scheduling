/**
 * Admin Students Management - Desktop Version
 * Features: CRUD operations, pagination, validation, profile upload
 * Status is automatically determined by whether student has schedules
 */

import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';
import AuthGuard from './auth-guard.js';

document.addEventListener('DOMContentLoaded', function() {
    if (!AuthGuard.checkAuthentication('admin')) {
        return;
    }

    // State management
    let students = [];
    let schedules = [];
    let sections = [];
    let rooms = [];
    let currentStudentId = null;
    let currentView = 'weekly';
    let currentShift = 'all';
    let currentDayIndex = 0;
    let studentToDelete = null;

    // Pagination state
    let currentPage = 1;
    const STUDENTS_PER_PAGE = 15;
    let filteredStudents = [];

    // Profile dropdown
    const profileDropdown = document.querySelector('.admin-profile-dropdown');
    if (profileDropdown) {
        profileDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
            profileDropdown.classList.toggle('open');
        });
        document.addEventListener('click', () => profileDropdown.classList.remove('open'));
    }

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', function(e) {
        e.preventDefault();
        AuthGuard.logout();
    });

    function updateProfileInfo() {
        const currentUser = AuthGuard.getCurrentUser();
        if (currentUser) {
            const firstName = currentUser.fullname.split(' ')[0];
            const profileName = document.getElementById('profileName');
            if (profileName) profileName.innerHTML = `${firstName} <i class="bi bi-chevron-down"></i>`;
            const profileAvatar = document.getElementById('profileAvatar');
            if (profileAvatar && currentUser.profilePicture) profileAvatar.src = currentUser.profilePicture;
        }
    }

    async function fetchUserData() {
        try {
            const userId = AuthGuard.getUserId();
            if (userId) {
                const res = await fetch(`/user/${userId}`);
                if (res.ok) {
                    const userData = await res.json();
                    AuthGuard.storeUserSession(userData);
                    updateProfileInfo();
                }
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }

    updateProfileInfo();
    fetchUserData();

    // ==================== DATA LOADING ====================

    async function loadAllData() {
        try {
            showLoadingState(true);
            await Promise.all([loadStudents(), loadSchedules(), loadSections(), loadRooms()]);
            updateStatistics();
            populateSectionFilter();
            populateAddStudentSections();
            applyFiltersAndRender();
            showLoadingState(false);
        } catch (error) {
            console.error('Error loading data:', error);
            showBubbleMessage('Error loading student data', 'error');
            showLoadingState(false);
        }
    }

    async function loadStudents() {
        try {
            // Add cache-busting parameter to ensure fresh data
            const res = await fetch(`/users/students?_t=${Date.now()}`, {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            if (res.ok) {
                const fetchedStudents = await res.json();
                // Filter out any null or invalid entries
                students = fetchedStudents.filter(s => s && s._id);
                console.log(`✅ Loaded ${students.length} students from server`);
            } else {
                console.error('Failed to load students:', res.status);
                students = [];
            }
        } catch (error) {
            console.error('Error loading students:', error);
            students = [];
        }
    }

    async function loadSchedules() {
        try {
            const res = await fetch('/schedules');
            if (res.ok) schedules = await res.json();
        } catch (error) {
            schedules = [];
        }
    }

    async function loadSections() {
        try {
            const res = await fetch('/sections');
            if (res.ok) sections = await res.json();
        } catch (error) {
            sections = [];
        }
    }

    async function loadRooms() {
        try {
            const res = await fetch('/rooms');
            if (res.ok) rooms = await res.json();
        } catch (error) {
            rooms = [];
        }
    }

    // ==================== STATISTICS ====================

    function updateStatistics() {
        const totalStudents = students.length;
        const activeStudents = students.filter(s => getStudentStatus(s) === 'active').length;
        const totalSections = sections.length;

        const totalEl = document.getElementById('totalStudents');
        const activeEl = document.getElementById('activeStudents');
        const sectionsEl = document.getElementById('enrolledSections');
        
        if (totalEl) totalEl.textContent = totalStudents;
        if (activeEl) activeEl.textContent = activeStudents;
        if (sectionsEl) sectionsEl.textContent = totalSections;
    }

    // ==================== FILTERS & DROPDOWNS ====================

    function populateSectionFilter() {
        const select = document.getElementById('sectionFilter');
        if (!select) return;
        select.innerHTML = '<option value="">All Sections</option>';
        sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section.sectionName;
            option.textContent = section.sectionName;
            select.appendChild(option);
        });
    }

    function populateAddStudentSections(filterYearLevel = null) {
        const addSelect = document.getElementById('addSection');
        const editSelect = document.getElementById('editSection');
        
        [addSelect, editSelect].forEach(select => {
            if (!select) return;
            const currentValue = select.value; // Preserve current selection if possible
            select.innerHTML = '<option value="">Select Section</option>';
            
            // Filter sections by year level if specified
            const filteredSections = filterYearLevel 
                ? sections.filter(s => s.yearLevel === parseInt(filterYearLevel))
                : sections;
            
            filteredSections.forEach(section => {
                const option = document.createElement('option');
                option.value = section.sectionName;
                option.textContent = `${section.sectionName} (Year ${section.yearLevel})`;
                option.setAttribute('data-year-level', section.yearLevel);
                select.appendChild(option);
            });
            
            // Restore selection if it still exists in filtered list
            if (currentValue && filteredSections.some(s => s.sectionName === currentValue)) {
                select.value = currentValue;
            }
        });
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
            populateAddStudentSections(yearLevel);
            console.log(`✅ Filtered sections for Year Level: ${yearLevel}`);
        } else {
            populateAddStudentSections(); // Show all sections
        }
    }

    // ==================== HELPER FUNCTIONS ====================

    // Status is automatically determined - active if student has section with schedules
    function getStudentStatus(student) {
        if (!student.section) return 'inactive';
        const hasSchedules = schedules.some(s => s.section?.sectionName === student.section);
        return hasSchedules ? 'active' : 'inactive';
    }

    function getYearLevel(student) {
        if (student.yearLevel) return `Year ${student.yearLevel}`;
        if (student.section) {
            const section = sections.find(s => s.sectionName === student.section);
            if (section?.yearLevel) return `Year ${section.yearLevel}`;
            const match = student.section.match(/\b(\d+)/);
            if (match) return `Year ${match[1]}`;
        }
        return 'N/A';
    }

    function safeDisplay(data, fallback = 'N/A') {
        if (data === null || data === undefined || data === '') return fallback;
        if (typeof data === 'string' && data.trim() === '') return fallback;
        return data;
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

    // ==================== VALIDATION ====================

    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function validateCtuid(ctuid) {
        return /^[A-Za-z0-9-]{6,15}$/.test(ctuid);
    }

    function validateFullName(name) {
        return name && name.trim().length >= 2;
    }

    function validateBirthdate(date) {
        if (!date) return true;
        const birthDate = new Date(date);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        return age >= 15 && age <= 100;
    }

    function checkDuplicateCtuid(ctuid, excludeId = null) {
        return students.some(s => s.ctuid?.toLowerCase() === ctuid.toLowerCase() && s._id !== excludeId);
    }

    function checkDuplicateEmail(email, excludeId = null) {
        return students.some(s => s.email?.toLowerCase() === email.toLowerCase() && s._id !== excludeId);
    }

    function showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        field.classList.add('error');
        field.setAttribute('aria-invalid', 'true');
        let errorEl = field.parentElement.querySelector('.field-error');
        if (!errorEl) {
            errorEl = document.createElement('span');
            errorEl.className = 'field-error';
            errorEl.setAttribute('role', 'alert');
            field.parentElement.appendChild(errorEl);
        }
        errorEl.textContent = message;
    }

    function clearAllErrors(formId) {
        const form = document.getElementById(formId);
        if (!form) return;
        form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        form.querySelectorAll('.field-error').forEach(el => el.remove());
        form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    }

    // ==================== FILTERING & PAGINATION ====================

    function getFilteredStudents() {
        const searchTerm = document.getElementById('studentSearch')?.value.toLowerCase() || '';
        const yearLevelFilter = document.getElementById('yearLevelFilter')?.value || '';
        const sectionFilter = document.getElementById('sectionFilter')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';

        return students.filter(student => {
            const matchesSearch = !searchTerm || 
                student.fullname?.toLowerCase().includes(searchTerm) ||
                student.email?.toLowerCase().includes(searchTerm) ||
                student.ctuid?.toLowerCase().includes(searchTerm);

            const yearLevel = student.yearLevel || 
                (student.section ? sections.find(s => s.sectionName === student.section)?.yearLevel : null);
            const matchesYear = !yearLevelFilter || String(yearLevel) === yearLevelFilter;
            const matchesSection = !sectionFilter || student.section === sectionFilter;
            const status = getStudentStatus(student);
            const matchesStatus = !statusFilter || status === statusFilter;

            return matchesSearch && matchesYear && matchesSection && matchesStatus;
        });
    }

    function applyFiltersAndRender() {
        filteredStudents = getFilteredStudents();
        currentPage = 1;
        renderStudentsTable();
        renderPagination();
    }

    function renderStudentsTable() {
        const tbody = document.getElementById('studentsTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (filteredStudents.length === 0) {
            showEmptyState(true);
            updatePaginationInfo(0, 0, 0);
            return;
        }

        showEmptyState(false);

        const startIndex = (currentPage - 1) * STUDENTS_PER_PAGE;
        const endIndex = Math.min(startIndex + STUDENTS_PER_PAGE, filteredStudents.length);
        const studentsToShow = filteredStudents.slice(startIndex, endIndex);

        studentsToShow.forEach(student => {
            // Validate student data before rendering
            if (!student || !student._id) {
                console.warn('⚠️ Skipping invalid student data:', student);
                return;
            }
            
            const status = getStudentStatus(student);
            const yearLevel = getYearLevel(student);

            const row = document.createElement('tr');
            row.setAttribute('tabindex', '0');
            row.setAttribute('role', 'row');
            row.setAttribute('data-student-id', student._id);
            row.innerHTML = `
                <td>${escapeHtml(safeDisplay(student.fullname))}</td>
                <td>${escapeHtml(safeDisplay(student.email))}</td>
                <td>${escapeHtml(safeDisplay(student.ctuid, 'No ID'))}</td>
                <td>${escapeHtml(safeDisplay(student.section, 'Not Assigned'))}</td>
                <td>${yearLevel}</td>
                <td>${capitalizeFirst(safeDisplay(student.gender, 'Not Specified'))}</td>
                <td><span class="status-badge status-${status}" role="status">${status}</span></td>
                <td>
                    <div class="action-buttons" role="group" aria-label="Student actions">
                        <button class="btn-view" onclick="openStudentSchedule('${student._id}')" aria-label="View schedule">
                            <i class="bi bi-calendar" aria-hidden="true"></i> Schedule
                        </button>
                        <button class="btn-edit" onclick="openEditStudent('${student._id}')" aria-label="Edit student">
                            <i class="bi bi-pencil" aria-hidden="true"></i>
                        </button>
                        <button class="btn-delete" onclick="openDeleteStudent('${student._id}')" aria-label="Delete student">
                            <i class="bi bi-trash" aria-hidden="true"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        updatePaginationInfo(startIndex + 1, endIndex, filteredStudents.length);
    }

    // ==================== PAGINATION ====================

    function renderPagination() {
        const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
        const paginationControls = document.getElementById('paginationControls');
        const paginationPages = document.getElementById('paginationPages');
        
        if (!paginationControls || !paginationPages) return;

        if (totalPages <= 1) {
            paginationControls.style.display = 'none';
            return;
        }

        paginationControls.style.display = 'flex';
        paginationPages.innerHTML = '';

        document.getElementById('prevPageBtn').disabled = currentPage === 1;

        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            paginationPages.appendChild(createPageButton(1));
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                paginationPages.appendChild(ellipsis);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationPages.appendChild(createPageButton(i));
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                paginationPages.appendChild(ellipsis);
            }
            paginationPages.appendChild(createPageButton(totalPages));
        }

        document.getElementById('nextPageBtn').disabled = currentPage === totalPages;
    }

    function createPageButton(pageNum) {
        const btn = document.createElement('button');
        btn.className = `pagination-page ${pageNum === currentPage ? 'active' : ''}`;
        btn.textContent = pageNum;
        btn.onclick = () => goToPage(pageNum);
        return btn;
    }

    function goToPage(page) {
        const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
        if (page < 1 || page > totalPages) return;
        currentPage = page;
        renderStudentsTable();
        renderPagination();
        document.querySelector('.students-table-container')?.scrollIntoView({ behavior: 'smooth' });
    }

    function updatePaginationInfo(start, end, total) {
        const paginationText = document.getElementById('paginationText');
        if (paginationText) {
            paginationText.textContent = total > 0 ? `Showing ${start} to ${end} of ${total} students` : 'No students found';
        }
    }

    document.getElementById('prevPageBtn')?.addEventListener('click', () => goToPage(currentPage - 1));
    document.getElementById('nextPageBtn')?.addEventListener('click', () => goToPage(currentPage + 1));

    // ==================== ADD STUDENT ====================

    document.getElementById('addStudentBtn')?.addEventListener('click', openAddStudentModal);

    function openAddStudentModal() {
        const modal = document.getElementById('addStudentModal');
        if (!modal) return;

        document.getElementById('addStudentForm')?.reset();
        document.getElementById('addProfilePreview')?.setAttribute('src', './img/default_student_avatar.png');
        clearAllErrors('addStudentForm');
        populateAddStudentSections();
        
        // Setup smart auto-fill listeners for Add Student form (no room field in add form)
        setupSectionYearLevelSync('addSection', 'addYearLevel', null);

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('addFullName')?.focus(), 100);
    }
    
    // Setup bidirectional sync between Section, Year Level, and Room dropdowns
    function setupSectionYearLevelSync(sectionSelectId, yearLevelSelectId, roomSelectId) {
        const sectionSelect = document.getElementById(sectionSelectId);
        const yearLevelSelect = document.getElementById(yearLevelSelectId);
        const roomSelect = roomSelectId ? document.getElementById(roomSelectId) : null;
        
        if (!sectionSelect || !yearLevelSelect) return;
        
        // Remove existing listeners to avoid duplicates
        const newSectionSelect = sectionSelect.cloneNode(true);
        const newYearLevelSelect = yearLevelSelect.cloneNode(true);
        const newRoomSelect = roomSelect ? roomSelect.cloneNode(true) : null;
        
        sectionSelect.parentNode.replaceChild(newSectionSelect, sectionSelect);
        yearLevelSelect.parentNode.replaceChild(newYearLevelSelect, yearLevelSelect);
        if (roomSelect && newRoomSelect) {
            roomSelect.parentNode.replaceChild(newRoomSelect, roomSelect);
        }
        
        // When section changes, auto-fill year level AND room
        newSectionSelect.addEventListener('change', function() {
            const selectedSection = this.value;
            
            if (selectedSection) {
                // Auto-fill year level
                autoFillYearLevelFromSection(selectedSection, yearLevelSelectId);
                
                // Auto-fill room based on section
                if (newRoomSelect) {
                    const sectionObj = sections.find(s => s.sectionName === selectedSection);
                    if (sectionObj) {
                        // Find room where this section is assigned (day or night shift)
                        const assignedRoom = rooms.find(room => 
                            room.daySection === selectedSection || 
                            room.nightSection === selectedSection
                        );
                        
                        if (assignedRoom) {
                            newRoomSelect.value = assignedRoom.roomName;
                            console.log(`✅ Auto-filled Room: ${assignedRoom.roomName} for Section: ${selectedSection}`);
                        } else {
                            console.log(`⚠️ No room found for Section: ${selectedSection}`);
                            newRoomSelect.value = '';
                        }
                    }
                }
            }
        });
        
        // When year level changes, filter sections
        newYearLevelSelect.addEventListener('change', function() {
            filterSectionsByYearLevel(this.value, sectionSelectId);
        });
    }

    function closeAddStudentModal() {
        const modal = document.getElementById('addStudentModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    document.getElementById('closeAddStudentModal')?.addEventListener('click', closeAddStudentModal);
    document.getElementById('cancelAddStudent')?.addEventListener('click', closeAddStudentModal);

    // Profile picture preview
    document.getElementById('addProfilePicture')?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showBubbleMessage('Please select an image file', 'error');
            e.target.value = '';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showBubbleMessage('Image must be less than 5MB', 'error');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => document.getElementById('addProfilePreview').src = event.target.result;
        reader.readAsDataURL(file);
    });

    // Add student form submission
    document.getElementById('addStudentForm')?.addEventListener('submit', async function(e) {
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

        if (!validateFullName(fullname)) {
            showFieldError('addFullName', 'Full name must be at least 2 characters');
            hasErrors = true;
        }
        if (!validateEmail(email)) {
            showFieldError('addEmail', 'Please enter a valid email address');
            hasErrors = true;
        } else if (checkDuplicateEmail(email)) {
            showFieldError('addEmail', 'This email is already registered');
            hasErrors = true;
        }
        if (!validateCtuid(ctuid)) {
            showFieldError('addCtuid', 'CTU ID must be 6-15 alphanumeric characters');
            hasErrors = true;
        } else if (checkDuplicateCtuid(ctuid)) {
            showFieldError('addCtuid', 'This CTU ID is already registered');
            hasErrors = true;
        }
        if (!validateBirthdate(birthdate)) {
            showFieldError('addBirthdate', 'Student must be between 15 and 100 years old');
            hasErrors = true;
        }

        if (hasErrors) {
            showBubbleMessage('Please fix the errors in the form', 'error');
            return;
        }

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
            showLoadingState(true);
            
            const res = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registerData)
            });

            const result = await res.json();

            if (res.ok) {
                // Upload profile picture if selected
                if (profilePictureInput?.files[0] && result.user?._id) {
                    const formData = new FormData();
                    formData.append('profilePicture', profilePictureInput.files[0]);
                    try {
                        await fetch(`/upload-profile-picture/${result.user._id}`, { method: 'POST', body: formData });
                    } catch (uploadError) {
                        console.warn('Profile picture upload failed:', uploadError);
                    }
                }
                
                showBubbleMessage('Student added successfully!', 'success');
                closeAddStudentModal();
                
                // Reload data and refresh table immediately
                await loadStudents();
                await loadSchedules();
                updateStatistics();
                applyFiltersAndRender();
            } else {
                showBubbleMessage(result.error || 'Failed to add student', 'error');
            }
        } catch (error) {
            console.error('Error adding student:', error);
            showBubbleMessage('Failed to add student. Please try again.', 'error');
        } finally {
            showLoadingState(false);
        }
    });

    // ==================== EDIT STUDENT ====================

    window.openEditStudent = function(studentId) {
        const student = students.find(s => s && s._id === studentId);
        if (!student || !student._id) {
            console.error('❌ Student not found or invalid:', studentId);
            showBubbleMessage('Student not found. The data may be outdated. Refreshing...', 'error');
            // Reload data to ensure consistency
            loadAllData();
            return;
        }

        currentStudentId = studentId;
        clearAllErrors('editStudentForm');

        document.getElementById('editFullName').value = student.fullname || '';
        document.getElementById('editEmail').value = student.email || '';
        document.getElementById('editCtuid').value = student.ctuid || '';
        document.getElementById('editBirthdate').value = student.birthdate || '';
        document.getElementById('editGender').value = student.gender || '';
        
        // Set year level first
        const editYearLevel = document.getElementById('editYearLevel');
        if (editYearLevel) {
            editYearLevel.value = student.yearLevel || '';
        }

        // Populate Section dropdown (filter by year level if available)
        const studentYearLevel = student.yearLevel || extractYearLevelFromSection(student.section);
        populateAddStudentSections(studentYearLevel);
        
        // Set section value after populating
        const editSection = document.getElementById('editSection');
        if (editSection && student.section) {
            editSection.value = student.section;
        }

        // Populate Room dropdown
        const editRoom = document.getElementById('editRoom');
        if (editRoom) {
            editRoom.innerHTML = '<option value="">No Room Assigned</option>';
            rooms.forEach(room => {
                const option = document.createElement('option');
                option.value = room.roomName;
                option.textContent = `${room.roomName} (${room.building})`;
                editRoom.appendChild(option);
            });
            editRoom.value = student.room || '';
        }

        document.getElementById('editStudentModalTitle').textContent = `Edit ${safeDisplay(student.fullname)}`;
        
        // Show and populate the student info display
        const infoDisplay = document.getElementById('studentInfoDisplay');
        if (infoDisplay && student.section) {
            infoDisplay.style.display = 'block';
            
            // Find the section object to get details
            const sectionObj = sections.find(s => s.sectionName === student.section);
            
            // Populate Year Level
            const yearLevelEl = document.getElementById('displayStudentYearLevel');
            if (yearLevelEl) {
                const yearLevel = student.yearLevel || sectionObj?.yearLevel || extractYearLevelFromSection(student.section);
                yearLevelEl.textContent = yearLevel ? `Year ${yearLevel}` : 'N/A';
            }
            
            // Populate Class Section
            const sectionEl = document.getElementById('displayStudentSection');
            if (sectionEl) {
                const shift = sectionObj?.shift || '';
                sectionEl.textContent = shift ? `${student.section} (${shift} Shift)` : student.section;
            }
            
            // Populate Assigned Room
            const roomEl = document.getElementById('displayStudentRoom');
            if (roomEl) {
                if (student.room) {
                    const roomObj = rooms.find(r => r.roomName === student.room);
                    const roomType = roomObj?.roomType || '';
                    roomEl.textContent = roomType ? `${student.room} (${roomType})` : student.room;
                } else {
                    roomEl.textContent = 'No Room Assigned';
                }
            }
            
            // Populate Building
            const buildingEl = document.getElementById('displayStudentBuilding');
            if (buildingEl) {
                if (student.room) {
                    const roomObj = rooms.find(r => r.roomName === student.room);
                    const building = roomObj?.building || 'N/A';
                    buildingEl.textContent = building;
                } else {
                    buildingEl.textContent = 'N/A';
                }
            }
            
            console.log('✅ Student info display populated:', {
                yearLevel: student.yearLevel,
                section: student.section,
                room: student.room
            });
        } else if (infoDisplay) {
            // Hide if student has no section
            infoDisplay.style.display = 'none';
        }
        
        // Setup smart auto-fill listeners for Edit Student form (includes room auto-fill)
        setupSectionYearLevelSync('editSection', 'editYearLevel', 'editRoom');

        const modal = document.getElementById('editStudentModal');
        if (modal) modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Log the dropdown values to verify they're set
        console.log('✅ Edit Student Modal Opened:', {
            studentId: studentId,
            name: student.fullname,
            yearLevel: editYearLevel?.value,
            section: editSection?.value,
            room: editRoom?.value
        });
    };

    // Edit student form submission
    document.getElementById('editStudentForm')?.addEventListener('submit', async function(e) {
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
        const room = document.getElementById('editRoom')?.value;

        let hasErrors = false;

        if (!validateFullName(fullname)) {
            showFieldError('editFullName', 'Full name must be at least 2 characters');
            hasErrors = true;
        }
        if (!validateEmail(email)) {
            showFieldError('editEmail', 'Please enter a valid email address');
            hasErrors = true;
        } else if (checkDuplicateEmail(email, currentStudentId)) {
            showFieldError('editEmail', 'This email is already registered');
            hasErrors = true;
        }
        if (!validateCtuid(ctuid)) {
            showFieldError('editCtuid', 'CTU ID must be 6-15 alphanumeric characters');
            hasErrors = true;
        } else if (checkDuplicateCtuid(ctuid, currentStudentId)) {
            showFieldError('editCtuid', 'This CTU ID is already registered');
            hasErrors = true;
        }
        if (!validateBirthdate(birthdate)) {
            showFieldError('editBirthdate', 'Student must be between 15 and 100 years old');
            hasErrors = true;
        }

        if (hasErrors) {
            showBubbleMessage('Please fix the errors in the form', 'error');
            return;
        }

        const formData = { fullname, email, ctuid, birthdate, gender, section, yearLevel, room };

        try {
            showLoadingState(true);
            
            const res = await fetch(`/user/${currentStudentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                const updatedData = await res.json();
                showBubbleMessage('Student updated successfully!', 'success');
                document.getElementById('editStudentModal').style.display = 'none';
                document.body.style.overflow = 'auto';
                
                // Update the student in the local array immediately
                const studentIndex = students.findIndex(s => s._id === currentStudentId);
                if (studentIndex !== -1) {
                    students[studentIndex] = { ...students[studentIndex], ...updatedData.user };
                }
                
                // Reload schedules and refresh table immediately
                await loadSchedules();
                updateStatistics();
                applyFiltersAndRender();
            } else {
                const error = await res.json();
                showBubbleMessage(error.error || 'Failed to update student', 'error');
            }
        } catch (error) {
            console.error('Error updating student:', error);
            showBubbleMessage('Failed to update student', 'error');
        } finally {
            showLoadingState(false);
        }
    });

    // ==================== DELETE STUDENT ====================

    window.openDeleteStudent = function(studentId) {
        const student = students.find(s => s && s._id === studentId);
        if (!student || !student._id) {
            console.error('❌ Student not found or invalid:', studentId);
            showBubbleMessage('Student not found. The data may be outdated. Refreshing...', 'error');
            // Reload data to ensure consistency
            loadAllData();
            return;
        }

        studentToDelete = student;
        document.getElementById('deleteConfirmationText').textContent = 
            `Are you sure you want to delete ${safeDisplay(student.fullname)}? This action cannot be undone.`;

        document.getElementById('deleteStudentModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    document.getElementById('confirmDeleteStudent')?.addEventListener('click', async function() {
        if (!studentToDelete) return;

        try {
            showLoadingState(true);
            
            const deletedId = studentToDelete._id;
            const deletedName = studentToDelete.fullname;
            
            console.log(`🗑️ Attempting to delete student: ${deletedName} (ID: ${deletedId})`);
            
            const res = await fetch(`/user/${deletedId}`, { 
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (res.ok) {
                console.log(`✅ Student deleted successfully: ${deletedName}`);
                showBubbleMessage('Student deleted successfully!', 'success');
                
                // Close modal first
                document.getElementById('deleteStudentModal').style.display = 'none';
                document.body.style.overflow = 'auto';
                
                // Clear the studentToDelete reference
                studentToDelete = null;
                
                // Force reload fresh data from server to ensure consistency
                await loadStudents();
                await loadSchedules();
                
                // Update statistics and refresh table
                updateStatistics();
                applyFiltersAndRender();
            } else {
                const error = await res.json();
                console.error(`❌ Failed to delete student: ${error.error}`);
                showBubbleMessage(error.error || 'Failed to delete student', 'error');
            }
        } catch (error) {
            console.error('Error deleting student:', error);
            showBubbleMessage('Failed to delete student. Please try again.', 'error');
        } finally {
            showLoadingState(false);
        }
    });

    // ==================== SCHEDULE VIEWING ====================

    window.openStudentSchedule = function(studentId) {
        currentStudentId = studentId;
        const student = students.find(s => s._id === studentId);
        
        if (!student) {
            showBubbleMessage('Student not found', 'error');
            return;
        }

        document.getElementById('modalStudentName').textContent = safeDisplay(student.fullname);
        document.getElementById('modalStudentEmail').textContent = safeDisplay(student.email);
        document.getElementById('modalStudentId').textContent = `CTU ID: ${safeDisplay(student.ctuid, 'No ID')}`;
        document.getElementById('modalStudentSection').textContent = `Section: ${safeDisplay(student.section, 'Not Assigned')}`;
        document.getElementById('studentScheduleTitle').textContent = `${safeDisplay(student.fullname)}'s Class Schedule`;

        const avatar = document.getElementById('modalStudentAvatar');
        if (avatar) avatar.src = student.profilePicture || '/img/default_student_avatar.png';

        renderStudentSchedule(student);
        
        document.getElementById('studentScheduleModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };

    function getStudentSchedules(student) {
        if (!student?.section) return [];
        const studentSection = sections.find(s => s.sectionName === student.section);
        if (!studentSection) return [];
        return schedules.filter(schedule => {
            const scheduleSectionId = schedule.section?._id || schedule.section;
            return scheduleSectionId?.toString() === studentSection._id?.toString();
        });
    }

    function renderStudentSchedule(student) {
        const studentSchedules = getStudentSchedules(student);
        calculateScheduleStatistics(studentSchedules);
        if (currentView === 'weekly') {
            renderWeeklySchedule(studentSchedules);
        } else {
            renderDailySchedule(studentSchedules);
        }
    }

    function calculateScheduleStatistics(studentSchedules) {
        let lectureHours = 0, labHours = 0;
        studentSchedules.forEach(schedule => {
            const duration = calculateScheduleDuration(schedule);
            if (schedule.scheduleType === 'lecture') lectureHours += duration;
            else if (schedule.scheduleType === 'lab') labHours += duration;
        });
        document.getElementById('lectureCount').textContent = lectureHours.toFixed(1);
        document.getElementById('labCount').textContent = labHours.toFixed(1);
        document.getElementById('totalHours').textContent = (lectureHours + labHours).toFixed(1);
    }

    function calculateScheduleDuration(schedule) {
        let [startH, startM] = schedule.startTime.split(':').map(Number);
        let [endH, endM] = schedule.endTime.split(':').map(Number);
        if (schedule.startPeriod === 'PM' && startH !== 12) startH += 12;
        if (schedule.startPeriod === 'AM' && startH === 12) startH = 0;
        if (schedule.endPeriod === 'PM' && endH !== 12) endH += 12;
        if (schedule.endPeriod === 'AM' && endH === 12) endH = 0;
        return ((endH * 60 + endM) - (startH * 60 + startM)) / 60;
    }

    function renderWeeklySchedule(studentSchedules) {
        const weeklyGrid = document.getElementById('weeklyGrid');
        if (!weeklyGrid) return;
        weeklyGrid.innerHTML = '';
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        days.forEach(day => {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'weekly-day';
            dayDiv.innerHTML = `<h5>${day}</h5>`;

            const daySchedules = studentSchedules
                .filter(s => s.day === day && (currentShift === 'all' || s.section?.shift?.toLowerCase() === currentShift))
                .sort((a, b) => {
                    let aStart = parseInt(a.startTime.replace(':', ''));
                    if (a.startPeriod === 'PM' && aStart < 1200) aStart += 1200;
                    let bStart = parseInt(b.startTime.replace(':', ''));
                    if (b.startPeriod === 'PM' && bStart < 1200) bStart += 1200;
                    return aStart - bStart;
                });

            if (daySchedules.length === 0) {
                dayDiv.innerHTML += '<div class="empty-schedule"><small>No classes</small></div>';
            } else {
                daySchedules.forEach(schedule => {
                    const item = document.createElement('div');
                    item.className = `schedule-item-small ${schedule.scheduleType}`;
                    item.innerHTML = `
                        <div><strong>${escapeHtml(schedule.subject?.courseCode || 'N/A')}</strong></div>
                        <div>${escapeHtml(schedule.teacher?.fullname || 'TBA')}</div>
                        <div>${escapeHtml(schedule.room?.roomName || 'TBA')}</div>
                        <div><small>${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}</small></div>
                    `;
                    dayDiv.appendChild(item);
                });
            }
            weeklyGrid.appendChild(dayDiv);
        });
    }

    function renderDailySchedule(studentSchedules) {
        const dailySchedule = document.getElementById('dailySchedule');
        if (!dailySchedule) return;
        dailySchedule.innerHTML = '';
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[currentDayIndex];
        
        document.getElementById('currentDayDisplay').textContent = currentDay;

        const daySchedules = studentSchedules
            .filter(s => s.day === currentDay && (currentShift === 'all' || s.section?.shift?.toLowerCase() === currentShift))
            .sort((a, b) => {
                let aStart = parseInt(a.startTime.replace(':', ''));
                if (a.startPeriod === 'PM' && aStart < 1200) aStart += 1200;
                let bStart = parseInt(b.startTime.replace(':', ''));
                if (b.startPeriod === 'PM' && bStart < 1200) bStart += 1200;
                return aStart - bStart;
            });

        if (daySchedules.length === 0) {
            dailySchedule.innerHTML = `<div class="empty-schedule"><i class="bi bi-calendar-x"></i><p>No classes for ${currentDay}</p></div>`;
            return;
        }

        daySchedules.forEach(schedule => {
            const item = document.createElement('div');
            item.className = `daily-schedule-item ${schedule.scheduleType}`;
            item.innerHTML = `
                <div class="schedule-time">${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}</div>
                <div class="schedule-details">
                    <div class="schedule-subject">${escapeHtml(schedule.subject?.courseCode || 'N/A')} - ${escapeHtml(schedule.subject?.descriptiveTitle || '')}</div>
                    <div class="schedule-meta">${escapeHtml(schedule.teacher?.fullname || 'TBA')} • ${escapeHtml(schedule.room?.roomName || 'TBA')} • ${capitalizeFirst(schedule.scheduleType)}</div>
                </div>
            `;
            dailySchedule.appendChild(item);
        });
    }

    // ==================== MODAL CONTROLS ====================

    document.getElementById('closeStudentScheduleModal')?.addEventListener('click', () => {
        document.getElementById('studentScheduleModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    document.getElementById('closeEditStudentModal')?.addEventListener('click', () => {
        document.getElementById('editStudentModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    document.getElementById('cancelEditStudent')?.addEventListener('click', () => {
        document.getElementById('editStudentModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    document.getElementById('closeDeleteStudentModal')?.addEventListener('click', () => {
        document.getElementById('deleteStudentModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    document.getElementById('cancelDeleteStudent')?.addEventListener('click', () => {
        document.getElementById('deleteStudentModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    // Close modals when clicking outside
    ['studentScheduleModal', 'editStudentModal', 'deleteStudentModal', 'addStudentModal'].forEach(modalId => {
        document.getElementById(modalId)?.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    });

    // Keyboard - close modals on Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            ['studentScheduleModal', 'editStudentModal', 'deleteStudentModal', 'addStudentModal'].forEach(modalId => {
                const modal = document.getElementById(modalId);
                if (modal && modal.style.display === 'flex') {
                    modal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                }
            });
        }
    });

    // View toggle
    document.getElementById('scheduleViewSelect')?.addEventListener('change', function() {
        currentView = this.value;
        const weeklyView = document.getElementById('weeklyScheduleView');
        const dailyView = document.getElementById('dailyScheduleView');
        if (currentView === 'weekly') {
            weeklyView.style.display = 'block';
            dailyView.style.display = 'none';
        } else {
            weeklyView.style.display = 'none';
            dailyView.style.display = 'block';
        }
        if (currentStudentId) {
            const student = students.find(s => s._id === currentStudentId);
            if (student) renderStudentSchedule(student);
        }
    });

    // Shift toggle
    document.querySelectorAll('.shift-btn-small').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.shift-btn-small').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentShift = this.dataset.shift;
            if (currentStudentId) {
                const student = students.find(s => s._id === currentStudentId);
                if (student) renderStudentSchedule(student);
            }
        });
    });

    // Daily navigation
    document.getElementById('prevDayBtn')?.addEventListener('click', () => {
        currentDayIndex = (currentDayIndex - 1 + 6) % 6;
        if (currentStudentId) {
            const student = students.find(s => s._id === currentStudentId);
            if (student) renderStudentSchedule(student);
        }
    });

    document.getElementById('nextDayBtn')?.addEventListener('click', () => {
        currentDayIndex = (currentDayIndex + 1) % 6;
        if (currentStudentId) {
            const student = students.find(s => s._id === currentStudentId);
            if (student) renderStudentSchedule(student);
        }
    });

    // ==================== FILTER LISTENERS ====================

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    const debouncedFilter = debounce(applyFiltersAndRender, 300);

    document.getElementById('studentSearch')?.addEventListener('input', debouncedFilter);
    document.getElementById('yearLevelFilter')?.addEventListener('change', applyFiltersAndRender);
    document.getElementById('sectionFilter')?.addEventListener('change', applyFiltersAndRender);
    document.getElementById('statusFilter')?.addEventListener('change', applyFiltersAndRender);

    // ==================== UI HELPERS ====================

    function showLoadingState(show) {
        const loadingState = document.getElementById('loadingState');
        const tableContainer = document.querySelector('.students-table-container');
        if (loadingState) loadingState.style.display = show ? 'block' : 'none';
        if (tableContainer) tableContainer.style.display = show ? 'none' : 'block';
    }

    function showEmptyState(show) {
        const emptyState = document.getElementById('emptyState');
        const tableContainer = document.querySelector('.students-table-container');
        const paginationControls = document.getElementById('paginationControls');
        
        if (emptyState) emptyState.style.display = show ? 'block' : 'none';
        if (tableContainer) tableContainer.style.display = show ? 'none' : 'block';
        if (paginationControls) paginationControls.style.display = show ? 'none' : 'flex';
    }

    function showBubbleMessage(msg, type = "success") {
        const bubble = document.getElementById('studentBubbleMessage');
        if (!bubble) return;
        bubble.textContent = msg;
        bubble.className = "section-bubble-message";
        bubble.classList.add(type);
        bubble.setAttribute('role', 'alert');
        void bubble.offsetWidth;
        bubble.classList.add("show");
        setTimeout(() => bubble.classList.remove("show"), 3000);
    }

    // ==================== INITIALIZE ====================
    loadAllData();
});
