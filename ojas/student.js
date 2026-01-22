// ==========================================
// URJA 2026 - STUDENT PORTAL CONTROLLER
// ==========================================

(function() { // Wrapped in IIFE to protect scope, but exposes window functions

    // --- 1. CONFIGURATION & CREDENTIALS ---
    // Credentials embedded to fix 'CONFIG is not defined' error
    const SUPABASE_URL = 'https://sijmmlhltkksykhbuatn.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_9GjhwaWzz0McozvxVMINyQ_ZFU58z7F';
    const FIX_NUMBER = 5489; // Obfuscation Key

    // Initialize Supabase Client
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
    let selectedSportForReg = null;

    const DEFAULT_AVATAR = "https://t4.ftcdn.net/jpg/05/89/93/27/360_F_589932782_vQAEAZhHnq1QCGu5ikwrYaQD0Mmurm0N.jpg";

    // --- INITIALIZATION ---
    document.addEventListener('DOMContentLoaded', async () => {
        if(window.lucide) lucide.createIcons();
        
        // Setup UI
        setupTabSystem();
        
        // Start Authentication
        await performUrlAuth();
    });

    // --- 2. AUTHENTICATION ---
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
            
            // Initial Views
            loadDashboard();
            loadSportsDirectory(); // Pre-load
            
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

        // Dashboard Welcome Card
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

    // --- 4. NAVIGATION SYSTEM ---
    function setupTabSystem() {
        // Expose switchTab to global window scope for HTML buttons
        window.switchTab = function(tabId) {
            // Hide all views
            ['dashboard', 'register', 'teams', 'schedule'].forEach(id => {
                const el = document.getElementById('view-' + id);
                if(el) {
                    el.classList.add('hidden');
                    el.classList.remove('animate-slide-up');
                }
                const nav = document.getElementById('nav-' + id);
                if(nav) nav.classList.remove('active');
            });
            
            // Show target
            const target = document.getElementById('view-' + tabId);
            if(target) {
                target.classList.remove('hidden');
                void target.offsetWidth; // Trigger reflow
                target.classList.add('animate-slide-up');
            }
            
            // Update Nav
            const activeNav = document.getElementById('nav-' + tabId);
            if(activeNav) activeNav.classList.add('active');

            // Logic Triggers
            if(tabId === 'dashboard') loadDashboard();
            if(tabId === 'teams') window.toggleTeamView('marketplace');
            if(tabId === 'schedule') window.filterSchedule('upcoming');
        }
    }

    // --- 5. DASHBOARD ---
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
            <div onclick="window.openMatchDetails('${m.id}')" class="glass-panel p-4 rounded-xl relative overflow-hidden mb-3 border border-red-500/30 cursor-pointer">
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
        if(container.children.length > 1 && allSportsList.length > 0) return; // Cached

        const { data: sports } = await supabaseClient.from('sports').select('*').eq('status', 'Open').order('name');
        allSportsList = sports || [];
        renderSportsList(allSportsList);
    }

    function renderSportsList(list) {
        const container = document.getElementById('sports-list');
        container.innerHTML = list.map(s => {
            const isReg = myRegistrations.includes(s.id);
            return `
            <div class="glass-panel p-4 rounded-xl flex items-center justify-between group mb-3">
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

    // --- TEAMS MARKETPLACE & LOCKER ---
    window.toggleTeamView = function(view) {
        document.getElementById('team-marketplace').classList.add('hidden');
        document.getElementById('team-locker').classList.add('hidden');
        
        const btnMarket = document.getElementById('btn-team-market');
        const btnLocker = document.getElementById('btn-team-locker');
        
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

        const { data: teams } = await supabaseClient
            .from('teams')
            .select(`*, sports(name, team_size), captain:users!captain_id(gender)`)
            .eq('status', 'Open')
            .order('created_at', { ascending: false });

        if (!teams || teams.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 text-xs py-10">No open teams available.</p>';
            return;
        }

        // Filter: Match Name & Gender
        const filtered = teams.filter(t => {
            if (searchText && !t.name.toLowerCase().includes(searchText)) return false;
            const isMixed = ['Relay Race', 'BGMI', 'FREE FIRE'].includes(t.sports.name);
            if (!isMixed && t.captain?.gender !== currentUser.gender) return false;
            return true;
        });

        container.innerHTML = filtered.map(t => `
            <div class="glass-panel p-4 rounded-xl flex justify-between items-center mb-3">
                <div>
                    <h4 class="font-bold text-white text-sm">${t.name}</h4>
                    <p class="text-[10px] text-gray-400 mt-1">${t.sports.name}</p>
                </div>
                <button onclick="window.viewSquadAndJoin('${t.id}', '${t.sports.name}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-colors">
                    Join
                </button>
            </div>
        `).join('');
    }

    window.viewSquadAndJoin = async function(teamId, sportName) {
        const sportId = await getSportIdByName(sportName);
        if (!myRegistrations.includes(sportId)) {
            return showToast(`⚠️ Register for ${sportName} individually first!`, "error");
        }
        if (myTeams.includes(teamId)) {
             return showToast(`⚠️ You are already in a team!`, "error");
        }
        
        const { error } = await supabaseClient.from('team_members').insert({
            team_id: teamId,
            user_id: currentUser.id,
            status: 'Pending'
        });

        if (error) showToast("Error joining team", "error");
        else showToast("Request sent to Captain!", "success");
    }

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

    // --- 8. ACTIONS: CREATE TEAM, WITHDRAW ---
    window.openCreateTeamModal = function() {
        const select = document.getElementById('new-team-sport');
        const eligibleSports = allSportsList.filter(s => s.type === 'Team' && myRegistrations.includes(s.id));
        
        if(eligibleSports.length === 0) {
            return showToast("Register for a Team Sport individually first!", "error");
        }

        select.innerHTML = eligibleSports.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        
        const modal = document.getElementById('modal-create-team');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    window.createTeam = async function() {
        const name = document.getElementById('new-team-name').value;
        const sportId = document.getElementById('new-team-sport').value;
        
        if(!name) return showToast("Enter Name", "error");

        const { data: team, error } = await supabaseClient.from('teams')
            .insert({ name: name, sport_id: sportId, captain_id: currentUser.id, status: 'Open' })
            .select()
            .single();

        if(error) {
            showToast("Error creating team", "error");
        } else {
            await supabaseClient.from('team_members').insert({ team_id: team.id, user_id: currentUser.id, status: 'Accepted' });
            showToast("Team Created!", "success");
            closeModal('modal-create-team');
            window.toggleTeamView('locker');
        }
    }

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

    // --- 9. UTILS ---
    window.openRegistrationModal = async function(id) {
        const sport = allSportsList.find(s => s.id == id);
        selectedSportForReg = sport;
        
        document.getElementById('reg-modal-sport-name').innerText = sport.name;
        document.getElementById('reg-modal-user-name').innerText = currentUser.first_name;
        document.getElementById('reg-modal-user-details').innerText = currentUser.student_id;
        document.getElementById('reg-mobile').value = currentUser.mobile || '';
        
        const modal = document.getElementById('modal-register');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
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
        t.classList.remove('translate-y-10', 'opacity-0');
        setTimeout(() => t.classList.add('translate-y-10', 'opacity-0'), 3000);
        if(window.lucide) lucide.createIcons();
    }

    // Placeholders to prevent errors for unused features in this version
    window.promptDeleteTeam = function(id) { 
        if(confirm('Delete Team?')) {
            supabaseClient.from('teams').delete().eq('id', id).then(() => {
                showToast("Team Deleted");
                window.loadTeamLocker();
            });
        }
    }
    window.leaveTeam = function(id) {
        if(confirm('Leave Team?')) {
            supabaseClient.from('team_members').delete().eq('id', id).then(() => {
                showToast("Left Team");
                window.loadTeamLocker();
            });
        }
    }
    window.openManageTeamModal = function(id) { alert("Team Management would open here."); }

})();
