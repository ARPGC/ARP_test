import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, toggleSidebar, showPage, handleBackButton } from './utils.js';
import { loadDashboardData, renderDashboard, setupFileUploads, loadHistoryData } from './dashboard.js';
import { loadStoreAndProductData, loadUserRewardsData, renderRewards } from './store.js';
import { loadLeaderboardData } from './social.js';
import { loadChallengesData, loadEventsData } from './challenges.js';

// Auth
const checkAuth = async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) { console.error('Session Error:', error.message); redirectToLogin(); return; }
        if (!session) { console.log('No active session.'); redirectToLogin(); return; }
        console.log('Authenticated.');
        state.userAuth = session.user;
        await initializeApp();
    } catch (err) { console.error('Auth check failed:', err); }
};

const initializeApp = async () => {
    try {
        const { data: userProfile, error } = await supabase.from('users').select('*').eq('auth_user_id', state.userAuth.id).single();
        if (error || !userProfile) { alert('Could not load profile. Logging out.'); await handleLogout(); return; }
        
        state.currentUser = userProfile;
        
        // Initialize Back Button Handling
        handleBackButton();
        // Replace current state for initial load to handle "back" to exit potentially
        window.history.replaceState({ pageId: 'dashboard' }, '', '#dashboard');

        await loadDashboardData();
        renderDashboard(); 
        
        setTimeout(() => document.getElementById('app-loading').classList.add('loaded'), 500);
        if(window.lucide) window.lucide.createIcons();
        
        await Promise.all([
            loadStoreAndProductData(),
            loadLeaderboardData(),
            loadHistoryData(),
            loadChallengesData(),
            loadEventsData(),
            loadUserRewardsData()
        ]);
        setupFileUploads();
    } catch (err) { console.error('Initialization Error:', err); }
};

const handleLogout = async () => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Logout error:', error.message);
        redirectToLogin();
    } catch (err) { console.error('Logout Error:', err); }
};

const redirectToLogin = () => { window.location.replace('login.html'); };

export const refreshUserData = async () => {
    try {
         const { data: userProfile, error } = await supabase.from('users').select('*').eq('id', state.currentUser.id).single();
        if (error || !userProfile) return;
        state.currentUser = userProfile;
        const header = document.getElementById('user-points-header');
        header.classList.add('points-pulse'); header.textContent = userProfile.current_points;
        document.getElementById('user-points-sidebar').textContent = userProfile.current_points;
        setTimeout(() => header.classList.remove('points-pulse'), 400);
        renderDashboard();
    } catch (err) { console.error('Refresh User Data Error:', err); }
};

// Event Listeners
if(els.storeSearch) els.storeSearch.addEventListener('input', renderRewards);
if(els.storeSearchClear) els.storeSearchClear.addEventListener('click', () => { els.storeSearch.value = ''; renderRewards(); });
if(els.sortBy) els.sortBy.addEventListener('change', renderRewards);
document.getElementById('sidebar-toggle-btn').addEventListener('click', () => toggleSidebar());
document.getElementById('logout-button').addEventListener('click', handleLogout);

// Theme
const themeBtn = document.getElementById('theme-toggle-btn');
const themeText = document.getElementById('theme-text');
const themeIcon = document.getElementById('theme-icon');
const applyTheme = (isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
    themeText.textContent = isDark ? 'Dark Mode' : 'Light Mode';
    themeIcon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
    if(window.lucide) window.lucide.createIcons();
};
themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('eco-theme', isDark ? 'dark' : 'light');
    applyTheme(isDark);
});
const savedTheme = localStorage.getItem('eco-theme');
applyTheme(savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches));

// Forms (Password, Redeem, Chatbot) listeners same as before...
document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    // ... existing code ...
});

document.getElementById('redeem-code-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    // ... existing code ...
});

document.getElementById('chatbot-form').addEventListener('submit', (e) => {
    e.preventDefault();
    // ... existing code ...
});

window.handleLogout = handleLogout;
checkAuth();
