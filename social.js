import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { getTickImg, formatDate, getPlaceholderImage } from './utils.js';

export const loadSocialData = async () => {
    const { data: users } = await supabase.from('users').select('*').order('lifetime_points', { ascending: false });
    state.leaderboard = users || [];
    
    const { data: hist } = await supabase.from('points_ledger').select('*').eq('user_id', state.currentUser.id).order('created_at', { ascending: false });
    state.history = hist || [];
};

export const renderLeaderboard = (type = 'student') => {
    const div = document.getElementById('lb-content');
    const btnS = document.getElementById('lb-tab-student');
    const btnD = document.getElementById('lb-tab-dept');

    if(type === 'student') {
        btnS.classList.add('bg-white', 'shadow-sm', 'text-green-600'); btnS.classList.remove('text-gray-500');
        btnD.classList.remove('bg-white', 'shadow-sm', 'text-green-600'); btnD.classList.add('text-gray-500');
        
        div.innerHTML = state.leaderboard.slice(0, 20).map((u, i) => `
            <div class="glass-card p-3 flex items-center justify-between ${u.id === state.currentUser.id ? 'border-green-500 border-2 bg-green-50/50' : ''}">
                <div class="flex items-center gap-4">
                    <span class="font-bold text-gray-400 w-4 text-sm">#${i+1}</span>
                    <img src="${u.profile_img_url || getPlaceholderImage('40x40', 'U')}" class="w-10 h-10 rounded-full object-cover">
                    <div><p class="font-bold text-sm dark:text-white leading-tight">${u.full_name} ${getTickImg(u.tick_type)}</p><p class="text-[10px] font-bold text-gray-400 uppercase">${u.course}</p></div>
                </div>
                <span class="font-black text-green-600 text-sm">${u.lifetime_points}</span>
            </div>
        `).join('');
    } else {
        btnD.classList.add('bg-white', 'shadow-sm', 'text-green-600'); btnD.classList.remove('text-gray-500');
        btnS.classList.remove('bg-white', 'shadow-sm', 'text-green-600'); btnS.classList.add('text-gray-500');
        
        const depts = {};
        state.leaderboard.forEach(u => {
            const d = (u.course || 'General').split(' ')[0];
            if(!depts[d]) depts[d] = 0;
            depts[d] += u.lifetime_points;
        });
        
        div.innerHTML = Object.entries(depts).sort((a,b) => b[1]-a[1]).map(([name, pts], i) => `
            <div class="glass-card p-4 mb-2 flex justify-between items-center">
                <div class="flex items-center gap-3"><span class="font-bold text-gray-400 text-sm">#${i+1}</span><span class="font-bold dark:text-white">${name}</span></div>
                <span class="font-black text-green-600">${pts}</span>
            </div>
        `).join('');
    }
};

export const renderHistory = () => {
    document.getElementById('history-list').innerHTML = state.history.map(h => `
        <div class="glass-card p-4 flex justify-between items-center">
            <div><p class="font-bold text-sm dark:text-white mb-0.5">${h.description}</p><p class="text-xs text-gray-400 font-medium">${formatDate(h.created_at)}</p></div>
            <span class="font-bold ${h.points_delta > 0 ? 'text-green-600' : 'text-gray-500'}">${h.points_delta > 0 ? '+' : ''}${h.points_delta}</span>
        </div>
    `).join('');
};

window.switchLb = (t) => renderLeaderboard(t);
