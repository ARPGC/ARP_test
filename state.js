export const CLOUDINARY_CLOUD_NAME = 'dnia8lb2q';
export const CLOUDINARY_UPLOAD_PRESET = 'EcoBirla_avatars';
export const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

export const TICK_IMAGES = {
    blue: 'https://i.ibb.co/kgJpMCHr/blue.png',
    silver: 'https://i.ibb.co/gLJLF9Z2/silver.png',
    gold: 'https://i.ibb.co/Q2C7MrM/gold.png',
    black: 'https://i.ibb.co/zVNSNzrK/black.png',
    green: 'https://i.ibb.co/SXGL4Nq0/green.png'
};

// --- VALENTINE'S WEEK CONFIGURATION (Eco-Romantic Edition) ---
export const VALENTINE_DAYS = {
    7: { 
        title: 'Rose Day 🌹', 
        icon: 'flower', 
        color: 'text-rose-600 dark:text-rose-400', 
        desc: 'Real love grows. Plant a sapling today instead of picking a flower.',
        quote: "Love blooms where you plant it. Let's make the earth blossom together. 🌿❤️"
    },
    8: { 
        title: 'Propose Day 💍', 
        icon: 'heart-handshake', 
        color: 'text-orange-500 dark:text-orange-400', 
        desc: 'Pop the question: "Will you go Zero-Waste with me?"',
        quote: "I propose a lifetime of sustainable choices... and you by my side. 💍✨"
    },
    9: { 
        title: 'Chocolate Day 🍫', 
        icon: 'cookie', 
        color: 'text-amber-700 dark:text-amber-400', 
        desc: 'Sweet to the taste, kind to the waste. Recycle that foil wrapper!',
        quote: "Life is delicious when it's guilt-free. Sweet love, sustainable living. 🍫🌍"
    },
    10: { 
        title: 'Teddy Day 🧸', 
        icon: 'smile', 
        color: 'text-pink-500 dark:text-pink-400', 
        desc: 'Soft hearts protect the planet. Be a gentle guardian of nature.',
        quote: "The world is our teddy bear—handle it with care and love. 🧸💚"
    },
    11: { 
        title: 'Promise Day 🤝', 
        icon: 'shield-check', 
        color: 'text-sky-600 dark:text-sky-400', 
        desc: 'Make a vow to reduce your carbon footprint starting today.',
        quote: "A promise to you, a vow to the Earth. Forever green, forever ours. 🤞🌏"
    },
    12: { 
        title: 'Hug Day 🤗', 
        icon: 'users', 
        color: 'text-yellow-600 dark:text-yellow-400', 
        desc: 'Embrace the nature around you. Tree huggers are the best lovers!',
        quote: "Wrap your arms around the future. Hug a tree, hug a friend, heal the world. 🤗🌳"
    },
    13: { 
        title: 'Kiss Day 💋', 
        icon: 'heart', 
        color: 'text-purple-600 dark:text-purple-400', 
        desc: 'Sealed with a sustainable kiss. Say goodbye to toxic plastics.',
        quote: "Kiss the plastic goodbye. Let our love be as pure as the ocean breeze. 💋🌊"
    },
    14: { 
        title: 'Valentine’s Day 💖', 
        icon: 'sparkles', 
        color: 'text-red-600 dark:text-red-400', 
        desc: 'You are my world, so let’s save this one together.',
        quote: "My heart beats for two things: You, and a greener tomorrow. Happy Valentine's! 💘🌱"
    }
};

export let state = {
    currentUser: {
        id: null,
        is_volunteer: false 
    }, 
    userAuth: null,    
    checkInReward: 10,
    leaderboard: [],
    departmentLeaderboard: [],
    stores: [],
    products: [],      
    history: [],
    dailyChallenges: [],
    events: [],
    userRewards: [],   
    
    // Levels configuration
    levels: [
        { level: 1, title: 'Green Starter', minPoints: 0, nextMin: 1001, desc: "Just beginning your eco-journey. Every point counts!" },
        { level: 2, title: 'Eco Learner', minPoints: 1001, nextMin: 2001, desc: "You're building green habits. Keep up the momentum!" },
        { level: 3, title: 'Sustainability Leader', minPoints: 2001, nextMin: 4001, desc: "A true inspiration! You're making a real impact on campus." },
        { level: 4, title: 'Planet Protector', minPoints: 4001, nextMin: Infinity, desc: "You've reached the pinnacle of green living!" }
    ],

    // Module Loading Flags
    dashboardLoaded: false,
    leaderboardLoaded: false,
    storeLoaded: false,
    userRewardsLoaded: false,
    historyLoaded: false,
    challengesLoaded: false,
    eventsLoaded: false,
    galleryLoaded: false,
    plasticLoaded: false,
    
    // Feature Flags
    quizAvailable: false,
    quizAttempted: false,
    currentQuizId: null,
    quizStatusLoaded: false,
    userHasGivenFeedback: false,
    featuredEvent: null
};
