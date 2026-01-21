import { supabase } from './supabase.js';

// --- CONFIGURATION ---
const FIX_NUMBER = 5489;
let currentUser = null;
let myRegistrations = []; 
let myTeams = []; 
let currentManageTeamId = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');

    if (!urlId) return showError('Access Denied', 'No Student ID Provided');

    const studentId = parseInt(urlId) - FIX_NUMBER;
    await authenticateUser(studentId);
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
        
        // Show App
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');

    } catch (err) {
        showError('Unauthorized', err.message);
    }
}

// --- DATA REFRESH ---
async function refreshData() {
    // 1. My Registrations
    const { data: regs } = await supabase.from('registrations')
        .select('sport_id, status, sports(id, name, type, icon, gender_category)')
        .eq('user_id', currentUser.id);
    myRegistrations = regs || [];

    // 2. My Teams
    const { data: teams } = await supabase.from('team_members')
        .select(`
            id, status, team_id, 
            teams (
                id, name, sport_id, team_code, status, captain_id,
                sports (name, team_size)
            )
        `)
        .eq('user_id', currentUser.id);
    myTeams = teams || [];

    // Re-render active view
    renderMyZone();
    renderRegistrationTab();
    renderTeamMarketplace();
}

// --- UI RENDERING ---
function renderHeader() {
    document.getElementById('header-name').textContent = currentUser.name;
    document.getElementById('header-id').textContent = `ID: ${currentUser.student_id}`;
    document.getElementById('badge-class').textContent = currentUser.class_name || 'N/A';
    document.getElementById('badge-category').textContent = currentUser.category;
    
    if (currentUser.avatar_url) {
        document.getElementById('header-avatar').src = currentUser.avatar_url;
    }
}

// 1. MY ZONE (Dashboard)
function renderMyZone() {
    // A. My Squads
    const squadsContainer = document.getElementById('my-teams-list');
    squadsContainer.innerHTML = '';
    
    if (myTeams.length === 0) {
        squadsContainer.innerHTML = '<p class="text-xs text-gray-500 italic">No teams joined yet.</p>';
    } else {
        myTeams.forEach(mt => {
            const isCaptain = mt.teams.captain_id === currentUser.id;
            const action = isCaptain 
                ? `<button onclick="openManageModal('${mt.team_id}')" class="mt-3 w-full py-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 rounded-lg text-xs font-bold hover:bg-yellow-500 hover:text-black transition-colors">Manage Squad</button>` 
                : `<div class="mt-2 text-[10px] text-gray-400 flex items-center gap-2"><div class="w-2 h-2 rounded-full ${mt.status === 'Accepted' ? 'bg-green-500' : 'bg-yellow-500'}"></div> Status: ${mt.status}</div>`;

            squadsContainer.innerHTML += `
                <div class="glass-panel p-4 rounded-xl border border-white/5">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold text-white text-sm">${mt.teams.name}</h4>
                            <p class="text-xs text-gray-400 font-mono mt-0.5">${mt.teams.team_code}</p>
                        </div>
                        <span class="px-2 py-1 rounded bg-white/5 text-[10px] font-bold text-gray-300 border border-white/10">${mt.teams.sports.name}</span>
                    </div>
                    ${action}
                </div>
            `;
        });
    }

    // B. Individual Registrations
    const regContainer = document.getElementById('my-regs-list');
    regContainer.innerHTML = '';
    
    if (myRegistrations.length === 0) {
        regContainer.innerHTML = '<p class="text-xs text-gray-500 italic">No individual events registered.</p>';
    } else {
        myRegistrations.forEach(r => {
            regContainer.innerHTML += `
                <div class="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                    <div class="flex items-center gap-3">
                         <i data-lucide="${r.sports.icon || 'trophy'}" class="w-4 h-4 text-gray-500"></i>
                         <span class="text-sm text-gray-300 font-medium">${r.sports.name}</span>
                    </div>
                    <button onclick="handleWithdraw(${r.sport_id})" class="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider border border-red-900/50 px-2 py-1 rounded hover:bg-red-900/20 transition-colors">Withdraw</button>
                </div>
            `;
        });
    }
    lucide.createIcons();
}

// 2. REGISTRATION (Sports List)
async function renderRegistrationTab() {
    const { data: sports } = await supabase.from('sports').select('*').eq('status', 'Open').order('name');
    const container = document.getElementById('sports-list');
    container.innerHTML = '';

    sports.forEach(s => {
        const isReg = myRegistrations.some(r => r.sport_id === s.id);
        const btn = isReg 
            ? `<button disabled class="px-4 py-2 bg-green-500/10 text-green-500 border border-green-500/30 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-2"><i data-lucide="check" class="w-3 h-3"></i> Joined</button>`
            : `<button onclick="handleIndividualReg(${s.id}, '${s.name}')" class="px-4 py-2 bg-white/5 text-white border border-white/20 hover:bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors">Register</button>`;

        container.innerHTML += `
            <div class="glass-panel p-4 rounded-xl flex items-center justify-between group hover:border-white/10 transition-colors">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center border border-white/5 group-hover:border-yellow-500/50 transition-colors">
                        <i data-lucide="${s.icon || 'activity'}" class="w-5 h-5 text-gray-400 group-hover:text-yellow-500"></i>
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

// 3. TEAM MARKETPLACE
async function renderTeamMarketplace() {
    const container = document.getElementById('team-marketplace');
    container.innerHTML = '<p class="text-center text-gray-500 text-xs animate-pulse">Scanning for open squads...</p>';

    // Fetch Open Teams
    const { data: openTeams } = await supabase
        .from('teams')
        .select(`
            id, name, status, team_code, sport_id,
            sports (name, gender_category, team_size),
            captain:users (class_name, gender)
        `)
        .eq('status', 'Open');

    if (!openTeams || openTeams.length === 0) {
        container.innerHTML = '<div class="text-center py-6 glass-panel rounded-xl"><p class="text-gray-500 text-xs">No open squads found.</p></div>';
        return;
    }

    // Get current member counts
    const { data: counts } = await supabase.from('team_members').select('team_id');
    
    container.innerHTML = '';
    
    openTeams.forEach(t => {
        // Filter: Gender & Category
        if (t.sports.gender_category !== 'Mixed' && t.captain.gender !== currentUser.gender) return;
        const capCat = ['FYJC', 'SYJC'].includes(t.captain.class_name) ? 'Junior' : 'Senior';
        if (capCat !== currentUser.category) return;

        // Status Logic
        const memberCount = counts.filter(c => c.team_id === t.id).length;
        const isFull = memberCount >= t.sports.team_size;
        const inTeam = myTeams.some(mt => mt.team_id === t.id);
        const hasReg = myRegistrations.some(r => r.sport_id === t.sport_id);

        let btn = '';
        if (inTeam) btn = `<span class="text-[10px] font-bold text-green-500 border border-green-500/30 px-2 py-1 rounded">Joined</span>`;
        else if (isFull) btn = `<span class="text-[10px] font-bold text-red-500 border border-red-500/30 px-2 py-1 rounded">Full</span>`;
        else if (!hasReg) btn = `<button onclick="showToast('Register individually first!', 'error')" class="text-[10px] font-bold text-gray-500 border border-gray-600 px-2 py-1 rounded opacity-50 cursor-not-allowed">Locked</button>`;
        else btn = `<button onclick="joinTeam('${t.id}')" class="text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded transition-colors shadow-lg shadow-blue-900/50">Join</button>`;

        container.innerHTML += `
            <div class="glass-panel p-3 rounded-xl flex justify-between items-center">
                <div>
                    <h4 class="font-bold text-white text-sm">${t.name}</h4>
                    <p class="text-[10px] text-gray-400 mt-0.5">${t.sports.name} • <span class="${isFull ? 'text-red-400' : 'text-green-400'}">${memberCount}/${t.sports.team_size}</span></p>
                </div>
                ${btn}
            </div>
        `;
    });
}

// --- ACTIONS ---

window.handleIndividualReg = async (sportId, name) => {
    // Basic Profile Check
    if (!currentUser.mobile) return showToast('Error: Missing mobile number.', 'error');

    try {
        const { error } = await supabase.from('registrations').insert({ user_id: currentUser.id, sport_id: sportId });
        if (error) throw error;
        showToast(`Registered for ${name}!`);
        await refreshData();
    } catch (err) {
        showToast('Registration failed.', 'error');
    }
};

window.openCreateTeamModal = () => {
    const select = document.getElementById('create-team-sport-select');
    select.innerHTML = '<option value="">Select Sport...</option>';
    
    // Filter eligible sports (Team Type + Registered + Not in Team)
    const eligible = myRegistrations.filter(r => {
        const isTeam = r.sports.type === 'Team';
        const inTeam = myTeams.some(t => t.teams.sport_id === r.sport_id);
        return isTeam && !inTeam;
    });

    if (eligible.length === 0) return showToast('No eligible sports. Register first!', 'error');

    eligible.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.sport_id;
        opt.text = r.sports.name;
        select.appendChild(opt);
    });

    document.getElementById('modal-create-team').classList.remove('hidden');
    document.getElementById('modal-create-team').classList.add('flex');
};

window.handleCreateTeam = async () => {
    const sportId = document.getElementById('create-team-sport-select').value;
    const name = document.getElementById('create-team-name').value;
    
    if(!sportId || !name) return showToast('Please fill all fields', 'error');

    // Generate Code
    const code = name.substring(0,3).toUpperCase() + Math.floor(Math.random()*9000 + 1000);

    try {
        // Create Team
        const { data: team, error: tErr } = await supabase.from('teams').insert({
            name: name, sport_id: sportId, captain_id: currentUser.id, team_code: code
        }).select().single();
        if (tErr) throw tErr;

        // Add Captain
        const { error: mErr } = await supabase.from('team_members').insert({
            team_id: team.id, user_id: currentUser.id, status: 'Accepted'
        });
        if (mErr) throw mErr;

        showToast('Squad Created!');
        closeModal('modal-create-team');
        await refreshData();
    } catch (err) {
        showToast('Error creating team', 'error');
    }
};

window.joinTeam = async (teamId) => {
    try {
        const { error } = await supabase.from('team_members').insert({
            team_id: teamId, user_id: currentUser.id, status: 'Pending'
        });
        if (error) throw error;
        showToast('Request Sent!');
        await refreshData();
    } catch (err) {
        showToast('Could not join.', 'error');
    }
};

window.openManageModal = async (teamId) => {
    currentManageTeamId = teamId;
    const modal = document.getElementById('modal-manage-team');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const team = myTeams.find(t => t.team_id === teamId).teams;
    document.getElementById('manage-team-name').innerText = team.name;
    document.getElementById('manage-team-code').innerText = team.team_code;

    // Fetch Members
    const { data: members } = await supabase.from('team_members')
        .select('id, status, user_id, users(name, class_name)')
        .eq('team_id', teamId);

    const pendingDiv = document.getElementById('manage-pending-list');
    const rosterDiv = document.getElementById('manage-roster-list');
    pendingDiv.innerHTML = '';
    rosterDiv.innerHTML = '';

    members.forEach(m => {
        if (m.status === 'Pending') {
            pendingDiv.innerHTML += `
                <div class="glass-panel p-2 rounded flex justify-between items-center bg-white/5">
                    <span class="text-xs text-gray-300">${m.users.name}</span>
                    <div class="flex gap-2">
                        <button onclick="manageMember('${m.id}', 'Accepted')" class="text-green-500"><i data-lucide="check" class="w-4 h-4"></i></button>
                        <button onclick="manageMember('${m.id}', 'DELETE')" class="text-red-500"><i data-lucide="x" class="w-4 h-4"></i></button>
                    </div>
                </div>
            `;
        } else {
            const isCap = m.user_id === currentUser.id;
            rosterDiv.innerHTML += `
                <div class="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                    <span class="text-xs text-gray-400">${m.users.name} ${isCap ? '(C)' : ''}</span>
                    ${!isCap && team.status === 'Open' ? `<button onclick="manageMember('${m.id}', 'DELETE')" class="text-red-500"><i data-lucide="trash-2" class="w-3 h-3"></i></button>` : ''}
                </div>
            `;
        }
    });

    const lockBtn = document.getElementById('btn-lock-team');
    if (team.status === 'Locked') {
        lockBtn.disabled = true;
        lockBtn.innerHTML = '<i data-lucide="lock" class="w-4 h-4 inline mr-2"></i> Squad Finalized';
        lockBtn.className = "w-full py-3 bg-white/5 text-gray-500 rounded-xl font-bold text-sm cursor-not-allowed";
    } else {
        lockBtn.disabled = false;
        lockBtn.innerHTML = '<i data-lucide="lock" class="w-4 h-4 inline mr-2"></i> Finalize Squad';
        lockBtn.className = "w-full py-3 bg-red-500/10 text-red-500 border border-red-500/30 rounded-xl font-bold text-sm hover:bg-red-500 hover:text-white transition-all";
    }
    lucide.createIcons();
};

window.manageMember = async (id, action) => {
    if (action === 'DELETE') {
        if(!confirm('Remove player?')) return;
        await supabase.from('team_members').delete().eq('id', id);
    } else {
        await supabase.from('team_members').update({ status: action }).eq('id', id);
    }
    openManageModal(currentManageTeamId); // Refresh
};

window.handleLockTeam = async () => {
    if(!confirm('Finalize squad? This cannot be undone.')) return;
    await supabase.from('teams').update({ status: 'Locked' }).eq('id', currentManageTeamId);
    showToast('Squad Locked!');
    closeModal('modal-manage-team');
    await refreshData();
};

window.handleWithdraw = async (sportId) => {
    // Check lock status
    const teamInfo = myTeams.find(t => t.teams.sport_id === sportId);
    if (teamInfo && teamInfo.teams.status === 'Locked') return showToast('Cannot withdraw: Team is Locked', 'error');

    if(!confirm('Withdraw from this sport?')) return;

    if (teamInfo) await supabase.from('team_members').delete().eq('id', teamInfo.id);
    await supabase.from('registrations').delete().eq('user_id', currentUser.id).eq('sport_id', sportId);
    
    showToast('Withdrawn.');
    await refreshData();
};

// --- UTILS ---
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

function showError(title, msg) {
    document.body.innerHTML = `<div class="h-screen flex flex-col items-center justify-center text-center bg-[#0f172a] text-white p-4"><h1 class="text-2xl font-bold text-red-500 mb-2">${title}</h1><p class="text-sm text-gray-400">${msg}</p></div>`;
}

function showToast(msg, type='success') {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    document.getElementById('toast-icon').className = type === 'error' ? 'w-5 h-5 text-red-500' : 'w-5 h-5 text-green-500';
    t.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => t.classList.add('opacity-0', 'translate-y-10'), 3000);
}
