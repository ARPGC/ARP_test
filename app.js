import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, toggleSidebar, showPage, logUserActivity, debounce } from './utils.js';
import { loadDashboardData, renderDashboard, setupFileUploads, loadHistoryData } from './dashboard.js';
import { loadStoreAndProductData, loadUserRewardsData, renderRewards } from './store.js';
import { loadLeaderboardData } from './social.js';
import { loadChallengesData } from './challenges.js';
import { loadEventsData } from './events.js'; 
import { loadGalleryData } from './gallery.js'; 

const checkAuth = async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) { redirectToLogin(); return; }
        state.userAuth = session.user;
        await initializeApp();
    } catch (err) { console.error('Auth check failed:', err); }
};

const initializeApp = async () => {
    try {
        const { data: userProfile, error } = await supabase.from('users').select('*').eq('auth_user_id', state.userAuth.id).single();
        if (error || !userProfile) { await handleLogout(); return; }
        
        state.currentUser = userProfile;
        logUserActivity('login', 'User logged in');
        history.replaceState({ pageId: 'dashboard' }, '', '#dashboard');

        try {
            await loadDashboardData();
            renderDashboard(); 
        } catch (dashErr) { console.error("Dashboard Init Error", dashErr); }
        
        setTimeout(() => document.getElementById('app-loading').classList.add('loaded'), 500);
        if(window.lucide) window.lucide.createIcons();
        
        await Promise.allSettled([
            loadStoreAndProductData(),
            loadLeaderboardData(),
            loadHistoryData(),
            loadChallengesData(),
            loadEventsData(),
            loadUserRewardsData(),
            loadGalleryData() // Ensure this is here
        ]);
        
        setupFileUploads();
        setupRealtimeSubscriptions(); 

    } catch (err) { console.error('Initialization Error:', err); }
};

const setupRealtimeSubscriptions = () => {
    const userSub = supabase
        .channel('public:users')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${state.currentUser.id}` }, (payload) => {
            state.currentUser = { ...state.currentUser, ...payload.new };
            renderDashboard(); 
        })
        .subscribe();
    state.activeSubscriptions.push(userSub);

    const ordersSub = supabase
        .channel('public:orders')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${state.currentUser.id}` }, () => {
             loadUserRewardsData(); 
             refreshUserData(); 
        })
        .subscribe();
    state.activeSubscriptions.push(ordersSub);
};

const handleLogout = async () => {
    try {
        state.activeSubscriptions.forEach(sub => supabase.removeChannel(sub));
        state.activeSubscriptions = [];
        await supabase.auth.signOut();
        redirectToLogin();
    } catch (err) { console.error('Logout Error:', err); }
};

const redirectToLogin = () => { window.location.replace('login.html'); };

export const refreshUserData = async () => {
    try {
        const { data: userProfile } = await supabase.from('users').select('*').eq('id', state.currentUser.id).single();
        if (!userProfile) return;
        
        state.currentUser = { ...userProfile, ...state.currentUser }; // Shallow merge to keep local state
        const header = document.getElementById('user-points-header');
        if(header) { header.classList.add('points-pulse'); header.textContent = userProfile.current_points; }
        const sidebarPoints = document.getElementById('user-points-sidebar');
        if(sidebarPoints) sidebarPoints.textContent = userProfile.current_points;
        setTimeout(() => header?.classList.remove('points-pulse'), 400);
        renderDashboard();
    } catch (err) {}
};

if(els.storeSearch) els.storeSearch.addEventListener('input', debounce(() => renderRewards(), 300));
if(els.storeSearchClear) els.storeSearchClear.addEventListener('click', () => { els.storeSearch.value = ''; renderRewards(); });
if(els.sortBy) els.sortBy.addEventListener('change', renderRewards);
document.getElementById('sidebar-toggle-btn')?.addEventListener('click', () => toggleSidebar());
document.getElementById('logout-button')?.addEventListener('click', handleLogout);

const themeBtn = document.getElementById('theme-toggle-btn');
if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('eco-theme', isDark ? 'dark' : 'light');
    });
}
const savedTheme = localStorage.getItem('eco-theme');
if(savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');

// Form Logic (Pwd & Redeem) - kept brief for readability
const changePwdForm = document.getElementById('change-password-form');
if (changePwdForm) {
    changePwdForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.auth.updateUser({ password: document.getElementById('new-password').value });
            if (error) throw error;
            alert('Password updated!');
        } catch (err) { alert(err.message); }
    });
}
const redeemForm = document.getElementById('redeem-code-form');
if (redeemForm) {
    redeemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const { data, error } = await supabase.rpc('redeem_coupon', { p_code: document.getElementById('redeem-input').value.trim() });
            if (error) throw error;
            alert(`Success! Earned ${data.points_awarded} points.`);
            await refreshUserData();
        } catch (err) { alert(err.message); }
    });
}

window.handleLogout = handleLogout;
checkAuth();
