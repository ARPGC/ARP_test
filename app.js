/**
 * EcoCampus - Main Application Logic (app.js)
 * Fully updated with New Year Theme Logic & Loader Fix
 */

import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, toggleSidebar, showPage, logUserActivity, debounce, showToast } from './utils.js';
import { loadDashboardData, renderDashboard, setupFileUploads } from './dashboard.js';
import { loadEventsData } from './events.js'; 

// --- NEW YEAR CONFIGURATION ---
const NEW_YEAR_TARGET = new Date("January 1, 2026 00:00:00").getTime();
let countdownInterval;
let fireworksActive = false;

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

        state.userAuth = session.user;
        await initializeApp();
    } catch (err) { 
        console.error('CRITICAL: Auth check failed unexpectedly:', err); 
        showToast('System error. Please refresh the page.', 'error');
    }
};

const initializeApp = async () => {
    try {
        console.log('Init: Fetching user profile...');
        
        // NEW YEAR: Festive Console Welcome 🎆
        console.log("%c🎆 Happy New Year from EcoCampus! 🥂", "color: #F59E0B; font-size: 16px; font-weight: bold; background: #FFFBEB; padding: 5px; border-radius: 5px; border: 1px solid #F59E0B;");

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
        
        if (!sessionStorage.getItem('login_logged')) {
            logUserActivity('login', 'User logged in');
            sessionStorage.setItem('login_logged', '1');
            showToast(`Welcome back, ${userProfile.full_name}!`, 'success');
        }

        history.replaceState({ pageId: 'dashboard' }, '', '#dashboard');

        // --- NEW YEAR THEME INIT ---
        initNewYearUI();

        // --- LOAD DATA ---
        try {
            if (!state.dashboardLoaded) {
                await loadDashboardData();
                state.dashboardLoaded = true;
            }
            renderDashboard();

            // Apply Golden Shimmer to Dashboard Cards after render
            setTimeout(() => {
                document.querySelectorAll('.glass-card').forEach(card => {
                    card.classList.add('shimmer-gold', 'ny-card');
                });
            }, 500);

            loadEventsData().then(() => {
                console.log("Init: Events loaded.");
            });

        } catch (dashErr) {
            console.error("Init: Data load failed:", dashErr);
            showToast('Partial data load failure.', 'warning');
        }
        
        // --- CRITICAL FIX: Force Hide Loader ---
        setTimeout(() => {
            const loader = document.getElementById('app-loading');
            if (loader) {
                loader.classList.add('loaded'); // Try CSS class first
                // Fallback: Force hide via JS styles (Fixes cache issues)
                loader.style.opacity = '0';
                loader.style.visibility = 'hidden';
                loader.style.pointerEvents = 'none';
            }
        }, 500);

        if(window.lucide) window.lucide.createIcons();
        setupFileUploads();

    } catch (err) { 
        console.error('CRITICAL: App initialization crashed:', err);
        // Force hide loader even on crash so user sees error toast
        const loader = document.getElementById('app-loading');
        if (loader) loader.style.display = 'none';
        showToast('App failed to initialize.', 'error');
    }
};

const handleLogout = async () => {
    try {
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

// --- NEW YEAR THEME LOGIC ---

const initNewYearUI = () => {
    // 1. Inject Fireworks Canvas
    if (!document.getElementById('fireworks-canvas')) {
        const canvas = document.createElement('canvas');
        canvas.id = 'fireworks-canvas';
        document.body.prepend(canvas);
        startFireworksLoop();
    }

    // 2. Inject Celebration Modal
    if (!document.getElementById('celebration-modal')) {
        const modal = document.createElement('div');
        modal.id = 'celebration-modal';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center invisible opacity-0 transition-all duration-500';
        modal.innerHTML = `
            <div id="celebration-content" class="transform scale-90 transition-transform duration-500 p-6 relative">
                <h1 class="ny-hero-text">HAPPY</h1>
                <h1 class="ny-hero-text">NEW YEAR</h1>
                <div class="ny-year mt-4">2026</div>
                <p class="text-gray-300 mt-6 text-lg font-medium">Let's make this year greener!</p>
                <button onclick="closeCelebrationModal()" class="mt-8 px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-full shadow-lg hover:scale-105 transition-transform">
                    Start Exploring
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // 3. Inject Countdown into Dashboard
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        const greetingDiv = dashboard.querySelector('.mb-8'); // The greeting container
        if (greetingDiv) {
            const countdownContainer = document.createElement('div');
            countdownContainer.id = 'ny-countdown';
            countdownContainer.className = 'ny-countdown-container animate-slideUp';
            countdownContainer.innerHTML = `
                <div class="ny-time-box"><span class="ny-time-val" id="cd-days">00</span><span class="ny-time-label">Days</span></div>
                <div class="ny-time-box"><span class="ny-time-val" id="cd-hours">00</span><span class="ny-time-label">Hrs</span></div>
                <div class="ny-time-box"><span class="ny-time-val" id="cd-mins">00</span><span class="ny-time-label">Mins</span></div>
                <div class="ny-time-box"><span class="ny-time-val" id="cd-secs">00</span><span class="ny-time-label">Secs</span></div>
            `;
            // Insert after the greeting text
            greetingDiv.appendChild(countdownContainer);
            startCountdown();
        }
    }
};

const startCountdown = () => {
    if (countdownInterval) clearInterval(countdownInterval);
    
    const update = () => {
        const now = new Date().getTime();
        const distance = NEW_YEAR_TARGET - now;

        if (distance < 0) {
            clearInterval(countdownInterval);
            document.getElementById('ny-countdown')?.remove(); // Remove countdown
            openCelebrationModal(); // Trigger Celebration
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val < 10 ? '0' + val : val;
        };

        setVal('cd-days', days);
        setVal('cd-hours', hours);
        setVal('cd-mins', minutes);
        setVal('cd-secs', seconds);
    };

    update();
    countdownInterval = setInterval(update, 1000);
};

window.openCelebrationModal = () => {
    const modal = document.getElementById('celebration-modal');
    if (modal) {
        modal.classList.remove('invisible', 'opacity-0');
        modal.classList.add('open');
        document.getElementById('celebration-content')?.classList.remove('scale-90');
        document.getElementById('celebration-content')?.classList.add('scale-100');
        fireworksActive = true; // Intensify fireworks
    }
};

window.closeCelebrationModal = () => {
    const modal = document.getElementById('celebration-modal');
    if (modal) {
        modal.classList.remove('open');
        modal.classList.add('invisible', 'opacity-0');
        fireworksActive = false; // Back to normal background fireworks
    }
};

// --- FIREWORKS ENGINE (Lightweight) ---
const startFireworksLoop = () => {
    const canvas = document.getElementById('fireworks-canvas');
    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const particles = [];
    
    // Resize handler
    window.addEventListener('resize', () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    });

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = height + Math.random() * 100; // Start below screen
            this.vx = Math.random() * 2 - 1; // Slight drift
            this.vy = -(Math.random() * 4 + 3); // Upward speed
            this.size = Math.random() * 3 + 1;
            this.color = `hsl(${Math.random() * 50 + 30}, 100%, 50%)`; // Gold/Orange/Yellow range
            this.life = 100 + Math.random() * 50;
            this.explode = false;
        }

        update() {
            if (!this.explode) {
                this.y += this.vy;
                this.x += this.vx;
                this.vy *= 0.99; // Drag
                
                // Explode condition (high in the sky or slow)
                if (this.vy > -1 || this.y < height * 0.2) {
                    this.explode = true;
                    this.createExplosion();
                }
            } else {
                // Fading out debris
                this.life--;
            }
        }

        createExplosion() {
            const count = 15;
            for (let i = 0; i < count; i++) {
                debris.push(new Debris(this.x, this.y, this.color));
            }
            this.life = 0; // Kill rocket
        }

        draw() {
            if (!this.explode) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
            }
        }
    }

    const debris = [];
    class Debris {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.alpha = 1;
            this.color = color;
            this.decay = Math.random() * 0.02 + 0.01;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.05; // Gravity
            this.alpha -= this.decay;
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.restore();
        }
    }

    const animate = () => {
        // Clear with fade effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; 
        if (document.documentElement.classList.contains('dark')) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
        }
        ctx.fillRect(0, 0, width, height);

        // Spawn rockets
        const spawnRate = fireworksActive ? 0.1 : 0.02; 
        if (Math.random() < spawnRate) {
            particles.push(new Particle());
        }

        particles.forEach((p, index) => {
            p.update();
            p.draw();
            if (p.life <= 0) particles.splice(index, 1);
        });

        debris.forEach((d, index) => {
            d.update();
            d.draw();
            if (d.alpha <= 0) debris.splice(index, 1);
        });

        requestAnimationFrame(animate);
    };

    animate();
};

// --- EVENT LISTENERS & UI LOGIC ---

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
            // SECURITY FIX: Only update via Auth API, never in 'users' table
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

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

window.handleLogout = handleLogout;
checkAuth();
