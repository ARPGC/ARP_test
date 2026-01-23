// ==========================================
// URJA 2026 - STUDENT PORTAL CONTROLLER
// ==========================================

(function() { // Wrapped in IIFE to protect scope

    // --- 1. CONFIGURATION & CREDENTIALS [FIXED] ---
    // Credentials embedded to fix "CONFIG is not defined" crash
    const SUPABASE_URL = 'https://sijmmlhltkksykhbuatn.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_9GjhwaWzz0McozvxVMINyQ_ZFU58z7F';
    const FIX_NUMBER = 5489; // Obfuscation Key

    // Cloudinary Config (Placeholders - Update if you have specific keys)
    const CLOUDINARY_NAME = 'dppw483p3'; 
    const CLOUDINARY_PRESET = 'ojas_student_preset'; 

    // Initialize Clients
    if (!window.supabase) {
        console.error("CRITICAL: Supabase SDK not loaded in HTML.");
        return;
    }
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const realtimeClient = supabaseClient; // Reuse client for realtime

    // --- STATE MANAGEMENT ---
    let currentUser = null;
    let myRegistrations = []; // Stores IDs of sports user is registered for
    let myTeams = []; // Stores IDs of teams user is in
    let currentScheduleView = 'upcoming'; 
    let allSportsList = [];
    let liveSubscription = null;
    let selectedSportForReg = null;

    // Default Fallback
    const DEFAULT_AVATAR = "https://t4.ftcdn.net/jpg/05/89/93/27/360_F_589932782_vQAEAZhHnq1QCGu5ikwrYaQD0Mmurm0N.jpg";
    const DEFAULT_TEAM_SIZE = 5;

    // --- INITIALIZATION ---
    document.addEventListener('DOMContentLoaded', async () => {
        if(window.lucide) lucide.createIcons();
        
        initTheme();
        injectToastContainer();
        setupImageUpload(); 
        setupTabSystem();
        setupConfirmModal(); 
        
        // Start Authentication (Priority: URL ID)
        await performUrlAuth();
    });

    // --- 1. THEME LOGIC ---
    function initTheme() {
        const savedTheme = localStorage.getItem('urja-theme');
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
            updateThemeIcon(true);
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('urja-theme', 'light'); 
            updateThemeIcon(false);
        }
    }

    window.toggleTheme = function() {
        const html = document.documentElement;
        const isDark = html.classList.toggle('dark');
        localStorage.setItem('urja-theme', isDark ? 'dark' : 'light');
        updateThemeIcon(isDark);
    }

    function updateThemeIcon(isDark) {
        const btn = document.getElementById('btn-theme-toggle');
        if(btn) {
            btn.innerHTML = isDark 
                ? '<i data-lucide="sun" class="w-5 h-5 text-yellow-400"></i>' 
                : '<i data-lucide="moon" class="w-5 h-5 text-gray-600 dark:text-gray-300"></i>';
            if(window.lucide) lucide.createIcons();
        }
    }

    // --- 2. AUTHENTICATION (URL BASED) ---
    async function performUrlAuth() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id');

        if (!urlId) {
            document.getElementById('loader').innerHTML = `<div class="text-center"><p class="text-red-500 font-bold mb-2">Access Denied</p><p class="text-gray-500 text-xs">No Student ID found in URL.</p></div>`;
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
                document.getElementById('loader').innerHTML = `<div class="text-center"><p class="text-red-500 font-bold mb-2">Unauthorized</p><p class="text-gray-500 text-xs">Student ID '${studentId}' not found.</p></div>`;
                return;
            }

            // Login Success
            initializeUserSession(user);

        } catch (err) {
            console.error(err);
            document.getElementById('loader').innerHTML = `<p class="text-red-500 font-bold text-center">Connection Failed</p>`;
        }
    }

    async function initializeUserSession(user) {
        currentUser = user;
        updateProfileUI();
        
        // Load Data Parallelly
        await Promise.all([
            fetchMyRegistrations(),
            fetchMyTeams()
        ]);
        
        loadUserStats();
        loadDashboard();
        loadSportsDirectory();
        setupRealtimeSubscription();

        // Reveal App
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
    }

    function updateProfileUI() {
        if (!currentUser) return;
        const avatarUrl = currentUser.avatar_url || DEFAULT_AVATAR;
        const fullName = currentUser.name || "Student"; 

        // 1. Header
        const headerImg = document.getElementById('header-avatar');
        if(headerImg) headerImg.src = avatarUrl;
        
        const headerName = document.getElementById('header-name');
        if(headerName) headerName.innerText = fullName;
        
        const headerId = document.getElementById('header-id');
        if(headerId) headerId.innerText = `ID: ${currentUser.student_id}`;

        // 2. Dashboard Card
        const dbName = document.getElementById('profile-name');
        if(dbName) dbName.innerText = fullName;
        
        const dbDetails = document.getElementById('profile-details');
        if(dbDetails) dbDetails.innerText = `${currentUser.class_name || 'N/A'} • ${currentUser.student_id}`;

        // 3. Profile Tab
        const profileDisplay = document.getElementById('profile-name-display');
        if(profileDisplay) profileDisplay.innerText = fullName;
        
        const profileImg = document.getElementById('profile-img');
        if(profileImg) profileImg.src = avatarUrl;
    }

    // --- PROFILE IMAGE UPLOAD ---
    function setupImageUpload() {
        const input = document.getElementById('file-upload-input');
        const trigger = document.getElementById('profile-img-container'); 
        
        if(trigger && input) {
            trigger.onclick = () => input.click();
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if(!file) return;
                
                showToast("Uploading...", "info");
                
                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', CLOUDINARY_PRESET); 
                
                try {
                    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_NAME}/image/upload`, {
                        method: 'POST', body: formData
                    });
                    const data = await res.json();
                    
                    if(data.secure_url) {
                        await supabaseClient.from('users').update({ avatar_url: data.secure_url }).eq('id', currentUser.id);
                        currentUser.avatar_url = data.secure_url;
                        updateProfileUI();
                        showToast("Profile Photo Updated!", "success");
                    } else {
                        showToast("Upload failed. Check settings.", "error");
                    }
                } catch(err) {
                    showToast("Upload Failed", "error");
                    console.error(err);
                }
            };
        }
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

    async function loadUserStats() {
        const { count: matches } = await supabaseClient.from('registrations')
            .select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);

        const statEl = document.getElementById('stat-matches-played');
        if(statEl) statEl.innerText = matches || 0;
    }

    window.logout = async function() {
        await supabaseClient.auth.signOut();
        window.location.href = window.location.pathname; // Reload nicely
    }

    // --- 4. NAVIGATION ---
    function setupTabSystem() {
        window.switchTab = function(tabId) {
            // Hide all views
            ['dashboard', 'register', 'teams', 'schedule', 'profile'].forEach(id => {
                const el = document.getElementById('view-' + id);
                if(el) {
                    el.classList.add('hidden');
                    el.classList.remove('animate-slide-up');
                }
                const nav = document.getElementById('nav-' + id);
                if(nav) nav.classList.remove('active');
            });
            
            // Show target view
            const targetView = document.getElementById('view-' + tabId);
            if(targetView) {
                targetView.classList.remove('hidden');
                void targetView.offsetWidth; // Trigger reflow
                targetView.classList.add('animate-slide-up');
            }
            
            // Activate Nav Button
            const activeNav = document.getElementById('nav-' + tabId);
            if(activeNav) {
                activeNav.classList.add('active');
            }

            // Trigger specific load functions
            if(tabId === 'dashboard') loadDashboard(); 
            if(tabId === 'register') window.toggleRegisterView('new');
            if(tabId === 'teams') window.toggleTeamView('marketplace');
            if(tabId === 'schedule') window.filterSchedule('upcoming');
            if(tabId === 'profile') window.loadProfileGames();
        }
    }

    // --- 5. DASHBOARD (RESULTS ONLY) ---
    async function loadDashboard() {
        window.loadLiveMatches(); 
        loadLatestChampions();
    }

    // A. LIVE MATCHES
    window.loadLiveMatches = async function() { 
        const container = document.getElementById('live-matches-container');
        const list = document.getElementById('live-matches-list');
        
        if(!list) return;

        const { data: matches } = await supabaseClient
            .from('matches')
            .select('*, sports(name, is_performance)')
            .eq('status', 'Live')
            .order('start_time', { ascending: false });

        if (!matches || matches.length === 0) {
            if(container) container.classList.add('hidden');
            return;
        }

        if(container) container.classList.remove('hidden');
        
        list.innerHTML = matches.map(m => {
            const isPerf = m.sports?.is_performance;
            let s1 = m.score1 || 0;
            let s2 = m.score2 || 0;

            // Cricket Logic (Optional JSON parsing if needed)
            const isCricket = m.sports?.name?.toLowerCase().includes('cricket');

            return `
            <div onclick="window.openMatchDetails('${m.id}')" class="cursor-pointer bg-white dark:bg-gray-800 p-5 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-lg shadow-red-50/50 relative overflow-hidden mb-4 animate-fade-in active:scale-[0.98] transition-transform">
                <div class="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl animate-pulse flex items-center gap-1">
                    <span class="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE
                </div>
                <div class="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2">${m.sports?.name || 'Event'}</div>
                
                ${isPerf ? `<div class="text-center font-bold text-gray-800 dark:text-gray-200">Live Event in Progress</div>` : `
                <div class="flex items-center justify-between gap-2">
                    <div class="text-left w-5/12">
                        <h3 class="font-black text-base text-gray-900 dark:text-white leading-tight truncate">${m.team1_name}</h3>
                        <p class="text-3xl font-black text-gray-900 dark:text-white mt-1 ${isCricket ? 'text-lg' : ''}">${s1}</p>
                    </div>
                    <div class="text-center w-2/12"><div class="text-[10px] font-bold text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center mx-auto">VS</div></div>
                    <div class="text-right w-5/12">
                        <h3 class="font-black text-base text-gray-900 dark:text-white leading-tight truncate">${m.team2_name}</h3>
                        <p class="text-3xl font-black text-gray-900 dark:text-white mt-1 ${isCricket ? 'text-lg' : ''}">${s2}</p>
                    </div>
                </div>
                `}
                <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-xs text-gray-400 font-bold">
                    <span class="flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i> ${m.location || 'Ground'}</span>
                    <span>Round ${m.round_name || 1}</span>
                </div>
            </div>
        `}).join('');
        
        if(window.lucide) lucide.createIcons();
    }

    // B. CHAMPIONS
    async function loadLatestChampions() {
        let container = document.getElementById('home-champions-list'); 
        if (!container) return;

        const { data: matches } = await supabaseClient
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
                    <div class="flex items-center gap-2 text-xs font-bold">
                        <span class="text-lg">🥇</span> 
                        <span class="text-gray-800 dark:text-gray-200">${m.winner_text || 'Winner Declared'}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // --- 6. REALTIME SUBSCRIPTION ---
    function setupRealtimeSubscription() {
        if (liveSubscription) return; 

        liveSubscription = realtimeClient
            .channel('public:matches_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
                const newData = payload.new;
                if (!newData) return;

                if (newData.status === 'Completed') {
                    loadLatestChampions();
                    showToast(`🏆 Match Finished!`);
                }
                
                // Refresh views
                if (typeof window.loadSchedule === 'function') window.loadSchedule();
                if (typeof window.loadLiveMatches === 'function') window.loadLiveMatches();
            })
            .subscribe();
    }

    // --- 7. SCHEDULE MODULE ---
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
        
        container.innerHTML = '<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>';

        const { data: matches } = await supabaseClient
            .from('matches')
            .select('*, sports(name, icon)')
            .order('start_time', { ascending: true });

        if (!matches || matches.length === 0) {
            container.innerHTML = `<p class="text-gray-400 font-medium text-center py-10">No matches found.</p>`;
            return;
        }

        const filtered = matches.filter(m => {
            return currentScheduleView === 'upcoming' 
                ? ['Scheduled', 'Live'].includes(m.status)
                : ['Completed', 'Cancelled'].includes(m.status);
        });

        if (filtered.length === 0) {
            container.innerHTML = `<p class="text-gray-400 font-medium text-center py-10">No matches found.</p>`;
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

    // --- 8. TEAMS & MARKETPLACE (Fixed Column Names) ---
    window.toggleTeamView = function(view) {
        document.getElementById('team-marketplace').classList.toggle('hidden', view !== 'marketplace');
        document.getElementById('team-locker').classList.toggle('hidden', view !== 'locker');
        
        const btnMarket = document.getElementById('btn-team-market');
        const btnLocker = document.getElementById('btn-team-locker');
        
        [btnMarket, btnLocker].forEach(b => {
            b.classList.remove('bg-white/10', 'text-white', 'shadow-sm');
            b.classList.add('text-gray-500');
        });

        if (view === 'marketplace') {
            btnMarket.classList.add('bg-white/10', 'text-white', 'shadow-sm');
            btnMarket.classList.remove('text-gray-500');
            window.loadTeamMarketplace();
        } else {
            btnLocker.classList.add('bg-white/10', 'text-white', 'shadow-sm');
            btnLocker.classList.remove('text-gray-500');
            window.loadTeamLocker();
        }
    }

    window.loadTeamMarketplace = async function() {
        const container = document.getElementById('marketplace-list');
        container.innerHTML = '<p class="text-center text-gray-500 text-xs py-10">Scanning squads...</p>';

        const searchText = document.getElementById('team-marketplace-search')?.value.toLowerCase() || '';

        // FIXED: Replaced 'first_name' with 'name' for captain relation
        const { data: teams } = await supabaseClient
            .from('teams')
            .select(`*, sports(name, team_size), captain:users!captain_id(name, gender, class_name)`)
            .eq('status', 'Open')
            .order('created_at', { ascending: false });

        if (!teams || teams.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 text-xs py-10">No open teams available.</p>';
            return;
        }

        const filtered = teams.filter(t => {
            if (searchText && !t.name.toLowerCase().includes(searchText)) return false;
            
            // Gender Check (Fixed column name usage)
            const isMixed = ['Relay Race', 'BGMI', 'FREE FIRE'].includes(t.sports.name);
            if (!isMixed && t.captain?.gender !== currentUser.gender) return false;
            return true;
        });

        container.innerHTML = filtered.map(t => {
            // Calculate seats logic (simplified)
            const max = t.sports.team_size || DEFAULT_TEAM_SIZE;
            
            return `
            <div class="glass-panel p-4 rounded-xl flex justify-between items-center mb-3">
                <div>
                    <h4 class="font-bold text-white text-sm">${t.name}</h4>
                    <p class="text-[10px] text-gray-400 mt-1">${t.sports.name}</p>
                    <p class="text-[9px] text-gray-500">Capt: ${t.captain?.name}</p>
                </div>
                <button onclick="window.viewSquadAndJoin('${t.id}', '${t.sports.name}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-colors">
                    Join
                </button>
            </div>
        `}).join('');
    }

    window.viewSquadAndJoin = async function(teamId, sportName) {
        const sportId = await getSportIdByName(sportName);
        
        // Strict Logic
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
            .select(`id, status, teams(*, sports(name, team_size))`)
            .eq('user_id', currentUser.id);

        if(!memberships || memberships.length === 0) {
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

    // --- 9. REGISTRATION & CONFIRM MODAL (Bottom Sheet Fixed) ---
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

    // --- MODAL: CONFIRM ENTRY (ENHANCED & BOTTOM SHEET) ---
    window.openRegistrationModal = async function(id) {
        const sport = allSportsList.find(s => s.id == id);
        selectedSportForReg = sport;
        
        document.getElementById('reg-modal-sport-name').innerText = sport.name;
        document.getElementById('reg-modal-user-name').innerText = currentUser.name;
        document.getElementById('reg-modal-user-details').innerText = currentUser.student_id;
        document.getElementById('reg-mobile').value = currentUser.mobile || '';
        
        // --- DYNAMICALLY INJECT RULES & DETAILS ---
        let infoContainer = document.getElementById('reg-extra-info');
        if (!infoContainer) {
            const modalBody = document.querySelector('#modal-register .p-6.space-y-5');
            infoContainer = document.createElement('div');
            infoContainer.id = 'reg-extra-info';
            infoContainer.className = "bg-black/20 p-3 rounded-lg border border-white/5 text-[10px] text-gray-400 space-y-2 mb-3";
            const buttonsDiv = modalBody.querySelector('.flex.gap-3');
            modalBody.insertBefore(infoContainer, buttonsDiv);
        }

        infoContainer.innerHTML = `
            <div>
                <span class="block uppercase font-bold text-gray-500 mb-1">Rules</span>
                <p class="text-white whitespace-pre-wrap leading-relaxed">${sport.rules || 'Standard rules apply.'}</p>
            </div>
            <div class="flex gap-4 pt-1 border-t border-white/5 mt-2">
                <div><span class="uppercase font-bold text-gray-500">Team Size:</span> <span class="text-yellow-500 font-bold">${sport.team_size || 1}</span></div>
                <div><span class="uppercase font-bold text-gray-500">Category:</span> <span class="text-yellow-500 font-bold">${sport.gender_category || 'Open'}</span></div>
            </div>
        `;

        const modal = document.getElementById('modal-register');
        // CSS Fix for Bottom Sheet
        modal.classList.remove('hidden', 'items-center'); 
        modal.classList.add('flex', 'items-end'); 
    }

    window.confirmRegistration = async function() {
        if(!selectedSportForReg) return;
        
        const mobile = document.getElementById('reg-mobile').value;
        if(!mobile) return showToast("Mobile number required", "error");

        if(mobile !== currentUser.mobile) {
            await supabaseClient.from('users').update({ mobile: mobile }).eq('id', currentUser.id);
            currentUser.mobile = mobile;
        }

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

    // --- OTHER ACTIONS ---
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

        if (type === 'Team') {
            const { data: membership } = await supabaseClient.from('team_members')
                .select('id, teams!inner(status, captain_id)')
                .eq('user_id', currentUser.id)
                .eq('teams.sport_id', sportId)
                .maybeSingle();

            if (membership) {
                if (membership.teams.status === 'Locked') return showToast("Cannot withdraw: Team is LOCKED", "error");
                if (membership.teams.captain_id === currentUser.id) return showToast("Captains must delete the team first", "error");
                await supabaseClient.from('team_members').delete().eq('id', membership.id);
            }
        }

        const { error } = await supabaseClient.from('registrations').delete().eq('id', regId);
        if (error) showToast("Withdrawal failed", "error");
        else {
            showToast("Withdrawn Successfully", "success");
            myRegistrations = myRegistrations.filter(id => id != sportId);
            window.loadRegistrationHistory();
            renderSportsList(allSportsList);
        }
    }

    // --- MANAGE TEAM MODAL (Fixed Columns) ---
    window.openManageTeamModal = async function(teamId, teamName) {
        document.getElementById('manage-team-title').innerText = "Manage: " + teamName;
        
        const { data: pending } = await supabaseClient.from('team_members').select('id, users(name)').eq('team_id', teamId).eq('status', 'Pending');
        const reqList = document.getElementById('manage-requests-list');
        reqList.innerHTML = (!pending || pending.length === 0) ? '<p class="text-xs text-gray-400 italic">No pending requests.</p>' : pending.map(p => `
            <div class="flex justify-between items-center p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20 mb-1">
                <span class="text-xs font-bold text-white">${p.users.name}</span>
                <div class="flex gap-1">
                    <button onclick="window.handleRequest('${p.id}', 'Accepted')" class="p-1 bg-green-500 text-white rounded"><i data-lucide="check" class="w-3 h-3"></i></button>
                    <button onclick="window.handleRequest('${p.id}', 'Rejected')" class="p-1 bg-red-500 text-white rounded"><i data-lucide="x" class="w-3 h-3"></i></button>
                </div>
            </div>`).join('');

        const { data: members } = await supabaseClient.from('team_members').select('id, user_id, users(name)').eq('team_id', teamId).eq('status', 'Accepted');
        const memList = document.getElementById('manage-members-list');
        memList.innerHTML = members.map(m => `
            <div class="flex justify-between items-center p-2 bg-white/5 rounded-lg mb-1">
                <span class="text-xs font-bold text-white ${m.user_id === currentUser.id ? 'text-yellow-500' : ''}">${m.users.name}</span>
                ${m.user_id !== currentUser.id ? `<button onclick="window.removeMember('${m.id}')" class="text-red-500"><i data-lucide="trash" class="w-3 h-3"></i></button>` : ''}
            </div>`).join('');

        const modal = document.getElementById('modal-manage-team');
        modal.classList.remove('hidden');
        lucide.createIcons();
    }

    window.handleRequest = async (id, status) => {
        if(status==='Rejected') await supabaseClient.from('team_members').delete().eq('id',id);
        else await supabaseClient.from('team_members').update({status:'Accepted'}).eq('id',id);
        window.closeModal('modal-manage-team');
        window.loadTeamLocker();
    }
    
    window.removeMember = async (id) => {
        if(confirm('Remove player?')) {
            await supabaseClient.from('team_members').delete().eq('id',id);
            window.closeModal('modal-manage-team');
            window.loadTeamLocker();
        }
    }

    // --- PROFILE SETTINGS (Name Split/Join Fix) ---
    window.openSettingsModal = function() {
        const names = (currentUser.name || '').split(' ');
        document.getElementById('edit-fname').value = names[0] || '';
        document.getElementById('edit-lname').value = names.slice(1).join(' ') || '';
        document.getElementById('edit-email').value = currentUser.email || '';
        document.getElementById('edit-mobile').value = currentUser.mobile || '';
        document.getElementById('edit-sid').value = currentUser.student_id || '';
        document.getElementById('modal-settings').classList.remove('hidden');
    }

    window.updateProfile = async function() {
        const fname = document.getElementById('edit-fname').value.trim();
        const lname = document.getElementById('edit-lname').value.trim();
        const fullName = `${fname} ${lname}`.trim();
        
        if(!fullName) return showToast("Name is required", "error");

        const updates = {
            name: fullName,
            mobile: document.getElementById('edit-mobile').value,
            class_name: document.getElementById('edit-class').value,
            gender: document.getElementById('edit-gender').value
        };

        const { error } = await supabaseClient.from('users').update(updates).eq('id', currentUser.id);

        if(error) showToast("Error updating profile", "error");
        else {
            Object.assign(currentUser, updates);
            updateHeaderUI();
            window.closeModal('modal-settings');
            showToast("Profile Updated!", "success");
        }
    }

    // --- UTILS ---
    window.loadRegistrationHistory = async function() {
        const container = document.getElementById('history-list');
        const { data: regs } = await supabaseClient.from('registrations').select(`id, sport_id, sports(name, icon, type)`).eq('user_id', currentUser.id);
        if(!regs || regs.length === 0) { container.innerHTML = '<p class="text-center text-gray-500 text-xs py-10">No registrations found.</p>'; return; }
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

    window.loadProfileGames = function() {
        window.loadRegistrationHistory(); // Reuse for profile tab
    }

    async function getSportIdByName(name) {
        const s = allSportsList.find(sp => sp.name === name);
        return s ? s.id : null;
    }

    function setupRealtimeSubscription() {
        supabaseClient.channel('public:matches').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
            if(window.loadLiveMatches) window.loadLiveMatches();
        }).subscribe();
    }

    window.promptDeleteTeam = function(id) { if(confirm('Delete Team?')) supabaseClient.from('teams').delete().eq('id', id).then(() => window.loadTeamLocker()); }
    window.leaveTeam = function(id) { if(confirm('Leave Team?')) supabaseClient.from('team_members').delete().eq('id', id).then(() => window.loadTeamLocker()); }

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

    function setupConfirmModal() { /* Setup if needed */ }
    function injectToastContainer() {
        if(!document.getElementById('toast-container')) {
            const div = document.createElement('div');
            div.id = 'toast-container';
            div.className = 'fixed bottom-24 left-1/2 transform -translate-x-1/2 z-[70] transition-all duration-300 opacity-0 pointer-events-none translate-y-10';
            document.body.appendChild(div);
        }
    }

    // Match Details
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
        document.getElementById('modal-match-details').classList.remove('hidden');
    }

})();
