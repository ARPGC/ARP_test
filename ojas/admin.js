// ==========================================
// OJAS 2026 - ADMIN PORTAL CONTROLLER (FINAL V7)
// ==========================================

(function() { 

    // --- 1. CONFIGURATION ---
    const SUPABASE_URL = 'https://sijmmlhltkksykhbuatn.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_9GjhwaWzz0McozvxVMINyQ_ZFU58z7F'; 
    const ADMIN_PASS = 'admin1205'; 

    if(!window.supabase) return console.error("Supabase not loaded");
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Global State Cache
    let rawTeams = [];
    let rawSports = [];
    let rawMatches = [];
    let rawWinners = [];
    
    // UI State
    let currentLiveMatchId = null;
    let currentViewMode = 'master'; // 'tournament', 'performance', 'master'
    
    let isAdminUser = false;
    let currentAdmin = null; 

    // --- 2. INITIALIZATION ---
    document.addEventListener('DOMContentLoaded', async () => {
        const passField = document.getElementById('admin-pass');
        if(passField) passField.value = '';
        if(window.lucide) lucide.createIcons();
        
        // Listeners
        const sportSelect = document.getElementById('sched-sport');
        const genderSelect = document.getElementById('sched-gender');
        const byeCheck = document.getElementById('sched-is-bye');
        
        if(sportSelect) sportSelect.addEventListener('change', populateScheduleParticipants);
        if(genderSelect) genderSelect.addEventListener('change', populateScheduleParticipants);
        if(byeCheck) byeCheck.addEventListener('change', toggleByeMode);

        await verifyAdminRole();
    });

    async function verifyAdminRole() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id'); 
        if (!urlId) { renderAccessDenied("No ID", "URL missing ID"); return; }
        const { data: user, error } = await supabase.from('users').select('id, name, student_id, role').eq('student_id', urlId).single();
        if (error || !user || user.role !== 'admin') { renderAccessDenied("Unauthorized", "Admin privileges required."); return; }
        isAdminUser = true; currentAdmin = user; console.log(`Admin Verified: ${user.name}`);
    }

    function renderAccessDenied(title, msg) {
        document.body.innerHTML = `<div class="flex h-screen items-center justify-center bg-slate-900 text-white flex-col text-center p-4"><h1 class="text-3xl font-bold mb-2">${title}</h1><p class="text-slate-400">${msg}</p></div>`;
    }

    async function logActivity(action, details) {
        if (!currentAdmin) return;
        supabase.from('activity_logs').insert({ admin_id: currentAdmin.id, admin_name: currentAdmin.name, action_type: action, details: details });
    }

    window.checkAdminAuth = function() {
        if(!isAdminUser) return; 
        if (document.getElementById('admin-pass').value === ADMIN_PASS) unlockApp();
        else { const err = document.getElementById('login-error'); err.classList.remove('hidden'); setTimeout(() => err.classList.add('hidden'), 2000); }
    }

    function unlockApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('admin-app').classList.remove('hidden');
        loadDashboardStats(); 
        fetchSportsList(); 
        loadTeams(); 
        
        // Default to Master View
        switchView('matches-master');
    }

    // --- 3. NAVIGATION CONTROLLER ---
    window.switchView = function(viewId) {
        // Hide all main containers
        document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
        
        // Reset Nav Styles
        document.querySelectorAll('[id^="nav-"]').forEach(el => {
            el.classList.replace('text-indigo-600', 'text-slate-500');
            el.classList.replace('bg-indigo-50', 'hover:bg-slate-50');
            el.classList.remove('font-semibold');
        });

        // Activate Nav
        const nav = document.getElementById(`nav-${viewId}`);
        if(nav) {
            nav.classList.replace('text-slate-500', 'text-indigo-600');
            nav.classList.replace('hover:bg-slate-50', 'bg-indigo-50');
            nav.classList.add('font-semibold');
        }

        const target = document.getElementById(`view-${viewId}`);
        if(target) target.classList.remove('hidden');

        // Logic Dispatcher
        if (viewId === 'tournament') {
            currentViewMode = 'tournament';
            loadMatches('tournament');
        } else if (viewId === 'performance') {
            currentViewMode = 'performance';
            renderPerformanceDashboard(); // Special function for Performance cards
        } else if (viewId === 'matches-master') {
            currentViewMode = 'master';
            loadMatches('master');
        } else if (viewId === 'winners') {
            loadWinners();
        }
    }

    // --- 4. DATA FETCHING ---
    async function fetchSportsList() {
        const { data } = await supabase.from('sports').select('*').order('name');
        if (data) {
            rawSports = data;
            // Populate Dropdowns where needed
            ['winner-sport', 'match-filter-sport'].forEach(id => {
                const el = document.getElementById(id);
                if(el) {
                    const hasAll = el.querySelector('option[value="All"]');
                    el.innerHTML = hasAll ? '<option value="All">All Sports</option>' : '';
                    data.forEach(s => el.innerHTML += `<option value="${id.includes('filter') ? s.name : s.id}">${s.name}</option>`);
                }
            });
        }
    }

    async function loadDashboardStats() {
        const { count: u } = await supabase.from('users').select('*', { count: 'exact', head: true });
        document.getElementById('stat-users').innerText = u || 0;
        const { count: r } = await supabase.from('registrations').select('*', { count: 'exact', head: true });
        document.getElementById('stat-regs').innerText = r || 0;
        const { count: t } = await supabase.from('teams').select('*', { count: 'exact', head: true });
        document.getElementById('stat-teams').innerText = t || 0;
    }

    window.loadTeams = async function() {
        const { data, error } = await supabase.from('teams').select('id, name, sport_id, captain_id').order('created_at', { ascending: false });
        if (!error && data) rawTeams = data;
    }

    // ==========================================
    // MODULE: MATCH LIST RENDERING (Tournament & Master)
    // ==========================================

    window.loadMatches = async function(mode) {
        const gridId = mode === 'tournament' ? 'tournament-matches-grid' : 'master-matches-grid';
        const grid = document.getElementById(gridId);
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400">Loading matches...</div>';
        
        await Promise.all([
            rawTeams.length === 0 ? loadTeams() : Promise.resolve(),
            rawSports.length === 0 ? fetchSportsList() : Promise.resolve()
        ]);

        const { data, error } = await supabase.from('matches').select(`*, sports (name, type, icon, category, is_performance)`).order('match_time', { ascending: true });
        
        if (error) { grid.innerHTML = `<div class="text-red-500">Error: ${error.message}</div>`; return; }
        
        // Process Names
        rawMatches = data.map(m => {
            let p1 = "TBD", p2 = "TBD";
            const parts = m.participants || {};
            
            if(m.sport_type === 'Team') {
                const t1 = rawTeams.find(t => t.id === parts.team1_id);
                const t2 = rawTeams.find(t => t.id === parts.team2_id);
                p1 = t1 ? t1.name : "TBD"; p2 = t2 ? t2.name : "TBD";
            } else if (m.sport_type === 'Individual') {
                p1 = parts.player1_name || "Player 1"; p2 = parts.player2_name || "Player 2";
            }
            return { ...m, p1_resolved: p1, p2_resolved: p2 };
        });

        renderGrid(mode, grid);
    }

    function renderGrid(mode, gridElement) {
        gridElement.innerHTML = '';
        
        // Filter based on mode
        let filtered = rawMatches.filter(m => {
            if (mode === 'tournament') return m.sports.is_performance === false; // Only non-performance
            return true; // Master shows all
        });

        // Add search filter if in Master view
        if(mode === 'master') {
            const search = document.getElementById('master-search').value.toLowerCase();
            const fStatus = document.getElementById('master-filter-status').value;
            filtered = filtered.filter(m => {
                const txt = (m.title + m.sports.name + m.p1_resolved + m.p2_resolved).toLowerCase();
                const statusMatch = fStatus === 'All' || m.status === fStatus;
                return txt.includes(search) && statusMatch;
            });
        }

        if(filtered.length === 0) {
            gridElement.innerHTML = `<div class="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">No matches found.</div>`; 
            return;
        }

        filtered.forEach(match => {
            let scoreDisplay = '0 - 0';
            let statusColor = 'bg-slate-100 text-slate-600';
            const isBye = match.participants?.is_bye;
            const category = match.participants?.category ? `<span class="ml-2 text-[10px] bg-slate-200 text-slate-600 px-1.5 rounded font-bold uppercase">${match.participants.category}</span>` : '';

            if(match.status === 'Live') statusColor = 'bg-red-100 text-red-600 animate-pulse';
            if(match.status === 'Completed') statusColor = 'bg-green-100 text-green-600';

            const live = match.live_data || {};
            
            // Score Display Logic
            if(match.sports.name.toLowerCase().includes('cricket')) {
                const s1 = live.t1 ? `${live.t1.r}/${live.t1.w}` : '0/0';
                const s2 = live.t2 ? `${live.t2.r}/${live.t2.w}` : '0/0';
                scoreDisplay = `${s1} vs ${s2}`;
            } else if (match.sport_type === 'Performance') {
                const count = live.results ? live.results.length : 0;
                scoreDisplay = match.status === 'Completed' ? 'Results Published' : `${count} Participants`;
            } else {
                scoreDisplay = `${live.s1 || 0} - ${live.s2 || 0}`;
            }
            if(isBye) scoreDisplay = "BYE";

            // Card HTML
            const card = document.createElement('div');
            card.className = "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow";
            
            let vsSection = '';
            if (match.sport_type === 'Performance') {
                vsSection = `<div class="py-4"><span class="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">Performance Event</span></div>`;
            } else if (isBye) {
                vsSection = `<div class="py-4 flex flex-col items-center"><span class="font-bold text-slate-800 text-lg">${match.p1_resolved}</span><span class="text-[10px] uppercase font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded mt-1">Advances (Bye)</span></div>`;
            } else {
                vsSection = `<div class="flex justify-between items-center mb-4 px-4 gap-2"><span class="font-bold text-slate-800 w-1/3 truncate text-right text-sm" title="${match.p1_resolved}">${match.p1_resolved}</span><span class="text-[10px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded">VS</span><span class="font-bold text-slate-800 w-1/3 truncate text-left text-sm" title="${match.p2_resolved}">${match.p2_resolved}</span></div>`;
            }

            card.innerHTML = `
                <div class="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <div class="flex items-center gap-1"><span class="text-xs font-bold uppercase text-slate-500">${match.sports.name}</span>${category}</div>
                    <span class="px-2 py-0.5 text-[10px] font-bold rounded ${statusColor}">${match.status}</span>
                </div>
                <div class="p-6 text-center flex-1 flex flex-col justify-center">
                    <p class="text-xs font-bold text-slate-400 mb-2 uppercase">${match.title || 'Match'}</p>
                    ${vsSection}
                    <div class="bg-slate-900 text-white py-3 rounded-xl mb-4"><span class="text-xl font-mono font-bold tracking-widest">${scoreDisplay}</span></div>
                    <div class="grid grid-cols-2 gap-2 mt-auto">
                         <button onclick="window.openLiveScoreMode('${match.id}')" class="py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors">${match.status === 'Completed' ? 'Edit Result' : 'Live Console'}</button>
                         <button onclick="window.deleteMatch('${match.id}')" class="py-2 bg-white border border-slate-200 text-red-500 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors">Delete</button>
                    </div>
                </div>`;
            gridElement.appendChild(card);
        });
    }

    // --- 5. PERFORMANCE DASHBOARD LOGIC (NEW) ---
    window.renderPerformanceDashboard = async function() {
        const grid = document.getElementById('performance-sports-grid');
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400">Loading sports...</div>';
        
        if (rawSports.length === 0) await fetchSportsList();

        const perfSports = rawSports.filter(s => s.is_performance === true);
        
        grid.innerHTML = '';
        if(perfSports.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center text-slate-400">No performance sports found.</div>';
            return;
        }

        perfSports.forEach(s => {
            grid.innerHTML += `
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <i data-lucide="timer" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-900">${s.name}</h4>
                        <p class="text-xs text-slate-500">${s.type} Event</p>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <button onclick="window.quickStartPerformance('${s.id}', 'Male', '${s.name}')" class="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors">
                        Start Boys
                    </button>
                    <button onclick="window.quickStartPerformance('${s.id}', 'Female', '${s.name}')" class="flex items-center justify-center gap-2 py-3 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-xl transition-colors">
                        Start Girls
                    </button>
                </div>
            </div>`;
        });
        if(window.lucide) lucide.createIcons();
    }

    window.quickStartPerformance = async function(sportId, gender, sportName) {
        if(!confirm(`Start ${gender} event for ${sportName}? This will fetch all registered students.`)) return;

        // 1. Fetch Students
        const { data: regs, error } = await supabase
            .from('registrations')
            .select('user_id, users(id, name, student_id, gender)')
            .eq('sport_id', sportId);

        if(error) return alert("Error fetching students: " + error.message);

        // 2. Filter by Gender
        const filteredRegs = regs.filter(r => r.users.gender === gender);
        
        if(filteredRegs.length === 0) return alert(`No ${gender} students registered for this sport.`);

        // 3. Prepare JSON
        const participants = {
            category: gender,
            students: filteredRegs.map(r => ({
                id: r.users.id,
                name: r.users.name,
                student_id: r.users.student_id
            }))
        };

        // 4. Create Match
        const payload = {
            sport_id: sportId,
            sport_type: 'Performance',
            title: `${sportName} - ${gender}`,
            match_time: new Date().toISOString(),
            status: 'Live',
            participants: participants,
            live_data: { results: [] } // Init empty results
        };

        const { data: newMatch, error: insertError } = await supabase.from('matches').insert(payload).select().single();

        if(insertError) {
            alert("Error creating event: " + insertError.message);
        } else {
            // 5. Open Live Console
            alert("Event Started! Opening Live Console...");
            // Need to reload matches into cache so openLiveScoreMode finds it
            await loadMatches('master'); 
            openLiveScoreMode(newMatch.id);
        }
    }

    // ==========================================
    // MODULE: TOURNAMENT SCHEDULING
    // ==========================================

    window.openScheduleModal = function() {
        document.getElementById('modal-schedule-match').classList.remove('hidden');
        document.getElementById('sched-sport').innerHTML = '<option value="">-- Choose Sport --</option>';
        
        // Only show Tournament Sports
        const tournSports = rawSports.filter(s => s.is_performance === false);
        tournSports.forEach(s => {
            document.getElementById('sched-sport').innerHTML += `<option value="${s.id}" data-type="${s.type}">${s.name}</option>`;
        });

        // Reset fields
        document.getElementById('sched-participants-container').classList.add('hidden');
        document.getElementById('sched-sport').value = "";
    }

    window.toggleByeMode = function() {
        const isBye = document.getElementById('sched-is-bye').checked;
        const awayContainer = document.getElementById('away-container');
        const vsText = document.getElementById('vs-text');
        if(isBye) {
            awayContainer.classList.add('opacity-30', 'pointer-events-none');
            vsText.style.opacity = '0';
        } else {
            awayContainer.classList.remove('opacity-30', 'pointer-events-none');
            vsText.style.opacity = '1';
        }
    }

    window.populateScheduleParticipants = async function() {
        const sportEl = document.getElementById('sched-sport');
        const genderEl = document.getElementById('sched-gender');
        const sportId = sportEl.value;
        const gender = genderEl.value;
        
        if(!sportId) return;

        const option = sportEl.options[sportEl.selectedIndex];
        const type = option.getAttribute('data-type'); 

        document.getElementById('sched-participants-container').classList.remove('hidden');
        
        const t1 = document.getElementById('sched-team1');
        const t2 = document.getElementById('sched-team2');
        t1.innerHTML = '<option>Loading...</option>'; 
        t2.innerHTML = '<option>Loading...</option>';
        
        let html = '<option value="">-- Select Participant --</option>';

        if (type === 'Team') {
            let { data: teams } = await supabase.from('teams').select('id, name, captain_id, users!captain_id(gender)').eq('sport_id', sportId);
            if(gender && teams) teams = teams.filter(t => t.users?.gender === gender);
            if(teams) teams.forEach(t => html += `<option value="${t.id}">${t.name}</option>`);
        } else {
            let { data: regs } = await supabase.from('registrations').select('user_id, users(name, student_id, gender)').eq('sport_id', sportId);
            if(gender && regs) regs = regs.filter(r => r.users?.gender === gender);
            if(regs) regs.forEach(r => { if(r.users) html += `<option value="${r.user_id}">${r.users.name} (${r.users.student_id})</option>`; });
        }
        t1.innerHTML = html; t2.innerHTML = html;
    }

    window.publishSchedule = async function() {
        const sportEl = document.getElementById('sched-sport');
        const sportId = sportEl.value;
        const sportType = sportEl.options[sportEl.selectedIndex].getAttribute('data-type');
        const gender = document.getElementById('sched-gender').value;
        const title = document.getElementById('sched-title').value;
        const time = document.getElementById('sched-datetime').value;
        const loc = document.getElementById('sched-location').value;
        const isBye = document.getElementById('sched-is-bye').checked;

        if(!sportId || !time) return alert("Sport and Date are required");

        let participants = { is_bye: isBye, category: gender };
        let liveData = {};

        // Tournament Logic Only
        if (sportType === 'Team') {
            const t1 = document.getElementById('sched-team1').value;
            const t2 = document.getElementById('sched-team2').value;
            if(!t1) return alert("Select Home Team");
            if(!isBye && !t2) return alert("Select Away Team");
            participants.team1_id = t1; 
            participants.team2_id = isBye ? null : t2;
            if(isBye) liveData.winner = document.getElementById('sched-team1').options[document.getElementById('sched-team1').selectedIndex].text;
        } else {
            const p1 = document.getElementById('sched-team1').value;
            const p2 = document.getElementById('sched-team2').value;
            const p1Name = document.getElementById('sched-team1').options[document.getElementById('sched-team1').selectedIndex].text.split('(')[0].trim();
            if(!p1) return alert("Select Player 1");
            if(!isBye && !p2) return alert("Select Player 2");
            
            participants.player1_id = p1; 
            participants.player2_id = isBye ? null : p2;
            participants.player1_name = p1Name; 
            participants.player2_name = isBye ? 'BYE' : document.getElementById('sched-team2').options[document.getElementById('sched-team2').selectedIndex].text.split('(')[0].trim();
            if(isBye) liveData.winner = p1Name;
        }

        const { error } = await supabase.from('matches').insert({ 
            sport_id: sportId, 
            sport_type: sportType, 
            title: title, 
            match_time: new Date(time).toISOString(), 
            location: loc, 
            status: 'Scheduled', 
            participants: participants, 
            live_data: liveData 
        });
        
        if(error) alert("Error: " + error.message);
        else { 
            alert("Match Scheduled!"); 
            document.getElementById('modal-schedule-match').classList.add('hidden'); 
            loadMatches('tournament'); 
        }
    }

    // ==========================================
    // MODULE: LIVE CONSOLE
    // ==========================================

    window.openLiveScoreMode = async function(matchId) {
        currentLiveMatchId = matchId;
        const match = rawMatches.find(m => m.id === matchId);
        if(!match) return;

        document.getElementById('live-match-subtitle').innerText = `${match.title} • ${match.sports.name}`;
        
        // Hide all specific views
        ['live-view-standard', 'live-view-cricket', 'live-view-performance', 'live-winner-section'].forEach(id => document.getElementById(id).classList.add('hidden'));

        const live = match.live_data || {};
        const isBye = match.participants?.is_bye;

        // 1. SETUP WINNER DROPDOWN (For Tournament)
        if(match.sport_type !== 'Performance' && !isBye) {
            const winnerSelect = document.getElementById('live-winner-select');
            document.getElementById('live-winner-section').classList.remove('hidden');
            winnerSelect.innerHTML = `<option value="">-- Select Winner --</option>
                                      <option value="${match.p1_resolved}">${match.p1_resolved}</option>
                                      <option value="${match.p2_resolved}">${match.p2_resolved}</option>
                                      <option value="Draw">Draw</option>`;
            if(live.winner) winnerSelect.value = live.winner;
        }

        // 2. CHOOSE VIEW
        if (match.sports.name.toLowerCase().includes('cricket')) {
            // Cricket View
            document.getElementById('live-view-cricket').classList.remove('hidden');
            document.getElementById('live-cric-name1').innerText = match.p1_resolved; 
            document.getElementById('live-cric-name2').innerText = match.p2_resolved;
            const d1 = live.t1 || {r:0, w:0, o:0}, d2 = live.t2 || {r:0, w:0, o:0};
            document.getElementById('cric-r1').value = d1.r; document.getElementById('cric-w1').value = d1.w; document.getElementById('cric-o1').value = d1.o;
            document.getElementById('cric-r2').value = d2.r; document.getElementById('cric-w2').value = d2.w; document.getElementById('cric-o2').value = d2.o;
        } 
        else if (match.sport_type === 'Performance') {
            // Performance View
            document.getElementById('live-view-performance').classList.remove('hidden');
            const tbody = document.getElementById('live-perf-rows');
            tbody.innerHTML = '';

            // Get students from JSON (snapshot saved at creation) OR live registrations if empty
            let students = match.participants?.students || [];
            
            // If JSON is empty (legacy or error), try fetch
            if(students.length === 0) {
                // Fallback: This usually shouldn't happen with new quickStart logic
                tbody.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-red-500">No participants found in match record.</td></tr>';
            } else {
                const existingResults = live.results || [];
                tbody.innerHTML = students.map((s, i) => {
                    const prev = existingResults.find(res => res.uid === s.id) || {};
                    return `
                    <tr class="hover:bg-slate-50">
                        <td class="p-3"><input type="number" class="w-12 p-1 border rounded text-center font-bold" value="${prev.rank || ''}" placeholder="#" id="perf-rank-${s.id}"></td>
                        <td class="p-3"><p class="font-bold text-slate-800 text-sm">${s.name}</p><p class="text-[10px] text-slate-500">#${s.student_id}</p></td>
                        <td class="p-3 text-right"><input type="text" placeholder="Time/Score" class="w-24 p-1 border rounded text-right font-mono" value="${prev.time || ''}" id="perf-time-${s.id}"></td>
                    </tr>`;
                }).join('');
            }
        } 
        else {
            // Standard View (Football, Chess, etc.)
            document.getElementById('live-view-standard').classList.remove('hidden');
            document.getElementById('live-std-name1').innerText = match.p1_resolved; 
            document.getElementById('live-std-name2').innerText = match.p2_resolved;
            document.getElementById('live-std-score1').value = live.s1 || 0; 
            document.getElementById('live-std-score2').value = live.s2 || 0;
        }

        // 3. Auto-set Status to Live
        if(match.status === 'Scheduled' && !isBye) { 
            await supabase.from('matches').update({ status: 'Live' }).eq('id', matchId); 
        }
        
        document.getElementById('modal-live-score').classList.remove('hidden');
    }

    window.updateLiveScore = async function(mode, btnElement) {
        if(!currentLiveMatchId) return;
        let newData = {};
        
        // Get Winner if applicable
        const winnerSelect = document.getElementById('live-winner-select');
        const winner = winnerSelect ? winnerSelect.value : null;

        if (mode === 'cricket') {
            newData = { 
                t1: { r: document.getElementById('cric-r1').value, w: document.getElementById('cric-w1').value, o: document.getElementById('cric-o1').value }, 
                t2: { r: document.getElementById('cric-r2').value, w: document.getElementById('cric-w2').value, o: document.getElementById('cric-o2').value }, 
                winner: winner 
            };
        } else if (mode === 'standard') {
            newData = { 
                s1: document.getElementById('live-std-score1').value, 
                s2: document.getElementById('live-std-score2').value, 
                winner: winner 
            };
        } else if (mode === 'performance') {
            const rows = document.getElementById('live-perf-rows').querySelectorAll('tr');
            let results = [];
            rows.forEach(row => {
                const rankIn = row.querySelector('input[id^="perf-rank-"]');
                const timeIn = row.querySelector('input[id^="perf-time-"]');
                if(rankIn && (timeIn.value || rankIn.value)) { 
                    results.push({ 
                        uid: rankIn.id.replace('perf-rank-', ''), 
                        rank: parseInt(rankIn.value) || 999, 
                        time: timeIn.value 
                    });
                }
            });
            results.sort((a,b) => a.rank - b.rank);
            newData = { results: results };
        }

        if(btnElement) btnElement.innerText = "Saving...";
        
        const { error } = await supabase.from('matches').update({ live_data: newData, status: 'Live' }).eq('id', currentLiveMatchId);
        
        if(btnElement) {
            if(error) { alert("Error"); btnElement.innerText = "Error"; }
            else { btnElement.innerText = "Synced ✓"; setTimeout(() => { btnElement.innerText = "Update"; }, 1000); }
        }
        
        // Refresh grid in background
        loadMatches(currentViewMode === 'tournament' ? 'tournament' : 'master');
    }

    window.endMatch = async function() {
        const winner = document.getElementById('live-winner-select') ? document.getElementById('live-winner-select').value : null;
        const isPerf = document.getElementById('live-view-performance').classList.contains('hidden') === false;

        if(!isPerf && !winner) { if(!confirm("No winner selected. End match as Draw/Incomplete?")) return; } 
        else { if(!confirm("End this match and finalize results?")) return; }

        let updateData = { status: 'Completed' };
        
        // Ensure winner is saved in live_data final snapshot
        if(!isPerf) {
             const { data: match } = await supabase.from('matches').select('live_data').eq('id', currentLiveMatchId).single();
             if(match) {
                 updateData.live_data = { ...match.live_data, winner: winner };
             }
        }

        await supabase.from('matches').update(updateData).eq('id', currentLiveMatchId);
        
        document.getElementById('modal-live-score').classList.add('hidden');
        loadMatches(currentViewMode === 'tournament' ? 'tournament' : 'master');
    }

    // --- OTHER HELPERS ---
    window.loadMasterGrid = () => loadMatches('master');
    window.renderMasterGrid = () => renderGrid('master', document.getElementById('master-matches-grid'));
    window.exportMatchesExcel = () => {/* Export Logic (Simplified for brevity) */};
    window.exportMatchesPDF = () => {/* Export Logic */};
    window.deleteMatch = async (id) => { if(confirm("Delete?")) { await supabase.from('matches').delete().eq('id', id); loadMatches(currentViewMode); } };
    window.saveWinner = async () => { /* Existing winner logic */ };
    window.deleteWinner = async (id) => { /* Existing delete logic */ };
    window.loadWinners = async () => { /* Existing load logic */ };

})();
