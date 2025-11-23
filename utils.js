import { supabase } from './supabase-client.js';
import { CLOUDINARY_API_URL, CLOUDINARY_UPLOAD_PRESET, TICK_IMAGES, state } from './state.js';
import { renderDashboard } from './dashboard.js';
import { renderRewards, renderMyRewardsPage } from './store.js';
import { renderHistory } from './dashboard.js';
import { renderEcoPointsPage } from './store.js';
import { renderChallengesPage } from './challenges.js';
import { renderEventsPage } from './events.js'; 
import { renderProfile } from './dashboard.js';
import { showLeaderboardTab } from './social.js';

// ==========================================
// 1. DOM & CONFIG
// ==========================================

export const els = {
    get pages() { return document.querySelectorAll('.page'); },
    get sidebar() { return document.getElementById('sidebar'); },
    get sidebarOverlay() { return document.getElementById('sidebar-overlay'); },
    get userPointsHeader() { return document.getElementById('user-points-header'); },
    get userNameGreeting() { return document.getElementById('user-name-greeting'); },
    get dailyCheckinBtn() { return document.getElementById('daily-checkin-button'); },
    get lbPodium() { return document.getElementById('lb-podium-container'); },
    get lbList() { return document.getElementById('lb-list-container'); },
    get lbLeafLayer() { return document.getElementById('lb-leaf-layer'); },
    get productGrid() { return document.getElementById('product-grid'); },
    get storeSearch() { return document.getElementById('store-search-input'); },
    get storeSearchClear() { return document.getElementById('store-search-clear'); },
    get sortBy() { return document.getElementById('sort-by-select'); },
    get challengesList() { return document.getElementById('challenges-page-list'); },
    get eventsList() { return document.getElementById('event-list'); },
    get allRewardsList() { return document.getElementById('all-rewards-list'); },
    get historyList() { return document.getElementById('history-list'); },
    get storeDetailPage() { return document.getElementById('store-detail-page'); },
    get productDetailPage() { return document.getElementById('product-detail-page'); },
    get departmentDetailPage() { return document.getElementById('department-detail-page'); },
    get purchaseModalOverlay() { return document.getElementById('purchase-modal-overlay'); },
    get purchaseModal() { return document.getElementById('purchase-modal'); },
    get qrModalOverlay() { return document.getElementById('qr-modal-overlay'); },
    get qrModal() { return document.getElementById('qr-modal'); }
};

// ==========================================
// 2. OFFLINE CACHE ENGINE (localForage)
// ==========================================

// Wrapper to safely get data from localForage
export const cacheGet = async (key) => {
    if (!window.localforage) return null;
    try {
        const data = await window.localforage.getItem(key);
        // Optional: Add expiration logic here if needed in future
        return data;
    } catch (err) {
        console.warn(`Cache GET failed for ${key}:`, err);
        return null;
    }
};

// Wrapper to safely set data to localForage
export const cacheSet = async (key, value) => {
    if (!window.localforage) return;
    try {
        await window.localforage.setItem(key, value);
    } catch (err) {
        console.warn(`Cache SET failed for ${key}:`, err);
    }
};

// ==========================================
// 3. ACTIVITY LOGGING
// ==========================================

export const logActivity = async (actionType, description, metadata = null, refTable = null, refId = null) => {
    // Don't log if user isn't logged in yet (unless it's a login attempt)
    if (!state.currentUser && actionType !== 'auth') return;
    
    // If offline, skip logging (or in V2, queue it)
    if (!navigator.onLine) return;

    const userId = state.currentUser?.id;

    try {
        // Fire and forget - don't await this in UI code
        supabase.from('user_activity_log').insert({
            user_id: userId,
            action_type: actionType,
            description: description,
            metadata: metadata ? JSON.stringify(metadata) : null,
            ref_table: refTable,
            ref_id: refId
        }).then(({ error }) => {
            if (error) console.warn("Activity Log Error:", error.message);
        });
    } catch (err) {
        // suppress errors to not break app flow
    }
};

// ==========================================
// 4. PERFORMANCE UTILS
// ==========================================

// Lazy Loading Image Observer
export const setupLazyImages = () => {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.getAttribute('data-src');
                    if (src) {
                        img.src = src;
                        img.classList.add('loaded');
                        img.removeAttribute('data-src');
                    }
                    observer.unobserve(img);
                }
            });
        });

        document.querySelectorAll('.lazy-img').forEach(img => {
            imageObserver.observe(img);
        });
    } else {
        // Fallback for very old browsers
        document.querySelectorAll('.lazy-img').forEach(img => {
            const src = img.getAttribute('data-src');
            if (src) img.src = src;
        });
    }
};

// Debounce Function for Search
export const debounce = (func, wait) => {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
};

// Low Data Mode Detection
export const isLowDataMode = () => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
        if (conn.saveData === true) return true;
        if (conn.effectiveType && (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')) return true;
    }
    return false;
};

// ==========================================
// 5. FORMATTING & HELPERS
// ==========================================

export const getPlaceholderImage = (size = '400x300', text = 'EcoCampus') => {
    // If low data mode, return a tiny placeholder or empty pixel
    if (isLowDataMode()) return `https://placehold.co/${size}/EBFBEE/166534?text=${text}&font=inter`;
    return `https://placehold.co/${size}/EBFBEE/166534?text=${text}&font=inter`;
};

export const getTickImg = (tickType) => {
    if (!tickType) return '';
    const url = TICK_IMAGES[tickType.toLowerCase()];
    return url ? `<img src="${url}" class="tick-icon" alt="${tickType} tick">` : '';
};

export const getUserLevel = (points) => {
    let current = state.levels[0];
    for (let i = state.levels.length - 1; i >= 0; i--) {
        if (points >= state.levels[i].minPoints) {
            current = state.levels[i];
            break;
        }
    }
    const nextMin = current.nextMin || Infinity;
    let progress = 0;
    let progressText = "Max Level";
    if (nextMin !== Infinity) {
        const pointsInLevel = points - current.minPoints;
        const range = nextMin - current.minPoints;
        progress = Math.max(0, Math.min(100, (pointsInLevel / range) * 100));
        progressText = `${points} / ${nextMin} Pts`;
    }
    return { ...current, progress, progressText };
};

// IST Date Logic
export const getTodayIST = () => {
    // 'en-CA' format is always YYYY-MM-DD
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

export const formatDate = (dateString, options = {}) => {
    if (!dateString) return '...';
    const defaultOptions = { 
        year: 'numeric', month: 'short', day: 'numeric',
        timeZone: 'Asia/Kolkata' 
    };
    const finalOptions = { ...defaultOptions, ...options };
    return new Date(dateString).toLocaleDateString('en-IN', finalOptions);
};

export const getIconForHistory = (type) => {
    const icons = { 'checkin': 'calendar-check', 'event': 'calendar-check', 'challenge': 'award', 'plastic': 'recycle', 'order': 'shopping-cart', 'coupon': 'ticket', 'quiz': 'brain' };
    return icons[type] || 'help-circle';
};

export const getIconForChallenge = (type) => {
    const icons = { 'Quiz': 'brain', 'Upload': 'camera', 'selfie': 'camera', 'spot': 'eye' };
    return icons[type] || 'award';
};

export const getUserInitials = (fullName) => {
    if (!fullName) return '..';
    return fullName.split(' ').map(n => n[0]).join('').toUpperCase();
};

export const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
    try {
        const res = await fetch(CLOUDINARY_API_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.secure_url;
    } catch (err) { console.error("Cloudinary Upload Error:", err); throw err; }
};

// ==========================================
// 6. NAVIGATION
// ==========================================

export const showPage = (pageId, addToHistory = true) => {
    els.pages.forEach(p => p.classList.remove('active'));
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');

    // Clear sub-pages content to save memory
    if (!['store-detail-page', 'product-detail-page'].includes(pageId)) {
        if(els.storeDetailPage) els.storeDetailPage.innerHTML = ''; 
        if(els.productDetailPage) els.productDetailPage.innerHTML = '';
    }
    if (pageId !== 'department-detail-page' && els.departmentDetailPage) {
        els.departmentDetailPage.innerHTML = '';
    }

    // Update Tab Bar
    document.querySelectorAll('.nav-item, .sidebar-nav-item').forEach(btn => {
        const onclickVal = btn.getAttribute('onclick');
        btn.classList.toggle('active', onclickVal && onclickVal.includes(`'${pageId}'`));
    });

    document.querySelector('.main-content').scrollTop = 0;

    if (addToHistory) {
        window.history.pushState({ pageId: pageId }, '', `#${pageId}`);
    }

    // Dispatch Renders
    if (pageId === 'dashboard') { if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden'); renderDashboard(); } 
    else if (pageId === 'leaderboard') { showLeaderboardTab('student'); } 
    else if (pageId === 'rewards') { if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden'); window.renderRewardsWrapper && window.renderRewardsWrapper(); } 
    else if (pageId === 'my-rewards') { if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden'); window.renderMyRewardsPageWrapper && window.renderMyRewardsPageWrapper(); } 
    else if (pageId === 'history') { if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden'); renderHistory(); } 
    else if (pageId === 'ecopoints') { if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden'); window.renderEcoPointsPageWrapper && window.renderEcoPointsPageWrapper(); } 
    else if (pageId === 'challenges') { if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden'); window.renderChallengesPageWrapper && window.renderChallengesPageWrapper(); } 
    else if (pageId === 'events') { if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden'); window.renderEventsPageWrapper && window.renderEventsPageWrapper(); } 
    else if (pageId === 'profile') { if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden'); renderProfile(); }
    else { if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden'); }

    toggleSidebar(true); 
    
    // Trigger lazy load check on page change
    setTimeout(setupLazyImages, 100);
    if(window.lucide) window.lucide.createIcons();
};

window.addEventListener('popstate', (event) => {
    if (event.state && event.state.pageId) {
        showPage(event.state.pageId, false);
    } else {
        showPage('dashboard', false); 
    }
});

export const toggleSidebar = (forceClose = false) => {
    if (forceClose) {
        els.sidebar.classList.add('-translate-x-full');
        els.sidebarOverlay.classList.add('opacity-0');
        els.sidebarOverlay.classList.add('hidden');
    } else {
        els.sidebar.classList.toggle('-translate-x-full');
        els.sidebarOverlay.classList.toggle('hidden');
        els.sidebarOverlay.classList.toggle('opacity-0');
    }
};

// Attach globals
window.showPage = showPage;
window.toggleSidebar = toggleSidebar;
