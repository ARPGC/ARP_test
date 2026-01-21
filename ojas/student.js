import { supabase } from './supabase.js';

// --- CONFIG ---
const FIX_NUMBER = 5489;
let currentUser = null;
let myRegistrations = []; // Array of sport_ids
let myTeams = []; // Array of team objects I belong to
let currentManageTeamId = null;

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');
    if (!urlId) return showError('No ID Provided');
    const studentId = parseInt(urlId) - FIX_NUMBER;
    await authenticateUser(studentId);
});

async function authenticateUser(studentId) {
    try {
        const { data, error } = await supabase.from('users').select('*').eq('student_id', studentId.toString()).single();
        if (error || !data) throw new Error('Student not found');
        currentUser = data;
        
        // Determine Category (Junior/Senior) based on class
        currentUser.category = ['FYJC', 'SYJC'].includes(currentUser.class_name) ? 'Junior' : 'Senior';

        renderHeader();
        await refreshData();
        
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
    } catch (err) {
        alert("Auth Failed: " + err.message);
    }
}

// --- DATA FETCHING ---
async function refreshData() {
    // 1. Fetch My Registrations (Individual)
    const { data: regs } = await supabase.from('registrations').select('sport_id, status, sports(*)').eq('user_id', currentUser.id);
    myRegistrations = regs || [];

    // 2. Fetch My Team Memberships
    const { data: teams } = await supabase.from('team_members')
        .select(`
            status, 
            team_id, 
            teams (
                id, name, sport_id, team_code, status, captain_id,
                sports (name, type, team_size)
            )
        `)
        .eq('user_id', currentUser.id);
    myTeams = teams || [];

    // Render All Views
    renderRegistrationTab();
    renderTeamMarketplace();
    renderMyZone();
}

// --- TAB 1: INDIVIDUAL REGISTRATION ---
async function renderRegistrationTab() {
    const { data: sports } = await supabase.from('sports').select('*').eq('status', 'Open').order('name');
    const container = document.getElementById('sports-list');
    container.innerHTML = '';

    sports.forEach(s => {
        // Check if already registered
        const isReg = myRegistrations.some(r => r.sport_id === s.id);
        
        const btnHtml = isReg 
            ? `<button disabled class="px-6 py-2 bg-green-900/30 text-green-500 border border-green-800 rounded-lg text-xs font-bold uppercase tracking-wider">Registered</button>`
            : `<button onclick="handleIndividualReg(${s.id}, '${s.name}')" class="px-6 py-2 btn-gold rounded-lg text-xs font-bold uppercase tracking-wider shadow-lg shadow-yellow-500/20">Register</button>`;

        container.innerHTML += `
            <div class="glass-panel p-4 rounded-xl flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
                        <i data-lucide="${s.icon || 'trophy'}" class="w-5 h-5 text-gray-400"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-white text-sm">${s.name}</h4>
                        <p class="text-[10px] text-gray-400 uppercase font-bold">${s.type} • ${s.gender_category || 'Mixed'}</p>
                    </div>
                </div>
                ${btnHtml}
            </div>
        `;
    });
    lucide.createIcons();
}

window.handleIndividualReg = async (sportId, sportName) => {
    // 1. Profile Check
    if (!currentUser.mobile || currentUser.mobile.length < 10) {
        return showToast('Please update your mobile number in profile first!', 'error');
    }

    // 2. Insert Registration
    try {
        const { error } = await supabase.from('registrations').insert({
            user_id: currentUser.id,
            sport_id: sportId
        });
        if (error) throw error;
        
        showToast(`Registered for ${sportName}!`);
        await refreshData();
    } catch (err) {
        showToast('Registration failed.', 'error');
    }
};

// --- TAB 2: TEAMS (CREATE & JOIN) ---

// A. Create Team Logic
window.openCreateTeamModal = () => {
    const select = document.getElementById('create-team-sport-select');
    select.innerHTML = '<option value="">Select Sport...</option>';
    
    // Logic: Only show Team Sports where I am Registered AND Not already in a team
    const eligibleSports = myRegistrations.filter(r => {
        const isTeamSport = r.sports.type === 'Team';
        const alreadyInTeam = myTeams.some(t => t.teams.sport_id === r.sport_id);
        return isTeamSport && !alreadyInTeam;
    });

    if (eligibleSports.length === 0) return showToast('No eligible sports. Register individually first!', 'error');

    eligibleSports.forEach(r => {
        const option = document.createElement('option');
        option.value = r.sport_id;
        option.text = r.sports.name;
        select.appendChild(option);
    });

    document.getElementById('modal-create-team').classList.remove('hidden');
    document.getElementById('modal-create-team').classList.add('flex');
};

window.handleCreateTeam = async () => {
    const sportId = document.getElementById('create-team-sport-select').value;
    const name = document.getElementById('create-team-name').value;

    if (!sportId || !name) return showToast('Fill all fields', 'error');

    // Generate Code
    const code = name.substring(0, 3).toUpperCase() + Math.floor(1000 + Math.random() * 9000);

    try {
        // Transaction: Create Team -> Add Member (Captain) -> Update UI
        const { data: team, error: tErr } = await supabase.from('teams').insert({
            name: name, sport_id: sportId, captain_id: currentUser.id, team_code: code, status: 'Open'
        }).select().single();
        if (tErr) throw tErr;

        const { error: mErr } = await supabase.from('team_members').insert({
            team_id: team.id, user_id: currentUser.id, status: 'Accepted'
        });
        if (mErr) throw mErr;

        showToast('Team Created Successfully!');
        closeModal('modal-create-team');
        await refreshData();
    } catch (err) {
        console.error(err);
        showToast('Creation failed. Name taken?', 'error');
    }
};

// B. Join Team (Marketplace) Logic
async function renderTeamMarketplace() {
    const container = document.getElementById('team-marketplace');
    container.innerHTML = '<p class="text-center text-gray-500 text-xs">Loading...</p>';

    // Fetch OPEN teams with their Captain details
    const { data: openTeams } = await supabase
        .from('teams')
        .select(`
            id, name, status, team_code, sport_id,
            sports (name, gender_category, team_size),
            captain:users (class_name, gender) 
        `)
        .eq('status', 'Open');

    if (!openTeams || openTeams.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 text-xs py-4">No open teams available.</p>';
        return;
    }

    container.innerHTML = '';
    
    // FETCH MEMBERS COUNTS for validation
    const { data: memberCounts } = await supabase.from('team_members').select('team_id');
    
    openTeams.forEach(t => {
        // 1. Filter: Gender (if sport is not mixed)
        // Note: Simple logic - match user gender to captain gender for strict sports
        if (t.sports.gender_category !== 'Mixed' && t.captain.gender !== currentUser.gender) return;

        // 2. Filter: Category (Junior vs Senior)
        const captainCat = ['FYJC', 'SYJC'].includes(t.captain.class_name) ? 'Junior' : 'Senior';
        if (captainCat !== currentUser.category) return;

        // 3. Status Logic
        const currentCount = memberCounts.filter(m => m.team_id === t.id).length;
        const isFull = currentCount >= t.sports.team_size;
        const alreadyInThisTeam = myTeams.some(mt => mt.team_id === t.id);
        const hasReg = myRegistrations.some(r => r.sport_id === t.sport_id);

        let actionBtn = '';
        if (alreadyInThisTeam) {
            actionBtn = `<span class="text-xs font-bold text-green-500">Joined</span>`;
        } else if (!hasReg) {
            actionBtn = `<button onclick="showToast('Register individually first!', 'error')" class="px-3 py-1 bg-gray-800 text-gray-500 rounded text-[10px] font-bold">Register First</button>`;
        } else if (isFull) {
            actionBtn = `<span class="text-xs font-bold text-red-500">Full</span>`;
        } else {
            actionBtn = `<button onclick="handleJoinRequest('${t.id}')" class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold">Join</button>`;
        }

        container.innerHTML += `
            <div class="glass-panel p-3 rounded-xl flex justify-between items-center">
                <div>
                    <h4 class="font-bold text-white text-sm">${t.name}</h4>
                    <p class="text-[10px] text-gray-400">${t.sports.name} • ${currentCount}/${t.sports.team_size} Players</p>
                </div>
                ${actionBtn}
            </div>
        `;
    });
}

window.handleJoinRequest = async (teamId) => {
    try {
        const { error } = await supabase.from('team_members').insert({
            team_id: teamId, user_id: currentUser.id, status: 'Pending'
        });
        if (error) throw error;
        showToast('Request Sent!');
        await refreshData();
    } catch (err) {
        showToast('Could not join team.', 'error');
    }
};

// --- TAB 3: MY ZONE & MANAGEMENT ---
async function renderMyZone() {
    // 1. My Squads
    const squadsContainer = document.getElementById('my-teams-list');
    squadsContainer.innerHTML = '';
    
    myTeams.forEach(mt => {
        const isCaptain = mt.teams.captain_id === currentUser.id;
        const manageBtn = isCaptain 
            ? `<button onclick="openManageModal('${mt.team_id}')" class="mt-2 w-full py-1.5 bg-gray-800 border border-gray-600 text-xs font-bold text-white rounded hover:bg-gray-700">Manage Team</button>` 
            : `<p class="mt-2 text-[10px] text-gray-500 text-center">Member • ${mt.status}</p>`;

        squadsContainer.innerHTML += `
            <div class="glass-panel p-4 rounded-xl border border-gray-700">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-bold text-white">${mt.teams.name}</h4>
                        <p class="text-xs text-yellow-500 font-mono">${mt.teams.team_code}</p>
                    </div>
                    <span class="px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 text-[10px] font-bold border border-blue-800">${mt.teams.sports.name}</span>
                </div>
                ${manageBtn}
            </div>
        `;
    });

    // 2. Withdraw List
    const regContainer = document.getElementById('my-regs-list');
    regContainer.innerHTML = '';
    myRegistrations.forEach(r => {
        regContainer.innerHTML += `
            <div class="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                <span class="text-sm text-gray-300">${r.sports.name}</span>
                <button onclick="handleWithdraw(${r.sport_id})" class="text-xs text-red-500 hover:text-red-400 font-bold">Withdraw</button>
            </div>
        `;
    });
}

// --- CAPTAIN MANAGEMENT ---
window.openManageModal = async (teamId) => {
    currentManageTeamId = teamId;
    const modal = document.getElementById('modal-manage-team');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Fetch Details
    const { data: members } = await supabase
        .from('team_members')
        .select('id, status, user_id, users(name, class_name)')
        .eq('team_id', teamId);
    
    const team = myTeams.find(t => t.team_id === teamId).teams;
    
    document.getElementById('manage-team-name').innerText = team.name;
    document.getElementById('manage-team-code').innerText = team.team_code;

    // Render Lists
    const pendingList = document.getElementById('manage-pending-list');
    const rosterList = document.getElementById('manage-roster-list');
    pendingList.innerHTML = '';
    rosterList.innerHTML = '';

    members.forEach(m => {
        if (m.status === 'Pending') {
            pendingList.innerHTML += `
                <div class="flex justify-between items-center bg-gray-800 p-2 rounded">
                    <span class="text-xs text-white">${m.users.name} <span class="opacity-50">(${m.users.class_name})</span></span>
                    <div class="flex gap-2">
                        <button onclick="updateMemberStatus('${m.id}', 'Accepted')" class="text-green-500 hover:text-green-400"><i data-lucide="check" class="w-4 h-4"></i></button>
                        <button onclick="deleteMember('${m.id}')" class="text-red-500 hover:text-red-400"><i data-lucide="x" class="w-4 h-4"></i></button>
                    </div>
                </div>
            `;
        } else {
            const isMe = m.user_id === currentUser.id;
            rosterList.innerHTML += `
                <div class="flex justify-between items-center py-1">
                    <span class="text-xs text-gray-300">${m.users.name} ${isMe ? '(C)' : ''}</span>
                    ${!isMe && team.status === 'Open' ? `<button onclick="deleteMember('${m.id}')" class="text-red-500"><i data-lucide="trash-2" class="w-3 h-3"></i></button>` : ''}
                </div>
            `;
        }
    });
    
    // Lock Button State
    const lockBtn = document.getElementById('btn-lock-team');
    if (team.status === 'Locked') {
        lockBtn.disabled = true;
        lockBtn.innerHTML = '<i data-lucide="lock" class="w-4 h-4 inline mr-2"></i> Team is Locked';
        lockBtn.className = "w-full py-3 bg-gray-800 text-gray-500 rounded-xl font-bold text-sm cursor-not-allowed";
    } else {
        lockBtn.disabled = false;
        lockBtn.innerHTML = '<i data-lucide="lock" class="w-4 h-4 inline mr-2"></i> Lock Team (Finalize)';
        lockBtn.className = "w-full py-3 bg-red-600/20 text-red-500 border border-red-600/50 rounded-xl font-bold text-sm hover:bg-red-600 hover:text-white transition-all";
    }

    lucide.createIcons();
};

window.updateMemberStatus = async (memberId, status) => {
    await supabase.from('team_members').update({ status }).eq('id', memberId);
    openManageModal(currentManageTeamId); // Refresh modal
};

window.deleteMember = async (memberId) => {
    if(!confirm("Remove this player?")) return;
    await supabase.from('team_members').delete().eq('id', memberId);
    openManageModal(currentManageTeamId);
};

window.handleLockTeam = async () => {
    if(!confirm("Are you sure? Once locked, you cannot add or remove players.")) return;
    
    // Validate Count (simplified, assumes min size logic handled mentally or added here)
    await supabase.from('teams').update({ status: 'Locked' }).eq('id', currentManageTeamId);
    showToast('Team Locked!');
    closeModal('modal-manage-team');
    refreshData();
};

// --- WITHDRAWAL LOGIC ---
window.handleWithdraw = async (sportId) => {
    // 1. Check if in a Locked Team
    const teamEntry = myTeams.find(t => t.teams.sport_id === sportId);
    if (teamEntry && teamEntry.teams.status === 'Locked') {
        return showToast('Cannot withdraw! Your team is LOCKED.', 'error');
    }

    if (!confirm("Confirm Withdrawal? This will remove you from any open teams for this sport.")) return;

    // 2. Remove from Team Members first (if exists)
    if (teamEntry) {
        await supabase.from('team_members').delete().eq('id', teamEntry.id); // Delete my membership row
    }

    // 3. Remove Registration
    await supabase.from('registrations').delete().eq('user_id', currentUser.id).eq('sport_id', sportId);
    
    showToast('Withdrawn successfully.');
    await refreshData();
};

// --- UTILS ---
window.switchTab = (tabId) => {
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-${tabId}`).classList.add('active');
};

window.closeModal = (id) => document.getElementById(id).classList.remove('flex'), document.getElementById(id).classList.add('hidden');

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = msg;
    document.getElementById('toast-icon').className = type === 'error' ? 'w-5 h-5 text-red-500' : 'w-5 h-5 text-green-500';
    t.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => t.classList.add('opacity-0', 'translate-y-10'), 3000);
}
