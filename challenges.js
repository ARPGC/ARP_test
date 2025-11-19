import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { formatDate, uploadToCloudinary } from './utils.js';

export const loadChallengesData = async () => {
    try {
        const { data: challenges } = await supabase.from('challenges').select('*').eq('is_active', true);
        const { data: submissions } = await supabase.from('challenge_submissions').select('*').eq('user_id', state.currentUser.id);
        
        state.dailyChallenges = challenges.map(c => {
            const sub = submissions.find(s => s.challenge_id === c.id);
            return { ...c, status: sub ? sub.status : 'active' };
        });
    } catch(e) { console.error(e); }
};

export const renderChallengesPage = () => {
    const list = document.getElementById('challenges-page-list');
    list.innerHTML = state.dailyChallenges.map(c => {
        let btn = `<button onclick="startCamera('${c.id}')" class="bg-green-600 text-white px-3 py-2 rounded-full text-xs">Start</button>`;
        if(c.status === 'pending') btn = `<span class="text-yellow-600 text-xs">Pending</span>`;
        if(c.status === 'approved') btn = `<span class="text-green-600 text-xs">Completed</span>`;
        
        return `
        <div class="glass-card p-4 rounded-2xl flex items-start mb-3">
            <div class="flex-1">
                <h3 class="font-bold dark:text-gray-100">${c.title}</h3>
                <p class="text-sm text-gray-500">${c.description}</p>
                <div class="flex justify-between mt-2">
                    <span class="text-green-600 text-xs font-bold">+${c.points_reward} pts</span>
                    ${btn}
                </div>
            </div>
        </div>`;
    }).join('');
};

// Camera Logic
let stream = null;
let currentChallengeId = null;

export const startCamera = async (cId) => {
    currentChallengeId = cId;
    document.getElementById('camera-modal').classList.remove('hidden');
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        document.getElementById('camera-feed').srcObject = stream;
    } catch (e) { alert('Camera error'); }
};

export const capturePhoto = async (refreshCallback) => {
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('camera-canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    document.getElementById('camera-modal').classList.add('hidden');
    if(stream) stream.getTracks().forEach(t => t.stop());

    canvas.toBlob(async (blob) => {
        try {
            const url = await uploadToCloudinary(blob);
            await supabase.from('challenge_submissions').insert({ 
                challenge_id: currentChallengeId, user_id: state.currentUser.id, submission_url: url, status: 'pending' 
            });
            alert('Uploaded! Pending review.');
            if(refreshCallback) refreshCallback();
        } catch(e) { alert('Upload failed'); }
    }, 'image/jpeg', 0.8);
};
