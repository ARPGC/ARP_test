// =========================================
// 1. IMPORTS & SETUP
// =========================================
import { supabase } from './supabase-client.js';

// Get today's date in 'YYYY-MM-DD' format (local timezone)
const getLocalDateString = () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().split('T')[0];
};
const today = getLocalDateString();

// =========================================
// 2. APPLICATION STATE
// =========================================
let state = {
    currentUser: null,       // Supabase auth.user object
    userProfile: null,       // Public user profile from 'users' table
    userImpact: null,        // From 'user_impact' table
    userStreak: null,        // From 'user_streaks' table
    isCheckedInToday: false, // From 'daily_checkins' table
    events: [],
    challenges: [],
    challengeSubmissions: [],
    products: [],
    stores: [],
    userOrders: [],
    pointsLedger: [],
    leaderboard: [],
    departmentLeaderboard: [], // This will be calculated
};
let departmentChart = null; // To hold the Chart.js instance

// Constant definitions (move to Supabase later if needed)
const CHECK_IN_REWARD = 10; 
const LEVELS = [
    { level: 1, title: 'Green Starter', minPoints: 0, nextMin: 1001 },
    { level: 2, title: 'Eco Learner', minPoints: 1001, nextMin: 2001 },
    { level: 3, title: 'Sustainability Leader', minPoints: 2001, nextMin: 4001 },
    // Add more levels
];

// =========================================
// 3. DOM ELEMENT CACHE
// =========================================
const els = {
    // App Structure
    appLoading: document.getElementById('app-loading'),
    pages: document.querySelectorAll('.page'),
    mainContent: document.querySelector('.main-content'),
    
    // Header & Sidebar
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
    logoutButton: document.getElementById('logout-button'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),

    // User Display (Multiple locations)
    userPointsHeader: document.getElementById('user-points-header'),
    userNameGreeting: document.getElementById('user-name-greeting'),
    userAvatarSidebar: document.getElementById('user-avatar-sidebar'),
    userNameSidebar: document.getElementById('user-name-sidebar'),
    userLevelSidebar: document.getElementById('user-level-sidebar'),
    userPointsSidebar: document.getElementById('user-points-sidebar'),

    // Dashboard
    featuredEventCard: document.getElementById('featured-event-card'),
    featuredEventTitle: document.getElementById('featured-event-title'),
    featuredEventDesc: document.getElementById('featured-event-desc'),
    dailyCheckinBtn: document.getElementById('daily-checkin-button'),
    dashboardStreakText: document.getElementById('dashboard-streak-text'),
    checkinCheckIcon: document.getElementById('checkin-check-icon'),
    checkinSubtext: document.getElementById('checkin-subtext'),
    checkinDoneText: document.getElementById('checkin-done-text'),
    impactCo2: document.getElementById('impact-co2'),
    impactRecycled: document.getElementById('impact-recycled'),
    impactEvents: document.getElementById('impact-events'),

    // Profile Page
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

    // Leaderboard
    lbStudentTab: document.getElementById('leaderboard-tab-student'),
    lbDeptTab: document.getElementById('leaderboard-tab-dept'),
    lbStudentContent: document.getElementById('leaderboard-content-student'),
    lbDeptContent: document.getElementById('leaderboard-content-department'),
    lbPodium: document.getElementById('lb-podium-container'),
    lbList: document.getElementById('lb-list-container'),
    lbLeafLayer: document.getElementById('lb-leaf-layer'),
    lbDeptList: document.getElementById('eco-wars-page-list'),
    deptChartCanvas: document.getElementById('department-chart'),
    deptChartContainer: document.getElementById('dept-chart-container'),

    // Challenges
    challengesList: document.getElementById('challenges-page-list'),

    // EcoPoints Page
    ecopointsBalance: document.getElementById('ecopoints-balance'),
    ecopointsLevelTitle: document.getElementById('ecopoints-level-title'),
    ecopointsLevelNumber: document.getElementById('ecopoints-level-number'),
    ecopointsLevelProgress: document.getElementById('ecopoints-level-progress'),
    ecopointsLevelNext: document.getElementById('ecopoints-level-next'),
    ecopointsRecentActivity: document.getElementById('ecopoints-recent-activity'),

    // Events
    eventsList: document.getElementById('event-list'),

    // Store (Rewards)
    productGrid: document.getElementById('product-grid'),
    storeSearch: document.getElementById('store-search-input'),
    storeSearchClear: document.getElementById('store-search-clear'),
    productDetailPage: document.getElementById('product-detail-page'),

    // My Orders (My Rewards)
    allRewardsList: document.getElementById('all-rewards-list'),

    // History
    historyList: document.getElementById('history-list'),

    // Redeem Code
    redeemCodeForm: document.getElementById('redeem-code-form'),
    redeemInput: document.getElementById('redeem-input'),
    redeemMessage: document.getElementById('redeem-message'),
    redeemSubmitBtn: document.getElementById('redeem-submit-btn'),

    // Modals
    checkinModal: document.getElementById('checkin-modal'),
    checkinModalContent: document.getElementById('checkin-modal-content'),
    checkinModalStreak: document.getElementById('checkin-modal-streak'),
    checkinModalCalendar: document.getElementById('checkin-modal-calendar'),
    checkinModalButtonContainer: document.getElementById('checkin-modal-button-container'),

    purchaseModalOverlay: document.getElementById('purchase-modal-overlay'),
    purchaseModal: document.getElementById('purchase-modal'),
    qrModalOverlay: document.getElementById('qr-modal-overlay'),
    qrModal: document.getElementById('qr-modal'),

    chatbotModal: document.getElementById('chatbot-modal'),
    chatbotModalContent: document.getElementById('chatbot-modal-content'),
    chatbotForm: document.getElementById('chatbot-form'),
    chatbotInput: document.getElementById('chatbot-input'),
    chatbotMessages: document.getElementById('chatbot-messages'),

    ecoQuizModal: document.getElementById('eco-quiz-modal'),
    ecoQuizModalContent: document.getElementById('eco-quiz-modal-content'),
    ecoQuizModalBody: document.getElementById('eco-quiz-modal-body'),

    cameraModal: document.getElementById('camera-modal'),
    cameraFeed: document.getElementById('camera-feed'),
    cameraCanvas: document.getElementById('camera-canvas'),
    cameraCaptureBtn: document.getElementById('camera-capture-btn'),
    qrScannerOverlay: document.getElementById('qr-scanner-overlay'),
};

// =========================================
// 4. AUTHENTICATION
// =========================================

/**
 * Checks for an active session. If not found, redirects to login.
 */
async function checkAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
        console.error("Error getting session:", error);
        redirectToLogin();
        return;
    }
    
    if (!session) {
        redirectToLogin();
        return;
    }

    // User is logged in
    state.currentUser = session.user;
    
    // Now that we're authenticated, load all app data
    await loadInitialData();
}

/**
 * Redirects the user to the login page.
 */
function redirectToLogin() {
    window.location.href = 'login.html';
}

/**
 * Handles the user logout process.
 */
async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Error logging out:", error.message);
    } else {
        redirectToLogin();
    }
}

// =========================================
// 5. DATA LOADING
// =========================================

/**
 * Loads all necessary data from Supabase after login.
 */
async function loadInitialData() {
    try {
        // We need the user's public ID *first*
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', state.currentUser.id)
            .single();
            
        if (profileError) throw new Error(`Profile: ${profileError.message}`);
        state.userProfile = profile;
        const userId = state.userProfile.id; // This is the public UUID

        // Run all other data fetches in parallel
        const [
            impactRes,
            streakRes,
            checkinRes,
            eventsRes,
            challengesRes,
            challengeSubmissionsRes,
            storesRes,
            productsRes,
            ordersRes,
            ledgerRes,
            leaderboardRes
        ] = await Promise.all([
            // 1. Get User Impact
            supabase.from('user_impact').select('*').eq('user_id', userId).single(),
            // 2. Get User Streak
            supabase.from('user_streaks').select('*').eq('user_id', userId).single(),
            // 3. Check for today's check-in
            supabase.from('daily_checkins').select('id').eq('user_id', userId).eq('checkin_date', today).limit(1),
            // 4. Get Events
            supabase.from('events').select('*'),
            // 5. Get Active Challenges
            supabase.from('challenges').select('*').eq('is_active', true),
            // 6. Get user's challenge submissions
            supabase.from('challenge_submissions').select('*').eq('user_id', userId),
            // 7. Get Stores
            supabase.from('stores').select('*').eq('is_active', true),
            // 8. Get Products
            supabase.from('products').select('*, product_images(image_url, sort_order)').eq('is_active', true),
            // 9. Get User's Orders
            supabase.from('orders').select('*, order_items(*)').eq('user_id', userId).order('created_at', { ascending: false }),
            // 10. Get Points Ledger
            supabase.from('points_ledger').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20), // Recently
            // 11. Get Leaderboard (all users)
            supabase.from('users').select('full_name, course, lifetime_points, profile_img_url, student_id').order('lifetime_points', { ascending: false })
        ]);

        // --- Assign data to state ---
        
        // User Impact (can be null if new user)
        state.userImpact = impactRes.data || { total_plastic_kg: 0, events_attended: 0, co2_saved_kg: 0 };
        
        // User Streak (can be null if new user)
        state.userStreak = streakRes.data || { current_streak: 0, last_checkin_date: null };
        
        // Today's Check-in
        state.isCheckedInToday = checkinRes.data && checkinRes.data.length > 0;

        // Other data
        state.events = eventsRes.data || [];
        state.challenges = challengesRes.data || [];
        state.challengeSubmissions = challengeSubmissionsRes.data || [];
        state.stores = storesRes.data || [];
        state.products = productsRes.data || [];
        state.userOrders = ordersRes.data || [];
        state.pointsLedger = ledgerRes.data || [];
        state.leaderboard = leaderboardRes.data || [];

        // --- Post-processing ---
        
        // Add store info to products for easier lookup
        state.products.forEach(p => {
            const store = state.stores.find(s => s.id === p.store_id);
            p.storeName = store ? store.name : 'Unknown Store';
            p.storeLogo = store ? store.logo_url : '';
            // Get the main product image (sort by sort_order, take first)
            if (p.product_images && p.product_images.length > 0) {
                p.product_images.sort((a, b) => a.sort_order - b.sort_order);
                p.main_image_url = p.product_images[0].image_url;
            } else {
                p.main_image_url = `https://placehold.co/300x225/e2e8f0/94a3b8?text=${p.name.split(' ')[0]}`;
            }
        });

        // Calculate Department Leaderboard
        calculateDepartmentLeaderboard();
        
        // --- Render UI ---
        renderApp();
        
        // Hide loader
        els.appLoading.classList.add('loaded');
        
    } catch (error) {
        console.error("Error loading initial data:", error);
        els.appLoading.innerHTML = `<p class="text-red-500 p-4 text-center">Error loading app data: ${error.message}<br>Please refresh.</p>`;
    }
}

/**
 * Recalculates department scores from the main leaderboard.
 */
function calculateDepartmentLeaderboard() {
    const deptScores = {};
    state.leaderboard.forEach(user => {
        const course = user.course || 'Unknown';
        if (!deptScores[course]) {
            deptScores[course] = 0;
        }
        deptScores[course] += user.lifetime_points;
    });

    state.departmentLeaderboard = Object.entries(deptScores)
        .map(([name, points]) => ({ name, points }))
        .sort((a, b) => b.points - a.points);
}


// =========================================
// 6. UI RENDERING
// =========================================

/**
 * Renders all dynamic parts of the app with current state.
 */
function renderApp() {
    if (!state.userProfile) return; // Wait for data

    const { full_name, current_points, lifetime_points, email, joined_at, student_id, course, mobile, profile_img_url } = state.userProfile;
    const level = getUserLevel(lifetime_points);
    const joinedDate = new Date(joined_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const avatarUrl = profile_img_url || `https://placehold.co/112x112/A3E635/FFFFFF?text=${full_name.split(' ').map(n=>n[0]).join('')}`;

    // --- Global User Info ---
    els.userPointsHeader.textContent = current_points;
    els.userNameGreeting.textContent = full_name.split(' ')[0];
    
    // --- Sidebar ---
    els.userAvatarSidebar.src = avatarUrl;
    els.userNameSidebar.textContent = full_name;
    els.userLevelSidebar.textContent = level.title;
    els.userPointsSidebar.textContent = current_points;

    // --- Dashboard ---
    renderDashboard();

    // --- Profile Page ---
    els.profileAvatar.src = avatarUrl;
    els.profileName.textContent = full_name;
    els.profileEmail.textContent = email;
    els.profileJoined.textContent = `Joined ${joinedDate}`;
    els.profileLevelTitle.textContent = level.title;
    els.profileLevelNumber.textContent = level.level;
    els.profileLevelProgress.style.width = `${level.progress}%`;
    els.profileLevelNext.textContent = level.progressText;
    els.profileStudentId.textContent = student_id;
    els.profileCourse.textContent = course;
    els.profileMobile.textContent = mobile || 'N/A';
    els.profileEmailPersonal.textContent = email;

    // --- Leaderboard (Defer render until page is shown) ---
    // --- Challenges (Defer render) ---
    // --- EcoPoints Page (Defer render) ---
    // --- Events (Defer render) ---
    // --- Store (Defer render) ---
    // --- My Orders (Defer render) ---
    // --- History (Defer render) ---

    // Render icons
    lucide.createIcons();
}

/**
 * Renders the Dashboard page.
 */
function renderDashboard() {
    // Featured Event
    const upcomingEvent = state.events.find(e => new Date(e.start_at) > new Date());
    if (upcomingEvent) {
        els.featuredEventCard.classList.remove('hidden');
        els.featuredEventTitle.textContent = upcomingEvent.title;
        els.featuredEventDesc.textContent = upcomingEvent.description.substring(0, 100) + '...';
    } else {
        els.featuredEventCard.classList.add('hidden');
    }

    // Daily Check-in
    els.dashboardStreakText.textContent = `${state.userStreak.current_streak} Day Streak`;
    if (state.isCheckedInToday) {
        els.dailyCheckinBtn.classList.add('checkin-completed');
        els.dailyCheckinBtn.querySelector('h3').textContent = "Check-in Complete";
        els.checkinSubtext.style.display = 'none';
        els.checkinDoneText.classList.remove('hidden');
        els.checkinCheckIcon.classList.remove('hidden');
        els.dailyCheckinBtn.onclick = null;
    } else {
        els.dailyCheckinBtn.classList.remove('checkin-completed');
        els.dailyCheckinBtn.querySelector('h3').textContent = "Daily Check-in";
        els.checkinSubtext.style.display = 'block';
        els.checkinDoneText.classList.add('hidden');
        els.checkinCheckIcon.classList.add('hidden');
        els.dailyCheckinBtn.onclick = openCheckinModal;
    }

    // Impact Stats
    els.impactCo2.textContent = `${(state.userImpact.co2_saved_kg || 0).toFixed(1)} kg`;
    els.impactRecycled.textContent = `${(state.userImpact.total_plastic_kg || 0).toFixed(1)} kg`;
    els.impactEvents.textContent = state.userImpact.events_attended || 0;
}

/**
 * Renders the Leaderboard page (Student or Department).
 */
let currentLeaderboardTab = 'student';
function showLeaderboardTab(tab) {
    currentLeaderboardTab = tab;
    if (tab === 'department') {
        els.lbDeptTab.classList.add('active');
        els.lbStudentTab.classList.remove('active');
        els.lbDeptContent.classList.remove('hidden');
        els.lbStudentContent.classList.add('hidden');
        if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
        renderDepartmentLeaderboard();
    } else {
        els.lbStudentTab.classList.add('active');
        els.lbDeptTab.classList.remove('active');
        els.lbStudentContent.classList.remove('hidden');
        els.lbDeptContent.classList.add('hidden');
        if(els.lbLeafLayer) els.lbLeafLayer.classList.remove('hidden');
        renderStudentLeaderboard();
    }
    lucide.createIcons();
}

function renderStudentLeaderboard() {
    const sorted = state.leaderboard; // Already sorted by DB
    const rank1 = sorted[0], rank2 = sorted[1], rank3 = sorted[2];
    const rest = sorted.slice(3);

    const getInitials = (name) => (name || '?').split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();

    els.lbPodium.innerHTML = `
        <div class="podium">
            <div class="champ">
                <div class="badge silver">${rank2 ? getInitials(rank2.full_name) : '?'}</div>
                <div class="champ-name">${rank2 ? rank2.full_name : '-'}</div>
                <div class="champ-points">${rank2 ? rank2.lifetime_points : 0} pts</div>
                <div class="rank">2nd</div>
            </div>
            <div class="champ">
                <div class="badge gold">${rank1 ? getInitials(rank1.full_name) : '?'}</div>
                <div class="champ-name">${rank1 ? rank1.full_name : '-'}</div>
                <div class="champ-points">${rank1 ? rank1.lifetime_points : 0} pts</div>
                <div class="rank">1st</div>
            </div>
            <div class="champ">
                <div class="badge bronze">${rank3 ? getInitials(rank3.full_name) : '?'}</div>
                <div class="champ-name">${rank3 ? rank3.full_name : '-'}</div>
                <div class="champ-points">${rank3 ? rank3.lifetime_points : 0} pts</div>
                <div class="rank">3rd</div>
            </div>
        </div>
    `;

    els.lbList.innerHTML = '';
    rest.forEach((user, index) => {
        const isCurrentUser = user.student_id === state.userProfile.student_id;
        els.lbList.innerHTML += `
            <div class="item ${isCurrentUser ? 'is-me' : ''}">
                <div class="user">
                    <div class="circle">${index + 4}</div>
                    <div class="user-info">
                        <strong>${user.full_name} ${isCurrentUser ? '(You)' : ''}</strong>
                        <span class="sub-class">${user.course}</span>
                    </div>
                </div>
                <div class="points-display">${user.lifetime_points} pts</div>
            </div>
        `;
    });
}

function renderDepartmentLeaderboard() {
    els.lbDeptList.innerHTML = '';
    state.departmentLeaderboard.forEach((dept, index) => {
        els.lbDeptList.innerHTML += `
            <div class="glass-card p-3 rounded-2xl flex items-center justify-between">
                <div class="flex items-center">
                    <span class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center mr-3 text-xs font-bold text-emerald-700 dark:text-emerald-200">#${index + 1}</span>
                    <div>
                        <p class="font-semibold text-gray-800 dark:text-gray-100">${dept.name}</p>
                    </div>
                </div>
                <span class="font-bold text-gray-800 dark:text-gray-100">${dept.points.toLocaleString()} pts</span>
            </div>
        `;
    });

    // Render Bar Chart
    const chartLabels = state.departmentLeaderboard.map(d => d.name);
    const chartData = state.departmentLeaderboard.map(d => d.points);

    if (departmentChart) {
        departmentChart.destroy(); // Destroy old chart instance
    }
    
    departmentChart = new Chart(els.deptChartCanvas, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Total Points',
                data: chartData,
                backgroundColor: [
                    'rgba(16, 185, 129, 0.7)',
                    'rgba(5, 150, 105, 0.7)',
                    'rgba(6, 95, 70, 0.7)',
                    'rgba(4, 120, 87, 0.7)',
                    'rgba(6, 78, 59, 0.7)',
                ],
                borderColor: [
                    'rgba(16, 185, 129, 1)',
                    'rgba(5, 150, 105, 1)',
                    'rgba(6, 95, 70, 1)',
                    'rgba(4, 120, 87, 1)',
                    'rgba(6, 78, 59, 1)',
                ],
                borderWidth: 1,
                borderRadius: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Horizontal bar chart
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#4b5563' }
                },
                x: {
                    ticks: { color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#4b5563' }
                }
            },
            plugins: {
                legend: { display: false },
                title: { display: false }
            }
        }
    });
}

/**
 * Renders the Challenges page.
 */
function renderChallengesPage() {
    els.challengesList.innerHTML = '';
    state.challenges.forEach(c => {
        const submission = state.challengeSubmissions.find(s => s.challenge_id === c.id);
        const status = submission ? submission.status : 'new';
        
        let buttonHTML = '';
        if (status === 'new') {
            const onclick = c.type === 'quiz' ? `openEcoQuizModal('${c.id}')` : `openCamera('${c.id}', 'challenge')`;
            buttonHTML = `<button onclick="${onclick}" class="text-xs font-semibold px-3 py-2 rounded-full bg-green-600 text-white">${c.type === 'quiz' ? 'Start Quiz' : 'Upload Photo'}</button>`;
        } else if (status === 'pending') {
            buttonHTML = `<button class="text-xs font-semibold px-3 py-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300 cursor-not-allowed">Pending Review</button>`;
        } else if (status === 'approved') {
             buttonHTML = `<button class="text-xs font-semibold px-3 py-2 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-200 cursor-not-allowed flex items-center"><i data-lucide="check" class="w-4 h-4 mr-1"></i>Completed</button>`;
        } else if (status === 'rejected') {
             buttonHTML = `<button class="text-xs font-semibold px-3 py-2 rounded-full bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-200 cursor-not-allowed flex items-center"><i data-lucide="x" class="w-4 h-4 mr-1"></i>Rejected</button>`;
        }

        els.challengesList.innerHTML += `
            <div class="glass-card p-4 rounded-2xl flex items-start">
                <div class="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center mr-3">
                    <i data-lucide="${c.type === 'quiz' ? 'brain' : 'camera'}" class="w-5 h-5 text-green-600 dark:text-green-300"></i>
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

/**
 * Renders the Events page.
 */
function renderEventsPage() {
    els.eventsList.innerHTML = '';
    // Sort events: upcoming first, then past
    const sortedEvents = [...state.events].sort((a, b) => {
        const dateA = new Date(a.start_at || 0);
        const dateB = new Date(b.start_at || 0);
        const now = new Date();
        
        if (dateA > now && dateB > now) return dateA - dateB; // Both upcoming
        if (dateA < now && dateB < now) return dateB - dateA; // Both past
        if (dateA > now && dateB < now) return -1; // A upcoming, B past
        if (dateA < now && dateB > now) return 1; // A past, B upcoming
        return 0;
    });
    
    // Check for user attendance
    // TODO: This needs event_attendance table to be fully functional
    
    sortedEvents.forEach(e => {
        const isUpcoming = new Date(e.start_at) > new Date();
        const eventDate = new Date(e.start_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        let statusButton = '';
        if (isUpcoming) {
            statusButton = `<button class="w-full bg-green-600 text-white text-sm font-semibold py-2 rounded-lg flex items-center justify-center space-x-2"><i data-lucide="ticket" class="w-4 h-4"></i><span>RSVP +${e.points_reward} pts</span></button>`;
        } else {
             statusButton = `<div class="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold py-2 px-4 rounded-lg text-sm w-full flex items-center justify-center space-x-2"><i data-lucide="x-circle" class="w-4 h-4"></i><span>Event Ended</span></div>`;
        }
        
        els.eventsList.innerHTML += `
            <div class="glass-card p-4 rounded-2xl ${isUpcoming ? '' : 'opacity-60'}">
                <div class="flex items-start">
                    <div class="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg mr-4"><i data-lucide="calendar" class="w-6 h-6 text-purple-600 dark:text-purple-400"></i></div>
                    <div class="flex-grow">
                        <p class="text-xs font-semibold text-purple-600 dark:text-purple-400">${eventDate}</p>
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

/**
 * Renders the EcoPoints page.
 */
function renderEcoPointsPage() {
    const { current_points, lifetime_points } = state.userProfile;
    const level = getUserLevel(lifetime_points);

    els.ecopointsBalance.textContent = current_points;
    els.ecopointsLevelTitle.textContent = level.title;
    els.ecopointsLevelNumber.textContent = level.level;
    els.ecopointsLevelProgress.style.width = `${level.progress}%`;
    els.ecopointsLevelNext.textContent = level.progressText;

    els.ecopointsRecentActivity.innerHTML = '';
    state.pointsLedger.forEach(entry => {
        const icon = entry.source_type === 'order' ? 'shopping-cart' :
                     entry.source_type === 'event' ? 'calendar' :
                     entry.source_type === 'challenge' ? 'award' :
                     entry.source_type === 'checkin' ? 'calendar-check' :
                     entry.source_type === 'coupon' ? 'ticket' : 
                     entry.source_type === 'plastic' ? 'recycle' : 'gift';
        
        els.ecopointsRecentActivity.innerHTML += `
            <div class="flex items-center justify-between text-sm">
                <div class="flex items-center">
                    <span class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mr-3">
                        <i data-lucide="${icon}" class="w-4 h-4 text-gray-600 dark:text-gray-300"></i>
                    </span>
                    <div>
                        <p class="font-semibold text-gray-800 dark:text-gray-100">${entry.description}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${new Date(entry.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <span class="font-bold ${entry.points_delta >= 0 ? 'text-green-600' : 'text-red-500'}">
                    ${entry.points_delta > 0 ? '+' : ''}${entry.points_delta}
                </span>
            </div>
        `;
    });
    lucide.createIcons();
}

/**
 * Renders the Store (Rewards) page.
 */
function renderRewards() {
    els.productGrid.innerHTML = '';
    let products = [...state.products];

    const searchTerm = els.storeSearch.value.toLowerCase();
    if(searchTerm.length > 0) {
        products = products.filter(p => 
            p.name.toLowerCase().includes(searchTerm) || 
            p.storeName.toLowerCase().includes(searchTerm)
        );
    }
    els.storeSearchClear.classList.toggle('hidden', !searchTerm);

    products.forEach(p => {
        const imageUrl = p.main_image_url;
        
        els.productGrid.innerHTML += `
            <div class="w-full flex-shrink-0 glass-card border border-gray-200/60 dark:border-gray-700/80 rounded-2xl overflow-hidden flex flex-col cursor-pointer"
                 onclick="showProductDetailPage('${p.id}')">
                <img src="${imageUrl}" class="w-full h-40 object-cover" onerror="this.src='https://placehold.co/300x225/e2e8f0/94a3b8?text=EcoBirla'">
                <div class="p-3 flex flex-col flex-grow">
                    <div class="flex items-center mb-1">
                        <img src="${p.storeLogo || 'https://placehold.co/40x40/cccccc/94a3b8?text=S'}" class="w-5 h-5 rounded-full mr-2 border dark:border-gray-600 object-cover">
                        <p class="text-xs font-medium text-gray-600 dark:text-gray-400">${p.storeName}</p>
                    </div>
                    <p class="font-bold text-gray-800 dark:text-gray-100 text-sm truncate mt-1">${p.name}</p>
                    <div class="mt-auto pt-2">
                        <p class="text-xs text-gray-400 dark:text-gray-500 line-through">₹${p.original_price}</p>
                        <div class="flex items-center font-bold text-gray-800 dark:text-gray-100 my-1">
                            <span class="text-md text-green-700 dark:text-green-400">₹${p.discounted_price}</span>
                            <span class="mx-1 text-gray-400 dark:text-gray-500 text-xs">+</span>
                            <i data-lucide="leaf" class="w-3 h-3 text-green-500 mr-1"></i>
                            <span class="text-sm text-green-700 dark:text-green-400">${p.ecopoints_cost}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    lucide.createIcons();
}

/**
 * Renders the "My Orders" page.
 */
function renderMyRewardsPage() {
    els.allRewardsList.innerHTML = '';
    if (!state.userOrders.length) {
        els.allRewardsList.innerHTML = `<p class="text-sm text-center text-gray-500">No orders yet. Visit the Store to redeem rewards!</p>`;
        return;
    }
    
    state.userOrders.forEach(order => {
        // This assumes one item per order for simplicity, based on prototype
        // A real app would loop through order.order_items
        const item = order.order_items[0];
        if (!item) return;

        const product = state.products.find(p => p.id === item.product_id);
        if (!product) return;

        const imageUrl = product.main_image_url;

        els.allRewardsList.innerHTML += `
            <div class="glass-card p-4 rounded-2xl flex items-center justify-between">
                <div class="flex items-center">
                    <img src="${imageUrl}" class="w-14 h-14 rounded-lg object-cover mr-3" onerror="this.src='https://placehold.co/100x100/e2e8f0/94a3b8?text=EcoBirla'">
                    <div>
                        <p class="text-sm font-bold text-gray-900 dark:text-gray-100">${product.name}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">From ${product.storeName}</p>
                        <p class="text-xs text-gray-400 mt-1">Purchased: ${new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                ${order.status === 'confirmed' ? 
                    `<span class="text-xs font-semibold px-3 py-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Redeemed</span>` :
                    `<button onclick="openRewardQrModal('${order.id}')" class="text-xs font-semibold px-3 py-2 rounded-full bg-emerald-600 text-white">View QR</button>`
                }
            </div>
        `;
    });
    lucide.createIcons();
}

/**
 * Renders the full points history page.
 */
function renderHistory() {
    els.historyList.innerHTML = '';
    state.pointsLedger.forEach(entry => {
         const icon = entry.source_type === 'order' ? 'shopping-cart' :
                     entry.source_type === 'event' ? 'calendar' :
                     entry.source_type === 'challenge' ? 'award' :
                     entry.source_type === 'checkin' ? 'calendar-check' :
                     entry.source_type === 'coupon' ? 'ticket' : 
                     entry.source_type === 'plastic' ? 'recycle' : 'gift';

        els.historyList.innerHTML += `
            <div class="glass-card p-3 rounded-xl flex items-center justify-between">
                <div class="flex items-center">
                    <span class="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mr-3">
                        <i data-lucide="${icon}" class="w-5 h-5 text-gray-700 dark:text-gray-200"></i>
                    </span>
                    <div>
                        <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">${entry.description}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${new Date(entry.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <span class="text-sm font-bold ${entry.points_delta >= 0 ? 'text-green-600' : 'text-red-500'}">
                    ${entry.points_delta > 0 ? '+' : ''}${entry.points_delta}
                </span>
            </div>
        `;
    });
    lucide.createIcons();
}


// =========================================
// 7. PAGE NAVIGATION
// =========================================

/**
 * Shows the specified page and hides others.
 * @param {string} pageId The ID of the page element to show.
 */
window.showPage = (pageId) => {
    els.pages.forEach(p => p.classList.remove('active'));
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');

    // Clear detail pages when navigating away
    if (pageId !== 'product-detail-page') {
        els.productDetailPage.innerHTML = '';
    }

    // Update nav button active states
    document.querySelectorAll('.nav-item, .sidebar-nav-item').forEach(btn => {
        const onclickVal = btn.getAttribute('onclick');
        btn.classList.toggle('active', onclickVal && onclickVal.includes(`'${pageId}'`));
    });

    els.mainContent.scrollTop = 0;

    // --- Lazy-render content on page load ---
    switch (pageId) {
        case 'dashboard':
            renderDashboard();
            if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
            break;
        case 'leaderboard':
            showLeaderboardTab(currentLeaderboardTab); // This will render the correct tab
            break;
        case 'challenges':
            renderChallengesPage();
            if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
            break;
        case 'ecopoints':
            renderEcoPointsPage();
            if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
            break;
        case 'events':
            renderEventsPage();
            if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
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
        default:
            if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
            break;
    }

    toggleSidebar(true); // Close sidebar on nav
    lucide.createIcons();
};

/**
 * Toggles the sidebar visibility.
 * @param {boolean} [forceClose=false] - If true, forces the sidebar to close.
 */
window.toggleSidebar = (forceClose = false) => {
    if (forceClose) {
        els.sidebar.classList.add('-translate-x-full');
        els.sidebarOverlay.classList.add('opacity-0', 'hidden');
    } else {
        els.sidebar.classList.toggle('-translate-x-full');
        els.sidebarOverlay.classList.toggle('hidden');
        els.sidebarOverlay.classList.toggle('opacity-0');
    }
};

// =========================================
// 8. HELPERS
// =========================================

/**
 * Calculates user's level based on lifetime points.
 * @param {number} points - User's lifetime points.
 * @returns {object} - Level information.
 */
function getUserLevel(points) {
    let current = LEVELS[0];
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (points >= LEVELS[i].minPoints) {
            current = LEVELS[i];
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
}

/**
 * Animates the points display when updated.
 * @param {number} newPoints - The new point total.
 */
function animatePointsUpdate(newPoints) {
    state.userProfile.current_points = newPoints;
    els.userPointsHeader.classList.add('points-pulse');
    els.userPointsHeader.textContent = newPoints;
    els.userPointsSidebar.textContent = newPoints;
    
    // Also update ecopoints page if it's active
    if (document.getElementById('ecopoints').classList.contains('active')) {
        els.ecopointsBalance.textContent = newPoints;
    }
    
    setTimeout(() => els.userPointsHeader.classList.remove('points-pulse'), 400);
}

/**
 * Toggles the loading state of a button.
 * @param {HTMLButtonElement} button The button element.
 * @param {boolean} isLoading Whether to show the loading state.
 */
function setButtonLoading(button, isLoading) {
    const btnText = button.querySelector('.btn-text');
    const loader = button.querySelector('i[data-lucide="loader-circle"]');
    
    if (isLoading) {
        button.disabled = true;
        if (btnText) btnText.classList.add('hidden');
        if (loader) loader.classList.remove('hidden');
    } else {
        button.disabled = false;
        if (btnText) btnText.classList.remove('hidden');
        if (loader) loader.classList.add('hidden');
    }
    lucide.createIcons(); // Ensure loader icon is rendered
}

// =========================================
// 9. MODALS (Check-in, Store, QR, etc.)
// =========================================

// --- Check-in Modal ---
window.openCheckinModal = () => {
    if (state.isCheckedInToday) return;
    els.checkinModal.classList.add('open');
    els.checkinModal.classList.remove('invisible');
    
    const calendarContainer = els.checkinModalCalendar;
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
    els.checkinModalStreak.textContent = `${state.userStreak.current_streak} Days`;
    els.checkinModalButtonContainer.innerHTML = `
        <button onclick="handleDailyCheckin()" class="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-green-700 shadow-lg transition-transform active:scale-95">
            Check-in &amp; Earn ${CHECK_IN_REWARD} Points
        </button>
    `;
};

window.closeCheckinModal = () => {
    els.checkinModal.classList.remove('open');
    setTimeout(() => els.checkinModal.classList.add('invisible'), 300);
};

window.handleDailyCheckin = async () => {
    if (state.isCheckedInToday) return;

    // 1. Insert into daily_checkins
    const { data: checkinData, error: checkinError } = await supabase
        .from('daily_checkins')
        .insert({ 
            user_id: state.userProfile.id, // Use public user ID
            checkin_date: today,
            points_awarded: CHECK_IN_REWARD,
            created_by: state.userProfile.id
        })
        .select()
        .single();
    
    if (checkinError) {
        console.error("Check-in error:", checkinError);
        // This might fail if already checked in (unique constraint)
        state.isCheckedInToday = true; // Assume it failed because of duplicate
        renderDashboard();
        closeCheckinModal();
        return;
    }

    // 2. Update state
    state.isCheckedInToday = true;
    // The trigger 'trg_daily_checkins_before_insert' handles streak logic
    // The trigger 'trg_points_ledger_after_insert' handles points
    // We just need to re-fetch profile and streak to be sure
    
    const { data: profileData } = await supabase.from('users').select('current_points, lifetime_points').eq('id', state.userProfile.id).single();
    const { data: streakData } = await supabase.from('user_streaks').select('current_streak').eq('user_id', state.userProfile.id).single();

    if (profileData) {
        state.userProfile.current_points = profileData.current_points;
        state.userProfile.lifetime_points = profileData.lifetime_points;
    }
    if (streakData) {
        state.userStreak.current_streak = streakData.current_streak;
    }
    
    // 3. Update UI
    animatePointsUpdate(state.userProfile.current_points);
    renderDashboard();
    closeCheckinModal();
};

// --- Store Modals ---
window.showProductDetailPage = async (productId) => {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    // Fetch full details (features, specs, images)
    const { data: features, error: featuresError } = await supabase
        .from('product_features')
        .select('feature, sort_order')
        .eq('product_id', productId)
        .order('sort_order');
        
    const { data: specs, error: specsError } = await supabase
        .from('product_specifications')
        .select('spec_key, spec_value, sort_order')
        .eq('product_id', productId)
        .order('sort_order');
    
    // Images are already joined in state.products
    const images = product.product_images.map(img => img.image_url);
    if (images.length === 0) images.push(product.main_image_url); // Fallback

    let sliderImagesHTML = '';
    let sliderDotsHTML = '';

    images.forEach((img, index) => {
        sliderImagesHTML += `
            <img src="${img}" class="slider-item w-full h-80 object-cover flex-shrink-0 rounded-3xl" data-index="${index}" onerror="this.src='https://placehold.co/600x400/e2e8f0/94a3b8?text=EcoBirla'">
        `;
        sliderDotsHTML += `<button class="slider-dot w-2.5 h-2.5 rounded-full bg-white/60 dark:bg-gray-700/80 ${index === 0 ? 'active' : ''}"></button>`;
    });

    const featuresHTML = (features || []).map(f => `
        <li class="flex items-start space-x-2">
            <span class="mt-1 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center flex-shrink-0">
                <i data-lucide="check" class="w-3 h-3 text-emerald-600 dark:text-emerald-300"></i>
            </span>
            <span class="text-sm text-gray-700 dark:text-gray-300">${f.feature}</span>
        </li>
    `).join('');

    const specsHTML = (specs || []).map(s => `
        <div class="flex justify-between text-sm py-2 border-b border-gray-200 dark:border-gray-700">
            <span class="text-gray-600 dark:text-gray-400">${s.spec_key}</span>
            <span class="font-semibold text-gray-800 dark:text-gray-200">${s.spec_value}</span>
        </div>
    `).join('');

    const canAfford = state.userProfile.current_points >= product.ecopoints_cost;

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
                                <img src="${product.storeLogo || 'https://placehold.co/40x40/cccccc/94a3b8?text=S'}" class="w-7 h-7 rounded-full mr-2 border object-cover">
                                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">${product.storeName}</p>
                            </div>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200">
                            ${product.ecopoints_cost} EcoPts
                        </span>
                    </div>
                    <div class="mt-4 space-y-5">
                        <div>
                            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><i data-lucide="file-text" class="w-4 h-4"></i> Description</h3>
                            <p class="mt-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">${product.description}</p>
                        </div>
                        ${featuresHTML ? `<div><h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><i data-lucide="sparkles" class="w-4 h-4"></i> Highlights</h3><ul class="mt-2 space-y-2">${featuresHTML}</ul></div>` : ''}
                        ${specsHTML ? `<div><h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><i data-lucide="list" class="w-4 h-4"></i> Specifications</h3><div class="mt-2 space-y-1">${specsHTML}</div></div>` : ''}
                        
                        <div class="pt-4 mt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                            <div>
                                <p class="text-xs text-gray-500 line-through">₹${product.original_price}</p>
                                <div class="flex items-center font-bold text-gray-800 dark:text-gray-100">
                                    <span class="text-xl text-emerald-700 dark:text-emerald-400">₹${product.discounted_price}</span>
                                    <span class="mx-2 text-gray-400 text-sm">+</span>
                                    <i data-lucide="leaf" class="w-4 h-4 text-emerald-500 mr-1"></i>
                                    <span class="text-xl text-emerald-700">${product.ecopoints_cost}</span>
                                </div>
                            </div>
                            <button onclick="openPurchaseModal('${product.id}')" class="btn-eco-gradient text-white text-sm font-semibold py-3 px-5 rounded-xl flex-shrink-0 ${canAfford ? '' : 'opacity-60 cursor-not-allowed'}" ${!canAfford ? 'disabled' : ''}>
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
    els.mainContent.scrollTop = 0;
    lucide.createIcons();
};

window.openPurchaseModal = (productId) => {
    const product = state.products.find(p => p.id === productId);
    if (!product || state.userProfile.current_points < product.ecopoints_cost) return;
    
    const imageUrl = product.main_image_url;

    els.purchaseModal.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">Purchase Reward</h3>
            <button onclick="closePurchaseModal()" class="text-gray-400"><i data-lucide="x" class="w-6 h-6"></i></button>
        </div>
        <div class="flex items-center mb-4">
            <img src="${imageUrl}" class="w-20 h-20 object-cover rounded-lg mr-4" onerror="this.src='https://placehold.co/100x100/e2e8f0/94a3b8?text=EcoBirla'">
            <div>
                <h4 class="text-lg font-bold text-gray-800 dark:text-gray-100">${product.name}</h4>
                <p class="text-sm text-gray-500 mb-2">From ${product.storeName}</p>
                <div class="flex items-center font-bold text-gray-800 dark:text-gray-100">
                    <span class="text-lg text-green-700 dark:text-green-400">₹${product.discounted_price}</span>
                    <span class="mx-1 text-gray-400">+</span>
                    <i data-lucide="leaf" class="w-4 h-4 text-green-500 mr-1"></i>
                    <span class="text-lg text-green-700">${product.ecopoints_cost}</span>
                </div>
            </div>
        </div>
        <button onclick="confirmPurchase('${product.id}')" class="w-full btn-eco-gradient text-white font-bold py-3 px-4 rounded-lg mb-2">Confirm Purchase</button>
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
    const product = state.products.find(p => p.id === productId);
    if (!product || state.userProfile.current_points < product.ecopoints_cost) {
        alert("Not enough points!");
        return;
    }

    // 1. Create the Order
    const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
            user_id: state.userProfile.id,
            store_id: product.store_id,
            status: 'pending', // Will be 'confirmed' by trigger if not requires_approval
            total_points: product.ecopoints_cost,
            total_price: product.discounted_price,
            requires_approval: product.requires_approval,
            created_by: state.userProfile.id
        })
        .select()
        .single();
    
    if (orderError) {
        console.error("Order error:", orderError);
        alert("Could not complete purchase. Please try again.");
        return;
    }

    // 2. Create the Order Item
    const { data: itemData, error: itemError } = await supabase
        .from('order_items')
        .insert({
            order_id: orderData.id,
            product_id: product.id,
            quantity: 1,
            price_each: product.discounted_price,
            points_each: product.ecopoints_cost,
            created_by: state.userProfile.id
        })
        .select()
        .single();

    if (itemError) {
        console.error("Order item error:", itemError);
        // TODO: Handle this, maybe delete the order?
        alert("Could not complete purchase. Please try again.");
        return;
    }

    // 3. If no approval needed, trigger will auto-confirm and deduct points
    // We just need to re-fetch profile data
    const { data: profileData } = await supabase.from('users').select('current_points').eq('id', state.userProfile.id).single();
    if (profileData) {
        animatePointsUpdate(profileData.current_points);
    }
    
    // Add to local state
    orderData.order_items = [itemData];
    state.userOrders.unshift(orderData);
    
    closePurchaseModal();
    showPage('my-rewards');
};

// --- QR Code Modal ---
window.openRewardQrModal = (orderId) => {
    const order = state.userOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const item = order.order_items[0];
    const product = state.products.find(p => p.id === item.product_id);
    if (!product) return;

    // TODO: Generate a real QR code (e.g., with qrcode.js library)
    // For now, use a placeholder with the order ID
    
    els.qrModal.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">Reward QR</h3>
            <button onclick="closeQrModal()" class="text-gray-400"><i data-lucide="x" class="w-6 h-6"></i></button>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">Show this QR at <strong>${product.storeName}</strong> to redeem <strong>${product.name}</strong>.</p>
        <div class="flex justify-center mb-4">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${order.id}" class="rounded-lg border-4 border-white">
        </div>
        <p class="text-xs text-gray-400 text-center mb-4">Order ID: ${order.id}</p>
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

// --- Chatbot Modal ---
window.openChatbotModal = () => {
    els.chatbotModal.classList.add('open');
    els.chatbotModal.classList.remove('invisible');
};
window.closeChatbotModal = () => {
    els.chatbotModal.classList.remove('open');
    setTimeout(() => els.chatbotModal.classList.add('invisible'), 300);
};
els.chatbotForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = els.chatbotInput.value;
    if (!query) return;

    // Display user message
    els.chatbotMessages.innerHTML += `
        <div class="flex justify-end">
            <div class="bg-green-600 text-white p-3 rounded-lg rounded-br-none max-w-xs">
                <p class="text-sm">${query}</p>
            </div>
        </div>
    `;
    els.chatbotInput.value = '';
    els.chatbotMessages.scrollTop = els.chatbotMessages.scrollHeight;

    // TODO: Add call to Gemini API here
    // For now, just echo a reply
    setTimeout(() => {
        els.chatbotMessages.innerHTML += `
            <div class="flex">
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg rounded-bl-none max-w-xs">
                    <p class="text-sm text-gray-800 dark:text-gray-100">I'm still learning! Ask me about recycling plastic.</p>
                </div>
            </div>
        `;
        els.chatbotMessages.scrollTop = els.chatbotMessages.scrollHeight;
    }, 1000);
});


// --- Eco Quiz Modal ---
window.openEcoQuizModal = (challengeId) => {
    const challenge = state.challenges.find(c => c.id === challengeId);
    if (!challenge) return;

    // TODO: Fetch quiz questions from Supabase
    // For now, use placeholder
    els.ecoQuizModalBody.innerHTML = `
        <p id="eco-quiz-modal-question" class="text-lg text-gray-700 dark:text-gray-200 mb-4">What is the most common type of plastic found in the ocean?</p>
        <div id="eco-quiz-modal-options" class="space-y-3">
            <button onclick="handleQuizAnswer(true, '${challengeId}')" class="w-full text-left p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Food wrappers & Containers</button>
            <button onclick="handleQuizAnswer(false, '${challengeId}')" class="w-full text-left p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Plastic Bottles</button>
            <button onclick="handleQuizAnswer(false, '${challengeId}')" class="w-full text-left p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Straws</button>
        </div>
        <div id="eco-quiz-modal-result" class="hidden text-center mt-4"></div>
    `;
    
    els.ecoQuizModal.classList.add('open');
    els.ecoQuizModal.classList.remove('invisible');
};

window.handleQuizAnswer = async (isCorrect, challengeId) => {
    const challenge = state.challenges.find(c => c.id === challengeId);
    const resultEl = document.getElementById('eco-quiz-modal-result');
    document.getElementById('eco-quiz-modal-options').classList.add('hidden');
    resultEl.classList.remove('hidden');

    if (isCorrect) {
        resultEl.innerHTML = `<p class="font-bold text-green-500">Correct! +${challenge.points_reward} points awarded!</p>`;
        
        // Submit challenge
        const { data, error } = await supabase.from('challenge_submissions').insert({
            challenge_id: challengeId,
            user_id: state.userProfile.id,
            status: 'approved', // Auto-approve quiz
            admin_id: state.userProfile.id, // Self-approved
            points_awarded: challenge.points_reward,
            created_by: state.userProfile.id
        }).select().single();

        if (!error) {
            // Re-fetch data
            const { data: profileData } = await supabase.from('users').select('current_points').eq('id', state.userProfile.id).single();
            animatePointsUpdate(profileData.current_points);
            state.challengeSubmissions.push(data);
        }
    } else {
        resultEl.innerHTML = `<p class="font-bold text-red-500">Incorrect. Try again tomorrow!</p>`;
    }
    
    setTimeout(() => {
        closeEcoQuizModal();
        renderChallengesPage(); // Re-render to show new status
    }, 2000);
};

window.closeEcoQuizModal = () => {
    els.ecoQuizModal.classList.remove('open');
    setTimeout(() => els.ecoQuizModal.classList.add('invisible'), 300);
};

// --- Camera Modal ---
let currentCameraStream = null;
let currentChallengeIdForCamera = null;

window.openCamera = async (challengeId) => {
    currentChallengeIdForCamera = challengeId;
    els.qrScannerOverlay.classList.add('hidden'); // Ensure QR overlay is off
    els.cameraCaptureBtn.classList.remove('hidden');
    
    els.cameraModal.classList.remove('hidden');
    els.cameraModal.classList.add('open');

    try {
        currentCameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } // Prefer back camera
        });
        els.cameraFeed.srcObject = currentCameraStream;
    } catch (err) {
        console.error("Camera error:", err);
        try {
            // Fallback to user-facing camera
            currentCameraStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' } 
            });
            els.cameraFeed.srcObject = currentCameraStream;
        } catch (err2) {
             alert("Unable to access camera. Please check permissions.");
             closeCameraModal();
        }
    }
};

window.closeCameraModal = () => {
    if (currentCameraStream) {
        currentCameraStream.getTracks().forEach(track => track.stop());
    }
    els.cameraFeed.srcObject = null;
    els.cameraModal.classList.remove('open');
    setTimeout(() => els.cameraModal.classList.add('hidden'), 300);
};

// TODO: Add photo capture and Supabase Storage upload logic
window.capturePhoto = () => {
    alert(`Photo captured for challenge ${currentChallengeIdForCamera}. Upload logic not implemented.`);
    // 1. Draw video to canvas
    // 2. Convert canvas to blob
    // 3. Upload blob to Supabase Storage
    // 4. Create 'challenge_submissions' entry with 'pending' status and storage URL
    closeCameraModal();
};

window.switchCamera = () => {
    alert("Switch camera functionality not implemented.");
};

// =========================================
// 10. EVENT LISTENERS
// =========================================

// --- Theme ---
if (localStorage.getItem('eco-theme') === 'dark' || (!localStorage.getItem('eco-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    document.getElementById('theme-text').textContent = 'Dark Mode';
    document.getElementById('theme-icon').setAttribute('data-lucide', 'moon');
}
els.themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('eco-theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-text').textContent = isDark ? 'Dark Mode' : 'Light Mode';
    document.getElementById('theme-icon').setAttribute('data-lucide', isDark ? 'moon' : 'sun');
    lucide.createIcons();
    // Re-render chart for new theme colors
    if (departmentChart) {
        departmentChart.options.scales.y.ticks.color = isDark ? '#9ca3af' : '#4b5563';
        departmentChart.options.scales.x.ticks.color = isDark ? '#9ca3af' : '#4b5563';
        departmentChart.update();
    }
});

// --- Navigation ---
els.sidebarToggleBtn.addEventListener('click', () => toggleSidebar());
els.logoutButton.addEventListener('click', handleLogout);

// --- Store ---
els.storeSearch.addEventListener('input', renderRewards);
els.storeSearchClear.addEventListener('click', () => { 
    els.storeSearch.value = ''; 
    renderRewards(); 
});

// --- Redeem Code ---
els.redeemCodeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setButtonLoading(els.redeemSubmitBtn, true);
    const code = els.redeemInput.value.trim().toUpperCase();
    
    // Call Supabase Edge Function 'redeem-coupon'
    // This function must be created in your Supabase project.
    try {
        const { data, error } = await supabase.functions.invoke('redeem-coupon', {
            body: { code: code },
        });

        if (error) throw error;

        if (data.error) {
            els.redeemMessage.textContent = data.error;
            els.redeemMessage.className = 'text-red-500 text-sm text-center h-5';
        } else {
            els.redeemMessage.textContent = `Success! +${data.points_awarded} points added!`;
            els.redeemMessage.className = 'text-green-500 text-sm text-center h-5';
            els.redeemInput.value = '';
            
            // Re-fetch profile to show new points
            const { data: profileData } = await supabase.from('users').select('current_points').eq('id', state.userProfile.id).single();
            animatePointsUpdate(profileData.current_points);
        }
    } catch (error) {
         console.error(error);
         if (error.message.includes("Failed to fetch")) {
             els.redeemMessage.textContent = 'Error: "redeem-coupon" function not found.';
         } else {
             els.redeemMessage.textContent = 'An error occurred. Please try again.';
         }
        els.redeemMessage.className = 'text-red-500 text-sm text-center h-5';
    }
    
    setButtonLoading(els.redeemSubmitBtn, false);
});

// =========================================
// 11. APP INITIALIZATION
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
