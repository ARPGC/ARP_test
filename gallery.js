import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, getPlaceholderImage, logUserActivity, isLowDataMode, formatDate } from './utils.js';

export const loadGalleryData = async () => {
    const container = document.getElementById('gallery-grid');
    
    try {
        // Optimization: Select specifically what we need
        const { data, error } = await supabase
            .from('campus_gallery')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        state.gallery = data || [];
        
        if (document.getElementById('green-lens').classList.contains('active')) {
            renderGallery();
        }
    } catch (err) {
        console.error('Gallery Load Error:', err);
        if (container) {
            container.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-12 opacity-60 text-center">
                    <i data-lucide="image-off" class="w-10 h-10 text-gray-400 mb-2"></i>
                    <p class="text-sm text-gray-500">Gallery unavailable.</p>
                </div>
            `;
            if(window.lucide) window.lucide.createIcons();
        }
    }
};

export const renderGallery = () => {
    const container = document.getElementById('gallery-grid');
    if (!container) return;
    
    container.innerHTML = '';

    if (state.gallery.length === 0) {
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-12 opacity-60 text-center">
                <i data-lucide="camera" class="w-10 h-10 text-gray-400 mb-2"></i>
                <p class="text-sm text-gray-500">No posts yet.</p>
            </div>`;
        if(window.lucide) window.lucide.createIcons();
        return;
    }

    const lowData = isLowDataMode();

    state.gallery.forEach(item => {
        const isVideo = item.media_type === 'video';
        const displayUrl = (lowData && isVideo && item.thumbnail_url) ? item.thumbnail_url : item.media_url;
        const dateStr = formatDate(item.created_at);
        
        // POST CARD CONTAINER
        const card = document.createElement('div');
        card.className = "bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-6"; 
        
        // 1. HEADER (Title & Date)
        const headerHTML = `
            <div class="p-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                        <i data-lucide="${isVideo ? 'video' : 'image'}" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-gray-900 dark:text-white leading-tight">${item.title}</h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${dateStr}</p>
                    </div>
                </div>
                <button onclick="openLightbox('${item.id}')" class="text-gray-400 hover:text-green-600 transition-colors">
                    <i data-lucide="maximize-2" class="w-5 h-5"></i>
                </button>
            </div>
        `;

        // 2. MEDIA SECTION (Full Width)
        let mediaHTML = '';
        if (isVideo && !lowData) {
            mediaHTML = `
                <div class="relative w-full bg-black aspect-video cursor-pointer group" onclick="openLightbox('${item.id}')">
                    <video src="${displayUrl}" class="w-full h-full object-contain" muted loop onmouseover="this.play()" onmouseout="this.pause()"></video>
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
                        <div class="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                            <i data-lucide="play" class="w-6 h-6 text-white fill-white ml-1"></i>
                        </div>
                    </div>
                </div>
            `;
        } else {
            const poster = isVideo ? (item.thumbnail_url || getPlaceholderImage('400x300', 'Video')) : displayUrl;
            mediaHTML = `
                <div class="relative w-full cursor-pointer group" onclick="openLightbox('${item.id}')">
                    <img src="${poster}" class="w-full h-auto max-h-[500px] object-cover bg-gray-100 dark:bg-gray-900" loading="lazy">
                </div>`;
        }

        // 3. FOOTER (Description & Tags)
        const footerHTML = `
            <div class="p-4">
                <p class="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-3">
                    ${item.description || ''}
                </p>
                <div class="flex flex-wrap gap-2">
                    ${(item.tags || []).map(t => `
                        <span class="text-xs font-medium px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg">#${t}</span>
                    `).join('')}
                </div>
            </div>
        `;

        card.innerHTML = headerHTML + mediaHTML + footerHTML;
        container.appendChild(card);
    });
    
    if(window.lucide) window.lucide.createIcons();
};

// Lightbox Logic
export const openLightbox = (itemId) => {
    // Find item by ID instead of passing object to avoid serialization issues in HTML attributes
    const item = state.gallery.find(i => i.id == itemId); 
    if(!item) return;

    logUserActivity('view_gallery_item', `Opened ${item.media_type}: ${item.title}`);
    const modal = document.getElementById('gallery-modal');
    const content = document.getElementById('gallery-modal-content');
    
    let contentHTML = '';
    if (item.media_type === 'video') {
        contentHTML = `<video src="${item.media_url}" controls autoplay class="max-h-[80vh] w-full rounded-lg shadow-2xl bg-black"></video>`;
    } else {
        contentHTML = `<img src="${item.media_url}" class="max-h-[80vh] w-full object-contain rounded-lg shadow-2xl">`;
    }

    content.innerHTML = `
        ${contentHTML}
        <div class="mt-4 text-left max-w-2xl mx-auto">
            <h2 class="text-xl font-bold text-white">${item.title}</h2>
            <p class="text-gray-300 text-sm mt-1">${item.description || ''}</p>
        </div>
    `;

    modal.classList.remove('hidden', 'opacity-0');
    modal.classList.add('flex', 'opacity-100');
};

export const closeLightbox = () => {
    const modal = document.getElementById('gallery-modal');
    const content = document.getElementById('gallery-modal-content');
    const video = content.querySelector('video');
    if(video) video.pause();
    
    modal.classList.add('hidden', 'opacity-0');
    modal.classList.remove('flex', 'opacity-100');
};

window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
