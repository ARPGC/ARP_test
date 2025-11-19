import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { getTickImg, getUserLevel, getPlaceholderImage, formatDate, getUserInitials, uploadToCloudinary } from './utils.js';

export const loadLeaderboardData = async () => {
    try {
        const { data, error } = await supabase.from('users').select('*').order('lifetime_points', { ascending: false });
        if (error) return;

        // Student Leaderboard
        state.leaderboard = data.slice(0, 20).map(u => ({
            ...u, name: u.full_name, initials: getUserInitials(u.full_name), isCurrentUser: u.id === state.currentUser.id
        }));

        // Department Logic
        const deptMap = {};
        data.forEach(user => {
            let course = user.course ? user.course.trim().replace(/^(SY|FY|TY)/, '') : 'General';
            if (!deptMap[course]) deptMap[course] = { name: course, points: 0 };
            deptMap[course].points += (user.lifetime_points || 0);
        });
        state.departmentLeaderboard = Object.values(deptMap).sort((a, b) => b.points - a.points);
    } catch (err) { console.error(err); }
};

export const renderStudentLeaderboard = () => {
    const list = document.getElementById('lb-list-container');
    const podium = document.getElementById('lb-podium-container');
    if (state.leaderboard.length === 0) return;
    
    // Simple Rendering for brevity
    const top3 = state.leaderboard.slice(0,3);
    const rest = state.leaderboard.slice(3);

    podium.innerHTML = top3.map((u, i) => `<div class="champ font-bold text-xs">${u.name} <br> ${u.lifetime_points}pts</div>`).join('');
    list.innerHTML = rest.map((u, i) => `
        <div class="glass-card p-3 mb-2 flex justify-between items-center ${u.isCurrentUser ? 'border border-green-500' : ''}">
            <div class="flex items-center gap-3">
                <span class="font-bold text-gray-500">#${i+4}</span>
                <img src="${u.profile_img_url || getPlaceholderImage('40x40')}" class="w-8 h-8 rounded-full object-cover">
                <span class="text-sm font-semibold dark:text-gray-200">${u.name} ${getTickImg(u.tick_type)}</span>
            </div>
            <span class="font-bold text-green-600">${u.lifetime_points}</span>
        </div>
    `).join('');
};

export const renderProfile = () => {
    const u = state.currentUser;
    const l = getUserLevel(u.lifetime_points, state.levels);
    document.getElementById('profile-name').innerHTML = `${u.full_name} ${getTickImg(u.tick_type)}`;
    document.getElementById('profile-avatar').src = u.profile_img_url || getPlaceholderImage('112x112');
    document.getElementById('profile-level-title').textContent = l.title;
    document.getElementById('profile-level-progress').style.width = l.progress + '%';
    document.getElementById('profile-student-id').textContent = u.student_id;
    document.getElementById('profile-course').textContent = u.course;
};

export const setupProfileUpload = (refreshCallback) => {
    document.getElementById('profile-upload-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const url = await uploadToCloudinary(file);
            await supabase.from('users').update({ profile_img_url: url }).eq('id', state.currentUser.id);
            state.currentUser.profile_img_url = url;
            renderProfile();
            if(refreshCallback) refreshCallback();
            alert('Profile updated!');
        } catch (err) { alert('Upload failed'); }
    });
};
