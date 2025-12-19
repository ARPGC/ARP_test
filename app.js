/**
 * EcoCampus - Main Application Logic (app.js)
 * Final Fix: Forces loader removal via inline styles & ensures Dashboard visibility.
 */

import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, toggleSidebar, showPage, logUserActivity, debounce, showToast, isChristmasSeason } from './utils.js';
import { loadDashboardData, renderDashboard, setupFileUploads } from './dashboard.js';

// --- AUTHENTICATION CHECK & STARTUP ---

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
        // Force remove loader on error
        removeLoader();
    }
};

const initializeApp = async () => {
    try {
        console.log('Init: Fetching user profile...');
        
        const { data: userProfile, error } = await supabase
            .from('users')
            .select('id, full_name, student_id, course, current_points, lifetime_points, profile_img_url, tick_type')
            .eq('auth_user_id', state.userAuth.id)
            .single();
        
        if (error || !userProfile) {
            console.error('Init: Profile error:', error?.message);
            showToast('Profile error. Logging out.', 'error');
            await handleLogout(); 
            return; 
        }
        
        state.currentUser = userProfile;
        
        // Log login activity once
        if (!sessionStorage.getItem('login_logged')) {
            logUserActivity('login', 'User logged in');
            sessionStorage.setItem('login_logged', '1');
            showToast(`Welcome back, ${userProfile.full_name}!`, 'success');
        }

        // --- CHRISTMAS THEME ---
        initChristmasTheme();

        // --- UI INITIALIZATION ---
        // 1. Force remove loader immediately (Fail-safe)
        removeLoader();

        // 2. Explicitly show the dashboard page to ensure it's not hidden
        await showPage('dashboard', false);

        // 3. Initialize icons
        if(window.lucide) window.lucide.createIcons();
        setupFileUploads();

        // 4. Load Data in Background (Non-blocking)
        try {
            if (!state.dashboardLoaded) {
                await loadDashboardData();
                state.dashboardLoaded = true;
            }
            renderDashboard();
        } catch (dashErr) {
            console.error("Init: Dashboard data load failed:", dashErr);
        }

    } catch (err) { 
        console.error('CRITICAL: App initialization crashed:', err);
        removeLoader(); // Ensure user isn't stuck
    }
};

// --- HELPER: Force Remove Loader ---
const removeLoader = () => {
    setTimeout(() => {
        const loader = document.getElementById('app-loading');
        if (loader) {
            loader.classList.add('loaded');       // Try CSS transition
            loader.style.opacity = '0';           // Force transparency
            loader.style.pointerEvents = 'none';  // Allow clicking through
            
            // Hard remove after transition
            setTimeout(() => { loader.style.display = 'none'; }, 500);
        }
    }, 100); // Immediate execution
};

// --- CHRISTMAS THEME LOGIC ---
const initChristmasTheme = () => {
    if (!isChristmasSeason()) return;

    console.log("🎄 EcoCampus Christmas Theme Active");

    const existingSnow = document.querySelector('.snow-container');
    if (!existingSnow) {
        const snowContainer = document.createElement('div');
        snowContainer.className = 'snow-container';
        let snowHTML = '';
        // 25 Flakes for performance
        for(let i = 0; i < 25; i++) {
            const left = Math.floor(Math.random() * 100);
            const delay = (Math.random() * 5).toFixed(2);
            const duration = (5 + Math.random() * 5).toFixed(2);
            const opacity = (0.3 + Math.random() * 0.5).toFixed(2);
            snowHTML += `<div class="snowflake" style="left: ${left}%; animation-delay: ${delay}s; animation-duration: ${duration}s; opacity: ${opacity};">❄</div>`;
        }
        snowContainer.innerHTML = snowHTML;
        document.body.appendChild(snowContainer);
    }

    if (!sessionStorage.getItem('xmas_greeted')) {
        setTimeout(() => {
            showToast("Merry Christmas from EcoCampus! 🎄", "christmas");
        }, 2500);
        sessionStorage.setItem('xmas_greeted', 'true');
    }

    const header = document.querySelector('header');
    if (header) header.classList.add('festive-header-accent');
};

const handleLogout = async () => {
    try {
        if (sessionStorage.getItem('login_logged')) {
            logUserActivity('logout', 'User logged out');
            sessionStorage.removeItem('login_logged');
            sessionStorage.removeItem('xmas_greeted');
        }
        await supabase.auth.signOut();
        redirectToLogin();
    } catch (err) { 
        console.error('Logout Error:', err);
        redirectToLogin();
    }
};

const redirectToLogin = () => { window.location.replace('login.html'); };

export const refreshUserData = async () => {
    try {
        const { data: userProfile, error } = await supabase
            .from('users')
            .select('id, current_points, lifetime_points, profile_img_url, tick_type')
            .eq('id', state.currentUser.id)
            .single();

        if (error || !userProfile) return;
        
        state.currentUser = { ...state.currentUser, ...userProfile };

        const header = document.getElementById('user-points-header');
        if(header) {
            header.classList.add('points-pulse');
            header.textContent = userProfile.current_points;
        }
        const sidebarPoints = document.getElementById('user-points-sidebar');
        if(sidebarPoints) sidebarPoints.textContent = userProfile.current_points;
        
        setTimeout(() => header?.classList.remove('points-pulse'), 400);
        renderDashboard();
    } catch (err) { console.error(err); }
};

// --- EVENT LISTENERS ---
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

const themeBtn = document.getElementById('theme-toggle-btn');
if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('eco-theme', isDark ? 'dark' : 'light');
        applyTheme(isDark);
        logUserActivity('theme_change', `Switched to ${isDark ? 'dark' : 'light'} mode`);
    });
}

const applyTheme = (isDark) => {
    const themeText = document.getElementById('theme-text');
    const themeIcon = document.getElementById('theme-icon');
    document.documentElement.classList.toggle('dark', isDark);
    if(themeText) themeText.textContent = isDark ? 'Dark Mode' : 'Light Mode';
    if(themeIcon) themeIcon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
    if(window.lucide) window.lucide.createIcons();
};

const savedTheme = localStorage.getItem('eco-theme');
applyTheme(savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches));

// Change Password
const changePwdForm = document.getElementById('change-password-form');
if (changePwdForm) {
    changePwdForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const passwordInput = document.getElementById('new-password');
        const btn = document.getElementById('change-password-button');
        if (passwordInput.value.length < 6) { showToast('Password too short.', 'error'); return; }

        btn.disabled = true; btn.textContent = 'Updating...';
        try {
            const { error } = await supabase.auth.updateUser({ password: passwordInput.value });
            if (error) throw error;
            await supabase.from('users').update({ password_plain: passwordInput.value }).eq('id', state.currentUser.id);
            showToast('Password updated!', 'success');
            passwordInput.value = '';
        } catch (err) { showToast(err.message, 'error'); } 
        finally { btn.disabled = false; btn.textContent = 'Update Password'; }
    });
}

// Redeem Code
const redeemForm = document.getElementById('redeem-code-form');
if (redeemForm) {
    redeemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const codeInput = document.getElementById('redeem-input');
        const btn = document.getElementById('redeem-submit-btn');
        btn.disabled = true; btn.innerText = 'Verifying...'; 

        try {
            const { data, error } = await supabase.rpc('redeem_coupon', { p_code: codeInput.value.trim() });
            if (error) throw error;
            showToast(`Success! +${data.points_awarded} pts.`, 'success');
            codeInput.value = ''; 
            await refreshUserData(); 
        } catch (err) { showToast(err.message || "Invalid code.", "error"); } 
        finally { btn.disabled = false; btn.innerText = 'Redeem Points'; }
    });
}

window.handleLogout = handleLogout;
checkAuth();
