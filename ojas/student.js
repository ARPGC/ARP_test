// ==========================================
// URJA 2026 - STUDENT PORTAL CONTROLLER
// ==========================================

(function() { // Wrapped in IIFE for safety

    // --- 1. CONFIGURATION & CREDENTIALS ---
    // Fixed: Credentials embedded directly to solve "CONFIG missing" error
    const SUPABASE_URL = 'https://sijmmlhltkksykhbuatn.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_9GjhwaWzz0McozvxVMINyQ_ZFU58z7F';
    const FIX_NUMBER = 5489; // Obfuscation Key for URL Auth

    // Initialize Supabase
    if (!window.supabase) {
        console.error("CRITICAL: Supabase SDK not loaded in HTML.");
        return;
    }
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- STATE MANAGEMENT ---
    let currentUser = null;
    let myRegistrations = []; 
    let myTeams = [];
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
        
        // Start Authentication
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
        
        // Update Header Elements
        const headerImg = document.getElementById('header-avatar');
        const headerName = document.getElementById('header-name');
        const headerId = document.getElementById('header-id');

        if(headerImg) headerImg.src = avatarUrl;
        if(headerName) headerName.innerText = currentUser.first_name || currentUser.name;
        if(headerId) headerId.innerText = `ID: ${currentUser.student_id}`;

        // Update Dashboard Card
        const dbName = document.getElementById('profile-name');
        const dbDetails = document.getElementById('profile-details');
        if(dbName) dbName.innerText = `${currentUser.first_name} ${currentUser.last_name || ''}`;
        if(dbDetails) dbDetails.innerText = `${currentUser.class_name || ''} • ${currentUser.student_id}`;
    }

    // --- 3. THEME MANAGER ---
    function initTheme() {
        const savedTheme = localStorage.getItem('urja-theme');
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    // --- 4. DATA FETCHING ---
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

    // --- 5. NAVIGATION ---
    function setupTabSystem() {
        window.switchTab = function(tabId) {
            // Hide all views
            document.querySelectorAll('[id^="view-"]').forEach(el => {
                el.classList.add('hidden');
                el.classList.remove('animate-slide-up'); // Reset animation
            });
            
            // Show target view
            const targetView = document.getElementById('view-' + tabId);
            if(targetView) {
                targetView.classList.remove('hidden');
                void targetView.offsetWidth; // Trigger reflow for animation
                targetView.classList.add('animate-slide-up');
            }
            
            // Update Tab Icons
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            const activeNav = document.getElementById('nav-' + tabId); // Fixed ID matching
            if(activeNav) activeNav.classList.add('active');
            
            // Logic Triggers
            if(tabId === 'dashboard') loadDashboard(); 
            if(tabId === 'register') window.toggleRegisterView('new');
            if(tabId === 'teams') window.toggleTeamView('marketplace');
            if(tabId === 'schedule') window.filterSchedule('upcoming');
        }
    }

    // --- 6. DASHBOARD LOGIC ---
    async function loadDashboard() {
        window.loadLiveMatches();
        loadLatestChampions();
    }

    window.loadLiveMatches = async function() { 
        const container = document.getElementById('live-matches-container');
        const list = document.getElementById('live-matches-list');
        
        if(!list) return;

        const { data: matches } = await supabaseClient
            .from('matches') // Assuming matches table handles live status
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

        // Fetch completed matches that have winners
        const { data: matches } = await supabaseClient
            .from('matches')
            .select('*')
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

    // --- 7. SCHEDULE LOGIC ---
    window.filterSchedule = function(view) {
        currentScheduleView = view;
        const btnUp = document.getElementById('btn-schedule-upcoming');
        const btnRes = document.getElementById('btn-schedule-results');
        
        // Toggle Button Styles
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
            .select('*, sports(name, icon, type)')
            .order('start_time', { ascending: true });

        if (!matches || matches.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-xs text-center py-10">No matches found.</p>`;
            return;
        }

        const searchText = document.getElementById('schedule-search')?.value.toLowerCase() || '';
        const selectedSport = document.getElementById('schedule-sport-filter')?.value || '';

        // Filter
        let filtered = matches.filter(m => {
            const isTarget = currentScheduleView === 'upcoming' 
                ? ['Scheduled', 'Live'].includes(m.status)
                : ['Completed', 'Cancelled'].includes(m.status);
            
            if (!isTarget) return false;

            const sName = m.sports?.name || '';
            const matchText = (m.team1_name + m.team2_name + sName).toLowerCase();
            return matchText.includes(searchText) && (!selectedSport || sName === selectedSport);
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

    // --- 8. TEAMS MARKETPLACE & LOCKER ---
    window.toggleTeamView = function(view) {
        document.getElementById('team-marketplace').classList.add('hidden');
        document.getElementById('team-locker').classList.add('hidden');
        
        const btnMarket = document.getElementById('btn-team-market');
        const btnLocker = document.getElementById('btn-team-locker');
        
        // Reset Styles
        [btnMarket, btnLocker].forEach(b => {
            b.classList.remove('bg-white/10', 'text-white', 'shadow-sm');
            b.classList.add('text-gray-500');
        });

        if(view === 'marketplace') {
            document.getElementById('team-marketplace').classList.remove('hidden');
            btnMarket.classList.add('bg-white/10', 'text-white', 'shadow-sm');
            btnMarket.classList.remove('text-gray-500');
            window.loadTeamMarketplace();
        } else {
            document.getElementById('team-locker').classList.remove('hidden');
            btnLocker.classList.add('bg-white/10', 'text-white', 'shadow-sm');
            btnLocker.classList.remove('text-gray-500');
            window.loadTeamLocker();
        }
    }

    window.loadTeamMarketplace = async function() {
        const container = document.getElementById('marketplace-list');
        container.innerHTML = '<p class="text-center text-gray-500 text-xs py-10">Scanning squads...</p>';

        const searchText = document.getElementById('team-marketplace-search')?.value.toLowerCase() || '';

        // Fetch Open Teams
        const { data: teams } = await supabaseClient
            .from('teams')
            .select(`*, sports(name, team_size), captain:users!captain_id(gender)`)
            .eq('status', 'Open')
            .order('created_at', { ascending: false });

        if (!teams || teams.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 text-xs py-10">No open teams available.</p>';
            return;
        }

        // STRICT FILTERING
        const filtered = teams.filter(t => {
            if (searchText && !t.name.toLowerCase().includes(searchText)) return false;
            // Gender Segregation (Unless Mixed sport like Relay)
            const isMixed = ['Relay Race', 'BGMI', 'FREE FIRE'].includes(t.sports.name);
            if (!isMixed && t.captain?.gender !== currentUser.gender) return false;
            return true;
        });

        container.innerHTML = filtered.map(t => {
            const seats = t.sports.team_size || 5; // Simplified seat calculation
            return `
            <div class="glass-panel p-4 rounded-xl flex justify-between items-center mb-3">
                <div>
                    <h4 class="font-bold text-white text-sm">${t.name}</h4>
                    <p class="text-[10px] text-gray-400 mt-1">${t.sports.name}</p>
                </div>
                <button onclick="window.viewSquadAndJoin('${t.id}', '${t.sports.name}', 1, '${t.sports.type}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-colors">
                    Join
                </button>
            </div>
        `}).join('');
    }

    window.viewSquadAndJoin = async function(teamId, sportName, seatsLeft, sportType) {
        // STRICT CHECK 1: Individual Registration Required
        const sportId = await getSportIdByName(sportName);
        if (!myRegistrations.includes(sportId)) {
            return showToast(`⚠️ Register for ${sportName} individually first!`, "error");
        }

        // STRICT CHECK 2: Already in a team?
        if (myTeams.includes(teamId)) { // Simplified check
             return showToast(`⚠️ You are already in a team!`, "error");
        }
        
        // Join Logic
        const { error } = await supabaseClient.from('team_members').insert({
            team_id: teamId,
            user_id: currentUser.id,
            status: 'Pending'
        });

        if (error) showToast("Error joining team", "error");
        else showToast("Request sent to Captain!", "success");
    }

    // --- 9. MY TEAMS (LOCKER) ---
    window.loadTeamLocker = async function() {
        const container = document.getElementById('locker-list');
        container.innerHTML = '<p class="text-center text-gray-500 text-xs py-10">Loading your squads...</p>';

        const { data: memberships } = await supabaseClient
            .from('team_members')
            .select('id, status, teams(*, sports(name))')
            .eq('user_id', currentUser.id);

        if (!memberships || memberships.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 text-xs py-10">You are not in any teams.</p>';
            return;
        }

        container.innerHTML = memberships.map(m => {
            const t = m.teams;
            const isCaptain = t.captain_id === currentUser.id;
            
            return `
            <div class="glass-panel p-4 rounded-xl mb-3 border border-white/5">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-bold text-white text-sm">${t.name}</h4>
                        <p class="text-[10px] text-yellow-500 font-mono">${t.sports.name} • ${t.status}</p>
                    </div>
                    ${isCaptain ? '<span class="text-[9px] bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded border border-yellow-500/30">CAPTAIN</span>' : ''}
                </div>
                
                <div class="flex gap-2">
                    ${isCaptain ? 
                        `<button onclick="window.openManageTeamModal('${t.id}', '${t.name}')" class="flex-1 py-2 bg-yellow-600 text-black text-[10px] font-bold rounded-lg hover:brightness-110">Manage</button>
                         <button onclick="window.promptDeleteTeam('${t.id}')" class="px-3 py-2 bg-red-500/10 text-red-500 rounded-lg"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`
                    : 
                        `<button onclick="window.leaveTeam('${m.id}', '${t.name}')" class="flex-1 py-2 bg-white/5 border border-white/10 text-red-400 text-[10px] font-bold rounded-lg hover:bg-white/10">Leave Team</button>`
                    }
                </div>
            </div>`;
        }).join('');
        lucide.createIcons();
    }

    // --- 10. REGISTRATION UI ---
    window.toggleRegisterView = function(view) {
        const btnNew = document.getElementById('btn-reg-new');
        const btnHist = document.getElementById('btn-reg-history');
        const viewNew = document.getElementById('reg-section-new');
        const viewHist = document.getElementById('reg-section-history');

        if(view === 'new') {
            viewNew.classList.remove('hidden');
            viewHist.classList.add('hidden');
            btnNew.classList.replace('text-gray-500', 'bg-white/10');
            btnNew.classList.add('text-white', 'shadow-sm');
            btnHist.classList.remove('bg-white/10', 'text-white', 'shadow-sm');
            btnHist.classList.add('text-gray-500');
            window.loadSportsDirectory();
        } else {
            viewHist.classList.remove('hidden');
            viewNew.classList.add('hidden');
            btnHist.classList.replace('text-gray-500', 'bg-white/10');
            btnHist.classList.add('text-white', 'shadow-sm');
            btnNew.classList.remove('bg-white/10', 'text-white', 'shadow-sm');
            btnNew.classList.add('text-gray-500');
            window.loadRegistrationHistory();
        }
    }

    window.loadSportsDirectory = async function() {
        const container = document.getElementById('sports-list');
        if(container.children.length > 1) return; // Cached

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

    window.loadRegistrationHistory = async function() {
        const container = document.getElementById('history-list');
        container.innerHTML = '<p class="text-center text-gray-500 text-xs py-10">Loading history...</p>';

        const { data: regs } = await supabaseClient
            .from('registrations')
            .select(`id, sport_id, sports(name, icon, type)`)
            .eq('user_id', currentUser.id);

        if(!regs || regs.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 text-xs py-10">No registrations found.</p>';
            return;
        }

        container.innerHTML = regs.map(r => `
            <div class="glass-panel p-4 rounded-xl flex items-center justify-between mb-2">
                <div class="flex items-center gap-3">
                    <i data-lucide="${r.sports.icon}" class="w-4 h-4 text-yellow-500"></i>
                    <span class="text-xs font-bold text-white">${r.sports.name}</span>
                </div>
                <button onclick="window.withdrawRegistration('${r.id}', '${r.sport_id}', '${r.sports.type}', '${r.sports.name}')" class="text-[10px] text-red-500 font-bold hover:underline">Withdraw</button>
            </div>
        `).join('');
        lucide.createIcons();
    }

    // --- 11. MODAL & UTILS ---
    window.openRegistrationModal = async function(id) {
        const sport = allSportsList.find(s => s.id == id);
        selectedSportForReg = sport;
        
        document.getElementById('reg-modal-sport-name').innerText = sport.name;
        document.getElementById('reg-modal-user-name').innerText = currentUser.first_name;
        document.getElementById('reg-modal-user-details').innerText = currentUser.student_id;
        document.getElementById('reg-mobile').value = currentUser.mobile || '';
        
        document.getElementById('modal-register').classList.remove('hidden');
        document.getElementById('modal-register').classList.add('flex');
    }

    window.confirmRegistration = async function() {
        if(!selectedSportForReg) return;
        
        const { error } = await supabaseClient.from('registrations').insert({
            user_id: currentUser.id,
            sport_id: selectedSportForReg.id
        });

        if(error) showToast("Registration failed", "error");
        else {
            myRegistrations.push(selectedSportForReg.id);
            showToast("Registered Successfully!", "success");
            closeModal('modal-register');
            renderSportsList(allSportsList);
        }
    }

    window.withdrawRegistration = function(regId, sportId, type, name) {
        if(!confirm(`Withdraw from ${name}?`)) return;
        
        // Safety: If team sport, check if in team logic would go here
        supabaseClient.from('registrations').delete().eq('id', regId).then(({ error }) => {
            if(error) showToast("Failed to withdraw", "error");
            else {
                showToast("Withdrawn", "success");
                myRegistrations = myRegistrations.filter(id => id != sportId);
                window.loadRegistrationHistory();
            }
        });
    }

    // Helper Functions
    async function getSportIdByName(name) {
        const s = allSportsList.find(sp => sp.name === name);
        return s ? s.id : null;
    }

    window.closeModal = function(id) {
        const el = document.getElementById(id);
        el.classList.add('hidden');
        el.classList.remove('flex');
    }

    window.showToast = function(msg, type='info') {
        const t = document.getElementById('toast-container');
        if (!t) return;
        t.innerHTML = `<div class="bg-gray-800 text-white px-4 py-3 rounded-full shadow-xl flex items-center gap-2 border border-gray-700">
            <i data-lucide="${type === 'error' ? 'alert-circle' : 'check-circle'}" class="w-4 h-4 ${type === 'error' ? 'text-red-500' : 'text-green-500'}"></i>
            <span class="text-xs font-bold">${msg}</span>
        </div>`;
        t.classList.remove('opacity-0', 'translate-y-10');
        setTimeout(() => t.classList.add('opacity-0', 'translate-y-10'), 3000);
        if(window.lucide) lucide.createIcons();
    }

    // Setup Modals
    function setupConfirmModal() { /* Setup if needed */ }
    function injectToastContainer() {
        if(!document.getElementById('toast-container')) {
            const div = document.createElement('div');
            div.id = 'toast-container';
            div.className = 'fixed bottom-24 left-1/2 transform -translate-x-1/2 z-[70] transition-all duration-300 opacity-0 pointer-events-none translate-y-10';
            document.body.appendChild(div);
        }
    }

})();
