/**
 * Profile Picture Manager
 * Comprehensive profile picture management system with upload, crop, preview, and delete
 */

class ProfilePictureManager {
    constructor(options = {}) {
        this.options = {
            maxFileSize: options.maxFileSize || 2 * 1024 * 1024, // 2MB default
            acceptedFormats: options.acceptedFormats || ['image/jpeg', 'image/png', 'image/jpg'],
            cropAspectRatio: options.cropAspectRatio || 1, // 1:1 square by default
            apiEndpoint: options.apiEndpoint || '/upload-profile-picture',
            deleteEndpoint: options.deleteEndpoint || '/delete-profile-picture',
            onSuccess: options.onSuccess || (() => {}),
            onError: options.onError || (() => {}),
            ...options
        };
        
        this.currentFile = null;
        this.currentUserId = null;
        this.currentUserType = null; // 'teacher' or 'student'
        this.cropper = null;
        
        this.init();
    }
    
    init() {
        this.createModal();
        this.createDeleteModal();
        this.injectStyles();
    }
    
    createModal() {
        if (document.getElementById('profilePictureModal')) {
            this.modal = document.getElementById('profilePictureModal');
            return;
        }
        
        const modal = document.createElement('div');
        modal.id = 'profilePictureModal';
        modal.className = 'profile-pic-modal-overlay';
        modal.innerHTML = `
            <div class="profile-pic-modal-content">
                <div class="profile-pic-modal-header">
                    <h3>Edit Profile Picture</h3>
                    <button class="profile-pic-modal-close" aria-label="Close">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                
                <div class="profile-pic-modal-body">
                    <!-- Upload Section -->
                    <div class="profile-pic-upload-section" id="uploadSection">
                        <div class="profile-pic-current-preview">
                            <img id="currentProfilePic" src="/img/default_avatar.png" alt="Current profile picture">
                            <div class="profile-pic-overlay">
                                <i class="bi bi-camera-fill"></i>
                                <span>Change Photo</span>
                            </div>
                        </div>
                        
                        <div class="profile-pic-upload-area" id="uploadArea">
                            <input type="file" id="profilePicInput" accept="image/jpeg,image/png,image/jpg" hidden>
                            <i class="bi bi-cloud-upload"></i>
                            <p>Click to upload or drag and drop</p>
                            <span class="profile-pic-upload-hint">JPG or PNG (Max 2MB)</span>
                        </div>
                        
                        <div class="profile-pic-actions">
                            <button class="profile-pic-btn profile-pic-btn-secondary" id="deleteProfilePicBtn">
                                <i class="bi bi-trash"></i> Delete Picture
                            </button>
                        </div>
                    </div>
                    
                    <!-- Crop Section -->
                    <div class="profile-pic-crop-section" id="cropSection" style="display: none;">
                        <div class="profile-pic-crop-container">
                            <img id="cropImage" src="" alt="Image to crop">
                        </div>
                        
                        <div class="profile-pic-crop-controls">
                            <button class="profile-pic-btn profile-pic-btn-icon" id="rotateLeftBtn" title="Rotate left">
                                <i class="bi bi-arrow-counterclockwise"></i>
                            </button>
                            <button class="profile-pic-btn profile-pic-btn-icon" id="rotateRightBtn" title="Rotate right">
                                <i class="bi bi-arrow-clockwise"></i>
                            </button>
                            <button class="profile-pic-btn profile-pic-btn-icon" id="flipHorizontalBtn" title="Flip horizontal">
                                <i class="bi bi-arrows-expand"></i>
                            </button>
                            <button class="profile-pic-btn profile-pic-btn-icon" id="resetCropBtn" title="Reset">
                                <i class="bi bi-arrow-clockwise"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Loading State -->
                    <div class="profile-pic-loading" id="profilePicLoading" style="display: none;">
                        <div class="profile-pic-spinner"></div>
                        <p>Uploading...</p>
                    </div>
                </div>
                
                <div class="profile-pic-modal-footer">
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="cancelProfilePicBtn">Cancel</button>
                    <button class="profile-pic-btn profile-pic-btn-primary" id="saveProfilePicBtn" style="display: none;">
                        <i class="bi bi-check-lg"></i> Save Picture
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.modal = modal;
        this.attachModalEvents();
    }
    
    createDeleteModal() {
        if (document.getElementById('deleteProfilePicModal')) {
            this.deleteModal = document.getElementById('deleteProfilePicModal');
            return;
        }
        
        const modal = document.createElement('div');
        modal.id = 'deleteProfilePicModal';
        modal.className = 'profile-pic-modal-overlay';
        modal.innerHTML = `
            <div class="profile-pic-modal-content profile-pic-modal-small">
                <div class="profile-pic-modal-header">
                    <h3>Delete Profile Picture</h3>
                </div>
                
                <div class="profile-pic-modal-body">
                    <p>Are you sure you want to delete this profile picture? The default placeholder will be restored.</p>
                </div>
                
                <div class="profile-pic-modal-footer">
                    <button class="profile-pic-btn profile-pic-btn-secondary" id="cancelDeleteProfilePicBtn">Cancel</button>
                    <button class="profile-pic-btn profile-pic-btn-danger" id="confirmDeleteProfilePicBtn">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.deleteModal = modal;
        this.attachDeleteModalEvents();
    }
    
    attachModalEvents() {
        const closeBtn = this.modal.querySelector('.profile-pic-modal-close');
        const cancelBtn = this.modal.querySelector('#cancelProfilePicBtn');
        const saveBtn = this.modal.querySelector('#saveProfilePicBtn');
        const uploadArea = this.modal.querySelector('#uploadArea');
        const fileInput = this.modal.querySelector('#profilePicInput');
        const deleteBtn = this.modal.querySelector('#deleteProfilePicBtn');
        
        // Close modal
        closeBtn.addEventListener('click', () => this.close());
        cancelBtn.addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
        
        // Upload area click
        uploadArea.addEventListener('click', () => fileInput.click());
        
        // File input change
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });
        
        // Save button
        saveBtn.addEventListener('click', () => this.saveProfilePicture());
        
        // Delete button
        deleteBtn.addEventListener('click', () => this.showDeleteConfirmation());
        
        // Crop controls
        const rotateLeftBtn = this.modal.querySelector('#rotateLeftBtn');
        const rotateRightBtn = this.modal.querySelector('#rotateRightBtn');
        const flipHorizontalBtn = this.modal.querySelector('#flipHorizontalBtn');
        const resetCropBtn = this.modal.querySelector('#resetCropBtn');
        
        if (rotateLeftBtn) rotateLeftBtn.addEventListener('click', () => this.rotateCrop(-90));
        if (rotateRightBtn) rotateRightBtn.addEventListener('click', () => this.rotateCrop(90));
        if (flipHorizontalBtn) flipHorizontalBtn.addEventListener('click', () => this.flipCrop());
        if (resetCropBtn) resetCropBtn.addEventListener('click', () => this.resetCrop());
    }
    
    attachDeleteModalEvents() {
        const cancelBtn = this.deleteModal.querySelector('#cancelDeleteProfilePicBtn');
        const confirmBtn = this.deleteModal.querySelector('#confirmDeleteProfilePicBtn');
        
        cancelBtn.addEventListener('click', () => this.hideDeleteConfirmation());
        confirmBtn.addEventListener('click', () => this.deleteProfilePicture());
        
        this.deleteModal.addEventListener('click', (e) => {
            if (e.target === this.deleteModal) this.hideDeleteConfirmation();
        });
    }
    
    /**
     * Open the profile picture editor
     * @param {string} userId - User ID
     * @param {string} currentPicture - Current profile picture URL
     * @param {string} userType - 'teacher' or 'student'
     */
    open(userId, currentPicture = null, userType = 'teacher') {
        this.currentUserId = userId;
        this.currentUserType = userType;
        
        // Set current picture
        const currentPic = this.modal.querySelector('#currentProfilePic');
        if (currentPicture && currentPicture !== '') {
            currentPic.src = currentPicture;
        } else {
            currentPic.src = userType === 'teacher' 
                ? '/img/default_teacher_avatar.png' 
                : '/img/default_student_avatar.png';
        }
        
        // Reset state
        this.resetModal();
        
        // Show modal
        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    close() {
        this.modal.style.display = 'none';
        document.body.style.overflow = '';
        this.resetModal();
    }
    
    resetModal() {
        const uploadSection = this.modal.querySelector('#uploadSection');
        const cropSection = this.modal.querySelector('#cropSection');
        const saveBtn = this.modal.querySelector('#saveProfilePicBtn');
        const fileInput = this.modal.querySelector('#profilePicInput');
        
        uploadSection.style.display = 'block';
        cropSection.style.display = 'none';
        saveBtn.style.display = 'none';
        fileInput.value = '';
        
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
        
        this.currentFile = null;
    }
    
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }
    
    handleFile(file) {
        // Validate file type
        if (!this.options.acceptedFormats.includes(file.type)) {
            this.options.onError('Please select a valid image file (JPG or PNG)');
            return;
        }
        
        // Validate file size
        if (file.size > this.options.maxFileSize) {
            this.options.onError(`File size must be less than ${this.options.maxFileSize / (1024 * 1024)}MB`);
            return;
        }
        
        this.currentFile = file;
        this.showCropSection(file);
    }
    
    showCropSection(file) {
        const uploadSection = this.modal.querySelector('#uploadSection');
        const cropSection = this.modal.querySelector('#cropSection');
        const saveBtn = this.modal.querySelector('#saveProfilePicBtn');
        const cropImage = this.modal.querySelector('#cropImage');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            cropImage.src = e.target.result;
            
            uploadSection.style.display = 'none';
            cropSection.style.display = 'block';
            saveBtn.style.display = 'inline-flex';
            
            // Initialize cropper (using a simple implementation without external library)
            this.initSimpleCropper(cropImage);
        };
        reader.readAsDataURL(file);
    }
    
    initSimpleCropper(image) {
        // Simple cropper implementation without external dependencies
        // For production, consider using Cropper.js library
        image.style.maxWidth = '100%';
        image.style.maxHeight = '400px';
        image.style.objectFit = 'contain';
    }
    
    rotateCrop(degrees) {
        const cropImage = this.modal.querySelector('#cropImage');
        const currentRotation = parseInt(cropImage.dataset.rotation || '0');
        const newRotation = currentRotation + degrees;
        cropImage.dataset.rotation = newRotation;
        cropImage.style.transform = `rotate(${newRotation}deg)`;
    }
    
    flipCrop() {
        const cropImage = this.modal.querySelector('#cropImage');
        const currentFlip = cropImage.dataset.flip === 'true';
        cropImage.dataset.flip = !currentFlip;
        const rotation = parseInt(cropImage.dataset.rotation || '0');
        cropImage.style.transform = `rotate(${rotation}deg) scaleX(${currentFlip ? 1 : -1})`;
    }
    
    resetCrop() {
        const cropImage = this.modal.querySelector('#cropImage');
        cropImage.dataset.rotation = '0';
        cropImage.dataset.flip = 'false';
        cropImage.style.transform = '';
    }
    
    async saveProfilePicture() {
        if (!this.currentFile || !this.currentUserId) return;
        
        const loadingEl = this.modal.querySelector('#profilePicLoading');
        const cropSection = this.modal.querySelector('#cropSection');
        const saveBtn = this.modal.querySelector('#saveProfilePicBtn');
        
        try {
            // Show loading
            cropSection.style.display = 'none';
            loadingEl.style.display = 'flex';
            saveBtn.disabled = true;
            
            // Create form data
            const formData = new FormData();
            formData.append('profilePicture', this.currentFile);
            
            // Upload
            const response = await fetch(`${this.options.apiEndpoint}/${this.currentUserId}`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.options.onSuccess(result.profilePicture, this.currentUserId);
                this.close();
            } else {
                throw new Error(result.error || 'Failed to upload profile picture');
            }
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            this.options.onError(error.message || 'Failed to upload profile picture');
            
            // Reset UI
            loadingEl.style.display = 'none';
            cropSection.style.display = 'block';
            saveBtn.disabled = false;
        }
    }
    
    showDeleteConfirmation() {
        this.deleteModal.style.display = 'flex';
    }
    
    hideDeleteConfirmation() {
        this.deleteModal.style.display = 'none';
    }
    
    async deleteProfilePicture() {
        if (!this.currentUserId) return;
        
        try {
            const response = await fetch(`${this.options.deleteEndpoint}/${this.currentUserId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.options.onSuccess(null, this.currentUserId);
                this.hideDeleteConfirmation();
                this.close();
            } else {
                throw new Error(result.error || 'Failed to delete profile picture');
            }
        } catch (error) {
            console.error('Error deleting profile picture:', error);
            this.options.onError(error.message || 'Failed to delete profile picture');
        }
    }
    
    injectStyles() {
        if (document.getElementById('profile-pic-manager-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'profile-pic-manager-styles';
        style.textContent = `
            /* Profile Picture Modal */
            .profile-pic-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
                z-index: 10000;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 20px;
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .profile-pic-modal-content {
                background: white;
                border-radius: 16px;
                max-width: 600px;
                width: 100%;
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: slideUp 0.3s ease;
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .profile-pic-modal-small {
                max-width: 400px;
            }
            
            .profile-pic-modal-header {
                padding: 20px 24px;
                border-bottom: 1px solid #e5e8eb;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .profile-pic-modal-header h3 {
                margin: 0;
                font-size: 1.25rem;
                font-weight: 700;
                color: #002D62;
            }
            
            .profile-pic-modal-close {
                background: none;
                border: none;
                font-size: 1.5rem;
                color: #666;
                cursor: pointer;
                padding: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: all 0.2s ease;
            }
            
            .profile-pic-modal-close:hover {
                background: #f5f5f5;
                color: #333;
            }
            
            .profile-pic-modal-body {
                padding: 24px;
                overflow-y: auto;
                flex: 1;
            }
            
            .profile-pic-modal-footer {
                padding: 16px 24px;
                border-top: 1px solid #e5e8eb;
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }
            
            /* Current Preview */
            .profile-pic-current-preview {
                width: 150px;
                height: 150px;
                margin: 0 auto 24px;
                position: relative;
                border-radius: 50%;
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }
            
            .profile-pic-current-preview img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .profile-pic-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
                color: white;
                font-size: 0.9rem;
                font-weight: 600;
            }
            
            .profile-pic-current-preview:hover .profile-pic-overlay {
                opacity: 1;
            }
            
            .profile-pic-overlay i {
                font-size: 2rem;
                margin-bottom: 8px;
            }
            
            /* Upload Area */
            .profile-pic-upload-area {
                border: 2px dashed #d0d5dd;
                border-radius: 12px;
                padding: 40px 20px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                background: #f9fafb;
            }
            
            .profile-pic-upload-area:hover,
            .profile-pic-upload-area.drag-over {
                border-color: #3E8EDE;
                background: #EAF3FF;
            }
            
            .profile-pic-upload-area i {
                font-size: 3rem;
                color: #3E8EDE;
                display: block;
                margin-bottom: 12px;
            }
            
            .profile-pic-upload-area p {
                margin: 0 0 8px 0;
                font-size: 1rem;
                font-weight: 600;
                color: #333;
            }
            
            .profile-pic-upload-hint {
                font-size: 0.875rem;
                color: #666;
            }
            
            /* Crop Section */
            .profile-pic-crop-container {
                max-height: 400px;
                overflow: hidden;
                border-radius: 8px;
                background: #f5f5f5;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 16px;
            }
            
            .profile-pic-crop-container img {
                max-width: 100%;
                max-height: 400px;
                display: block;
                transition: transform 0.3s ease;
            }
            
            .profile-pic-crop-controls {
                display: flex;
                gap: 8px;
                justify-content: center;
            }
            
            /* Actions */
            .profile-pic-actions {
                margin-top: 20px;
                display: flex;
                justify-content: center;
            }
            
            /* Buttons */
            .profile-pic-btn {
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 0.95rem;
                font-weight: 600;
                border: none;
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                justify-content: center;
            }
            
            .profile-pic-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .profile-pic-btn-primary {
                background: #3E8EDE;
                color: white;
            }
            
            .profile-pic-btn-primary:hover:not(:disabled) {
                background: #2E7ECE;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(62, 142, 222, 0.3);
            }
            
            .profile-pic-btn-secondary {
                background: #e5e8eb;
                color: #555;
            }
            
            .profile-pic-btn-secondary:hover:not(:disabled) {
                background: #d5d8db;
            }
            
            .profile-pic-btn-danger {
                background: #d8000c;
                color: white;
            }
            
            .profile-pic-btn-danger:hover:not(:disabled) {
                background: #a3000c;
            }
            
            .profile-pic-btn-icon {
                width: 40px;
                height: 40px;
                padding: 0;
                border-radius: 50%;
            }
            
            /* Loading */
            .profile-pic-loading {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px 20px;
                gap: 16px;
            }
            
            .profile-pic-spinner {
                width: 48px;
                height: 48px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3E8EDE;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .profile-pic-loading p {
                margin: 0;
                font-size: 1rem;
                font-weight: 600;
                color: #666;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .profile-pic-modal-content {
                    max-width: 95%;
                    max-height: 95vh;
                }
                
                .profile-pic-modal-header,
                .profile-pic-modal-body,
                .profile-pic-modal-footer {
                    padding: 16px;
                }
                
                .profile-pic-current-preview {
                    width: 120px;
                    height: 120px;
                }
                
                .profile-pic-upload-area {
                    padding: 30px 15px;
                }
                
                .profile-pic-modal-footer {
                    flex-direction: column-reverse;
                }
                
                .profile-pic-btn {
                    width: 100%;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
}

export default ProfilePictureManager;
