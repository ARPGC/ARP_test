// =========================================
// 1. IMPORTS & SETUP
// =========================================
//
// FINAL FIX: Changing back to a named import (with curly braces).
// This error "...does not provide an export named 'default'" means
// your file uses `export const supabase`, not `export default`.
//
import { supabase } from './supabase-client.js';

// =========================================
// 2. APPLICATION STATE
// =========================================
let state = {
    currentUser: null, // Will be populated from 'users' table
    userImpact: { total_plastic_kg: 0, co2_saved_kg: 0, events_attended: 0 },
    leaderboard: [],
    history: [],
    dailyChallenges: [],
    events: [],
    stores: [],
    products: [],
    userRewards: [], // This will be a flattened list of order_items
    checkInReward: 10, // Business logic, can stay static
    levels: [
        { level: 1, title: 'Green Starter', minPoints: 0, nextMin: 1001 },
        { level: 2, title: 'Eco Learner', minPoints: 1001, nextMin: 2001 },
        { level: 3, title: 'Sustainability Leader', minPoints: 2001, nextMin: 4001 },
    ],
    // Store the raw Supabase auth user
    currentAuthUser: null 
};

// =========================================
// 3. DOM ELEMENT CACHE
// =========================================
const els = {
    pages: document.querySelectorAll('.page'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    userPointsHeader: document.getElementById('user-points-header'),
    userNameGreeting: document.getElementById('user-name-greeting'),
    dailyCheckinBtn: document.getElementById('daily-checkin-button'),
    lbPodium: document.getElementById('lb-podium-container'),
    lbList: document.getElementById('lb-list-container'),
    lbLeafLayer: document.getElementById('lb-leaf-layer'),
    productGrid: document.getElementById('product-grid'),
    storeSearch: document.getElementById('store-search-input'),
    storeSearchClear: document.getElementById('store-search-clear'),
    sortBy: document.getElementById('sort-by-select'),
    challengesList: document.getElementById('challenges-page-list'),
    eventsList: document.getElementById('event-list'),
    allRewardsList: document.getElementById('all-rewards-list'),
    historyList: document.getElementById('history-list'),
    storeDetailPage: document.getElementById('store-detail-page'),
    productDetailPage: document.getElementById('product-detail-page'),
    purchaseModalOverlay: document.getElementById('purchase-modal-overlay'),
    purchaseModal: document.getElementById('purchase-modal'),
    qrModalOverlay: document.getElementById('qr-modal-overlay'),
    qrModal: document.getElementById('qr-modal'),
    appLoader: document.getElementById('app-loading'),
    
    // Sidebar elements
    sidebarAvatar: document.getElementById('user-avatar-sidebar'),
    sidebarName: document.getElementById('user-name-sidebar'),
    sidebarLevel: document.getElementById('user-level-sidebar'),
    sidebarPoints: document.getElementById('user-points-sidebar'),

    // Profile page elements
    profileAvatar: document.getElementById('profile-avatar'),
    profileName: document.getElementById('profile-name'),
    profileEmail: document.getElementById('profile-email'),
    profileJoined: document.getElementById('profile-joined'),
    profileLevelTitle: document.getElementById('profile-level-title'),
    profileLevelNumber: document.getElementById('profile-level-number'),
    profileLevelProgress: document.getElementById('profile-level-progress'),
    profileLevelNext: document.getElementById('profile-level-next'),
    profileStudentId: document.getElementById('profile-student-id'),
    profileCourse: document.getElementById('profile-course'),
    profileMobile: document.getElementById('profile-mobile'),
    profileEmailPersonal: document.getElementById('profile-email-personal'),
};

// =========================================
// 4. AUTHENTICATION & INITIALIZATION
// =========================================

// Listen for authentication changes
// This line should now work with the corrected import
supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        state.currentAuthUser = session.user;
        // User is signed in, fetch all app data
        await initializeApp(session.user);
    } else {
        // User is not signed in, redirect to login page
        window.location.href = 'login.html';
    }
});

/**
 * Main function to fetch all data from Supabase after login.
 */
async function initializeApp(authUser) {
    try {
        console.log("Initializing app for user:", authUser.id);

        // --- Fetch User Profile Safely ---
        const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', authUser.id)
            .single();

        if (profileError || !userProfile) {
            console.warn('User profile missing, using fallback.');

            state.currentUser = {
                id: authUser.id,
                full_name: authUser.email?.split('@')[0] || "User",
                current_points: 0,
                lifetime_points: 0,
                profile_img_url: null,
                checkInStreak: 0,
                isCheckedInToday: false
            };
        } else {
            state.currentUser = {
                ...userProfile,
                checkInStreak: 0,
                isCheckedInToday: false
            };
        }

        const today = new Date().toISOString().split("T")[0];

        // --- Safe Parallel Fetch for all app data ---
        const [
            leaderboardRes,
            historyRes,
            challengesRes,
            challengeSubmissionsRes,
            eventsRes,
            eventAttendanceRes,
            storesRes,
            productsRes,
            ordersRes,
            streakRes,
            checkinRes,
            impactRes
        ] = await Promise.allSettled([
            supabase.from('users').select('id, full_name, course, lifetime_points, profile_img_url, tick_type').order('lifetime_points', { ascending: false }).limit(10),
            supabase.from('points_ledger').select('*').eq('user_id', state.currentUser.id).order('created_at', { ascending: false }).limit(20),
            supabase.from('challenges').select('*').eq('is_active', true),
            supabase.from('challenge_submissions').select('challenge_id, status').eq('user_id', state.currentUser.id),
            supabase.from('events').select('*').order('start_at', { ascending: true }),
            supabase.from('event_attendance').select('event_id, status').eq('user_id', state.currentUser.id),
            supabase.from('stores').select('*').eq('is_active', true),
            supabase.from('products').select('*, product_images(*), product_features(*), product_specifications(*)').eq('is_active', true),
            supabase.from('orders').select('*, order_items(*, products(*, product_images(image_url), stores(name)))').eq('user_id', state.currentUser.id).order('created_at', { ascending: false }),
            supabase.from('user_streaks').select('*').eq('user_id', state.currentUser.id).single(),
            supabase.from('daily_checkins').select('*').eq('user_id', state.currentUser.id).eq('checkin_date', today),
            supabase.from('user_impact').select('*').eq('user_id', state.currentUser.id).single()
        ]);

        // --- Helper for safe access ---
        const safeData = (res, fallback = []) =>
            (res && res.status === "fulfilled" && res.value && res.value.data) ? res.value.data : fallback;

        // --- Assign Safe State Values ---
        state.leaderboard = safeData(leaderboardRes, []).map(u => ({
            ...u,
            name: u.full_name,
            lifetimePoints: u.lifetime_points,
            avatarUrl: u.profile_img_url,
            isCurrentUser: u.id === state.currentUser.id,
            initials: u.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        }));

        state.history = safeData(historyRes, []).map(mapHistory);
        const userSubmissions = safeData(challengeSubmissionsRes, []).reduce((acc, s) => { acc[s.challenge_id] = s.status; return acc; }, {});
        state.dailyChallenges = safeData(challengesRes, []).map(c => mapChallenge(c, userSubmissions));

        const userAttendance = safeData(eventAttendanceRes, []).reduce((acc, a) => { acc[a.event_id] = a.status; return acc; }, {});
        state.events = safeData(eventsRes, []).map(e => mapEvent(e, userAttendance));

        state.stores = safeData(storesRes, []);
        state.products = safeData(productsRes, []).map(mapProduct);

        state.userRewards = [];
        safeData(ordersRes, []).forEach(order => {
            order.order_items?.forEach(item => {
                state.userRewards.push({
                    userRewardId: item.id,
                    orderId: order.id,
                    productId: item.product_id,
                    purchaseDate: new Date(order.created_at).toLocaleDateString('en-CA'),
                    status: order.status,
                    productName: item.products?.name,
                    productImage: item.products?.product_images?.[0]?.image_url || 'https://placehold.co/100x100',
                    storeName: item?.products?.stores?.name || "Unknown Store",
                });
            });
        });

        state.currentUser.checkInStreak = (streakRes?.value?.data?.current_streak) ?? 0;
        state.currentUser.isCheckedInToday = (checkinRes?.value?.data?.length > 0) ?? false;
        state.userImpact = impactRes?.value?.data ?? { total_plastic_kg: 0, co2_saved_kg: 0, events_attended: 0 };

        // --- Render UI ---
        setupEventListeners();
        renderAllUI();

        // --- Hide Loader ---
        els.appLoader.classList.add("loaded");
        console.log("App initialized safely.");

    } catch (error) {
        console.error("Fatal app error:", error);
        els.appLoader.innerHTML = `<p class="text-red-500 p-4">Error loading app. Please refresh.</p>`;
    }
}


/**
 * Renders all dynamic UI components.
 */
function renderAllUI() {
    renderDashboard();
    renderProfile();
    // Default to student leaderboard
    showLeaderboardTab('student'); 
    // Other pages will be rendered when navigated to
    lucide.createIcons();
}

// =========================================
// 5. DATA MAPPING HELPERS
// =========================================

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const mapHistory = (h) => ({
    type: h.source_type,
    description: h.description,
    points: h.points_delta,
    date: new Date(h.created_at).toLocaleDateString('en-CA'), // YYYY-MM-DD
    icon: {
        'event': 'calendar-check',
        'order': 'shopping-cart',
        'challenge': 'award',
        'plastic': 'recycle',
        'checkin': 'calendar-check',
        'coupon': 'ticket'
    }[h.source_type] || 'star'
});

const mapChallenge = (c, submissions) => {
    const userStatus = submissions[c.id];
    let status = 'active';
    let buttonText = c.type === 'quiz' ? 'Start Quiz' : 'Upload';
    let action = c.type === 'quiz' ? `openEcoQuizModal('${c.id}')` : `openChallengeUpload('${c.id}')`;

    if (userStatus === 'pending') {
        status = 'pending';
        buttonText = 'Pending Review';
        action = null;
    } else if (userStatus === 'approved') {
        status = 'completed';
        buttonText = 'Completed';
        action = null;
    } else if (userStatus === 'rejected') {
        status = 'rejected';
        buttonText = 'Try Again';
        // allow retry
    }

    return {
        id: c.id,
        title: c.title,
        description: c.description,
        points_reward: c.points_reward,
        icon: {
            'upload': 'camera',
            'quiz': 'brain',
            'photo': 'eye',
            'link': 'link'
        }[c.type] || 'award',
        status: status,
        buttonText: buttonText,
        type: c.type,
        action: action
    };
};

const mapEvent = (e, attendance) => {
    const userStatus = attendance[e.id];
    let status = 'upcoming';
    const now = new Date();
    const eventEnd = e.end_at ? new Date(e.end_at) : new Date(e.start_at);

    if (userStatus === 'confirmed') {
        status = 'attended';
    } else if (userStatus === 'registered') {
        status = 'registered';
    } else if (userStatus === 'absent') {
        status = 'missed';
    } else if (now > eventEnd) {
        status = 'missed'; // Default to missed if event is over and user didn't attend
    }

    return {
        id: e.id,
        title: e.title,
        description: e.description,
        date: new Date(e.start_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        points: e.points_reward,
        status: status
    };
};

const mapProduct = (p) => ({
    productId: p.id,
    storeId: p.store_id,
    name: p.name,
    images: (p.product_images || []).length > 0 ? p.product_images.map(img => img.image_url) : ['https://placehold.co/400x300/cccccc/FFFFFF?text=No+Image'],
    description: p.description,
    features: (p.product_features || []).map(f => f.feature),
    specifications: (p.product_specifications || []).map(s => ({ key: s.spec_key, value: s.spec_value })),
    originalPrice: p.original_price,
    discountedPrice: p.discounted_price,
    cost: p.ecopoints_cost,
    popularity: p.metadata?.popularity || 0,
    instructions: p.metadata?.instructions || 'Show QR code at counter.'
});

// =========================================
// 6. CORE APP HELPERS
// =========================================

/**
 * Gets the user's current level and progress.
 */
const getUserLevel = (points) => {
    let current = state.levels[0];
    for (let i = state.levels.length - 1; i >= 0; i--) {
        if (points >= state.levels[i].minPoints) {
            current = state.levels[i];
            break;
        }
    }
    const nextMin = current.nextMin || Infinity;
    let progress = 0;
    let progressText = "Max Level";
    if (nextMin !== Infinity) {
        const pointsInLevel = points - current.minPoints;
        const range = nextMin - current.minPoints;
        progress = Math.max(0, Math.min(100, (pointsInLevel / range) * 100));
        progressText = `${points} / ${nextMin} Pts`;
    }
    return { ...current, progress, progressText };
};

/**
 * Combines products with their store info.
 */
const getAllProducts = () => {
    return state.products.map(p => {
        const store = state.stores.find(s => s.id === p.storeId);
        return {
            ...p,
            storeName: store ? store.name : 'Unknown Store',
            storeLogo: store ? store.logo_url : 'https://placehold.co/40x40'
        };
    });
};

/**
 * Gets a single product and its store by Product ID.
 */
const getProduct = (productId) => {
    const product = state.products.find(p => p.productId === productId);
    if (!product) return { store: null, product: null };
    
    const store = state.stores.find(s => s.id === product.storeId);
    return { store, product: {...product, storeName: store.name, storeLogo: store.logo_url } };
};

/**
 * Animates the points display in the header and sidebar.
 */
const animatePointsUpdate = (newPoints) => {
    state.currentUser.current_points = newPoints;
    
    // Header
    els.userPointsHeader.classList.add('points-pulse');
    els.userPointsHeader.textContent = newPoints;
    setTimeout(() => els.userPointsHeader.classList.remove('points-pulse'), 400);

    // Sidebar
    els.sidebarPoints.textContent = newPoints;

    // Ecopoints page
    const ecopointsBalance = document.getElementById('ecopoints-balance');
    if (ecopointsBalance) {
        ecopointsBalance.textContent = newPoints;
    }
};

/**
 * Re-fetches the user's points and updates the UI.
 */
async function refreshUserPoints() {
    const { data, error } = await supabase
        .from('users')
        .select('current_points, lifetime_points')
        .eq('id', state.currentUser.id)
        .single();
    
    if (data) {
        animatePointsUpdate(data.current_points);
        state.currentUser.lifetime_points = data.lifetime_points;
        // Re-render components that depend on lifetime points
        renderProfile();
    }
}

// =========================================
// 7. NAVIGATION & UI
// =========================================

// Make functions globally accessible for inline onclicks
window.showPage = (pageId) => {
    els.pages.forEach(p => p.classList.remove('active'));
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');

    // Clear detail pages when navigating away
    if (pageId !== 'store-detail-page' && pageId !== 'product-detail-page') {
        els.storeDetailPage.innerHTML = '';
        els.productDetailPage.innerHTML = '';
    }

    document.querySelectorAll('.nav-item, .sidebar-nav-item').forEach(btn => {
        const onclickVal = btn.getAttribute('onclick');
        btn.classList.toggle('active', onclickVal && onclickVal.includes(`'${pageId}'`));
    });

    document.querySelector('.main-content').scrollTop = 0;

    // Lazy load page content
    switch (pageId) {
        case 'dashboard':
            renderDashboard();
            if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
            break;
        case 'leaderboard':
            showLeaderboardTab(currentLeaderboardTab); // Renders leaderboard
            break;
        case 'rewards':
            renderRewards();
            if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
            break;
        case 'my-rewards':
            renderMyRewardsPage();
            if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
            break;
        case 'history':
            renderHistory();
            if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
            break;
        case 'ecopoints':
            renderEcoPointsPage();
            if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
            break;
        case 'challenges':
            renderChallengesPage();
            if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
            break;
        case 'events':
            renderEventsPage();
            if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
            break;
        case 'profile':
            renderProfile();
            if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
            break;
        default:
            if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
    }

    toggleSidebar(true); // Close sidebar on nav
    lucide.createIcons();
};

window.toggleSidebar = (forceClose = false) => {
    if (forceClose) {
        els.sidebar.classList.add('-translate-x-full');
        els.sidebarOverlay.classList.add('opacity-0');
        els.sidebarOverlay.classList.add('hidden');
    } else {
        els.sidebar.classList.toggle('-translate-x-full');
        els.sidebarOverlay.classList.toggle('hidden');
        els.sidebarOverlay.classList.toggle('opacity-0');
    }
};

// =========================================
// 8. PAGE RENDER FUNCTIONS
// =========================================

function renderDashboard() {
    const user = state.currentUser;
    els.userPointsHeader.textContent = user.current_points;
    els.userNameGreeting.textContent = user.full_name.split(' ')[0];
    
    // Sidebar Header
    els.sidebarName.textContent = user.full_name;
    els.sidebarPoints.textContent = user.current_points;
    const level = getUserLevel(user.lifetime_points);
    els.sidebarLevel.textContent = level.title;
    els.sidebarAvatar.src = user.profile_img_url || 'https://placehold.co/80x80/cccccc/FFFFFF?text=USER';

    // Impact stats
    const impact = state.userImpact;
    document.getElementById('impact-recycled').textContent = `${(impact.total_plastic_kg || 0).toFixed(1)} kg`;
    document.getElementById('impact-co2').textContent = `${(impact.co2_saved_kg || 0).toFixed(1)} kg`;
    document.getElementById('impact-events').textContent = impact.events_attended || 0;

    // Upcoming Event Card
    const upcomingEvent = state.events.find(e => e.status === 'upcoming' || e.status === 'registered');
    const eventCard = document.getElementById('dashboard-event-card');
    if (upcomingEvent) {
        document.getElementById('dashboard-event-title').textContent = upcomingEvent.title;
        document.getElementById('dashboard-event-desc').textContent = upcomingEvent.description.substring(0, 75) + '...';
        eventCard.classList.remove('hidden');
    } else {
        eventCard.classList.add('hidden');
    }

    renderCheckinButtonState();
}

function renderCheckinButtonState() {
    document.getElementById('dashboard-streak-text').textContent = `${state.currentUser.checkInStreak} Day Streak`;
    const btn = els.dailyCheckinBtn;
    const checkIcon = document.getElementById('checkin-check-icon');
    const subtext = document.getElementById('checkin-subtext');
    const doneText = document.getElementById('checkin-done-text');

    if (state.currentUser.isCheckedInToday) {
        btn.classList.add('checkin-completed');
        btn.classList.remove('from-yellow-400', 'to-orange-400', 'dark:from-yellow-500', 'dark:to-orange-500', 'bg-gradient-to-r');
        btn.querySelector('h3').textContent = "Check-in Complete";
        subtext.style.display = 'none';
        doneText.classList.remove('hidden');
        checkIcon.classList.remove('hidden');
        btn.onclick = null;
    } else {
        btn.classList.remove('checkin-completed');
        btn.classList.add('from-yellow-400', 'to-orange-400', 'dark:from-yellow-500', 'dark:to-orange-500', 'bg-gradient-to-r');
        btn.querySelector('h3').textContent = "Daily Check-in";
        subtext.style.display = 'block';
        doneText.classList.add('hidden');
        checkIcon.classList.add('hidden');
        btn.onclick = openCheckinModal; // Re-assign onclick
    }
}

function renderProfile() {
    const u = state.currentUser;
    const l = getUserLevel(u.lifetime_points);
    
    els.profileName.textContent = u.full_name;
    els.profileEmail.textContent = u.email;
    els.profileAvatar.src = u.profile_img_url || 'https://placehold.co/80x80/cccccc/FFFFFF?text=USER';
    els.profileJoined.textContent = 'Joined ' + new Date(u.joined_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    els.profileLevelTitle.textContent = l.title;
    els.profileLevelNumber.textContent = l.level;
    els.profileLevelProgress.style.width = l.progress + '%';
    els.profileLevelNext.textContent = l.progressText;
    
    els.profileStudentId.textContent = u.student_id;
    els.profileCourse.textContent = u.course;
    els.profileMobile.textContent = u.mobile || 'Not set';
    els.profileEmailPersonal.textContent = u.email;
}

let currentLeaderboardTab = 'student';
window.showLeaderboardTab = (tab) => {
    currentLeaderboardTab = tab;
    const btnStudent = document.getElementById('leaderboard-tab-student');
    const btnDept = document.getElementById('leaderboard-tab-dept');
    const contentStudent = document.getElementById('leaderboard-content-student');
    const contentDept = document.getElementById('leaderboard-content-department');

    // NOTE: Department leaderboard logic is not implemented as the schema doesn't support it.
    // We will hide the button for now.
    btnDept.classList.add('hidden');
    // Force student tab
    tab = 'student';

    if (tab === 'department') {
        // This block is currently unreachable
        btnDept.classList.add('active');
        btnStudent.classList.remove('active');
        contentDept.classList.remove('hidden');
        contentStudent.classList.add('hidden');
        if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
        // renderDepartmentLeaderboard(); // This function would need to be created
    } else {
        // Default to student
        btnStudent.classList.add('active');
        btnDept.classList.remove('active');
        contentStudent.classList.remove('hidden');
        contentDept.classList.add('hidden');
        if(els.lbLeafLayer) els.lbLeafLayer.classList.remove('hidden');
        renderStudentLeaderboard();
    }
};

function renderStudentLeaderboard() {
    const sorted = state.leaderboard; // Already sorted from Supabase
    if (sorted.length === 0) {
        els.lbPodium.innerHTML = '<p class="text-center text-gray-500">No rankings yet.</p>';
        return;
    }
    
    const rank1 = sorted[0];
    const rank2 = sorted.length > 1 ? sorted[1] : null;
    const rank3 = sorted.length > 2 ? sorted[2] : null;
    const rest = sorted.slice(3);

    els.lbPodium.innerHTML = `
        <div class="podium">
            <div class="champ">
                <div class="badge silver">${rank2 ? rank2.initials : 'N/A'}</div>
                <div class="champ-name">${rank2 ? rank2.name : '-'}</div>
                <div class="champ-points">${rank2 ? rank2.lifetimePoints : 0} pts</div>
                <div class="rank">2nd</div>
            </div>
            <div class="champ">
                <div class="badge gold">${rank1 ? rank1.initials : 'N/A'}</div>
                <div class="champ-name">${rank1 ? rank1.name : '-'}</div>
                <div class="champ-points">${rank1 ? rank1.lifetimePoints : 0} pts</div>
                <div class="rank">1st</div>
            </div>
            <div class="champ">
                <div class="badge bronze">${rank3 ? rank3.initials : 'N/A'}</div>
                <div class="champ-name">${rank3 ? rank3.name : '-'}</div>
                <div class="champ-points">${rank3 ? rank3.lifetimePoints : 0} pts</div>
                <div class="rank">3rd</div>
            </div>
        </div>
    `;

    els.lbList.innerHTML = '';
    rest.forEach((user) => {
        els.lbList.innerHTML += `
            <div class="item ${user.isCurrentUser ? 'is-me' : ''}">
                <div class="user">
                    <div class="circle">${user.initials}</div>
                    <div class="user-info">
                        <strong>${user.name} ${user.isCurrentUser ? '(You)' : ''}</strong>
                        <span class="sub-class">${user.course}</span>
                    </div>
                </div>
                <div class="points-display">${user.lifetimePoints} pts</div>
            </div>
        `;
    });
}

function renderRewards() {
    els.productGrid.innerHTML = '';
    let products = getAllProducts(); // Gets products combined with store info

    const searchTerm = els.storeSearch.value.toLowerCase();
    if(searchTerm.length > 0) {
        products = products.filter(p => 
            p.name.toLowerCase().includes(searchTerm) || 
            p.storeName.toLowerCase().includes(searchTerm)
        );
    }
    els.storeSearchClear.classList.toggle('hidden', !searchTerm);

    const criteria = els.sortBy.value;
    products.sort((a, b) => {
        switch (criteria) {
            case 'points-lh': return a.cost - b.cost;
            case 'points-hl': return b.cost - a.cost;
            case 'price-lh': return a.discountedPrice - b.discountedPrice;
            case 'price-hl': return b.discountedPrice - a.discountedPrice;
            case 'popularity': default: return b.popularity - a.popularity;
        }
    });

    if (products.length === 0) {
        els.productGrid.innerHTML = '<p class="text-center text-gray-500 col-span-2">No rewards found.</p>';
        return;
    }

    products.forEach(p => {
        els.productGrid.innerHTML += `
            <div class="w-full flex-shrink-0 glass-card border border-gray-200/60 dark:border-gray-700/80 rounded-2xl overflow-hidden flex flex-col cursor-pointer"
                 onclick="showProductDetailPage('${p.productId}')">
                <img src="${p.images[0].replace('400x300', '300x225')}" class="w-full h-40 object-cover" onerror="this.src='https://placehold.co/300x225/cccccc/FFFFFF?text=No+Image'">
                <div class="p-3 flex flex-col flex-grow">
                    <div class="flex items-center mb-1">
                        <img src="${p.storeLogo.replace('100x100', '40x40')}" class="w-5 h-5 rounded-full mr-2 border dark:border-gray-600" onerror="this.src='https://placehold.co/40x40'">
                        <p class="text-xs font-medium text-gray-600 dark:text-gray-400">${p.storeName}</p>
                    </div>
                    <p class="font-bold text-gray-800 dark:text-gray-100 text-sm truncate mt-1">${p.name}</p>
                    <div class="mt-auto pt-2">
                        <p class="text-xs text-gray-400 dark:text-gray-500 line-through">₹${p.originalPrice}</p>
                        <div class="flex items-center font-bold text-gray-800 dark:text-gray-100 my-1">
                            <span class="text-md text-green-700 dark:text-green-400">₹${p.discountedPrice}</span>
                            <span class="mx-1 text-gray-400 dark:text-gray-500 text-xs">+</span>
                            <i data-lucide="leaf" class="w-3 h-3 text-green-500 mr-1"></i>
                            <span class="text-sm text-green-700 dark:text-green-400">${p.cost}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    lucide.createIcons();
}

window.showProductDetailPage = (productId) => {
    const { store, product } = getProduct(productId);
    if (!product) return;

    const images = product.images.length > 0 ? product.images : ['https://placehold.co/600x400/cccccc/FFFFFF?text=No+Image'];
    let sliderImagesHTML = '';
    let sliderDotsHTML = '';

    images.forEach((img, index) => {
        sliderImagesHTML += `
            <img src="${img.replace('400x300', '600x400')}" class="slider-item w-full h-80 object-cover flex-shrink-0 rounded-3xl" data-index="${index}" onerror="this.src='https://placehold.co/600x400/cccccc/FFFFFF?text=No+Image'">
        `;
        sliderDotsHTML += `<button class="slider-dot w-2.5 h-2.5 rounded-full bg-white/60 dark:bg-gray-700/80 ${index === 0 ? 'active' : ''}"></button>`;
    });

    const featuresHTML = (product.features || []).map(f => `
        <li class="flex items-start space-x-2">
            <span class="mt-1 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center flex-shrink-0">
                <i data-lucide="check" class="w-3 h-3 text-emerald-600 dark:text-emerald-300"></i>
            </span>
            <span class="text-sm text-gray-700 dark:text-gray-300">${f}</span>
        </li>
    `).join('');

    const canAfford = state.currentUser.current_points >= product.cost;

    els.productDetailPage.innerHTML = `
        <div class="pb-8">
            <div class="relative">
                <div class="slider-container flex w-full overflow-x-auto snap-x snap-mandatory gap-4 px-4 pt-4 pb-10">
                    ${sliderImagesHTML}
                </div>
                <button onclick="showPage('rewards')" class="absolute top-6 left-6 p-2 glass-card rounded-full text-gray-700 dark:text-gray-200 !px-2 !py-2">
                    <i data-lucide="arrow-left" class="w-5 h-5"></i>
                </button>
                <div class="absolute bottom-5 left-0 right-0 flex justify-center items-center space-x-2 z-10">${sliderDotsHTML}</div>
            </div>
            <div class="px-4 -mt-6">
                <div class="glass-card p-6 rounded-3xl">
                    <div class="flex items-start justify-between gap-3 mb-2">
                        <div>
                            <h2 class="text-2xl font-extrabold text-gray-900 dark:text-gray-50">${product.name}</h2>
                            <div class="flex items-center mt-2">
                                <img src="${store.logo_url.replace('100x100', '40x40')}" class="w-7 h-7 rounded-full mr-2 border" onerror="this.src='https://placehold.co/40x40'">
                                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">${store.name}</p>
                            </div>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
                            ${product.cost} EcoPts
                        </span>
                    </div>
                    <div class="mt-4 space-y-5">
                        <div>
                            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><i data-lucide="file-text" class="w-4 h-4"></i> Description</h3>
                            <p class="mt-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">${product.description}</p>
                        </div>
                        ${featuresHTML ? `<div><h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><i data-lucide="sparkles" class="w-4 h-4"></i> Highlights</h3><ul class="mt-2 space-y-2">${featuresHTML}</ul></div>` : ''}
                        <div class="pt-4 mt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                            <div>
                                <p class="text-xs text-gray-500 line-through">₹${product.originalPrice}</p>
                                <div class="flex items-center font-bold text-gray-800 dark:text-gray-100">
                                    <span class="text-xl text-emerald-700 dark:text-emerald-400">₹${product.discountedPrice}</span>
                                    <span class="mx-2 text-gray-400 text-sm">+</span>
                                    <i data-lucide="leaf" class="w-4 h-4 text-emerald-500 mr-1"></i>
                                    <span class="text-xl text-emerald-700">${product.cost}</span>
                                </div>
                            </div>
                            <button onclick="openPurchaseModal('${product.productId}')" class="btn-eco-gradient text-white text-sm font-semibold py-3 px-5 rounded-xl flex-shrink-0 ${canAfford ? '' : 'opacity-60 cursor-not-allowed'}">
                                ${canAfford ? 'Redeem Offer' : 'Not enough points'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    els.pages.forEach(p => p.classList.remove('active'));
    els.productDetailPage.classList.add('active');
    document.querySelector('.main-content').scrollTop = 0;
    lucide.createIcons();
};

function renderMyRewardsPage() {
    els.allRewardsList.innerHTML = '';
    if (!state.userRewards.length) {
        els.allRewardsList.innerHTML = `<p class="text-sm text-center text-gray-500">You haven't purchased any rewards yet.</p>`;
        return;
    }
    
    state.userRewards.forEach(ur => {
        const isUsed = ur.status === 'confirmed'; // 'confirmed' from schema means 'used'
        const isCancelled = ur.status === 'cancelled';
        
        let buttonHTML = `
            <button onclick="openRewardQrModal('${ur.userRewardId}')" class="text-xs font-semibold px-3 py-2 rounded-full bg-emerald-600 text-white">
                View QR
            </button>`;
        
        if (isUsed) {
            buttonHTML = `<span class="text-xs font-semibold px-3 py-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Used</span>`;
        } else if (isCancelled) {
            buttonHTML = `<span class="text-xs font-semibold px-3 py-2 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300">Cancelled</span>`;
        }

        els.allRewardsList.innerHTML += `
            <div class="glass-card p-4 rounded-2xl flex items-center justify-between ${isUsed || isCancelled ? 'opacity-60' : ''}">
                <div class="flex items-center">
                    <img src="${ur.productImage}" class="w-14 h-14 rounded-lg object-cover mr-3" onerror="this.src='https://placehold.co/100x100'">
                    <div>
                        <p class="text-sm font-bold text-gray-900 dark:text-gray-100">${ur.productName}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">From ${ur.storeName}</p>
                        <p class="text-xs text-gray-400 mt-1">Purchased: ${ur.purchaseDate}</p>
                    </div>
                </div>
                ${buttonHTML}
            </div>
        `;
    });
}

function renderHistory() {
    els.historyList.innerHTML = '';
    if (state.history.length === 0) {
        els.historyList.innerHTML = '<p class="text-center text-gray-500">No activity yet.</p>';
        return;
    }
    state.history.forEach(h => {
        els.historyList.innerHTML += `
            <div class="glass-card p-3 rounded-xl flex items-center justify-between">
                <div class="flex items-center">
                    <span class="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mr-3">
                        <i data-lucide="${h.icon}" class="w-5 h-5 text-gray-700 dark:text-gray-200"></i>
                    </span>
                    <div>
                        <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">${h.description}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${h.date}</p>
                    </div>
                </div>
                <span class="text-sm font-bold ${h.points >= 0 ? 'text-green-600' : 'text-red-500'}">
                    ${h.points > 0 ? '+' : ''}${h.points}
                </span>
            </div>
        `;
    });
    lucide.createIcons();
}

function renderChallengesPage() {
    els.challengesList.innerHTML = '';
    if (state.dailyChallenges.length === 0) {
        els.challengesList.innerHTML = '<p class="text-center text-gray-500">No challenges available right now.</p>';
        return;
    }
    state.dailyChallenges.forEach(c => {
        let buttonHTML = '';
        if (c.status === 'active') {
            buttonHTML = `<button onclick="${c.action}" class="text-xs font-semibold px-3 py-2 rounded-full bg-green-600 text-white">${c.buttonText}</button>`;
        } else if (c.status === 'pending') {
            buttonHTML = `<button class="text-xs font-semibold px-3 py-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 cursor-not-allowed">Pending Review</button>`;
        } else if (c.status === 'completed') {
            buttonHTML = `<button class="text-xs font-semibold px-3 py-2 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 cursor-not-allowed">Completed</button>`;
        } else if (c.status === 'rejected') {
             buttonHTML = `<button onclick="${c.action}" class="text-xs font-semibold px-3 py-2 rounded-full bg-red-100 text-red-700">${c.buttonText}</button>`;
        }
        
        els.challengesList.innerHTML += `
            <div class="glass-card p-4 rounded-2xl flex items-start">
                <div class="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center mr-3">
                    <i data-lucide="${c.icon}" class="w-5 h-5 text-green-600 dark:text-green-300"></i>
                </div>
                <div class="flex-1">
                    <h3 class="font-bold text-gray-900 dark:text-gray-100">${c.title}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${c.description}</p>
                    <div class="flex items-center justify-between mt-3">
                        <span class="text-xs font-semibold text-green-700 dark:text-green-300">+${c.points_reward} pts</span>
                        ${buttonHTML}
                    </div>
                </div>
            </div>
        `;
    });
    lucide.createIcons();
}

function renderEventsPage() {
    els.eventsList.innerHTML = '';
     if (state.events.length === 0) {
        els.eventsList.innerHTML = '<p class="text-center text-gray-500">No events scheduled right now.</p>';
        return;
    }
    state.events.forEach(e => {
        let statusButton = '';
        if (e.status === 'upcoming') {
            statusButton = `<button onclick="handleEventRSVP('${e.id}')" class="w-full bg-green-600 text-white text-sm font-semibold py-2 rounded-lg flex items-center justify-center space-x-2"><i data-lucide="ticket" class="w-4 h-4"></i><span>RSVP +${e.points} pts</span></button>`;
        } else if (e.status === 'registered') {
            statusButton = `<div class="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 font-bold py-2 px-4 rounded-lg text-sm w-full flex items-center justify-center space-x-2"><i data-lucide="check" class="w-4 h-4"></i><span>Registered</span></div>`;
        } else if (e.status === 'attended') {
            statusButton = `<div class="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-200 font-bold py-2 px-4 rounded-lg text-sm w-full flex items-center justify-center space-x-2"><i data-lucide="check-circle" class="w-4 h-4"></i><span>Attended (+${e.points} pts)</span></div>`;
        } else {
             statusButton = `<div class="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold py-2 px-4 rounded-lg text-sm w-full flex items-center justify-center space-x-2"><i data-lucide="x-circle" class="w-4 h-4"></i><span>Missed</span></div>`;
        }
        els.eventsList.innerHTML += `
            <div class="glass-card p-4 rounded-2xl ${e.status === 'missed' ? 'opacity-60' : ''}">
                <div class="flex items-start">
                    <div class="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg mr-4"><i data-lucide="calendar" class="w-6 h-6 text-purple-600 dark:text-purple-400"></i></div>
                    <div class="flex-grow">
                        <p class="text-xs font-semibold text-purple-600 dark:text-purple-400">${e.date}</p>
                        <h3 class="font-bold text-gray-800 dark:text-gray-100 text-lg">${e.title}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">${e.description}</p>
                        ${statusButton}
                    </div>
                </div>
            </div>
        `;
    });
    lucide.createIcons();
}

function renderEcoPointsPage() {
    const u = state.currentUser;
    const l = getUserLevel(u.lifetime_points);
    document.getElementById('ecopoints-balance').textContent = u.current_points;
    document.getElementById('ecopoints-level-title').textContent = l.title;
    document.getElementById('ecopoints-level-number').textContent = l.level;
    document.getElementById('ecopoints-level-progress').style.width = l.progress + '%';
    document.getElementById('ecopoints-level-next').textContent = l.progressText;
    
    const actContainer = document.getElementById('ecopoints-recent-activity');
    actContainer.innerHTML = '';
    state.history.slice(0,4).forEach(h => {
        actContainer.innerHTML += `<div class="flex items-center justify-between text-sm"><div class="flex items-center"><span class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mr-3"><i data-lucide="${h.icon}" class="w-4 h-4 text-gray-600 dark:text-gray-300"></i></span><div><p class="font-semibold text-gray-800 dark:text-gray-100">${h.description}</p><p class="text-xs text-gray-500 dark:text-gray-400">${h.date}</p></div></div><span class="font-bold ${h.points >= 0 ? 'text-green-600' : 'text-red-500'}">${h.points > 0 ? '+' : ''}${h.points}</span></div>`;
    });
    
    const levelsContainer = document.getElementById('all-levels-list');
    levelsContainer.innerHTML = '';
    state.levels.forEach(lvl => {
         levelsContainer.innerHTML += `<div class="flex items-center"><span class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mr-3 text-sm font-bold text-green-600 dark:text-green-300">${lvl.level}</span><div><p class="text-sm font-bold text-gray-800 dark:text-gray-100">${lvl.title}</p><p class="text-xs text-gray-500 dark:text-gray-400">${lvl.minPoints} pts required</p></div></div>`;
    });

    lucide.createIcons();
}

// =========================================
// 9. MODAL & ACTION HANDLERS
// =========================================

// --- Check-in ---
const checkinModal = document.getElementById('checkin-modal');
window.openCheckinModal = () => {
    if (state.currentUser.isCheckedInToday) return;
    checkinModal.classList.add('open');
    checkinModal.classList.remove('invisible');
    
    const calendarContainer = document.getElementById('checkin-modal-calendar');
    calendarContainer.innerHTML = '';
    for (let i = -3; i <= 3; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const isToday = i === 0;
        calendarContainer.innerHTML += `
            <div class="flex flex-col items-center text-xs ${isToday ? 'font-bold text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'}">
                <span class="mb-1">${['S','M','T','W','T','F','S'][d.getDay()]}</span>
                <span class="w-8 h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-yellow-100 dark:bg-yellow-900' : ''}">${d.getDate()}</span>
            </div>
        `;
    }
    document.getElementById('checkin-modal-streak').textContent = `${state.currentUser.checkInStreak} Days`;
    document.getElementById('checkin-modal-button-container').innerHTML = `
        <button onclick="handleDailyCheckin()" class="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-green-700 shadow-lg transition-transform active:scale-95">
            Check-in &amp; Earn ${state.checkInReward} Points
        </button>
    `;
};

window.closeCheckinModal = () => {
    checkinModal.classList.remove('open');
    setTimeout(() => checkinModal.classList.add('invisible'), 300);
};

window.handleDailyCheckin = async () => {
    // 1. Insert the check-in record
    const { data: checkin, error } = await supabase
        .from('daily_checkins')
        .insert({ 
            user_id: state.currentUser.id, 
            points_awarded: state.checkInReward 
        })
        .select()
        .single();

    if (error) {
        console.error('Check-in error:', error);
        alert('You have already checked in today.');
        closeCheckinModal();
        return;
    }

    if (checkin) {
        // 2. Triggers will update points and streak. Re-fetch user points & streak.
        const { data: user } = await supabase.from('users').select('current_points').eq('id', state.currentUser.id).single();
        const { data: streak } = await supabase.from('user_streaks').select('current_streak').eq('user_id', state.currentUser.id).single();

        // 3. Update state
        animatePointsUpdate(user.current_points);
        state.currentUser.isCheckedInToday = true;
        state.currentUser.checkInStreak = streak.current_streak;
        
        // 4. Update UI
        closeCheckinModal();
        renderDashboard();
    }
};

// --- Purchase ---
window.openPurchaseModal = (productId) => {
    const { store, product } = getProduct(productId);
    if (!product) return;

    els.purchaseModal.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">Purchase Reward</h3>
            <button onclick="closePurchaseModal()" class="text-gray-400"><i data-lucide="x" class="w-6 h-6"></i></button>
        </div>
        <div class="flex items-center mb-4">
            <img src="${product.images[0].replace('400x300', '100x100')}" class="w-20 h-20 object-cover rounded-lg mr-4" onerror="this.src='https://placehold.co/100x100'">
            <div>
                <h4 class="text-lg font-bold text-gray-800 dark:text-gray-100">${product.name}</h4>
                <p class="text-sm text-gray-500 mb-2">From ${store.name}</p>
                <div class="flex items-center font-bold text-gray-800 dark:text-gray-100">
                    <span class="text-lg text-green-700 dark:text-green-400">₹${product.discountedPrice}</span>
                    <span class="mx-1 text-gray-400">+</span>
                    <i data-lucide="leaf" class="w-4 h-4 text-green-500 mr-1"></i>
                    <span class="text-lg text-green-700">${product.cost}</span>
                </div>
            </div>
        </div>
        <button id="confirm-purchase-btn" onclick="confirmPurchase('${product.productId}')" class="w-full btn-eco-gradient text-white font-bold py-3 px-4 rounded-lg mb-2">Confirm Purchase</button>
        <button onclick="closePurchaseModal()" class="w-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-lg">Cancel</button>
    `;
    
    els.purchaseModalOverlay.classList.remove('hidden');
    setTimeout(() => els.purchaseModal.classList.remove('translate-y-full'), 10);
    lucide.createIcons();
};

window.closePurchaseModal = () => {
    els.purchaseModal.classList.add('translate-y-full');
    setTimeout(() => els.purchaseModalOverlay.classList.add('hidden'), 300);
};

window.confirmPurchase = async (productId) => {
    const btn = document.getElementById('confirm-purchase-btn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    const { product } = getProduct(productId);
    if (!product || state.currentUser.current_points < product.cost) {
        alert('You do not have enough points for this item.');
        btn.disabled = false;
        btn.textContent = 'Confirm Purchase';
        return;
    }

    // 1. Create the order. Status 'confirmed' will fire triggers.
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({ 
            user_id: state.currentUser.id, 
            store_id: product.storeId, 
            status: 'confirmed', // This will trigger point deduction
            total_points: product.cost, 
            total_price: product.discountedPrice,
            requires_approval: false, // Assuming direct confirmation
            approved_by: state.currentUser.id // Self-approved
        })
        .select()
        .single();

    if (orderError) {
        console.error('Order error:', orderError);
        alert('There was an error creating your order.');
        btn.disabled = false;
        btn.textContent = 'Confirm Purchase';
        return;
    }

    // 2. Add item to the order
    const { error: itemError } = await supabase
        .from('order_items')
        .insert({ 
            order_id: order.id, 
            product_id: product.productId, 
            quantity: 1, 
            price_each: product.discountedPrice, 
            points_each: product.cost 
        });

    if (itemError) {
        console.error('Order item error:', itemError);
        // Try to roll back order?
        alert('There was an error adding items to your order.');
        // In a real app, you'd handle this (e.g., delete the order)
        btn.disabled = false;
        btn.textContent = 'Confirm Purchase';
        return;
    }

    // 3. Refresh user points (triggers should have run)
    await refreshUserPoints();
    
    // 4. Refresh "My Rewards" page data (in background)
    await loadMyRewards();

    // 5. Close modal and navigate
    closePurchaseModal();
    showPage('my-rewards');
};

// --- QR Modal ---
window.openRewardQrModal = (userRewardId) => {
    const reward = state.userRewards.find(r => r.userRewardId === userRewardId);
    if (!reward) return;
    
    // The QR code should be for the ORDER, not the item.
    const qrData = reward.orderId; 
    
    els.qrModal.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">Reward QR</h3>
            <button onclick="closeQrModal()" class="text-gray-400"><i data-lucide="x" class="w-6 h-6"></i></button>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">Show this QR at <strong>${reward.storeName}</strong> to redeem <strong>${reward.productName}</strong>.</p>
        <div class="flex justify-center mb-4">
            <!-- Using a placeholder for QR generation -->
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrData)}" class="rounded-lg border">
        </div>
        <p class="text-center text-xs text-gray-400 mb-2">Order ID: ${reward.orderId}</p>
        <button onclick="closeQrModal()" class="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg">Close</button>
    `;
    els.qrModalOverlay.classList.remove('hidden');
    setTimeout(() => els.qrModal.classList.remove('translate-y-full'), 10);
    lucide.createIcons();
};

window.closeQrModal = () => {
    els.qrModal.classList.add('translate-y-full');
    setTimeout(() => els.qrModalOverlay.classList.add('hidden'), 300);
};

// --- Chatbot ---
const chatbotModal = document.getElementById('chatbot-modal');
window.openChatbotModal = () => {
    chatbotModal.classList.add('open');
    chatbotModal.classList.remove('invisible');
};
window.closeChatbotModal = () => {
    chatbotModal.classList.remove('open');
    setTimeout(() => chatbotModal.classList.add('invisible'), 300);
};

// --- Eco Quiz ---
const quizModal = document.getElementById('eco-quiz-modal');
window.openEcoQuizModal = (challengeId) => {
    // TODO: Fetch quiz questions for challengeId
    // For now, use static question
    document.getElementById('eco-quiz-modal-body').innerHTML = `
        <p id="eco-quiz-modal-question" class="text-lg text-gray-700 dark:text-gray-200 mb-4">What does 'composting' primarily help reduce?</p>
        <div id="eco-quiz-modal-options" class="space-y-3">
            <button onclick="handleQuizAnswer(false, '${challengeId}')" class="w-full text-left p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Plastic waste</button>
            <button onclick="handleQuizAnswer(true, '${challengeId}')" class="w-full text-left p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Landfill methane</button>
            <button onclick="handleQuizAnswer(false, '${challengeId}')" class="w-full text-left p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Water usage</button>
        </div>
        <div id="eco-quiz-modal-result" class="hidden text-center mt-4"></div>
    `;
    quizModal.classList.add('open');
    quizModal.classList.remove('invisible');
};
window.closeEcoQuizModal = () => {
    quizModal.classList.remove('open');
    setTimeout(() => quizModal.classList.add('invisible'), 300);
};
window.handleQuizAnswer = async (isCorrect, challengeId) => {
    const resultDiv = document.getElementById('eco-quiz-modal-result');
    document.getElementById('eco-quiz-modal-options').classList.add('hidden');
    resultDiv.classList.remove('hidden');

    if (isCorrect) {
        // Auto-approve quiz. Insert as 'pending' then update to 'approved' to fire trigger.
        const { data: sub, error: insError } = await supabase
            .from('challenge_submissions')
            .insert({ challenge_id: challengeId, user_id: state.currentUser.id, status: 'pending' })
            .select()
            .single();

        if (insError) {
             resultDiv.innerHTML = `<p class="font-bold text-yellow-600">You already completed this!</p>`;
             setTimeout(closeEcoQuizModal, 1500);
             return;
        }

        if (sub) {
            const { data: updatedSub, error: updError } = await supabase
                .from('challenge_submissions')
                .update({ status: 'approved', admin_id: state.currentUser.id }) // Self-approve
                .eq('id', sub.id)
                .select()
                .single();
            
            if (updatedSub) {
                const challenge = state.dailyChallenges.find(c => c.id === challengeId);
                resultDiv.innerHTML = `<p class="font-bold text-green-600">Correct! +${challenge.points_reward} Points!</p>`;
                await refreshUserPoints();
                challenge.status = 'completed';
                renderChallengesPage();
            }
        }
    } else {
        resultDiv.innerHTML = `<p class="font-bold text-red-500">Not quite. Try again tomorrow!</p>`;
    }
    setTimeout(closeEcoQuizModal, 1500);
};

// --- Camera / Upload ---
let currentCameraStream = null;
let currentChallengeIdForUpload = null;

window.openChallengeUpload = (challengeId) => {
    const challenge = state.dailyChallenges.find(c => c.id === challengeId);
    if (!challenge) return;
    
    currentChallengeIdForUpload = challengeId;
    
    // For web, just open file input
    // The camera modal is complex and often fails in webviews.
    const fileInput = document.getElementById('challenge-file-input');
    fileInput.onchange = handleChallengeFileSelect;
    fileInput.click();
};

async function handleChallengeFileSelect(event) {
    const file = event.target.files[0];
    if (!file || !currentChallengeIdForUpload) return;
    
    alert('Uploading file... this may take a moment.');
    
    // TODO: Implement Supabase Storage upload
    // 1. const { data, error } = await supabase.storage.from('challenge-uploads').upload(`public/${state.currentUser.id}/${challengeId}-${new Date().getTime()}`, file)
    // 2. If no error, get public URL: const { data: publicURL } = supabase.storage.from('challenge-uploads').getPublicUrl(data.path)
    // 3. Insert submission with publicURL.data.publicUrl

    // --- SIMULATED UPLOAD FOR NOW ---
    // This simulates a successful upload and submission
    const fakePublicURL = 'https://supabase.io/simulated-upload.jpg';
    
    const { data, error } = await supabase
        .from('challenge_submissions')
        .insert({ 
            challenge_id: currentChallengeIdForUpload, 
            user_id: state.currentUser.id, 
            status: 'pending',
            submission_url: fakePublicURL
        });
    
    if (error) {
        console.error('Submission error:', error);
        alert('Error submitting challenge. You may have already submitted.');
    } else {
        alert('Submission successful! It is now pending review.');
        const challenge = state.dailyChallenges.find(c => c.id === currentChallengeIdForUpload);
        if (challenge) {
            challenge.status = 'pending';
        }
        renderChallengesPage();
    }
    
    // Reset file input
    event.target.value = null;
    currentChallengeIdForUpload = null;
}

// Keep camera modal functions from old file, but they are not used by default
window.startCamera = async (challengeId) => {
    // This is the function you'd call if you want the full camera modal
    alert("Camera modal not implemented, using file upload instead.");
    openChallengeUpload(challengeId);
};
window.closeCameraModal = () => { /* ... */ };
window.capturePhoto = () => { /* ... */ };
window.switchCamera = () => { /* ... */ };

// --- Event RSVP ---
window.handleEventRSVP = async (eventId) => {
    const { data, error } = await supabase
        .from('event_attendance')
        .insert({
            event_id: eventId,
            user_id: state.currentUser.id,
            status: 'registered'
        });
    
    if (error) {
        console.error('RSVP error:', error);
        alert('Error registering for event. You may already be registered.');
    } else {
        alert('Successfully registered for the event!');
        const event = state.events.find(e => e.id === eventId);
        if (event) {
            event.status = 'registered';
        }
        renderEventsPage();
    }
};

// =========================================
// 10. BACKGROUND DATA REFRESHERS
// =========================================

/**
 * Fetches and updates the state.userRewards list.
 */
async function loadMyRewards() {
    const { data: ordersRes, error } = await supabase
        .from('orders')
        .select('*, order_items(*, products(*, product_images(image_url), stores(name)))')
        .eq('user_id', state.currentUser.id)
        .order('created_at', { ascending: false });

    if (error) return;

    state.userRewards = [];
    (ordersRes || []).forEach(order => {
        order.order_items.forEach(item => {
            state.userRewards.push({
                userRewardId: item.id,
                orderId: order.id,
                productId: item.product_id,
                purchaseDate: new Date(order.created_at).toLocaleDateString('en-CA'),
                status: order.status,
                productName: item.products.name,
                productImage: item.products.product_images?.[0]?.image_url || 'https://placehold.co/100x100',
                storeName: item.products.stores.name,
                storeId: item.products.store_id
            });
        });
    });
    
    // Re-render if on the page
    if (document.getElementById('my-rewards').classList.contains('active')) {
        renderMyRewardsPage();
    }
}


// =========================================
// 11. EVENT LISTENERS
// =========================================

function setupEventListeners() {
    // Search & Sort
    els.storeSearch.addEventListener('input', renderRewards);
    els.storeSearchClear.addEventListener('click', () => { els.storeSearch.value = ''; renderRewards(); });
    els.sortBy.addEventListener('change', renderRewards);

    // Sidebar Toggles
    document.getElementById('sidebar-toggle-btn').addEventListener('click', () => toggleSidebar());
    // The overlay click is set in index.html

    // Theme Toggle
    if (localStorage.getItem('eco-theme') === 'dark' || (!localStorage.getItem('eco-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        document.getElementById('theme-text').textContent = 'Dark Mode';
        document.getElementById('theme-icon').setAttribute('data-lucide', 'moon');
    } else {
        document.documentElement.classList.remove('dark');
        document.getElementById('theme-text').textContent = 'Light Mode';
        document.getElementById('theme-icon').setAttribute('data-lucide', 'sun');
    }
    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('eco-theme', isDark ? 'dark' : 'light');
        document.getElementById('theme-text').textContent = isDark ? 'Dark Mode' : 'Light Mode';
        document.getElementById('theme-icon').setAttribute('data-lucide', isDark ? 'moon' : 'sun');
        lucide.createIcons();
    });

    // Logout
    document.getElementById('logout-button').addEventListener('click', async () => {
        await supabase.auth.signOut();
        // The auth listener will handle the redirect
    });

    // Change Password Form
    const pwForm = document.getElementById('change-password-form');
    pwForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const msg = document.getElementById('password-message');
        const btn = document.getElementById('change-password-button');
        btn.disabled = true;

        const { error } = await supabase.auth.updateUser({ password: newPassword });

        if (error) {
            msg.textContent = `Error: ${error.message}`;
            msg.classList.add('text-red-500');
        } else {
            msg.textContent = 'Password updated successfully!';
            msg.classList.add('text-green-500');
            pwForm.reset();
        }
        btn.disabled = false;
    });

    // Redeem Code Form
    const redeemForm = document.getElementById('redeem-code-form');
    redeemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('redeem-input').value.toUpperCase();
        const msg = document.getElementById('redeem-message');
        const btn = document.getElementById('redeem-submit-btn');
        btn.disabled = true;
        msg.textContent = 'Redeeming...';
        msg.className = 'text-sm text-center text-gray-500';

        // 1. Find the coupon ID from the code
        const { data: coupon, error: couponError } = await supabase
            .from('coupons')
            .select('id')
            .eq('code', code)
            .single();
        
        if (couponError || !coupon) {
            msg.textContent = 'Invalid coupon code.';
            msg.className = 'text-sm text-center text-red-500';
            btn.disabled = false;
            return;
        }

        // 2. Attempt to redeem it
        const { data: redemption, error: redeemError } = await supabase
            .from('coupon_redemptions')
            .insert({ coupon_id: coupon.id, user_id: state.currentUser.id })
            .select()
            .single();
        
        if (redeemError) {
            msg.textContent = `Error: ${redeemError.message}`;
            msg.className = 'text-sm text-center text-red-500';
            btn.disabled = false;
            return;
        }

        if (redemption) {
            // 3. Success, refresh points
            await refreshUserPoints();
            msg.textContent = `Success! +${redemption.points_awarded} points added!`;
            msg.className = 'text-sm text-center text-green-500';
            redeemForm.reset();
        }
        btn.disabled = false;
    });

    // Chatbot Form (Static)
    const chatbotForm = document.getElementById('chatbot-form');
    chatbotForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('chatbot-input');
        const messages = document.getElementById('chatbot-messages');
        if (input.value.trim() === '') return;

        messages.innerHTML += `
            <div class="flex justify-end">
                <div class="bg-green-600 text-white p-3 rounded-lg rounded-br-none max-w-xs">
                    <p class="text-sm">${input.value}</p>
                </div>
            </div>`;
        
        // Simple canned response
        setTimeout(() => {
             messages.innerHTML += `
                <div class="flex">
                    <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg rounded-bl-none max-w-xs">
                        <p class="text-sm text-gray-800 dark:text-gray-100">Thanks for asking! You can recycle plastics #1, #2, and #5 on campus at the blue bins.</p>
                    </div>
                </div>`;
            messages.scrollTop = messages.scrollHeight;
        }, 1000);
        
        input.value = '';
        messages.scrollTop = messages.scrollHeight;
    });
    
    // Initial Lucide icons
    lucide.createIcons();
}
