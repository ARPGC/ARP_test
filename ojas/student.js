import { supabase } from './supabase.js';

// --- CONFIG ---
const FIX_NUMBER = 5489;
let currentUser = null;
let currentSport = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');

    if (!urlId) return showError('No ID Provided');

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

        if (error || !data) throw new Error('Student not found');

        currentUser = data;
        renderHeader();
        await loadDashboard();
        
        // Show App, Hide Loader
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');

    } catch (err) {
        showError('Unauthorized Access');
    }
}

// --- RENDERING ---
function renderHeader() {
    document.getElementById('header-name').textContent = currentUser.name;
    document.getElementById('header-id').textContent = `ID: ${currentUser.student_id}`;
    document.getElementById('badge-class').textContent = currentUser.class_name || 'N/A';
    document.getElementById('badge-gender').textContent = currentUser.gender || 'Student';
    
    if (currentUser.avatar_url) {
        document.getElementById('header-avatar').src = currentUser.avatar_url;
    }
}

async function loadDashboard() {
    // 1. Fetch Registrations
    const { data: regs } = await supabase
        .from('registrations')
        .select(`
            status, 
            sports (id, name, icon, type), 
            teams (name, team_code)
        `)
        .eq('user_id', currentUser.id);

    const container = document.getElementById('my-registrations-list');
    container.innerHTML = '';

    if (!regs || regs.length === 0) {
        container.innerHTML = `<div class="glass-panel p-6 rounded-xl text-center border-dashed border-2 border-gray-700">
            <p class="text-gray-500 text-sm">You haven't registered for any events yet.</p>
            <button onclick="switchTab('sports')" class="mt-3 text-yellow-500 text-sm font-bold hover:underline">Browse Sports</button>
        </div>`;
        return;
    }

    regs.forEach(r => {
        const isTeam = r.teams !== null;
        const html = `
            <div class="glass-panel p-4 rounded-xl flex items-center justify-between border-l-4 ${r.status === 'Confirmed' ? 'border-l-green-500' : 'border-l-yellow-500'}">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                        <i data-lucide="${r.sports.icon || 'trophy'}" class="w-5 h-5 text-gray-300"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-white text-sm">${r.sports.name}</h4>
                        <p class="text-xs text-gray-400">${isTeam ? `Team: ${r.teams.name}` : 'Individual Entry'}</p>
                    </div>
                </div>
                <div class="text-right">
                     ${isTeam ? `<div class="text-[10px] font-mono bg-gray-800 px-2 py-1 rounded text-yellow-500 mb-1">Code: ${r.teams.team_code}</div>` : ''}
                    <span class="text-xs font-bold ${r.status === 'Confirmed' ? 'text-green-500' : 'text-yellow-500'}">${r.status}</span>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
    lucide.createIcons();
}

async function loadSports() {
    const { data: sports } = await supabase
        .from('sports')
        .select('*')
        .eq('status', 'Open')
        .order('name');

    const grid = document.getElementById('sports-grid');
    grid.innerHTML = '';

    sports.forEach(s => {
        const div = document.createElement('div');
        div.className = 'glass-panel p-4 rounded-xl hover:bg-gray-800 transition-colors cursor-pointer text-center group';
        div.onclick = () => openRegModal(s);
        div.innerHTML = `
            <i data-lucide="${s.icon || 'activity'}" class="w-8 h-8 mx-auto mb-3 text-gray-500 group-hover:text-yellow-500 transition-colors"></i>
            <h3 class="font-bold text-white text-sm mb-1">${s.name}</h3>
            <span class="text-[10px] uppercase tracking-wider font-bold text-gray-500 bg-gray-900 px-2 py-1 rounded">${s.type}</span>
        `;
        grid.appendChild(div);
    });
    lucide.createIcons();
}

// --- MODAL LOGIC ---
window.openRegModal = (sport) => {
    currentSport = sport;
    const modal = document.getElementById('modal-reg');
    const content = document.getElementById('modal-content');
    
    document.getElementById('modal-title').textContent = sport.name;
    document.getElementById('modal-type').textContent = `${sport.type} Event`;
    
    // Reset Content
    if (sport.type === 'Individual') {
        content.innerHTML = `
            <p class="text-gray-400 text-sm text-center mb-6">Confirm your participation in ${sport.name}?</p>
            <button onclick="handleIndividualReg()" class="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-xl transition-colors">Confirm Registration</button>
        `;
    } else {
        content.innerHTML = `
            <div class="grid grid-cols-2 gap-3 mb-4">
                <button onclick="showCreateTeam()" class="bg-gray-800 hover:bg-gray-700 p-4 rounded-xl border border-gray-700 text-center transition-all">
                    <i data-lucide="plus-circle" class="w-6 h-6 mx-auto mb-2 text-green-500"></i>
                    <span class="block text-xs font-bold text-white">Create Team</span>
                </button>
                <button onclick="showJoinTeam()" class="bg-gray-800 hover:bg-gray-700 p-4 rounded-xl border border-gray-700 text-center transition-all">
                    <i data-lucide="users" class="w-6 h-6 mx-auto mb-2 text-blue-500"></i>
                    <span class="block text-xs font-bold text-white">Join Team</span>
                </button>
            </div>
            <div id="team-form-area"></div>
        `;
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
};

window.showCreateTeam = () => {
    document.getElementById('team-form-area').innerHTML = `
        <label class="text-xs text-gray-500 font-bold mb-1 block">Team Name</label>
        <input type="text" id="team-name-input" class="w-full bg-black border border-gray-700 text-white p-3 rounded-xl text-sm mb-3 focus:outline-none focus:border-yellow-500" placeholder="Ex. The Invincibles">
        <button onclick="handleCreateTeam()" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm">Create & Captain</button>
    `;
};

window.showJoinTeam = () => {
    document.getElementById('team-form-area').innerHTML = `
        <label class="text-xs text-gray-500 font-bold mb-1 block">Team Code</label>
        <input type="text" id="team-code-input" class="w-full bg-black border border-gray-700 text-white p-3 rounded-xl text-sm mb-3 focus:outline-none focus:border-blue-500" placeholder="Ex. CRIC-8821">
        <button onclick="handleJoinTeam()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm">Join Team</button>
    `;
};

// --- ACTION HANDLERS ---
window.handleIndividualReg = async () => {
    try {
        const { error } = await supabase.from('registrations').insert({
            user_id: currentUser.id,
            sport_id: currentSport.id
        });
        if (error) throw error;
        showToast('Registered successfully!');
        window.closeModal();
        await loadDashboard();
    } catch (err) {
        showToast('Already registered!', 'error');
    }
};

window.handleCreateTeam = async () => {
    const name = document.getElementById('team-name-input').value.trim();
    if (!name) return showToast('Enter a team name', 'error');

    const code = `${currentSport.name.substring(0,4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
        // 1. Create Team
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .insert({
                name: name,
                sport_id: currentSport.id,
                captain_id: currentUser.id,
                team_code: code
            })
            .select()
            .single();

        if (teamError) throw teamError;

        // 2. Register Captain
        const { error: regError } = await supabase.from('registrations').insert({
            user_id: currentUser.id,
            sport_id: currentSport.id,
            team_id: team.id
        });

        if (regError) throw regError;

        showToast(`Team Created! Code: ${code}`);
        window.closeModal();
        await loadDashboard();

    } catch (err) {
        showToast('Error creating team.', 'error');
    }
};

window.handleJoinTeam = async () => {
    const code = document.getElementById('team-code-input').value.trim();
    if (!code) return showToast('Enter team code', 'error');

    try {
        // 1. Find Team
        const { data: team, error: findError } = await supabase
            .from('teams')
            .select('id, sport_id')
            .eq('team_code', code)
            .single();

        if (findError || !team) throw new Error('Invalid Code');
        if (team.sport_id !== currentSport.id) throw new Error('Code is for different sport');

        // 2. Register
        const { error: regError } = await supabase.from('registrations').insert({
            user_id: currentUser.id,
            sport_id: currentSport.id,
            team_id: team.id
        });

        if (regError) {
             if (regError.code === '23505') throw new Error('Already in a team');
             throw regError;
        }

        showToast('Joined team successfully!');
        window.closeModal();
        await loadDashboard();

    } catch (err) {
        showToast(err.message, 'error');
    }
};

// --- UI UTILS ---
window.switchTab = (tabId) => {
    // Hide all views
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Show selected
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // Lazy Load Data
    if (tabId === 'sports') loadSports();
    // if (tabId === 'schedule') loadSchedule(); // Add when matches table ready
};

window.closeModal = () => {
    document.getElementById('modal-reg').classList.remove('flex');
    document.getElementById('modal-reg').classList.add('hidden');
};

function showError(msg) {
    document.getElementById('loader').innerHTML = `
        <i data-lucide="shield-alert" class="w-12 h-12 text-red-500 mb-4"></i>
        <h2 class="text-xl font-bold text-white">${msg}</h2>
        <p class="text-xs text-gray-500 mt-2 text-center px-6">Your Student ID could not be verified in the OJAS database.</p>
    `;
    lucide.createIcons();
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    const text = document.getElementById('toast-msg');

    text.textContent = msg;
    icon.setAttribute('class', `w-5 h-5 ${type === 'error' ? 'text-red-500' : 'text-green-500'}`);
    
    toast.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
    }, 3000);
}
