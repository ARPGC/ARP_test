/**
 * EcoCampus - Main Application Logic (app.js)
 * Fixed: Loader now removes immediately to prevent app hanging on startup.
 */

import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, toggleSidebar, showPage, logUserActivity, debounce, showToast, isChristmasSeason } from './utils.js';
import { loadDashboardData, renderDashboard, setupFileUploads } from './dashboard.js';

// --- AUTHENTICATION CHECK & STARTUP ---

/**
 * Checks for a valid Supabase session on startup.
 * Redirects to login if session is missing or invalid.
 */
const checkAuth = async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) { 
            console.error('Auth Check: Session Error:', error.message); 
            showToast('Authentication error. Please log in again.', 'error');
            redirectToLogin(); 
            return; 
        }

        if (!session) { 
            console.warn('Auth Check: No active session found.');
            redirectToLogin(); 
            return; 
        }

        // Store auth user and begin app initialization
        state.userAuth = session.user;
        await initializeApp();
    } catch (err) { 
        console.error('CRITICAL: Auth check failed unexpectedly:', err); 
        showToast('System error. Please refresh the page.', 'error');
    }
};

/**
 * Fetches the specific user profile from the database and initializes UI modules.
 */
const initializeApp = async () => {
    try {
        console.log('Init: Fetching user profile...');
        
        // Fetch specific columns to optimize bandwidth
        const { data: userProfile, error } = await supabase
            .from('users')
            .select('id, full_name, student_id, course, current_points, lifetime_points, profile_img_url, tick_type')
            .eq('auth_user_id', state.userAuth.id)
            .single();
        
        if (error) {
            console.error('Init: Failed to fetch user profile:', error.message);
            showToast('Could not load profile. Logging out.', 'error');
            await handleLogout(); 
            return; 
        }

        if (!userProfile) {
            showToast('Profile not found. Please contact support.', 'error');
            await handleLogout();
            return;
        }
        
        state.currentUser = userProfile;
        
        // Log login activity only once per session
        if (!sessionStorage.getItem('login_logged')) {
            logUserActivity('login', 'User logged in');
            sessionStorage.setItem('login_logged', '1');
            
            // Standard greeting
            showToast(`Welcome back, ${userProfile.full_name}!`, 'success');
        }

        // --- CHRISTMAS THEME INITIALIZATION ---
        initChristmasTheme();

        // Set initial navigation state
        history.replaceState({ pageId: 'dashboard' }, '', '#dashboard');

        // --- CRITICAL FIX: REMOVE LOADER IMMEDIATELY ---
        // We remove the loader NOW so the user sees the UI, even if data is still fetching.
        setTimeout(() => {
            const loader = document.getElementById('app-loading');
            if (loader) loader.classList.add('loaded');
        }, 500);

        // Initialize Lucide icons immediately so UI structure looks good
        if(window.lucide) window.lucide.createIcons();
        setupFileUploads();

        // Load Dashboard data in the background (Non-blocking)
        try {
            if (!state.dashboardLoaded) {
                await loadDashboardData();
                state.dashboardLoaded = true;
            }
            renderDashboard();
        } catch (dashErr) {
            console.error("Init: Dashboard data load failed:", dashErr);
            // Don't show toast error here to avoid annoying user on startup, just log it.
            // The UI will likely show empty states which is fine.
        }

    } catch (err) { 
        console.error('CRITICAL: App initialization crashed:', err);
        // Force remove loader even on crash so user isn't stuck
        document.getElementById('app-loading')?.classList.add('loaded');
        showToast('App failed to initialize.', 'error');
    }
};

// --- CHRISTMAS THEME LOGIC ---

/**
 * Checks date and injects festive elements if it's Christmas season.
 * Uses lightweight DOM manipulation to avoid layout shifts.
 */
const initChristmasTheme = () => {
    // 1. Gatekeeper: Only run between Dec 19 - Dec 26
    if (!isChristmasSeason()) return;

    console.log("🎄 EcoCampus Christmas Theme Active");

    // 2. Inject Snow Container (CSS handles animation)
    // Limit to 25 snowflakes for mobile performance
    const existingSnow = document.querySelector('.snow-container');
    if (!existingSnow) {
        const snowContainer = document.createElement('div');
        snowContainer.className = 'snow-container';
        
        let snowHTML = '';
        for(let i = 0; i < 25; i++) {
            // Randomize position and animation delay for natural feel
            const left = Math.floor(Math.random() * 100);
            const delay = (Math.random() * 5).toFixed(2);
            const duration = (5 + Math.random() * 5).toFixed(2); // 5-10s fall time
            const opacity = (0.3 + Math.random() * 0.5).toFixed(2);
            
            snowHTML += `<div class="snowflake" style="left: ${left}%; animation-delay: ${delay}s; animation-duration: ${duration}s; opacity: ${opacity};">❄</div>`;
        }
        
        snowContainer.innerHTML = snowHTML;
        document.body.appendChild(snowContainer);
    }

    // 3. Festive Greeting (One-time per session)
    if (!sessionStorage.getItem('xmas_greeted')) {
        setTimeout(() => {
            showToast("Merry Christmas from EcoCampus! 🎄", "christmas");
        }, 2500); // Delay to appear after welcome toast
        sessionStorage.setItem('xmas_greeted', 'true');
    }

    // 4. Add subtle festive accents to header
    const header = document.querySelector('header');
    if (header) header.classList.add('festive-header-accent');
};

/**
 * Handles the user logout sequence.
 */
const handleLogout = async () => {
    try {
        console.log('Logout: Initiating...');
        
        if (sessionStorage.getItem('login_logged')) {
            logUserActivity('logout', 'User logged out');
            sessionStorage.removeItem('login_logged');
            sessionStorage.removeItem('xmas_greeted'); // Reset xmas greeting
        }
        
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Logout: Error:', error.message);
        
        redirectToLogin();
    } catch (err) { 
        console.error('Logout: Critical error:', err);
        redirectToLogin(); // Ensure they are redirected even if logic fails
    }
};

const redirectToLogin = () => { window.location.replace('login.html'); };

/**
 * Refreshes user point balance and profile data from the database.
 */
export const refreshUserData = async () => {
    try {
        const { data: userProfile, error } = await supabase
            .from('users')
            .select('id, current_points, lifetime_points, profile_img_url, tick_type')
            .eq('id', state.currentUser.id)
            .single();

        if (error) {
            console.error('RefreshData: Error:', error.message);
            return;
        }
        
        if (!userProfile) return;
        
        // Merge strategy: Update specific fields while keeping others (Name, Course, etc.)
        state.currentUser = { ...state.currentUser, ...userProfile };

        // Update UI point displays with animation
        const header = document.getElementById('user-points-header');
        if(header) {
            header.classList.add('points-pulse');
            header.textContent = userProfile.current_points;
        }
        
        const sidebarPoints = document.getElementById('user-points-sidebar');
        if(sidebarPoints) sidebarPoints.textContent = userProfile.current_points;
        
        setTimeout(() => header?.classList.remove('points-pulse'), 400);
        renderDashboard();
    } catch (err) { 
        console.error('RefreshData: Unexpected error:', err); 
    }
};

// --- EVENT LISTENERS & UI LOGIC ---

// Store Search with Debounce
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

document.getElementById('sidebar-toggle-btn')?.addEventListener('click', () => toggleSidebar());
document.getElementById('logout-button')?.addEventListener('click', handleLogout);

// --- THEME MANAGEMENT ---

const themeBtn = document.getElementById('theme-toggle-btn');
const themeText = document.getElementById('theme-text');
const themeIcon = document.getElementById('theme-icon');

/**
 * Applies the selected theme (Dark/Light) to the document.
 */
const applyTheme = (isDark) => {
    try {
        document.documentElement.classList.toggle('dark', isDark);
        if(themeText) themeText.textContent = isDark ? 'Dark Mode' : 'Light Mode';
        if(themeIcon) themeIcon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
        if(window.lucide) window.lucide.createIcons();
    } catch (e) { console.error('Theme Apply Error:', e); }
};

if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('eco-theme', isDark ? 'dark' : 'light');
        applyTheme(isDark);
        logUserActivity('theme_change', `Switched to ${isDark ? 'dark' : 'light'} mode`);
    });
}

// Load saved theme or default to system preference
const savedTheme = localStorage.getItem('eco-theme');
applyTheme(savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches));

// --- ACCOUNT SECURITY: CHANGE PASSWORD ---

const changePwdForm = document.getElementById('change-password-form');
if (changePwdForm) {
    changePwdForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const passwordInput = document.getElementById('new-password');
        const newPassword = passwordInput.value;
        const btn = document.getElementById('change-password-button');

        if (newPassword.length < 6) {
             showToast('Password must be at least 6 characters.', 'error');
             return;
        }

        btn.disabled = true;
        btn.textContent = 'Updating...';

        try {
            // Update Supabase Auth user
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            // Sync with local users table
            const { error: tableError } = await supabase
                .from('users')
                .update({ password_plain: newPassword })
                .eq('id', state.currentUser.id);

            if (tableError) throw tableError;

            showToast('Password updated successfully!', 'success');
            passwordInput.value = ''; 
            logUserActivity('password_change', 'User changed password');

        } catch (err) {
            console.error('Password Change Error:', err);
            showToast(err.message || 'Failed to update password.', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Update Password';
        }
    });
}

// --- BONUS POINTS: REDEEM CODE ---

const redeemForm = document.getElementById('redeem-code-form');
if (redeemForm) {
    redeemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const codeInput = document.getElementById('redeem-input');
        const code = codeInput.value.trim();
        const btn = document.getElementById('redeem-submit-btn');
        const msgEl = document.getElementById('redeem-message'); // Fallback for UI
        
        btn.disabled = true; 
        btn.innerText = 'Verifying...'; 

        try {
            // Call Database RPC function for coupon redemption
            const { data, error } = await supabase.rpc('redeem_coupon', { p_code: code });
            
            if (error) throw error;
            
            showToast(`Success! +${data.points_awarded} pts.`, 'success');
            
            // Also update the inline message if it exists (for compatibility)
            if(msgEl) {
                msgEl.textContent = `Success! +${data.points_awarded} points.`;
                msgEl.classList.add('text-green-600', 'font-bold');
            }

            codeInput.value = ''; 
            
            logUserActivity('redeem_code_success', `Redeemed code: ${code}`);
            await refreshUserData(); 
            
        } catch (err) { 
            console.error("Redeem Code Error:", err);
            showToast(err.message || "Invalid or expired code.", "error");
            
            if(msgEl) {
                msgEl.textContent = err.message || "Invalid or expired code.";
                msgEl.classList.add('text-red-500', 'font-bold');
            }

            logUserActivity('redeem_code_fail', `Failed to redeem code: ${code}`);
        } finally { 
            btn.disabled = false; 
            btn.innerText = 'Redeem Points';
            
            // Clean up inline message after delay
            setTimeout(() => { 
                if(msgEl) {
                    msgEl.textContent = ''; 
                    msgEl.classList.remove('text-red-500', 'text-green-600', 'font-bold');
                }
            }, 3000);
        }
    });
}

// --- START APP ---
window.handleLogout = handleLogout;
checkAuth();
