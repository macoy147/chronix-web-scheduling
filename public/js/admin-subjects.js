// admin-subjects.js - FIXED VERSION
import API_BASE_URL from './api-config.js';
import { handleApiError, showErrorNotification } from './error-handler.js';

// Simple auth helper
const AuthHelper = {
    checkAuthentication(requiredRole = null) {
        const isAuthenticated = sessionStorage.getItem('isAuthenticated');
        const userRole = sessionStorage.getItem('userRole');
        
        console.log('Auth check:', { isAuthenticated, userRole, requiredRole });
        
        if (!isAuthenticated || isAuthenticated !== 'true') {
            this.redirectToLogin();
            return false;
        }
        
        if (requiredRole && userRole !== requiredRole) {
            this.redirectToLogin('Unauthorized access.');
            return false;
        }
        
        return true;
    },
    
    redirectToLogin(message = 'Please sign in') {
        sessionStorage.setItem('loginRedirectMessage', message);
        window.location.href = 'auth.html?mode=signin';
    },
    
    getCurrentUser() {
        const userData = sessionStorage.getItem('currentUser');
        return userData ? JSON.parse(userData) : null;
    },
    
    getUserId() {
        const user = this.getCurrentUser();
        return user ? user._id : null;
    },
    
    logout() {
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('userId');
        window.location.href = 'auth.html?mode=signin';
    },
    
    storeUserSession(userData) {
        sessionStorage.setItem('currentUser', JSON.stringify(userData));
        sessionStorage.setItem('isAuthenticated', 'true');
        sessionStorage.setItem('userRole', userData.userrole);
        sessionStorage.setItem('userId', userData._id);
    }
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin Subjects loaded');
    
    // Check authentication first
    if (!AuthHelper.checkAuthentication('admin')) {
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
            AuthHelper.logout();
        });
    }

    // Update profile info
    function updateProfileInfo() {
        const currentUser = AuthHelper.getCurrentUser();
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
            const userId = AuthHelper.getUserId();
            if (userId) {
                const res = await fetch(`/user/${userId}`);
                if (res.ok) {
                    const userData = await res.json();
                    AuthHelper.storeUserSession(userData);
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

    // Modal functions
    if (openBtn) {
        openBtn.onclick = () => {
            editMode = false;
            editingId = null;
            if (form) form.reset();
            if (modalTitle) modalTitle.textContent = 'Create New Subject';
            if (submitBtn) submitBtn.textContent = 'Create';
            if (modal) modal.style.display = 'flex';
        };
    }

    if (closeBtn) {
        closeBtn.onclick = () => { 
            if (modal) modal.style.display = 'none'; 
        };
    }

    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.style.display = 'none';
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

    // Load subjects from server
    async function loadSubjects() {
        const tbody = document.getElementById('subjectsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="loading-state">
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
            
            if (Array.isArray(data) && data.length > 0) {
                renderSubjectsTable(data);
            } else {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="10" class="no-data">
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
                    <td colspan="10" class="error-state">
                        <i class="bi bi-exclamation-triangle"></i>
                        <span>Error loading subjects. Please try again.</span>
                    </td>
                </tr>
            `;
            showBubbleMessage('Failed to load subjects', 'error');
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
            tr.innerHTML = `
                <td>${subj.courseCode || ''}</td>
                <td title="${descriptiveTitle}">${descriptiveTitle}</td>
                <td>Year ${subj.yearLevel || ''}</td>
                <td>${subj.coPrerequisite || '-'}</td>
                <td>${subj.units || '-'}</td>
                <td>${subj.lecHours || '0'}</td>
                <td>${subj.labHours || '0'}</td>
                <td>${subj.totalHours || '0'}</td>
                <td>${subj.remarks || '-'}</td>
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
            if (!data.courseCode || !data.descriptiveTitle || !data.yearLevel) {
                showBubbleMessage("Course Code, Descriptive Title, and Year Level are required.", "error");
                return;
            }
            
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
                    loadSubjects();
                } else {
                    showBubbleMessage(result.error || "Failed to save subject.", "error");
                }
            } catch (error) {
                console.error('Error saving subject:', error);
                showBubbleMessage("Network error. Please check your connection.", "error");
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
            
            // Populate form
            if (form) {
                form.courseCode.value = subject.courseCode || '';
                form.descriptiveTitle.value = subject.descriptiveTitle || '';
                form.yearLevel.value = subject.yearLevel || '';
                form.coPrerequisite.value = subject.coPrerequisite || '';
                form.units.value = subject.units || '';
                form.lecHours.value = subject.lecHours || '';
                form.labHours.value = subject.labHours || '';
                form.totalHours.value = subject.totalHours || '';
                form.remarks.value = subject.remarks || '';
                form.description.value = subject.description || '';
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

    // Initial load
    loadSubjects();
});