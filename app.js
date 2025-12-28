/**
 * EcoCampus - Main Application Logic (app.js)
 * Final Version: Fixed New Year Celebration State, Static Background (No Float) & Core Logic
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
        // Emergency loader removal
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
        
        // Console Art
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
            
            // Check Date for Festive Greeting (Jan 1 - Jan 5)
            const today = new Date();
            const isNewYearWeek = today.getMonth() === 0 && today.getDate() <= 5; 
            const greetingMsg = isNewYearWeek ? `Happy New Year, ${userProfile.full_name}! 🎆` : `Welcome back, ${userProfile.full_name}!`;
            
            showToast(greetingMsg, 'success');
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

            // 2. Initialize New Year Hero Banner
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

// --- NEW YEAR 2026 HERO BANNER LOGIC ---

let countdownInterval;

const initNewYearCountdown = () => {
    const container = document.getElementById('new-year-countdown-container');
    if (!container) return;

    container.classList.remove('hidden');
    
    // TARGET: Jan 1, 2026 00:00:00
    const targetDate = new Date('January 1, 2026 00:00:00').getTime();

    // Clear existing interval if re-initializing
    if (countdownInterval) clearInterval(countdownInterval);

    // DYNAMIC GREETING UPDATE (Optional)
    const greetingEl = document.getElementById('user-name-greeting');
    if (greetingEl) {
        const now = new Date();
        if (now.getFullYear() === 2026 && now.getMonth() === 0 && now.getDate() <= 5) {
             const parent = greetingEl.parentElement; 
             if(parent) parent.innerHTML = `Happy New Year, <span class="text-brand-600">${state.currentUser.full_name}</span>!`;
        }
    }

    const updateTimer = () => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        // --- FIXED STATE CHECK: IS IT 2026? ---
        if (distance < 0) {
            // Stop the countdown loop immediately
            clearInterval(countdownInterval);
            
            // Render the Fixed Celebration Banner
            renderHappyNewYear(container);
            
            // Auto-launch confetti only if the transition just happened (within last 10s)
            // This prevents confetti spam on page refresh unless it's THE moment.
            if (distance > -10000) {
                launchConfetti();
            }
            return;
        }

        // --- CALCULATE TIME ---
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // --- RENDER HOLOGRAPHIC COUNTDOWN ---
        container.innerHTML = `
            <div class="glass-hero p-6 relative w-full mb-6 group cursor-pointer overflow-hidden transition-all duration-500 hover:scale-[1.01]" onclick="launchConfetti()">
                
                <div class="hero-particle w-24 h-24 top-[-20px] right-[-20px] bg-purple-500/20 blur-xl"></div>
                <div class="hero-particle w-12 h-12 bottom-[10px] left-[10px] bg-blue-400/20 blur-lg delay-700"></div>
                
                <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    
                    <div class="text-center md:text-left">
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-3 shadow-inner">
                            <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse box-shadow-green"></span>
                            <span class="text-[10px] font-bold text-gray-100 uppercase tracking-widest">Live Countdown</span>
                        </div>
                        <h2 class="text-3xl md:text-4xl font-bold text-white mb-1 tracking-tight">
                            Time until <span class="text-shimmer font-black">2026</span>
                        </h2>
                        <p class="text-sm text-gray-300 font-medium">Let's make this year greener together.</p>
                    </div>

                    <div class="grid grid-cols-4 gap-2 md:gap-4">
                        ${renderHeroTimeBox(days, 'DAYS')}
                        ${renderHeroTimeBox(hours, 'HRS')}
                        ${renderHeroTimeBox(minutes, 'MINS')}
                        ${renderHeroTimeBox(seconds, 'SECS', true)}
                    </div>
                </div>
            </div>
        `;
        
        if(window.lucide) window.lucide.createIcons();
    };

    // Run once immediately to avoid 1s delay
    updateTimer(); 
    
    // Start interval only if in future
    const now = new Date().getTime();
    if (targetDate - now > 0) {
        countdownInterval = setInterval(updateTimer, 1000);
    }
};

const renderHeroTimeBox = (value, label, isAccent = false) => `
    <div class="flex flex-col items-center justify-center p-3 hero-timer-box min-w-[65px] md:min-w-[75px]">
        <span class="text-2xl md:text-3xl font-black ${isAccent ? 'text-blue-300' : 'text-white'} tabular-nums font-mono leading-none mb-1">
            ${String(value).padStart(2, '0')}
        </span>
        <span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">${label}</span>
    </div>
`;

// --- FIXED POSITION CELEBRATION CARD (CLEAN & STATIC) ---
const renderHappyNewYear = (container) => {
    container.innerHTML = `
        <div class="glass-hero new-year-fixed min-h-[200px] p-6 
                    flex flex-col items-center justify-center 
                    text-center relative overflow-hidden mb-6"
             onclick="launchConfetti()">

            <div class="absolute inset-0 bg-gradient-to-r 
                        from-blue-600/20 via-purple-600/20 to-blue-600/20"></div>
            
            <h1 class="text-3xl sm:text-4xl md:text-6xl font-black text-shimmer mb-3 relative z-10">
                HAPPY NEW YEAR!
            </h1>

            <p class="text-base md:text-lg font-medium text-gray-200 relative z-10 mb-6">
                Welcome to a greener future. 🌿✨
            </p>

            <button onclick="launchConfetti(event)"
                class="relative z-20 px-8 py-3 bg-white text-indigo-900 
                       font-bold rounded-full text-sm shadow-lg active:scale-95">
                Celebrate Again 🎉
            </button>
        </div>
    `;
};

// Global Confetti Trigger
window.launchConfetti = (e) => {
    if(e) e.stopPropagation();
    // Safety check if confetti lib failed to load
    if (!window.confetti) return;

    const duration = 3000;
    const end = Date.now() + duration;

    // Theme Colors: Blue, Purple, White, Gold
    const colors = ['#60a5fa', '#a78bfa', '#ffffff', '#fbbf24'];

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
