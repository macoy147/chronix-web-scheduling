 import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';
import AuthGuard from './auth-guard.js';




document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    if (!AuthGuard.checkAuthentication('admin')) {
        return;
    }

    // Skip desktop initialization if on mobile page
    if (window.location.pathname.includes('-mobile')) {
        console.log('Mobile page detected, skipping desktop sections.js initialization');
        return;
    }

    // State management
    let sections = [];
    let teachers = [];
    let editingSectionId = null;
    let editMode = false;
    let activeFilters = {
        yearLevel: null,
        shift: null,
        status: null,
        program: null,
        adviser: null
    };

    // Profile dropdown
    const profileDropdown = document.querySelector('.admin-profile-dropdown');
    if (profileDropdown) {
        profileDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
            profileDropdown.classList.toggle('open');
        });
        document.addEventListener('click', function() {
            profileDropdown.classList.remove('open');
        });
    }

    // Logout functionality
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            AuthGuard.logout();
        });
    }

    // Update profile info
    function updateProfileInfo() {
        const currentUser = AuthGuard.getCurrentUser();
        if (currentUser) {
            const firstName = currentUser.fullname.split(' ')[0];
            const profileName = document.getElementById('profileName');
            if (profileName) {
                profileName.innerHTML = `${firstName} <i class="bi bi-chevron-down"></i>`;
            }
            const profileAvatar = document.getElementById('profileAvatar');
            if (profileAvatar && currentUser.profilePicture) {
                profileAvatar.src = currentUser.profilePicture.startsWith('http') 
                    ? currentUser.profilePicture 
                    : currentUser.profilePicture;
            }
        }
    }

    // Fetch user data
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

    // Initialize
    updateProfileInfo();
    fetchUserData();

    // Modal error display functions
    function showModalError(message) {
        const errorAlert = document.getElementById('sectionModalError');
        const errorText = document.getElementById('sectionModalErrorText');
        
        if (errorAlert && errorText) {
            errorText.textContent = message;
            errorAlert.style.display = 'flex';
            
            const modalContent = document.querySelector('#sectionModal .modal-content');
            if (modalContent) {
                modalContent.scrollTop = 0;
            }
        }
    }

    function hideModalError() {
        const errorAlert = document.getElementById('sectionModalError');
        if (errorAlert) {
            errorAlert.style.display = 'none';
        }
    }



    // Check if section name + program combination already exists
    function checkDuplicateSection(sectionName, programID, excludeId = null) {
        return sections.some(section => 
            section.sectionName.toLowerCase() === sectionName.toLowerCase() &&
            section.programID === programID &&
            (!excludeId || section._id !== excludeId)
        );
    }



    // Load all data
    async function loadAllData() {
        try {
            await Promise.all([
                loadSections(),
                loadTeachers()
            ]);
            updateStatistics();
            renderSectionsTable();
            populateAcademicYearDropdown();
            populateAdviserDropdown();
            setupSearchFunctionality();
            setupFilterDropdown();
            setupExportButton();
        } catch (error) {
            console.error('Error loading data:', error);
            showBubbleMessage('Error loading section data', 'error');
        }
    }

    // Update statistics cards
    function updateStatistics() {
        const total = sections.length;
        const active = sections.filter(s => s.status === 'Active').length;
        const archived = sections.filter(s => s.status === 'Archived').length;
        const noAdviser = sections.filter(s => !findAdviserForSection(s.sectionName) || findAdviserForSection(s.sectionName) === 'No Adviser').length;

        document.getElementById('totalSections').textContent = total;
        document.getElementById('activeSections').textContent = active;
        document.getElementById('archivedSections').textContent = archived;
        document.getElementById('noAdviserSections').textContent = noAdviser;
    }

    // Setup search functionality
    function setupSearchFunctionality() {
        const searchInput = document.getElementById('sectionsSearchInput');
        if (!searchInput) return;

        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterSections(searchTerm);
        });
    }

    // Filter sections based on search term
    function filterSections(searchTerm) {
        const tbody = document.getElementById('sectionsTableBody');
        if (!tbody) return;

        // If search is cleared and we have no data rows, re-render the table
        if (searchTerm === '' && sections.length > 0) {
            const dataRows = Array.from(tbody.getElementsByTagName('tr')).filter(row => row.cells.length > 1);
            if (dataRows.length === 0) {
                renderSectionsTable();
                return;
            }
        }

        const rows = tbody.getElementsByTagName('tr');
        let visibleCount = 0;
        let hasNoResultsRow = false;

        Array.from(rows).forEach(row => {
            // Check if this is a "no results" message row
            if (row.cells.length === 1) {
                hasNoResultsRow = true;
                return;
            }

            const sectionName = row.cells[0]?.textContent.toLowerCase() || '';
            const program = row.cells[1]?.textContent.toLowerCase() || '';
            const yearLevel = row.cells[2]?.textContent.toLowerCase() || '';
            const shift = row.cells[3]?.textContent.toLowerCase() || '';
            const adviser = row.cells[4]?.textContent.toLowerCase() || '';
            const academicYear = row.cells[6]?.textContent.toLowerCase() || '';

            const matches = sectionName.includes(searchTerm) ||
                          program.includes(searchTerm) ||
                          yearLevel.includes(searchTerm) ||
                          shift.includes(searchTerm) ||
                          adviser.includes(searchTerm) ||
                          academicYear.includes(searchTerm);

            if (matches || searchTerm === '') {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });

        // Remove existing "no results" row if it exists
        if (hasNoResultsRow) {
            const noResultsRow = Array.from(rows).find(row => row.cells.length === 1);
            if (noResultsRow) {
                noResultsRow.remove();
            }
        }

        // Show "no results" message if no sections match
        if (visibleCount === 0 && searchTerm !== '') {
            const noResultsRow = document.createElement('tr');
            noResultsRow.innerHTML = `
                <td colspan="9" style="text-align: center; padding: 48px 24px; color: #999; font-style: italic;">
                    No sections found matching "${searchTerm}". Try a different search term.
                </td>
            `;
            tbody.appendChild(noResultsRow);
        }
    }

    // Load sections
    async function loadSections() {
        try {
            const res = await fetch('/sections');
            if (res.ok) {
                sections = await res.json();
                console.log('Loaded sections:', sections);
            } else {
                console.error('Failed to load sections');
                sections = [];
            }
        } catch (error) {
            console.error('Error loading sections:', error);
            sections = [];
        }
    }

    // Load teachers to find advisers
    async function loadTeachers() {
        try {
            const res = await fetch('/teachers');
            if (res.ok) {
                teachers = await res.json();
                console.log('Loaded teachers for adviser lookup:', teachers);
            } else {
                console.error('Failed to load teachers');
                teachers = [];
            }
        } catch (error) {
            console.error('Error loading teachers:', error);
            teachers = [];
        }
    }

    // Find adviser for a section by matching teacher.section with section.sectionName
    function findAdviserForSection(sectionName) {
        const adviser = teachers.find(teacher => teacher.section === sectionName);
        return adviser ? adviser.fullname : 'No Adviser';
    }

    // Sync adviser assignment with teacher record
    async function syncAdviserWithTeacher(teacherId, sectionName) {
        try {
            await fetch(`/user/${teacherId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    section: sectionName
                })
            });
            console.log(`✅ Synced adviser: Teacher ${teacherId} assigned to section ${sectionName}`);
        } catch (error) {
            console.error('Error syncing adviser with teacher:', error);
        }
    }

    // Populate adviser dropdown with available teachers
    function populateAdviserDropdown() {
        const select = document.getElementById('adviserTeacherSelect');
        if (!select) return;
        
        // Clear existing options except the first one
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Get teachers without advisory (excluding current section if editing)
        const availableTeachers = teachers.filter(teacher => {
            const hasAdvisory = sections.some(section => {
                // Skip the section being edited
                if (editMode && section._id === editingSectionId) return false;
                return teacher.section === section.sectionName;
            });
            return !hasAdvisory;
        });
        
        availableTeachers.forEach(teacher => {
            const option = document.createElement('option');
            option.value = teacher._id;
            option.textContent = `${teacher.fullname} (${teacher.ctuid || 'No ID'})`;
            select.appendChild(option);
        });
        
        // Show count of available teachers
        const helperText = select.nextElementSibling;
        if (helperText && availableTeachers.length === 0) {
            helperText.innerHTML = '<i class="bi bi-info-circle"></i> No teachers available (all have advisory sections)';
            helperText.style.color = '#f57c00';
        } else if (helperText) {
            helperText.innerHTML = `<i class="bi bi-info-circle"></i> ${availableTeachers.length} teacher(s) available`;
            helperText.style.color = '#666';
        }
    }

    // Setup cascading filter dropdown
    function setupFilterDropdown() {
        const filterBtn = document.getElementById('filterBtn');
        const filterDropdown = document.getElementById('filterDropdown');
        const filterValuesDropdown = document.getElementById('filterValuesDropdown');
        
        if (!filterBtn || !filterDropdown) return;

        // Toggle main filter dropdown
        filterBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            filterDropdown.classList.toggle('show');
            filterValuesDropdown.classList.remove('show');
        });

        // Handle filter category selection
        const filterOptions = filterDropdown.querySelectorAll('.filter-option');
        filterOptions.forEach(option => {
            option.addEventListener('click', function(e) {
                e.stopPropagation();
                const filterType = this.dataset.filter;
                showFilterValues(filterType);
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.filter-dropdown-container')) {
                filterDropdown.classList.remove('show');
                filterValuesDropdown.classList.remove('show');
            }
        });
    }

    // Show filter values based on selected category
    function showFilterValues(filterType) {
        const filterValuesDropdown = document.getElementById('filterValuesDropdown');
        if (!filterValuesDropdown) return;

        let values = [];
        let labels = {};

        switch(filterType) {
            case 'yearLevel':
                values = ['1', '2', '3', '4'];
                labels = { '1': '1st Year', '2': '2nd Year', '3': '3rd Year', '4': '4th Year' };
                break;
            case 'shift':
                values = ['Day', 'Night'];
                labels = { 'Day': 'Day Shift', 'Night': 'Night Shift' };
                break;
            case 'status':
                values = ['Active', 'Archived'];
                labels = { 'Active': 'Active Sections', 'Archived': 'Archived Sections' };
                break;
            case 'program':
                values = [...new Set(sections.map(s => s.programID))].sort();
                values.forEach(v => labels[v] = v);
                break;
            case 'adviser':
                values = ['hasAdviser', 'noAdviser'];
                labels = { 'hasAdviser': 'Has Adviser', 'noAdviser': 'No Adviser' };
                break;
        }

        filterValuesDropdown.innerHTML = values.map(value => `
            <div class="filter-value-option ${activeFilters[filterType] === value ? 'selected' : ''}" 
                 data-filter-type="${filterType}" 
                 data-value="${value}">
                ${activeFilters[filterType] === value ? '<i class="bi bi-check-circle-fill"></i>' : ''}
                ${labels[value] || value}
            </div>
        `).join('');

        // Add event listeners to value options
        filterValuesDropdown.querySelectorAll('.filter-value-option').forEach(option => {
            option.addEventListener('click', function(e) {
                e.stopPropagation();
                const type = this.dataset.filterType;
                const value = this.dataset.value;
                applyFilter(type, value);
            });
        });

        filterValuesDropdown.classList.add('show');
    }

    // Apply filter
    function applyFilter(filterType, value) {
        // Toggle filter if clicking same value
        if (activeFilters[filterType] === value) {
            activeFilters[filterType] = null;
        } else {
            activeFilters[filterType] = value;
        }

        updateActiveFiltersDisplay();
        applyAllFilters();
        
        // Close dropdowns
        document.getElementById('filterDropdown').classList.remove('show');
        document.getElementById('filterValuesDropdown').classList.remove('show');
    }

    // Update active filters display
    function updateActiveFiltersDisplay() {
        const container = document.getElementById('activeFilters');
        if (!container) return;

        const filterLabels = {
            yearLevel: { '1': '1st Year', '2': '2nd Year', '3': '3rd Year', '4': '4th Year' },
            shift: { 'Day': 'Day', 'Night': 'Night' },
            status: { 'Active': 'Active', 'Archived': 'Archived' },
            adviser: { 'hasAdviser': 'Has Adviser', 'noAdviser': 'No Adviser' }
        };

        const activeTags = Object.entries(activeFilters)
            .filter(([key, value]) => value !== null)
            .map(([key, value]) => {
                const label = filterLabels[key]?.[value] || value;
                return `
                    <div class="filter-tag">
                        <span>${label}</span>
                        <i class="bi bi-x-circle" onclick="removeFilter('${key}')"></i>
                    </div>
                `;
            });

        if (activeTags.length > 0) {
            container.innerHTML = activeTags.join('') + 
                '<button class="clear-all-filters" onclick="clearAllFilters()">Clear All</button>';
        } else {
            container.innerHTML = '';
        }

        // Update filter button appearance
        const filterBtn = document.getElementById('filterBtn');
        const filterBtnText = document.getElementById('filterBtnText');
        if (activeTags.length > 0) {
            filterBtn.classList.add('active');
            filterBtnText.textContent = `Filtered (${activeTags.length})`;
        } else {
            filterBtn.classList.remove('active');
            filterBtnText.textContent = 'Filter By';
        }
    }

    // Remove single filter
    window.removeFilter = function(filterType) {
        activeFilters[filterType] = null;
        updateActiveFiltersDisplay();
        applyAllFilters();
    };

    // Clear all filters
    window.clearAllFilters = function() {
        Object.keys(activeFilters).forEach(key => activeFilters[key] = null);
        updateActiveFiltersDisplay();
        applyAllFilters();
    };

    // Apply all active filters
    function applyAllFilters() {
        const tbody = document.getElementById('sectionsTableBody');
        if (!tbody) return;

        const rows = tbody.getElementsByTagName('tr');
        let visibleCount = 0;

        Array.from(rows).forEach(row => {
            // Skip message rows
            if (row.cells.length === 1) return;

            let matches = true;

            // Year Level filter
            if (activeFilters.yearLevel) {
                const yearText = row.cells[2]?.textContent || '';
                matches = matches && yearText.includes(`Year ${activeFilters.yearLevel}`);
            }

            // Shift filter
            if (activeFilters.shift) {
                const shiftText = row.cells[3]?.textContent || '';
                matches = matches && shiftText === activeFilters.shift;
            }

            // Status filter
            if (activeFilters.status) {
                const statusText = row.cells[7]?.textContent || '';
                matches = matches && statusText.toLowerCase() === activeFilters.status.toLowerCase();
            }

            // Program filter
            if (activeFilters.program) {
                const programText = row.cells[1]?.textContent || '';
                matches = matches && programText === activeFilters.program;
            }

            // Adviser filter
            if (activeFilters.adviser) {
                const adviserText = row.cells[4]?.textContent || '';
                if (activeFilters.adviser === 'hasAdviser') {
                    matches = matches && adviserText !== 'No Adviser';
                } else {
                    matches = matches && adviserText === 'No Adviser';
                }
            }

            row.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });

        // Show no results message if needed
        const searchTerm = document.getElementById('sectionsSearchInput')?.value || '';
        if (visibleCount === 0 && (Object.values(activeFilters).some(v => v !== null) || searchTerm)) {
            const existingNoResults = Array.from(rows).find(row => row.cells.length === 1);
            if (existingNoResults) existingNoResults.remove();
            
            const noResultsRow = document.createElement('tr');
            noResultsRow.innerHTML = `
                <td colspan="9" style="text-align: center; padding: 48px 24px; color: #999; font-style: italic;">
                    No sections match the current filters. Try adjusting your filters.
                </td>
            `;
            tbody.appendChild(noResultsRow);
        }
    }

    // Setup export button
    function setupExportButton() {
        const exportBtn = document.getElementById('exportBtn');
        if (!exportBtn) return;

        exportBtn.addEventListener('click', function() {
            exportToCSV();
        });
    }

    // Export sections to CSV
    function exportToCSV() {
        // Get visible sections (respecting filters)
        const tbody = document.getElementById('sectionsTableBody');
        const rows = Array.from(tbody.getElementsByTagName('tr')).filter(row => {
            return row.cells.length > 1 && row.style.display !== 'none';
        });

        if (rows.length === 0) {
            showBubbleMessage('No sections to export', 'error');
            return;
        }

        // CSV headers
        const headers = ['Section Name', 'Program', 'Year Level', 'Shift', 'Adviser', 'Total Enrolled', 'Academic Year', 'Status'];
        
        // CSV data
        const csvData = rows.map(row => {
            return [
                row.cells[0]?.textContent || '',
                row.cells[1]?.textContent || '',
                row.cells[2]?.textContent || '',
                row.cells[3]?.textContent || '',
                row.cells[4]?.textContent || '',
                row.cells[5]?.textContent || '',
                row.cells[6]?.textContent || '',
                row.cells[7]?.textContent || ''
            ].map(cell => `"${cell}"`).join(',');
        });

        // Combine headers and data
        const csv = [headers.join(','), ...csvData].join('\n');

        // Create download link
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `sections_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showBubbleMessage(`Exported ${rows.length} section(s) to CSV`, 'success');
    }



    // Populate academic year dropdown
    function populateAcademicYearDropdown() {
        const select = document.getElementById('academicYearSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="" disabled>Academic Year</option>';
        
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth(); // 0-11
        
        // Determine current academic year (starts in August/September)
        let currentAcademicYear;
        if (currentMonth >= 7) { // August or later
            currentAcademicYear = `${currentYear}-${currentYear+1}`;
        } else {
            currentAcademicYear = `${currentYear-1}-${currentYear}`;
        }
        
        // Generate options for current and next academic years
        const academicYears = [
            { value: `${currentYear-1}-${currentYear}`, display: `${currentYear-1}-${currentYear}` },
            { value: `${currentYear}-${currentYear+1}`, display: `${currentYear}-${currentYear+1}` },
            { value: `${currentYear+1}-${currentYear+2}`, display: `${currentYear+1}-${currentYear+2}` }
        ];
        
        academicYears.forEach(yearObj => {
            const option = document.createElement('option');
            option.value = yearObj.value;
            option.textContent = yearObj.display;
            
            // Highlight current academic year
            if (yearObj.value === currentAcademicYear) {
                option.textContent += ' (Current)';
                option.selected = true; // Auto-select current year
            }
            
            select.appendChild(option);
        });
    }

    // Setup enrollment warning
    function setupEnrollmentWarning() {
        const enrollmentInput = document.querySelector('input[name="totalEnrolled"]');
        const warningDiv = document.getElementById('enrollmentWarning');
        const warningText = document.getElementById('enrollmentWarningText');
        
        if (!enrollmentInput || !warningDiv) return;

        enrollmentInput.addEventListener('input', function() {
            const value = parseInt(this.value);
            
            if (value === 0) {
                warningDiv.style.display = 'block';
                warningText.textContent = 'Enrollment is 0. Is this correct?';
            } else if (value > 60) {
                warningDiv.style.display = 'block';
                warningText.textContent = 'High enrollment! Verify room capacity.';
            } else {
                warningDiv.style.display = 'none';
            }
        });
    }

    // Render sections table
    function renderSectionsTable() {
        const tbody = document.getElementById('sectionsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (sections.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 48px 24px; color: #999; font-style: italic;">
                        No sections found. Create your first section to get started.
                    </td>
                </tr>
            `;
            return;
        }

        sections.forEach(section => {
            const row = document.createElement('tr');
            
            // Find adviser by matching teacher.section with section.sectionName
            const adviserName = findAdviserForSection(section.sectionName);

            row.innerHTML = `
                <td>${section.sectionName}</td>
                <td>${section.programID}</td>
                <td>Year ${section.yearLevel}</td>
                <td>${section.shift}</td>
                <td>${adviserName}</td>
                <td>${section.totalEnrolled}</td>
                <td>${section.academicYear}</td>
                <td><span class="status-badge status-${section.status.toLowerCase()}">${section.status}</span></td>
                <td class="action-cell">
                    <i class="bi bi-pencil action-link edit" onclick="openEditSection('${section._id}')" title="Edit Section"></i>
                    <i class="bi bi-trash action-link delete" onclick="openDeleteSection('${section._id}')" title="Delete Section"></i>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Auto-detect year level from section name
    function setupYearLevelAutoDetection() {
        const sectionNameInput = document.querySelector('input[name="sectionName"]');
        const yearLevelSelect = document.querySelector('select[name="yearLevel"]');
        
        if (sectionNameInput && yearLevelSelect) {
            // Add blur event listener (when user clicks outside the field)
            sectionNameInput.addEventListener('blur', function() {
                const sectionName = this.value.trim();
                
                if (sectionName.length > 0) {
                    const firstChar = sectionName.charAt(0);
                    
                    // Check if first character is 1, 2, 3, or 4
                    if (['1', '2', '3', '4'].includes(firstChar)) {
                        yearLevelSelect.value = firstChar;
                        
                        // Visual feedback
                        yearLevelSelect.style.transition = 'all 0.3s ease';
                        yearLevelSelect.style.background = '#e8f5e9';
                        setTimeout(() => {
                            yearLevelSelect.style.background = '';
                        }, 1000);
                        
                        console.log(`✅ Auto-detected Year Level: ${firstChar} from section name "${sectionName}"`);
                    }
                }
            });
            
            // Also add input event for real-time detection (optional)
            sectionNameInput.addEventListener('input', function() {
                const sectionName = this.value.trim();
                
                if (sectionName.length > 0) {
                    const firstChar = sectionName.charAt(0);
                    
                    // Check if first character is 1, 2, 3, or 4
                    if (['1', '2', '3', '4'].includes(firstChar)) {
                        yearLevelSelect.value = firstChar;
                    }
                }
            });
        }
    }

    // Open create section modal
    const openModalBtn = document.getElementById('openSectionModal');
    if (openModalBtn) {
        openModalBtn.addEventListener('click', function() {
            editMode = false;
            editingSectionId = null;
            const form = document.getElementById('sectionForm');
            if (form) form.reset();
            
            // Hide errors
            hideModalError();
            
            const modalTitle = document.getElementById('sectionModalTitle');
            if (modalTitle) modalTitle.textContent = 'Create New Section';
            
            const submitBtn = document.querySelector('#sectionModal .modal-submit');
            if (submitBtn) submitBtn.textContent = 'Create Section';
            
            const modal = document.getElementById('sectionModal');
            if (modal) modal.style.display = 'flex';
            document.body.classList.add('modal-open');
            
            // Setup features after modal is shown
            setTimeout(() => {
                setupYearLevelAutoDetection();
                setupEnrollmentWarning();
                populateAdviserDropdown();
            }, 100);
        });
    }

    // Close section modal
    const closeModalBtn = document.getElementById('closeSectionModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            const modal = document.getElementById('sectionModal');
            if (modal) modal.style.display = 'none';
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            hideModalError();
        });
    }

    // Close modal when clicking outside
    const modal = document.getElementById('sectionModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.style.width = '';
                hideModalError();
            }
        });
    }

    // Section form submission
    const sectionForm = document.getElementById('sectionForm');
    if (sectionForm) {
        sectionForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Hide previous errors
            hideModalError();
            
            const formData = {
                sectionName: this.sectionName.value.trim(),
                programID: this.programID.value,
                yearLevel: parseInt(this.yearLevel.value),
                shift: this.shift.value,
                adviserTeacher: this.adviserTeacher.value || null,
                totalEnrolled: parseInt(this.totalEnrolled.value),
                academicYear: this.academicYear.value,
                semester: this.semester.value || '1st Semester',
                status: this.status.value
            };

            // Basic validation
            if (!formData.sectionName || !formData.programID || !formData.yearLevel || !formData.shift || 
                !formData.totalEnrolled || !formData.academicYear) {
                showModalError('Please fill all required fields');
                return;
            }

            if (formData.totalEnrolled < 0) {
                showModalError('Total enrolled cannot be negative');
                return;
            }

            // Warning for zero enrollment
            if (formData.totalEnrolled === 0) {
                if (!confirm('Total enrolled is 0. This might be a data entry error. Continue anyway?')) {
                    return;
                }
            }

            // Validation: Check for duplicate section name + program combination
            if (checkDuplicateSection(formData.sectionName, formData.programID, editingSectionId)) {
                showModalError(`Section "${formData.sectionName}" with program "${formData.programID}" already exists. Same section name is allowed only with different programs.`);
                return;
            }

            // Validation: Section name format suggestion
            const firstChar = formData.sectionName.charAt(0);
            if (!['1', '2', '3', '4'].includes(firstChar)) {
                if (!confirm(`Section name "${formData.sectionName}" doesn't start with a year level (1-4). This is recommended for consistency. Continue anyway?`)) {
                    return;
                }
            }

            try {
                let url = '/sections';
                let method = 'POST';
                
                if (editMode && editingSectionId) {
                    url += `/${editingSectionId}`;
                    method = 'PUT';
                }

                const res = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });

                if (res.ok) {
                    showBubbleMessage(editMode ? 'Section updated successfully!' : 'Section created successfully!', 'success');
                    const modal = document.getElementById('sectionModal');
                    if (modal) modal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                    document.body.style.position = '';
                    document.body.style.width = '';
                    
                    // If adviser was assigned, sync with teacher
                    if (formData.adviserTeacher) {
                        await syncAdviserWithTeacher(formData.adviserTeacher, formData.sectionName);
                    }
                    
                    // Reload all data to refresh statistics and table
                    await loadAllData();
                } else {
                    const error = await res.json();
                    showModalError(error.error || 'Failed to save section. Please check your input.');
                }
            } catch (error) {
                console.error('Error saving section:', error);
                showModalError('Network error. Please check your connection and try again.');
            }
        });
    }

    // Open edit section modal
    window.openEditSection = function(sectionId) {
        const section = sections.find(s => s._id === sectionId);
        if (!section) {
            showBubbleMessage('Section not found', 'error');
            return;
        }

        editMode = true;
        editingSectionId = sectionId;

        // Populate form with section data
        const form = document.getElementById('sectionForm');
        if (form) {
            form.sectionName.value = section.sectionName;
            form.programID.value = section.programID;
            form.yearLevel.value = section.yearLevel;
            form.shift.value = section.shift;
            
            // Find and set adviser
            const adviser = teachers.find(t => t.section === section.sectionName);
            form.adviserTeacher.value = adviser ? adviser._id : '';
            
            form.totalEnrolled.value = section.totalEnrolled;
            form.academicYear.value = section.academicYear;
            form.semester.value = section.semester;
            form.status.value = section.status;
        }
        
        // Repopulate adviser dropdown for edit mode
        populateAdviserDropdown();

        const modalTitle = document.querySelector('#sectionModal h3');
        if (modalTitle) modalTitle.textContent = 'Edit Section';
        
        const submitBtn = document.querySelector('#sectionModal .modal-submit');
        if (submitBtn) submitBtn.textContent = 'Update Section';
        
        const modal = document.getElementById('sectionModal');
        if (modal) modal.style.display = 'flex';
        document.body.classList.add('modal-open');
        
        // Setup features for edit mode too
        setTimeout(() => {
            setupYearLevelAutoDetection();
            setupEnrollmentWarning();
        }, 100);
    };

    // Open delete section modal
    window.openDeleteSection = function(sectionId) {
        const section = sections.find(s => s._id === sectionId);
        if (!section) {
            showBubbleMessage('Section not found', 'error');
            return;
        }

        editingSectionId = sectionId;
        const deleteModalText = document.getElementById('deleteModalText');
        if (deleteModalText) {
            deleteModalText.textContent = 
                `Are you sure you want to delete section "${section.sectionName}"? This action cannot be undone.`;
        }
        
        const deleteModal = document.getElementById('deleteSectionModal');
        if (deleteModal) deleteModal.style.display = 'flex';
        document.body.classList.add('modal-open');
    };

    // Close delete modal
    const cancelDeleteBtn = document.getElementById('cancelDeleteSectionBtn');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', function() {
            const deleteModal = document.getElementById('deleteSectionModal');
            if (deleteModal) deleteModal.style.display = 'none';
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        });
    }

    // Close delete modal when clicking outside
    const deleteModal = document.getElementById('deleteSectionModal');
    if (deleteModal) {
        deleteModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.style.width = '';
            }
        });
    }

    // Confirm section deletion
    const confirmDeleteBtn = document.getElementById('confirmDeleteSectionBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async function() {
            if (!editingSectionId) return;

            try {
                const res = await fetch(`/sections/${editingSectionId}`, {
                    method: 'DELETE'
                });

                if (res.ok) {
                    showBubbleMessage('Section deleted successfully!', 'success');
                    const deleteModal = document.getElementById('deleteSectionModal');
                    if (deleteModal) deleteModal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                    document.body.style.position = '';
                    document.body.style.width = '';
                    
                    // Reload all data to refresh statistics and table
                    await loadAllData();
                } else {
                    const error = await res.json();
                    showBubbleMessage(error.error || 'Failed to delete section', 'error');
                }
            } catch (error) {
                console.error('Error deleting section:', error);
                showBubbleMessage('Failed to delete section', 'error');
            }
        });
    }

    // Bubble notification
    function showBubbleMessage(msg, type = "success") {
        const bubble = document.getElementById('sectionBubbleMessage');
        if (!bubble) return;
        
        bubble.textContent = msg;
        bubble.className = "section-bubble-message";
        bubble.classList.add(type);
        void bubble.offsetWidth;
        bubble.classList.add("show");
        
        setTimeout(() => {
            bubble.classList.remove("show");
        }, 3000);
    }

    // Initial load
    loadAllData();
});