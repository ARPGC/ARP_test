// ==========================================
// OJAS 2026 - ADMIN PORTAL CONTROLLER
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
    // NO sessionStorage logic - Forces login on every refresh
    
    // Clear password field on load to prevent cached values
    document.addEventListener('DOMContentLoaded', () => {
        const passField = document.getElementById('admin-pass');
        if(passField) passField.value = '';
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
        
        // Reset Inputs
        document.getElementById('reg-search').value = '';
        document.getElementById('team-search').value = '';

        if(window.lucide) lucide.createIcons();
        
        loadDashboardStats();
        fetchSportsList();
    }

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
        const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        document.getElementById('stat-users').innerText = userCount || 0;

        const { count: regCount } = await supabase.from('registrations').select('*', { count: 'exact', head: true });
        document.getElementById('stat-regs').innerText = regCount || 0;

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
        tbody.innerHTML = ''; // Clear table
        document.getElementById('reg-search').value = ''; // Ensure search is empty

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
        
        renderRegistrationsTable(); // Call immediately
    }

    window.renderRegistrationsTable = function() {
        const tbody = document.getElementById('regs-tbody');
        const searchInput = document.getElementById('reg-search');
        
        // Safety check to ensure we get a clean string
        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const sportFilter = document.getElementById('reg-filter-sport').value;

        const filtered = rawRegistrations.filter(r => {
            const sName = (r.users?.name || '').toLowerCase();
            const sId = (r.users?.student_id || '').toString();
            const sportName = r.sports?.name || '';
            
            const matchesSearch = sName.includes(search) || sId.includes(search);
            const matchesSport = sportFilter === 'All' || sportName === sportFilter;

            return matchesSearch && matchesSport;
        });

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
        document.getElementById('team-search').value = '';

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

        const { data: members } = await supabase.from('team_members').select('team_id').eq('status', 'Accepted');
        
        const counts = {};
        if (members) {
            members.forEach(m => {
                counts[m.team_id] = (counts[m.team_id] || 0) + 1;
            });
        }

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
        const searchInput = document.getElementById('team-search');
        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
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

    window.exportTableToExcel = function(tableId, filename) {
        const table = document.getElementById(tableId);
        const wb = XLSX.utils.table_to_book(table, {sheet: "Sheet 1"});
        XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`);
    }

    // NEW: High Quality Data PDF Generator (Fetched Data)
    window.generateHighQualityPDF = function() {
        if (!window.jspdf) return alert("PDF Library loading...");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // 1. Header
        doc.setFontSize(18);
        doc.text("OJAS 2026 - Registrations Report", 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 26);

        // 2. Prepare Data from Memory (not DOM)
        // This ensures the PDF is clean regardless of what is showing on screen
        const tableBody = rawRegistrations.map(r => [
            r.users?.name || 'Unknown',
            r.sports?.name || 'Unknown',
            r.users?.class_name || '-',
            r.users?.student_id || '-',
            r.users?.mobile || '-',
            new Date(r.created_at).toLocaleDateString()
        ]);

        // 3. Generate Table
        doc.autoTable({
            head: [['Student Name', 'Sport', 'Class', 'ID', 'Contact', 'Date']],
            body: tableBody,
            startY: 32,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
            styles: { fontSize: 8 },
        });

        // 4. Save
        doc.save(`OJAS_Registrations_${new Date().toISOString().slice(0,10)}.pdf`);
    }

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
        link.setAttribute("download", `OJAS_Teams_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

})();
