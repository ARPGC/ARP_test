// ==========================================
// OJAS 2026 - ADMIN PORTAL CONTROLLER
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
    let rawWinners = [];
    
    // UI State
    let currentManageTeamId = null;
    let searchDebounceTimer = null;

    // --- 2. INITIALIZATION & AUTH ---
    document.addEventListener('DOMContentLoaded', () => {
        // Clear sensitive fields
        const passField = document.getElementById('admin-pass');
        if(passField) passField.value = '';

        if(window.lucide) lucide.createIcons();
    });

    window.checkAdminAuth = function() {
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
        
        // Load Initial Data
        loadDashboardStats();
        fetchSportsList();
        
        // Default View
        switchView('dashboard');
    }

    // --- 3. NAVIGATION ---
    window.switchView = function(viewId) {
        // Hide all views
        document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('[id^="nav-"]').forEach(el => {
            el.classList.replace('text-indigo-600', 'text-slate-500');
            el.classList.replace('bg-indigo-50', 'hover:bg-slate-50');
            el.classList.remove('font-semibold');
        });

        // Show target
        const target = document.getElementById(`view-${viewId}`);
        if(target) target.classList.remove('hidden');

        // Update Nav
        const nav = document.getElementById(`nav-${viewId}`);
        if(nav) {
            nav.classList.replace('text-slate-500', 'text-indigo-600');
            nav.classList.replace('hover:bg-slate-50', 'bg-indigo-50');
            nav.classList.add('font-semibold');
        }

        // Lazy Load
        if (viewId === 'registrations') loadRegistrations();
        if (viewId === 'teams') loadTeams();
        if (viewId === 'winners') loadWinners();
    }

    // --- 4. SHARED DATA FETCHING ---
    async function fetchSportsList() {
        const { data } = await supabase.from('sports').select('id, name').order('name');
        if (data) {
            rawSports = data;
            // Populate all dropdowns
            ['reg-filter-sport', 'team-filter-sport', 'new-team-sport', 'winner-sport'].forEach(id => {
                const el = document.getElementById(id);
                if(el) {
                    // Keep "All" if it exists, else clear
                    const hasAll = el.querySelector('option[value="All"]');
                    el.innerHTML = hasAll ? '<option value="All">All Sports</option>' : '';
                    
                    data.forEach(s => {
                        el.innerHTML += `<option value="${id.includes('filter') ? s.name : s.id}">${s.name}</option>`;
                    });
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

    // --- 5. REGISTRATIONS MODULE ---
    async function loadRegistrations() {
        const loader = document.getElementById('regs-loader');
        const tbody = document.getElementById('regs-tbody');
        loader.classList.remove('hidden');
        tbody.innerHTML = '';

        const { data, error } = await supabase
            .from('registrations')
            .select(`
                id, created_at,
                users (name, student_id, class_name, mobile, gender),
                sports (name)
            `)
            .order('created_at', { ascending: false });

        if (!error && data) {
            rawRegistrations = data;
            renderRegistrationsTable();
        }
        loader.classList.add('hidden');
    }

    window.renderRegistrationsTable = function() {
        const search = document.getElementById('reg-search').value.toLowerCase();
        const fSport = document.getElementById('reg-filter-sport').value;
        const fGender = document.getElementById('reg-filter-gender').value;
        const fClass = document.getElementById('reg-filter-class').value;

        const filtered = rawRegistrations.filter(r => {
            const u = r.users || {};
            const matchesSearch = (u.name || '').toLowerCase().includes(search) || (u.student_id || '').toString().includes(search);
            const matchesSport = fSport === 'All' || r.sports?.name === fSport;
            const matchesGender = fGender === 'All' || u.gender === fGender;
            const matchesClass = fClass === 'All' || (u.class_name || '').startsWith(fClass); // StartsWith handles FY vs FYJC

            return matchesSearch && matchesSport && matchesGender && matchesClass;
        });

        document.getElementById('regs-tbody').innerHTML = filtered.map(r => `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                <td class="p-4 font-bold text-slate-900">${r.users?.name || 'Unknown'}</td>
                <td class="p-4"><span class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold">${r.sports?.name || '-'}</span></td>
                <td class="p-4 text-xs font-mono text-slate-600">${r.users?.class_name || '-'} <span class="text-slate-400">#${r.users?.student_id}</span></td>
                <td class="p-4 text-xs font-medium text-slate-600">${r.users?.gender || '-'}</td>
                <td class="p-4 text-xs text-slate-600">${r.users?.mobile || '-'}</td>
                <td class="p-4 text-xs text-slate-400 text-right">${new Date(r.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');
    }

    // --- 6. TEAMS & SQUADS MODULE ---
    window.loadTeams = async function() {
        const loader = document.getElementById('teams-loader');
        const grid = document.getElementById('teams-grid');
        loader.classList.remove('hidden');
        grid.innerHTML = '';

        // Deep fetch for "Squads" export capability
        // Fetching teams with captain info AND all members info
        const { data, error } = await supabase
            .from('teams')
            .select(`
                *,
                sports (name, team_size),
                users!captain_id (name, class_name, gender, mobile, student_id),
                team_members (
                    status,
                    users (name, class_name, gender, mobile, student_id)
                )
            `)
            .order('created_at', { ascending: false });

        if (!error && data) {
            // Process member counts
            rawTeams = data.map(t => {
                const activeMembers = t.team_members.filter(m => m.status === 'Accepted');
                return {
                    ...t,
                    activeMembers: activeMembers,
                    memberCount: activeMembers.length
                };
            });
            renderTeamsGrid();
        }
        loader.classList.add('hidden');
    }

    window.renderTeamsGrid = function() {
        const search = document.getElementById('team-search').value.toLowerCase();
        const fSport = document.getElementById('team-filter-sport').value;
        const fGender = document.getElementById('team-filter-gender').value; // Check captain's gender or sport category
        const fClass = document.getElementById('team-filter-class').value;
        const fStatus = document.getElementById('team-filter-status').value;
        const fSort = document.getElementById('team-sort').value;

        let filtered = rawTeams.filter(t => {
            const capt = t.users || {};
            const matchesSearch = t.name.toLowerCase().includes(search) || (capt.name || '').toLowerCase().includes(search);
            const matchesSport = fSport === 'All' || t.sports?.name === fSport;
            const matchesGender = fGender === 'All' || (capt.gender === fGender); // Based on captain
            const matchesClass = fClass === 'All' || (capt.class_name || '').startsWith(fClass);
            const matchesStatus = fStatus === 'All' || t.status === fStatus;

            return matchesSearch && matchesSport && matchesGender && matchesClass && matchesStatus;
        });

        // Sorting
        if (fSort === 'oldest') filtered.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
        else if (fSort === 'full') filtered.sort((a,b) => (b.memberCount / b.sports.team_size) - (a.memberCount / a.sports.team_size));
        else filtered.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)); // Newest Default

        document.getElementById('teams-grid').innerHTML = filtered.map(t => {
            const max = t.sports?.team_size || 0;
            const pct = Math.min(100, (t.memberCount / max) * 100);
            const isFull = t.memberCount >= max;
            const isLocked = t.status === 'Locked';

            return `
            <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-slate-900 text-lg leading-tight w-3/4 truncate">${t.name}</h4>
                    <span class="px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${isLocked ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}">
                        ${t.status}
                    </span>
                </div>
                
                <p class="text-xs text-slate-500 mb-3">Capt: <span class="font-bold text-slate-700">${t.users?.name || 'Unknown'}</span></p>
                
                <div class="flex items-center gap-2 mb-4">
                     <span class="text-[10px] font-bold text-white bg-slate-800 px-2 py-1 rounded">${t.sports?.name}</span>
                </div>

                <div class="w-full bg-slate-100 rounded-full h-1.5 mb-2 overflow-hidden">
                    <div class="bg-indigo-600 h-1.5 rounded-full" style="width: ${pct}%"></div>
                </div>
                
                <div class="flex justify-between items-center text-xs mb-4">
                    <span class="font-bold ${isFull ? 'text-green-600' : 'text-slate-500'}">${t.memberCount} / ${max} Players</span>
                    <span class="text-slate-400 font-mono">${new Date(t.created_at).toLocaleDateString()}</span>
                </div>

                <button onclick="window.openManageTeamModal('${t.id}')" class="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors border border-indigo-100">
                    Manage Team
                </button>
            </div>
            `;
        }).join('');
        
        if(window.lucide) lucide.createIcons();
    }

    // --- 7. TEAM MANAGEMENT LOGIC ---

    // USER SEARCH (Debounced)
    window.searchUsers = function(query, resultsId, hiddenInputId) {
        clearTimeout(searchDebounceTimer);
        const resultsEl = document.getElementById(resultsId);
        
        if (!query || query.length < 2) {
            resultsEl.classList.add('hidden');
            return;
        }

        searchDebounceTimer = setTimeout(async () => {
            resultsEl.innerHTML = '<div class="p-3 text-xs text-slate-400">Searching...</div>';
            resultsEl.classList.remove('hidden');

            const { data, error } = await supabase
                .from('users')
                .select('id, name, student_id, class_name')
                .or(`name.ilike.%${query}%,student_id.ilike.%${query}%`)
                .limit(5);

            if (data && data.length > 0) {
                resultsEl.innerHTML = data.map(u => `
                    <div onclick="selectUser('${u.id}', '${u.name}', '${resultsId}', '${hiddenInputId}', '${query}')" 
                         class="p-3 border-b border-slate-100 hover:bg-indigo-50 cursor-pointer last:border-0">
                        <p class="text-sm font-bold text-slate-800">${u.name}</p>
                        <p class="text-[10px] text-slate-500">${u.class_name} • #${u.student_id}</p>
                    </div>
                `).join('');
            } else {
                resultsEl.innerHTML = '<div class="p-3 text-xs text-red-400">No user found</div>';
            }
        }, 400); // 400ms delay
    }

    window.selectUser = function(id, name, resultsId, inputId, queryStr) {
        // Find the text input associated with this search
        const inputContainer = document.getElementById(resultsId).previousElementSibling.previousElementSibling; // Rough DOM traversal, better to pass ID
        // Or strictly set the input value if we know the ID
        if(inputId === 'new-team-captain-id') document.getElementById('new-team-captain-search').value = name;
        if(inputId === 'add-player-id') document.getElementById('add-player-search').value = name;

        document.getElementById(inputId).value = id;
        document.getElementById(resultsId).classList.add('hidden');
    }

    // CREATE TEAM
    window.openCreateTeamModal = () => document.getElementById('modal-create-team').classList.remove('hidden');
    
    window.createTeam = async function() {
        const name = document.getElementById('new-team-name').value;
        const sportId = document.getElementById('new-team-sport').value;
        const captainId = document.getElementById('new-team-captain-id').value;

        if(!name || !sportId || !captainId) return alert("Please fill all fields");

        // 1. Create Team
        const { data: team, error } = await supabase
            .from('teams')
            .insert({ name, sport_id: sportId, captain_id: captainId, status: 'Open' })
            .select()
            .single();

        if (error) return alert("Error creating team: " + error.message);

        // 2. Add Captain to Members
        await supabase.from('team_members').insert({
            team_id: team.id,
            user_id: captainId,
            status: 'Accepted'
        });

        alert("Team Created Successfully!");
        document.getElementById('modal-create-team').classList.add('hidden');
        loadTeams(); // Refresh
    }

    // MANAGE TEAM MODAL
    window.openManageTeamModal = function(teamId) {
        currentManageTeamId = teamId;
        const team = rawTeams.find(t => t.id === teamId);
        if(!team) return;

        document.getElementById('manage-team-title').innerText = team.name;
        document.getElementById('manage-team-subtitle').innerText = `${team.sports.name} • Captain: ${team.users.name}`;
        
        // Status & Lock Button
        const statusEl = document.getElementById('manage-team-status');
        const lockBtn = document.getElementById('btn-toggle-lock');
        statusEl.innerText = team.status;
        
        if (team.status === 'Locked') {
            statusEl.className = "text-sm font-bold text-red-600";
            lockBtn.innerText = "Unlock Team";
            lockBtn.onclick = () => toggleLock(teamId, 'Open');
        } else {
            statusEl.className = "text-sm font-bold text-indigo-600";
            lockBtn.innerText = "Lock Team";
            lockBtn.onclick = () => toggleLock(teamId, 'Locked');
        }

        renderManageRoster(team);
        document.getElementById('modal-manage-team').classList.remove('hidden');
    }

    function renderManageRoster(team) {
        const tbody = document.getElementById('manage-team-roster');
        const members = team.activeMembers || [];

        tbody.innerHTML = members.map(m => `
            <tr>
                <td class="p-3">
                    <p class="font-bold text-slate-900">${m.users.name}</p>
                    ${m.users.student_id === team.users.student_id ? '<span class="text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded">Capt</span>' : ''}
                </td>
                <td class="p-3 text-xs font-mono text-slate-500">${m.users.class_name}</td>
                <td class="p-3 text-right">
                    ${m.users.student_id !== team.users.student_id ? 
                        `<button onclick="window.removeMember('${m.user_id}')" class="text-red-500 hover:bg-red-50 p-1 rounded"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` 
                        : ''}
                </td>
            </tr>
        `).join('');
        lucide.createIcons();
    }

    window.addMemberToTeam = async function() {
        const userId = document.getElementById('add-player-id').value;
        if (!userId || !currentManageTeamId) return alert("Select a player first");

        const { error } = await supabase.from('team_members').insert({
            team_id: currentManageTeamId,
            user_id: userId,
            status: 'Accepted'
        });

        if (error) {
            alert(error.message); // Likely duplicate key
        } else {
            // Refresh data locally then re-render
            await loadTeams(); 
            const team = rawTeams.find(t => t.id === currentManageTeamId);
            renderManageRoster(team);
            document.getElementById('add-player-search').value = '';
            document.getElementById('add-player-id').value = '';
        }
    }

    window.removeMember = async function(userId) {
        if(!confirm("Remove this player?")) return;
        
        await supabase.from('team_members').delete()
            .eq('team_id', currentManageTeamId)
            .eq('user_id', userId);
            
        await loadTeams();
        const team = rawTeams.find(t => t.id === currentManageTeamId);
        renderManageRoster(team);
    }

    window.toggleLock = async function(teamId, newStatus) {
        await supabase.from('teams').update({ status: newStatus }).eq('id', teamId);
        await loadTeams();
        openManageTeamModal(teamId); // Refresh modal state
    }

    window.deleteTeam = async function() {
        if(!confirm("CRITICAL WARNING:\nAre you sure you want to delete this team?\nThis cannot be undone.")) return;
        
        // Delete members first (if cascade isn't set, but usually Supabase handles this if configured. Doing it manually to be safe)
        await supabase.from('team_members').delete().eq('team_id', currentManageTeamId);
        await supabase.from('teams').delete().eq('id', currentManageTeamId);
        
        document.getElementById('modal-manage-team').classList.add('hidden');
        loadTeams();
    }


    // --- 8. ADVANCED EXPORTS (The Magic) ---

    // A. TEAMS SUMMARY EXCEL
    window.exportTeamsExcel = function() {
        if(rawTeams.length === 0) return alert("No data");
        const data = rawTeams.map(t => ({
            "Team Name": t.name,
            "Sport": t.sports?.name,
            "Status": t.status,
            "Member Count": t.memberCount,
            "Max Size": t.sports?.team_size,
            "Captain Name": t.users?.name,
            "Captain Gender": t.users?.gender,
            "Captain Class": t.users?.class_name,
            "Captain Mobile": t.users?.mobile,
            "Created Date": new Date(t.created_at).toLocaleDateString()
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Teams");
        XLSX.writeFile(wb, `OJAS_Teams_Summary_${new Date().toISOString().slice(0,10)}.xlsx`);
    }

    // B. TEAMS LIST PDF
    window.exportTeamsPDF = function() {
        if(rawTeams.length === 0) return alert("No data");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape

        doc.setFontSize(18);
        doc.text("OJAS 2026 - Teams Summary", 14, 20);
        
        const rows = rawTeams.map(t => [
            t.name, t.sports?.name, t.status, 
            `${t.memberCount}/${t.sports?.team_size}`,
            t.users?.name, t.users?.class_name, t.users?.mobile
        ]);

        doc.autoTable({
            head: [['Team Name', 'Sport', 'Status', 'Size', 'Captain', 'Class', 'Mobile']],
            body: rows,
            startY: 30,
            theme: 'grid'
        });
        doc.save("OJAS_Teams_List.pdf");
    }

    // C. SQUADS MASTER EXCEL (Flattened)
    window.exportSquadsExcel = function() {
        if(rawTeams.length === 0) return alert("No data");
        let masterList = [];

        rawTeams.forEach(t => {
            const members = t.activeMembers || [];
            members.forEach(m => {
                masterList.push({
                    "Team ID": t.id,
                    "Team Name": t.name,
                    "Sport": t.sports?.name,
                    "Captain Name": t.users?.name, // Repeated for reference
                    "Player Name": m.users?.name,
                    "Player Gender": m.users?.gender,
                    "Player Class": m.users?.class_name,
                    "Player Mobile": m.users?.mobile,
                    "Player ID": m.users?.student_id
                });
            });
        });

        const ws = XLSX.utils.json_to_sheet(masterList);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Master Squads");
        XLSX.writeFile(wb, `OJAS_Squads_MasterList_${new Date().toISOString().slice(0,10)}.xlsx`);
    }

    // D. SQUADS REPORT PDF (Iterative Tables)
    window.exportSquadsPDF = function() {
        if(rawTeams.length === 0) return alert("No data");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(22);
        doc.text("OJAS 2026 - OFFICIAL SQUADS LIST", 14, 20);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
        
        let yPos = 35;

        rawTeams.forEach((t, index) => {
            // Check for page break
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            // Header for Team
            doc.setFontSize(14);
            doc.setTextColor(79, 70, 229); // Indigo
            doc.text(`${t.name} (${t.sports?.name})`, 14, yPos);
            
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Captain: ${t.users?.name}`, 14, yPos + 6);

            // Table for Members
            const members = t.activeMembers || [];
            const rows = members.map((m, i) => [
                i+1, m.users?.name, m.users?.class_name, m.users?.gender, m.users?.mobile
            ]);

            doc.autoTable({
                startY: yPos + 10,
                head: [['#', 'Player Name', 'Class', 'Gender', 'Mobile']],
                body: rows,
                theme: 'striped',
                headStyles: { fillColor: [50, 50, 50] },
                margin: { left: 14, right: 14 },
                didDrawPage: (d) => {
                    // Update yPos for next loop iteration in case autoTable spans pages
                    yPos = d.cursor.y + 15; 
                }
            });
            
            // Recalculate yPos after table
            yPos = doc.lastAutoTable.finalY + 15;
        });

        doc.save(`OJAS_Squads_Report_${new Date().toISOString().slice(0,10)}.pdf`);
    }


    // --- 9. WINNERS MODULE ---
    async function loadWinners() {
        const container = document.getElementById('winners-list-container');
        container.innerHTML = '<div class="text-center py-4 text-slate-400">Loading...</div>';

        const { data, error } = await supabase.from('winners').select('*').order('created_at', { ascending: false });
        if(data) {
            rawWinners = data;
            if(data.length === 0) {
                container.innerHTML = '<div class="text-center py-8 bg-white rounded-xl border border-dashed border-slate-200">No winners declared yet.</div>';
                return;
            }
            
            container.innerHTML = data.map(w => `
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-xs font-bold uppercase text-slate-500 tracking-wide">${w.sport_name}</span>
                            <span class="text-[10px] bg-slate-100 px-2 rounded text-slate-600 font-bold border border-slate-200">${w.gender}</span>
                        </div>
                        <div class="flex gap-4 text-sm mt-2">
                            <span class="flex items-center gap-1 font-bold text-yellow-600"><i data-lucide="medal" class="w-3 h-3"></i> ${w.gold}</span>
                            <span class="flex items-center gap-1 font-medium text-slate-500"><i data-lucide="medal" class="w-3 h-3"></i> ${w.silver}</span>
                            <span class="flex items-center gap-1 font-medium text-amber-700"><i data-lucide="medal" class="w-3 h-3"></i> ${w.bronze}</span>
                        </div>
                    </div>
                    <button onclick="window.deleteWinner(${w.id})" class="text-red-400 hover:text-red-600 p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            `).join('');
            lucide.createIcons();
        }
    }

    window.saveWinner = async function() {
        const sportSelect = document.getElementById('winner-sport');
        const sportName = sportSelect.options[sportSelect.selectedIndex].text; // Get text, not ID
        const gender = document.getElementById('winner-gender').value;
        const gold = document.getElementById('winner-gold').value;
        const silver = document.getElementById('winner-silver').value;
        const bronze = document.getElementById('winner-bronze').value;

        if(!gold) return alert("Gold winner is mandatory");

        const { error } = await supabase.from('winners').insert({
            sport_name: sportName,
            gender, gold, silver, bronze
        });

        if(error) alert("Error: " + error.message);
        else {
            document.getElementById('winner-gold').value = '';
            document.getElementById('winner-silver').value = '';
            document.getElementById('winner-bronze').value = '';
            loadWinners();
        }
    }

    window.deleteWinner = async function(id) {
        if(!confirm("Delete this record?")) return;
        await supabase.from('winners').delete().eq('id', id);
        loadWinners();
    }

    // --- UTILS ---
    window.exportTableToExcel = function(tableId, filename) {
        const table = document.getElementById(tableId);
        const wb = XLSX.utils.table_to_book(table);
        XLSX.writeFile(wb, `${filename}.xlsx`);
    }

    window.generateHighQualityPDF = function() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("OJAS 2026 - Registrations", 14, 20);
        doc.autoTable({ html: '#regs-table', startY: 30, theme: 'grid' });
        doc.save('OJAS_Registrations.pdf');
    }

})();
