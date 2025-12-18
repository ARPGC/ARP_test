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
        
        // Initialize UI Components
        setupGlobalListeners();
        setupFileUploads();
        
        // Initial Page Load
        const hashPage = window.location.hash.replace('#', '') || 'dashboard';
        await showPage(hashPage);
        
        // Remove Loading Screen
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
        const { data, error } = await supabase
            .from('users')
            .select('current_points, lifetime_points, profile_img_url')
            .eq('id', state.currentUser.id)
            .single();
            
        if (error) throw error;
        
        // Update local state
        state.currentUser.current_points = data.current_points;
        state.currentUser.lifetime_points = data.lifetime_points;
        state.currentUser.profile_img_url = data.profile_img_url;

        // Re-render components that rely on points
        const pointsHeader = document.getElementById('user-points-header');
        const pointsSidebar = document.getElementById('user-points-sidebar');
        if (pointsHeader) pointsHeader.textContent = data.current_points;
        if (pointsSidebar) pointsSidebar.textContent = data.current_points;

        if (document.getElementById('profile').classList.contains('active')) {
            const { renderProfile } = await import('./dashboard.js');
            renderProfile();
        }
        
    } catch (err) {
        console.warn("Soft Refresh failed:", err.message);
    }
};

// --- GLOBAL EVENT LISTENERS ---

const setupGlobalListeners = () => {
    // Theme Toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeUI(isDark);
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            logUserActivity('logout', 'User initiated logout');
            await supabase.auth.signOut();
            redirectToLogin();
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
};

// --- THEME ENGINE ---

const applyInitialTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
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

// --- REDEEM CODE LOGIC ---

const handleRedeemCode = async (e) => {
    e.preventDefault();
    const codeInput = document.getElementById('redeem-input');
    const code = codeInput.value.trim();
    const btn = document.getElementById('redeem-submit-btn');
    
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

// --- UTILS ---

const redirectToLogin = () => {
    window.location.href = 'login.html';
};

// Boot App
applyInitialTheme();
checkAuth();

window.refreshUserData = refreshUserData;
