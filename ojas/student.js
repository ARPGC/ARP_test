// ==========================================
// URJA 2026 - STUDENT PORTAL CONTROLLER
// ==========================================

(function() { // Wrapped in IIFE for safety

    // --- 1. CONFIGURATION & CREDENTIALS ---
    // FIX: Embedded credentials to resolve 'CONFIG is not defined' error
    const SUPABASE_URL = 'https://sijmmlhltkksykhbuatn.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_9GjhwaWzz0McozvxVMINyQ_ZFU58z7F';
    const FIX_NUMBER = 5489; // Obfuscation Key

    // Initialize Clients
    if (!window.supabase) {
        console.error("CRITICAL: Supabase SDK not loaded.");
        return;
    }
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- STATE MANAGEMENT ---
    let currentUser = null;
    let myRegistrations = []; // Array of Sport IDs
    let myTeams = []; // Array of Team IDs
    let currentScheduleView = 'upcoming'; 
    let allSportsList = [];
    let liveSubscription = null;
    let selectedSportForReg = null;

    const DEFAULT_AVATAR = "https://t4.ftcdn.net/jpg/05/89/93/27/360_F_589932782_vQAEAZhHnq1QCGu5ikwrYaQD0Mmurm0N.jpg";

    // --- INITIALIZATION ---
    document.addEventListener('DOMContentLoaded', async () => {
        if(window.lucide) lucide.createIcons();
        initTheme();
        injectToastContainer();
        setupTabSystem();
        setupConfirmModal(); 
        
        // Start Auth Flow
        await performUrlAuth();
    });

    // --- 2. AUTHENTICATION (URL BASED) ---
    async function performUrlAuth() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id');

        if (!urlId) {
            document.getElementById('loader').innerHTML = `<p class="text-red-500 font-bold">Access Denied: No ID Found</p>`;
            return;
        }

        // De-obfuscate ID (Logic: URL_ID - 5489)
        const studentId = parseInt(urlId) - FIX_NUMBER;
        
        try {
            const { data: user, error } = await supabaseClient
                .from('users')
                .select('*')
                .eq('student_id', studentId.toString())
                .single();

            if (error || !user) {
                console.error("Auth Error:", error);
                document.getElementById('loader').innerHTML = `<p class="text-red-500 font-bold">Unauthorized: Student Not Found</p>`;
                return;
            }

            // Login Success
            currentUser = user;
            updateHeaderUI();
            
            // Load Initial Data
            await fetchMyRegistrations();
            await fetchMyTeams();
            
            // Start App Features
            loadDashboard();
            setupRealtimeSubscription();

            // Reveal App
            document.getElementById('loader').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');

        } catch (err) {
            console.error(err);
            document.getElementById('loader').innerHTML = `<p class="text-red-500 font-bold">Connection Failed</p>`;
        }
    }

    function updateHeaderUI() {
        if (!currentUser) return;
        const avatarUrl = currentUser.avatar_url || DEFAULT_AVATAR;
        
        const headerImg = document.getElementById('header-avatar');
        const headerName = document.getElementById('header-name');
        const headerId = document.getElementById('header-id');

        if(headerImg) headerImg.src = avatarUrl;
        if(headerName) headerName.innerText = currentUser.first_name || currentUser.name;
        if(headerId) headerId.innerText = `ID: ${currentUser.student_id}`;

        // Dashboard Card
        const dbName = document.getElementById('profile-name');
        const dbDetails = document.getElementById('profile-details');
        if(dbName) dbName.innerText = `${currentUser.first_name} ${currentUser.last_name || ''}`;
        if(dbDetails) dbDetails.innerText = `${currentUser.class_name || ''} • ${currentUser.student_id}`;
    }

    // --- 3. DATA FETCHING ---
    async function fetchMyRegistrations() {
        const { data } = await supabaseClient.from('registrations').select('sport_id').eq('user_id', currentUser.id);
        if(data) {
            myRegistrations = data.map(r => r.sport_id);
        }
    }

    async function fetchMyTeams() {
        const { data } = await supabaseClient.from('team_members').select('team_id').eq('user_id', currentUser.id);
        if(data) {
            myTeams = data.map(t => t.team_id);
        }
    }

    // --- 4. DASHBOARD (LIVE & CHAMPIONS) ---
    async function loadDashboard() {
        window.loadLiveMatches();
        loadLatestChampions();
    }

    window.loadLiveMatches = async function() { 
        const container = document.getElementById('live-matches-container');
        const list = document.getElementById('live-matches-list');
        
        if(!list) return;

        const { data: matches } = await supabaseClient
            .from('matches')
            .select('*')
            .eq('status', 'Live')
            .order('start_time', { ascending: false });

        if (!matches || matches.length === 0) {
            if(container) container.classList.add('hidden');
            return;
        }

        if(container) container.classList.remove('hidden');
        
        list.innerHTML = matches.map(m => `
            <div onclick="window.openMatchDetails('${m.id}')" class="glass-panel p-4 rounded-xl relative overflow-hidden mb-3 border border-red-500/30">
                <div class="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-2 py-1 rounded-bl-lg animate-pulse">LIVE</div>
                <div class="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">${m.sport_name || 'Event'}</div>
                <div class="flex items-center justify-between">
                    <div class="text-left w-5/12">
                        <h3 class="font-bold text-white text-sm truncate">${m.team1_name}</h3>
                        <p class="text-xl font-black text-white">${m.score1 || 0}</p>
                    </div>
                    <div class="text-gray-500 font-black text-xs">VS</div>
                    <div class="text-right w-5/12">
                        <h3 class="font-bold text-white text-sm truncate">${m.team2_name}</h3>
                        <p class="text-xl font-black text-white">${m.score2 || 0}</p>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async function loadLatestChampions() {
        const container = document.getElementById('home-champions-list');
        if (!container) return;

        const { data: matches } = await supabaseClient
            .from('matches')
            .select('*, sports(name)')
            .eq('status', 'Completed')
            .order('start_time', { ascending: false })
            .limit(5);

        if(!matches || matches.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-500 italic text-center py-4">No results yet.</p>';
            return;
        }

        container.innerHTML = matches.map(m => `
            <div class="glass-panel p-3 rounded-xl flex justify-between items-center mb-2">
                <div>
                    <span class="text-[9px] font-bold text-gray-400 uppercase">${m.sports?.name || 'Event'}</span>
                    <h4 class="text-xs font-bold text-white">${m.winner_text || 'Winner Declared'}</h4>
                </div>
                <i data-lucide="trophy" class="w-4 h-4 text-yellow-500"></i>
            </div>
        `).join('');
        lucide.createIcons();
    }

    // --- 5. REALTIME ---
    function setupRealtimeSubscription() {
        if (liveSubscription) return;
        // Simple polling fallback or Realtime if enabled
        setInterval(() => {
            if(document.getElementById('view-dashboard').classList.contains('hidden') === false) {
                window.loadLiveMatches();
            }
        }, 10000); // Poll every 10s for live scores
    }

    // --- 6. SCHEDULE ---
    window.filterSchedule = function(view) {
        currentScheduleView = view;
        const btnUp = document.getElementById('btn-schedule-upcoming');
        const btnRes = document.getElementById('btn-schedule-results');
        
        if(view === 'upcoming') {
            btnUp.classList.replace('text-gray-500', 'bg-white/10');
            btnUp.classList.add('text-white', 'shadow-sm');
            btnRes.classList.remove('bg-white/10', 'text-white', 'shadow-sm');
            btnRes.classList.add('text-gray-500');
        } else {
            btnRes.classList.replace('text-gray-500', 'bg-white/10');
            btnRes.classList.add('text-white', 'shadow-sm');
            btnUp.classList.remove('bg-white/10', 'text-white', 'shadow-sm');
            btnUp.classList.add('text-gray-500');
        }
        window.loadSchedule();
    }

    window.loadSchedule = async function() {
        const container = document.getElementById('schedule-list');
        if(!container) return;
        
        container.innerHTML = '<div class="text-center py-10"><div class="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>';

        const { data: matches } = await supabaseClient
            .from('matches')
            .select('*, sports(name, icon)')
            .order('start_time', { ascending: true });

        if (!matches || matches.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-xs text-center py-10">No matches found.</p>`;
            return;
        }

        const filtered = matches.filter(m => {
            return currentScheduleView === 'upcoming' 
                ? ['Scheduled', 'Live'].includes(m.status)
                : ['Completed', 'Cancelled'].includes(m.status);
        });

        if (filtered.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-xs text-center py-10">No matches found.</p>`;
            return;
        }

        container.innerHTML = filtered.map(m => {
            const date = new Date(m.start_time).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'});
            return `
            <div class="glass-panel p-4 rounded-xl relative overflow-hidden mb-3 border border-white/5">
                <div class="flex items-center gap-2 mb-3 opacity-70">
                    <i data-lucide="${m.sports?.icon || 'calendar'}" class="w-3 h-3 text-yellow-500"></i>
                    <span class="text-[10px] uppercase font-bold tracking-wider text-gray-300">${m.sports?.name}</span>
                </div>
                <div class="flex justify-between items-center mb-3">
                    <div class="text-center w-5/12">
                        <h4 class="text-xs font-bold text-white truncate">${m.team1_name}</h4>
                    </div>
                    <div class="text-[10px] text-gray-500 font-mono">VS</div>
                    <div class="text-center w-5/12">
                        <h4 class="text-xs font-bold text-white truncate">${m.team2_name}</h4>
                    </div>
                </div>
                <div class="pt-2 border-t border-white/5 flex justify-between items-center">
                    <span class="text-[10px] text-gray-500">${m.location || 'Main Ground'}</span>
                    <span class="text-[10px] text-yellow-500 font-mono">${date}</span>
                </div>
            </div>`;
        }).join('');
        lucide.createIcons();
    }

    // --- 7. TEAMS & REGISTRATION ---
    window.loadSportsDirectory = async function() {
        const container = document.getElementById('sports-list');
        if(container.children.length > 1) return;

        const { data: sports } = await supabaseClient.from('sports').select('*').eq('status', 'Open').order('name');
        allSportsList = sports || [];
        renderSportsList(allSportsList);
    }

    function renderSportsList(list) {
        const container = document.getElementById('sports-list');
        container.innerHTML = list.map(s => {
            const isReg = myRegistrations.includes(s.id);
            return `
            <div class="glass-panel p-4 rounded-xl flex items-center justify-between group">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center border border-white/10 text-gray-400 group-hover:text-yellow-500 transition-colors">
                        <i data-lucide="${s.icon || 'trophy'}" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-white text-sm">${s.name}</h4>
                        <span class="text-[10px] text-gray-500 font-bold uppercase bg-white/5 px-1.5 py-0.5 rounded">${s.type}</span>
                    </div>
                </div>
                <button onclick="${isReg ? '' : `window.openRegistrationModal('${s.id}')`}" class="${isReg ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'} border px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-colors" ${isReg ? 'disabled' : ''}>
                    ${isReg ? 'Joined' : 'Register'}
                </button>
            </div>`;
        }).join('');
        lucide.createIcons();
    }

    // STRICT WITHDRAWAL
    window.withdrawRegistration = async function(regId, sportId, type, name) {
        if (!confirm(`Are you sure you want to withdraw from ${name}?`)) return;

        // Team Check
        if (type === 'Team') {
            const { data: membership } = await supabaseClient.from('team_members')
                .select('id, teams!inner(status, captain_id)')
                .eq('user_id', currentUser.id)
                .eq('teams.sport_id', sportId)
                .maybeSingle();

            if (membership) {
                if (membership.teams.status === 'Locked') {
                    return showToast("Cannot withdraw: Team is LOCKED", "error");
                }
                if (membership.teams.captain_id === currentUser.id) {
                    return showToast("Captains must delete the team first", "error");
                }
                // Leave Team
                await supabaseClient.from('team_members').delete().eq('id', membership.id);
            }
        }

        // Delete Registration
        const { error } = await supabaseClient.from('registrations').delete().eq('id', regId);
        if (error) showToast("Withdrawal failed", "error");
        else {
            showToast("Withdrawn Successfully", "success");
            myRegistrations = myRegistrations.filter(id => id != sportId);
            window.loadRegistrationHistory();
            renderSportsList(allSportsList); // Refresh buttons
        }
    }

    // --- 8. HELPER FUNCTIONS ---
    window.toggleTeamView = function(view) {
        document.getElementById('team-marketplace').classList.toggle('hidden', view !== 'marketplace');
        document.getElementById('team-locker').classList.toggle('hidden', view !== 'locker');
        
        if (view === 'marketplace') window.loadTeamMarketplace();
        else window.loadTeamLocker();
    }

    window.toggleRegisterView = function(view) {
        document.getElementById('reg-section-new').classList.toggle('hidden', view !== 'new');
        document.getElementById('reg-section-history').classList.toggle('hidden', view !== 'history');
        if (view === 'new') window.loadSportsDirectory();
        else window.loadRegistrationHistory();
    }

    // Modal & Toast Utils
    window.closeModal = (id) => document.getElementById(id).classList.add('hidden');
    window.showToast = (msg, type='info') => {
        const t = document.getElementById('toast-container');
        t.innerHTML = `<div class="bg-gray-800 text-white px-4 py-3 rounded-full border border-gray-600 flex gap-2"><i data-lucide="info" class="w-4 h-4 text-yellow-500"></i> <span class="text-xs font-bold">${msg}</span></div>`;
        t.classList.remove('translate-y-10', 'opacity-0');
        setTimeout(() => t.classList.add('translate-y-10', 'opacity-0'), 3000);
        lucide.createIcons();
    };

    // Theme & Tabs
    function initTheme() { document.documentElement.classList.add('dark'); }
    function setupTabSystem() {
        window.switchTab = (id) => {
            document.querySelectorAll('[id^="view-"]').forEach(e => e.classList.add('hidden'));
            document.getElementById('view-' + id).classList.remove('hidden');
            // Logic Triggers
            if(id === 'dashboard') loadDashboard();
            if(id === 'register') window.toggleRegisterView('new');
            if(id === 'teams') window.toggleTeamView('marketplace');
            if(id === 'schedule') window.filterSchedule('upcoming');
        };
    }
    
    // Placeholder functions to prevent errors if called
    window.loadRegistrationHistory = async () => { /* Implement if needed */ };
    window.loadTeamMarketplace = async () => { /* Implement if needed */ };
    window.loadTeamLocker = async () => { /* Implement if needed */ };
    function setupConfirmModal() {}
    function injectToastContainer() {
        const d = document.createElement('div');
        d.id = 'toast-container';
        d.className = 'fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 translate-y-10 opacity-0';
        document.body.appendChild(d);
    }

})();
