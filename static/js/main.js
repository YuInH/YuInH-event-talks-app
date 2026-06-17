// Global Application State
let allReleaseNotes = [];
let filteredReleaseNotes = [];
let selectedItemId = null;
let activeCategory = 'all';
let searchQuery = '';
let activeSort = 'newest';
let lastFetchedTime = null;

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const retryBtn = document.getElementById('retry-btn');
const lastUpdatedText = document.getElementById('last-updated-text');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const sortSelect = document.getElementById('sort-select');
const categoryFilters = document.getElementById('category-filters');
const feedItemsContainer = document.getElementById('feed-items');
const themeToggleBtn = document.getElementById('theme-toggle');
const exportCsvBtn = document.getElementById('export-csv-btn');

// State Containers
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');

// Stats Counters
const countTotal = document.getElementById('count-total');
const countFeatures = document.getElementById('count-features');
const countAnnouncements = document.getElementById('count-announcements');
const countIssues = document.getElementById('count-issues');

// Composer DOM Elements
const composerEmptyState = document.getElementById('composer-empty-state');
const composerWorkspace = document.getElementById('composer-workspace');
const composerBadge = document.getElementById('composer-badge');
const composerDate = document.getElementById('composer-date');
const composerUpdateHtml = document.getElementById('composer-update-html');
const tweetTextarea = document.getElementById('tweet-textarea');
const tweetPreviewText = document.getElementById('tweet-preview-text');
const charCountText = document.getElementById('char-count');
const progressCircle = document.querySelector('.progress-ring__circle');
const copyTweetBtn = document.getElementById('copy-tweet-btn');
const tweetBtn = document.getElementById('tweet-btn');
const closeComposerBtn = document.getElementById('close-composer-btn');
const resetTweetBtn = document.getElementById('reset-tweet-btn');

// Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Toast
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Create Mobile Overlay Backdrop
let composerOverlay = document.createElement('div');
composerOverlay.className = 'composer-overlay';
document.body.appendChild(composerOverlay);

/* ==========================================================================
   Data Fetching & Cache Synchronization
   ========================================================================== */
async function fetchReleaseNotes(forceRefresh = false) {
    showLoading();
    
    // Animate spinner icon
    const spinner = refreshBtn.querySelector('.spinner-icon');
    if (spinner) spinner.classList.add('spinning');
    refreshBtn.disabled = true;

    try {
        const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            allReleaseNotes = data.items;
            lastFetchedTime = data.last_fetched;
            updateSyncStatus();
            calculateStats();
            applyFiltersAndRender();
            
            if (data.warning) {
                showToast(data.warning, 'warning');
            } else if (forceRefresh) {
                showToast('Release notes successfully updated!', 'success');
            }
        } else {
            showError(data.error || 'Failed to fetch release notes.');
        }
    } catch (err) {
        showError('Network error occurred. Check your connection and try again.');
        console.error(err);
    } finally {
        if (spinner) spinner.classList.remove('spinning');
        refreshBtn.disabled = false;
    }
}

/* ==========================================================================
   Stats & Filtering Logic
   ========================================================================== */
function calculateStats() {
    countTotal.textContent = allReleaseNotes.length;
    
    const features = allReleaseNotes.filter(item => item.category.toLowerCase() === 'feature').length;
    const announcements = allReleaseNotes.filter(item => item.category.toLowerCase() === 'announcement').length;
    
    // Issues, Deprecated, and Fixes grouped for overview
    const issuesAndFixes = allReleaseNotes.filter(item => 
        ['issue', 'fix', 'deprecated'].includes(item.category.toLowerCase())
    ).length;
    
    countFeatures.textContent = features;
    countAnnouncements.textContent = announcements;
    countIssues.textContent = issuesAndFixes;
}

function updateSyncStatus() {
    if (!lastFetchedTime) {
        lastUpdatedText.textContent = 'Never updated';
        return;
    }

    const updateText = () => {
        const seconds = Math.floor((Date.now() - (lastFetchedTime * 1000)) / 1000);
        
        if (seconds < 60) {
            lastUpdatedText.textContent = 'Just updated';
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            lastUpdatedText.textContent = `Updated ${minutes}m ago`;
        } else {
            const hours = Math.floor(seconds / 3600);
            lastUpdatedText.textContent = `Updated ${hours}h ago`;
        }
    };
    
    updateText();
    // Auto refresh status line every 30 seconds
    if (window.statusInterval) clearInterval(window.statusInterval);
    window.statusInterval = setInterval(updateText, 30000);
}

function applyFiltersAndRender() {
    // 1. Apply Category Filter
    filteredReleaseNotes = allReleaseNotes;
    if (activeCategory !== 'all') {
        filteredReleaseNotes = allReleaseNotes.filter(item => 
            item.category.toLowerCase() === activeCategory
        );
    }

    // 2. Apply Search Query Filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredReleaseNotes = filteredReleaseNotes.filter(item => 
            item.content_text.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query) ||
            item.date.toLowerCase().includes(query)
        );
    }

    // 3. Apply Sorting
    filteredReleaseNotes.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return activeSort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    renderFeed();
}

/* ==========================================================================
   UI Rendering
   ========================================================================== */
function renderFeed() {
    feedItemsContainer.innerHTML = '';
    
    if (filteredReleaseNotes.length === 0) {
        showEmpty();
        return;
    }
    
    showFeed();
    
    filteredReleaseNotes.forEach(item => {
        const card = document.createElement('div');
        const categoryClass = item.category.toLowerCase();
        
        card.className = `release-card ${categoryClass}`;
        if (selectedItemId === item.id) {
            card.classList.add('selected');
        }
        
        card.dataset.id = item.id;
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-meta-left">
                    <span class="badge ${categoryClass}">${item.category}</span>
                    <span class="card-date">
                        <i data-lucide="calendar"></i>
                        ${item.date}
                    </span>
                </div>
                <div class="card-header-actions">
                    <button class="card-action-btn copy-btn" title="Copy raw update to clipboard">
                        <i data-lucide="copy"></i>
                    </button>
                    <button class="card-action-btn tweet-btn" title="Draft tweet about this">
                        <i data-lucide="twitter"></i>
                    </button>
                </div>
            </div>
            <div class="card-body">
                ${item.content_html}
            </div>
        `;
        
        // Attach action handlers
        const copyBtn = card.querySelector('.copy-btn');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent selecting card
            navigator.clipboard.writeText(item.content_text)
                .then(() => showToast('Update copied to clipboard!'))
                .catch(err => {
                    showToast('Failed to copy text', 'error');
                    console.error(err);
                });
        });

        const cardTweetBtn = card.querySelector('.tweet-btn');
        cardTweetBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent duplicate card click event
            selectReleaseNote(item);
        });
        
        card.addEventListener('click', () => selectReleaseNote(item));
        feedItemsContainer.appendChild(card);
    });
    
    // Re-trigger icon creation for new HTML
    lucide.createIcons();
}

function selectReleaseNote(item) {
    selectedItemId = item.id;
    
    // Highlight active card
    document.querySelectorAll('.release-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.id === item.id) {
            card.classList.add('selected');
        }
    });

    // Populate Composer Content
    composerBadge.className = `badge ${item.category.toLowerCase()}`;
    composerBadge.textContent = item.category;
    composerDate.textContent = item.date;
    composerUpdateHtml.innerHTML = item.content_html;
    
    // Generate and Set Default Tweet Text
    const defaultTweet = generateDefaultTweet(item);
    tweetTextarea.value = defaultTweet;
    
    // Store current item data in elements for reset capability
    composerWorkspace.dataset.currentItem = JSON.stringify(item);
    
    // Show Composer Workspace
    composerEmptyState.style.display = 'none';
    composerWorkspace.style.display = 'flex';
    
    // Handle Mobile View Transitions
    const composerColumn = document.querySelector('.composer-column');
    composerColumn.classList.add('open');
    composerOverlay.classList.add('open');
    
    // Update Textarea Counter and Preview
    handleTextareaInput();
    
    // Scroll composer to view on mobile
    if (window.innerWidth <= 1024) {
        composerWorkspace.scrollIntoView({ behavior: 'smooth' });
    }
}

function closeComposer() {
    selectedItemId = null;
    
    // Remove selection highlight from cards
    document.querySelectorAll('.release-card').forEach(card => {
        card.classList.remove('selected');
    });

    composerWorkspace.style.display = 'none';
    composerEmptyState.style.display = 'flex';
    
    // Hide mobile drawer
    const composerColumn = document.querySelector('.composer-column');
    composerColumn.classList.remove('open');
    composerOverlay.classList.remove('open');
}

/* ==========================================================================
   Tweet Composition & Truncation Engine
   ========================================================================== */
function generateDefaultTweet(item) {
    const category = item.category || 'General';
    const date = item.date;
    const link = item.link;
    // Replace multiple spaces and newlines with a single space to get raw text
    const cleanText = item.content_text.replace(/\s+/g, ' ').trim();
    
    // Compose Tweet Blueprint
    const header = `📢 BigQuery Update: ${category}\n`;
    const dateLine = `📅 ${date}\n\n`;
    const hashtags = `\n\n#BigQuery #GoogleCloud`;
    const linkLine = `\n\n${link}`;
    
    // Calculate space for description
    const baseLength = header.length + dateLine.length + hashtags.length + linkLine.length;
    const maxDescLength = 280 - baseLength;
    
    let description = cleanText;
    if (description.length > maxDescLength) {
        description = description.substring(0, maxDescLength - 3) + '...';
    }
    
    return `${header}${dateLine}${description}${hashtags}${linkLine}`;
}

function handleTextareaInput() {
    const text = tweetTextarea.value;
    const length = text.length;
    const remaining = 280 - length;
    
    // Update count display
    charCountText.textContent = remaining;
    
    // Styling states for character counter
    charCountText.className = '';
    if (remaining < 20 && remaining >= 0) {
        charCountText.classList.add('warning');
    } else if (remaining < 0) {
        charCountText.classList.add('error');
    }
    
    // Update circular progress bar
    const circleRadius = 14;
    const circumference = 2 * Math.PI * circleRadius; // ~88
    
    let dashOffset = circumference - (Math.min(length, 280) / 280) * circumference;
    progressCircle.style.strokeDashoffset = dashOffset;
    
    progressCircle.className = 'progress-ring__circle';
    if (remaining < 20 && remaining >= 0) {
        progressCircle.classList.add('warning');
    } else if (remaining < 0) {
        progressCircle.classList.add('error');
    }
    
    // Update live Twitter/X preview text with mock syntax highlighting for tags/links
    updateTweetMockupText(text);
}

function updateTweetMockupText(text) {
    // Escape HTML first
    let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
        
    // Format hashtags (e.g. #BigQuery)
    escaped = escaped.replace(/(#[a-zA-Z0-9_]+)/g, '<span style="color: #1d9bf0;">$1</span>');
    
    // Format links (HTTP/HTTPS)
    escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<span style="color: #1d9bf0;">$1</span>');
    
    // Render text with line breaks preserved
    tweetPreviewText.innerHTML = escaped;
}

/* ==========================================================================
   State View Management
   ========================================================================== */
function showLoading() {
    loadingState.style.display = 'flex';
    feedItemsContainer.style.display = 'none';
    emptyState.style.display = 'none';
    errorState.style.display = 'none';
}

function showFeed() {
    loadingState.style.display = 'none';
    feedItemsContainer.style.display = 'flex';
    emptyState.style.display = 'none';
    errorState.style.display = 'none';
}

function showEmpty() {
    loadingState.style.display = 'none';
    feedItemsContainer.style.display = 'none';
    emptyState.style.display = 'flex';
    errorState.style.display = 'none';
}

function showError(msg) {
    loadingState.style.display = 'none';
    feedItemsContainer.style.display = 'none';
    emptyState.style.display = 'none';
    errorState.style.display = 'flex';
    errorMessage.textContent = msg;
}

function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    
    toast.className = 'toast-container show';
    if (type === 'warning') {
        toast.style.background = 'rgba(245, 158, 11, 0.95)';
        toast.style.boxShadow = '0 4px 20px rgba(245, 158, 11, 0.4)';
    } else if (type === 'error') {
        toast.style.background = 'rgba(239, 68, 68, 0.95)';
        toast.style.boxShadow = '0 4px 20px rgba(239, 68, 68, 0.4)';
    } else {
        toast.style.background = 'rgba(16, 185, 129, 0.95)';
        toast.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.4)';
    }
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

/* ==========================================================================
   Theme and Export Utility Functions
   ========================================================================== */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        updateThemeIcon('light');
    } else {
        document.body.classList.remove('light-theme');
        updateThemeIcon('dark');
    }
}

function updateThemeIcon(theme) {
    const icon = themeToggleBtn.querySelector('.toggle-icon');
    if (!icon) return;
    if (theme === 'light') {
        icon.setAttribute('data-lucide', 'moon');
    } else {
        icon.setAttribute('data-lucide', 'sun');
    }
    // Re-create icon on the button
    lucide.createIcons();
}

function toggleTheme() {
    if (document.body.classList.contains('light-theme')) {
        document.body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
        updateThemeIcon('dark');
        showToast('Switched to Dark Mode');
    } else {
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
        updateThemeIcon('light');
        showToast('Switched to Light Mode');
    }
}

function exportToCSV() {
    if (filteredReleaseNotes.length === 0) {
        showToast('No release notes available to export', 'error');
        return;
    }

    const headers = ['Date', 'Category', 'Timestamp', 'Link', 'Content Text'];
    
    const rows = filteredReleaseNotes.map(item => [
        item.date,
        item.category,
        item.timestamp,
        item.link,
        item.content_text.replace(/\s+/g, ' ').trim()
    ]);
    
    const csvContent = [
        headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
        ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    let categoryName = activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1);
    let searchSegment = searchQuery ? `_search_${searchQuery.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    const filename = `bigquery_releases_${categoryName}${searchSegment}.csv`;
    
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Exported ${filteredReleaseNotes.length} updates to CSV!`);
}

/* ==========================================================================
   Event Listeners Setup
   ========================================================================== */
function initEventListeners() {
    // Refresh feed
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    
    // Category pill filters
    categoryFilters.addEventListener('click', (e) => {
        const target = e.target.closest('.filter-pill');
        if (!target) return;
        
        document.querySelectorAll('.filter-pill').forEach(pill => pill.classList.remove('active'));
        target.classList.add('active');
        
        activeCategory = target.dataset.category;
        applyFiltersAndRender();
    });
    
    // Search input (with basic debounce)
    let searchDebounceTimeout;
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        
        // Show/hide clear search button
        if (searchQuery) {
            clearSearchBtn.style.display = 'flex';
        } else {
            clearSearchBtn.style.display = 'none';
        }

        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
            applyFiltersAndRender();
        }, 200);
    });
    
    // Clear search
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFiltersAndRender();
    });
    
    // Sort Select
    sortSelect.addEventListener('change', (e) => {
        activeSort = e.target.value;
        applyFiltersAndRender();
    });
    
    // Composer Close
    closeComposerBtn.addEventListener('click', closeComposer);
    composerOverlay.addEventListener('click', closeComposer);
    
    // Textarea editing
    tweetTextarea.addEventListener('input', handleTextareaInput);
    
    // Reset Tweet Draft
    resetTweetBtn.addEventListener('click', () => {
        if (composerWorkspace.dataset.currentItem) {
            const item = JSON.parse(composerWorkspace.dataset.currentItem);
            const defaultTweet = generateDefaultTweet(item);
            tweetTextarea.value = defaultTweet;
            handleTextareaInput();
            showToast('Draft reset to default template', 'success');
        }
    });

    // Copy to Clipboard
    copyTweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        navigator.clipboard.writeText(text)
            .then(() => showToast('Tweet copied to clipboard!'))
            .catch(err => {
                showToast('Failed to copy text', 'error');
                console.error(err);
            });
    });

    // Post to Twitter/X
    tweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        
        // Character count validation
        if (text.length > 280) {
            showToast('Post is too long! Reduce to 280 characters.', 'error');
            return;
        }
        
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank', 'width=550,height=420');
    });

    // Tab buttons
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.style.display = 'none');
            
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            document.getElementById(`tab-${tabId}`).style.display = 'block';
        });
    });

    // Theme Toggle
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Export to CSV
    exportCsvBtn.addEventListener('click', exportToCSV);
}

// Initializing the app
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initEventListeners();
    fetchReleaseNotes(false); // First load checks cache
});
