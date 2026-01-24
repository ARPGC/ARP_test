// ==========================================
// URJA 2026 - ADMIN PORTAL CONTROLLER
// ==========================================

(function() { 

    // --- 1. CONFIGURATION ---
    const SUPABASE_URL = 'https://sijmmlhltkksykhbuatn.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_9GjhwaWzz0McozvxVMINyQ_ZFU58z7F';
    const ADMIN_PASS = 'admin1205'; // Hardcoded Security Key

    // Initialize Supabase
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Global State Cache
    let rawRegistrations = [];
    let rawTeams = [];
    let rawSports = [];
    let isDataLoaded = { regs: false, teams: false };

    // --- 2. AUTHENTICATION ---
    window.checkAdminAuth = function() {
        const input = document.getElementById('admin-pass').value;
        const err = document.getElementById('login-error');
        
        if (input === ADMIN_PASS) {
            // Success
            sessionStorage.setItem('urja_admin_session', 'true');
            unlockApp();
        } else {
            // Fail
            err.classList.remove('hidden');
            setTimeout(() => err.classList.add('hidden'), 2000);
        }
    }

    function unlockApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('admin-app').classList.remove('hidden');
        if(window.lucide) lucide.createIcons();
        
        // Initial Load
        loadDashboardStats();
        // Pre-fetch sports for dropdowns
        fetchSportsList();
    }

    // Auto-login if session exists (optional, mostly for refresh convenience)
    document.addEventListener('DOMContentLoaded', () => {
        if (sessionStorage.getItem('urja_admin_session') === 'true') {
            unlockApp();
        }
    });

    // --- 3. NAVIGATION ---
    window.switchView = function(viewId) {
        // 1. Hide all views
        ['dashboard', 'registrations', 'teams'].forEach(v => {
            document.getElementById(`view-${v}`).classList.add('hidden');
            document.getElementById(`nav-${v}`).classList.replace('text-indigo-600', 'text-slate-500');
            document.getElementById(`nav-${v}`).classList.replace('bg-indigo-50', 'hover:bg-slate-50');
            document.getElementById(`nav-${v}`).classList.remove('font-semibold');
        });

        // 2. Show active view
        const target = document.getElementById(`view-${viewId}`);
        target.classList.remove('hidden');
        
        // 3. Update Title
        const titleMap = { dashboard: 'Dashboard', registrations: 'Registrations', teams: 'Teams & Squads' };
        document.getElementById('page-title').innerText = titleMap[viewId];

        // 4. Update Nav State
        const nav = document.getElementById(`nav-${viewId}`);
        nav.classList.replace('text-slate-500', 'text-indigo-600');
        nav.classList.replace('hover:bg-slate-50', 'bg-indigo-50');
        nav.classList.add('font-semibold');

        // 5. Lazy Load Data
        if (viewId === 'registrations' && !isDataLoaded.regs) loadRegistrations();
        if (viewId === 'teams' && !isDataLoaded.teams) loadTeams();
    }

    // --- 4. DASHBOARD STATS ---
    async function loadDashboardStats() {
        // Count Users
        const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        document.getElementById('stat-users').innerText = userCount || 0;

        // Count Registrations
        const { count: regCount } = await supabase.from('registrations').select('*', { count: 'exact', head: true });
        document.getElementById('stat-regs').innerText = regCount || 0;

        // Count Teams
        const { count: teamCount } = await supabase.from('teams').select('*', { count: 'exact', head: true });
        document.getElementById('stat-teams').innerText = teamCount || 0;
    }

    async function fetchSportsList() {
        const { data } = await supabase.from('sports').select('id, name');
        if (data) {
            rawSports = data;
            populateSportDropdown('reg-filter-sport');
            populateSportDropdown('team-filter-sport');
        }
    }

    function populateSportDropdown(elementId) {
        const select = document.getElementById(elementId);
        // Keep first "All" option
        select.innerHTML = '<option value="All">All Sports</option>';
        rawSports.forEach(s => {
            select.innerHTML += `<option value="${s.name}">${s.name}</option>`;
        });
    }

    // --- 5. REGISTRATIONS MODULE ---
    async function loadRegistrations() {
        const loader = document.getElementById('regs-loader');
        const tbody = document.getElementById('regs-tbody');
        loader.classList.remove('hidden');
        tbody.innerHTML = '';

        // Fetch Data: Join Registrations -> Users & Sports
        const { data, error } = await supabase
            .from('registrations')
            .select(`
                id, created_at,
                users (name, student_id, class_name, mobile, gender),
                sports (name, type)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            loader.innerHTML = '<p class="text-red-500">Error loading data.</p>';
            return;
        }

        rawRegistrations = data || [];
        isDataLoaded.regs = true;
        loader.classList.add('hidden');
        
        renderRegistrationsTable();
    }

    window.renderRegistrationsTable = function() {
        const tbody = document.getElementById('regs-tbody');
        const search = document.getElementById('reg-search').value.toLowerCase();
        const sportFilter = document.getElementById('reg-filter-sport').value;

        // Filter Logic
        const filtered = rawRegistrations.filter(r => {
            const sName = (r.users?.name || '').toLowerCase();
            const sId = (r.users?.student_id || '').toString();
            const sportName = r.sports?.name || '';
            
            const matchesSearch = sName.includes(search) || sId.includes(search);
            const matchesSport = sportFilter === 'All' || sportName === sportFilter;

            return matchesSearch && matchesSport;
        });

        // Render Rows
        tbody.innerHTML = filtered.map(r => `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                <td class="p-4">
                    <p class="font-bold text-slate-900">${r.users?.name || 'Unknown'}</p>
                    <p class="text-[10px] text-slate-400">${r.users?.gender || ''}</p>
                </td>
                <td class="p-4">
                    <span class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold border border-indigo-100">
                        ${r.sports?.name || 'Unknown'}
                    </span>
                </td>
                <td class="p-4 text-xs font-mono text-slate-600">
                    <div class="font-bold">${r.users?.class_name || 'N/A'}</div>
                    <div class="text-slate-400">#${r.users?.student_id || 'N/A'}</div>
                </td>
                <td class="p-4 text-xs text-slate-600 font-medium">
                    ${r.users?.mobile || '-'}
                </td>
                <td class="p-4 text-xs text-slate-400 text-right">
                    ${new Date(r.created_at).toLocaleDateString()}
                </td>
            </tr>
        `).join('');

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400 italic text-sm">No records found.</td></tr>';
        }
    }

    // --- 6. TEAMS MODULE ---
    async function loadTeams() {
        const loader = document.getElementById('teams-loader');
        const grid = document.getElementById('teams-grid');
        loader.classList.remove('hidden');
        grid.innerHTML = '';

        const { data, error } = await supabase
            .from('teams')
            .select(`
                id, name, status, created_at,
                sports (name, team_size),
                users!captain_id (name, class_name)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            loader.innerHTML = '<p class="text-red-500">Error loading data.</p>';
            return;
        }

        // Fetch Member Counts manually (since simple count join is tricky in JS SDK v2 simple query)
        // We will do a separate query to get all accepted members count per team
        // Optimization: Fetch all team members where status=Accepted
        const { data: members } = await supabase.from('team_members').select('team_id').eq('status', 'Accepted');
        
        // Map counts
        const counts = {};
        if (members) {
            members.forEach(m => {
                counts[m.team_id] = (counts[m.team_id] || 0) + 1;
            });
        }

        // Merge Data
        rawTeams = data.map(t => ({
            ...t,
            memberCount: counts[t.id] || 0
        }));

        isDataLoaded.teams = true;
        loader.classList.add('hidden');
        renderTeamsGrid();
    }

    window.renderTeamsGrid = function() {
        const grid = document.getElementById('teams-grid');
        const search = document.getElementById('team-search').value.toLowerCase();
        const sportFilter = document.getElementById('team-filter-sport').value;

        const filtered = rawTeams.filter(t => {
            const tName = t.name.toLowerCase();
            const cName = (t.users?.name || '').toLowerCase();
            const sportName = t.sports?.name || '';
            
            const matchesSearch = tName.includes(search) || cName.includes(search);
            const matchesSport = sportFilter === 'All' || sportName === sportFilter;

            return matchesSearch && matchesSport;
        });

        grid.innerHTML = filtered.map(t => {
            const max = t.sports?.team_size || 0;
            const current = t.memberCount;
            const isFull = current >= max;
            
            return `
            <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-bold text-slate-900 text-lg">${t.name}</h4>
                        <p class="text-xs text-slate-500 mt-1">Capt: <span class="font-medium text-slate-700">${t.users?.name || 'Unknown'}</span></p>
                    </div>
                    <span class="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded border border-slate-200">
                        ${t.status}
                    </span>
                </div>
                
                <div class="flex items-center gap-2 mb-4">
                    <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">${t.sports?.name}</span>
                </div>

                <div class="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                    <div class="bg-indigo-500 h-2 rounded-full" style="width: ${(current/max)*100}%"></div>
                </div>
                
                <div class="flex justify-between items-center text-xs">
                    <span class="font-bold ${isFull ? 'text-green-600' : 'text-slate-500'}">
                        ${current} / ${max} Players
                    </span>
                    <span class="text-slate-400 font-mono">${new Date(t.created_at).toLocaleDateString()}</span>
                </div>
            </div>
            `;
        }).join('');

        if (filtered.length === 0) {
            grid.innerHTML = '<p class="col-span-3 text-center text-slate-400 py-10 italic">No teams found.</p>';
        }
    }

    // --- 7. EXPORT FUNCTIONS ---

    // Excel Export (SheetJS)
    window.exportTableToExcel = function(tableId, filename) {
        const table = document.getElementById(tableId);
        const wb = XLSX.utils.table_to_book(table, {sheet: "Sheet 1"});
        XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`);
    }

    // PDF Export (html2pdf)
    window.exportTableToPDF = function(elementId, filename) {
        const element = document.getElementById(elementId);
        const opt = {
            margin:       0.5,
            filename:     `${filename}_${new Date().toISOString().slice(0,10)}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
        };
        html2pdf().set(opt).from(element).save();
    }

    // CSV Export (Manual for Teams Grid)
    window.exportTeamsToCSV = function() {
        if (!rawTeams || rawTeams.length === 0) return alert("No data to export");
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Team Name,Sport,Status,Captain Name,Captain Class,Members Count,Max Size,Created Date\n";

        rawTeams.forEach(t => {
            const row = [
                `"${t.name}"`,
                `"${t.sports?.name}"`,
                t.status,
                `"${t.users?.name}"`,
                `"${t.users?.class_name}"`,
                t.memberCount,
                t.sports?.team_size,
                new Date(t.created_at).toLocaleDateString()
            ].join(",");
            csvContent += row + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `URJA_Teams_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

})();
