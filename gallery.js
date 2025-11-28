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
        description: 'Our B-Block roof isn\'t just a shelter; it\'s a power station. [cite_start]Generating 50kW of clean energy daily, this architectural marvel powers our science labs and stands as a testament to our carbon-neutral goals[cite: 13, 186].',
        image: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1200&q=80', 
        // THEME: Deep Forest (Green)
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
        description: 'Forget dull lectures. [cite_start]Our Botany students learn in the "Living Library"—a curated sanctuary of 200+ indigenous plant species[cite: 79]. [cite_start]With over 550 trees and 1,600 potted plants[cite: 4], this is where local biodiversity thrives.',
        image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1200&q=80',
        // THEME: Warm Sandstone (Brown/Gold)
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
        description: 'We are redefining consumption. [cite_start]From our 6,500L Biogas plant that turns canteen waste into cooking gas [cite: 109][cite_start], to the PadCare system recycling sanitary waste[cite: 137], every by-product here finds a new life.',
        image: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=1200&q=80',
        // THEME: Earthen Clay (Terracotta)
        bgHex: '#7c2d12',
        isDark: true,
        textClass: 'text-orange-100',
        headingClass: 'text-white',
        accentColor: 'bg-orange-300',
        layout: 'normal', 
        imgShape: 'rounded-[3rem] rotate-1' 
    },
    {
        id: 'story-water',
        title: 'Every Drop Counts.',
        subtitle: 'Smart Water Conservation',
        description: 'Our scientifically designed rainwater harvesting pits recharge groundwater [cite: 167][cite_start], while our STP ensures treated water is reused for gardening[cite: 136]. [cite_start]Over 4,200 students actively track their water footprint using the "Why Waste" App[cite: 173].',
        image: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=80',
        // THEME: Deep Ocean (Cyan/Navy)
        bgHex: '#083344',
        isDark: true,
        textClass: 'text-cyan-50',
        headingClass: 'text-white',
        accentColor: 'bg-cyan-400',
        layout: 'reverse', 
        imgShape: 'rounded-full aspect-square object-cover shadow-2xl' 
    },
    {
        id: 'story-digital',
        title: 'Paperless & Smart.',
        subtitle: 'Digital Transformation',
        description: 'We are saving trees through technology. [cite_start]With Microsoft ERP for attendance [cite: 118] [cite_start]and cloud storage for notes[cite: 117], we have drastically reduced paper use. [cite_start]Since 2018, we have also responsibly recycled over 202 kg of e-waste[cite: 142].',
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
        description: 'We encourage a lower carbon footprint through "No-Vehicle Days" [cite: 145] [cite_start]and a dedicated bicycle system for campus movement[cite: 150]. [cite_start]Our pedestrian-friendly pathways ensure that walking is always the best option[cite: 153].',
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
        title: 'Roots in the Community.',
        subtitle: 'Social Impact',
        description: 'Our impact extends beyond walls. [cite_start]We have distributed over 500 saplings to locals [cite: 224] [cite_start]and our Environmental Lab actively monitors drinking water quality in rural villages[cite: 216], ensuring safe water for all.',
        image: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=80',
        // THEME: Rose Passion (Dark Pink/Red)
        bgHex: '#881337',
        isDark: true,
        textClass: 'text-rose-100',
        headingClass: 'text-white',
        accentColor: 'bg-rose-400',
        layout: 'normal', 
        imgShape: 'rounded-tl-[80px] rounded-br-[80px]' 
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

    state.gallery.forEach((item, index) => {
        const section = document.createElement('div');
        
        if (item.isHero) {
            // HERO SECTION (No gap at top)
            section.className = "gallery-section pt-20 pb-32 px-6 text-center relative z-10";
            section.setAttribute('data-bg', item.bgHex);
            
            section.innerHTML = `
                <div class="animate-slideUp max-w-4xl mx-auto">
                    <span class="inline-block px-4 py-1.5 rounded-full border border-green-200 bg-green-50 text-green-700 text-xs font-bold tracking-widest uppercase mb-6">
                        The GreenLens Project
                    </span>
                    <h1 class="text-5xl md:text-8xl font-black text-gray-900 dark:text-white tracking-tighter font-jakarta leading-[0.9] mb-8">
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
            // STORY SECTION
            const flexDirection = item.layout === 'reverse' ? 'lg:flex-row-reverse' : 'lg:flex-row';
            
            section.className = `gallery-section min-h-screen w-full flex flex-col ${flexDirection} items-center justify-center gap-12 lg:gap-24 px-6 lg:px-24 py-20 relative z-10`;
            
            // Initial color set to avoid flicker
            section.style.backgroundColor = item.bgHex;
            
            section.setAttribute('data-bg', item.bgHex);

            const imgHTML = `
                <div class="w-full lg:w-1/2 flex justify-center items-center relative z-10">
                    <div class="relative w-full max-w-lg aspect-[4/5] ${item.imgShape} overflow-hidden shadow-2xl transform hover:scale-[1.02] transition-transform duration-700 ease-out group bg-white/5">
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
    footer.className = "gallery-section min-h-[50vh] flex flex-col items-center justify-center text-center px-6 relative z-20 bg-[#111827]";
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
        threshold: 0.4
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const bg = entry.target.getAttribute('data-bg');
                
                if (bg) {
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
