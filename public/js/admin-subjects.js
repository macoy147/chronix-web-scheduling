// Profile dropdown toggle
document.addEventListener('DOMContentLoaded', function() {
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
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        AuthGuard.logout();
    });

    // Update profile name and avatar with actual user data
    function updateProfileInfo() {
        const currentUser = AuthGuard.getCurrentUser();
        if (currentUser) {
            // Get first name from fullname
            const firstName = currentUser.fullname.split(' ')[0];
            const profileName = document.getElementById('profileName');
            if (profileName) {
                profileName.innerHTML = `${firstName} <i class="bi bi-chevron-down"></i>`;
            }

            // Update profile picture if available
            const profileAvatar = document.getElementById('profileAvatar');
            if (profileAvatar && currentUser.profilePicture) {
                profileAvatar.src = `http://localhost:3001${currentUser.profilePicture}`;
            }
        }
    }

    // Fetch user data to get updated profile information
    async function fetchUserData() {
        try {
            const userId = AuthGuard.getUserId();
            if (userId) {
                const res = await fetch(`http://localhost:3001/user/${userId}`);
                if (res.ok) {
                    const userData = await res.json();
                    // Update session storage with fresh data
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

    // --- Auto-calculate total hours ---
    const lecInput = document.getElementById('lecHoursInput');
    const labInput = document.getElementById('labHoursInput');
    const totalInput = document.getElementById('totalHoursInput');

    function updateTotal() {
        const lec = parseFloat(lecInput.value) || 0;
        const lab = parseFloat(labInput.value) || 0;
        totalInput.value = lec + lab;
    }

    if (lecInput && labInput && totalInput) {
        lecInput.addEventListener('input', updateTotal);
        labInput.addEventListener('input', updateTotal);
    }

    // Modal logic
    const modal = document.getElementById('subjectModal');
    const openBtn = document.getElementById('openSubjectModal');
    const closeBtn = document.getElementById('closeSubjectModal');
    const form = document.getElementById('subjectForm');
    const submitBtn = document.getElementById('submitSubjectBtn');
    const modalTitle = document.getElementById('subjectModalTitle');
    let editMode = false;
    let editingId = null;

    openBtn.onclick = () => {
        editMode = false;
        editingId = null;
        form.reset();
        modalTitle.textContent = 'Create New Subject';
        submitBtn.textContent = 'Create';
        modal.style.display = 'flex';
    };

    closeBtn.onclick = () => { modal.style.display = 'none'; };

    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.style.display = 'none';
    });

    // Messenger-bubble notification
    function showBubbleMessage(msg, type = "success") {
        const bubble = document.getElementById('subjectBubbleMessage');
        bubble.textContent = msg;
        bubble.classList.remove("show", "success", "error");
        bubble.classList.add(type);
        // Force reflow to reset transition if called rapidly
        void bubble.offsetWidth;
        bubble.classList.add("show");
        setTimeout(() => {
            bubble.classList.remove("show");
        }, 2700);
    }

    // Fetch and render subjects
    async function loadSubjects() {
        const tbody = document.getElementById('subjectsTableBody');
        tbody.innerHTML = '<tr><td colspan="10">Loading...</td></tr>';
        try {
            const res = await fetch('http://localhost:3001/subjects');
            const data = await res.json();
            if (Array.isArray(data) && data.length) {
                tbody.innerHTML = '';
                data.forEach(subj => {
                    const tr = document.createElement('tr');
                    const descriptiveTitle = subj.descriptiveTitle || '';
                    tr.innerHTML = `
                        <td>${subj.courseCode || ''}</td>
                        <td title="${descriptiveTitle}">${descriptiveTitle}</td>
                        <td>Year ${subj.yearLevel || ''}</td>
                        <td>${subj.coPrerequisite || ''}</td>
                        <td>${subj.units || ''}</td>
                        <td>${subj.lecHours || ''}</td>
                        <td>${subj.labHours || ''}</td>
                        <td>${subj.totalHours || ''}</td>
                        <td>${subj.remarks || ''}</td>
                        <td class="action-cell">
                            <span class="action-link desc" data-id="${subj._id}" title="View Description"><i class="bi bi-info-circle"></i></span>
                            <span class="action-link edit" data-id="${subj._id}" title="Edit"><i class="bi bi-pencil"></i></span>
                            <span class="action-link delete" data-id="${subj._id}" title="Delete"><i class="bi bi-trash"></i></span>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
                // Attach edit/delete/desc events
                tbody.querySelectorAll('.edit').forEach(btn => {
                    btn.onclick = () => openEditModal(btn.getAttribute('data-id'));
                });
                tbody.querySelectorAll('.delete').forEach(btn => {
                    btn.onclick = () => handleDelete(btn.getAttribute('data-id'));
                });
                tbody.querySelectorAll('.desc').forEach(btn => {
                    btn.onclick = () => showDescription(btn.getAttribute('data-id'));
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="10">No subjects found.</td></tr>';
            }
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="10">Error loading subjects.</td></tr>';
        }
    }

    // Form submit
    form.onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            courseCode: form.courseCode.value.trim(),
            descriptiveTitle: form.descriptiveTitle.value.trim(),
            yearLevel: parseInt(form.yearLevel.value),
            coPrerequisite: form.coPrerequisite.value.trim(),
            units: form.units.value.trim(),
            lecHours: form.lecHours.value,
            labHours: form.labHours.value,
            totalHours: form.totalHours.value,
            remarks: form.remarks.value.trim(),
            description: form.description.value.trim()
        };
        
        console.log('Sending data to server:', data);
        if (!data.courseCode || !data.descriptiveTitle || !data.yearLevel) {
            showBubbleMessage("Course Code, Descriptive Title, and Year Level are required.", "error");
            return;
        }
        
        try {
            let url = 'http://localhost:3001/subjects';
            let method = 'POST';
            if (editMode) {
                url += `/${editingId}`;
                method = 'PUT';
            }
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await res.json();
            if (res.ok) {
                showBubbleMessage(editMode ? "Subject updated successfully." : "Subject created successfully.", "success");
                modal.style.display = 'none';
                form.reset();
                loadSubjects();
            } else {
                showBubbleMessage(result.error || (editMode ? "Failed to update subject." : "Failed to create subject."), "error");
            }
        } catch (err) {
            showBubbleMessage("Failed to save subject.", "error");
        }
    };

    // Edit modal logic
    async function openEditModal(id) {
        try {
            const res = await fetch('http://localhost:3001/subjects');
            const data = await res.json();
            const subject = data.find(s => s._id === id);
            if (!subject) return;
            
            editMode = true;
            editingId = id;
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
            
            modalTitle.textContent = 'Edit Subject';
            submitBtn.textContent = 'Save Changes';
            modal.style.display = 'flex';
        } catch (err) {
            showBubbleMessage("Error loading subject for edit.", "error");
        }
    }

    // Delete modal logic
    const deleteModal = document.getElementById('deleteSubjectModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteSubjectBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteSubjectBtn');
    const deleteModalText = document.getElementById('deleteModalText');
    let deleteSubjectId = null;

    async function handleDelete(id) {
        // Fetch subject for name (optional)
        let subject = null;
        try {
            const res = await fetch('http://localhost:3001/subjects');
            const data = await res.json();
            subject = data.find(s => s._id === id);
        } catch {}
        deleteSubjectId = id;
        deleteModalText.textContent = subject
            ? `Are you sure you want to delete "${subject.descriptiveTitle}" (${subject.courseCode})?`
            : 'Are you sure you want to delete this subject?';
        deleteModal.style.display = 'flex';
    }

    cancelDeleteBtn.onclick = () => {
        deleteModal.style.display = 'none';
        deleteSubjectId = null;
    };

    confirmDeleteBtn.onclick = async () => {
        if (!deleteSubjectId) return;
        try {
            const res = await fetch(`http://localhost:3001/subjects/${deleteSubjectId}`, {
                method: 'DELETE'
            });
            const result = await res.json();
            if (res.ok) {
                showBubbleMessage("Subject deleted successfully.", "success");
                loadSubjects();
            } else {
                showBubbleMessage(result.error || "Failed to delete subject.", "error");
            }
        } catch (err) {
            showBubbleMessage("Failed to delete subject.", "error");
        }
        deleteModal.style.display = 'none';
        deleteSubjectId = null;
    };

    deleteModal.addEventListener('click', function(e) {
        if (e.target === deleteModal) {
            deleteModal.style.display = 'none';
            deleteSubjectId = null;
        }
    });

    // Description modal logic
    const descModal = document.getElementById('descSubjectModal');
    const closeDescBtn = document.getElementById('closeDescSubjectBtn');
    const descModalText = document.getElementById('descModalText');

    async function showDescription(id) {
        try {
            const res = await fetch('http://localhost:3001/subjects');
            const data = await res.json();
            const subject = data.find(s => s._id === id);
            descModalText.textContent = subject && subject.description ? subject.description : "No description provided.";
            descModal.style.display = 'flex';
        } catch {
            descModalText.textContent = "Unable to load description.";
            descModal.style.display = 'flex';
        }
    }

    closeDescBtn.onclick = () => {
        descModal.style.display = 'none';
    };

    descModal.addEventListener('click', function(e) {
        if (e.target === descModal) descModal.style.display = 'none';
    });

    // Initial load
    loadSubjects();
});
