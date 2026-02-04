// ==========================================
// OJAS 2026 - ADMIN PORTAL CONTROLLER (V3)
// ==========================================

(function() { 

    // --- 1. CONFIGURATION ---
    const SUPABASE_URL = 'https://sijmmlhltkksykhbuatn.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_9GjhwaWzz0McozvxVMINyQ_ZFU58z7F'; 
    const ADMIN_PASS = 'admin1205'; 

    // Initialize Supabase
    if(!window.supabase) return console.error("Supabase not loaded");
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Global State Cache
    let rawRegistrations = [];
    let rawTeams = [];
    let rawSports = [];
    let rawMatches = [];
    
    // UI State
    let currentManageTeamId = null;
    let currentUserProfileId = null; 
    let currentLiveMatchId = null; 
    let searchDebounceTimer = null;
    
    // Admin Session State
    let isAdminUser = false;
    let currentAdmin = null; 

    // --- 2. INITIALIZATION & RBAC ---
    document.addEventListener('DOMContentLoaded', async () => {
        const passField = document.getElementById('admin-pass');
        if(passField) passField.value = '';

        if(window.lucide) lucide.createIcons();
        await verifyAdminRole();
    });

    async function verifyAdminRole() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id'); 

        if (!urlId) {
            renderAccessDenied("No ID Provided", "Please ensure the URL contains your ID.");
            return;
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('id, name, student_id, role')
            .eq('student_id', urlId)
            .single();

        if (error || !user || user.role !== 'admin') {
            console.warn("Auth Failed:", error || "Role mismatch");
            renderAccessDenied("Unauthorized", "Your account does not have Administrator privileges.");
            return;
        }

        isAdminUser = true;
        currentAdmin = user;
        console.log(`Admin Verified: ${user.name} (${user.student_id})`);
    }

    function renderAccessDenied(title, msg) {
        document.body.innerHTML = `
        <div class="flex h-screen items-center justify-center bg-slate-900 text-white flex-col text-center p-4">
            <div class="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4 text-red-500">
                <i data-lucide="shield-alert" class="w-8 h-8"></i>
            </div>
            <h1 class="text-3xl font-bold mb-2">${title}</h1>
            <p class="text-slate-400 max-w-md">${msg}</p>
        </div>`;
        if(window.lucide) lucide.createIcons();
    }

    // --- 3. ACTIVITY LOGGING SYSTEM ---
    async function logActivity(actionType, details) {
        if (!currentAdmin) return;
        console.log(`[LOG] ${actionType}: ${details}`);
        supabase.from('activity_logs').insert({
            admin_id: currentAdmin.id,
            admin_name: currentAdmin.name,
            action_type: actionType,
            details: details
        }).then(({ error }) => { if (error) console.error("Logging failed:", error); });
    }

    // --- 4. APP UNLOCK ---
    window.checkAdminAuth = function() {
        if(!isAdminUser) return; 
        const input = document.getElementById('admin-pass').value;
        const err = document.getElementById('login-error');
        
        if (input === ADMIN_PASS) {
            unlockApp();
        } else {
            err.classList.remove('hidden');
            setTimeout(() => err.classList.add('hidden'), 2000);
        }
    }

    function unlockApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('admin-app').classList.remove('hidden');
        
        loadDashboardStats();
        fetchSportsList();
        loadTeams(); 
        
        switchView('dashboard');
    }

    // --- 5. NAVIGATION ---
    window.switchView = function(viewId) {
        document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('[id^="nav-"]').forEach(el => {
            el.classList.replace('text-indigo-600', 'text-slate-500');
            el.classList.replace('bg-indigo-50', 'hover:bg-slate-50');
            el.classList.remove('font-semibold');
        });

        const target = document.getElementById(`view-${viewId}`);
        if(target) target.classList.remove('hidden');

        const nav = document.getElementById(`nav-${viewId}`);
        if(nav) {
            nav.classList.replace('text-slate-500', 'text-indigo-600');
            nav.classList.replace('hover:bg-slate-50', 'bg-indigo-50');
            nav.classList.add('font-semibold');
        }

        if (viewId === 'registrations') loadRegistrations();
        if (viewId === 'teams') loadTeams();
        if (viewId === 'winners') loadWinners();
        if (viewId === 'matches') loadMatches();
    }

    // --- 6. DATA FETCHING ---
    async function fetchSportsList() {
        const { data } = await supabase.from('sports').select('*').order('name');
        if (data) {
            rawSports = data;
            ['reg-filter-sport', 'team-filter-sport', 'new-team-sport', 'winner-sport', 'um-sport-select', 'sched-sport'].forEach(id => {
                const el = document.getElementById(id);
                if(el) {
                    if(id === 'sched-sport') {
                         el.innerHTML = '<option value="">-- Choose Sport --</option>';
                         data.forEach(s => el.innerHTML += `<option value="${s.id}" data-type="${s.type}">${s.name}</option>`);
                         el.addEventListener('change', handleScheduleSportChange);
                    } else {
                        const hasAll = el.querySelector('option[value="All"]');
                        el.innerHTML = hasAll ? '<option value="All">All Sports</option>' : '';
                        data.forEach(s => {
                            const val = id.includes('filter') ? s.name : s.id;
                            el.innerHTML += `<option value="${val}">${s.name}</option>`;
                        });
                    }
                }
            });
        }
    }

    async function loadDashboardStats() {
        const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        document.getElementById('stat-users').innerText = userCount || 0;

        const { count: regCount } = await supabase.from('registrations').select('*', { count: 'exact', head: true });
        document.getElementById('stat-regs').innerText = regCount || 0;

        const { count: teamCount } = await supabase.from('teams').select('*', { count: 'exact', head: true });
        document.getElementById('stat-teams').innerText = teamCount || 0;
    }

    // ==========================================
    // MODULE: MATCHES & LIVE SCORES (UPDATED)
    // ==========================================

    // A. LOAD MATCHES
    window.loadMatches = async function() {
        const grid = document.getElementById('matches-grid');
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400">Loading matches...</div>';

        // Fetch matches with sport info
        const { data, error } = await supabase
            .from('matches')
            .select(`*, sports (name, type, icon)`)
            .order('match_time', { ascending: true });

        if (error) {
            grid.innerHTML = `<div class="col-span-full text-red-500 text-center">Error loading matches: ${error.message}</div>`;
            return;
        }

        // We need to fetch participant names (Teams or Users)
        // Optimization: Fetch all needed IDs in one go, but for simplicity here we fetch individually or use cache
        rawMatches = data;
        renderMatchesGrid();
    }

    async function renderMatchesGrid() {
        const grid = document.getElementById('matches-grid');
        grid.innerHTML = '';

        if(rawMatches.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center py-12 border border-dashed border-slate-300 rounded-2xl">
                <p class="text-slate-500 font-bold">No matches scheduled yet.</p>
                <button onclick="window.openScheduleModal()" class="text-indigo-600 text-sm mt-2 hover:underline">Schedule your first match</button>
            </div>`;
            return;
        }

        for (const match of rawMatches) {
            let p1Name = 'TBD', p2Name = 'TBD';
            let scoreDisplay = '0 - 0';
            let statusColor = 'bg-slate-100 text-slate-600';

            // 1. Resolve Participant Names
            const parts = match.participants || {};
            
            if (match.sport_type === 'Team') {
                // Fetch from cached teams
                const t1 = rawTeams.find(t => t.id === parts.team1_id);
                const t2 = rawTeams.find(t => t.id === parts.team2_id);
                p1Name = t1 ? t1.name : 'Unknown Team';
                p2Name = t2 ? t2.name : 'Unknown Team';
            } 
            else if (match.sport_type === 'Individual') {
                // Fetch Names (Ideally cache this, but doing simple lookup for now)
                // We display ID if name fetch is slow or complexity is high for demo
                // NOTE: In production, join 'users' in the initial query or fetch batch
                if(parts.player1_name) p1Name = parts.player1_name; 
                else p1Name = "Player 1"; // Fallback if not stored
                
                if(parts.player2_name) p2Name = parts.player2_name;
                else p2Name = "Player 2";
            }
            else if (match.sport_type === 'Performance') {
                p1Name = 'Multiple';
                p2Name = 'Participants';
            }

            // 2. Status Styling
            if(match.status === 'Live') statusColor = 'bg-red-100 text-red-600 animate-pulse';
            if(match.status === 'Completed') statusColor = 'bg-green-100 text-green-600';

            // 3. Score Display Logic
            const live = match.live_data || {};
            if(match.sports.name.toLowerCase().includes('cricket')) {
                const s1 = live.t1 ? `${live.t1.r}/${live.t1.w}` : '0/0';
                const s2 = live.t2 ? `${live.t2.r}/${live.t2.w}` : '0/0';
                scoreDisplay = `${s1} vs ${s2}`;
            } else if (match.sport_type === 'Performance') {
                scoreDisplay = 'View Results';
            } else {
                scoreDisplay = `${live.s1 || 0} - ${live.s2 || 0}`;
            }

            // 4. Render Card
            const card = document.createElement('div');
            card.className = "bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col";
            
            let vsSection = '';
            if (match.sport_type === 'Performance') {
                vsSection = `<div class="py-4"><span class="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">Event Started</span></div>`;
            } else {
                vsSection = `
                <div class="flex justify-between items-center mb-4 px-4 gap-2">
                    <span class="font-bold text-slate-800 w-1/3 truncate text-right text-sm" title="${p1Name}">${p1Name}</span>
                    <span class="text-[10px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded">VS</span>
                    <span class="font-bold text-slate-800 w-1/3 truncate text-left text-sm" title="${p2Name}">${p2Name}</span>
                </div>`;
            }

            card.innerHTML = `
                <div class="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold uppercase tracking-wider text-slate-500">${match.sports.name}</span>
                        <span class="px-2 py-0.5 text-[10px] font-bold rounded ${statusColor}">${match.status}</span>
                    </div>
                    <div class="text-xs font-mono text-slate-400">${new Date(match.match_time).toLocaleDateString()}</div>
                </div>
                <div class="p-6 text-center flex-1 flex flex-col justify-center">
                    <p class="text-xs font-bold text-slate-400 mb-2 uppercase">${match.title || 'Match'}</p>
                    
                    ${vsSection}

                    <div class="bg-slate-900 text-white py-3 rounded-xl mb-4 relative overflow-hidden group">
                        <span class="text-xl font-mono font-bold tracking-widest relative z-10">${scoreDisplay}</span>
                    </div>

                    <div class="grid grid-cols-2 gap-2 mt-auto">
                         <button onclick="window.openLiveScoreMode('${match.id}')" class="py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                            ${match.status === 'Completed' ? 'Edit Result' : (match.sport_type === 'Performance' ? 'Manage Results' : 'Live Console')}
                         </button>
                         <button onclick="window.deleteMatch('${match.id}')" class="py-2 bg-white border border-slate-200 text-red-500 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors">
                            Delete
                         </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        }
        if(window.lucide) lucide.createIcons();
    }

    // B. SCHEDULE MATCH (FIXED LOGIC)
    window.openScheduleModal = () => {
        document.getElementById('modal-schedule-match').classList.remove('hidden');
        document.getElementById('sched-participants-container').classList.add('hidden'); 
        document.getElementById('sched-sport').value = "";
    }

    window.handleScheduleSportChange = async function(e) {
        const sportId = e.target.value;
        const option = e.target.options[e.target.selectedIndex];
        const type = option.getAttribute('data-type'); // 'Team' | 'Individual' | 'Performance'
        
        const container = document.getElementById('sched-participants-container');
        const teamView = document.getElementById('sched-type-team');
        const perfView = document.getElementById('sched-type-performance');
        
        container.classList.remove('hidden');
        
        // 1. PERFORMANCE: No dropdowns needed
        if (type === 'Performance') {
            teamView.classList.add('hidden');
            perfView.classList.remove('hidden');
        } 
        // 2. VERSUS (Team OR Individual)
        else {
            perfView.classList.add('hidden');
            teamView.classList.remove('hidden');
            
            const t1Select = document.getElementById('sched-team1');
            const t2Select = document.getElementById('sched-team2');
            t1Select.innerHTML = '<option>Loading...</option>';
            t2Select.innerHTML = '<option>Loading...</option>';
            
            let html = '<option value="">-- Select Participant --</option>';

            if (type === 'Team') {
                // Fetch Teams
                const { data: teams } = await supabase.from('teams').select('id, name').eq('sport_id', sportId);
                if(teams) teams.forEach(t => html += `<option value="${t.id}">${t.name}</option>`);
            } 
            else if (type === 'Individual') {
                // FIX: Fetch Individual Students from Registrations
                const { data: regs } = await supabase
                    .from('registrations')
                    .select('user_id, users(name, student_id)')
                    .eq('sport_id', sportId);
                
                if(regs) {
                    regs.forEach(r => {
                        if(r.users) html += `<option value="${r.user_id}">${r.users.name} (${r.users.student_id})</option>`;
                    });
                }
            }
            
            t1Select.innerHTML = html;
            t2Select.innerHTML = html;
        }
    }

    window.publishSchedule = async function() {
        const sportEl = document.getElementById('sched-sport');
        const sportId = sportEl.value;
        const sportType = sportEl.options[sportEl.selectedIndex].getAttribute('data-type');
        
        const title = document.getElementById('sched-title').value;
        const time = document.getElementById('sched-datetime').value;
        const loc = document.getElementById('sched-location').value;

        if(!sportId || !time) return alert("Sport and Date are required");

        let participants = {};
        
        if (sportType === 'Team') {
            const t1 = document.getElementById('sched-team1').value;
            const t2 = document.getElementById('sched-team2').value;
            if(!t1 || !t2) return alert("Select both teams");
            participants = { team1_id: t1, team2_id: t2 };
        } 
        else if (sportType === 'Individual') {
            const p1 = document.getElementById('sched-team1').value;
            const p2 = document.getElementById('sched-team2').value;
            const p1Name = document.getElementById('sched-team1').options[document.getElementById('sched-team1').selectedIndex].text;
            const p2Name = document.getElementById('sched-team2').options[document.getElementById('sched-team2').selectedIndex].text;

            if(!p1 || !p2) return alert("Select both players");
            participants = { 
                player1_id: p1, player2_id: p2,
                player1_name: p1Name.split('(')[0].trim(), // Store name for easy display
                player2_name: p2Name.split('(')[0].trim()
            };
        }
        else if (sportType === 'Performance') {
            participants = null; // Will fetch dynamically
        }

        const payload = {
            sport_id: sportId,
            sport_type: sportType,
            title: title,
            match_time: new Date(time).toISOString(),
            location: loc,
            status: 'Scheduled',
            participants: participants,
            live_data: {} 
        };

        const { error } = await supabase.from('matches').insert(payload);
        
        if(error) {
            alert("Error: " + error.message);
        } else {
            alert("Event Scheduled!");
            document.getElementById('modal-schedule-match').classList.add('hidden');
            loadMatches();
            logActivity("SCHEDULE_MATCH", `Scheduled ${sportType} match: ${title}`);
        }
    }

    window.deleteMatch = async function(id) {
        if(!confirm("Delete this match?")) return;
        await supabase.from('matches').delete().eq('id', id);
        loadMatches();
        logActivity("DELETE_MATCH", `Deleted match ID: ${id}`);
    }

    // C. LIVE SCORE CONTROL (FIXED)
    window.openLiveScoreMode = async function(matchId) {
        currentLiveMatchId = matchId;
        const match = rawMatches.find(m => m.id === matchId);
        if(!match) return;

        document.getElementById('live-match-subtitle').innerText = `${match.title} • ${match.sports.name}`;
        
        // Hide all views first
        document.getElementById('live-view-standard').classList.add('hidden');
        document.getElementById('live-view-cricket').classList.add('hidden');
        document.getElementById('live-view-performance').classList.add('hidden');

        const live = match.live_data || {};

        // 1. CRICKET VIEW
        if (match.sports.name.toLowerCase().includes('cricket')) {
            document.getElementById('live-view-cricket').classList.remove('hidden');
            
            // Set Names (Check if Team or Individual, usually Team for Cricket)
            const parts = match.participants || {};
            let n1 = "Team A", n2 = "Team B";
            
            if(match.sport_type === 'Team') {
                const t1 = rawTeams.find(t => t.id === parts.team1_id);
                const t2 = rawTeams.find(t => t.id === parts.team2_id);
                if(t1) n1 = t1.name;
                if(t2) n2 = t2.name;
            }

            document.getElementById('live-cric-name1').innerText = n1;
            document.getElementById('live-cric-name2').innerText = n2;

            // Fill Data
            const d1 = live.t1 || {r:0, w:0, o:0};
            const d2 = live.t2 || {r:0, w:0, o:0};
            
            document.getElementById('cric-r1').value = d1.r; document.getElementById('cric-w1').value = d1.w; document.getElementById('cric-o1').value = d1.o;
            document.getElementById('cric-r2').value = d2.r; document.getElementById('cric-w2').value = d2.w; document.getElementById('cric-o2').value = d2.o;
        } 
        // 2. PERFORMANCE VIEW (Race)
        else if (match.sport_type === 'Performance') {
            document.getElementById('live-view-performance').classList.remove('hidden');
            const tbody = document.getElementById('live-perf-rows');
            tbody.innerHTML = '<tr><td colspan="3" class="text-center p-4">Loading participants...</td></tr>';

            // Fetch all students registered for this sport
            const { data: regs } = await supabase
                .from('registrations')
                .select('id, users(id, name, student_id)')
                .eq('sport_id', match.sport_id);

            if(regs) {
                const existingResults = live.results || []; 

                tbody.innerHTML = regs.map((r, index) => {
                    const u = r.users;
                    // Find if this user has a result already
                    const prev = existingResults.find(res => res.uid === u.id) || {};
                    return `
                    <tr class="hover:bg-slate-50">
                        <td class="p-3"><input type="number" class="w-12 p-1 border rounded text-center font-bold" value="${prev.rank || ''}" placeholder="#" id="perf-rank-${u.id}"></td>
                        <td class="p-3">
                            <p class="font-bold text-slate-800 text-sm">${u.name}</p>
                            <p class="text-[10px] text-slate-500">#${u.student_id}</p>
                        </td>
                        <td class="p-3 text-right">
                            <input type="text" placeholder="Time/Score" class="w-24 p-1 border rounded text-right font-mono" value="${prev.time || ''}" id="perf-time-${u.id}">
                        </td>
                    </tr>`;
                }).join('');
            }
        } 
        // 3. STANDARD VIEW (Football, Badminton, Chess)
        else {
            document.getElementById('live-view-standard').classList.remove('hidden');
            const parts = match.participants || {};
            let n1 = "Player 1", n2 = "Player 2";

            if (match.sport_type === 'Team') {
                const t1 = rawTeams.find(t => t.id === parts.team1_id);
                const t2 = rawTeams.find(t => t.id === parts.team2_id);
                if(t1) n1 = t1.name; if(t2) n2 = t2.name;
            } else {
                n1 = parts.player1_name || "Player A";
                n2 = parts.player2_name || "Player B";
            }

            document.getElementById('live-std-name1').innerText = n1;
            document.getElementById('live-std-name2').innerText = n2;
            document.getElementById('live-std-score1').value = live.s1 || 0;
            document.getElementById('live-std-score2').value = live.s2 || 0;
        }

        // Set status to Live automatically if opened
        if(match.status === 'Scheduled') {
            await supabase.from('matches').update({ status: 'Live' }).eq('id', matchId);
        }

        document.getElementById('modal-live-score').classList.remove('hidden');
    }

    // FIX: Passing 'btn' explicitly or handling without event.target
    window.updateLiveScore = async function(mode, btnElement) {
        if(!currentLiveMatchId) return;
        let newData = {};

        if (mode === 'cricket') {
            newData = {
                t1: {
                    r: document.getElementById('cric-r1').value,
                    w: document.getElementById('cric-w1').value,
                    o: document.getElementById('cric-o1').value
                },
                t2: {
                    r: document.getElementById('cric-r2').value,
                    w: document.getElementById('cric-w2').value,
                    o: document.getElementById('cric-o2').value
                }
            };
        } else if (mode === 'standard') {
            newData = {
                s1: document.getElementById('live-std-score1').value,
                s2: document.getElementById('live-std-score2').value
            };
        } else if (mode === 'performance') {
            const rows = document.getElementById('live-perf-rows').querySelectorAll('tr');
            let results = [];
            rows.forEach(row => {
                const rankIn = row.querySelector('input[id^="perf-rank-"]');
                const timeIn = row.querySelector('input[id^="perf-time-"]');
                if(rankIn && timeIn) {
                    const uid = rankIn.id.replace('perf-rank-', '');
                    // Save if rank OR time is present
                    if(timeIn.value || rankIn.value) { 
                        results.push({
                            uid: uid,
                            rank: parseInt(rankIn.value) || 999,
                            time: timeIn.value
                        });
                    }
                }
            });
            results.sort((a,b) => a.rank - b.rank);
            newData = { results: results };
        }

        // Optimistic UI update (No waiting for loading spinner)
        if(btnElement) {
            const originalText = btnElement.innerText;
            btnElement.innerText = "Saving...";
            
            const { error } = await supabase
                .from('matches')
                .update({ live_data: newData, status: 'Live' })
                .eq('id', currentLiveMatchId);

            if(error) {
                alert("Sync Error: " + error.message);
                btnElement.innerText = originalText;
            } else {
                btnElement.innerText = "Synced ✓";
                btnElement.classList.add('bg-green-600', 'text-white');
                setTimeout(() => {
                    btnElement.innerText = originalText;
                    btnElement.classList.remove('bg-green-600', 'text-white');
                }, 1500);
                loadMatches();
            }
        } else {
            // Fallback if called without button ref
            await supabase.from('matches').update({ live_data: newData, status: 'Live' }).eq('id', currentLiveMatchId);
            loadMatches();
        }
    }

    window.endMatch = async function() {
        if(!confirm("End this match and finalize results?")) return;
        await supabase.from('matches').update({ status: 'Completed' }).eq('id', currentLiveMatchId);
        document.getElementById('modal-live-score').classList.add('hidden');
        loadMatches();
    }


    // ==========================================
    // MODULE: USER MANAGER (EXISTING)
    // ==========================================
    window.searchUserManager = function(query) {
        clearTimeout(searchDebounceTimer);
        const resultsEl = document.getElementById('user-manager-results');
        if (!query || query.length < 2) { resultsEl.classList.add('hidden'); return; }

        searchDebounceTimer = setTimeout(async () => {
            resultsEl.innerHTML = '<div class="p-4 text-xs text-slate-400 text-center">Searching...</div>';
            resultsEl.classList.remove('hidden');
            const { data } = await supabase.from('users').select('id, name, student_id, class_name, mobile').or(`name.ilike.%${query}%,student_id.ilike.%${query}%`).limit(5);

            if (data && data.length > 0) {
                resultsEl.innerHTML = data.map(u => `
                    <div onclick="loadUserProfile('${u.id}')" class="p-3 border-b border-slate-100 hover:bg-indigo-50 cursor-pointer last:border-0 flex justify-between items-center group">
                        <div><p class="text-sm font-bold text-slate-800 group-hover:text-indigo-700">${u.name}</p><p class="text-[10px] text-slate-500">${u.class_name} • #${u.student_id}</p></div>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300 group-hover:text-indigo-400"></i>
                    </div>`).join('');
                if(window.lucide) lucide.createIcons();
            } else { resultsEl.innerHTML = '<div class="p-3 text-xs text-red-400 text-center">No student found.</div>'; }
        }, 400);
    }

    window.loadUserProfile = async function(userId) {
        document.getElementById('user-manager-results').classList.add('hidden');
        document.getElementById('user-manager-search').value = ''; 
        currentUserProfileId = userId;
        const profileEl = document.getElementById('user-manager-profile');
        const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
        if(!user) return alert("User not found");

        document.getElementById('um-name').innerText = user.name;
        document.getElementById('um-class').innerText = user.class_name || 'N/A';
        document.getElementById('um-id').innerText = user.student_id || 'N/A';
        document.getElementById('um-contact').innerText = `Mobile: ${user.mobile || 'N/A'}`;
        await refreshUserRegistrations();
        profileEl.classList.remove('hidden');
    }

    async function refreshUserRegistrations() {
        const listEl = document.getElementById('um-regs-list');
        listEl.innerHTML = '<p class="p-4 text-xs text-slate-400">Loading registrations...</p>';
        const { data: regs } = await supabase.from('registrations').select('id, sports(name, type)').eq('user_id', currentUserProfileId);
        document.getElementById('um-reg-count').innerText = regs ? regs.length : 0;

        if(!regs || regs.length === 0) { listEl.innerHTML = '<p class="p-6 text-center text-sm text-slate-400 italic">No active registrations.</p>'; } 
        else {
            listEl.innerHTML = regs.map(r => `
                <div class="p-4 flex justify-between items-center hover:bg-slate-50">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">${r.sports.name.substring(0,2).toUpperCase()}</div>
                        <div><p class="text-sm font-bold text-slate-800">${r.sports.name}</p><p class="text-[10px] text-slate-500 uppercase">${r.sports.type}</p></div>
                    </div>
                    <button onclick="adminWithdrawUser('${r.id}', '${r.sports.name}')" class="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>`).join('');
            if(window.lucide) lucide.createIcons();
        }
    }

    window.adminRegisterUser = async function() {
        if(!currentUserProfileId) return;
        const sportSelect = document.getElementById('um-sport-select');
        const sportId = sportSelect.value;
        const sportName = sportSelect.options[sportSelect.selectedIndex].text;
        if(!sportId) return alert("Select a sport first");
        const { data: existing } = await supabase.from('registrations').select('id').eq('user_id', currentUserProfileId).eq('sport_id', sportId);
        if(existing && existing.length > 0) return alert("Student is already registered.");
        const { error } = await supabase.from('registrations').insert({ user_id: currentUserProfileId, sport_id: sportId });
        if(error) alert("Error: " + error.message);
        else { await logActivity("MANUAL_REGISTER", `Registered user (ID: ${currentUserProfileId}) for ${sportName}`); alert("Registration Added!"); refreshUserRegistrations(); }
    }

    window.adminWithdrawUser = async function(regId, sportName) {
        if(!confirm("Are you sure?")) return;
        const { error } = await supabase.from('registrations').delete().eq('id', regId);
        if(error) alert("Error: " + error.message);
        else { await logActivity("MANUAL_WITHDRAW", `Withdrew user from ${sportName}`); refreshUserRegistrations(); }
    }

    // ==========================================
    // MODULE: TEAMS & REGISTRATIONS (EXISTING)
    // ==========================================
    async function loadRegistrations() {
        const loader = document.getElementById('regs-loader');
        const tbody = document.getElementById('regs-tbody');
        loader.classList.remove('hidden'); tbody.innerHTML = '';
        const { data, error } = await supabase.from('registrations').select(`id, created_at, users (name, student_id, class_name, mobile, gender), sports (name)`).order('created_at', { ascending: false });
        if (!error && data) { rawRegistrations = data; renderRegistrationsTable(); }
        loader.classList.add('hidden');
    }

    window.renderRegistrationsTable = function() {
        const search = document.getElementById('reg-search').value.toLowerCase();
        const fSport = document.getElementById('reg-filter-sport').value;
        const filtered = rawRegistrations.filter(r => {
            const u = r.users || {};
            return ((u.name || '').toLowerCase().includes(search) || (u.student_id || '').toString().includes(search)) && (fSport === 'All' || r.sports?.name === fSport);
        });
        document.getElementById('regs-tbody').innerHTML = filtered.map(r => `
            <tr class="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                <td class="p-4 font-bold text-slate-900">${r.users?.name || 'Unknown'}</td>
                <td class="p-4"><span class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold">${r.sports?.name || '-'}</span></td>
                <td class="p-4 text-xs font-mono text-slate-600">${r.users?.class_name || '-'} <span class="text-slate-400">#${r.users?.student_id}</span></td>
                <td class="p-4 text-xs font-medium text-slate-600">${r.users?.gender || '-'}</td>
                <td class="p-4 text-xs text-slate-600">${r.users?.mobile || '-'}</td>
                <td class="p-4 text-xs text-slate-400 text-right">${new Date(r.created_at).toLocaleDateString()}</td>
            </tr>`).join('');
    }

    window.loadTeams = async function() {
        const loader = document.getElementById('teams-loader');
        const grid = document.getElementById('teams-grid');
        loader.classList.remove('hidden'); grid.innerHTML = '';
        const { data, error } = await supabase.from('teams').select(`*, sports (name, team_size), users!captain_id (name, class_name, gender, mobile, student_id), team_members (status, users (name, class_name, gender, mobile, student_id))`).order('created_at', { ascending: false });
        if (!error && data) {
            rawTeams = data.map(t => ({ ...t, activeMembers: t.team_members.filter(m => m.status === 'Accepted'), memberCount: t.team_members.filter(m => m.status === 'Accepted').length }));
            renderTeamsGrid();
        }
        loader.classList.add('hidden');
    }

    window.renderTeamsGrid = function() {
        const search = document.getElementById('team-search').value.toLowerCase();
        const fSport = document.getElementById('team-filter-sport').value;
        let filtered = rawTeams.filter(t => (t.name.toLowerCase().includes(search) || (t.users?.name || '').toLowerCase().includes(search)) && (fSport === 'All' || t.sports?.name === fSport));
        document.getElementById('teams-grid').innerHTML = filtered.map(t => {
            const max = t.sports?.team_size || 0;
            const pct = Math.min(100, (t.memberCount / max) * 100);
            return `
            <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                <div class="flex justify-between items-start mb-2"><h4 class="font-bold text-slate-900 text-lg leading-tight w-3/4 truncate">${t.name}</h4><span class="px-2 py-0.5 text-[10px] font-bold uppercase rounded border bg-slate-50 text-slate-600">${t.status}</span></div>
                <p class="text-xs text-slate-500 mb-3">Capt: <span class="font-bold text-slate-700">${t.users?.name || 'Unknown'}</span></p>
                <div class="flex items-center gap-2 mb-4"><span class="text-[10px] font-bold text-white bg-slate-800 px-2 py-1 rounded">${t.sports?.name}</span></div>
                <div class="w-full bg-slate-100 rounded-full h-1.5 mb-2 overflow-hidden"><div class="bg-indigo-600 h-1.5 rounded-full" style="width: ${pct}%"></div></div>
                <div class="flex justify-between items-center text-xs mb-4"><span class="font-bold text-slate-500">${t.memberCount} / ${max} Players</span></div>
                <button onclick="window.openManageTeamModal('${t.id}')" class="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors border border-indigo-100">Manage Team</button>
            </div>`;
        }).join('');
        if(window.lucide) lucide.createIcons();
    }

    // --- TEAMS HELPERS ---
    window.searchUsers = function(query, resultsId, hiddenInputId) {
        clearTimeout(searchDebounceTimer);
        const resultsEl = document.getElementById(resultsId);
        if (!query || query.length < 2) { resultsEl.classList.add('hidden'); return; }
        searchDebounceTimer = setTimeout(async () => {
            resultsEl.classList.remove('hidden');
            const { data } = await supabase.from('users').select('id, name, student_id, class_name').or(`name.ilike.%${query}%,student_id.ilike.%${query}%`).limit(5);
            resultsEl.innerHTML = (data && data.length > 0) ? data.map(u => `
                <div onclick="selectUser('${u.id}', '${u.name}', '${resultsId}', '${hiddenInputId}')" class="p-3 border-b border-slate-100 hover:bg-indigo-50 cursor-pointer last:border-0"><p class="text-sm font-bold text-slate-800">${u.name}</p><p class="text-[10px] text-slate-500">${u.class_name} • #${u.student_id}</p></div>`).join('') : '<div class="p-3 text-xs text-red-400">No user found</div>';
        }, 400); 
    }

    window.selectUser = function(id, name, resultsId, inputId) {
        if(inputId === 'new-team-captain-id') document.getElementById('new-team-captain-search').value = name;
        if(inputId === 'add-player-id') document.getElementById('add-player-search').value = name;
        document.getElementById(inputId).value = id;
        document.getElementById(resultsId).classList.add('hidden');
    }

    window.openCreateTeamModal = () => document.getElementById('modal-create-team').classList.remove('hidden');
    
    window.createTeam = async function() {
        const name = document.getElementById('new-team-name').value;
        const sportSelect = document.getElementById('new-team-sport');
        const sportId = sportSelect.value;
        const captainId = document.getElementById('new-team-captain-id').value;
        if(!name || !sportId || !captainId) return alert("Please fill all fields");
        const { data: team, error } = await supabase.from('teams').insert({ name, sport_id: sportId, captain_id: captainId, status: 'Open' }).select().single();
        if (error) return alert("Error: " + error.message);
        await supabase.from('team_members').insert({ team_id: team.id, user_id: captainId, status: 'Accepted' });
        await logActivity("CREATE_TEAM", `Created team '${name}'`);
        alert("Team Created Successfully!"); document.getElementById('modal-create-team').classList.add('hidden'); loadTeams(); 
    }

    window.openManageTeamModal = function(teamId) {
        currentManageTeamId = teamId;
        const team = rawTeams.find(t => t.id === teamId);
        if(!team) return;
        document.getElementById('manage-team-title').innerText = team.name;
        document.getElementById('manage-team-subtitle').innerText = `${team.sports.name} • Captain: ${team.users.name}`;
        renderManageRoster(team);
        document.getElementById('modal-manage-team').classList.remove('hidden');
    }

    function renderManageRoster(team) {
        const tbody = document.getElementById('manage-team-roster');
        tbody.innerHTML = (team.activeMembers || []).map(m => `
            <tr>
                <td class="p-3"><p class="font-bold text-slate-900">${m.users.name}</p></td>
                <td class="p-3 text-xs font-mono text-slate-500">${m.users.class_name}</td>
                <td class="p-3 text-right">${m.users.student_id !== team.users.student_id ? `<button onclick="window.removeMember('${m.user_id}')" class="text-red-500 hover:bg-red-50 p-1 rounded"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}</td>
            </tr>`).join('');
        if(window.lucide) lucide.createIcons();
    }

    window.addMemberToTeam = async function() {
        const userId = document.getElementById('add-player-id').value;
        if (!userId || !currentManageTeamId) return alert("Select a player first");
        const { error } = await supabase.from('team_members').insert({ team_id: currentManageTeamId, user_id: userId, status: 'Accepted' });
        if (error) alert(error.message);
        else { await logActivity("ADD_MEMBER", `Added member to team`); await loadTeams(); openManageTeamModal(currentManageTeamId); }
    }

    window.removeMember = async function(userId) {
        if(!confirm("Remove this player?")) return;
        await supabase.from('team_members').delete().eq('team_id', currentManageTeamId).eq('user_id', userId);
        await logActivity("REMOVE_MEMBER", `Removed user from team`);
        await loadTeams(); openManageTeamModal(currentManageTeamId);
    }

    window.deleteTeam = async function() {
        if(!confirm("CRITICAL WARNING: Delete this team?")) return;
        await supabase.from('team_members').delete().eq('team_id', currentManageTeamId);
        await supabase.from('teams').delete().eq('id', currentManageTeamId);
        document.getElementById('modal-manage-team').classList.add('hidden'); loadTeams();
    }

    // ==========================================
    // MODULE: WINNERS & EXPORTS (EXISTING)
    // ==========================================
    async function loadWinners() {
        const container = document.getElementById('winners-list-container');
        container.innerHTML = '<div class="text-center py-4 text-slate-400">Loading...</div>';
        const { data } = await supabase.from('winners').select('*').order('created_at', { ascending: false });
        if(data) {
            rawWinners = data;
            container.innerHTML = data.length ? data.map(w => `
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                    <div><div class="flex items-center gap-2 mb-1"><span class="text-xs font-bold uppercase text-slate-500">${w.sport_name}</span><span class="text-[10px] bg-slate-100 px-2 rounded font-bold">${w.gender}</span></div>
                    <div class="flex gap-4 text-sm mt-2"><span class="text-yellow-600 font-bold">🥇 ${w.gold}</span><span class="text-slate-500 font-medium">🥈 ${w.silver}</span><span class="text-amber-700 font-medium">🥉 ${w.bronze}</span></div></div>
                    <button onclick="window.deleteWinner(${w.id})" class="text-red-400 hover:text-red-600 p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>`).join('') : '<div class="text-center py-8">No winners declared.</div>';
            if(window.lucide) lucide.createIcons();
        }
    }

    window.saveWinner = async function() {
        const sportSelect = document.getElementById('winner-sport');
        const sportName = sportSelect.options[sportSelect.selectedIndex].text;
        const gender = document.getElementById('winner-gender').value;
        const gold = document.getElementById('winner-gold').value;
        const silver = document.getElementById('winner-silver').value;
        const bronze = document.getElementById('winner-bronze').value;
        if(!gold) return alert("Gold winner is mandatory");
        const { error } = await supabase.from('winners').insert({ sport_name: sportName, gender, gold, silver, bronze });
        if(error) alert("Error: " + error.message); else { await logActivity("DECLARE_WINNER", `Declared winners for ${sportName}`); loadWinners(); }
    }

    window.deleteWinner = async function(id) {
        if(!confirm("Delete?")) return;
        await supabase.from('winners').delete().eq('id', id); loadWinners();
    }

    window.exportTableToExcel = function(tableId, filename) {
        const wb = XLSX.utils.table_to_book(document.getElementById(tableId));
        XLSX.writeFile(wb, `${filename}.xlsx`);
    }

    window.generateHighQualityPDF = function() {
        const { jsPDF } = window.jspdf; const doc = new jsPDF();
        doc.text("OJAS 2026 - Registrations", 14, 20);
        doc.autoTable({ html: '#regs-table', startY: 30, theme: 'grid' });
        doc.save('OJAS_Registrations.pdf');
    }

})();
