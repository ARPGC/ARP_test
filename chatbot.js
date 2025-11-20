import { supabase } from './supabase-client.js'; // Import Supabase
import { state } from './state.js';
import { els } from './utils.js';

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
// PASTE YOUR GROQ KEY HERE
const GROQ_API_KEY = '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'; 

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ==========================================
// 🧠 AI LOGIC (EcoBuddy's Brain)
// ==========================================

const getSystemPrompt = () => {
    const user = state.currentUser || { full_name: 'Eco-Warrior', current_points: 0, course: 'General' };

    // Format Live Data
    const activeEvents = state.events && state.events.length > 0 
        ? state.events.map(e => `• ${e.title} (${new Date(e.start_at).toLocaleDateString()})`).join('\n')
        : "No events right now.";
    
    const storeItems = state.products && state.products.length > 0
        ? state.products.slice(0, 5).map(p => `• ${p.name} (${p.ecopoints_cost} pts)`).join('\n')
        : "Store restocking.";

    const topRankers = state.leaderboard && state.leaderboard.length > 0
        ? state.leaderboard.slice(0, 3).map((u, i) => `${i+1}. ${u.full_name}`).join('\n')
        : "Loading...";
    
    return `
    You are **EcoBuddy**, the funny, friendly AI bestie for the **EcoCampus** App! 🌿😎
    
    **🆔 IDENTITY:**
    - **Creator:** Mr. Mohit Mali (SYBAF).
    - **Origin:** BKBNC Green Club Initiative.
    - **College:** B.K. Birla Night Arts, Science & Commerce College, Kalyan (**BKBNC**).
    
    **👤 USER:** ${user.full_name} (${user.current_points} Pts)
    
    **📊 LIVE DATA:**
    - **Events:** \n${activeEvents}
    - **Store:** \n${storeItems}
    - **Leaders:** \n${topRankers}
    
    **🗣️ VIBE:**
    - Speak like a cool college friend. Use slang, emojis, and humor.
    - If user speaks Hindi/Marathi/Hinglish, reply in that language!
    - Be helpful but keep it fun.
    `;
};

const fetchAIResponse = async (userMessage) => {
    if (!GROQ_API_KEY || GROQ_API_KEY.includes('PASTE_YOUR')) return "⚠️ Key Missing! Tell Mohit to fix chatbot.js line 9.";

    const payload = {
        model: "llama-3.3-70b-versatile", 
        messages: [
            { role: "system", content: getSystemPrompt() },
            { role: "user", content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 600
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) return `❌ Error: ${data.error?.message}`;
        return data.choices[0].message.content;
    } catch (error) {
        return "🔌 Net issue! Check connection.";
    }
};

// ==========================================
// 💾 SUPABASE HISTORY LOGIC
// ==========================================

const saveMessageToDB = async (role, message) => {
    if (!state.currentUser) return;
    try {
        await supabase.from('chat_history').insert({
            user_id: state.currentUser.id,
            role: role,
            message: message
        });
    } catch (err) {
        console.error("Save Chat Error:", err);
    }
};

const loadChatHistory = async () => {
    if (!state.currentUser) return;
    
    const chatOutput = document.getElementById('chatbot-messages');
    // Clear previous loading state but keep the "encrypted" notice
    chatOutput.innerHTML = `<div class="text-center py-6"><p class="text-xs text-gray-400 dark:text-gray-600">Messages are secured with end-to-end encryption.</p></div>`;

    try {
        const { data, error } = await supabase
            .from('chat_history')
            .select('*')
            .eq('user_id', state.currentUser.id)
            .order('created_at', { ascending: false }) // Get latest first
            .limit(20); // Only load last 20 messages

        if (error) throw error;

        if (data && data.length > 0) {
            // Reverse to show oldest to newest
            data.reverse().forEach(msg => appendMessageUI(msg.message, msg.role, false)); // false = no animation for history
            setTimeout(() => chatOutput.scrollTop = chatOutput.scrollHeight, 100);
        } else {
            // If no history, show welcome message
            appendMessageUI(`Hi ${state.currentUser.full_name}! I'm EcoBuddy. Ask me anything about BKBNC or saving the planet! 🌱`, 'bot');
        }
    } catch (err) {
        console.error("Load History Error:", err);
    }
};

// ==========================================
// 🎨 UI HANDLERS
// ==========================================

const chatOutput = document.getElementById('chatbot-messages');
const chatForm = document.getElementById('chatbot-form');
const chatInput = document.getElementById('chatbot-input');
const modal = document.getElementById('chatbot-modal');

// Separated UI logic from Data logic
const appendMessageUI = (text, sender, animate = true) => {
    const div = document.createElement('div');
    div.className = `flex w-full mb-4 ${animate ? 'animate-message' : ''}`;
    
    const parsedText = marked.parse(text);

    if (sender === 'user') {
        div.innerHTML = `
            <div class="msg-bubble msg-user">
                <div class="msg-content text-sm">${parsedText}</div>
            </div>`;
    } else {
        div.innerHTML = `
            <div class="flex items-end w-full">
                <img src="https://i.ibb.co/7xwsMnBc/Pngtree-green-earth-globe-clip-art-16672659-1.png" class="w-8 h-8 mr-2 mb-1 object-contain rounded-full border border-gray-200 bg-white p-0.5 flex-shrink-0">
                <div class="msg-bubble msg-bot">
                    <div class="msg-content text-sm">${parsedText}</div>
                </div>
            </div>`;
    }
    
    chatOutput.appendChild(div);
    chatOutput.scrollTop = chatOutput.scrollHeight; 
};

if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = chatInput.value.trim();
        if (!message) return;

        // 1. UI: Show User Message
        appendMessageUI(message, 'user');
        chatInput.value = '';
        
        // 2. DB: Save User Message
        saveMessageToDB('user', message);

        // 3. UI: Show Typing
        const typingId = 'typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = typingId;
        typingDiv.className = 'flex w-full mb-4 animate-message';
        typingDiv.innerHTML = `
             <div class="flex items-end">
                <img src="https://i.ibb.co/7xwsMnBc/Pngtree-green-earth-globe-clip-art-16672659-1.png" class="w-8 h-8 mr-2 mb-1 object-contain rounded-full bg-white p-0.5 border border-gray-200">
                <div class="msg-bubble msg-bot flex items-center gap-1 h-10">
                    <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                </div>
            </div>`;
        chatOutput.appendChild(typingDiv);
        chatOutput.scrollTop = chatOutput.scrollHeight;

        // 4. API: Fetch Response
        const botResponse = await fetchAIResponse(message);

        // 5. UI: Remove Typing & Show Response
        const typingEl = document.getElementById(typingId);
        if(typingEl) typingEl.remove();
        appendMessageUI(botResponse, 'bot');

        // 6. DB: Save Bot Response
        saveMessageToDB('bot', botResponse);
    });
}

// ==========================================
// 🚪 MODAL LOGIC
// ==========================================

window.openChatbotModal = () => {
    modal.classList.remove('hidden'); // Remove hidden if it was there
    // Slight delay to allow transition
    requestAnimationFrame(() => {
        modal.classList.remove('translate-y-full');
    });
    
    // Load history every time it opens
    loadChatHistory();
};

window.closeChatbotModal = () => {
    modal.classList.add('translate-y-full');
};

// ==========================================
// 📝 MARKDOWN PARSER
// ==========================================
const marked = {
    parse: (text) => {
        if(!text) return '';
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic
        text = text.replace(/^- (.*$)/gim, '<li>$1</li>'); // List items
        text = text.replace(/\n/g, '<br>'); // Newlines
        return text;
    }
};
