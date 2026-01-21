import { supabase } from './supabase.js';

// --- CONFIG ---
const FIX_NUMBER = 5489;
let currentUser = null;
let myRegistrations = []; 
let myTeams = []; 
let allSports = [];
let allMatches = [];
let marketplaceTeams = []; // Cache for filtering

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');

    if (!urlId) return showError('Access Denied', 'No Student ID Provided');

    const studentId = parseInt(urlId) - FIX_NUMBER;
    await authenticateUser(studentId);
    
    // Attach Filter Listeners
    document.getElementById('team-search').addEventListener('input', filterTeams);
    document.getElementById('team-filter-sport').addEventListener('change', filterTeams);
});

// --- AUTH ---
async function authenticateUser(studentId) {
    try {
        const { data, error } = await supabase.from('users').select('*').eq('student_id', studentId.toString()).single();
        if (error || !data) throw new Error('Student not found in OJAS database');
        currentUser = data;
        
        // Category Logic
        const juniorClasses = ['FYJC', 'SYJC'];
        currentUser.category = juniorClasses.includes(currentUser.class_name) ? 'Junior' : 'Senior';

        renderHeader();
        await refreshData();
        await loadSchedule();
        
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');

    } catch (err) {
        showError('Unauthorized', err.message);
    }
}

// --- DATA FETCHING ---
async function refreshData() {
    // 1. All Sports
    const { data: sports } = await supabase.from('sports').select('*').order('name');
    allSports = sports || [];

    // 2. My Registrations
    const { data: regs } = await supabase.from('registrations').select('sport_id, status').eq('user_id', currentUser.id);
    myRegistrations = regs || [];
    document.getElementById('reg-count-display').textContent = `${myRegistrations.length} Events Joined`;

    // 3. My Teams
    const { data: teams } = await supabase.from('team_members')
        .select(`id, status, team_id, teams (id, name, team_code, status, captain_id, sport_id)`)
        .eq('user_id', currentUser.id);
    myTeams = teams || [];

    renderSportsList();
    renderMyTeamsList();
    loadTeamMarketplace(); // Also populates filter dropdown
}

async function loadSchedule() {
    // Mock Matches table structure check - assuming 'matches' table exists based on previous prompt
    // Join with sports and team names
    const { data: matches } = await supabase
        .from('matches')
        .select(`
            id, start_time, status, team1_name, team2_name, score1, score2, round_name, location,
            sports (name, icon)
        `)
        .order('start_time', { ascending: true });
    
    allMatches = matches || [];
    renderSchedule('upcoming');
}

// --- VIEW 1: SPORTS REGISTRATION ---
function renderSportsList() {
    const container = document.getElementById('sports-list');
    container.innerHTML = '';

    allSports.forEach(s => {
        if(s.status === 'Closed') return;

        const isReg = myRegistrations.some(r => r.sport_id === s.id);
        const btn = isReg 
            ? `<button disabled class="px-4 py-2 bg-green-500/10 text-green-500 border border-green-500/30 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2"><i data-lucide="check" class="w-3 h-3"></i> Joined</button>`
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
    lucide.createIcons();
}

window.openRegConfirm = (sportId) => {
    const sport = allSports.find(s => s.id === sportId);
    
    // Populate Modal
    document.getElementById('conf-avatar').src = currentUser.avatar_url || 'https://via.placeholder.com/100';
    document.getElementById('conf-name').innerText = currentUser.name;
    document.getElementById('conf-id').innerText = `ID: ${currentUser.student_id}`;
    
    document.getElementById('conf-sport-name').innerText = sport.name;
    document.getElementById('conf-sport-type').innerText = sport.type;
    document.getElementById('conf-sport-desc').innerText = sport.description || "No description available.";
    document.getElementById('conf-sport-rules').innerText = sport.rules ? sport.rules.substring(0, 100) + '...' : "Standard rules apply.";

    // Wire Button
    const btn = document.getElementById('btn-final-confirm');
    btn.onclick = () => handleIndividualReg(sportId);
    
    const modal = document.getElementById('modal-reg-confirm');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.handleIndividualReg = async (sportId) => {
    if (!currentUser.mobile) return showToast('Error: Update profile mobile first.', 'error');

    try {
        const btn = document.getElementById('btn-final-confirm');
        btn.innerText = "Registering...";
        btn.disabled = true;

        const { error } = await supabase.from('registrations').insert({ user_id: currentUser.id, sport_id: sportId });
        if (error) throw error;
        
        showToast('Registration Successful!');
        closeModal('modal-reg-confirm');
        await refreshData();
    } catch (err) {
        showToast('Registration failed.', 'error');
    } finally {
        const btn = document.getElementById('btn-final-confirm');
        btn.innerText = "Confirm Registration";
        btn.disabled = false;
    }
};

// --- VIEW 2: TEAM HUB & MARKETPLACE ---
function renderMyTeamsList() {
    const container = document.getElementById('my-teams-list');
    const wrapper = document.getElementById('my-teams-container');
    container.innerHTML = '';
    
    if (myTeams.length > 0) {
        wrapper.classList.remove('hidden');
        myTeams.forEach(mt => {
            const isCap = mt.teams.captain_id === currentUser.id;
            // Find sport name manually since join query might be shallow
            const sport = allSports.find(s => s.id === mt.teams.sport_id);
            
            container.innerHTML += `
                <div class="bg-black/40 p-3 rounded-lg border border-white/5 flex justify-between items-center">
                    <div>
                        <h5 class="text-xs font-bold text-white">${mt.teams.name}</h5>
                        <p class="text-[10px] text-yellow-500 font-mono">${mt.teams.team_code}</p>
                    </div>
                    <span class="text-[10px] text-gray-400 bg-white/5 px-2 py-1 rounded">${sport ? sport.name : 'Unknown'}</span>
                </div>
            `;
        });
    } else {
        wrapper.classList.add('hidden');
    }
}

async function loadTeamMarketplace() {
    // Fetch Open Teams
    const { data: openTeams } = await supabase
        .from('teams')
        .select(`
            id, name, status, team_code, sport_id,
            captain:users (class_name, gender)
        `)
        .eq('status', 'Open');
    
    // Store globally for filtering
    marketplaceTeams = openTeams || [];
    
    // Populate Filter Dropdown
    const sportSelect = document.getElementById('team-filter-sport');
    sportSelect.innerHTML = '<option value="all">All Sports</option>';
    const teamSportIds = [...new Set(marketplaceTeams.map(t => t.sport_id))];
    teamSportIds.forEach(sid => {
        const s = allSports.find(sp => sp.id === sid);
        if(s) sportSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });

    filterTeams(); // Initial Render
}

function filterTeams() {
    const container = document.getElementById('team-marketplace');
    const search = document.getElementById('team-search').value.toLowerCase();
    const sportFilter = document.getElementById('team-filter-sport').value;

    container.innerHTML = '';

    const filtered = marketplaceTeams.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(search) || t.team_code.toLowerCase().includes(search);
        const matchesSport = sportFilter === 'all' || t.sport_id.toString() === sportFilter;
        
        // Strict Logic Checks
        const sport = allSports.find(s => s.id === t.sport_id);
        const isGenderMatch = sport.gender_category === 'Mixed' || t.captain.gender === currentUser.gender;
        const capCat = ['FYJC', 'SYJC'].includes(t.captain.class_name) ? 'Junior' : 'Senior';
        const isCatMatch = capCat === currentUser.category;

        return matchesSearch && matchesSport && isGenderMatch && isCatMatch;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 text-xs py-4">No matching squads found.</p>';
        return;
    }

    filtered.forEach(t => {
        const sport = allSports.find(s => s.id === t.sport_id);
        const inTeam = myTeams.some(mt => mt.team_id === t.id);
        const hasReg = myRegistrations.some(r => r.sport_id === t.sport_id);
        
        let action = '';
        if (inTeam) action = `<span class="text-[10px] text-green-500 border border-green-500/30 px-2 py-1 rounded">Joined</span>`;
        else if (!hasReg) action = `<span class="text-[10px] text-gray-500 border border-gray-600 px-2 py-1 rounded">Register First</span>`;
        else action = `<button onclick="joinTeam('${t.id}')" class="text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded">Join</button>`;

        container.innerHTML += `
            <div class="glass-panel p-3 rounded-xl flex justify-between items-center">
                <div>
                    <h4 class="font-bold text-white text-sm">${t.name}</h4>
                    <p class="text-[10px] text-gray-400 mt-0.5">${sport.name} • ${t.team_code}</p>
                </div>
                ${action}
            </div>
        `;
    });
}

// --- CREATE TEAM LOGIC ---
window.openCreateTeamModal = () => {
    const select = document.getElementById('create-team-sport-select');
    select.innerHTML = '<option value="">Select Sport...</option>';
    
    // Logic: Only Team sports, Registered, Not already in team
    const eligible = myRegistrations.filter(r => {
        const sport = allSports.find(s => s.id === r.sport_id);
        const isTeamSport = sport.type === 'Team';
        const inTeam = myTeams.some(t => t.teams.sport_id === r.sport_id);
        return isTeamSport && !inTeam;
    });

    if (eligible.length === 0) return showToast('No eligible sports. Register first!', 'error');

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

    try {
        const { data: team, error } = await supabase.from('teams').insert({
            name, sport_id: sportId, captain_id: currentUser.id, team_code: code
        }).select().single();
        if(error) throw error;

        await supabase.from('team_members').insert({ team_id: team.id, user_id: currentUser.id, status: 'Accepted' });
        
        showToast('Team Created!');
        closeModal('modal-create-team');
        refreshData();
    } catch(err) {
        showToast('Creation failed.', 'error');
    }
};

window.joinTeam = async (teamId) => {
    try {
        const { error } = await supabase.from('team_members').insert({ team_id: teamId, user_id: currentUser.id, status: 'Pending' });
        if(error) throw error;
        showToast('Request Sent!');
        refreshData();
    } catch(err) { showToast('Could not join.', 'error'); }
};

// --- VIEW 3: SCHEDULE ---
window.switchScheduleTab = (type) => {
    document.querySelectorAll('.schedule-tab').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-sched-${type}`).classList.add('active');
    renderSchedule(type);
};

function renderSchedule(type) {
    const container = document.getElementById('schedule-list');
    container.innerHTML = '';
    
    const filtered = allMatches.filter(m => {
        if (type === 'upcoming') return m.status === 'Scheduled' || m.status === 'Live';
        return m.status === 'Completed' || m.status === 'Cancelled';
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 text-xs mt-10">No matches found.</p>';
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
    lucide.createIcons();
}

// --- UTILS ---
function renderHeader() {
    document.getElementById('header-name').textContent = currentUser.name;
    document.getElementById('header-id').textContent = `ID: ${currentUser.student_id}`;
    if(currentUser.avatar_url) document.getElementById('header-avatar').src = currentUser.avatar_url;
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

function showError(t, m) {
    document.body.innerHTML = `<div class="h-screen flex items-center justify-center text-center text-red-500 font-bold">${t}: ${m}</div>`;
}

function showToast(msg, type='success') {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    document.getElementById('toast-icon').className = type==='error'?'w-5 h-5 text-red-500':'w-5 h-5 text-green-500';
    t.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => t.classList.add('opacity-0', 'translate-y-10'), 3000);
}
