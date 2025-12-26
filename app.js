/**
 * EcoCampus - Main Application Logic (app.js)
 * Fully updated with New Year 2026 Theme & Performance Optimizations
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
        
        // NEW YEAR: Console Welcome
        console.log("%c🎉 Ready for 2026! EcoCampus Loaded. 🌿", "color: #fbbf24; font-size: 16px; font-weight: bold; background: #064e3b; padding: 5px; border-radius: 5px;");

        // PERFORMANCE: Remove heavy DOM elements if in Low Data Mode
        if (document.body.classList.contains('low-data-mode')) {
            const confettiCanvas = document.getElementById('confetti-canvas');
            if (confettiCanvas) {
                confettiCanvas.remove();
                console.log("🚀 Low Data Mode: Animations disabled.");
            }
        }

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

            // 2. Initialize New Year Countdown
            initNewYearCountdown();

            // 3. Load Events Data (Background Fetch)
            loadEventsData().then(() => {
                console.log("Init: Events loaded.");
            });

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
        redirectToLogin(); 
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
    } catch (err) { 
        console.error('RefreshData: Unexpected error:', err); 
    }
};

// --- NEW YEAR 2026 COUNTDOWN LOGIC ---

let countdownInterval;

const initNewYearCountdown = () => {
    const container = document.getElementById('new-year-countdown-container');
    if (!container) return;

    container.classList.remove('hidden');
    // Target: Jan 1, 2026 00:00:00
    const targetDate = new Date('January 1, 2026 00:00:00').getTime();

    const updateTimer = () => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
            clearInterval(countdownInterval);
            renderHappyNewYear(container);
            launchConfetti();
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        container.innerHTML = `
            <div class="glass-countdown p-6 flex flex-col items-center justify-center text-center relative overflow-hidden group hover:scale-[1.01] transition-transform duration-500">
                <div class="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-emerald-500/10 opacity-60"></div>
                <div class="absolute -top-10 -right-10 w-32 h-32 bg-yellow-400/20 rounded-full blur-3xl animate-pulse"></div>
                
                <h3 class="text-xs font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-[0.25em] mb-5 relative z-10 flex items-center gap-2">
                    <i data-lucide="sparkles" class="w-3 h-3"></i> Countdown to 2026
                </h3>
                
                <div class="grid grid-cols-4 gap-3 md:gap-8 relative z-10 w-full max-w-sm mx-auto">
                    ${renderTimeBox(days, 'Days')}
                    ${renderTimeBox(hours, 'Hrs')}
                    ${renderTimeBox(minutes, 'Mins')}
                    ${renderTimeBox(seconds, 'Secs')}
                </div>
            </div>
        `;
        
        if(window.lucide) window.lucide.createIcons();
    };

    updateTimer(); // Initial call
    countdownInterval = setInterval(updateTimer, 1000);
};

const renderTimeBox = (value, label) => `
    <div class="flex flex-col items-center">
        <div class="w-full aspect-square bg-white/40 dark:bg-black/30 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 dark:border-white/5 shadow-sm glow-gold">
            <span class="text-2xl md:text-4xl font-black text-gray-800 dark:text-white tabular-nums">${String(value).padStart(2, '0')}</span>
        </div>
        <span class="text-[10px] font-bold text-gray-500 dark:text-gray-400 mt-2 uppercase tracking-wider">${label}</span>
    </div>
`;

const renderHappyNewYear = (container) => {
    container.innerHTML = `
        <div class="glass-countdown p-8 flex flex-col items-center justify-center text-center relative overflow-hidden firework-click cursor-pointer" onclick="launchConfetti()">
            <div class="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-emerald-500/20 animate-pulse"></div>
            <h1 class="text-4xl md:text-6xl font-black animate-shimmer-text mb-2 relative z-10">HAPPY NEW YEAR!</h1>
            <p class="text-lg font-medium text-gray-600 dark:text-gray-300 relative z-10">Welcome to a greener 2026. 🌿✨</p>
            <button onclick="launchConfetti()" class="mt-4 px-6 py-2 bg-yellow-400 text-yellow-900 font-bold rounded-full text-sm hover:bg-yellow-300 transition-colors relative z-10 shadow-lg shadow-yellow-400/30">
                Celebrate Again! 🎉
            </button>
        </div>
    `;
};

// Global Confetti Trigger
window.launchConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    // Colors: Gold, Emerald, White
    const colors = ['#fbbf24', '#10b981', '#ffffff'];

    (function frame() {
        if (!window.confetti) return;
        
        confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: colors
        });
        confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: colors
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
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
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

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
