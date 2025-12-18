import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, toggleSidebar, showPage, logUserActivity, debounce, showToast } from './utils.js';
import { loadDashboardData, renderDashboard, setupFileUploads } from './dashboard.js';

// --- AUTH CHECK & STARTUP ---

/**
 * Validates the current session and begins the initialization process.
 */
const checkAuth = async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) { 
            console.error('Auth Check: Session Error:', error.message); 
            redirectToLogin(); 
            return; 
        }
        if (!session) { 
            console.warn('Auth Check: No active session found. Redirecting to login.'); 
            redirectToLogin(); 
            return; 
        }
        state.userAuth = session.user;
        await initializeApp();
    } catch (err) { 
        console.error('CRITICAL: Auth check failed unexpectedly:', err); 
    }
};

/**
 * Fetches the user profile and prepares the global application state.
 */
const initializeApp = async () => {
    try {
        console.log('Init: Fetching minimal user profile...');
        
        // Optimization: Select ONLY strict columns needed for global UI (sidebar/header)
        const { data: userProfile, error } = await supabase
            .from('users')
            .select('id, full_name, student_id, course, current_points, lifetime_points, profile_img_url, tick_type')
            .eq('auth_user_id', state.userAuth.id)
            .single();
        
        if (error) {
            console.error('Init: Failed to fetch user profile:', error.message);
            showToast("Profile load failed. Re-logging...", "error");
            setTimeout(redirectToLogin, 2000);
            return;
        }

        state.currentUser = userProfile;
        
        // Fix: Log login activity ONLY once per session
        if (!sessionStorage.getItem('login_logged')) {
            logUserActivity('login', 'User logged in');
            sessionStorage.setItem('login_logged', '1');
        }

        // Initialize UI Components
        setupGlobalListeners();
        setupFileUploads();
        
        // Initial Page Load - Handle deep links or default to dashboard
        const hashPage = window.location.hash.replace('#', '') || 'dashboard';
        await showPage(hashPage);
        
        // Remove Global App Loader
        const loader = document.getElementById('app-loading');
        if (loader) {
            loader.classList.add('opacity-0');
            setTimeout(() => loader.remove(), 500);
        }

        logUserActivity('app_start', 'User successfully entered app');

    } catch (err) {
        console.error('CRITICAL: App initialization failed:', err);
    }
};

// --- DATA REFRESH LOGIC ---

/**
 * Refreshes user point totals and profile data globally without reloading the page.
 */
export const refreshUserData = async () => {
    try {
        // Reduced Select Fields for Bandwidth optimization
        const { data: userProfile, error } = await supabase
            .from('users')
            .select('id, current_points, lifetime_points, profile_img_url, tick_type')
            .eq('id', state.currentUser.id)
            .single();
            
        if (error) throw error;
        
        // Merge into global state
        state.currentUser = { ...state.currentUser, ...userProfile };

        // Update UI elements that rely on points
        const pointsHeader = document.getElementById('user-points-header');
        const pointsSidebar = document.getElementById('user-points-sidebar');
        
        if (pointsHeader) {
            pointsHeader.textContent = userProfile.current_points;
            pointsHeader.classList.add('points-pulse'); 
            setTimeout(() => pointsHeader.classList.remove('points-pulse'), 400);
        }
        if (pointsSidebar) pointsSidebar.textContent = userProfile.current_points;

        // Conditional Re-renders
        if (document.getElementById('profile').classList.contains('active')) {
            const { renderProfile } = await import('./dashboard.js');
            renderProfile();
        }
        
        renderDashboard(); // Update dashboard components
        
    } catch (err) {
        console.warn("Soft Refresh failed:", err.message);
    }
};

// --- GLOBAL EVENT LISTENERS ---

const setupGlobalListeners = () => {
    // Theme Toggle Logic
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('eco-theme', isDark ? 'dark' : 'light');
            updateThemeUI(isDark);
            logUserActivity('theme_change', `Switched to ${isDark ? 'dark' : 'light'} mode`);
        });
    }

    // Logout Handling
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Store Search and Sort triggers (Delegated to lazy-loaded store.js)
    if(els.storeSearch) {
        els.storeSearch.addEventListener('input', debounce(() => {
            if (state.storeLoaded && window.renderRewardsWrapper) window.renderRewardsWrapper();
        }, 300));
    }
    if(els.storeSearchClear) {
        els.storeSearchClear.addEventListener('click', () => { 
            els.storeSearch.value = ''; 
            if (state.storeLoaded && window.renderRewardsWrapper) window.renderRewardsWrapper(); 
        });
    }
    if(els.sortBy) {
        els.sortBy.addEventListener('change', () => {
            if (state.storeLoaded && window.renderRewardsWrapper) window.renderRewardsWrapper();
        });
    }

    // Redeem Code Form
    const redeemForm = document.getElementById('redeem-code-form');
    if (redeemForm) {
        redeemForm.addEventListener('submit', handleRedeemCode);
    }

    // Sidebar Toggle for Mobile
    const sidebarToggle = document.getElementById('sidebar-toggle-btn');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => toggleSidebar());
    }

    // Change Password Form
    const changePwdForm = document.getElementById('change-password-form');
    if (changePwdForm) {
        changePwdForm.addEventListener('submit', handleChangePassword);
    }
};

// --- FEATURE HANDLERS ---

const handleLogout = async () => {
    try {
        logUserActivity('logout', 'User initiated logout');
        sessionStorage.removeItem('login_logged');
        await supabase.auth.signOut();
        redirectToLogin();
    } catch (err) { 
        console.error('Logout failed:', err); 
        redirectToLogin();
    }
};

const handleRedeemCode = async (e) => {
    e.preventDefault();
    const codeInput = document.getElementById('redeem-input');
    const code = codeInput.value.trim();
    const btn = document.getElementById('redeem-submit-btn');
    const msgEl = document.getElementById('redeem-message');
    
    if (!code) return;
    
    btn.disabled = true; 
    btn.innerText = 'Verifying...'; 

    try {
        const { data, error } = await supabase.rpc('redeem_coupon', { p_code: code });
        
        if (error) throw error;
        
        showToast(`Success! +${data.points_awarded} Points`, 'success');
        codeInput.value = ''; 
        
        logUserActivity('redeem_code_success', `Redeemed code: ${code}`);
        await refreshUserData(); 
        
    } catch (err) { 
        console.error("Redeem Code Error:", err);
        showToast(err.message || "Invalid or expired code.", "error");
        logUserActivity('redeem_code_fail', `Failed code: ${code}`);
    } finally { 
        btn.disabled = false; 
        btn.innerText = 'Redeem Points';
    }
};

const handleChangePassword = async (e) => {
    e.preventDefault();
    const passwordInput = document.getElementById('new-password');
    const newPassword = passwordInput.value;
    const msgEl = document.getElementById('password-message');
    const btn = document.getElementById('change-password-button');

    if (newPassword.length < 6) {
         showToast('Password too short (min 6 chars).', 'warning');
         return;
    }

    btn.disabled = true;
    btn.textContent = 'Updating...';

    try {
        // 1. Update Auth Session
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;

        // 2. Update DB Mirror (for Edge Function compatibility)
        await supabase.from('users').update({ password_plain: newPassword }).eq('id', state.currentUser.id);

        showToast('Password updated successfully!', 'success');
        passwordInput.value = ''; 
        logUserActivity('password_change', 'User changed password');

    } catch (err) {
        showToast(err.message || 'Failed to update password.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Update Password';
    }
};

// --- THEME ENGINE ---

const applyInitialTheme = () => {
    const savedTheme = localStorage.getItem('eco-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    document.documentElement.classList.toggle('dark', isDark);
    updateThemeUI(isDark);
};

const updateThemeUI = (isDark) => {
    const themeText = document.getElementById('theme-text');
    const themeIcon = document.getElementById('theme-icon');
    if (themeText) themeText.textContent = isDark ? 'Dark Mode' : 'Light Mode';
    if (themeIcon) {
        themeIcon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
        if (window.lucide) window.lucide.createIcons();
    }
};

// --- UTILS ---

const redirectToLogin = () => {
    window.location.replace('login.html');
};

// Boot Application
applyInitialTheme();
checkAuth();

window.refreshUserData = refreshUserData;
window.handleLogout = handleLogout;
