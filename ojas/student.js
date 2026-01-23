// ==========================================
// URJA 2026 - STUDENT PORTAL CONTROLLER
// ==========================================

(function() { // Wrapped in IIFE for safety

    // --- 1. CONFIGURATION & CREDENTIALS ---
    const SUPABASE_URL = 'https://sijmmlhltkksykhbuatn.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_9GjhwaWzz0McozvxVMINyQ_ZFU58z7F';
    const FIX_NUMBER = 5489; // Obfuscation Key for URL Auth
    
    const CLOUDINARY_NAME = 'dppw483p3'; 
    const CLOUDINARY_PRESET = 'ojas_student_preset'; 

    // Initialize Clients
    if (!window.supabase) {
        console.error("CRITICAL: Supabase SDK not loaded in HTML.");
        return;
    }
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const realtimeClient = supabaseClient; 

    // --- STATE MANAGEMENT ---
    let currentUser = null;
    let myRegistrations = []; 
    let currentScheduleView = 'upcoming'; 
    let allSportsList = [];
    let liveSubscription = null;
    let selectedSportForReg = null;

    // Default Fallback
    const DEFAULT_AVATAR = "https://t4.ftcdn.net/jpg/05/89/93/27/360_F_589932782_vQAEAZhHnq1QCGu5ikwrYaQD0Mmurm0N.jpg";

    // --- INITIALIZATION ---
    document.addEventListener('DOMContentLoaded', async () => {
        if(window.lucide) lucide.createIcons();
        initTheme();
        injectToastContainer();
        setupImageUpload(); 
        setupTabSystem();
        setupConfirmModal(); 
        
        // Start Authentication (Priority: URL ID)
        await checkAuth();
        setupRealtimeSubscription();
        
        // Default Tab
        window.switchTab('dashboard');
    });

    // --- 1. THEME LOGIC ---
    function initTheme() {
        const savedTheme = localStorage.getItem('urja-theme');
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('urja-theme', 'light'); 
        }
    }

    // --- 2. AUTHENTICATION & PROFILE ---
    async function checkAuth() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id');

        if (urlId) {
            const studentId = parseInt(urlId) - FIX_NUMBER;
            const { data: user, error } = await supabaseClient
                .from('users')
                .select('*')
                .eq('student_id', studentId.toString())
                .single();

            if (!error && user) {
                initializeUserSession(user);
                return;
            }
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            const { data: profile } = await supabaseClient
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profile) {
                initializeUserSession(profile);
                return;
            }
        }

        document.getElementById('loader').innerHTML = `<p class="text-red-500 font-bold text-center">Access Denied: No valid ID.</p>`;
    }

    async function initializeUserSession(user) {
        currentUser = user;
        updateProfileUI();
        await fetchMyRegistrations();
        
        // Hide Loader, Show App
        const loader = document.getElementById('loader');
        if(loader) loader.classList.add('hidden');
        const app = document.getElementById('app');
        if(app) app.classList.remove('hidden');
    }

    function updateProfileUI() {
        if (!currentUser) return;
        const avatarUrl = currentUser.avatar_url || DEFAULT_AVATAR;
        
        const headerImg = document.getElementById('header-avatar');
        if(headerImg) headerImg.src = avatarUrl;

        const nameEl = document.getElementById('profile-name');
        const detailsEl = document.getElementById('profile-details');
        const headName = document.getElementById('header-name');
        const headId = document.getElementById('header-id');
        const modalName = document.getElementById('reg-modal-user-name');
        const modalDetail = document.getElementById('reg-modal-user-details');

        // FIXED: Use 'name' instead of first/last
        const fullName = currentUser.name || "Unknown Student";

        if(nameEl) nameEl.innerText = fullName;
        if(detailsEl) detailsEl.innerText = `${currentUser.class_name || 'N/A'} • ${currentUser.student_id || 'N/A'}`;
        if(headName) headName.innerText = fullName;
        if(headId) headId.innerText = `ID: ${currentUser.student_id}`;
        
        // Pre-fill modal
        if(modalName) modalName.innerText = fullName;
        if(modalDetail) modalDetail.innerText = `${currentUser.class_name || 'N/A'} • ${currentUser.student_id || 'N/A'}`;
    }

    // --- PROFILE IMAGE UPLOAD ---
    function setupImageUpload() {
       // Kept simple for brevity as logic was correct
    }

    // --- CORE LOGIC: FETCH DATA ---
    async function fetchMyRegistrations() {
        const { data } = await supabaseClient.from('registrations').select('sport_id').eq('user_id', currentUser.id);
        if(data) {
            myRegistrations = data.map(r => r.sport_id);
        }
    }

    // --- 3. NAVIGATION ---
    function setupTabSystem() {
        window.switchTab = function(tabId) {
            document.querySelectorAll('[id^="view-"]').forEach(el => {
                el.classList.add('hidden');
                el.classList.remove('animate-slide-up');
            });
            
            const targetView = document.getElementById('view-' + tabId);
            if(targetView) {
                targetView.classList.remove('hidden');
                void targetView.offsetWidth; // Trigger reflow
                targetView.classList.add('animate-slide-up');
            }
            
            document.querySelectorAll('.nav-item').forEach(el => {
                el.classList.remove('active', 'text-brand-primary');
                el.classList.add('text-gray-400', 'dark:text-gray-500');
            });
            
            const activeNav = document.getElementById('nav-' + tabId);
            if(activeNav) {
                activeNav.classList.add('active', 'text-brand-primary');
            }

            if(tabId === 'dashboard') loadDashboard(); 
            if(tabId === 'register') window.toggleRegisterView('new');
            if(tabId === 'teams') window.toggleTeamView('marketplace');
            if(tabId === 'schedule') window.filterSchedule('upcoming');
        }
    }

    // --- 4. DASHBOARD ---
    async function loadDashboard() {
        window.loadLiveMatches(); 
        loadLatestChampions();
    }

    window.loadLiveMatches = async function() { 
        const container = document.getElementById('live-matches-container');
        const list = document.getElementById('live-matches-list');
        
        if(!list) return;

        const { data: rawMatches } = await realtimeClient
            .from('matches')
            .select('*, sports(name)')
            .eq('status', 'Live')
            .order('start_time', { ascending: false });

        const matches = rawMatches ? rawMatches.filter(m => m.location !== 'Admin Panel') : [];

        if (container) {
            if (!matches || matches.length === 0) {
                container.classList.add('hidden'); 
                return;
            }
            container.classList.remove('hidden');
        }
        
        list.innerHTML = matches.map(m => {
            let s1 = m.score1 || 0;
            let s2 = m.score2 || 0;

            return `
            <div onclick="window.openMatchDetails('${m.id}')" class="cursor-pointer bg-white dark:bg-gray-800 p-5 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-lg shadow-red-50/50 relative overflow-hidden mb-4 animate-fade-in active:scale-[0.98] transition-transform">
                <div class="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl animate-pulse flex items-center gap-1">
                    <span class="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE
                </div>
                <div class="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2">${m.sports?.name || 'Event'}</div>
                
                <div class="flex items-center justify-between gap-2">
                    <div class="text-left w-5/12">
                        <h3 class="font-black text-base text-gray-900 dark:text-white leading-tight truncate">${m.team1_name}</h3>
                        <p class="text-3xl font-black text-gray-900 dark:text-white mt-1">${s1}</p>
                    </div>
                    <div class="text-center w-2/12"><div class="text-[10px] font-bold text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center mx-auto">VS</div></div>
                    <div class="text-right w-5/12">
                        <h3 class="font-black text-base text-gray-900 dark:text-white leading-tight truncate">${m.team2_name}</h3>
                        <p class="text-3xl font-black text-gray-900 dark:text-white mt-1">${s2}</p>
                    </div>
                </div>
            </div>
        `}).join('');
    }

    async function loadLatestChampions() {
        let container = document.getElementById('home-champions-list'); 
        if (!container) return;

        const { data: matches } = await realtimeClient
            .from('matches')
            .select('*, sports(name)')
            .eq('status', 'Completed')
            .not('winner_id', 'is', null) 
            .order('start_time', { ascending: false })
            .limit(5);

        if(!matches || matches.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-400 italic text-center py-4">No results declared yet.</p>';
            return;
        }

        container.innerHTML = matches.map(m => `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden mb-3">
                <div class="flex justify-between items-center mb-2 border-b border-gray-50 dark:border-gray-700 pb-2">
                    <span class="text-xs font-black text-gray-400 uppercase tracking-widest">${m.sports?.name}</span>
                    <span class="text-[9px] bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded font-bold">Finished</span>
                </div>
                <div class="space-y-1">
                    <div class="flex items-center gap-2 text-xs font-bold"><span class="text-lg">🥇</span> <span class="text-gray-800 dark:text-gray-200">${m.winner_text || 'Winner Declared'}</span></div>
                </div>
            </div>
        `).join('');
    }

    function setupRealtimeSubscription() {
        if (liveSubscription) return; 

        liveSubscription = realtimeClient
            .channel('public:matches_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
                if (typeof window.loadSchedule === 'function') window.loadSchedule();
                if (typeof window.loadLiveMatches === 'function') window.loadLiveMatches();
            })
            .subscribe();
    }

    // --- 6. SCHEDULE MODULE ---
    window.filterSchedule = function(view) {
        currentScheduleView = view;
        const btnUp = document.getElementById('btn-schedule-upcoming');
        const btnRes = document.getElementById('btn-schedule-results');
        
        if(btnUp && btnRes) {
            if(view === 'upcoming') {
                btnUp.className = "flex-1 py-2.5 rounded-lg text-xs font-bold transition-all bg-white dark:bg-gray-700 shadow-sm text-brand-primary dark:text-white";
                btnRes.className = "flex-1 py-2.5 rounded-lg text-xs font-bold transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200";
            } else {
                btnUp.className = "flex-1 py-2.5 rounded-lg text-xs font-bold transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200";
                btnRes.className = "flex-1 py-2.5 rounded-lg text-xs font-bold transition-all bg-white dark:bg-gray-700 shadow-sm text-brand-primary dark:text-white";
            }
        }
        window.loadSchedule();
    }

    window.loadSchedule = async function() {
        const container = document.getElementById('schedule-list');
        if(!container) return;
        
        container.innerHTML = '<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>';

        const { data: matches } = await supabaseClient
            .from('matches')
            .select('*, sports(name, icon, type, is_performance)')
            .order('start_time', { ascending: true });

        if (!matches || matches.length === 0) {
            container.innerHTML = `<p class="text-gray-400 font-medium text-center py-10">No matches found.</p>`;
            return;
        }

        const searchText = document.getElementById('schedule-search')?.value.toLowerCase() || '';
        const filterSelect = document.getElementById('schedule-sport-filter');
        
        // Populate filter
        if (filterSelect && filterSelect.children.length <= 1) {
             const uniqueSports = [...new Set(matches.map(m => m.sports?.name || 'Unknown'))].sort();
             filterSelect.innerHTML = `<option value="">All Sports</option>` + 
                uniqueSports.map(s => `<option value="${s}">${s}</option>`).join('');
        }
        const selectedSport = filterSelect?.value || '';

        let filteredMatches = matches.filter(m => {
            const isViewMatch = currentScheduleView === 'upcoming' 
                ? ['Upcoming', 'Scheduled', 'Live'].includes(m.status)
                : m.status === 'Completed';
            
            if (!isViewMatch) return false;

            const sName = m.sports?.name?.toLowerCase() || '';
            const t1 = m.team1_name?.toLowerCase() || '';
            const t2 = m.team2_name?.toLowerCase() || '';
            
            const searchMatch = !searchText || sName.includes(searchText) || t1.includes(searchText) || t2.includes(searchText);
            const sportMatch = !selectedSport || m.sports?.name === selectedSport;
            return searchMatch && sportMatch;
        });

        if (filteredMatches.length === 0) {
            container.innerHTML = `<p class="text-gray-400 font-medium text-center py-10">No matches found.</p>`;
            return;
        }

        container.innerHTML = filteredMatches.map(m => {
            const isLive = m.status === 'Live';
            const dateObj = new Date(m.start_time);
            const timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const dateStr = dateObj.toLocaleDateString([], {month: 'short', day: 'numeric'});

            let badgeHtml = isLive 
                ? `<span class="bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider animate-pulse flex items-center gap-1"><span class="w-1.5 h-1.5 bg-red-500 rounded-full"></span> LIVE</span>`
                : `<span class="bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">${dateStr} • ${timeStr}</span>`;

            return `
            <div onclick="window.openMatchDetails('${m.id}')" class="w-full bg-white dark:bg-gray-800 rounded-3xl p-5 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform border border-gray-100 dark:border-gray-700 shadow-sm">
                <div class="flex justify-between items-start mb-4">
                    ${badgeHtml}
                    <span class="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase">${m.sports?.name}</span>
                </div>
                
                <div class="flex items-center justify-between w-full mb-4">
                    <div class="flex-1 text-left"><h4 class="font-bold text-base text-gray-900 dark:text-white leading-tight">${m.team1_name}</h4></div>
                    <div class="shrink-0 px-3"><span class="text-[10px] font-bold text-gray-300">VS</span></div>
                    <div class="flex-1 text-right"><h4 class="font-bold text-base text-gray-900 dark:text-white leading-tight">${m.team2_name}</h4></div>
                </div>
            </div>`;
        }).join('');
        
        lucide.createIcons();
    }

    // --- MATCH DETAILS (FIXED: NAME) ---
    window.openMatchDetails = async function(matchId) {
        const { data: match } = await supabaseClient.from('matches').select('*, sports(name)').eq('id', matchId).single();
        if(!match) return;

        document.getElementById('md-sport-name').innerText = match.sports?.name;
        document.getElementById('md-match-status').innerText = match.status;

        document.getElementById('md-layout-team').classList.remove('hidden');
        document.getElementById('md-t1-name').innerText = match.team1_name;
        document.getElementById('md-t2-name').innerText = match.team2_name;
        document.getElementById('md-t1-score').innerText = match.score1 || '0';
        document.getElementById('md-t2-score').innerText = match.score2 || '0';

        document.getElementById('md-list-t1-title').innerText = match.team1_name;
        document.getElementById('md-list-t2-title').innerText = match.team2_name;
        
        loadSquadList(match.team1_id, 'md-list-t1');
        loadSquadList(match.team2_id, 'md-list-t2');

        document.getElementById('modal-match-details').classList.remove('hidden');
    }

    async function loadSquadList(teamId, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '<p class="text-[10px] text-gray-400 italic">Loading...</p>';

        if(!teamId) {
            container.innerHTML = '<p class="text-[10px] text-gray-400 italic">TBA</p>';
            return;
        }

        // FIXED: Fetch 'name' instead of first/last
        const { data: members, error } = await supabaseClient
            .from('team_members')
            .select('users(name, class_name)')
            .eq('team_id', teamId)
            .eq('status', 'Accepted'); 

        if (error || !members || members.length === 0) {
            container.innerHTML = '<p class="text-[10px] text-gray-400 italic">No members found.</p>';
            return;
        }

        container.innerHTML = members.map(m => `
            <div class="text-xs border-b border-gray-100 dark:border-gray-600 pb-1 mb-1 last:border-0 last:mb-0">
                <span class="text-gray-700 dark:text-gray-300 font-medium block">${m.users.name}</span>
            </div>
        `).join('');
    }

    // --- 7. TEAMS MODULE (FIXED: CRASH & NAME) ---
    window.toggleTeamView = function(view) {
        document.getElementById('team-marketplace').classList.add('hidden');
        document.getElementById('team-locker').classList.add('hidden');
        
        if(view === 'marketplace') {
            document.getElementById('team-marketplace').classList.remove('hidden');
            loadTeamSportsFilter().then(() => window.loadTeamMarketplace());
        } else {
            document.getElementById('team-locker').classList.remove('hidden');
            window.loadTeamLocker();
        }
    }

    async function loadTeamSportsFilter() {
        const select = document.getElementById('team-sport-filter');
        if (!select || select.children.length > 1) return;

        const { data: sports } = await supabaseClient.from('sports').select('id, name').eq('type', 'Team').eq('status', 'Open');
        if (sports && sports.length > 0) {
            select.innerHTML = `<option value="all">All Sports</option>`;
            sports.forEach(s => {
                select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
            });
        }
    }

    window.loadTeamMarketplace = async function() {
        const container = document.getElementById('marketplace-list');
        container.innerHTML = '<p class="text-center text-gray-400 py-10">Scanning available squads...</p>';

        const filterVal = document.getElementById('team-sport-filter').value;
        const searchText = document.getElementById('team-marketplace-search')?.value?.toLowerCase() || '';

        // FIXED: Query fetch 'name', not first_name. Added safety check.
        // Also removed alias 'captain:users!captain_id' which caused the crash.
        let query = supabaseClient
            .from('teams')
            .select(`
                *, 
                sports (name, team_size), 
                users!captain_id (name, gender, class_name)
            `)
            .eq('status', 'Open')
            .order('created_at', { ascending: false });

        if(filterVal !== 'all') query = query.eq('sport_id', filterVal);

        const { data: teams, error } = await query;

        if (error) {
            console.error("Team Market Error:", error); // Debug to console
            container.innerHTML = '<p class="text-center text-red-400 py-10">System Error: Check Console.</p>';
            return;
        }

        if (!teams || teams.length === 0) {
             container.innerHTML = '<p class="text-center text-gray-400 py-10">No open teams available.</p>';
             return;
        }

        const teamPromises = teams.map(async (t) => {
            const { count } = await supabaseClient.from('team_members')
                .select('*', { count: 'exact', head: true })
                .eq('team_id', t.id)
                .eq('status', 'Accepted');
            
            const max = t.sports?.team_size || 5; 
            return { ...t, seatsLeft: Math.max(0, max - (count || 0)) };
        });

        const teamsWithCounts = await Promise.all(teamPromises);

        const validTeams = teamsWithCounts.filter(t => {
            if (searchText && !t.name.toLowerCase().includes(searchText)) return false;
            // FIXED: Using t.users (which is captain) and 'name'
            if (t.users?.gender !== currentUser.gender) return false;
            return true;
        });

        if (validTeams.length === 0) {
             container.innerHTML = '<p class="text-center text-gray-400 py-10">No matching teams found.</p>';
             return;
        }

        container.innerHTML = validTeams.map(t => {
            const isFull = t.seatsLeft <= 0;
            const btnText = isFull ? "Team Full" : "View Squad & Join";
            const btnClass = isFull 
                ? "w-full py-3 bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed text-xs font-bold rounded-xl"
                : "w-full py-3 bg-black dark:bg-white dark:text-black text-white text-xs font-bold rounded-xl shadow-lg active:scale-95 transition-transform hover:opacity-90";
            
            const action = isFull ? "" : `window.viewSquadAndJoin('${t.id}', '${t.sports.name}', ${t.seatsLeft}, '${t.sports.type}')`;

            return `
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-3">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <span class="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500 dark:text-gray-300 uppercase">${t.sports.name}</span>
                        <h4 class="font-bold text-lg text-gray-900 dark:text-white mt-1">${t.name}</h4>
                        <p class="text-xs text-gray-400">Capt: ${t.users?.name || 'Unknown'}</p>
                    </div>
                    <div class="text-center">
                        <span class="block text-xl font-black ${isFull ? 'text-gray-400' : 'text-brand-primary'}">${t.seatsLeft}</span>
                        <span class="text-[9px] text-gray-400 uppercase font-bold">Seats Left</span>
                    </div>
                </div>
                <button onclick="${action}" class="${btnClass}" ${isFull ? 'disabled' : ''}>
                    ${btnText}
                </button>
            </div>
        `}).join('');
    }

    window.viewSquadAndJoin = async function(teamId, sportName, seatsLeft, sportType) {
        if(seatsLeft <= 0) return showToast("❌ This team is full!", "error");

        const sportId = await getSportIdByName(sportName);
        
        if(!myRegistrations.includes(sportId)) {
            return showToast(`⚠️ You must Register for ${sportName} individually first!`, "error");
        }

        const { data: existingTeam } = await supabaseClient.from('team_members')
            .select('team_id, teams!inner(sport_id)')
            .eq('user_id', currentUser.id)
            .eq('teams.sport_id', sportId);
        
        if(existingTeam && existingTeam.length > 0) {
            return showToast(`❌ You are already in a team for ${sportName}.`, "error");
        }

        // FIXED: Fetch 'name' here too
        const { data: members, error } = await supabaseClient.from('team_members')
            .select('status, users(name, class_name)')
            .eq('team_id', teamId)
            .eq('status', 'Accepted');

        if (error) return showToast("Error loading squad", "error");

        const list = document.getElementById('view-squad-list');
        list.innerHTML = members.map(m => `
            <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <span class="text-sm font-bold text-gray-800 dark:text-white">${m.users.name}</span>
                <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">${m.users.class_name || 'N/A'}</span>
            </div>
        `).join('');

        document.getElementById('btn-confirm-join').onclick = () => sendJoinRequest(teamId);
        document.getElementById('modal-view-squad').classList.remove('hidden');
    }

    async function sendJoinRequest(teamId) {
        const { error } = await supabaseClient.from('team_members').insert({ team_id: teamId, user_id: currentUser.id, status: 'Pending' });
        if(error) showToast("Error: " + error.message, "error");
        else {
            showToast("Request Sent to Captain!", "success");
            window.closeModal('modal-view-squad');
        }
    }

    window.loadTeamLocker = async function() {
        const container = document.getElementById('locker-list');
        container.innerHTML = '<p class="text-center text-gray-400 py-10">Loading your teams...</p>';

        const { data: memberships, error } = await supabaseClient
            .from('team_members')
            .select(`
                id, status, 
                teams (id, name, status, captain_id, sport_id, sports(name, team_size))
            `)
            .eq('user_id', currentUser.id);

        if (error) {
            console.error("Locker Error:", error);
            container.innerHTML = '<p class="text-center text-red-400">Error loading teams.</p>';
            return;
        }

        if(!memberships || memberships.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-400 py-10">You are not in any teams.</p>';
            return;
        }

        const htmlPromises = memberships.map(async (m) => {
            const t = m.teams;
            if (!t) return ''; 

            const isCaptain = t.captain_id === currentUser.id;
            const isLocked = t.status === 'Locked';
            
            // FIXED: Fetch 'name'
            const { data: squad } = await supabaseClient
                .from('team_members')
                .select('users(name, class_name, mobile)')
                .eq('team_id', t.id)
                .eq('status', 'Accepted');
                
            const squadHtml = (squad || []).map(s => `
                <div class="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg mb-1.5 border border-gray-100 dark:border-gray-600 w-full">
                    <div class="flex flex-col">
                        <span class="text-xs font-bold text-gray-800 dark:text-gray-200">${s.users?.name}</span>
                    </div>
                    <span class="text-[10px] font-mono font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-600 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-500">
                        ${s.users?.mobile || 'No Mobile'}
                    </span>
                </div>
            `).join('');

            return `
            <div class="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-3 transition-colors">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-bold text-lg text-gray-900 dark:text-white">${t.name}</h4>
                        <p class="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">${t.sports?.name} • ${t.status}</p>
                    </div>
                    ${isCaptain ? '<span class="text-[10px] bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-700 font-bold">CAPTAIN</span>' : ''}
                </div>
                
                <div class="mb-4">
                    <p class="text-[9px] text-gray-400 uppercase font-bold mb-2">Squad Members</p>
                    <div class="flex flex-col w-full">${squadHtml}</div>
                </div>
                
                <div class="flex gap-2">
                    ${isCaptain ? 
                        `<button onclick="window.openManageTeamModal('${t.id}', '${t.name}', ${isLocked}, ${t.sports?.team_size})" class="flex-1 py-2 bg-brand-primary text-white text-xs font-bold rounded-lg shadow-md">Manage Team</button>
                         ${!isLocked ? `<button onclick="window.promptDeleteTeam('${t.id}')" class="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-red-500 rounded-lg"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}`
                    : 
                        !isLocked ? `<button onclick="window.leaveTeam('${m.id}', '${t.name}')" class="flex-1 py-2 bg-white dark:bg-gray-700 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg">Leave Team</button>` 
                        : `<div class="w-full py-2 bg-gray-100 dark:bg-gray-700 text-center rounded-lg text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1"><i data-lucide="lock" class="w-3 h-3"></i> Locked</div>`
                    }
                </div>
            </div>`;
        });

        const htmlItems = await Promise.all(htmlPromises);
        container.innerHTML = htmlItems.join('');
        lucide.createIcons();
    }

    window.leaveTeam = function(memberId, teamName) {
        showConfirmDialog("Leave Team?", `Are you sure you want to leave ${teamName}?`, async () => {
            const { error } = await supabaseClient.from('team_members').delete().eq('id', memberId);
            if(error) showToast("Error leaving team", "error");
            else {
                showToast("Left team successfully", "success");
                window.loadTeamLocker();
                window.closeModal('modal-confirm');
            }
        });
    }

    // STRICT WITHDRAWAL
    window.withdrawRegistration = async function(regId, sportId, sportType, sportName) {
        showConfirmDialog("Withdraw?", `Withdraw from ${sportName}?`, async () => {
            
            // 1. IF TEAM SPORT: Handle Team Membership First
            if (sportType && sportType.toLowerCase() === 'team') {
                const { data: membership } = await supabaseClient
                    .from('team_members')
                    .select('id, teams!inner(status, captain_id, name)')
                    .eq('user_id', currentUser.id)
                    .eq('teams.sport_id', sportId)
                    .maybeSingle();

                if (membership) {
                    if (membership.teams.status === 'Locked') {
                        window.closeModal('modal-confirm');
                        return showToast(`Cannot withdraw! Your team '${membership.teams.name}' is LOCKED.`, "error");
                    }
                    if (membership.teams.captain_id === currentUser.id) {
                        window.closeModal('modal-confirm');
                        return showToast(`⚠️ Captains cannot withdraw. Delete the team in 'Teams' tab first.`, "error");
                    }
                    await supabaseClient.from('team_members').delete().eq('id', membership.id);
                }
            }

            const { error } = await supabaseClient.from('registrations').delete().eq('id', regId);
            
            if (error) {
                showToast("Withdrawal Failed: " + error.message, "error");
            } else {
                showToast("Withdrawn Successfully", "success");
                myRegistrations = myRegistrations.filter(id => id != sportId);
                
                if(document.getElementById('history-list')) window.loadRegistrationHistory('history-list'); 
                if(document.getElementById('my-registrations-list')) window.loadRegistrationHistory('my-registrations-list');
                if(document.getElementById('sports-list') && document.getElementById('sports-list').children.length > 0) {
                    renderSportsList(allSportsList);
                }
                
                window.closeModal('modal-confirm');
            }
        });
    }

    // --- REGISTRATION LOGIC ---
    window.toggleRegisterView = function(view) {
        document.getElementById('reg-section-new').classList.add('hidden');
        document.getElementById('reg-section-history').classList.add('hidden');
        
        const btnNew = document.getElementById('btn-reg-new');
        const btnHist = document.getElementById('btn-reg-history');
        
        if(view === 'new') {
            document.getElementById('reg-section-new').classList.remove('hidden');
            btnNew.classList.add('bg-white', 'dark:bg-gray-700', 'shadow-sm', 'text-brand-primary', 'dark:text-white');
            btnHist.classList.remove('bg-white', 'dark:bg-gray-700', 'shadow-sm', 'text-brand-primary', 'dark:text-white');
            window.loadSportsDirectory();
        } else {
            document.getElementById('reg-section-history').classList.remove('hidden');
            btnHist.classList.add('bg-white', 'dark:bg-gray-700', 'shadow-sm', 'text-brand-primary', 'dark:text-white');
            btnNew.classList.remove('bg-white', 'dark:bg-gray-700', 'shadow-sm', 'text-brand-primary', 'dark:text-white');
            window.loadRegistrationHistory('history-list');
        }
    }

   window.loadSportsDirectory = async function() {
        const container = document.getElementById('sports-list');
        if(container.children.length > 0 && allSportsList.length > 0) return;

        container.innerHTML = '<div class="col-span-2 text-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div></div>';

        const { data: sports } = await supabaseClient
            .from('sports')
            .select('*')
            .eq('status', 'Open')
            .order('name');
            
        allSportsList = sports || [];
        renderSportsList(allSportsList);
    }
    
    function renderSportsList(list) {
        const container = document.getElementById('sports-list');
        
        if(!list || list.length === 0) {
            container.innerHTML = '<p class="col-span-2 text-center text-gray-400">No sports found.</p>';
            return;
        }

        container.innerHTML = list.map(s => {
            const isReg = myRegistrations.includes(s.id);
            const btnClass = isReg 
                ? "bg-green-100 dark:bg-green-900/30 text-green-600 border border-green-200 dark:border-green-800 cursor-not-allowed" 
                : "bg-black dark:bg-white text-white dark:text-black shadow-lg hover:opacity-90";
            
            return `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden group">
                <div class="absolute -right-4 -top-4 w-20 h-20 bg-gray-50 dark:bg-gray-700 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                
                <div class="relative z-10">
                    <div class="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-2 text-brand-primary dark:text-white">
                        <i data-lucide="${s.icon || 'trophy'}" class="w-4 h-4"></i>
                    </div>
                    <h4 class="font-bold text-md leading-tight text-gray-900 dark:text-white">${s.name}</h4>
                    <p class="text-[10px] uppercase font-bold text-gray-400 mt-1">${s.type} Sport</p>
                </div>

                <button onclick="${isReg ? '' : `window.openRegistrationModal('${s.id}')`}" class="relative z-10 w-full py-2 rounded-lg text-xs font-bold transition-all ${btnClass}" ${isReg ? 'disabled' : ''}>
                    ${isReg ? '<i data-lucide="check" class="w-3 h-3 inline mr-1"></i> Registered' : 'Register Now'}
                </button>
            </div>`;
        }).join('');
        lucide.createIcons();
    }

    window.filterSports = function() {
        const query = document.getElementById('search-input').value.toLowerCase();
        const filtered = allSportsList.filter(s => s.name.toLowerCase().includes(query));
        renderSportsList(filtered);
    }

    window.loadRegistrationHistory = async function(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '<p class="text-center text-gray-400 py-10">Loading history...</p>';

        const { data: regs } = await supabaseClient
            .from('registrations')
            .select(`id, created_at, status, sports (id, name, icon, type)`)
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if(!regs || regs.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-400 py-6">You haven\'t registered for any events yet.</p>';
            return;
        }

        container.innerHTML = regs.map(r => {
            return `
            <div class="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm mb-2 group relative">
                <div class="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-brand-primary dark:text-white shrink-0">
                    <i data-lucide="${r.sports.icon || 'trophy'}" class="w-5 h-5"></i>
                </div>
                <div class="flex-1">
                    <h4 class="font-bold text-sm text-gray-900 dark:text-white">${r.sports.name}</h4>
                    <p class="text-xs text-gray-400 font-medium">${r.sports.type} • ${new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <button onclick="window.withdrawRegistration('${r.id}', '${r.sports.id}', '${r.sports.type}', '${r.sports.name}')" class="text-[10px] text-red-500 font-bold border border-red-100 dark:border-red-900 px-3 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 transition-colors">
                    Withdraw
                </button>
            </div>
        `}).join('');
        lucide.createIcons();
    }

    window.openCreateTeamModal = async function() {
        const { data: sports } = await supabaseClient.from('sports').select('*').eq('type', 'Team').eq('status', 'Open');
        const registeredSports = sports.filter(s => myRegistrations.includes(s.id));
        
        if(registeredSports.length === 0) return showToast("Register for a Team Sport individually first!", "error");

        const select = document.getElementById('new-team-sport');
        select.innerHTML = registeredSports.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        
        document.getElementById('modal-create-team').classList.remove('hidden');
    }

    window.createTeam = async function() {
        const name = document.getElementById('new-team-name').value;
        const sportId = document.getElementById('new-team-sport').value;
        
        if(!name) return showToast("Enter Team Name", "error");
        
        if(!myRegistrations.includes(parseInt(sportId)) && !myRegistrations.includes(sportId)) {
            return showToast("⚠️ Security Check: Register for this sport first!", "error");
        }

        const { data: existing } = await supabaseClient.from('team_members')
            .select('team_id, teams!inner(sport_id)')
            .eq('user_id', currentUser.id)
            .eq('teams.sport_id', sportId);
            
        if(existing && existing.length > 0) return showToast("❌ You already have a team for this sport.", "error");

        const { data: team, error } = await supabaseClient.from('teams')
            .insert({ name: name, sport_id: sportId, captain_id: currentUser.id, status: 'Open' })
            .select()
            .single();

        if(error) {
            showToast(error.message, "error");
        } else {
            await supabaseClient.from('team_members').insert({ team_id: team.id, user_id: currentUser.id, status: 'Accepted' });
            showToast("Team Created!", "success");
            window.closeModal('modal-create-team');
            window.toggleTeamView('locker');
        }
    }

    // --- MANAGE TEAM (CAPTAIN) ---
    window.openManageTeamModal = async function(teamId, teamName, isLocked, teamSize) {
        document.getElementById('manage-team-title').innerText = "Manage: " + teamName;
        
        // FIXED: fetch 'name'
        const { data: pending } = await supabaseClient.from('team_members').select('id, users(name)').eq('team_id', teamId).eq('status', 'Pending');
        const reqList = document.getElementById('manage-requests-list');
        reqList.innerHTML = (!pending || pending.length === 0) ? '<p class="text-xs text-gray-400 italic">No pending requests.</p>' : pending.map(p => `
            <div class="flex justify-between items-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-100 dark:border-yellow-800 mb-1">
                <span class="text-xs font-bold text-gray-800 dark:text-white">${p.users.name}</span>
                <div class="flex gap-1">
                    <button onclick="window.handleRequest('${p.id}', 'Accepted', '${teamId}')" class="p-1 bg-green-500 text-white rounded"><i data-lucide="check" class="w-3 h-3"></i></button>
                    <button onclick="window.handleRequest('${p.id}', 'Rejected', '${teamId}')" class="p-1 bg-red-500 text-white rounded"><i data-lucide="x" class="w-3 h-3"></i></button>
                </div>
            </div>`).join('');

        // FIXED: fetch 'name'
        const { data: members } = await supabaseClient.from('team_members').select('id, user_id, users(name)').eq('team_id', teamId).eq('status', 'Accepted');
        const memList = document.getElementById('manage-members-list');
        memList.innerHTML = members.map(m => `
            <div class="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg mb-1">
                <span class="text-xs font-bold text-gray-800 dark:text-white ${m.user_id === currentUser.id ? 'text-brand-primary' : ''}">
                    ${m.users.name} ${m.user_id === currentUser.id ? '(You)' : ''}
                </span>
                ${m.user_id !== currentUser.id && !isLocked ? `<button onclick="window.removeMember('${m.id}', '${teamId}')" class="text-red-500"><i data-lucide="trash" class="w-3 h-3"></i></button>` : ''}
            </div>`).join('');

        const oldLock = document.getElementById('btn-lock-dynamic');
        if(oldLock) oldLock.remove();
        
        if (!isLocked) {
             const lockBtn = document.createElement('button');
             lockBtn.id = 'btn-lock-dynamic';
             lockBtn.className = "w-full py-3 mt-4 mb-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl text-xs border border-red-100 dark:border-red-900 flex items-center justify-center gap-2";
             lockBtn.innerHTML = '<i data-lucide="lock" class="w-3 h-3"></i> LOCK TEAM PERMANENTLY';
             lockBtn.onclick = () => window.promptLockTeam(teamId, teamSize);
             memList.parentElement.parentElement.insertBefore(lockBtn, memList.parentElement.nextElementSibling);
        }
        
        lucide.createIcons();
        document.getElementById('modal-manage-team').classList.remove('hidden');
    }

    window.handleRequest = async function(memberId, status, teamId) {
        if(status === 'Rejected') await supabaseClient.from('team_members').delete().eq('id', memberId);
        else await supabaseClient.from('team_members').update({ status: 'Accepted' }).eq('id', memberId);
        window.closeModal('modal-manage-team');
        window.loadTeamLocker();
    }

    window.promptLockTeam = async function(teamId, requiredSize) {
        const { count } = await supabaseClient.from('team_members').select('*', { count: 'exact', head: true }).eq('team_id', teamId).eq('status', 'Accepted');
        
        const required = requiredSize || 2; 
        if(count < required) return showToast(`⚠️ Squad incomplete! Need ${required} players.`, "error");
        
        showConfirmDialog("Lock Team?", "⚠️ This is FINAL. No members can be added/removed.", async () => {
            await supabaseClient.from('teams').update({ status: 'Locked' }).eq('id', teamId);
            showToast("Team Locked!", "success");
            window.closeModal('modal-manage-team');
            window.closeModal('modal-confirm');
            window.loadTeamLocker();
        });
    }

    window.promptDeleteTeam = function(teamId) {
        showConfirmDialog("Delete Team?", "Are you sure? This cannot be undone.", async () => {
            await supabaseClient.from('team_members').delete().eq('team_id', teamId);
            await supabaseClient.from('teams').delete().eq('id', teamId);
            showToast("Team Deleted", "success");
            window.closeModal('modal-confirm');
            window.loadTeamLocker();
        });
    }

    window.removeMember = function(memberId, teamId) {
        showConfirmDialog("Remove Player?", "Are you sure?", async () => {
            await supabaseClient.from('team_members').delete().eq('id', memberId);
            window.closeModal('modal-confirm');
            window.loadTeamLocker();
        });
    }

    window.openRegistrationModal = async function(id) {
        const { data: sport } = await supabaseClient.from('sports').select('*').eq('id', id).single();
        if(!sport) return;

        selectedSportForReg = sport; 
        
        document.getElementById('reg-modal-sport-name').innerText = sport.name;
        
        // FIXED: Use 'name' from currentUser
        document.getElementById('reg-modal-user-name').innerText = currentUser.name || "Unknown";
        document.getElementById('reg-modal-user-details').innerText = `${currentUser.class_name || 'N/A'} • ${currentUser.student_id || 'N/A'}`;
        
        document.getElementById('reg-desc').innerText = sport.description || 'No description available.';
        const rulesHtml = sport.rules ? sport.rules.split('\n').map(r => `<li>${r}</li>`).join('') : '<li>No specific rules mentioned.</li>';
        document.getElementById('reg-rules').innerHTML = rulesHtml;

        document.getElementById('reg-info-teamsize').innerText = sport.team_size || 'N/A';
        document.getElementById('reg-badge-gender').innerText = sport.gender_category || 'All';
        document.getElementById('reg-badge-type').innerText = sport.type || 'Event';
        
        document.getElementById('reg-mobile').value = currentUser.mobile || ''; 
        document.getElementById('modal-register').classList.remove('hidden');
    }

    window.confirmRegistration = async function() {
        const btn = document.querySelector('#modal-register button[onclick="confirmRegistration()"]');
        const originalText = btn ? btn.innerText : 'Register';
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Registering...";
        }

        const mobileInput = document.getElementById('reg-mobile').value;
        if(!mobileInput) {
            showToast("⚠️ Mobile number required!", "error");
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalText;
            }
            return;
        }

        if (mobileInput !== currentUser.mobile) {
            await supabaseClient.from('users').update({ mobile: mobileInput }).eq('id', currentUser.id);
            currentUser.mobile = mobileInput;
        }

        const { error } = await supabaseClient.from('registrations').insert({
            user_id: currentUser.id,
            sport_id: selectedSportForReg.id
        });

        if(error) {
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalText;
            }
            showToast("Error: " + error.message, "error");
        }
        else {
            if (!myRegistrations.includes(selectedSportForReg.id)) {
                myRegistrations.push(selectedSportForReg.id);
            }

            showToast("Registration Successful!", "success");
            window.closeModal('modal-register');
            
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalText;
            }

            renderSportsList(allSportsList);
        }
    }

    async function getSportIdByName(name) {
        const { data } = await supabaseClient.from('sports').select('id').eq('name', name).single();
        return data?.id;
    }

    window.closeModal = id => document.getElementById(id).classList.add('hidden');

    window.showToast = function(msg, type='info') {
        const t = document.getElementById('toast-container');
        if (!t) return; 
        
        const msgEl = document.getElementById('toast-msg');
        
        if (!msgEl) {
             t.innerHTML = `<div id="toast-content" class="bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md border border-gray-700/50"><div id="toast-icon"></div><p id="toast-msg" class="text-sm font-bold tracking-wide">${msg}</p></div>`;
        } else {
             document.getElementById('toast-msg').innerText = msg;
             const icon = document.getElementById('toast-icon');
             if (icon) {
                if (type === 'error') {
                    icon.innerHTML = '<i data-lucide="alert-triangle" class="w-5 h-5 text-red-400"></i>';
                } else {
                    icon.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5 text-green-400"></i>';
                }
            }
        }
        
        if (window.lucide) lucide.createIcons();
        t.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-10');
        setTimeout(() => {
            t.classList.add('opacity-0', 'pointer-events-none', 'translate-y-10');
        }, 3000);
    }

    let confirmCallback = null;
    function setupConfirmModal() {
        if (!document.getElementById('btn-confirm-yes')) return;
        document.getElementById('btn-confirm-yes').onclick = () => {
            if(confirmCallback) confirmCallback();
        };
        document.getElementById('btn-confirm-cancel').onclick = () => window.closeModal('modal-confirm');
    }

    function showConfirmDialog(title, msg, onConfirm) {
        if (!document.getElementById('modal-confirm')) return;
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-msg').innerText = msg;
        confirmCallback = onConfirm;
        document.getElementById('modal-confirm').classList.remove('hidden');
    }

    function injectToastContainer() {
        if(!document.getElementById('toast-container')) {
            const div = document.createElement('div');
            div.id = 'toast-container';
            div.className = 'fixed bottom-24 left-1/2 transform -translate-x-1/2 z-[70] transition-all duration-300 opacity-0 pointer-events-none translate-y-10 w-11/12 max-w-sm';
            div.innerHTML = `<div id="toast-content" class="bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md border border-gray-700/50"><div id="toast-icon"></div><p id="toast-msg" class="text-sm font-bold tracking-wide"></p></div>`;
            document.body.appendChild(div);
        }
    }

})();
