import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, formatDate, getPlaceholderImage, getTickImg, logUserActivity, getOptimizedImageUrl, showToast } from './utils.js';

// --- EVENTS MODULE ---

export const loadEventsData = async () => {
    try {
        // 1. Fetch Events (No Joins, Minimal Fields for bandwidth optimization)
        const { data: events, error: eventsError } = await supabase
            .from('events')
            .select('id, title, start_at, location, poster_url, points_reward, organizer, description')
            .order('start_at', { ascending: true });

        if (eventsError) throw eventsError;

        // 2. Fetch My Attendance ONLY (Privacy & Egress optimization)
        const { data: myAttendance, error: attendanceError } = await supabase
            .from('event_attendance')
            .select('event_id, status')
            .eq('user_id', state.currentUser.id);

        if (attendanceError) throw attendanceError;

        // Create a map for fast lookup
        const attendanceMap = new Map();
        if (myAttendance) {
            myAttendance.forEach(a => attendanceMap.set(a.event_id, a.status));
        }

        state.events = events.map(e => {
            const status = attendanceMap.get(e.id);
            let myStatus = 'upcoming';
            
            if (status) {
                if (status === 'confirmed') myStatus = 'attended';
                else if (status === 'absent') myStatus = 'missed';
                else myStatus = 'going'; // registered
            }

            return {
                ...e,
                dateObj: new Date(e.start_at),
                displayDate: formatDate(e.start_at, { month: 'short', day: 'numeric' }),
                displayTime: formatDate(e.start_at, { hour: 'numeric', minute: 'numeric', hour12: true }),
                attendees: [], 
                attendeeCount: 0, 
                myStatus: myStatus
            };
        });

        if (document.getElementById('events') && document.getElementById('events').classList.contains('active')) {
            renderEventsPage();
        }
        
        updateDashboardEvent();

    } catch (err) { 
        console.error('Events Load Error:', err); 
        showToast("Failed to load events.", "error");
    }
};

export const renderEventsPage = () => {
    els.eventsList.innerHTML = '';
    
    if (state.events.length === 0) { 
        els.eventsList.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 opacity-60 col-span-full">
                <i data-lucide="calendar-x" class="w-12 h-12 text-gray-300 mb-3"></i>
                <p class="text-sm font-medium text-gray-500 dark:text-gray-400">No upcoming events found.</p>
            </div>`; 
        if(window.lucide) window.lucide.createIcons();
        return; 
    }

    let eventsHTML = '';

    state.events.forEach(e => {
        // Community interaction placeholder
        let avatarsHtml = `<span class="text-xs text-gray-400 italic pl-1">Join the community!</span>`;

        let actionBtn = '';
        if (e.myStatus === 'going') {
            actionBtn = `<button disabled class="w-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-300 border border-brand-100 dark:border-brand-800/50 font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"><i data-lucide="check" class="w-4 h-4"></i>Registered</button>`;
        } else if (e.myStatus === 'attended') {
            actionBtn = `<button disabled class="w-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800/50 font-bold py-3 rounded-xl text-sm">Completed</button>`;
        } else {
            actionBtn = `<button onclick="handleRSVP('${e.id}')" class="w-full bg-brand-600 hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-brand-500/20 dark:shadow-none transition-all active:scale-95">RSVP Now</button>`;
        }

        const posterUrl = getOptimizedImageUrl(e.poster_url, 600);

        eventsHTML += `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 h-full flex flex-col justify-between hover:shadow-md dark:hover:border-gray-600 transition-all">
                <div>
                    <div class="event-poster-container mb-4 relative rounded-2xl overflow-hidden">
                        <img src="${posterUrl}" class="event-poster-img hover:scale-105 transition-transform duration-700" loading="lazy">
                        
                        <div class="absolute top-3 left-3 bg-white/95 dark:bg-gray-900/90 backdrop-blur-sm px-3 py-1.5 rounded-xl text-center shadow-sm min-w-[50px] border border-gray-100 dark:border-gray-700">
                            <p class="text-xs font-bold text-red-500 uppercase tracking-wide">${e.dateObj.toLocaleString('default', { month: 'short' })}</p>
                            <p class="text-xl font-black text-gray-900 dark:text-white leading-none">${e.dateObj.getDate()}</p>
                        </div>

                        <div class="absolute top-3 right-3 bg-brand-50 dark:bg-brand-900/80 backdrop-blur-md text-brand-700 dark:text-green-400 border border-brand-100 dark:border-brand-700/50 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm">
                            ${e.points_reward} Pts
                        </div>
                    </div>
                    
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-1 leading-tight">${e.title}</h3>
                    
                    <div class="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-5 mt-2">
                        <div class="flex items-center mr-4">
                             <i data-lucide="map-pin" class="w-4 h-4 mr-1.5 text-gray-400 dark:text-gray-500"></i>
                             <span>${e.location || 'Campus'}</span>
                        </div>
                        <div class="flex items-center">
                             <i data-lucide="clock" class="w-4 h-4 mr-1.5 text-gray-400 dark:text-gray-500"></i>
                             <span>${e.displayTime}</span>
                        </div>
                    </div>

                    <div class="flex items-center justify-between mb-6 cursor-pointer group p-2 -mx-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors" onclick="openParticipantsModal('${e.id}')">
                        <div class="avatar-stack group-hover:scale-105 transition-transform">
                            ${avatarsHtml}
                        </div>
                        <div class="text-right">
                             <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Organizer</p>
                             <p class="text-sm font-bold text-gray-800 dark:text-gray-200">${e.organizer || 'Green Club'}</p>
                        </div>
                    </div>
                </div>

                <div class="mt-auto">
                    ${actionBtn}
                </div>
            </div>
        `;
    });

    els.eventsList.innerHTML = eventsHTML;
    if(window.lucide) window.lucide.createIcons();
};

export const handleRSVP = async (eventId) => {
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Processing...';
    btn.disabled = true;

    try {
        const { error } = await supabase.from('event_attendance').insert({
            event_id: eventId,
            user_id: state.currentUser.id,
            status: 'registered'
        });

        if (error) throw error;
        
        logUserActivity('rsvp_event', `Registered for event`, { eventId });

        // Update Local State without full page refresh
        const eventIndex = state.events.findIndex(e => e.id === eventId);
        if (eventIndex > -1) {
            state.events[eventIndex].myStatus = 'going';
            renderEventsPage();
        }

        showToast("You have successfully registered!", "success");

    } catch (err) {
        console.error("RSVP Error:", err);
        showToast("Failed to RSVP. Please try again.", "error");
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

export const openParticipantsModal = (eventId) => {
    // Note: Detailed participant lists are disabled for bandwidth optimization.
    console.log("Participant list view restricted for performance.");
    showToast("Community view coming soon!", "warning");
};

export const closeParticipantsModal = () => {
    const modal = document.getElementById('participants-modal');
    const content = document.getElementById('participants-modal-content');
    if (!modal || !content) return;

    content.classList.remove('translate-y-0');
    content.classList.add('translate-y-full');

    setTimeout(() => {
        modal.classList.add('invisible', 'opacity-0');
    }, 300);
};

const updateDashboardEvent = () => {
    const card = document.getElementById('dashboard-event-card');
    if (!card) return;
    
    const now = new Date();
    const upcoming = state.events.find(e => new Date(e.start_at) > now);

    if (!upcoming) {
        card.classList.add('hidden');
    } else {
        card.classList.remove('hidden');
        document.getElementById('dashboard-event-title').textContent = upcoming.title;
        document.getElementById('dashboard-event-desc').textContent = upcoming.description || 'Join us!';
        state.featuredEvent = upcoming; 
    }
};

window.handleRSVP = handleRSVP;
window.openParticipantsModal = openParticipantsModal;
window.closeParticipantsModal = closeParticipantsModal;
window.renderEventsPageWrapper = renderEventsPage;
