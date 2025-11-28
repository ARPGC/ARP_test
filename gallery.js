import { state } from './state.js';
import { logUserActivity, isLowDataMode } from './utils.js';

// --- IMMERSIVE STORY CONFIGURATION ---
// Data sourced from B. K. Birla College Greentech Report
const CAMPUS_STORIES = [
    {
        id: 'story-hero',
        isHero: true,
        bgHex: '#ffffff', // Clean white entry
        darkBgHex: '#111827', // Dark gray for dark mode
        isDark: false 
    },
    {
        id: 'story-green-cover',
        title: 'A Living Laboratory.',
        subtitle: 'Green Campus & Biodiversity',
        description: 'Spanning 20 acres, our campus maintains a 49.53% green cover. With over 550 trees, 1600+ potted plants, and a dedicated Biodiversity Park, we have created a thriving ecosystem that acts as the city’s green lung.',
        image: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1200&q=80', 
        // THEME: Deep Forest (Nature)
        bgHex: '#064e3b', // Emerald-950
        isDark: true,
        textClass: 'text-emerald-50',
        headingClass: 'text-white',
        accentColor: 'bg-emerald-500',
        layout: 'normal', 
        imgShape: 'rounded-tr-[100px] rounded-bl-[100px]' 
    },
    {
        id: 'story-water',
        title: 'Every Drop Counts.',
        subtitle: 'Water Conservation',
        description: 'Our scientifically designed rainwater harvesting pits recharge groundwater, while our 300 KLD STP ensures treated water is reused. Over 4200 students actively track their water footprint using the "Why Waste" App.',
        image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=80',
        // THEME: Deep Ocean (Water)
        bgHex: '#083344', // Cyan-950
        isDark: true,
        textClass: 'text-cyan-50', 
        headingClass: 'text-white', 
        accentColor: 'bg-cyan-400', 
        layout: 'reverse', 
        imgShape: 'rounded-full aspect-square object-cover shadow-2xl' 
    },
    {
        id: 'story-energy',
        title: 'Powered by Nature.',
        subtitle: 'Renewable Energy',
        description: 'We have transitioned to a cleaner future. Our solar power plants now fulfill 50% of the campus energy needs. Combined with 100% LED lighting, BLDC fans, and sensor-based automation, we are minimizing our carbon footprint.',
        image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80', 
        // THEME: Solar Gold (Energy)
        bgHex: '#422006', // Dark Bronze
        isDark: true,
        textClass: 'text-yellow-50', 
        headingClass: 'text-white',
        accentColor: 'bg-yellow-500', 
        layout: 'normal', 
        imgShape: 'rounded-t-full' 
    },
    {
        id: 'story-waste',
        title: 'Zero Waste Mission.',
        subtitle: 'Waste Management',
        description: 'Our "Zero Waste" policy is in full effect. We convert organic waste into biogas (6500L digester), recycle sanitary waste via PadCare, and have responsibly recycled over 200 kg of e-waste. Colour-coded bins ensure strict segregation.',
        image: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=1200&q=80', 
        // THEME: Terracotta (Earth/Waste)
        bgHex: '#7c2d12', // Orange-900
        isDark: true,
        textClass: 'text-orange-50',
        headingClass: 'text-white',
        accentColor: 'bg-orange-400',
        layout: 'reverse', 
        imgShape: 'rounded-[3rem] rotate-1' 
    },
    {
        id: 'story-digital',
        title: 'Paperless & Smart.',
        subtitle: 'Digital Transformation',
        description: 'We are saving trees through technology. With Microsoft ERP for attendance and cloud storage for notes, we have drastically reduced paper use. Since 2018, we have also responsibly recycled over 202 kg of e-waste.',
        image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
        // THEME: Tech Slate (Dark Blue/Grey)
        bgHex: '#0f172a',
        isDark: true,
        textClass: 'text-slate-200',
        headingClass: 'text-white',
        accentColor: 'bg-indigo-500',
        layout: 'normal', 
        imgShape: 'rounded-xl' 
    },
    {
        id: 'story-mobility',
        title: 'Moving Responsibly.',
        subtitle: 'Green Mobility',
        description: 'We encourage a lower carbon footprint through "No-Vehicle Days" and a dedicated bicycle system for campus movement. Our pedestrian-friendly pathways ensure that walking is always the best option.',
        image: 'https://images.unsplash.com/photo-1558522669-8dd3362fa64e?auto=format&fit=crop&w=1200&q=80', // Bicycle image
        // THEME: Urban Asphalt (Cool Gray)
        bgHex: '#374151',
        isDark: true,
        textClass: 'text-gray-100',
        headingClass: 'text-white',
        accentColor: 'bg-teal-400',
        layout: 'reverse', 
        imgShape: 'rounded-full border-4 border-gray-600' 
    },
    {
        id: 'story-community',
        title: 'Community Impact.',
        subtitle: 'Social Responsibility',
        description: 'Our impact goes beyond the campus walls. We have distributed over 500 saplings to the community and actively monitor water quality in rural villages, ensuring clean and safe drinking water for all.',
        image: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80', // Community
        // THEME: Slate Tech (Modern)
        bgHex: '#0f172a', // Slate-900
        isDark: true,
        textClass: 'text-slate-200',
        headingClass: 'text-white',
        accentColor: 'bg-indigo-500',
        layout: 'normal', 
        imgShape: 'rounded-xl' 
    }
];

// 1. Load Data
export const loadGalleryData = async () => {
    state.gallery = CAMPUS_STORIES;
    // Only render if user is currently on the page
    if (document.getElementById('green-lens').classList.contains('active')) {
        renderGallery();
    }
};

// 2. Render Function
export const renderGallery = () => {
    const container = document.getElementById('gallery-feed');
    if (!container) return;
    
    container.innerHTML = '';
    const isLowData = isLowDataMode();

    // Set Initial Background immediately to avoid flash
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.style.backgroundColor = CAMPUS_STORIES[0].bgHex;

    state.gallery.forEach((item, index) => {
        const section = document.createElement('div');
        
        if (item.isHero) {
            // HERO SECTION
            section.className = "gallery-section pt-20 pb-32 px-6 text-center relative z-10";
            section.setAttribute('data-bg', item.bgHex);
            section.setAttribute('data-bg-dark', item.darkBgHex);
            
            section.innerHTML = `
                <div class="animate-slideUp max-w-4xl mx-auto">
                    <span class="inline-block px-4 py-1.5 rounded-full border border-green-200 bg-green-50 text-green-700 text-xs font-bold tracking-widest uppercase mb-6">
                        Excellence in Greentech
                    </span>
                    <h1 class="text-5xl md:text-8xl font-black text-gray-900 dark:text-white tracking-tighter font-jakarta leading-[0.9] mb-8">
                        EcoCampus<br>Green Lens.
                    </h1>
                    <p class="text-xl text-gray-500 max-w-lg mx-auto mb-12 font-medium">
                        Transforming 20 acres into a zero-waste, energy-efficient model for the future.
                    </p>
                    <div class="animate-bounce text-gray-400">
                        <i data-lucide="arrow-down" class="w-10 h-10 mx-auto"></i>
                    </div>
                </div>
            `;
        } else {
            // STORY SECTION
            const flexDirection = item.layout === 'reverse' ? 'lg:flex-row-reverse' : 'lg:flex-row';
            
            section.className = `gallery-section min-h-screen w-full flex flex-col ${flexDirection} items-center justify-center gap-12 lg:gap-24 px-6 lg:px-24 py-20 relative z-10`;
            
            section.setAttribute('data-bg', item.bgHex);
            section.setAttribute('data-bg-dark', item.bgHex); // In immersive mode, dark mode uses the same color

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
                    
                    <h2 class="text-4xl md:text-6xl font-black font-jakarta leading-tight mb-8 ${item.headingClass}">
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
    footer.setAttribute('data-bg', '#111827');
    footer.setAttribute('data-bg-dark', '#000000');
    footer.innerHTML = `
        <h3 class="text-4xl font-bold text-white mb-6">Join the Movement.</h3>
        <p class="text-gray-400 mb-8 max-w-md">Contribute to our Net Zero Carbon emission goals today.</p>
        <button onclick="showPage('challenges')" class="group relative px-8 py-4 bg-green-600 text-white font-bold rounded-full overflow-hidden shadow-lg hover:shadow-green-500/50 transition-all">
            <span class="relative z-10 flex items-center gap-2">Start a Challenge <i data-lucide="arrow-right" class="w-4 h-4"></i></span>
        </button>
    `;
    container.appendChild(footer);

    setupScrollObserver();
    if(window.lucide) window.lucide.createIcons();
};

// 3. Scroll Observer (Triggers Full-Page Color Change)
const setupScrollObserver = () => {
    const mainContent = document.querySelector('.main-content'); 
    const sections = document.querySelectorAll('.gallery-section');

    const observerOptions = {
        root: mainContent, 
        threshold: 0.4
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Determine correct BG color based on dark mode state
                const bg = document.documentElement.classList.contains('dark') 
                    ? (entry.target.getAttribute('data-bg-dark') || entry.target.getAttribute('data-bg'))
                    : entry.target.getAttribute('data-bg');
                
                if (bg) {
                    mainContent.style.backgroundColor = bg;
                }
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
};

// Helper to reset background when leaving this page (Called by utils.js)
export const resetGalleryBackground = () => {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.style.backgroundColor = '';
};

window.renderGalleryWrapper = renderGallery;
