import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { uploadToCloudinary } from './utils.js';

// --- DATA ---
export const loadChallengesAndEvents = async () => {
    try {
        // 1. Challenges
        const { data: ch } = await supabase.from('challenges').select('*').eq('is_active', true);
        const { data: subs } = await supabase.from('challenge_submissions').select('*').eq('user_id', state.currentUser.id);
        state.dailyChallenges = ch.map(c => {
            const s = subs.find(x => x.challenge_id === c.id);
            return { ...c, status: s ? s.status : 'active' };
        });

        // 2. Events (With Posters)
        const { data: evts } = await supabase
            .from('events')
            .select('*, event_attendance(user_id, status, users(full_name, profile_img_url))')
            .gte('start_at', new Date().toISOString())
            .order('start_at');
        
        state.events = evts.map(e => {
            const attendees = e.event_attendance.filter(a => a.status !== 'cancelled');
            const isGoing = attendees.some(a => a.user_id === state.currentUser.id);
            return { ...e, attendees, isGoing };
        });

        // 3. Quiz
        const today = new Date().toISOString().split('T')[0];
        const { data: quiz } = await supabase.from('daily_quizzes').select('*').eq('available_date', today).single();
        if (quiz) {
            const { data: qSub } = await supabase.from('quiz_submissions').select('*').eq('quiz_id', quiz.id).eq('user_id', state.currentUser.id).single();
            state.activeQuiz = { ...quiz, played: !!qSub };
        } else {
            state.activeQuiz = null;
        }

    } catch (e) { console.error(e); }
};

// --- RENDER ---
export const renderChallengesPage = () => {
    const list = document.getElementById('challenges-list');
    const quizCont = document.getElementById('daily-quiz-container');
    
    // Quiz Card
    quizCont.innerHTML = '';
    if (state.activeQuiz && !state.activeQuiz.played) {
        quizCont.innerHTML = `
            <div class="quiz-challenge-card shadow-sm" onclick="openQuizModal()">
                <div class="flex items-center">
                    <div class="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-purple-600 mr-4 shadow-sm">
                        <i data-lucide="brain" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-purple-900 dark:text-purple-100 text-lg">Daily Eco Quiz</h3>
                        <p class="text-xs text-purple-700 dark:text-purple-300 font-medium">+${state.activeQuiz.points_reward} EcoPoints</p>
                    </div>
                </div>
                <button class="bg-purple-600 text-white px-5 py-2 rounded-full text-sm font-bold shadow-md active:scale-95 transition-transform">Play</button>
            </div>
        `;
    }

    // Tasks
    list.innerHTML = state.dailyChallenges.map(c => {
        let btn = `<button onclick="startCamera('${c.id}')" class="bg-green-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg shadow-green-200 dark:shadow-none active:scale-95 transition-transform"><i data-lucide="camera" class="w-3 h-3 inline mr-1"></i>Start</button>`;
        if(c.status === 'pending') btn = `<span class="text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full text-xs font-bold">Reviewing</span>`;
        if(c.status === 'approved') btn = `<span class="text-green-600 bg-green-50 px-3 py-1 rounded-full text-xs font-bold">Done</span>`;
        
        return `
            <div class="glass-card p-4 rounded-2xl flex items-center justify-between">
                <div class="flex items-center">
                    <div class="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mr-3 text-gray-600 dark:text-gray-300">
                        <i data-lucide="${c.type === 'Upload' ? 'camera' : 'leaf'}" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-gray-900 dark:text-gray-100">${c.title}</h4>
                        <span class="text-xs font-bold text-green-600">+${c.points_reward} Pts</span>
                    </div>
                </div>
                ${btn}
            </div>
        `;
    }).join('');
    if(window.lucide) window.lucide.createIcons();
};

export const renderEventsPage = () => {
    const list = document.getElementById('event-list');
    if(!state.events.length) return list.innerHTML = `<p class="text-center text-gray-500 mt-10">No upcoming events found.</p>`;

    list.innerHTML = state.events.map(e => {
        const dateObj = new Date(e.start_at);
        const month = dateObj.toLocaleString('default', { month: 'short' });
        const day = dateObj.getDate();
        const poster = e.poster_url || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=1000&auto=format&fit=crop';
        
        const count = e.attendees.length;
        const avatars = e.attendees.slice(0,3).map(a => 
            `<img src="${a.users?.profile_img_url || 'https://placehold.co/30x30'}" class="bg-gray-200">`
        ).join('');
        
        const btnState = e.isGoing 
            ? `<button class="w-full bg-gray-100 text-gray-500 font-bold py-3.5 rounded-xl cursor-default">RSVP Confirmed</button>`
            : `<button onclick="rsvpEvent('${e.id}')" class="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 transition-transform">RSVP Now</button>`;

        return `
            <div class="event-card-modern">
                <div class="relative">
                    <img src="${poster}" class="event-poster-rect">
                    <div class="event-date-badge">
                        <p class="text-xs font-extrabold text-red-500 uppercase tracking-wide">${month}</p>
                        <p class="text-2xl font-black text-gray-900">${day}</p>
                    </div>
                </div>
                <div class="p-5">
                    <h3 class="text-xl font-extrabold text-gray-900 dark:text-white mb-1 leading-tight">${e.title}</h3>
                    <div class="flex items-center text-gray-500 text-sm mb-4 font-medium">
                        <i data-lucide="map-pin" class="w-4 h-4 mr-1.5"></i> ${e.location || 'Main Auditorium'}
                    </div>
                    
                    <div class="flex items-center justify-between mb-5">
                        <div class="flex items-center cursor-pointer hover:opacity-80" onclick="showParticipants('${e.id}')">
                            <div class="avatar-stack">${avatars}</div>
                            <span class="text-xs text-gray-500 font-bold ml-3">+${count} Going</span>
                        </div>
                        <div class="text-right">
                            <p class="text-[10px] text-gray-400 font-bold uppercase">Organizer</p>
                            <p class="text-sm font-bold text-gray-800 dark:text-gray-200">${e.organizer || 'Green Club'}</p>
                        </div>
                    </div>
                    ${btnState}
                </div>
            </div>
        `;
    }).join('');
    if(window.lucide) window.lucide.createIcons();
};

// --- FUNCTIONS ---

window.rsvpEvent = async (evtId) => {
    try {
        const { error } = await supabase.from('event_attendance').insert({ event_id: evtId, user_id: state.currentUser.id });
        if(error) throw error;
        await loadChallengesAndEvents();
        renderEventsPage();
    } catch(e) { alert('Could not RSVP. You might be already registered.'); }
};

window.showParticipants = (evtId) => {
    const evt = state.events.find(e => e.id === evtId);
    const modal = document.getElementById('participants-modal');
    const list = document.getElementById('participants-list');
    
    list.innerHTML = evt.attendees.map(a => `
        <div class="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl">
            <img src="${a.users?.profile_img_url || 'https://placehold.co/40x40'}" class="w-10 h-10 rounded-full mr-3 object-cover">
            <p class="font-bold text-gray-800 dark:text-gray-200 text-sm">${a.users?.full_name}</p>
        </div>
    `).join('');
    
    modal.classList.remove('hidden');
};

// Quiz
window.openQuizModal = () => {
    const modal = document.getElementById('quiz-modal');
    const content = document.getElementById('quiz-content');
    const q = state.activeQuiz;

    content.innerHTML = `
        <p class="text-lg font-bold text-gray-800 dark:text-gray-200 mb-6 text-center leading-relaxed">${q.question}</p>
        <div class="space-y-3">
            ${q.options.map((opt, idx) => `
                <button onclick="submitQuizAnswer(${idx})" class="w-full text-left p-4 rounded-xl border-2 border-gray-100 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all font-bold text-gray-700 dark:text-gray-300">
                    ${opt}
                </button>
            `).join('')}
        </div>
    `;
    modal.classList.remove('hidden');
};

window.closeQuizModal = () => document.getElementById('quiz-modal').classList.add('hidden');

window.submitQuizAnswer = async (idx) => {
    const q = state.activeQuiz;
    const isCorrect = idx === q.correct_option_index;
    
    try {
        await supabase.from('quiz_submissions').insert({ quiz_id: q.id, user_id: state.currentUser.id, is_correct: isCorrect });
        if(isCorrect) {
            await supabase.from('points_ledger').insert({ user_id: state.currentUser.id, source_type: 'quiz', points_delta: q.points_reward, description: 'Quiz Win' });
            alert(`Correct! You earned ${q.points_reward} Points.`);
        } else {
            alert('Wrong answer! No points this time.');
        }
        window.closeQuizModal();
        location.reload(); 
    } catch(e) { alert('Submission failed'); }
};

// Camera
let stream = null;
let activeChallengeId = null;
let facingMode = 'environment';

window.startCamera = async (cId) => {
    activeChallengeId = cId;
    document.getElementById('camera-modal').classList.remove('hidden');
    initCamera();
};

const initCamera = async () => {
    if(stream) stream.getTracks().forEach(t => t.stop());
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode } });
        document.getElementById('camera-feed').srcObject = stream;
    } catch(e) { alert('Camera Access Denied'); }
};

window.switchCamera = () => {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    initCamera();
};

window.closeCameraModal = () => {
    document.getElementById('camera-modal').classList.add('hidden');
    if(stream) stream.getTracks().forEach(t => t.stop());
};

window.capturePhoto = () => {
    const video = document.getElementById('camera-feed');
    const canvas = document.getElementById('camera-canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    canvas.toBlob(async (blob) => {
        window.closeCameraModal();
        try {
            const url = await uploadToCloudinary(blob);
            await supabase.from('challenge_submissions').insert({
                challenge_id: activeChallengeId, user_id: state.currentUser.id, submission_url: url
            });
            alert('Photo uploaded! Pending approval.');
            loadChallengesAndEvents().then(renderChallengesPage);
        } catch(e) { alert('Upload failed'); }
    }, 'image/jpeg', 0.7);
};
