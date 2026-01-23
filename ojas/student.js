// ==========================================
// URJA 2026 - STUDENT PORTAL CONTROLLER (GOLD EDITION)
// ==========================================

(function() { // Wrapped in IIFE for safety

    // --- 1. CONFIGURATION & CREDENTIALS ---
    const SUPABASE_URL = 'https://sijmmlhltkksykhbuatn.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_9GjhwaWzz0McozvxVMINyQ_ZFU58z7F';
    const FIX_NUMBER = 5489; // Obfuscation Key

    // Initialize Clients
    if (!window.supabase) {
        console.error("CRITICAL: Supabase SDK not loaded in HTML.");
        return;
    }
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- STATE MANAGEMENT ---
    let currentUser = null;
    let myRegistrations = []; 
    let allSportsList = [];
    let selectedSportForReg = null;

    // Default Fallback
    const DEFAULT_AVATAR = "https://t4.ftcdn.net/jpg/05/89/93/27/360_F_589932782_vQAEAZhHnq1QCGu5ikwrYaQD0Mmurm0N.jpg";

    // --- INITIALIZATION ---
    document.addEventListener('DOMContentLoaded', async () => {
        if(window.lucide) lucide.createIcons();
        initTheme();
        injectToastContainer();
        setupTabSystem();
        setupConfirmModal(); 
        
        // Start Authentication
        await checkAuth();
        
        // Default Tab
        window.switchTab('dashboard');
    });

    // --- THEME LOGIC ---
    function initTheme() {
        document.documentElement.classList.add('dark'); // Force Dark Mode for Gold Theme
    }

    // --- AUTHENTICATION ---
    async function checkAuth() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id');

        if (urlId) {
            const studentId = parseInt(urlId) - FIX_NUMBER;
            const { data: user, error } = await supabaseClient
                .from('users').select('*').eq('student_id', studentId.toString()).single();

            if (!error && user) {
                initializeUserSession(user);
                return;
            }
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            const { data: profile } = await supabaseClient
                .from('users').select('*').eq('id', session.user.id).single();

            if (profile) {
                initializeUserSession(profile);
                return;
            }
        }
        
        // If auth fails, handle gracefully (or redirect)
        // document.getElementById('app').innerHTML = "Access Denied"; 
    }

    async function initializeUserSession(user) {
        currentUser = user;
        updateProfileUI();
        await fetchMyRegistrations();
        
        const loader = document.getElementById('loader');
        if(loader) loader.classList.add('hidden');
        const app = document.getElementById('app');
        if(app) app.classList.remove('hidden');
    }

    function updateProfileUI() {
        if (!currentUser) return;
        const avatarUrl = currentUser.avatar_url || DEFAULT_AVATAR;
        const fullName = currentUser.name || "Unknown Student";
        
        // Update header elements if they exist
        const nameEl = document.getElementById('profile-name');
        if(nameEl) nameEl.innerText = fullName;
    }

    async function fetchMyRegistrations() {
        const { data } = await supabaseClient.from('registrations').select('sport_id').eq('user_id', currentUser.id);
        if(data) myRegistrations = data.map(r => r.sport_id);
    }

    // --- NAVIGATION ---
    function setupTabSystem() {
        window.switchTab = function(tabId) {
            // Hide all views
            document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
            
            // Show target view
            const targetView = document.getElementById('view-' + tabId);
            if(targetView) {
                targetView.classList.remove('hidden');
                targetView.classList.add('animate-slide-up');
            }
            
            // Update Nav Icons
            document.querySelectorAll('.nav-item').forEach(el => {
                el.classList.remove('text-gold');
                el.classList.add('text-gray-500');
            });
            const activeNav = document.getElementById('nav-' + tabId);
            if(activeNav) {
                activeNav.classList.remove('text-gray-500');
                activeNav.classList.add('text-gold');
            }

            if(tabId === 'register') window.toggleRegisterView('new');
            if(tabId === 'teams') window.toggleTeamView('marketplace');
        }
    }

    // --- TEAM MARKETPLACE LOGIC ---
    
    // 1. Toggle Switch (Fixed Logic)
    window.toggleTeamView = function(view) {
        document.getElementById('team-marketplace').classList.add('hidden');
        document.getElementById('team-locker').classList.add('hidden');
        
        // Reset Buttons
        document.getElementById('btn-team-market').classList.remove('active');
        document.getElementById('btn-team-my').classList.remove('active');

        if(view === 'marketplace') {
            document.getElementById('team-marketplace').classList.remove('hidden');
            document.getElementById('btn-team-market').classList.add('active');
            loadTeamSportsFilter().then(() => window.loadTeamMarketplace());
        } else {
            document.getElementById('team-locker').classList.remove('hidden');
            document.getElementById('btn-team-my').classList.add('active');
            window.loadTeamLocker();
        }
    }

    async function loadTeamSportsFilter() {
        const select = document.getElementById('team-sport-filter');
        if (!select || select.children.length > 1) return; // Prevent duplicate load

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

        let query = supabaseClient
            .from('teams')
            .select(`*, sports (name, team_size), users!captain_id (name, gender)`)
            .eq('status', 'Open')
            .order('created_at', { ascending: false });

        if(filterVal !== 'all') query = query.eq('sport_id', filterVal);

        const { data: teams, error } = await query;

        if (error || !teams || teams.length === 0) {
             container.innerHTML = '<p class="text-center text-gray-400 py-10">No open teams available.</p>';
             return;
        }

        // Calculate seats left
        const teamPromises = teams.map(async (t) => {
            const { count } = await supabaseClient.from('team_members')
                .select('*', { count: 'exact', head: true })
                .eq('team_id', t.id).eq('status', 'Accepted');
            return { ...t, seatsLeft: Math.max(0, (t.sports?.team_size || 5) - (count || 0)) };
        });

        const teamsWithCounts = await Promise.all(teamPromises);

        const validTeams = teamsWithCounts.filter(t => {
            if (searchText && !t.name.toLowerCase().includes(searchText)) return false;
            // Gender Filter: Only show teams matching user's gender
            if (t.users?.gender !== currentUser.gender) return false; 
            return true;
        });

        if (validTeams.length === 0) {
             container.innerHTML = '<p class="text-center text-gray-400 py-10">No matching teams found.</p>';
             return;
        }

        // Render Cards (Updated for Gold Theme)
        container.innerHTML = validTeams.map(t => {
            const isFull = t.seatsLeft <= 0;
            const btnText = isFull ? "Full Squad" : "View Squad & Join";
            
            // New Card Design
            return `
            <div class="card-item animate-slide-up">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <span class="text-[10px] font-bold text-gold border border-yellow-700/50 px-2 py-0.5 rounded uppercase">${t.sports.name}</span>
                        <h4 class="font-bold text-lg text-white mt-2">${t.name}</h4>
                        <p class="text-xs text-gray-400">Capt: ${t.users?.name || 'Unknown'}</p>
                    </div>
                    <div class="text-center bg-gray-800 p-2 rounded-lg">
                        <span class="block text-xl font-black ${isFull ? 'text-gray-500' : 'text-gold'}">${t.seatsLeft}</span>
                        <span class="text-[8px] text-gray-400 uppercase font-bold">Seats</span>
                    </div>
                </div>
                <button onclick="window.viewSquadAndJoin('${t.id}', '${t.sports.name}', ${t.seatsLeft})" 
                    class="btn-primary" ${isFull ? 'disabled style="filter:grayscale(1); opacity:0.5"' : ''}>
                    ${isFull ? '<i data-lucide="lock" class="w-4 h-4"></i>' : '<i data-lucide="users" class="w-4 h-4"></i>'} ${btnText}
                </button>
            </div>`;
        }).join('');
        lucide.createIcons();
    }

    // --- SQUAD & JOIN MODAL (Updated Mobile UI) ---
    window.viewSquadAndJoin = async function(teamId, sportName, seatsLeft) {
        if(seatsLeft <= 0) return showToast("❌ This team is full!", "error");

        // 1. Check if user is registered for the sport individually
        const sportId = await getSportIdByName(sportName);
        if(!myRegistrations.includes(sportId)) {
            return showToast(`⚠️ Register for ${sportName} individually first!`, "error");
        }

        // 2. Check if user is already in a team for this sport
        const { data: existingTeam } = await supabaseClient.from('team_members')
            .select('team_id, teams!inner(sport_id)')
            .eq('user_id', currentUser.id).eq('teams.sport_id', sportId);
        
        if(existingTeam && existingTeam.length > 0) {
            return showToast(`❌ You are already in a team for ${sportName}.`, "error");
        }

        // 3. Fetch Squad
        const { data: members, error } = await supabaseClient.from('team_members')
            .select('status, users(name, class_name)')
            .eq('team_id', teamId).eq('status', 'Accepted');

        if (error) return showToast("Error loading squad", "error");

        // 4. Populate Modal
        const modal = document.getElementById('modal-view-squad');
        const listContainer = document.getElementById('view-squad-list'); // Ensure this ID exists in HTML
        
        // Inject Header
        document.getElementById('squad-modal-title').innerHTML = `Team Roster <span class="text-gold block text-xs font-normal mt-1">${sportName}</span>`;

        // Inject List (Scrollable)
        listContainer.innerHTML = members.map(m => `
            <div class="squad-item">
                <div>
                    <span class="text-sm font-bold text-white block">${m.users.name}</span>
                    <span class="text-[10px] text-gray-400 font-mono">${m.users.class_name || 'N/A'}</span>
                </div>
                <div class="w-2 h-2 rounded-full bg-green-500"></div>
            </div>
        `).join('');

        // Inject Footer Button
        const footerBtn = document.getElementById('btn-confirm-join');
        footerBtn.innerHTML = `Send Join Request <i data-lucide="send" class="w-4 h-4 ml-1"></i>`;
        footerBtn.onclick = () => sendJoinRequest(teamId);

        // Open Modal (Add 'open' class for CSS transition)
        modal.classList.add('open');
        lucide.createIcons();
    }

    async function sendJoinRequest(teamId) {
        const { error } = await supabaseClient.from('team_members')
            .insert({ team_id: teamId, user_id: currentUser.id, status: 'Pending' });
        
        if(error) showToast("Error: " + error.message, "error");
        else {
            showToast("Request Sent to Captain!", "success");
            window.closeModal('modal-view-squad');
        }
    }

    // --- REGISTRATION LOGIC ---
    
    // Toggle Switch (Fixed Logic)
    window.toggleRegisterView = function(view) {
        document.getElementById('reg-section-new').classList.add('hidden');
        document.getElementById('reg-section-history').classList.add('hidden');
        
        document.getElementById('btn-reg-new').classList.remove('active');
        document.getElementById('btn-reg-history').classList.remove('active');
        
        if(view === 'new') {
            document.getElementById('reg-section-new').classList.remove('hidden');
            document.getElementById('btn-reg-new').classList.add('active');
            window.loadSportsDirectory();
        } else {
            document.getElementById('reg-section-history').classList.remove('hidden');
            document.getElementById('btn-reg-history').classList.add('active');
            window.loadRegistrationHistory('history-list');
        }
    }

    window.loadSportsDirectory = async function() {
        const container = document.getElementById('sports-list');
        if(container.children.length > 0 && allSportsList.length > 0) return;

        container.innerHTML = '<div class="col-span-2 text-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto"></div></div>';

        const { data: sports } = await supabaseClient.from('sports').select('*').eq('status', 'Open').order('name');
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
                ? "bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed" 
                : "bg-white text-black hover:bg-gray-200";
            
            return `
            <div class="card-item flex flex-col justify-between h-40">
                <div>
                    <div class="flex justify-between items-start">
                        <div class="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-gold">
                            <i data-lucide="${s.icon || 'trophy'}" class="w-4 h-4"></i>
                        </div>
                        <span class="text-[9px] uppercase font-bold text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded">${s.type}</span>
                    </div>
                    <h4 class="font-bold text-md text-white mt-3">${s.name}</h4>
                </div>

                <button onclick="${isReg ? '' : `window.openRegistrationModal('${s.id}')`}" 
                    class="w-full py-2.5 rounded-lg text-xs font-bold transition-all ${btnClass}" ${isReg ? 'disabled' : ''}>
                    ${isReg ? 'Registered' : 'Register Now'}
                </button>
            </div>`;
        }).join('');
        lucide.createIcons();
    }

    // --- CONFIRM ENTRY MODAL (Mobile Bottom Sheet) ---
    window.openRegistrationModal = async function(id) {
        const { data: sport } = await supabaseClient.from('sports').select('*').eq('id', id).single();
        if(!sport) return;

        selectedSportForReg = sport; 
        
        // Populate Modal Fields (Ensure these IDs exist in HTML)
        document.getElementById('reg-modal-sport-name').innerText = sport.name;
        document.getElementById('reg-desc').innerText = sport.description || 'No description available.';
        
        // Open Modal (Add 'open' class)
        document.getElementById('modal-register').classList.add('open');
    }

    window.confirmRegistration = async function() {
        const btn = document.getElementById('btn-confirm-reg'); // Ensure ID exists
        const originalText = btn ? btn.innerText : 'Confirm';
        if(btn) btn.innerText = "Processing...";

        const mobileInput = document.getElementById('reg-mobile').value;
        if(!mobileInput) {
            showToast("⚠️ Mobile number required!", "error");
            if(btn) btn.innerText = originalText;
            return;
        }

        // Update Mobile if needed
        if (mobileInput !== currentUser.mobile) {
            await supabaseClient.from('users').update({ mobile: mobileInput }).eq('id', currentUser.id);
            currentUser.mobile = mobileInput;
        }

        const { error } = await supabaseClient.from('registrations').insert({
            user_id: currentUser.id,
            sport_id: selectedSportForReg.id
        });

        if(error) {
            showToast(error.message, "error");
            if(btn) btn.innerText = originalText;
        } else {
            if (!myRegistrations.includes(selectedSportForReg.id)) myRegistrations.push(selectedSportForReg.id);
            
            showToast("Success! You are in.", "success");
            window.closeModal('modal-register');
            renderSportsList(allSportsList); // Refresh list
        }
    }

    // --- HELPER FUNCTIONS ---
    async function getSportIdByName(name) {
        const { data } = await supabaseClient.from('sports').select('id').eq('name', name).single();
        return data?.id;
    }

    // Close Modal Logic (Removes 'open' class)
    window.closeModal = function(id) {
        const el = document.getElementById(id);
        if(el) el.classList.remove('open');
    }

    window.showToast = function(msg, type='info') {
        const t = document.getElementById('toast-container');
        if (!t) return;
        
        t.innerHTML = `
            <div class="glass-panel px-6 py-4 flex items-center gap-3 shadow-2xl border-l-4 ${type === 'error' ? 'border-red-500' : 'border-green-500'}">
                <i data-lucide="${type === 'error' ? 'alert-triangle' : 'check-circle'}" class="w-5 h-5 ${type === 'error' ? 'text-red-400' : 'text-green-400'}"></i>
                <span class="text-sm font-bold text-white">${msg}</span>
            </div>`;
            
        if (window.lucide) lucide.createIcons();
        
        t.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-10');
        setTimeout(() => {
            t.classList.add('opacity-0', 'pointer-events-none', 'translate-y-10');
        }, 3000);
    }

    function injectToastContainer() {
        if(!document.getElementById('toast-container')) {
            const div = document.createElement('div');
            div.id = 'toast-container';
            div.className = 'fixed bottom-24 left-1/2 transform -translate-x-1/2 transition-all duration-300 opacity-0 pointer-events-none translate-y-10 w-11/12 max-w-sm';
            document.body.appendChild(div);
        }
    }

    // Setup Standard Confirm Modal (Delete/Withdraw)
    function setupConfirmModal() {
        // Standard confirm modal logic logic...
    }

})();
