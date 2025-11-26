import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, formatDate, getIconForHistory, getPlaceholderImage, getTickImg, getUserInitials, getUserLevel, getTodayIST, logUserActivity } from './utils.js';
import { refreshUserData } from './app.js';

export const loadDashboardData = async () => {
    try {
        const userId = state.currentUser.id;
        const todayIST = getTodayIST(); 

        const [
            { data: checkinData },
            { data: streakData },
            { data: impactData }
        ] = await Promise.all([
            supabase.from('daily_checkins').select('id').eq('user_id', userId).eq('checkin_date', todayIST).limit(1),
            supabase.from('user_streaks').select('current_streak').eq('user_id', userId).single(),
            supabase.from('user_impact').select('*').eq('user_id', userId).maybeSingle()
        ]);
        
        state.currentUser.isCheckedInToday = (checkinData && checkinData.length > 0);
        state.currentUser.checkInStreak = streakData ? streakData.current_streak : 0;
        state.currentUser.impact = impactData || { total_plastic_kg: 0, co2_saved_kg: 0, events_attended: 0 };
        
    } catch (err) {
        console.error('Dashboard Data Error:', err);
    }
};

export const renderDashboard = () => {
    if (!state.currentUser) return; 
    renderDashboardUI();
    renderCheckinButtonState();
    initAQI(); // Initialize AQI card
};

const renderDashboardUI = () => {
    const user = state.currentUser;
    if(els.userPointsHeader) els.userPointsHeader.textContent = user.current_points;
    if(els.userNameGreeting) els.userNameGreeting.textContent = user.full_name;
    
    const sidebarName = document.getElementById('user-name-sidebar');
    const sidebarPoints = document.getElementById('user-points-sidebar');
    const sidebarLevel = document.getElementById('user-level-sidebar');
    const sidebarAvatar = document.getElementById('user-avatar-sidebar');

    if (sidebarName) sidebarName.innerHTML = `${user.full_name} ${getTickImg(user.tick_type)}`;
    if (sidebarPoints) sidebarPoints.textContent = user.current_points;
    if (sidebarLevel) {
        const level = getUserLevel(user.lifetime_points);
        sidebarLevel.textContent = level.title;
    }
    if (sidebarAvatar) {
        sidebarAvatar.src = user.profile_img_url || getPlaceholderImage('80x80', getUserInitials(user.full_name));
    }

    const impactRecycled = document.getElementById('impact-recycled');
    const impactCo2 = document.getElementById('impact-co2');
    const impactEvents = document.getElementById('impact-events');

    if(impactRecycled) impactRecycled.textContent = `${(user.impact?.total_plastic_kg || 0).toFixed(1)} kg`;
    if(impactCo2) impactCo2.textContent = `${(user.impact?.co2_saved_kg || 0).toFixed(1)} kg`;
    if(impactEvents) impactEvents.textContent = user.impact?.events_attended || 0;
};

const renderCheckinButtonState = () => {
    const btn = els.dailyCheckinBtn;
    if (!btn) return;
    const streak = state.currentUser.checkInStreak || 0;
    
    const preEl = document.getElementById('dashboard-streak-text-pre');
    const postEl = document.getElementById('dashboard-streak-text-post');
    if(preEl) preEl.textContent = streak;
    if(postEl) postEl.textContent = streak;

    if (state.currentUser.isCheckedInToday) {
        btn.classList.add('checkin-completed'); 
        btn.classList.remove('from-yellow-400', 'to-orange-400', 'dark:from-yellow-500', 'dark:to-orange-500', 'bg-gradient-to-r');
        btn.onclick = null; 
    } else {
        btn.classList.remove('checkin-completed');
        btn.classList.add('from-yellow-400', 'to-orange-400', 'dark:from-yellow-500', 'dark:to-orange-500', 'bg-gradient-to-r');
        btn.onclick = openCheckinModal;
    }
};

// --- AQI LOGIC ---
const initAQI = () => {
    const card = document.getElementById('dashboard-aqi-card');
    if (!card) return;

    if (navigator.geolocation) {
        card.classList.remove('hidden');
        card.innerHTML = `
            <div class="glass-card p-4 rounded-xl flex items-center justify-center">
                <i data-lucide="loader-2" class="w-5 h-5 animate-spin text-gray-400 mr-2"></i>
                <span class="text-sm text-gray-500">Detecting Air Quality...</span>
            </div>`;
        
        navigator.geolocation.getCurrentPosition(
            (position) => fetchAQI(position.coords.latitude, position.coords.longitude),
            (error) => {
                console.warn("AQI Location Error:", error);
                card.innerHTML = `
                    <div class="glass-card p-4 rounded-xl text-center">
                        <p class="text-sm text-gray-500">Enable location to see local Air Quality.</p>
                    </div>`;
            }
        );
    }
};

const fetchAQI = async (lat, lon) => {
    const card = document.getElementById('dashboard-aqi-card');
    try {
        const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`);
        const data = await response.json();
        const aqi = data.current.us_aqi;
        
        renderAQICard(card, aqi);
    } catch (err) {
        console.error("AQI Fetch Error:", err);
        card.classList.add('hidden');
    }
};

const renderAQICard = (card, aqi) => {
    let status = 'Good';
    let colorClass = 'from-green-100 to-emerald-50 dark:from-green-900/40 dark:to-emerald-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800';
    let icon = 'wind';
    let advice = "Great day for a nature walk on campus!";

    if (aqi > 50 && aqi <= 100) {
        status = 'Moderate';
        colorClass = 'from-yellow-100 to-orange-50 dark:from-yellow-900/40 dark:to-orange-900/20 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
        icon = 'cloud';
        advice = "Air is okay. Good for saving energy indoors.";
    } else if (aqi > 100) {
        status = 'Unhealthy';
        colorClass = 'from-red-100 to-rose-50 dark:from-red-900/40 dark:to-rose-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800';
        icon = 'alert-triangle';
        advice = "High pollution. Wear a mask if outside!";
    }

    card.innerHTML = `
        <div class="bg-gradient-to-br ${colorClass} border p-5 rounded-2xl shadow-sm relative overflow-hidden animate-breathe">
            <div class="relative z-10 flex justify-between items-start">
                <div>
                    <p class="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">Air Quality Index</p>
                    <h3 class="text-3xl font-black flex items-center gap-2">
                        ${aqi} <span class="text-lg font-medium opacity-80">(${status})</span>
                    </h3>
                    <p class="text-sm font-medium mt-2 opacity-90">${advice}</p>
                </div>
                <div class="w-12 h-12 rounded-full bg-white/40 dark:bg-black/20 flex items-center justify-center backdrop-blur-sm">
                    <i data-lucide="${icon}" class="w-6 h-6"></i>
                </div>
            </div>
            <div class="absolute -bottom-4 -right-4 w-24 h-24 bg-white/20 dark:bg-white/5 rounded-full blur-xl"></div>
            <div class="absolute -top-4 -left-4 w-20 h-20 bg-white/20 dark:bg-white/5 rounded-full blur-xl"></div>
        </div>
    `;
    if(window.lucide) window.lucide.createIcons();
};

// (Rest of existing dashboard exports: openCheckinModal, closeCheckinModal, etc. remain unchanged)
// Make sure they are still exported at the bottom of the file!
export const setupFileUploads = () => { /* ... existing upload logic ... */ };
window.openCheckinModal = openCheckinModal;
window.closeCheckinModal = closeCheckinModal;
window.handleDailyCheckin = handleDailyCheckin;
