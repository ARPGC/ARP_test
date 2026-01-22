import { supabase } from './supabase.js';

// --- CONFIGURATION ---
const FIX_NUMBER = 5489;
let currentUser = null;
let myRegistrations = []; 
let myTeams = []; 
let allSports = [];
let marketplaceTeams = [];
let allMatches = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');

    if (!urlId) return showError('Access Denied', 'No Student ID Provided');

    const studentId = parseInt(urlId) - FIX_NUMBER;
    await authenticateUser(studentId);
    
    // Attach Event Listeners
    const searchInput = document.getElementById('team-search');
    const filterSelect = document.getElementById('team-filter-sport');
    
    if(searchInput) searchInput.addEventListener('input', filterTeams);
    if(filterSelect) filterSelect.addEventListener('change', filterTeams);

    // Initial Icon Render (Safe Check)
    renderIcons();
});

// --- AUTHENTICATION ---
async function authenticateUser(studentId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('student_id', studentId.toString())
            .single();

        if (error || !data) throw new Error('Student not found in OJAS database');

        currentUser = data;
        
        // Auto-assign category
        const juniorClasses = ['FYJC', 'SYJC'];
        currentUser.category = juniorClasses.includes(currentUser.class_name) ? 'Junior' : 'Senior';

        renderHeader();
        await refreshData();
        await loadSchedule();
        
        // Enable Realtime Subscription
        setupRealtimeSubscription();

        // Show App
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');

    } catch (err) {
        showError('Unauthorized', err.message);
    }
}

// --- REALTIME UPDATES (INSTANT REFRESH) ---
function setupRealtimeSubscription() {
    const channel = supabase.channel('public:ojas_updates')
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'registrations' }, 
            () => { console.log('Reg update!'); refreshData(); }
        )
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'teams' }, 
            () => { console.log('Team update!'); refreshData(); }
        )
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'team_members' }, 
            () => { console.log('Member update!'); refreshData(); }
        )
        .subscribe();
}

// --- DATA FETCHING ---
async function refreshData() {
    if(!currentUser) return; 

    // 1. All Sports
    const { data: sports } = await supabase.from('sports').select('*').order('name');
    allSports = sports || [];

    // 2. My Registrations
    const { data: regs } = await supabase.from('registrations')
        .select('sport_id, status, sports(id, name, icon)')
        .eq('user_id', currentUser.id);
    myRegistrations = regs || [];
    
    const countDisplay = document.getElementById('reg-count-display');
    if(countDisplay) countDisplay.textContent = `${myRegistrations.length} Joined`;

    // 3. My Teams
    const { data: teams } = await supabase.from('team_members')
        .select(`id, status, team_id, teams (id, name, team_code, status, captain_id, sport_id, sports(name))`)
        .eq('user_id', currentUser.id);
    myTeams = teams || [];

    // Render Views
    renderMyZone();
    renderSportsList();
    loadTeamMarketplace();
}

async function loadSchedule() {
    // Check if matches table exists before crashing
    // For now, we simulate or try fetch
    try {
        const { data: matches, error } = await supabase
            .from('matches')
            .select(`
                id, start_time, status, team1_name, team2_name, score1, score2, round_name, location,
                sports (name, icon)
            `)
            .order('start_time', { ascending: true });
            
        if (!error) {
            allMatches = matches || [];
            renderSchedule('upcoming');
        }
    } catch (e) {
        console.warn("Schedule table not ready yet.");
    }
}

// --- RENDERERS ---

function renderHeader() {
    if(!currentUser) return;
    document.getElementById('header-name').textContent = currentUser.name;
    document.getElementById('header-id').textContent = `ID: ${currentUser.student_id}`;
    if(currentUser.avatar_url) document.getElementById('header-avatar').src = currentUser.avatar_url;
}

function renderMyZone() {
    // A. My Squads
    const squadsContainer = document.getElementById('my-teams-list');
    if (squadsContainer) {
        squadsContainer.innerHTML = '';
        if (myTeams.length === 0) {
            squadsContainer.innerHTML = '<p class="text-xs text-gray-500 italic">No teams joined.</p>';
        } else {
            myTeams.forEach(mt => {
                squadsContainer.innerHTML += `
                    <div class="glass-panel p-3 rounded-xl flex justify-between items-center border border-white/5">
                        <div>
                            <h4 class="font-bold text-white text-sm">${mt.teams.name}</h4>
                            <p class="text-[10px] text-yellow-500 font-mono">${mt.teams.team_code} • ${mt.teams.sports.name}</p>
                        </div>
                        <span class="text-[10px] bg-white/5 px-2 py-1 rounded text-gray-400">${mt.status}</span>
                    </div>
                `;
            });
        }
    }

    // B. Individual Registrations
    const regContainer = document.getElementById('my-regs-list');
    if (regContainer) {
        regContainer.innerHTML = '';
        if (myRegistrations.length === 0) {
            regContainer.innerHTML = '<p class="text-xs text-gray-500 italic">No events joined.</p>';
        } else {
            myRegistrations.forEach(r => {
                regContainer.innerHTML += `
                    <div class="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                        <div class="flex items-center gap-3">
                             <i data-lucide="${r.sports.icon || 'trophy'}" class="w-4 h-4 text-gray-500"></i>
                             <span class="text-xs text-gray-300 font-medium">${r.sports.name}</span>
                        </div>
                        <button onclick="handleWithdraw(${r.sport_id})" class="btn-withdraw">Withdraw</button>
                    </div>
                `;
            });
        }
    }
    renderIcons();
}

function renderSportsList() {
    const container = document.getElementById('sports-list');
    if (!container) return;
    
    container.innerHTML = '';

    allSports.forEach(s => {
        if(s.status === 'Closed') return;
        const isReg = myRegistrations.some(r => r.sport_id === s.id);
        const btn = isReg 
            ? `<button disabled class="px-4 py-2 bg-green-500/10 text-green-500 border border-green-500/30 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 cursor-not-allowed"><i data-lucide="check" class="w-3 h-3"></i> Joined</button>`
            : `<button onclick="openRegConfirm(${s.id})" class="px-4 py-2 bg-white/5 text-white border border-white/20 hover:bg-white/10 rounded-lg text-[10px] font-bold uppercase transition-colors">Register</button>`;

        container.innerHTML += `
            <div class="glass-panel p-4 rounded-xl flex items-center justify-between group hover:border-yellow-500/30 transition-colors">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center border border-white/5">
                        <i data-lucide="${s.icon || 'activity'}" class="w-5 h-5 text-gray-400 group-hover:text-yellow-500 transition-colors"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-white text-sm">${s.name}</h4>
                        <div class="flex gap-2 mt-1">
                            <span class="text-[10px] text-gray-500 font-bold uppercase bg-white/5 px-1.5 rounded">${s.type}</span>
                            <span class="text-[10px] text-gray-500 font-bold uppercase bg-white/5 px-1.5 rounded">${s.gender_category || 'Mixed'}</span>
                        </div>
                    </div>
                </div>
                ${btn}
            </div>
        `;
    });
    renderIcons();
}

async function loadTeamMarketplace() {
    const { data: openTeams } = await supabase
        .from('teams')
        .select(`id, name, status, team_code, sport_id, captain:users (class_name, gender)`)
        .eq('status', 'Open');
    
    marketplaceTeams = openTeams || [];

    // Populate Filter
    const select = document.getElementById('team-filter-sport');
    if (select) {
        select.innerHTML = '<option value="all">All Sports</option>';
        const uniqueSports = [...new Set(marketplaceTeams.map(t => t.sport_id))];
        uniqueSports.forEach(sid => {
            const s = allSports.find(sp => sp.id === sid);
            if(s) select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    }

    filterTeams();
}

function filterTeams() {
    const container = document.getElementById('team-marketplace');
    const searchEl = document.getElementById('team-search');
    const filterEl = document.getElementById('team-filter-sport');
    
    if (!container || !searchEl || !filterEl) return;

    const search = searchEl.value.toLowerCase();
    const filter = filterEl.value;
    
    container.innerHTML = '';

    const filtered = marketplaceTeams.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(search) || t.team_code.toLowerCase().includes(search);
        const matchesFilter = filter === 'all' || t.sport_id.toString() === filter;
        
        // Strict Logic: Gender & Category
        const sport = allSports.find(s => s.id === t.sport_id);
        const isGender = sport.gender_category === 'Mixed' || t.captain.gender === currentUser.gender;
        const capCat = ['FYJC', 'SYJC'].includes(t.captain.class_name) ? 'Junior' : 'Senior';
        
        return matchesSearch && matchesFilter && isGender && (capCat === currentUser.category);
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-600 text-xs py-4">No matching squads found.</p>';
        return;
    }

    filtered.forEach(t => {
        const sport = allSports.find(s => s.id === t.sport_id);
        const inTeam = myTeams.some(mt => mt.team_id === t.id);
        const hasReg = myRegistrations.some(r => r.sport_id === t.sport_id);
        
        let action = '';
        if (inTeam) action = `<span class="text-[10px] text-green-500 border border-green-500/30 px-2 py-1 rounded">Joined</span>`;
        else if (!hasReg) action = `<button onclick="showToast('Register individually first!', 'error')" class="text-[10px] text-gray-500 border border-gray-600 px-2 py-1 rounded hover:bg-white/5">Register First</button>`;
        else action = `<button onclick="joinTeam('${t.id}')" class="text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded transition-colors shadow-lg shadow-blue-900/50">Join</button>`;

        container.innerHTML += `
            <div class="glass-panel p-3 rounded-xl flex justify-between items-center">
                <div>
                    <h4 class="font-bold text-white text-sm">${t.name}</h4>
                    <p class="text-[10px] text-gray-400 mt-0.5">${sport.name}</p>
                </div>
                ${action}
            </div>
        `;
    });
    renderIcons();
}

function renderSchedule(type) {
    const container = document.getElementById('schedule-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    const filtered = allMatches.filter(m => {
        if (type === 'upcoming') return m.status === 'Scheduled' || m.status === 'Live';
        return m.status === 'Completed' || m.status === 'Cancelled';
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 text-xs mt-10">Matches will be announced soon.</p>';
        return;
    }

    filtered.forEach(m => {
        const isLive = m.status === 'Live';
        const date = new Date(m.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'});
        
        container.innerHTML += `
            <div class="glass-panel p-4 rounded-xl relative overflow-hidden">
                ${isLive ? '<div class="absolute top-0 right-0 px-2 py-0.5 bg-red-600 text-white text-[9px] font-bold">LIVE</div>' : ''}
                
                <div class="flex items-center gap-2 mb-3 opacity-60">
                    <i data-lucide="${m.sports.icon || 'trophy'}" class="w-3 h-3"></i>
                    <span class="text-[10px] uppercase font-bold tracking-wider">${m.sports.name} • ${m.round_name || 'Match'}</span>
                </div>

                <div class="flex justify-between items-center mb-3">
                    <div class="text-center w-1/3">
                        <h4 class="text-xs font-bold text-white truncate">${m.team1_name || 'TBA'}</h4>
                        <p class="text-lg font-black text-yellow-500">${m.score1 || '0'}</p>
                    </div>
                    <div class="text-[10px] text-gray-500 font-mono">VS</div>
                    <div class="text-center w-1/3">
                        <h4 class="text-xs font-bold text-white truncate">${m.team2_name || 'TBA'}</h4>
                        <p class="text-lg font-black text-yellow-500">${m.score2 || '0'}</p>
                    </div>
                </div>

                <div class="flex justify-between items-center border-t border-white/5 pt-2">
                    <span class="text-[10px] text-gray-400 flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i> ${m.location}</span>
                    <span class="text-[10px] text-gray-400">${date}</span>
                </div>
            </div>
        `;
    });
    renderIcons();
}

// --- ACTIONS ---

window.openRegConfirm = (sportId) => {
    const sport = allSports.find(s => s.id === sportId);
    document.getElementById('conf-sport-name').innerText = sport.name;
    document.getElementById('conf-sport-desc').innerText = sport.description || "No description.";
    document.getElementById('conf-sport-rules').innerText = sport.rules ? sport.rules.substring(0, 100) : "Standard rules apply.";
    
    // Wire Avatar
    const avatarEl = document.getElementById('conf-avatar');
    const nameEl = document.getElementById('conf-name');
    if (avatarEl) avatarEl.src = currentUser.avatar_url || 'https://via.placeholder.com/100';
    if (nameEl) nameEl.textContent = currentUser.name;

    const btn = document.getElementById('btn-final-confirm');
    btn.onclick = () => handleIndividualReg(sportId);
    
    const modal = document.getElementById('modal-reg-confirm');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.handleIndividualReg = async (sportId) => {
    if (!currentUser.mobile) return showToast('Error: Update profile mobile first.', 'error');

    const btn = document.getElementById('btn-final-confirm');
    const originalText = btn.innerText;
    btn.innerText = "Registering...";
    btn.disabled = true;

    try {
        const { error } = await supabase.from('registrations').insert({ user_id: currentUser.id, sport_id: sportId });
        if (error) throw error;
        
        showToast('Registration Successful!');
        closeModal('modal-reg-confirm');
        // refreshData handled by Realtime
    } catch (err) {
        showToast('Registration failed.', 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.handleWithdraw = async (sportId) => {
    // Check if in a Locked Team
    const teamEntry = myTeams.find(t => t.teams.sport_id === sportId);
    if (teamEntry && teamEntry.teams.status === 'Locked') {
        return showToast('Cannot withdraw: Team is Locked', 'error');
    }

    if (!confirm("Are you sure? This will remove you from this sport.")) return;

    if (teamEntry) await supabase.from('team_members').delete().eq('id', teamEntry.id);
    await supabase.from('registrations').delete().eq('user_id', currentUser.id).eq('sport_id', sportId);
    
    showToast('Withdrawn.');
    // refreshData handled by Realtime
};

window.openCreateTeamModal = () => {
    const select = document.getElementById('create-team-sport-select');
    select.innerHTML = '<option value="">Select Sport...</option>';
    
    const eligible = myRegistrations.filter(r => {
        const sport = allSports.find(s => s.id === r.sport_id);
        const inTeam = myTeams.some(t => t.teams.sport_id === r.sport_id);
        return sport.type === 'Team' && !inTeam;
    });

    if (eligible.length === 0) return showToast('No eligible sports.', 'error');

    eligible.forEach(r => {
        const s = allSports.find(sp => sp.id === r.sport_id);
        select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });

    document.getElementById('modal-create-team').classList.remove('hidden');
    document.getElementById('modal-create-team').classList.add('flex');
};

window.handleCreateTeam = async () => {
    const sportId = document.getElementById('create-team-sport-select').value;
    const name = document.getElementById('create-team-name').value;
    const code = name.substring(0,3).toUpperCase() + Math.floor(Math.random()*9000+1000);

    if(!sportId || !name) return showToast('Fill all fields', 'error');

    try {
        const { data: team, error } = await supabase.from('teams').insert({
            name, sport_id: sportId, captain_id: currentUser.id, team_code: code
        }).select().single();
        if(error) throw error;

        await supabase.from('team_members').insert({ team_id: team.id, user_id: currentUser.id, status: 'Accepted' });
        
        showToast('Team Created!');
        closeModal('modal-create-team');
        // refreshData handled by Realtime
    } catch(err) { showToast('Creation failed.', 'error'); }
};

window.joinTeam = async (teamId) => {
    try {
        const { error } = await supabase.from('team_members').insert({ team_id: teamId, user_id: currentUser.id, status: 'Pending' });
        if(error) throw error;
        showToast('Request Sent!');
        // refreshData handled by Realtime
    } catch(err) { showToast('Error joining.', 'error'); }
};

window.switchScheduleTab = (type) => {
    document.querySelectorAll('.schedule-tab').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-sched-${type}`).classList.add('active');
    renderSchedule(type);
};

// --- UTILS ---

// Fix for SVG Error: Safe Icon Rendering
function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

window.switchTab = (id) => {
    document.querySelectorAll('[id^="view-"]').forEach(e => e.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
    document.getElementById(`view-${id}`).classList.remove('hidden');
    document.getElementById(`tab-${id}`).classList.add('active');
};

window.closeModal = (id) => {
    document.getElementById(id).classList.add('hidden');
    document.getElementById(id).classList.remove('flex');
};

window.showToast = (msg, type='success') => {
    const t = document.getElementById('toast');
    const msgEl = document.getElementById('toast-msg');
    const iconEl = document.getElementById('toast-icon');
    
    if(msgEl) msgEl.innerText = msg;
    if(iconEl) iconEl.className = type==='error'?'w-5 h-5 text-red-500':'w-5 h-5 text-green-500';
    
    if(t) {
        t.classList.remove('opacity-0', 'translate-y-10');
        setTimeout(() => t.classList.add('opacity-0', 'translate-y-10'), 3000);
    }
}

function showError(t, m) {
    document.body.innerHTML = `<div class="h-screen flex items-center justify-center text-center text-red-500 font-bold bg-[#0f172a] p-5">${t}: ${m}</div>`;
}
