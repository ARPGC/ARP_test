// ==========================================
// OJAS 2026 - VOLUNTEER CONTROLLER (FINAL)
// ==========================================

(function() { 

    // --- 1. CONFIGURATION ---
    const SUPABASE_URL = 'https://sijmmlhltkksykhbuatn.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_9GjhwaWzz0McozvxVMINyQ_ZFU58z7F'; 

    if(!window.supabase) return console.error("Supabase not loaded");
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Global State
    let currentVolunteer = null;
    let assignedSport = null;
    let liveMatches = [];
    let currentActiveMatchId = null; // Tracks which match is currently open

    // --- 2. INITIALIZATION ---
    document.addEventListener('DOMContentLoaded', async () => {
        if(window.lucide) lucide.createIcons();
        await authenticateVolunteer();
    });

    // --- 3. AUTHENTICATION ---
    async function authenticateVolunteer() {
        const urlParams = new URLSearchParams(window.location.search);
        const studentId = urlParams.get('id');

        if (!studentId) return showAuthError("No ID found. Please scan your QR code again.");

        // Fetch User + Assigned Sport
        const { data: user, error } = await supabase
            .from('users')
            .select(`*, sports (id, name, type, is_performance)`)
            .eq('student_id', studentId)
            .single();

        if (error || !user) return showAuthError("Access Denied: User not found.");
        if (user.role !== 'volunteer') return showAuthError("Access Denied: Not a Volunteer.");
        if (!user.sports) return showAuthError("No Sport Assigned. Contact Admin.");

        // Auth Success
        currentVolunteer = user;
        assignedSport = user.sports;

        // Update UI
        document.getElementById('vol-sport-name').innerText = assignedSport.name;
        document.getElementById('vol-initials').innerText = user.name.substring(0, 2).toUpperCase();
        
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');

        // Load Data
        loadLiveMatches();
        subscribeToRealtime();
    }

    function showAuthError(msg) {
        const el = document.getElementById('auth-msg');
        el.innerText = msg;
        el.classList.add('text-red-600', 'font-bold');
        document.querySelector('.animate-spin').classList.remove('animate-spin');
    }

    // --- 4. DATA LOADING & REALTIME ---
    async function loadLiveMatches() {
        // Fetch only Live matches for this sport
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .eq('sport_id', assignedSport.id)
            .eq('status', 'Live')
            .order('created_at', { ascending: false });

        if (error) return showToast("Connection Error", "error");

        liveMatches = data;

        // Decision: Render List or Update Active Console
        if (currentActiveMatchId) {
            const activeMatch = liveMatches.find(m => m.id === currentActiveMatchId);
            if (activeMatch) {
                renderScoreboard(activeMatch); // Update stats while keeping user in console
            } else {
                // Match ended or deleted while viewing
                closeMatchView();
                showToast("Match ended or removed", "info");
                renderMatchList();
            }
        } else {
            renderMatchList();
        }
    }

    function subscribeToRealtime() {
        supabase
            .channel('volunteer-live-updates')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'matches', 
                filter: `sport_id=eq.${assignedSport.id}` 
            }, (payload) => {
                console.log("Realtime Update:", payload);
                loadLiveMatches();
            })
            .subscribe();
    }

    // --- 5. VIEW 1: MATCH LIST (LOBBY) ---
    window.renderMatchList = function() {
        const container = document.getElementById('matches-list-container');
        container.innerHTML = '';

        if (liveMatches.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-slate-400 opacity-60">
                    <i data-lucide="radio" class="w-12 h-12 mb-2"></i>
                    <p class="text-sm font-bold">No Live Events</p>
                    <p class="text-xs">Wait for Admin to start a match.</p>
                </div>`;
            if(window.lucide) lucide.createIcons();
            return;
        }

        liveMatches.forEach(match => {
            // Resolve Names
            let p1 = match.participants?.player1_name || match.participants?.team1_name || "Team A";
            let p2 = match.participants?.player2_name || match.participants?.team2_name || "Team B";
            if (assignedSport.is_performance) {
                p1 = "Performance Event"; 
                p2 = `${match.participants?.students?.length || 0} Participants`;
            }

            const card = document.createElement('div');
            card.className = "bg-white rounded-xl shadow-sm border border-slate-200 p-4 active:scale-95 transition-transform cursor-pointer";
            card.onclick = () => openMatchView(match.id);

            card.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${match.title}</span>
                    <span class="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span class="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span> LIVE
                    </span>
                </div>
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="font-bold text-slate-900 leading-tight">${p1}</h3>
                        ${assignedSport.is_performance ? '' : `<p class="text-xs text-slate-500 font-medium">vs ${p2}</p>`}
                    </div>
                    <button class="bg-indigo-50 text-indigo-600 p-2 rounded-lg">
                        <i data-lucide="chevron-right" class="w-5 h-5"></i>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
        if(window.lucide) lucide.createIcons();
    }

    // --- 6. VIEW 2: SCORE CONSOLE ---
    window.openMatchView = function(matchId) {
        const match = liveMatches.find(m => m.id === matchId);
        if(!match) return;

        currentActiveMatchId = matchId;

        // Toggle Views
        document.getElementById('view-match-list').classList.add('hidden');
        document.getElementById('view-score-control').classList.remove('hidden');
        document.getElementById('btn-back').classList.remove('hidden'); // Show back button

        // Populate Header Info
        document.getElementById('control-match-title').innerText = match.title;
        
        let versusText = "";
        const p = match.participants || {};
        
        // Setup Winner Dropdown
        const winnerSelect = document.getElementById('select-winner');
        winnerSelect.innerHTML = '<option value="">Select Winner...</option>';

        if (assignedSport.is_performance) {
            versusText = "Update Results";
            document.getElementById('end-match-section').classList.add('hidden'); // No winner selection for perf here usually
        } else {
            document.getElementById('end-match-section').classList.remove('hidden');
            // Resolve Names
            const n1 = p.player1_name || p.team1_name || "Team A";
            const n2 = p.player2_name || p.team2_name || "Team B";
            versusText = `${n1} vs ${n2}`;
            
            // Populate Dropdown
            winnerSelect.innerHTML += `<option value="${n1}">${n1}</option>`;
            winnerSelect.innerHTML += `<option value="${n2}">${n2}</option>`;
            winnerSelect.innerHTML += `<option value="Draw">Draw</option>`;
        }
        document.getElementById('control-match-versus').innerText = versusText;

        renderScoreboard(match);
    }

    window.closeMatchView = function() {
        currentActiveMatchId = null;
        document.getElementById('view-score-control').classList.add('hidden');
        document.getElementById('view-match-list').classList.remove('hidden');
        document.getElementById('btn-back').classList.add('hidden');
        renderMatchList();
    }

    function renderScoreboard(match) {
        const container = document.getElementById('score-inputs-container');
        // If focusing on an input, don't fully wipe innerHTML to prevent focus loss (Basic check)
        // ideally we use diffing, but for simple app, we wipe. 
        // CAUTION: This might kill focus if realtime update happens while typing. 
        // For volunteers, updates usually come from them, so it's okay.
        container.innerHTML = '';

        // A. PERFORMANCE
        if (assignedSport.is_performance) {
            const students = match.participants?.students || [];
            const results = match.live_data?.results || [];

            const rows = students.map(student => {
                const existing = results.find(r => r.uid === student.id) || {};
                return `
                <div class="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl">
                    <div class="flex-1 min-w-0 pr-3">
                        <p class="text-sm font-bold text-slate-900 truncate">${student.name}</p>
                        <p class="text-[10px] text-slate-400 font-mono">ID: ${student.student_id}</p>
                    </div>
                    <input type="text" 
                        class="w-24 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-right font-mono font-bold text-slate-800 outline-none"
                        placeholder="Time"
                        value="${existing.time || ''}"
                        onchange="window.updatePerformanceScore('${match.id}', '${student.id}', this.value)"
                    >
                </div>`;
            }).join('');
            container.innerHTML = `<div class="space-y-3">${rows}</div>`;
        } 
        // B. CRICKET
        else if (assignedSport.name.toLowerCase().includes('cricket')) {
            const d = match.live_data || {};
            const t1 = d.t1 || {r:0,w:0,o:0};
            const t2 = d.t2 || {r:0,w:0,o:0};
            
            const n1 = match.participants?.team1_name || 'Team A';
            const n2 = match.participants?.team2_name || 'Team B';

            const inputBlock = (teamKey, label, field, val) => `
                <div class="flex flex-col">
                    <label class="text-[9px] font-bold text-slate-400 uppercase mb-1">${label}</label>
                    <input type="number" 
                        class="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center font-bold text-lg outline-none focus:border-indigo-500 w-full" 
                        value="${val}" 
                        onchange="window.updateCricketScore('${match.id}', '${teamKey}', '${field}', this.value)">
                </div>
            `;

            container.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-6">
                <div>
                    <p class="text-xs font-bold text-indigo-900 uppercase mb-2 border-b border-slate-100 pb-2">${n1}</p>
                    <div class="grid grid-cols-3 gap-3">
                        ${inputBlock('t1', 'Runs', 'r', t1.r)}
                        ${inputBlock('t1', 'Wickets', 'w', t1.w)}
                        ${inputBlock('t1', 'Overs', 'o', t1.o)}
                    </div>
                </div>
                <div>
                    <p class="text-xs font-bold text-indigo-900 uppercase mb-2 border-b border-slate-100 pb-2">${n2}</p>
                    <div class="grid grid-cols-3 gap-3">
                        ${inputBlock('t2', 'Runs', 'r', t2.r)}
                        ${inputBlock('t2', 'Wickets', 'w', t2.w)}
                        ${inputBlock('t2', 'Overs', 'o', t2.o)}
                    </div>
                </div>
            </div>`;
        } 
        // C. STANDARD
        else {
            const s = match.live_data || {s1:0, s2:0};
            const n1 = match.participants?.player1_name || match.participants?.team1_name || 'Home';
            const n2 = match.participants?.player2_name || match.participants?.team2_name || 'Away';

            container.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div class="flex items-center justify-between gap-4">
                    <div class="flex-1 text-center">
                        <p class="text-[10px] font-bold text-slate-400 mb-2 truncate">${n1}</p>
                        <input type="number" 
                            class="w-full h-20 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center text-4xl font-extrabold text-slate-800 outline-none focus:border-indigo-500"
                            value="${s.s1 || 0}"
                            onchange="window.updateStandardScore('${match.id}', 's1', this.value)">
                    </div>
                    <div class="text-slate-300 font-black text-xl italic">VS</div>
                    <div class="flex-1 text-center">
                        <p class="text-[10px] font-bold text-slate-400 mb-2 truncate">${n2}</p>
                        <input type="number" 
                            class="w-full h-20 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center text-4xl font-extrabold text-slate-800 outline-none focus:border-indigo-500"
                            value="${s.s2 || 0}"
                            onchange="window.updateStandardScore('${match.id}', 's2', this.value)">
                    </div>
                </div>
            </div>`;
        }
    }

    // --- 7. UPDATE ACTIONS ---

    window.updatePerformanceScore = async function(matchId, studentId, value) {
        showToast("Saving...", "info");
        const match = liveMatches.find(m => m.id === matchId);
        if(!match) return;

        let results = match.live_data?.results || [];
        const existingIndex = results.findIndex(r => r.uid === studentId);
        if (existingIndex > -1) results[existingIndex].time = value;
        else results.push({ uid: studentId, time: value, rank: 999 });

        const { error } = await supabase.from('matches').update({ live_data: { ...match.live_data, results: results } }).eq('id', matchId);
        if (error) showToast("Failed", "error"); else showToast("Saved", "success");
    }

    window.updateCricketScore = async function(matchId, teamKey, field, value) {
        const match = liveMatches.find(m => m.id === matchId);
        let liveData = match.live_data || {};
        if(!liveData[teamKey]) liveData[teamKey] = {};
        liveData[teamKey][field] = value;
        const { error } = await supabase.from('matches').update({ live_data: liveData }).eq('id', matchId);
        if(error) showToast("Failed", "error");
    }

    window.updateStandardScore = async function(matchId, scoreKey, value) {
        const match = liveMatches.find(m => m.id === matchId);
        let liveData = match.live_data || {};
        liveData[scoreKey] = value;
        const { error } = await supabase.from('matches').update({ live_data: liveData }).eq('id', matchId);
        if(error) showToast("Failed", "error");
    }

    // --- 8. END MATCH LOGIC ---
    window.endMatchVolunteer = async function() {
        if (!currentActiveMatchId) return;
        
        const winnerSelect = document.getElementById('select-winner');
        const winner = winnerSelect.value;

        if (!winner) return showToast("Please select a winner first", "error");
        if (!confirm(`Declare ${winner} as winner and end match?`)) return;

        showToast("Finalizing Match...", "info");

        // 1. Get current live_data to preserve scores
        const match = liveMatches.find(m => m.id === currentActiveMatchId);
        const finalLiveData = { ...match.live_data, winner: winner };

        // 2. Update DB
        const { error } = await supabase
            .from('matches')
            .update({ 
                status: 'Completed', 
                live_data: finalLiveData 
            })
            .eq('id', currentActiveMatchId);

        if (error) {
            showToast("Error ending match", "error");
        } else {
            showToast("Match Completed", "success");
            closeMatchView();
        }
    }

    // --- 9. TOASTS ---
    function showToast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        let bg = type === 'error' ? 'bg-red-600' : (type === 'info' ? 'bg-blue-600' : 'bg-green-600');
        let icon = type === 'error' ? 'alert-circle' : (type === 'info' ? 'loader-2' : 'check');
        let spin = type === 'info' ? 'animate-spin' : '';

        toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-white text-sm font-bold ${bg} toast-enter-active`;
        toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 ${spin}"></i> <span>${msg}</span>`;
        container.appendChild(toast);
        if(window.lucide) lucide.createIcons();

        requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(100%)'; setTimeout(() => toast.remove(), 300); }, 2000);
    }

})();
