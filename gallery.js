import { state } from './state.js';
import { logUserActivity, isLowDataMode } from './utils.js';

// --- STATIC STORY DATA ---
const CAMPUS_STORIES = [
    {
        id: 'story-1',
        title: 'The Solar Canopy Project',
        category: 'Renewable Energy',
        description: 'Our B-Block roof is now 100% solar-powered, generating 50kW of clean energy daily for the science labs. This initiative reduces our carbon footprint by 40% and serves as a live research station for physics students.',
        image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1600&q=80',
        theme: 'bg-[#F0FDF4]', // Soft Emerald
        text_color: 'text-emerald-900',
        accent: 'bg-emerald-600'
    },
    {
        id: 'story-2',
        title: 'Native Botanical Garden',
        category: 'Biodiversity',
        description: 'Preserving local flora with over 200 indigenous plant species maintained by the Botany department. This "living library" attracts local pollinators and provides a serene study space for students.',
        image: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1600&q=80',
        theme: 'bg-[#FFF7ED]', // Soft Orange/Sand
        text_color: 'text-orange-900',
        accent: 'bg-orange-600'
    },
    {
        id: 'story-3',
        title: 'Zero-Waste Cafeteria',
        category: 'Sustainability',
        description: 'Converting 100% of wet waste into compost for our gardens using the new bio-gas plant. Our cafeteria has eliminated single-use plastics, replacing them with biodegradable alternatives made from sugarcane fiber.',
        image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1600&q=80',
        theme: 'bg-[#ECFEFF]', // Soft Cyan
        text_color: 'text-cyan-900',
        accent: 'bg-cyan-600'
    },
    {
        id: 'story-4',
        title: 'Paperless Campus Drive',
        category: 'Digital Transformation',
        description: 'Moving 90% of administrative work to digital platforms to save 500+ trees annually. Our new student portal handles everything from admissions to exam results, making the process seamless and eco-friendly.',
        image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80',
        theme: 'bg-[#F5F5F4]', // Soft Stone
        text_color: 'text-stone-800',
        accent: 'bg-stone-600'
    },
    {
        id: 'story-5',
        title: 'Eco-Warriors Team',
        category: 'Community Leadership',
        description: 'Meet the student council members leading the change for a greener tomorrow. These dedicated volunteers organize weekly cleanup drives, awareness workshops, and tree plantation events.',
        image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=80',
        theme: 'bg-[#F0F9FF]', // Soft Sky Blue
        text_color: 'text-sky-900',
        accent: 'bg-sky-600'
    }
];

// 1. Load Data
export const loadGalleryData = async () => {
    state.gallery = CAMPUS_STORIES;
    if (document.getElementById('green-lens').classList.contains('active')) {
        renderGallery();
    }
};

// 2. Render (Flagler Style: Full-Width Alternating Sections)
export const renderGallery = () => {
    const container = document.getElementById('gallery-feed');
    if (!container) return;
    
    container.innerHTML = '';
    const isLowData = isLowDataMode();

    state.gallery.forEach((item, index) => {
        const isEven = index % 2 === 0;
        const section = document.createElement('section');
        
        // Full width container with specific background color
        section.className = `w-full py-16 md:py-24 px-6 md:px-12 flex flex-col md:flex-row items-center gap-10 md:gap-16 ${item.theme} dark:bg-gray-900 transition-colors duration-500`;
        
        // Alternating Layout (Image Left vs Right)
        if (!isEven) section.classList.add('md:flex-row-reverse');

        const imgHTML = `
            <div class="w-full md:w-1/2 h-64 md:h-[500px] relative rounded-3xl overflow-hidden shadow-2xl transform hover:scale-[1.02] transition-transform duration-500">
                <img src="${item.image}" class="w-full h-full object-cover" loading="lazy" alt="${item.title}">
                ${!isLowData ? '<div class="absolute inset-0 bg-black/10 hover:bg-transparent transition-colors duration-300"></div>' : ''}
            </div>
        `;

        const textHTML = `
            <div class="w-full md:w-1/2 space-y-6">
                <div class="flex items-center gap-3">
                    <span class="h-px w-12 ${item.accent}"></span>
                    <span class="text-xs font-bold tracking-widest uppercase ${item.text_color} dark:text-gray-300">${item.category}</span>
                </div>
                
                <h2 class="text-4xl md:text-5xl font-black font-jakarta leading-tight text-gray-900 dark:text-white">
                    ${item.title}
                </h2>
                
                <p class="text-lg text-gray-700 dark:text-gray-300 leading-relaxed max-w-xl">
                    ${item.description}
                </p>

                <button onclick="logStoryInteraction('${item.title}')" class="group inline-flex items-center gap-2 text-sm font-bold ${item.text_color} dark:text-white mt-4 hover:opacity-70 transition-opacity">
                    Read Full Story 
                    <i data-lucide="arrow-right" class="w-4 h-4 transition-transform group-hover:translate-x-1"></i>
                </button>
            </div>
        `;

        section.innerHTML = imgHTML + textHTML;
        container.appendChild(section);
    });
    
    if(window.lucide) window.lucide.createIcons();
};

// Simple logging helper
window.logStoryInteraction = (title) => {
    logUserActivity('read_story', `Clicked on story: ${title}`);
};

// Expose to window
window.renderGalleryWrapper = renderGallery;
