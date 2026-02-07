// DOM Elements
const postForm = document.getElementById('postForm');
const uploadZone = document.getElementById('uploadZone');
const mediaInput = document.getElementById('mediaInput');
const previewGrid = document.getElementById('previewGrid');
const captionInput = document.getElementById('caption');
const charCount = document.getElementById('charCount');
const submitBtn = document.getElementById('submitBtn');
const resultsContainer = document.getElementById('results');
const selectAllBtn = document.getElementById('selectAllBtn');
const platformCheckboxes = document.querySelectorAll('input[name="platforms"]');
const themeToggle = document.getElementById('themeToggle');
const logoutBtn = document.getElementById('logoutBtn');

// Scheduling elements
const scheduleToggle = document.getElementById('scheduleToggle');
const schedulePicker = document.getElementById('schedulePicker');
const scheduleTimeInput = document.getElementById('scheduleTime');
const scheduledSection = document.getElementById('scheduledSection');
const scheduledList = document.getElementById('scheduledList');
const refreshScheduledBtn = document.getElementById('refreshScheduled');

// Settings Modal
const settingsModal = document.getElementById('settingsModal');
const openSettingsBtn = document.getElementById('openSettings');
const closeSettingsBtn = document.getElementById('closeSettings');
const cancelSettingsBtn = document.getElementById('cancelSettings');
const settingsForm = document.getElementById('settingsForm');

// State
let selectedFiles = [];
let allSelected = false;
let currentUser = null;

// ======================
// Initialize
// ======================
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();

    // Check authentication first
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        window.location.href = '/auth';
        return;
    }

    checkStatus();
    loadSettings();
    setupEventListeners();
    loadScheduledPosts();
});

// ======================
// Authentication
// ======================
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();

        if (data.authenticated) {
            currentUser = data.user;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Auth check failed:', error);
        return false;
    }
}

async function handleLogout() {
    try {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            window.location.href = '/auth';
        }
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// ======================
// Theme Management
// ======================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// ======================
// Check platform status
// ======================
async function checkStatus() {
    try {
        const response = await fetch('/api/post/status');
        const status = await response.json();

        // Update platform chip states based on configuration
        Object.keys(status).forEach(platform => {
            const chip = document.querySelector(`.platform-chip[data-platform="${platform}"]`);
            if (chip && !status[platform].configured) {
                chip.classList.add('not-configured');
                chip.title = `${platform.charAt(0).toUpperCase() + platform.slice(1)} - Setup needed`;
            }
        });
    } catch (error) {
        console.error('Failed to check status:', error);
    }
}

// ======================
// Load/Save Settings
// ======================
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();

        // Populate form fields
        Object.keys(settings).forEach(key => {
            const input = document.getElementById(key);
            if (input && settings[key]) {
                input.value = settings[key];
            }
        });
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

async function saveSettings(formData) {
    try {
        const settings = {};
        formData.forEach((value, key) => {
            if (value) settings[key] = value;
        });

        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });

        if (response.ok) {
            showNotification('Settings saved successfully!', 'success');
            closeModal();
            checkStatus();
        } else {
            const data = await response.json();
            showNotification(data.error || 'Failed to save settings', 'error');
        }
    } catch (error) {
        showNotification('Failed to save settings: ' + error.message, 'error');
    }
}

// ======================
// Event Listeners
// ======================
function setupEventListeners() {
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Upload zone click
    uploadZone.addEventListener('click', () => mediaInput.click());

    // File input change
    mediaInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');

        const files = Array.from(e.dataTransfer.files);
        addFiles(files);
    });

    // Caption character count
    captionInput.addEventListener('input', () => {
        charCount.textContent = captionInput.value.length;
    });

    // Form submission
    postForm.addEventListener('submit', handleSubmit);

    // Select All button
    selectAllBtn.addEventListener('click', handleSelectAll);
    platformCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateSelectAllState);
    });

    // Settings modal
    openSettingsBtn.addEventListener('click', openModal);
    closeSettingsBtn.addEventListener('click', closeModal);
    cancelSettingsBtn.addEventListener('click', closeModal);
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeModal();
    });

    // Settings form submission
    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(settingsForm);
        saveSettings(formData);
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsModal.classList.contains('active')) {
            closeModal();
        }
    });

    // Schedule toggle
    if (scheduleToggle) {
        scheduleToggle.addEventListener('change', handleScheduleToggle);
    }

    // Refresh scheduled posts
    if (refreshScheduledBtn) {
        refreshScheduledBtn.addEventListener('click', loadScheduledPosts);
    }
}

// ======================
// Select All
// ======================
function handleSelectAll() {
    allSelected = !allSelected;
    platformCheckboxes.forEach(checkbox => {
        checkbox.checked = allSelected;
    });
    updateSelectAllState();
}

function updateSelectAllState() {
    const allChecked = Array.from(platformCheckboxes).every(cb => cb.checked);
    allSelected = allChecked;
    selectAllBtn.classList.toggle('active', allChecked);
}

// ======================
// Modal
// ======================
function openModal() {
    settingsModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    settingsModal.classList.remove('active');
    document.body.style.overflow = '';
}

// ======================
// File Handling
// ======================
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    addFiles(files);
    // Reset input so the same file can be selected again
    e.target.value = '';
}

function addFiles(newFiles) {
    // Filter valid files
    const validFiles = newFiles.filter(file => {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        return isImage || isVideo;
    });

    if (validFiles.length === 0) {
        showNotification('Please select valid image or video files', 'error');
        return;
    }

    // Check for mixed media
    const hasExistingImages = selectedFiles.some(f => f.type.startsWith('image/'));
    const hasExistingVideos = selectedFiles.some(f => f.type.startsWith('video/'));
    const hasNewImages = validFiles.some(f => f.type.startsWith('image/'));
    const hasNewVideos = validFiles.some(f => f.type.startsWith('video/'));

    if ((hasExistingImages && hasNewVideos) || (hasExistingVideos && hasNewImages) ||
        (hasNewImages && hasNewVideos)) {
        showNotification('Cannot mix photos and videos in the same post', 'error');
        return;
    }

    // Check video limit
    if (hasNewVideos && (validFiles.length > 1 || selectedFiles.length > 0)) {
        showNotification('Only one video per post is allowed', 'error');
        return;
    }

    // Check photo limit
    const totalPhotos = selectedFiles.length + validFiles.length;
    if (hasNewImages && totalPhotos > 10) {
        showNotification('Maximum 10 photos allowed', 'error');
        return;
    }

    // Add files
    selectedFiles = [...selectedFiles, ...validFiles];
    updatePreview();
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updatePreview();
}

function updatePreview() {
    previewGrid.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = `preview-item ${file.type.startsWith('video/') ? 'video' : ''}`;

        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = file.name;
            item.appendChild(img);
        } else {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.muted = true;
            item.appendChild(video);
        }

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeFile(index);
        };
        item.appendChild(removeBtn);

        previewGrid.appendChild(item);
    });
}

// ======================
// Form Submission
// ======================
async function handleSubmit(e) {
    e.preventDefault();

    // Validate files
    if (selectedFiles.length === 0) {
        showNotification('Please select at least one photo or video', 'error');
        return;
    }

    // Get selected platforms
    const platformInputs = document.querySelectorAll('input[name="platforms"]:checked');
    const platforms = Array.from(platformInputs).map(input => input.value);

    if (platforms.length === 0) {
        showNotification('Please select at least one platform', 'error');
        return;
    }

    // Check if scheduling
    const isScheduling = scheduleToggle && scheduleToggle.checked;

    if (isScheduling) {
        // Validate schedule time
        if (!scheduleTimeInput || !scheduleTimeInput.value) {
            showNotification('Please select a schedule time', 'error');
            return;
        }

        const scheduleTime = new Date(scheduleTimeInput.value);
        if (scheduleTime <= new Date()) {
            showNotification('Schedule time must be in the future', 'error');
            return;
        }
    }

    // Show loading state
    setLoading(true);
    clearResults();

    try {
        // Create form data
        const formData = new FormData();

        selectedFiles.forEach(file => {
            formData.append('media', file);
        });

        formData.append('platforms', JSON.stringify(platforms));
        formData.append('caption', captionInput.value);

        // Determine endpoint
        let endpoint = '/api/post';

        if (isScheduling) {
            endpoint = '/api/scheduled';
            formData.append('scheduledAt', scheduleTimeInput.value);
        }

        // Send request
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (isScheduling) {
            // Handle scheduled post response
            if (data.success) {
                showNotification('Post scheduled successfully!', 'success');
                clearForm();
                loadScheduledPosts();
            } else {
                showNotification(data.error || 'Failed to schedule post', 'error');
            }
        } else {
            // Show immediate post results
            showResults(data.results || [{ success: false, error: data.error }]);

            // Clear form on full success
            if (data.success) {
                clearForm();
            }
        }

    } catch (error) {
        showResults([{ success: false, platform: 'all', error: error.message }]);
    } finally {
        setLoading(false);
    }
}

// ======================
// UI Helpers
// ======================
function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle('loading', loading);
}

function clearResults() {
    resultsContainer.innerHTML = '';
}

function clearForm() {
    selectedFiles = [];
    updatePreview();
    captionInput.value = '';
    charCount.textContent = '0';

    // Reset schedule toggle
    if (scheduleToggle) {
        scheduleToggle.checked = false;
        schedulePicker.style.display = 'none';
        const btnText = submitBtn.querySelector('.btn-text');
        if (btnText) btnText.textContent = 'Share Now';
    }
}

function showResults(results) {
    resultsContainer.innerHTML = '';

    results.forEach(result => {
        const item = document.createElement('div');
        item.className = `result-item ${result.success ? 'success' : 'error'}`;

        item.innerHTML = `
      <div class="result-icon">${result.success ? '✓' : '✗'}</div>
      <div class="result-content">
        <div class="result-platform">${result.platform || 'Unknown'}</div>
        <div class="result-message">${result.success ? result.message : result.error}</div>
      </div>
    `;

        resultsContainer.appendChild(item);
    });
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    // Create notification
    const notification = document.createElement('div');
    notification.className = `result-item ${type === 'success' ? 'success' : 'error'} notification`;
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1001;
    min-width: 280px;
    max-width: 90vw;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  `;

    const icon = type === 'success' ? '✓' : '⚠';
    notification.innerHTML = `
    <div class="result-icon">${icon}</div>
    <div class="result-content">
      <div class="result-message">${message}</div>
    </div>
  `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(-50%) translateY(-10px)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ======================
// Scheduling Functions
// ======================
function handleScheduleToggle() {
    const isScheduling = scheduleToggle.checked;
    schedulePicker.style.display = isScheduling ? 'flex' : 'none';

    // Update submit button text
    const btnText = submitBtn.querySelector('.btn-text');
    if (btnText) {
        btnText.textContent = isScheduling ? 'Schedule Post' : 'Share Now';
    }

    // Set minimum datetime to now
    if (isScheduling && scheduleTimeInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 5); // At least 5 minutes from now
        const formatted = now.toISOString().slice(0, 16);
        scheduleTimeInput.min = formatted;
        scheduleTimeInput.value = formatted;
    }
}

async function loadScheduledPosts() {
    try {
        const response = await fetch('/api/scheduled');
        const data = await response.json();

        if (!data.success) {
            console.error('Failed to load scheduled posts:', data.error);
            return;
        }

        const posts = data.posts || [];

        // Show/hide section based on posts
        if (posts.length === 0) {
            scheduledSection.style.display = 'none';
            return;
        }

        scheduledSection.style.display = 'block';
        renderScheduledPosts(posts);
    } catch (error) {
        console.error('Error loading scheduled posts:', error);
    }
}

function renderScheduledPosts(posts) {
    scheduledList.innerHTML = posts.map(post => {
        const scheduledDate = new Date(post.scheduled_at);
        const formattedDate = scheduledDate.toLocaleString();
        const platformIcons = post.platforms.map(p => getPlatformIcon(p)).join('');
        const caption = post.caption ? post.caption.substring(0, 50) + (post.caption.length > 50 ? '...' : '') : 'No caption';

        return `
            <div class="scheduled-item" data-id="${post.id}">
                <div class="scheduled-item-info">
                    <div class="scheduled-item-platforms">${platformIcons}</div>
                    <div class="scheduled-item-time">${formattedDate}</div>
                    <div class="scheduled-item-caption">${escapeHtml(caption)}</div>
                </div>
                <span class="scheduled-item-status ${post.status}">${post.status}</span>
                ${post.status === 'pending' ? `
                    <button type="button" class="cancel-scheduled-btn" onclick="cancelScheduledPost('${post.id}')" title="Cancel">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
}

function getPlatformIcon(platform) {
    const icons = {
        facebook: '<svg viewBox="0 0 24 24" fill="currentColor" style="color: #1877f2;"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
        telegram: '<svg viewBox="0 0 24 24" fill="currentColor" style="color: #26a5e4;"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>',
        tiktok: '<svg viewBox="0 0 24 24" fill="currentColor" style="color: #ff0050;"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
        instagram: '<svg viewBox="0 0 24 24" fill="currentColor" style="color: #e4405f;"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>',
        youtube: '<svg viewBox="0 0 24 24" fill="currentColor" style="color: #ff0000;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>'
    };
    return icons[platform] || '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function cancelScheduledPost(postId) {
    if (!confirm('Are you sure you want to cancel this scheduled post?')) {
        return;
    }

    try {
        const response = await fetch(`/api/scheduled/${postId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Scheduled post cancelled', 'success');
            loadScheduledPosts();
        } else {
            showNotification(data.error || 'Failed to cancel', 'error');
        }
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}
