import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, getPlaceholderImage, getTickImg } from './utils.js';

let currentLeaderboardTab = 'student';

export const loadLeaderboardData = async () => {
    try {
        const { data, error } = await supabase.from('users').select('id, full_name, course, lifetime_points, profile_img_url, tick_type').order('lifetime_points', { ascending: false });
        if (error) return;

        state.leaderboard = data.slice(0, 20).map(u => ({
            ...u, name: u.full_name, initials: (u.full_name || '...').split(' ').map(n => n[0]).join('').toUpperCase(), isCurrentUser: u.id === state.currentUser.id
        }));

        const deptMap = {};
        data.forEach(user => {
            let cleanCourse = user.course ? user.course.trim() : 'General';
            if (cleanCourse.length > 2) cleanCourse = cleanCourse.substring(2); 
            if (!deptMap[cleanCourse]) deptMap[cleanCourse] = { name: cleanCourse, points: 0, students: [] };
            deptMap[cleanCourse].points += (user.lifetime_points || 0);
            deptMap[cleanCourse].students.push({
                name: user.full_name, points: user.lifetime_points, img: user.profile_img_url, tick_type: user.tick_type, initials: (user.full_name || '...').split(' ').map(n => n[0]).join('').toUpperCase()
            });
        });
        state.departmentLeaderboard = Object.values(deptMap).sort((a, b) => b.points - a.points);
        
        if (document.getElementById('leaderboard').classList.contains('active')) {
            renderStudentLeaderboard();
            renderDepartmentLeaderboard();
        }
    } catch (err) { console.error('Leaderboard Data Error:', err); }
};

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
        renderDepartmentLeaderboard();
    } else {
        btnStudent.classList.add('active'); btnDept.classList.remove('active');
        contentStudent.classList.remove('hidden'); contentDept.classList.add('hidden');
        if(els.lbLeafLayer) els.lbLeafLayer.classList.remove('hidden');
        renderStudentLeaderboard();
    }
};

export const renderDepartmentLeaderboard = () => {
    const container = document.getElementById('eco-wars-page-list');
    container.innerHTML = '';
    if (state.departmentLeaderboard.length === 0) { container.innerHTML = `<p class="text-sm text-center text-gray-500">Calculating...</p>`; return; }
    state.departmentLeaderboard.forEach((dept, index) => {
        container.innerHTML += `
            <div class="glass-card p-3 rounded-2xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors" onclick="showDepartmentDetail('${dept.name}')">
                <div class="flex items-center justify-between"><div class="flex items-center"><span class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center mr-3 text-xs font-bold text-emerald-700 dark:text-emerald-200">#${index + 1}</span><div><p class="font-semibold text-gray-800 dark:text-gray-100">${dept.name}</p><p class="text-xs text-gray-500 dark:text-gray-400">${dept.points.toLocaleString()} pts</p></div></div><i data-lucide="chevron-right" class="w-5 h-5 text-gray-400"></i></div>
            </div>`;
    });
    if(window.lucide) window.lucide.createIcons();
};

export const showDepartmentDetail = (deptName) => {
    const deptData = state.departmentLeaderboard.find(d => d.name === deptName);
    if (!deptData) return;
    const studentsHTML = deptData.students.length === 0 ? `<p class="text-center text-gray-500 col-span-3">No active students.</p>` : deptData.students.map(s => `
            <div class="dept-student-card"><img src="${s.img || getPlaceholderImage('60x60', s.initials)}" class="w-16 h-16 rounded-full object-cover mb-2 border"><p class="text-xs font-bold text-gray-800 dark:text-gray-100 truncate w-full">${s.name} ${getTickImg(s.tick_type)}</p><p class="text-xs text-gray-500">${s.points} pts</p></div>`).join('');
    els.departmentDetailPage.innerHTML = `
        <div class="flex items-center mb-6"><button onclick="showPage('leaderboard')" class="mr-3 p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"><i data-lucide="arrow-left" class="w-5 h-5"></i></button><h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">${deptName} Dept</h2></div><div class="dept-student-grid">${studentsHTML}</div>`;
    // showPage is global/window
    window.showPage('department-detail-page');
    if(window.lucide) window.lucide.createIcons();
};

export const renderStudentLeaderboard = () => {
    if (state.leaderboard.length === 0) return;
    const sorted = [...state.leaderboard];
    const rank1 = sorted[0], rank2 = sorted[1], rank3 = sorted[2];
    const rest = sorted.slice(3);
    const renderChamp = (u, rank) => {
        if (!u) return '';
        return `<div class="badge ${rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze'}">${u.profile_img_url ? `<img src="${u.profile_img_url}" class="w-full h-full object-cover">` : u.initials}</div><div class="champ-name">${u.name} ${getTickImg(u.tick_type)}</div><div class="champ-points">${u.lifetime_points} pts</div><div class="rank">${rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}</div>`;
    }
    els.lbPodium.innerHTML = `<div class="podium"><div class="champ">${renderChamp(rank2, 2)}</div><div class="champ">${renderChamp(rank1, 1)}</div><div class="champ">${renderChamp(rank3, 3)}</div></div>`;
    els.lbList.innerHTML = '';
    rest.forEach((user, index) => {
        els.lbList.innerHTML += `<div class="item ${user.isCurrentUser ? 'is-me' : ''}"><div class="user"><span class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mr-3 text-xs font-bold text-gray-600 dark:text-gray-300">#${index + 4}</span><div class="circle">${user.profile_img_url ? `<img src="${user.profile_img_url}" class="w-full h-full object-cover">` : user.initials}</div><div class="user-info"><strong>${user.name} ${user.isCurrentUser ? '(You)' : ''} ${getTickImg(user.tick_type)}</strong><span class="sub-class">${user.course}</span></div></div><div class="points-display">${user.lifetime_points} pts</div></div>`;
    });
};

window.showLeaderboardTab = showLeaderboardTab;
window.showDepartmentDetail = showDepartmentDetail;
