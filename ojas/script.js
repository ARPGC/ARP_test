// ojas/script.js
import { supabase } from './supabase.js';

// --- CONFIGURATION ---
const FIX_NUMBER = 5489;
let currentUser = null;
let selectedSport = null;

// --- 1. INITIALIZATION & AUTH ---
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');

    if (!urlId) {
        showError("Access Denied", "No Student ID provided.");
        return;
    }

    // De-obfuscate ID
    const studentId = parseInt(urlId) - FIX_NUMBER;
    
    // Auth Check
    const authScreen = document.getElementById('auth-screen');
    const authStatus = document.getElementById('auth-status');
    
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('student_id', studentId.toString())
            .single();

        if (error || !user) {
            showError("Unauthorized Access", "Student ID not found in OJAS database.");
            return;
        }

        // Login Success
        currentUser = user;
        authStatus.innerText = `Welcome, ${user.name}!`;
        setTimeout(() => {
            authScreen.style.opacity = '0';
            setTimeout(() => authScreen.remove(), 500);
            initDashboard();
        }, 1000);

    } catch (err) {
        console.error(err);
        showError("System Error", "Connection failed.");
    }
});

function showError(title, msg) {
    document.body.innerHTML = `
        <div style="height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; background:#000; color:#ff4444;">
            <i data-lucide="shield-alert" style="width:48px; height:48px; margin-bottom:16px;"></i>
            <h1 style="font-size:24px; font-weight:800; margin:0;">${title}</h1>
            <p style="opacity:0.7; margin-top:8px;">${msg}</p>
        </div>
    `;
    lucide.createIcons();
}

// --- 2. DASHBOARD LOGIC ---
async function initDashboard() {
    // Fill User Info
    document.getElementById('user-name').innerText = currentUser.name;
    document.getElementById('user-class').innerText = `${currentUser.class_name || ''} • ${currentUser.student_id}`;
    if(currentUser.avatar_url) document.getElementById('user-avatar').src = currentUser.avatar_url;

    loadSports();
    loadMyRegistrations();
}

async function loadSports() {
    const { data: sports } = await supabase.from('sports').select('*').eq('status', 'Open');
    const container = document.getElementById('sports-container');
    
    if(!sports) return;

    container.innerHTML = sports.map(s => `
        <div class="sport-card" onclick="openRegisterModal(${s.id}, '${s.name}', '${s.type}')">
            <div class="mb-2"><i data-lucide="${s.icon || 'trophy'}" class="w-8 h-8 mx-auto text-yellow-500"></i></div>
            <h3 class="font-bold text-sm">${s.name}</h3>
            <span class="text-xs opacity-60">${s.type}</span>
        </div>
    `).join('');
    lucide.createIcons();
}

// --- 3. REGISTRATION / TEAM LOGIC ---
window.openRegisterModal = (sportId, sportName, type) => {
    selectedSport = { id: sportId, name: sportName, type: type };
    
    document.getElementById('modal-title').innerText = `Register for ${sportName}`;
    const content = document.getElementById('modal-body');
    const modal = document.getElementById('reg-modal');

    if (type === 'Individual') {
        content.innerHTML = `
            <p class="text-sm opacity-70 mb-4">Confirm your participation in ${sportName}?</p>
            <button onclick="confirmIndividualReg()" class="btn-primary">Confirm Registration</button>
        `;
    } else {
        // TEAM LOGIC
        content.innerHTML = `
            <div class="flex gap-2 mb-4">
                <button onclick="showCreateTeamUI()" class="btn-primary flex-1">Create Team</button>
                <button onclick="showJoinTeamUI()" class="btn-secondary flex-1">Join Team</button>
            </div>
            <div id="team-action-area"></div>
        `;
    }
    modal.classList.add('open');
};

window.showCreateTeamUI = () => {
    document.getElementById('team-action-area').innerHTML = `
        <label class="text-xs font-bold mb-1 block">Team Name</label>
        <input type="text" id="new-team-name" placeholder="Ex. The Invincibles">
        <button onclick="createTeam()" class="btn-primary mt-2">Create & Register Captain</button>
    `;
};

window.showJoinTeamUI = () => {
    document.getElementById('team-action-area').innerHTML = `
        <label class="text-xs font-bold mb-1 block">Team Code</label>
        <input type="text" id="join-team-code" placeholder="Ex. FOOT-8821">
        <button onclick="joinTeam()" class="btn-primary mt-2">Join Team</button>
    `;
};

// --- ACTIONS ---

window.createTeam = async () => {
    const name = document.getElementById('new-team-name').value;
    if(!name) return alert("Enter team name");

    // Generate Code: SportPrefix + Random 4 digits
    const code = `${selectedSport.name.substring(0,4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
        // 1. Create Team
        const { data: team, error } = await supabase.from('teams').insert({
            name: name,
            sport_id: selectedSport.id,
            captain_id: currentUser.id,
            team_code: code
        }).select().single();

        if(error) throw error;

        // 2. Register Captain
        await registerUser(selectedSport.id, team.id);

        alert(`Team Created! Your Code is: ${code}`);
        window.closeModal();
        loadMyRegistrations();

    } catch (err) {
        console.error(err);
        alert("Error creating team. Name might be taken.");
    }
};

window.joinTeam = async () => {
    const code = document.getElementById('join-team-code').value;
    
    try {
        // 1. Find Team
        const { data: team, error } = await supabase.from('teams').select('id, sport_id').eq('team_code', code).single();
        
        if(error || !team) return alert("Invalid Team Code");
        if(team.sport_id !== selectedSport.id) return alert("This code is for a different sport.");

        // 2. Register
        await registerUser(team.sport_id, team.id);
        
        alert("Successfully joined team!");
        window.closeModal();
        loadMyRegistrations();

    } catch(err) {
        alert("Could not join team.");
    }
};

window.confirmIndividualReg = async () => {
    await registerUser(selectedSport.id, null);
    window.closeModal();
    loadMyRegistrations();
};

async function registerUser(sportId, teamId) {
    const { error } = await supabase.from('registrations').insert({
        user_id: currentUser.id,
        sport_id: sportId,
        team_id: teamId
    });
    if(error) {
        if(error.code === '23505') alert("You are already registered for this!");
        else throw error;
    }
}

async function loadMyRegistrations() {
    const { data: regs } = await supabase
        .from('registrations')
        .select('status, sports(name, icon), teams(name, team_code)')
        .eq('user_id', currentUser.id);

    const list = document.getElementById('my-regs-list');
    if(!regs || regs.length === 0) {
        list.innerHTML = '<p class="text-xs opacity-50 text-center py-4">No active registrations.</p>';
        return;
    }

    list.innerHTML = regs.map(r => `
        <div class="glass-card flex justify-between items-center py-3 px-4">
            <div class="flex items-center gap-3">
                <i data-lucide="${r.sports.icon || 'activity'}" class="w-5 h-5 text-yellow-500"></i>
                <div>
                    <p class="font-bold text-sm">${r.sports.name}</p>
                    <p class="text-xs opacity-60">${r.teams ? r.teams.name : 'Individual'}</p>
                </div>
            </div>
            <div class="text-right">
                <span class="text-xs font-bold text-green-400 block">${r.status}</span>
                ${r.teams ? `<span class="text-[10px] bg-white/10 px-1 rounded">${r.teams.team_code}</span>` : ''}
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

window.closeModal = () => document.getElementById('reg-modal').classList.remove('open');
