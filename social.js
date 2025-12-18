import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, getPlaceholderImage, getTickImg, getUserInitials, logUserActivity } from './utils.js';

let currentLeaderboardTab = 'student';

// Initialize cache if not exists
if (!state.deptCache) state.deptCache = {};

// HELPER: Cloudinary Low Quality Thumbnail
const getOptimizedImgUrl = (url) => {
    if (!url) return null;
    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
        return url.replace('/upload/', '/upload/w_80,q_auto:low,f_auto/');
    }
    return url;
};

// MASTER LOADER
export const loadLeaderboardData = async () => {
    if (currentLeaderboardTab === 'student') {
        await loadStudentLeaderboard();
    } else {
        await loadDepartmentLeaderboard();
    }
};

// 1. GLOBAL STUDENT LEADERBOARD (Eco Warriors)
const loadStudentLeaderboard = async () => {
    if (state.leaderboardLoaded) {
        renderStudentLeaderboard();
        return;
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .select(`
                id, full_name, course, lifetime_points, profile_img_url, tick_type,
                user_streaks:user_streaks!user_streaks_user_id_fkey ( current_streak )
            `)
            .gt('lifetime_points', 0) 
            .order('lifetime_points', { ascending: false })
            .limit(50); // Optimized for mobile view

        if (error) throw error;

        state.leaderboard = data.map(u => ({
            ...u,
            name: u.full_name,
            initials: getUserInitials(u.full_name),
            isCurrentUser: state.currentUser && u.id === state.currentUser.id,
            streak: (u.user_streaks && u.user_streaks.current_streak) 
                ? u.user_streaks.current_streak 
                : (Array.isArray(u.user_streaks) && u.user_streaks[0] ? u.user_streaks[0].current_streak : 0)
        }));

        state.leaderboardLoaded = true;
        renderStudentLeaderboard();

    } catch (err) { console.error('Student LB Error:', err); }
};

// 2. DEPARTMENT STATS (Leaderboard Tab)
export const loadDepartmentLeaderboard = async () => {
    if (state.deptStatsLoaded) {
        renderDepartmentLeaderboard();
        return;
    }

    try {
        const { data, error } = await supabase.rpc('department_stats');
        if (error) throw error;

        state.departmentLeaderboard = data.map(dept => ({
            name: dept.department,
            studentCount: dept.student_count,
            averageScore: Number(dept.avg_score)
        }))
        .sort((a, b) => b.averageScore - a.averageScore);

        state.deptStatsLoaded = true;
        renderDepartmentLeaderboard();
    } catch (err) { console.error('Dept Stats Error:', err); }
};

// 3. DEPARTMENT STUDENTS (The "Drill Down" Fix)
export const loadDepartmentStudents = async (deptName) => {
    // Check if we already have this data
    if (state.deptCache[deptName]) {
        renderDepartmentStudents(deptName);
        return;
    }

    try {
        // Fix: Ensure the filter matches the department name precisely but flexibly
        // We use .eq() for exact department filtering as requested previously.
        const { data, error } = await supabase
            .from('users')
            .select(`
                id, full_name, lifetime_points, profile_img_url, tick_type, course,
                user_streaks:user_streaks!user_streaks_user_id_fkey ( current_streak )
            `)
            .eq('course', deptName) 
            .order('lifetime_points', { ascending: false }); 

        if (error) throw error;

        // Map data into cache
        state.deptCache[deptName] = data.map(u => ({
            name: u.full_name,
            points: u.lifetime_points,
            img: u.profile_img_url,
            tick_type: u.tick_type,
            initials: getUserInitials(u.full_name),
            streak: (u.user_streaks && u.user_streaks.current_streak) ? u.user_streaks.current_streak : 0
        }));

        renderDepartmentStudents(deptName);

    } catch (err) { 
        console.error('Dept Students Load Error:', err);
        const list = document.getElementById('dept-students-list');
        if (list) list.innerHTML = `<p class="text-center text-red-500 py-10">Error loading students.</p>`;
    }
};

// --- UI RENDER FUNCTIONS ---

export const showLeaderboardTab = (tab) => {
    currentLeaderboardTab = tab;
    const btnStudent = document.getElementById('leaderboard-tab-student');
    const btnDept = document.getElementById('leaderboard-tab-dept');
    const contentStudent = document.getElementById('leaderboard-content-student');
    const contentDept = document.getElementById('leaderboard-content-department');

    if (tab === 'department') {
        btnDept.classList.add('active'); btnStudent.classList.remove('active');
        contentDept.classList.remove('hidden'); contentStudent.classList.add('hidden');
        if(els.lbLeafLayer) els.lbLeafLayer.classList.add('hidden');
        loadDepartmentLeaderboard(); 
    } else {
        btnStudent.classList.add('active'); btnDept.classList.remove('active');
        contentStudent.classList.remove('hidden'); contentDept.classList.add('hidden');
        if(els.lbLeafLayer) els.lbLeafLayer.classList.remove('hidden');
        loadStudentLeaderboard();
    }
};

export const renderDepartmentLeaderboard = () => {
    const container = document.getElementById('eco-wars-page-list');
    if (!container) return;

    if (state.departmentLeaderboard.length === 0) { 
        container.innerHTML = `<p class="text-sm text-center text-gray-500">Loading departments...</p>`; 
        return; 
    }

    container.innerHTML = state.departmentLeaderboard.map((dept, index) => `
        <div class="glass-card p-4 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors mb-3 border border-gray-100 dark:border-gray-700 active:scale-[0.98] transform duration-150" onclick="showDepartmentDetail('${dept.name}')">
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <span class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-green-200 dark:from-emerald-900/60 dark:to-green-900/60 flex items-center justify-center mr-4 text-sm font-bold text-emerald-800 dark:text-emerald-100 shadow-sm">#${index + 1}</span>
                    <div>
                        <p class="font-bold text-lg text-gray-900 dark:text-gray-100">${dept.name}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${dept.studentCount} Students</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-lg font-extrabold text-green-600 dark:text-green-400">${dept.averageScore}</p>
                    <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Avg Score</p>
                </div>
            </div>
        </div>`).join('');
};

export const showDepartmentDetail = (deptName) => {
    const deptData = state.departmentLeaderboard.find(d => d.name === deptName);
    if (!deptData) return;

    const detailPage = document.getElementById('department-detail-page');
    detailPage.innerHTML = `
        <div class="max-w-3xl mx-auto h-full flex flex-col bg-white dark:bg-gray-900">
            <div class="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md z-10 p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div class="flex items-center">
                    <button onclick="showPage('leaderboard')" class="mr-3 p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <i data-lucide="arrow-left" class="w-5 h-5 text-gray-700 dark:text-gray-200"></i>
                    </button>
                    <div>
                        <h2 class="text-xl font-extrabold text-gray-900 dark:text-gray-100">${deptName}</h2>
                        <p class="text-xs text-gray-500 font-medium">Avg Score: <span class="text-green-600 font-bold">${deptData.averageScore}</span></p>
                    </div>
                </div>
            </div>
            <div id="dept-students-list" class="p-4 space-y-3 pb-20 overflow-y-auto flex-grow">
                <div class="flex flex-col items-center py-10">
                    <div class="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mb-4"></div>
                    <p class="text-gray-500">Fetching students...</p>
                </div>
            </div>
        </div>`;

    window.showPage('department-detail-page');
    if(window.lucide) window.lucide.createIcons();

    logUserActivity('view_department', `Viewed details for ${deptName}`);
    loadDepartmentStudents(deptName);
};

export const renderDepartmentStudents = (deptName) => {
    const students = state.deptCache[deptName] || [];
    const container = document.getElementById('dept-students-list');
    if (!container) return;

    if (students.length === 0) {
        container.innerHTML = `
            <div class="text-center py-20 flex flex-col items-center opacity-60">
                <i data-lucide="users" class="w-12 h-12 text-gray-300 mb-2"></i>
                <p class="text-gray-500">No students found in ${deptName}.</p>
            </div>`;
        if(window.lucide) window.lucide.createIcons();
        return;
    }

    container.innerHTML = students.map((s, idx) => {
        const optimizedImg = getOptimizedImgUrl(s.img) || getPlaceholderImage('60x60', s.initials);
        return `
        <div class="glass-card p-3 rounded-2xl flex items-center justify-between border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <div class="flex items-center gap-4">
                <div class="relative">
                    <img src="${optimizedImg}" class="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm" loading="lazy">
                    <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300 border border-white dark:border-gray-600">
                        ${idx + 1}
                    </div>
                </div>
                <div>
                    <p class="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1">
                        ${s.name} ${getTickImg(s.tick_type)}
                    </p>
                    <div class="flex items-center mt-0.5">
                        <i data-lucide="flame" class="w-3 h-3 text-orange-500 fill-orange-500 mr-1"></i>
                        <span class="text-xs font-semibold text-orange-600 dark:text-orange-400">${s.streak} Day Streak</span>
                    </div>
                </div>
            </div>
            <div class="text-right">
                <span class="text-sm font-extrabold text-green-600 dark:text-green-400">${s.points}</span>
                <span class="text-[10px] text-gray-400 block font-medium">PTS</span>
            </div>
        </div>`;
    }).join('');
    
    if(window.lucide) window.lucide.createIcons();
};

export const renderStudentLeaderboard = () => {
    if (state.leaderboard.length === 0) {
        els.lbPodium.innerHTML = '';
        els.lbList.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 py-10">No active Eco Warriors yet.</p>`;
        return;
    }
    
    const sorted = [...state.leaderboard];
    const rank1 = sorted[0], rank2 = sorted[1], rank3 = sorted[2];
    const rest = sorted.slice(3);

    const renderChamp = (u, rank) => {
        if (!u) return '';
        const optimizedImg = getOptimizedImgUrl(u.profile_img_url) || getPlaceholderImage('100x100', u.initials);
        return `
            <div class="badge ${rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze'}">
                <img src="${optimizedImg}" class="w-full h-full object-cover" loading="lazy">
            </div>
            <div class="champ-name">${u.name} ${getTickImg(u.tick_type)}</div>
            <div class="champ-points">${u.lifetime_points} pts</div>
            <div class="rank">${rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}</div>
        `;
    }

    els.lbPodium.innerHTML = `
        <div class="podium">
            <div class="champ">${renderChamp(rank2, 2)}</div>
            <div class="champ">${renderChamp(rank1, 1)}</div>
            <div class="champ">${renderChamp(rank3, 3)}</div>
        </div>`;

    els.lbList.innerHTML = rest.map((user, index) => {
        const optimizedImg = getOptimizedImgUrl(user.profile_img_url) || getPlaceholderImage('40x40', user.initials);
        return `
            <div class="item ${user.isCurrentUser ? 'is-me' : ''}">
                <div class="user">
                    <span class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mr-3 text-xs font-bold text-gray-600 dark:text-gray-300">#${index + 4}</span>
                    <div class="circle"><img src="${optimizedImg}" class="w-full h-full object-cover" loading="lazy"></div>
                    <div class="user-info">
                        <strong>${user.name} ${user.isCurrentUser ? '(You)' : ''} ${getTickImg(user.tick_type)}</strong>
                        <span class="sub-class">${user.course}</span>
                    </div>
                </div>
                <div class="points-display">${user.lifetime_points} pts</div>
            </div>`;
    }).join('');
};

window.showLeaderboardTab = showLeaderboardTab;
window.showDepartmentDetail = showDepartmentDetail;
