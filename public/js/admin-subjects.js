// admin-subjects.js - ENHANCED VERSION
import AuthGuard from './auth-guard.js';


// Simple auth helper
 

document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin Subjects loaded');
    
    // Check authentication first
    if (!AuthGuard.checkAuthentication('admin')) {
        return;
    }

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
            if (profileAvatar) {
                if (currentUser.profilePicture) {
                    profileAvatar.src = currentUser.profilePicture.startsWith('http') 
                        ? currentUser.profilePicture 
                        : currentUser.profilePicture;
                } else {
                    profileAvatar.src = '/img/default_admin_avatar.png';
                }
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

    // Initial profile update
    updateProfileInfo();
    fetchUserData();

    // Auto-calculate total hours
    const lecInput = document.getElementById('lecHoursInput');
    const labInput = document.getElementById('labHoursInput');
    const totalInput = document.getElementById('totalHoursInput');

    function updateTotal() {
        if (lecInput && labInput && totalInput) {
            const lec = parseFloat(lecInput.value) || 0;
            const lab = parseFloat(labInput.value) || 0;
            totalInput.value = lec + lab;
        }
    }

    if (lecInput && labInput && totalInput) {
        lecInput.addEventListener('input', updateTotal);
        labInput.addEventListener('input', updateTotal);
    }

    // Modal elements
    const modal = document.getElementById('subjectModal');
    const openBtn = document.getElementById('openSubjectModal');
    const closeBtn = document.getElementById('closeSubjectModal');
    const form = document.getElementById('subjectForm');
    const submitBtn = document.getElementById('submitSubjectBtn');
    const modalTitle = document.getElementById('subjectModalTitle');
    let editMode = false;
    let editingId = null;

    // Function to populate Co/Prerequisite dropdown with all subjects
    function populateCoPrerequisiteDropdown(currentSubjectId = null) {
        const select = document.getElementById('coPrerequisiteSelect');
        if (!select) return;
        
        // Clear existing options except the first one
        select.innerHTML = '<option value="">No Co/Prerequisite</option>';
        
        // Add all subjects except the current one being edited
        allSubjects.forEach(subject => {
            // Don't show the current subject in its own prerequisite list
            if (currentSubjectId && subject._id === currentSubjectId) {
                return;
            }
            
            const option = document.createElement('option');
            option.value = subject.courseCode; // Store course code as value
            option.textContent = `${subject.courseCode} - ${subject.descriptiveTitle}`;
            option.title = subject.descriptiveTitle; // Full title on hover
            select.appendChild(option);
        });
    }

    // Modal functions
    if (openBtn) {
        openBtn.onclick = () => {
            editMode = false;
            editingId = null;
            if (form) form.reset();
            if (modalTitle) modalTitle.textContent = 'Create New Subject';
            if (submitBtn) submitBtn.textContent = 'Create';
            
            // Hide any previous errors
            hideModalError();
            
            // Populate Co/Prerequisite dropdown
            populateCoPrerequisiteDropdown();
            
            if (modal) modal.style.display = 'flex';
        };
    }

    if (closeBtn) {
        closeBtn.onclick = () => { 
            if (modal) modal.style.display = 'none';
            hideModalError();
        };
    }

    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
                hideModalError();
            }
        });
    }

    // Notification system
    function showBubbleMessage(msg, type = "success") {
        const bubble = document.getElementById('subjectBubbleMessage');
        if (!bubble) return;
        
        bubble.textContent = msg;
        bubble.classList.remove("show", "success", "error");
        bubble.classList.add(type);
        void bubble.offsetWidth; // Force reflow
        bubble.classList.add("show");
        
        setTimeout(() => {
            bubble.classList.remove("show");
        }, 3000);
    }

    // Modal error display functions
    function showModalError(message) {
        const errorAlert = document.getElementById('subjectModalError');
        const errorText = document.getElementById('subjectModalErrorText');
        
        if (errorAlert && errorText) {
            errorText.textContent = message;
            errorAlert.style.display = 'flex';
            
            // Scroll to top of modal to show error
            const modalContent = document.querySelector('#subjectModal .modal-content');
            if (modalContent) {
                modalContent.scrollTop = 0;
            }
        }
    }

    function hideModalError() {
        const errorAlert = document.getElementById('subjectModalError');
        if (errorAlert) {
            errorAlert.style.display = 'none';
        }
    }

    // Update statistics cards
    function updateStatistics() {
        const total = allSubjects.length;
        const year1 = allSubjects.filter(s => s.yearLevel === 1).length;
        const year2 = allSubjects.filter(s => s.yearLevel === 2).length;
        const year3 = allSubjects.filter(s => s.yearLevel === 3).length;
        const year4 = allSubjects.filter(s => s.yearLevel === 4).length;

        document.getElementById('totalSubjects').textContent = total;
        document.getElementById('year1Subjects').textContent = year1;
        document.getElementById('year2Subjects').textContent = year2;
        document.getElementById('year3Subjects').textContent = year3;
        document.getElementById('year4Subjects').textContent = year4;
    }

    // Load subjects from server
    async function loadSubjects() {
        const tbody = document.getElementById('subjectsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="loading-state">
                    <div class="loading-spinner"></div>
                    <span>Loading subjects...</span>
                </td>
            </tr>
        `;
        
        try {
            console.log('Fetching subjects from server...');
            const res = await fetch('/subjects');
            
            if (!res.ok) {
                throw new Error(`Server returned ${res.status}: ${res.statusText}`);
            }
            
            const data = await res.json();
            console.log('Subjects data received:', data);
            allSubjects = Array.isArray(data) ? data : []; // Store all subjects
            
            if (allSubjects.length > 0) {
                updateStatistics();
                renderSubjectsTable(allSubjects);
                setupFilterDropdown();
                setupExportButton();
            } else {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="11" class="no-data">
                            <i class="bi bi-inbox"></i>
                            <span>No subjects found. Create your first subject!</span>
                        </td>
                    </tr>
                `;
            }
        } catch (error) {
            console.error('Error loading subjects:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="error-state">
                        <i class="bi bi-exclamation-triangle"></i>
                        <span>Error loading subjects. Please try again.</span>
                    </td>
                </tr>
            `;
            showBubbleMessage('Failed to load subjects', 'error');
            allSubjects = [];
        }
    }

    // Render subjects table
    function renderSubjectsTable(subjects) {
        const tbody = document.getElementById('subjectsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        subjects.forEach(subj => {
            const tr = document.createElement('tr');
            const descriptiveTitle = subj.descriptiveTitle || '';
            const semester = subj.semester || '-';
            
            // Prerequisite display with icon
            let prerequisiteDisplay = '-';
            if (subj.coPrerequisite) {
                const prereqSubject = allSubjects.find(s => s.courseCode === subj.coPrerequisite);
                prerequisiteDisplay = `<span class="prerequisite-indicator"><i class="bi bi-diagram-3"></i>${subj.coPrerequisite}</span>`;
            }
            
            // Determine subject type with visual badge
            const lecHours = parseFloat(subj.lecHours) || 0;
            const labHours = parseFloat(subj.labHours) || 0;
            let typeDisplay = '-';
            
            if (lecHours > 0 && labHours > 0) {
                typeDisplay = '<span class="subject-type-badge subject-type-both">Both</span>';
            } else if (lecHours > 0) {
                typeDisplay = '<span class="subject-type-badge subject-type-lecture">Lecture</span>';
            } else if (labHours > 0) {
                typeDisplay = '<span class="subject-type-badge subject-type-lab">Lab</span>';
            }
            
            // High units indicator (3+ units highlighted)
            const units = parseFloat(subj.units) || 0;
            const unitsDisplay = units >= 3 ? `<span class="high-units">${subj.units || '-'}</span>` : (subj.units || '-');
            
            tr.innerHTML = `
                <td>${subj.courseCode || ''}</td>
                <td title="${descriptiveTitle}">${descriptiveTitle}</td>
                <td>Year ${subj.yearLevel || ''}</td>
                <td>${semester}</td>
                <td>${prerequisiteDisplay}</td>
                <td>${unitsDisplay}</td>
                <td>${subj.lecHours || '0'}</td>
                <td>${subj.labHours || '0'}</td>
                <td>${subj.totalHours || '0'}</td>
                <td>${typeDisplay}</td>
                <td class="action-cell">
                    <span class="action-link desc" data-id="${subj._id}" title="View Description">
                        <i class="bi bi-info-circle"></i>
                    </span>
                    <span class="action-link edit" data-id="${subj._id}" title="Edit">
                        <i class="bi bi-pencil"></i>
                    </span>
                    <span class="action-link delete" data-id="${subj._id}" title="Delete">
                        <i class="bi bi-trash"></i>
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Attach event listeners
        attachTableEventListeners();
    }

    // Attach event listeners to table actions
    function attachTableEventListeners() {
        const tbody = document.getElementById('subjectsTableBody');
        if (!tbody) return;
        
        // Edit buttons
        tbody.querySelectorAll('.edit').forEach(btn => {
            btn.onclick = () => openEditModal(btn.getAttribute('data-id'));
        });
        
        // Delete buttons
        tbody.querySelectorAll('.delete').forEach(btn => {
            btn.onclick = () => handleDelete(btn.getAttribute('data-id'));
        });
        
        // Description buttons
        tbody.querySelectorAll('.desc').forEach(btn => {
            btn.onclick = () => showDescription(btn.getAttribute('data-id'));
        });
    }

    // Form submit handler
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = {
                courseCode: formData.get('courseCode')?.trim() || '',
                descriptiveTitle: formData.get('descriptiveTitle')?.trim() || '',
                yearLevel: parseInt(formData.get('yearLevel') || '0'),
                semester: formData.get('semester') || '',
                coPrerequisite: formData.get('coPrerequisite')?.trim() || '',
                units: formData.get('units')?.trim() || '',
                lecHours: formData.get('lecHours') || '',
                labHours: formData.get('labHours') || '',
                totalHours: formData.get('totalHours') || '',
                remarks: formData.get('remarks')?.trim() || '',
                description: formData.get('description')?.trim() || ''
            };
            
            console.log('Submitting subject data:', data);
            
            // Validation
            if (!data.courseCode || !data.descriptiveTitle || !data.yearLevel || !data.semester) {
                showModalError("Course Code, Descriptive Title, Year Level, and Semester are required.");
                return;
            }
            
            // Hide any previous errors before submitting
            hideModalError();
            
            try {
                let url = '/subjects';
                let method = 'POST';
                
                if (editMode && editingId) {
                    url += `/${editingId}`;
                    method = 'PUT';
                }
                
                const res = await fetch(url, {
                    method,
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await res.json();
                
                if (res.ok) {
                    showBubbleMessage(
                        editMode ? "Subject updated successfully!" : "Subject created successfully!", 
                        "success"
                    );
                    if (modal) modal.style.display = 'none';
                    if (form) form.reset();
                    hideModalError();
                    loadSubjects();
                } else {
                    // Show error in modal instead of bubble
                    showModalError(result.error || "Failed to save subject. Please check your input.");
                }
            } catch (error) {
                console.error('Error saving subject:', error);
                showModalError("Network error. Please check your connection and try again.");
            }
        };
    }

    // Edit modal
    async function openEditModal(id) {
        try {
            const res = await fetch('/subjects');
            if (!res.ok) throw new Error('Failed to fetch subjects');
            
            const data = await res.json();
            const subject = data.find(s => s._id === id);
            
            if (!subject) {
                showBubbleMessage("Subject not found.", "error");
                return;
            }
            
            editMode = true;
            editingId = id;
            
            // Hide any previous errors
            hideModalError();
            
            // Populate form first
            if (form) {
                form.courseCode.value = subject.courseCode || '';
                form.descriptiveTitle.value = subject.descriptiveTitle || '';
                form.yearLevel.value = subject.yearLevel || '';
                form.semester.value = subject.semester || '';
                form.units.value = subject.units || '';
                form.lecHours.value = subject.lecHours || '';
                form.labHours.value = subject.labHours || '';
                form.totalHours.value = subject.totalHours || '';
                form.remarks.value = subject.remarks || '';
                form.description.value = subject.description || '';
            }
            
            // Populate Co/Prerequisite dropdown with fresh data (exclude current subject)
            const select = document.getElementById('coPrerequisiteSelect');
            if (select) {
                select.innerHTML = '<option value="">No Co/Prerequisite</option>';
                
                data.forEach(subj => {
                    // Don't show the current subject in its own prerequisite list
                    if (subj._id === id) {
                        return;
                    }
                    
                    const option = document.createElement('option');
                    option.value = subj.courseCode;
                    option.textContent = `${subj.courseCode} - ${subj.descriptiveTitle}`;
                    option.title = subj.descriptiveTitle;
                    select.appendChild(option);
                });
                
                // Set the selected value after DOM updates
                setTimeout(() => {
                    if (subject.coPrerequisite) {
                        const prereqValue = (subject.coPrerequisite || '').trim();
                        console.log('Setting co/prerequisite to:', prereqValue);
                        console.log('Available options:', Array.from(select.options).map(o => o.value));
                        
                        select.value = prereqValue;
                        console.log('Select value after setting:', select.value);
                        
                        // If value didn't set, try to find and select the option manually
                        if (select.value !== prereqValue) {
                            const options = Array.from(select.options);
                            const matchingOption = options.find(opt => opt.value.trim() === prereqValue);
                            if (matchingOption) {
                                matchingOption.selected = true;
                                console.log('Manually selected option:', matchingOption.textContent);
                            } else {
                                console.warn('No matching option found for:', prereqValue);
                                console.warn('Subject data:', subject);
                            }
                        }
                    }
                }, 10);
            }
            
            if (modalTitle) modalTitle.textContent = 'Edit Subject';
            if (submitBtn) submitBtn.textContent = 'Save Changes';
            if (modal) modal.style.display = 'flex';
            
        } catch (error) {
            console.error('Error opening edit modal:', error);
            showBubbleMessage("Error loading subject data.", "error");
        }
    }

    // Delete functionality
    const deleteModal = document.getElementById('deleteSubjectModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteSubjectBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteSubjectBtn');
    const deleteModalText = document.getElementById('deleteModalText');
    let deleteSubjectId = null;

    async function handleDelete(id) {
        try {
            // Fetch subject details for confirmation message
            const res = await fetch('/subjects');
            if (res.ok) {
                const data = await res.json();
                const subject = data.find(s => s._id === id);
                
                deleteSubjectId = id;
                if (deleteModalText) {
                    deleteModalText.textContent = subject
                        ? `Are you sure you want to delete "${subject.descriptiveTitle}" (${subject.courseCode})? This action cannot be undone.`
                        : 'Are you sure you want to delete this subject? This action cannot be undone.';
                }
                if (deleteModal) deleteModal.style.display = 'flex';
            }
        } catch (error) {
            console.error('Error fetching subject for delete:', error);
            deleteSubjectId = id;
            if (deleteModalText) {
                deleteModalText.textContent = 'Are you sure you want to delete this subject? This action cannot be undone.';
            }
            if (deleteModal) deleteModal.style.display = 'flex';
        }
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.onclick = () => {
            if (deleteModal) deleteModal.style.display = 'none';
            deleteSubjectId = null;
        };
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.onclick = async () => {
            if (!deleteSubjectId) return;
            
            try {
                const res = await fetch(`/subjects/${deleteSubjectId}`, {
                    method: 'DELETE'
                });
                
                const result = await res.json();
                
                if (res.ok) {
                    showBubbleMessage("Subject deleted successfully!", "success");
                    loadSubjects();
                } else {
                    showBubbleMessage(result.error || "Failed to delete subject.", "error");
                }
            } catch (error) {
                console.error('Error deleting subject:', error);
                showBubbleMessage("Network error. Please try again.", "error");
            }
            
            if (deleteModal) deleteModal.style.display = 'none';
            deleteSubjectId = null;
        };
    }

    if (deleteModal) {
        deleteModal.addEventListener('click', function(e) {
            if (e.target === deleteModal) {
                deleteModal.style.display = 'none';
                deleteSubjectId = null;
            }
        });
    }

    // Description modal
    const descModal = document.getElementById('descSubjectModal');
    const closeDescBtn = document.getElementById('closeDescSubjectBtn');
    const descModalText = document.getElementById('descModalText');

    async function showDescription(id) {
        try {
            const res = await fetch('/subjects');
            if (res.ok) {
                const data = await res.json();
                const subject = data.find(s => s._id === id);
                
                if (descModalText) {
                    descModalText.textContent = subject && subject.description 
                        ? subject.description 
                        : "No description provided for this subject.";
                }
                if (descModal) descModal.style.display = 'flex';
            }
        } catch (error) {
            console.error('Error loading description:', error);
            if (descModalText) {
                descModalText.textContent = "Unable to load description.";
            }
            if (descModal) descModal.style.display = 'flex';
        }
    }

    if (closeDescBtn) {
        closeDescBtn.onclick = () => {
            if (descModal) descModal.style.display = 'none';
        };
    }

    if (descModal) {
        descModal.addEventListener('click', function(e) {
            if (e.target === descModal) descModal.style.display = 'none';
        });
    }

    // Cancel button in main modal
    const cancelBtn = document.getElementById('cancelSubjectBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (modal) modal.style.display = 'none';
            if (form) form.reset();
            editMode = false;
            editingId = null;
        });
    }

    // Search and filter functionality
    const searchInput = document.getElementById('subjectSearch');
    let allSubjects = []; // Store all subjects for filtering
    let activeFilters = {
        yearLevel: null,
        semester: null,
        prerequisite: null,
        type: null
    };
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            applyFilters();
        });
    }
    
    function applyFilters() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        
        let filtered = allSubjects;
        
        // Apply active filters
        if (activeFilters.yearLevel) {
            filtered = filtered.filter(subj => subj.yearLevel === parseInt(activeFilters.yearLevel));
        }
        
        if (activeFilters.semester) {
            filtered = filtered.filter(subj => subj.semester === activeFilters.semester);
        }
        
        if (activeFilters.prerequisite) {
            if (activeFilters.prerequisite === 'has') {
                filtered = filtered.filter(subj => subj.coPrerequisite && subj.coPrerequisite.trim() !== '');
            } else if (activeFilters.prerequisite === 'none') {
                filtered = filtered.filter(subj => !subj.coPrerequisite || subj.coPrerequisite.trim() === '');
            }
        }
        
        if (activeFilters.type) {
            filtered = filtered.filter(subj => {
                const lecHours = parseFloat(subj.lecHours) || 0;
                const labHours = parseFloat(subj.labHours) || 0;
                
                if (activeFilters.type === 'lecture') {
                    return lecHours > 0 && labHours === 0;
                } else if (activeFilters.type === 'lab') {
                    return labHours > 0 && lecHours === 0;
                } else if (activeFilters.type === 'both') {
                    return lecHours > 0 && labHours > 0;
                }
                return true;
            });
        }
        
        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(subj => {
                return (
                    (subj.courseCode || '').toLowerCase().includes(searchTerm) ||
                    (subj.descriptiveTitle || '').toLowerCase().includes(searchTerm) ||
                    (subj.yearLevel || '').toString().includes(searchTerm) ||
                    (subj.semester || '').toLowerCase().includes(searchTerm) ||
                    (subj.coPrerequisite || '').toLowerCase().includes(searchTerm) ||
                    (subj.units || '').toString().includes(searchTerm) ||
                    (subj.remarks || '').toLowerCase().includes(searchTerm) ||
                    (subj.description || '').toLowerCase().includes(searchTerm)
                );
            });
        }
        
        renderSubjectsTable(filtered);
    }

    // Setup cascading filter dropdown
    function setupFilterDropdown() {
        const filterBtn = document.getElementById('filterBtn');
        const filterDropdown = document.getElementById('filterDropdown');
        const filterValuesDropdown = document.getElementById('filterValuesDropdown');
        const activeFiltersContainer = document.getElementById('activeFilters');
        
        if (!filterBtn || !filterDropdown || !filterValuesDropdown) return;
        
        // Toggle main filter dropdown
        filterBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            filterDropdown.classList.toggle('show');
            filterValuesDropdown.classList.remove('show');
        });
        
        // Handle filter option selection
        filterDropdown.querySelectorAll('.filter-option').forEach(option => {
            option.addEventListener('click', function(e) {
                e.stopPropagation();
                const filterType = this.getAttribute('data-filter');
                showFilterValues(filterType);
            });
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', function() {
            filterDropdown.classList.remove('show');
            filterValuesDropdown.classList.remove('show');
        });
        
        function showFilterValues(filterType) {
            filterValuesDropdown.innerHTML = '';
            filterValuesDropdown.classList.add('show');
            
            let options = [];
            
            switch(filterType) {
                case 'yearLevel':
                    options = [
                        { value: '1', label: 'Year 1' },
                        { value: '2', label: 'Year 2' },
                        { value: '3', label: 'Year 3' },
                        { value: '4', label: 'Year 4' }
                    ];
                    break;
                case 'semester':
                    options = [
                        { value: '1st Semester', label: '1st Semester' },
                        { value: '2nd Semester', label: '2nd Semester' }
                    ];
                    break;
                case 'prerequisite':
                    options = [
                        { value: 'has', label: 'Has Prerequisite' },
                        { value: 'none', label: 'No Prerequisite' }
                    ];
                    break;
                case 'type':
                    options = [
                        { value: 'lecture', label: 'Lecture Only' },
                        { value: 'lab', label: 'Lab Only' },
                        { value: 'both', label: 'Both Lec & Lab' }
                    ];
                    break;
            }
            
            options.forEach(opt => {
                const div = document.createElement('div');
                div.className = 'filter-value-option';
                div.textContent = opt.label;
                div.addEventListener('click', function(e) {
                    e.stopPropagation();
                    applyFilter(filterType, opt.value, opt.label);
                    filterDropdown.classList.remove('show');
                    filterValuesDropdown.classList.remove('show');
                });
                filterValuesDropdown.appendChild(div);
            });
        }
        
        function applyFilter(filterType, value, label) {
            activeFilters[filterType] = value;
            updateActiveFiltersDisplay();
            applyFilters();
            
            // Update filter button to show active state
            filterBtn.classList.add('active');
            const filterBtnText = document.getElementById('filterBtnText');
            if (filterBtnText) {
                const activeCount = Object.values(activeFilters).filter(v => v !== null).length;
                filterBtnText.textContent = activeCount > 0 ? `Filters (${activeCount})` : 'Filter By';
            }
        }
        
        function updateActiveFiltersDisplay() {
            if (!activeFiltersContainer) return;
            
            activeFiltersContainer.innerHTML = '';
            
            const filterLabels = {
                yearLevel: 'Year',
                semester: 'Semester',
                prerequisite: 'Prerequisite',
                type: 'Type'
            };
            
            const filterValueLabels = {
                '1': 'Year 1',
                '2': 'Year 2',
                '3': 'Year 3',
                '4': 'Year 4',
                '1st Semester': '1st Sem',
                '2nd Semester': '2nd Sem',
                'has': 'Has Prereq',
                'none': 'No Prereq',
                'lecture': 'Lecture',
                'lab': 'Lab',
                'both': 'Both'
            };
            
            let hasActiveFilters = false;
            
            Object.keys(activeFilters).forEach(key => {
                if (activeFilters[key]) {
                    hasActiveFilters = true;
                    const tag = document.createElement('div');
                    tag.className = 'filter-tag';
                    tag.innerHTML = `
                        <span>${filterLabels[key]}: ${filterValueLabels[activeFilters[key]] || activeFilters[key]}</span>
                        <i class="bi bi-x-circle-fill"></i>
                    `;
                    tag.querySelector('i').addEventListener('click', function() {
                        removeFilter(key);
                    });
                    activeFiltersContainer.appendChild(tag);
                }
            });
            
            if (hasActiveFilters) {
                const clearBtn = document.createElement('button');
                clearBtn.className = 'clear-all-filters';
                clearBtn.textContent = 'Clear All';
                clearBtn.addEventListener('click', clearAllFilters);
                activeFiltersContainer.appendChild(clearBtn);
            }
        }
        
        function removeFilter(filterType) {
            activeFilters[filterType] = null;
            updateActiveFiltersDisplay();
            applyFilters();
            
            // Update filter button
            const activeCount = Object.values(activeFilters).filter(v => v !== null).length;
            const filterBtnText = document.getElementById('filterBtnText');
            if (filterBtnText) {
                filterBtnText.textContent = activeCount > 0 ? `Filters (${activeCount})` : 'Filter By';
            }
            if (activeCount === 0) {
                filterBtn.classList.remove('active');
            }
        }
        
        function clearAllFilters() {
            activeFilters = {
                yearLevel: null,
                semester: null,
                prerequisite: null,
                type: null
            };
            updateActiveFiltersDisplay();
            applyFilters();
            filterBtn.classList.remove('active');
            const filterBtnText = document.getElementById('filterBtnText');
            if (filterBtnText) {
                filterBtnText.textContent = 'Filter By';
            }
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
    
    function exportToCSV() {
        // Get currently filtered subjects
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        let filtered = allSubjects;
        
        // Apply active filters
        if (activeFilters.yearLevel) {
            filtered = filtered.filter(subj => subj.yearLevel === parseInt(activeFilters.yearLevel));
        }
        
        if (activeFilters.semester) {
            filtered = filtered.filter(subj => subj.semester === activeFilters.semester);
        }
        
        if (activeFilters.prerequisite) {
            if (activeFilters.prerequisite === 'has') {
                filtered = filtered.filter(subj => subj.coPrerequisite && subj.coPrerequisite.trim() !== '');
            } else if (activeFilters.prerequisite === 'none') {
                filtered = filtered.filter(subj => !subj.coPrerequisite || subj.coPrerequisite.trim() === '');
            }
        }
        
        if (activeFilters.type) {
            filtered = filtered.filter(subj => {
                const lecHours = parseFloat(subj.lecHours) || 0;
                const labHours = parseFloat(subj.labHours) || 0;
                
                if (activeFilters.type === 'lecture') {
                    return lecHours > 0 && labHours === 0;
                } else if (activeFilters.type === 'lab') {
                    return labHours > 0 && lecHours === 0;
                } else if (activeFilters.type === 'both') {
                    return lecHours > 0 && labHours > 0;
                }
                return true;
            });
        }
        
        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(subj => {
                return (
                    (subj.courseCode || '').toLowerCase().includes(searchTerm) ||
                    (subj.descriptiveTitle || '').toLowerCase().includes(searchTerm) ||
                    (subj.yearLevel || '').toString().includes(searchTerm) ||
                    (subj.semester || '').toLowerCase().includes(searchTerm) ||
                    (subj.coPrerequisite || '').toLowerCase().includes(searchTerm) ||
                    (subj.units || '').toString().includes(searchTerm) ||
                    (subj.remarks || '').toLowerCase().includes(searchTerm) ||
                    (subj.description || '').toLowerCase().includes(searchTerm)
                );
            });
        }
        
        if (filtered.length === 0) {
            showBubbleMessage('No subjects to export', 'error');
            return;
        }
        
        // Create CSV content
        const headers = ['Course Code', 'Descriptive Title', 'Year Level', 'Semester', 'Co-Prerequisite', 'Units', 'Lec Hours', 'Lab Hours', 'Total Hours', 'Remarks', 'Description'];
        const csvRows = [headers.join(',')];
        
        filtered.forEach(subj => {
            const row = [
                `"${(subj.courseCode || '').replace(/"/g, '""')}"`,
                `"${(subj.descriptiveTitle || '').replace(/"/g, '""')}"`,
                `"Year ${subj.yearLevel || ''}"`,
                `"${subj.semester || ''}"`,
                `"${subj.coPrerequisite || ''}"`,
                `"${subj.units || ''}"`,
                `"${subj.lecHours || '0'}"`,
                `"${subj.labHours || '0'}"`,
                `"${subj.totalHours || '0'}"`,
                `"${(subj.remarks || '').replace(/"/g, '""')}"`,
                `"${(subj.description || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        });
        
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `subjects_export_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showBubbleMessage(`Exported ${filtered.length} subject(s) successfully!`, 'success');
    }

    // Initial load
    loadSubjects();
});