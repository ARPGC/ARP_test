import { supabase } from '../supabase-client.js';
import { state, CLOUDINARY_API_URL, CLOUDINARY_UPLOAD_PRESET } from '../state.js';

// 1. Toast Notification (Reuses existing CSS)
export const showToast = (message, type = 'success') => {
    const existingToast = document.getElementById('app-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'app-toast';
    
    const bgClass = type === 'error' ? 'bg-red-600' : type === 'warning' ? 'bg-amber-500' : 'bg-emerald-600';
    // Use simple SVG string to avoid dependency on Lucide if not loaded yet, or strictly use font-awesome if preferred. 
    // Here we assume Lucide is available globally or we use simple innerHTML icons.
    const icon = type === 'error' ? 'alert-circle' : type === 'warning' ? 'alert-triangle' : 'check-circle';

    toast.className = `fixed bottom-10 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-3 px-6 py-3.5 rounded-2xl text-white shadow-2xl animate-slideUp ${bgClass} transition-all duration-300 min-w-[280px] justify-center`;
    
    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-5 h-5"></i>
        <span class="text-sm font-bold tracking-tight">${message}</span>
    `;

    document.body.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-4');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// 2. Image Upload
export const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
    try {
        const res = await fetch(CLOUDINARY_API_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.secure_url;
    } catch (err) { 
        console.error("Upload Error:", err); 
        throw err; 
    }
};

// 3. Placeholder Helper
export const getPlaceholderImage = (size = '400x300', text = 'EcoCampus') => {
    return `https://placehold.co/${size}/EBFBEE/166534?text=${text}&font=inter`;
};

// 4. Activity Logger
export const logUserActivity = async (actionType, description, metadata = {}) => {
    try {
        if (!state.currentUser) return;
        supabase.from('user_activity_log').insert({
            user_id: state.currentUser.id,
            action_type: actionType,
            description: description,
            metadata: metadata
        }).then(({ error }) => {
            if (error) console.warn("Log failed:", error.message);
        });
    } catch (err) { }
};
