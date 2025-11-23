import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { loadDashboardData, renderDashboard } from './dashboard.js';
import { loadStoreAndProductData, renderRewards } from './store.js';
import { loadEventsData, renderEventsPage } from './events.js';
import { loadChallengesData, renderChallengesPage } from './challenges.js';
import { logActivity } from './utils.js';

// FIX: Local debounce to avoid circular dependency with utils.js
const debounce = (func, wait) => {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
};

// Debounce refetch functions
const refreshDashboard = debounce(() => {
    console.log('⚡ Realtime: Refreshing Dashboard');
    loadDashboardData().then(() => renderDashboard());
}, 2000);

const refreshStore = debounce(() => {
    console.log('⚡ Realtime: Refreshing Store');
    loadStoreAndProductData().then(() => {
        if (document.getElementById('rewards').classList.contains('active')) {
            renderRewards(false);
        }
    });
}, 2000);

const refreshEvents = debounce(() => {
    console.log('⚡ Realtime: Refreshing Events');
    loadEventsData().then(() => {
        if (document.getElementById('events').classList.contains('active')) {
            renderEventsPage(false);
        }
    });
}, 2000);

const refreshChallenges = debounce(() => {
    console.log('⚡ Realtime: Refreshing Challenges');
    loadChallengesData().then(() => {
        if (document.getElementById('challenges').classList.contains('active')) {
            renderChallengesPage(false);
        }
    });
}, 2000);

export const initializeRealtime = () => {
    if (!state.currentUser) return;

    console.log('🔌 Initializing Supabase Realtime...');

    // 1. User Specific Updates
    supabase.channel('user-updates')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'users', filter: `id=eq.${state.currentUser.id}` },
            (payload) => {
                console.log('🔔 User Change:', payload);
                state.currentUser = { ...state.currentUser, ...payload.new };
                refreshDashboard();
            }
        )
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'daily_checkins', filter: `user_id=eq.${state.currentUser.id}` }, 
            refreshDashboard
        )
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${state.currentUser.id}` }, 
            () => {
                import('./store.js').then(m => m.loadUserRewardsData());
            }
        )
        .subscribe((status) => {
             if (status === 'SUBSCRIBED') console.log('✅ User Channel Subscribed');
        });

    // 2. Global App Updates
    supabase.channel('global-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refreshStore)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, refreshEvents)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, refreshChallenges)
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log('✅ Global Channel Subscribed');
        });
        
    logActivity('system', 'realtime_connected', 'Realtime channels active');
};
