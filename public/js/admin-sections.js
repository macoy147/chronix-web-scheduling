import API_BASE_URL from './api-config.js';
import { handleApiError } from './error-handler.js';
import AuthGuard from './auth-guard.js';




document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    if (!AuthGuard.checkAuthentication('admin')) {
        return;
    }

    // State management
    let sections = [];
    let teachers = [];
    let editingSectionId = null;
    let editMode = false;

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

    // Load all data
    async function loadAllData() {
        try {
            await Promise.all([
                loadSections(),
                loadTeachers()
            ]);
            renderSectionsTable();
            populateAcademicYearDropdown();
        } catch (error) {
            console.error('Error loading data:', error);
            showBubbleMessage('Error loading section data', 'error');
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

    // Load teachers for adviser dropdown
    async function loadTeachers() {
        try {
            const res = await fetch('/teachers');
            if (res.ok) {
                teachers = await res.json();
                console.log('Loaded teachers for adviser dropdown:', teachers);
                populateAdviserDropdown();
            } else {
                console.error('Failed to load teachers');
                teachers = [];
            }
        } catch (error) {
            console.error('Error loading teachers:', error);
            teachers = [];
        }
    }

    // Populate adviser dropdown with teachers
    function populateAdviserDropdown() {
        const select = document.getElementById('adviserTeacherSelect');
        if (!select) return;
        
        // Clear existing options except the first one
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        teachers.forEach(teacher => {
            const option = document.createElement('option');
            option.value = teacher._id; // Store teacher ID
            option.textContent = teacher.fullname;
            select.appendChild(option);
        });
    }

    // Populate academic year dropdown
    function populateAcademicYearDropdown() {
        const select = document.getElementById('academicYearSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="" disabled selected>Academic Year</option>';
        
        const currentYear = new Date().getFullYear();
        const nextYear = currentYear + 1;
        
        // Generate options for current and next academic years
        const academicYears = [
            `${currentYear-1}-${currentYear}`,
            `${currentYear}-${currentYear+1}`,
            `${currentYear+1}-${currentYear+2}`
        ];
        
        academicYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            select.appendChild(option);
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
                    <td colspan="10" style="text-align: center; padding: 48px 24px; color: #999; font-style: italic;">
                        No sections found. Create your first section to get started.
                    </td>
                </tr>
            `;
            return;
        }

        sections.forEach(section => {
            const row = document.createElement('tr');
            
            // Find adviser teacher name
            let adviserName = 'No Adviser';
            if (section.adviserTeacher) {
                const adviser = teachers.find(teacher => teacher._id === section.adviserTeacher);
                adviserName = adviser ? adviser.fullname : section.adviserTeacher;
            }

            row.innerHTML = `
                <td>${section.sectionName}</td>
                <td>${section.programID}</td>
                <td>Year ${section.yearLevel}</td>
                <td>${section.shift}</td>
                <td>${adviserName}</td>
                <td>${section.totalEnrolled}</td>
                <td>${section.academicYear}</td>
                <td>${section.semester}</td>
                <td><span class="status-badge status-${section.status.toLowerCase()}">${section.status}</span></td>
                <td>
                    <i class="bi bi-pencil action-link edit" onclick="openEditSection('${section._id}')" title="Edit Section"></i>
                    <i class="bi bi-trash action-link delete" onclick="openDeleteSection('${section._id}')" title="Delete Section"></i>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Open create section modal
    const openModalBtn = document.getElementById('openSectionModal');
    if (openModalBtn) {
        openModalBtn.addEventListener('click', function() {
            editMode = false;
            editingSectionId = null;
            const form = document.getElementById('sectionForm');
            if (form) form.reset();
            
            const modalTitle = document.querySelector('#sectionModal h3');
            if (modalTitle) modalTitle.textContent = 'Create New Section';
            
            const submitBtn = document.querySelector('#sectionModal .modal-submit');
            if (submitBtn) submitBtn.textContent = 'Create Section';
            
            const modal = document.getElementById('sectionModal');
            if (modal) modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        });
    }

    // Close section modal
    const closeModalBtn = document.getElementById('closeSectionModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            const modal = document.getElementById('sectionModal');
            if (modal) modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }

    // Close modal when clicking outside
    const modal = document.getElementById('sectionModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }

    // Section form submission
    const sectionForm = document.getElementById('sectionForm');
    if (sectionForm) {
        sectionForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                sectionName: this.sectionName.value.trim(),
                programID: this.programID.value,
                yearLevel: parseInt(this.yearLevel.value),
                shift: this.shift.value,
                adviserTeacher: this.adviserTeacher.value, // Store teacher ID
                totalEnrolled: parseInt(this.totalEnrolled.value),
                academicYear: this.academicYear.value,
                semester: this.semester.value,
                status: this.status.value
            };

            // Validation
            if (!formData.sectionName || !formData.programID || !formData.yearLevel || !formData.shift || 
                !formData.totalEnrolled || !formData.academicYear || !formData.semester) {
                showBubbleMessage('Please fill all required fields', 'error');
                return;
            }

            if (formData.totalEnrolled < 0) {
                showBubbleMessage('Total enrolled cannot be negative', 'error');
                return;
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
                    document.body.style.overflow = 'auto';
                    
                    // Reload sections data
                    await loadSections();
                    renderSectionsTable();
                } else {
                    const error = await res.json();
                    showBubbleMessage(error.error || 'Failed to save section', 'error');
                }
            } catch (error) {
                console.error('Error saving section:', error);
                showBubbleMessage('Failed to save section', 'error');
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
            form.adviserTeacher.value = section.adviserTeacher || '';
            form.totalEnrolled.value = section.totalEnrolled;
            form.academicYear.value = section.academicYear;
            form.semester.value = section.semester;
            form.status.value = section.status;
        }

        const modalTitle = document.querySelector('#sectionModal h3');
        if (modalTitle) modalTitle.textContent = 'Edit Section';
        
        const submitBtn = document.querySelector('#sectionModal .modal-submit');
        if (submitBtn) submitBtn.textContent = 'Update Section';
        
        const modal = document.getElementById('sectionModal');
        if (modal) modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
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
        document.body.style.overflow = 'hidden';
    };

    // Close delete modal
    const cancelDeleteBtn = document.getElementById('cancelDeleteSectionBtn');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', function() {
            const deleteModal = document.getElementById('deleteSectionModal');
            if (deleteModal) deleteModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }

    // Close delete modal when clicking outside
    const deleteModal = document.getElementById('deleteSectionModal');
    if (deleteModal) {
        deleteModal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                document.body.style.overflow = 'auto';
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
                    document.body.style.overflow = 'auto';
                    
                    // Reload sections data
                    await loadSections();
                    renderSectionsTable();
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