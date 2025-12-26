/**
 * EcoCampus - Main Application Logic (app.js)
 * Updated with New Year 2026 Celebration Layer 🎆
 */

import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, toggleSidebar, showPage, logUserActivity, debounce, showToast } from './utils.js';
import { loadDashboardData, renderDashboard, setupFileUploads } from './dashboard.js';
import { loadEventsData } from './events.js'; 

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
        
        // Console Greeting
        console.log("%c🌿 Ready for a Green 2026! 🎆", "color: #10B981; font-size: 16px; font-weight: bold; background: #ECFDF5; padding: 5px; border-radius: 5px;");

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
            showToast(`Welcome back, ${userProfile.full_name}!`, 'success');
        }

        // Set initial navigation state
        history.replaceState({ pageId: 'dashboard' }, '', '#dashboard');

        // --- LOAD DATA ---
        try {
            // 1. Load Dashboard Data (Check-ins, Stats)
            if (!state.dashboardLoaded) {
                await loadDashboardData();
                state.dashboardLoaded = true;
            }
            renderDashboard();

            // 2. Load Events Data (Background Fetch)
            loadEventsData().then(() => {
                console.log("Init: Events loaded.");
            });

            // 3. Initialize New Year Countdown
            initNewYearCountdown();

        } catch (dashErr) {
            console.error("Init: Data load failed:", dashErr);
            showToast('Partial data load failure.', 'warning');
        }
        
        // Remove app loader after delay for smooth transition
        setTimeout(() => {
            const loader = document.getElementById('app-loading');
            if (loader) loader.classList.add('loaded');
        }, 500);

        // Initialize Lucide icons
        if(window.lucide) window.lucide.createIcons();
        
        setupFileUploads();

    } catch (err) { 
        console.error('CRITICAL: App initialization crashed:', err);
        showToast('App failed to initialize.', 'error');
    }
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
        
        // Merge strategy
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

// ==========================================
// 🎆 NEW YEAR 2026 COUNTDOWN LOGIC
// ==========================================

const initNewYearCountdown = () => {
    const targetDate = new Date('January 1, 2026 00:00:00').getTime();
    const widget = document.getElementById('new-year-widget');
    const modal = document.getElementById('new-year-modal');

    // If widget was removed from HTML, skip logic
    if (!widget) return;

    const updateTimer = () => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        // --- TIME'S UP! CELEBRATE! ---
        if (distance < 0) {
            clearInterval(timerInterval);
            
            // Set Timer to 00
            ['cd-days', 'cd-hours', 'cd-minutes', 'cd-seconds'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = "00";
            });

            // Trigger Celebration Modal (only if not seen yet in this session)
            if (modal && !sessionStorage.getItem('ny2026_celebrated')) {
                modal.classList.remove('invisible', 'opacity-0');
                modal.classList.add('visible', 'opacity-100'); // Triggers CSS transitions
                
                launchFireworks();
                
                // Mark as celebrated so it doesn't pop up on every refresh immediately
                sessionStorage.setItem('ny2026_celebrated', 'true');
            }
            return;
        }

        // --- CALCULATE TIME ---
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // --- UPDATE DOM ---
        const dEl = document.getElementById('cd-days');
        const hEl = document.getElementById('cd-hours');
        const mEl = document.getElementById('cd-minutes');
        const sEl = document.getElementById('cd-seconds');

        if(dEl) dEl.textContent = days < 10 ? `0${days}` : days;
        if(hEl) hEl.textContent = hours < 10 ? `0${hours}` : hours;
        if(mEl) mEl.textContent = minutes < 10 ? `0${minutes}` : minutes;
        if(sEl) sEl.textContent = seconds < 10 ? `0${seconds}` : seconds;
    };

    // Run immediately and then every second
    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
};

// Uses 'canvas-confetti' library loaded in index.html
const launchFireworks = () => {
    if (typeof confetti === 'undefined') {
        console.warn('Fireworks engine not loaded.');
        return;
    }

    const duration = 5 * 1000; // 5 seconds of fireworks
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min, max) => Math.random() * (max - min) + min;

    console.log('🎆 Launching Fireworks!');

    const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        // Dual Cannons from left and right
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
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
        
        btn.disabled = true; 
        btn.innerText = 'Verifying...'; 

        try {
            // Call Database RPC function for coupon redemption
            const { data, error } = await supabase.rpc('redeem_coupon', { p_code: code });
            
            if (error) throw error;
            
            showToast(`Success! You earned ${data.points_awarded} points.`, 'success');
            codeInput.value = ''; 
            
            logUserActivity('redeem_code_success', `Redeemed code: ${code}`);
            await refreshUserData(); 
            
        } catch (err) { 
            console.error("Redeem Code Error:", err);
            showToast(err.message || "Invalid or expired code.", "error");
            logUserActivity('redeem_code_fail', `Failed to redeem code: ${code}`);
        } finally { 
            btn.disabled = false; 
            btn.innerText = 'Redeem Points';
        }
    });
}

// --- START APP ---
window.handleLogout = handleLogout;
checkAuth();
