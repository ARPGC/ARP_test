/**
 * EcoCampus - Main Application Logic (app.js)
 * Fully updated with New Year 2026 Theme, Loader Fix & Performance Optimizations
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
        // Emergency loader removal in case of critical failure
        const loader = document.getElementById('app-loading');
        if(loader) loader.style.display = 'none';
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
        
        setupFileUploads();

    } catch (err) { 
        console.error('CRITICAL: App initialization crashed:', err);
        showToast('App failed to initialize.', 'error');
    } finally {
        // --- LOADER FAIL-SAFE REMOVAL ---
        // This runs regardless of errors to ensure user isn't stuck on white screen
        // even if CSS caching is active.
        setTimeout(() => {
            const loader = document.getElementById('app-loading');
            if (loader) {
                loader.classList.add('loaded'); // Try CSS transition
                // FORCE REMOVE via inline style after short delay
                setTimeout(() => { loader.style.display = 'none'; }, 300);
            }
        }, 500);

        // Initialize Lucide icons
        if(window.lucide) window.lucide.createIcons();
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
    const targetDate = new Date('January 27, 2025 11:12:00').getTime();

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

        // Design matches your image: Dark Blue BG, White Text, Blue/Purple accent
        container.innerHTML = `
            <div class="glass-countdown p-6 flex flex-col items-center justify-center text-center relative overflow-hidden rounded-3xl" style="background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); border: 1px solid #334155;">
                <h3 class="text-xl font-bold text-white mb-5">
                    Time until <span style="color: #818cf8;">2026</span>
                </h3>
                
                <div class="grid grid-cols-4 gap-3 w-full max-w-sm mx-auto">
                    ${renderTimeBox(days, 'DAYS')}
                    ${renderTimeBox(hours, 'HRS')}
                    ${renderTimeBox(minutes, 'MINS')}
                    ${renderTimeBox(seconds, 'SECS', true)}
                </div>
            </div>
        `;
        
        if(window.lucide) window.lucide.createIcons();
    };

    updateTimer(); // Initial call
    countdownInterval = setInterval(updateTimer, 1000);
};

const renderTimeBox = (value, label, isLast = false) => `
    <div class="flex flex-col items-center">
        <div class="w-full aspect-square bg-slate-800/50 backdrop-blur-md rounded-2xl flex items-center justify-center border border-slate-700 shadow-lg">
            <span class="text-3xl md:text-4xl font-black ${isLast ? 'text-blue-400' : 'text-white'} tabular-nums font-mono">
                ${String(value).padStart(2, '0')}
            </span>
        </div>
        <span class="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider">${label}</span>
    </div>
`;

const renderHappyNewYear = (container) => {
    container.innerHTML = `
        <div class="glass-countdown p-8 flex flex-col items-center justify-center text-center relative overflow-hidden rounded-3xl" style="background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); border: 1px solid #334155;">
            <div class="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 animate-pulse"></div>
            <h1 class="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2 relative z-10">HAPPY 2026!</h1>
            <p class="text-lg font-medium text-slate-300 relative z-10">Welcome to a greener future. 🌿✨</p>
            <button onclick="launchConfetti()" class="mt-4 px-6 py-2 bg-blue-500 text-white font-bold rounded-full text-sm hover:bg-blue-600 transition-colors relative z-10 shadow-lg shadow-blue-500/30">
                Celebrate Again! 🎉
            </button>
        </div>
    `;
};

// Global Confetti Trigger
window.launchConfetti = () => {
    // Safety check if confetti lib failed to load
    if (!window.confetti) return;

    const duration = 3000;
    const end = Date.now() + duration;

    // Colors: Blue, Purple, White (Matching the new theme)
    const colors = ['#60a5fa', '#a78bfa', '#ffffff'];

    (function frame() {
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
