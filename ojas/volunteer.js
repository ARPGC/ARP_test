// ==========================================
// OJAS 2026 - VOLUNTEER CONTROLLER (FIXED)
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

        // FIX: Simplified the JOIN query. 
        // Instead of 'sports:assigned_sport_id', we just call 'sports' (the table name).
        const { data: user, error } = await supabase
            .from('users')
            .select(`*, sports (id, name, type, is_performance)`)
            .eq('student_id', studentId)
            .single();

        if (error) {
            console.error("Auth Error:", error);
            return showAuthError("Access Denied: " + error.message);
        }

        if (!user) return showAuthError("User not found.");
        if (user.role !== 'volunteer') return showAuthError("Access Denied: You are not registered as a Volunteer.");
        
        // Check if sport is linked
        if (!user.sports) return showAuthError("No Sport Assigned. Please ask Admin to assign a sport to your ID.");

        // Auth Success
        currentVolunteer = user;
        assignedSport = user.sports; // Supabase puts the joined data in a property named after the table

        // Update UI Header
        document.getElementById('vol-sport-name').innerText = assignedSport.name;
        document.getElementById('vol-initials').innerText = user.name.substring(0, 2).toUpperCase();
        
        // Switch Screens
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');

        // Start Data Sync
        loadLiveMatches();
        subscribeToRealtime();
    }

    function showAuthError(msg) {
        const el = document.getElementById('auth-msg');
        el.innerText = msg;
        el.classList.add('text-red-600', 'font-bold');
        const spinner = document.querySelector('.animate-spin');
        if(spinner) spinner.classList.remove('animate-spin'); 
    }

    // --- 4. DATA LOADING & REALTIME ---
    async function loadLiveMatches() {
        const container = document.getElementById('matches-container');
        // Only show loader on first load if empty
        if(liveMatches.length === 0) container.innerHTML = '<div class="text-center py-10"><span class="loading-spinner text-indigo-600">Loading Live Events...</span></div>';

        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .eq('sport_id', assignedSport.id)
            .eq('status', 'Live')
            .order('created_at', { ascending: false });

        if (error) {
            showToast("Connection Error", "error");
            return;
        }

        liveMatches = data;
        renderMatches();
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
                // Refresh data to ensure full consistency
                loadLiveMatches();
            })
            .subscribe();
    }

    // --- 5. RENDER ENGINE ---
    function renderMatches() {
        const container = document.getElementById('matches-container');
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
            const card = document.createElement('div');
            card.className = "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6";
            
            // --- HEADER ---
            let headerHtml = `
                <div class="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                    <span class="text-xs font-bold text-slate-500 uppercase tracking-wider truncate mr-2">${match.title}</span>
                    <div class="flex items-center gap-2">
                        <span class="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
                    </div>
                </div>
            `;

            // --- BODY (DYNAMIC BASED ON SPORT) ---
            let bodyHtml = '';

            // CASE A: PERFORMANCE SPORTS (Running, Swimming)
            if (assignedSport.is_performance) {
                // Students are stored in participants.students (from Admin 'Start Event' logic)
                const students = match.participants?.students || [];
                const results = match.live_data?.results || [];

                if (students.length === 0) {
                    bodyHtml = `<div class="p-6 text-center text-slate-400 text-sm">No participants list found.</div>`;
                } else {
                    const rows = students.map(student => {
                        // Find existing result if any
                        const existing = results.find(r => r.uid === student.id) || {};
                        const val = existing.time || '';
                        
                        return `
                        <div class="flex items-center justify-between p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                            <div class="flex-1 min-w-0 pr-3">
                                <p class="text-sm font-bold text-slate-900 truncate">${student.name}</p>
                                <p class="text-[10px] text-slate-400 font-mono">ID: ${student.student_id}</p>
                            </div>
                            <input type="text" 
                                class="w-24 bg-slate-100 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-lg px-3 py-2 text-right font-mono font-bold text-slate-800 outline-none transition-all"
                                placeholder="Time"
                                value="${val}"
                                onchange="window.updatePerformanceScore('${match.id}', '${student.id}', this.value)"
                            >
                        </div>`;
                    }).join('');
                    bodyHtml = `<div class="divide-y divide-slate-50">${rows}</div>`;
                }
            } 
            // CASE B: CRICKET (Complex Score)
            else if (assignedSport.name.toLowerCase().includes('cricket')) {
                const d = match.live_data || {};
                const t1 = d.t1 || {r:0,w:0,o:0};
                const t2 = d.t2 || {r:0,w:0,o:0};
                
                // Get names from participants JSON or fallback
                const t1Name = match.participants?.team1_name || 'Team 1'; // If team names stored
                const t2Name = match.participants?.team2_name || 'Team 2';

                // Reusable Input Block Helper
                const inputBlock = (teamKey, label, field, val) => `
                    <div class="flex flex-col">
                        <label class="text-[9px] font-bold text-slate-400 uppercase mb-1">${label}</label>
                        <input type="number" 
                            class="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center font-bold text-lg outline-none focus:border-indigo-500 transition-colors" 
                            value="${val}" 
                            onchange="window.updateCricketScore('${match.id}', '${teamKey}', '${field}', this.value)">
                    </div>
                `;

                bodyHtml = `
                <div class="p-4 space-y-6">
                    <div>
                        <p class="text-xs font-bold text-indigo-900 uppercase mb-2 border-b border-indigo-50 pb-1">Batting 1</p>
                        <div class="grid grid-cols-3 gap-3">
                            ${inputBlock('t1', 'Runs', 'r', t1.r)}
                            ${inputBlock('t1', 'Wickets', 'w', t1.w)}
                            ${inputBlock('t1', 'Overs', 'o', t1.o)}
                        </div>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-indigo-900 uppercase mb-2 border-b border-indigo-50 pb-1">Batting 2</p>
                        <div class="grid grid-cols-3 gap-3">
                            ${inputBlock('t2', 'Runs', 'r', t2.r)}
                            ${inputBlock('t2', 'Wickets', 'w', t2.w)}
                            ${inputBlock('t2', 'Overs', 'o', t2.o)}
                        </div>
                    </div>
                </div>`;
            } 
            // CASE C: STANDARD SPORTS (Football, Badminton, Chess)
            else {
                const s = match.live_data || {s1:0, s2:0};
                bodyHtml = `
                <div class="p-6">
                    <div class="flex items-center justify-between gap-4">
                        <div class="flex-1 text-center">
                            <p class="text-[10px] font-bold text-slate-400 mb-2 truncate px-1">Player 1</p>
                            <input type="number" 
                                class="w-full h-20 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center text-4xl font-extrabold text-slate-800 outline-none focus:border-indigo-500 transition-all"
                                value="${s.s1 || 0}"
                                onchange="window.updateStandardScore('${match.id}', 's1', this.value)">
                        </div>
                        
                        <div class="text-slate-300 font-black text-xl italic">VS</div>
                        
                        <div class="flex-1 text-center">
                            <p class="text-[10px] font-bold text-slate-400 mb-2 truncate px-1">Player 2</p>
                            <input type="number" 
                                class="w-full h-20 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center text-4xl font-extrabold text-slate-800 outline-none focus:border-indigo-500 transition-all"
                                value="${s.s2 || 0}"
                                onchange="window.updateStandardScore('${match.id}', 's2', this.value)">
                        </div>
                    </div>
                </div>`;
            }

            card.innerHTML = headerHtml + bodyHtml;
            container.appendChild(card);
        });
        
        if(window.lucide) lucide.createIcons();
    }

    // --- 6. UPDATE HANDLERS (EXPOSED TO WINDOW) ---

    // A. Performance Sports (Auto-Push to JSON Array)
    window.updatePerformanceScore = async function(matchId, studentId, value) {
        // Optimistic UI handled by input value persisting
        showToast("Saving...", "info");

        // 1. Get current match data locally
        const match = liveMatches.find(m => m.id === matchId);
        if (!match) return;

        let results = match.live_data?.results || [];
        
        // 2. Update local logic
        const existingIndex = results.findIndex(r => r.uid === studentId);
        if (existingIndex > -1) {
            results[existingIndex].time = value;
        } else {
            results.push({ uid: studentId, time: value, rank: 999 });
        }

        // 3. Push to Supabase
        const { error } = await supabase
            .from('matches')
            .update({ 
                live_data: { ...match.live_data, results: results } 
            })
            .eq('id', matchId);

        if (error) showToast("Save Failed!", "error");
        else showToast("Saved", "success");
    }

    // B. Cricket Update
    window.updateCricketScore = async function(matchId, teamKey, field, value) {
        showToast("Updating...", "info");
        
        const match = liveMatches.find(m => m.id === matchId);
        let liveData = match.live_data || {};
        
        // Ensure structure exists
        if (!liveData[teamKey]) liveData[teamKey] = {};
        liveData[teamKey][field] = value;

        const { error } = await supabase.from('matches').update({ live_data: liveData }).eq('id', matchId);
        
        if (error) showToast("Update Failed", "error");
        else showToast("Score Updated", "success");
    }

    // C. Standard Update
    window.updateStandardScore = async function(matchId, scoreKey, value) {
        showToast("Updating...", "info");

        const match = liveMatches.find(m => m.id === matchId);
        let liveData = match.live_data || {};
        liveData[scoreKey] = value;

        const { error } = await supabase.from('matches').update({ live_data: liveData }).eq('id', matchId);

        if (error) showToast("Update Failed", "error");
        else showToast("Score Updated", "success");
    }

    // --- 7. TOAST NOTIFICATION SYSTEM ---
    function showToast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        
        // Styles
        let bg = type === 'error' ? 'bg-red-600' : (type === 'info' ? 'bg-blue-600' : 'bg-green-600');
        let icon = type === 'error' ? 'alert-circle' : (type === 'info' ? 'loader-2' : 'check');
        let spin = type === 'info' ? 'animate-spin' : '';

        toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-white text-sm font-bold ${bg} toast-enter-active`;
        toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 ${spin}"></i> <span>${msg}</span>`;

        container.appendChild(toast);
        if(window.lucide) lucide.createIcons();

        // Animate In
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-full', 'opacity-0');
        });

        // Remove after delay
        if (type !== 'info') { 
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(100%)';
                setTimeout(() => toast.remove(), 300);
            }, 2000);
        } else {
            // Self-remove info toasts quickly to prevent clutter
            setTimeout(() => {
                toast.style.opacity = '0'; 
                setTimeout(() => toast.remove(), 300);
            }, 1000);
        }
    }

})();
