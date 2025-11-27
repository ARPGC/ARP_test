import { state } from './state.js';
import { logUserActivity, isLowDataMode } from './utils.js';

// --- IMMERSIVE STORY CONFIGURATION ---
const CAMPUS_STORIES = [
    {
        id: 'story-hero',
        isHero: true,
        bgHex: '#ffffff', 
        isDark: false 
    },
    {
        id: 'story-solar',
        title: 'Powering the Future.',
        subtitle: 'The Solar Canopy Initiative',
        description: 'Our B-Block roof isn\'t just a shelter; it\'s a power station. Generating 50kW of clean energy daily, this architectural marvel powers our science labs and stands as a testament to our carbon-neutral goals.',
        image: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1200&q=80', 
        bgHex: '#064e3b', 
        isDark: true,
        textClass: 'text-emerald-50', 
        headingClass: 'text-white',
        accentColor: 'bg-emerald-400', 
        layout: 'normal', 
        imgShape: 'rounded-tr-[100px] rounded-bl-[100px]' 
    },
    {
        id: 'story-garden',
        title: 'A Library Without Walls.',
        subtitle: 'Native Botanical Sanctuary',
        description: 'Forget dull lectures. Our Botany students learn in the "Living Library"—a curated sanctuary of 200+ indigenous plant species. It is a classroom where local biodiversity thrives.',
        image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1200&q=80',
        bgHex: '#271c19', 
        isDark: true,
        textClass: 'text-orange-50', 
        headingClass: 'text-white', 
        accentColor: 'bg-orange-400', 
        layout: 'reverse', 
        imgShape: 'rounded-t-full' 
    },
    {
        id: 'story-waste',
        title: 'Closing the Loop.',
        subtitle: 'Zero-Waste Cafeteria',
        description: 'We are redefining consumption. From biodegradable sugarcane plates to our on-site bio-gas plant that turns leftovers into energy, every meal served here is a step towards a landfill-free campus.',
        image: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=1200&q=80',
        bgHex: '#0f172a',
        isDark: true,
        textClass: 'text-slate-100',
        headingClass: 'text-white',
        accentColor: 'bg-indigo-400',
        layout: 'normal', 
        imgShape: 'rounded-[3rem]' 
    },
    {
        id: 'story-water',
        title: 'Every Drop Counts.',
        subtitle: 'Smart Water Conservation',
        description: 'Our rainwater harvesting systems collect over 100,000 liters annually, recharging the campus groundwater tables. We don’t just use water; we respect it, protect it, and replenish it.',
        image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=80',
        bgHex: '#164e63',
        isDark: true,
        textClass: 'text-cyan-50',
        headingClass: 'text-white',
        accentColor: 'bg-cyan-400',
        layout: 'reverse', 
        imgShape: 'rounded-full aspect-square object-cover shadow-2xl' 
    }
];

// 1. Load Data
export const loadGalleryData = async () => {
    state.gallery = CAMPUS_STORIES;
    if (document.getElementById('green-lens').classList.contains('active')) {
        renderGallery();
    }
};

// 2. Render
export const renderGallery = () => {
    const container = document.getElementById('gallery-feed');
    if (!container) return;
    
    container.innerHTML = '';
    const isLowData = isLowDataMode();

    // Set Initial Background immediately
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.style.backgroundColor = CAMPUS_STORIES[0].bgHex;

    state.gallery.forEach((item, index) => {
        const section = document.createElement('div');
        
        if (item.isHero) {
            // FIX: Removed 'bg-white' class so it is transparent
            section.className = "gallery-section pt-20 pb-32 px-6 text-center relative z-10";
            section.setAttribute('data-bg', item.bgHex);
            
            section.innerHTML = `
                <div class="animate-slideUp max-w-4xl mx-auto">
                    <span class="inline-block px-4 py-1.5 rounded-full border border-green-200 bg-green-50 text-green-700 text-xs font-bold tracking-widest uppercase mb-6">
                        Our College's Initiative
                    </span>
                    <h1 class="text-6xl md:text-9xl font-black text-gray-900 dark:text-white tracking-tighter font-jakarta leading-[0.9] mb-8">
                        Campus.<br>Reimagined.
                    </h1>
                    <p class="text-xl text-gray-500 max-w-lg mx-auto mb-12 font-medium">
                        Scroll to explore the initiatives that define our commitment to a sustainable future.
                    </p>
                    <div class="animate-bounce text-gray-400">
                        <i data-lucide="arrow-down" class="w-10 h-10 mx-auto"></i>
                    </div>
                </div>
            `;
        } else {
            const flexDirection = item.layout === 'reverse' ? 'lg:flex-row-reverse' : 'lg:flex-row';
            
            // FIX: Removed inline style.backgroundColor from section
            // FIX: Removed bg-white/5 from image container for cleaner look
            section.className = `gallery-section min-h-screen w-full flex flex-col ${flexDirection} items-center justify-center gap-12 lg:gap-24 px-6 lg:px-24 py-20 relative z-10`;
            
            section.setAttribute('data-bg', item.bgHex);

            const imgHTML = `
                <div class="w-full lg:w-1/2 flex justify-center items-center relative z-10">
                    <div class="relative w-full max-w-lg aspect-[4/5] ${item.imgShape} overflow-hidden shadow-2xl transform hover:scale-[1.02] transition-transform duration-700 ease-out group">
                        <img src="${item.image}" class="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-1000" loading="lazy" alt="${item.title}">
                        ${!isLowData ? '<div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>' : ''}
                    </div>
                </div>
            `;

            const textHTML = `
                <div class="w-full lg:w-1/2 text-center lg:text-left relative z-10">
                    <div class="flex items-center justify-center lg:justify-start gap-3 mb-6">
                        <span class="h-0.5 w-12 ${item.accentColor}"></span>
                        <span class="text-xs font-bold tracking-[0.2em] uppercase ${item.textClass} opacity-90">${item.subtitle}</span>
                    </div>
                    
                    <h2 class="text-5xl md:text-7xl font-black font-jakarta leading-tight mb-8 ${item.headingClass}">
                        ${item.title}
                    </h2>
                    
                    <p class="text-lg md:text-xl leading-relaxed ${item.textClass} opacity-90 max-w-xl mx-auto lg:mx-0 font-medium">
                        ${item.description}
                    </p>
                </div>
            `;

            const decorHTML = `
                <div class="absolute top-20 left-4 md:left-20 text-[15rem] font-black opacity-10 select-none pointer-events-none mix-blend-overlay text-white leading-none font-jakarta z-0">
                    0${index}
                </div>
            `;

            section.innerHTML = imgHTML + textHTML + decorHTML;
        }
        
        container.appendChild(section);
    });

    // FOOTER
    const footer = document.createElement('div');
    footer.className = "gallery-section min-h-[50vh] flex flex-col items-center justify-center text-center px-6 relative z-20";
    // Footer inherits last color or sets its own dark one
    footer.setAttribute('data-bg', '#111827'); 
    footer.innerHTML = `
        <h3 class="text-4xl font-bold text-white mb-6">Be Part of the Story.</h3>
        <button onclick="showPage('challenges')" class="group relative px-8 py-4 bg-green-600 text-white font-bold rounded-full overflow-hidden shadow-lg hover:shadow-green-500/50 transition-all">
            <span class="relative z-10 flex items-center gap-2">Start a Challenge <i data-lucide="arrow-right" class="w-4 h-4"></i></span>
        </button>
    `;
    container.appendChild(footer);

    setupScrollObserver();
    if(window.lucide) window.lucide.createIcons();
};

const setupScrollObserver = () => {
    const mainContent = document.querySelector('.main-content'); 
    const sections = document.querySelectorAll('.gallery-section');

    const observerOptions = {
        root: mainContent, 
        threshold: 0.3 // Trigger slightly earlier
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const bg = entry.target.getAttribute('data-bg');
                
                if (bg && mainContent) {
                    // APPLY COLOR GLOBAL
                    mainContent.style.backgroundColor = bg;
                }
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
};

export const resetGalleryBackground = () => {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.style.backgroundColor = '';
};

window.renderGalleryWrapper = renderGallery;
