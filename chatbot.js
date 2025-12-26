import { supabase } from './supabase-client.js'; // Import Supabase
import { state } from './state.js';
import { els, logUserActivity } from './utils.js';

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
// Update this if Supabase gives you a different URL
const EDGE_FUNCTION_URL = 'https://aggqmjxhnsbmsymwblqg.supabase.co/functions/v1/chat-ai'; 

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
    
    **🏆 EVENT RESULTS: Mr. & Miss BKBNC 2025 🏆**
    *Current Status: EVENT CONCLUDED / RESULTS DECLARED*
    
    **✨ THE OFFICIAL WINNERS (CONFIRMED):**
    
    **🤴 Mr. BKBNC 2025:**
    - **WINNER:** 🥇 **Aashish Santosh Yadav** (TYBCOM)
    - **Runner Up:** 🥈 **Yashraj Dattatray Gaikwad** (TYBSC CS)

    **👸 Miss BKBNC 2025:**
    - **WINNER:** 🥇 **Vaidehi Balu Gund** (TYBMS)
    - **Runner Up:** 🥈 **Dharani Shankar Mudaliyar** (TYBSC CS)

    **📋 OTHER OFFICIAL NOMINEES (BOYS):**
    - Krushnakant Pal (TYBSC CS)
    - Suraj Ramsudhakar Yadav (TYBSC CS)
    - Prasad Pankaj Jawale (SYBSC CS)
    - Mr. Dhananjay Gupta (TYBSc)
    *(Do not mention any other names for Boys category. Only these existed.)*

    **📋 OTHER OFFICIAL NOMINEES (GIRLS):**
    - Ekta Mukesh Dixit (TYBSC CS)
    - Divya Anand Nair (SYBSC CS)
    - Kaustubhi Chavan (TYBSC CS)
    - Ms. Dhani Singh (SYBMS)
    *(Do not mention any other names for Girls category. Only these existed.)*

        **✅ USER VERIFICATION TICKS (VERY IMPORTANT):**
    EcoCampus uses colored verification ticks to identify user roles:

    -  **Gold Tick** → Admin User (College authority / system admin)
    -  **Silver Tick** → EcoSquad Core Team Member
    -  **Blue Tick** → Verified Special User (Faculty, guest, alumni, verified contributor)
    -  **Green Tick** → Green Club Member (Active eco participant)

    **RULES:**
    - Always explain tick meanings clearly if a user asks.
    - Never assign or promise a tick; ticks are system-controlled.
    - Do NOT invent new tick colors.


    **🚫 SECURITY & ANTI-HALLUCINATION PROTOCOL (CRITICAL):**
    1. **NO VOTE COUNTS:** You **DO NOT** have access to the vote numbers. The database is encrypted.
    2. **DO NOT GUESS:** If a user asks "How many votes?", "Vote counts?", or "Who got 400 votes?", you must reply: *"The exact vote counts are confidential and digitally encrypted to ensure fairness. I can only share the final results!"*
    3. **DO NOT INVENT:** Never make up a number like "420" or "350". Never invent a candidate name that is not listed above. Stick STRICTLY to the names provided here.

    **🗳️ Result Methodology:**
    - The final results were calculated based on **Preference Voting, Live Performance Voting, Mentor Voting, and Judges Voting**.
    
    **📱 APP FEATURES MASTERCLASS:**
    1. **Dashboard:** Daily streaks (restore for 50pts), AQI, Impact Stats.
    2. **Challenges:** Camera proofs, Daily Quiz.
    3. **Plastic Log:** Generate QR for Green Club desk.
    4. **Eco-Store:** Redeem points, get QR code in "Orders".
    5. **Leaderboard:** Student vs Dept rankings.

    **🧠 CORE STUDENT TEAM:**
    1. **Mohit Mali (Founder/Dev)**
    2. **Amit Rai (Marketing)**
    3. **Darshana Jagtap (PR)**
    4. **Shruti Kadam (HR)**
    5. **Aashish Yadav (Event Head)**
    6. **Abhishek Gupta (Digital Strategy)**
    7. **Harshad Lokare (Documentation)**

    **👤 USER CONTEXT:** User: **${user.full_name}**. Points: **${user.current_points}**.
    
    **📊 LIVE DATA:**
    - Events: \n${activeEvents}
    - Store: \n${storeItems}
    - Leaders: \n${topRankers}
    
    **🗣️ VIBE:**
    - Cool, college senior vibe. Emojis (🔥, 🌿, 🚀).
    - **STRICTLY** follow the Security Protocol regarding votes.
    `;
};

const fetchAIResponse = async (userMessage) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        // Call Supabase Edge Function
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token || ''}` 
            },
            body: JSON.stringify({ 
                message: userMessage,
                systemPrompt: getSystemPrompt() 
            })
        });

        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || "Server Error");
        return data.reply;

    } catch (error) {
        console.error("AI Fetch Error:", error);
        return "🔌 My brain is offline (Server Error). Try again later!";
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
    chatOutput.innerHTML = `<div class="text-center py-6"><p class="text-xs text-gray-400 dark:text-gray-600">Messages are secured with end-to-end encryption.</p></div>`;

    try {
        const { data, error } = await supabase
            .from('chat_history')
            .select('*')
            .eq('user_id', state.currentUser.id)
            .order('created_at', { ascending: false }) 
            .limit(20); 

        if (error) throw error;

        if (data && data.length > 0) {
            data.reverse().forEach(msg => appendMessageUI(msg.message, msg.role, false)); 
            setTimeout(() => chatOutput.scrollTop = chatOutput.scrollHeight, 100);
        } else {
            appendMessageUI(`Hi ${state.currentUser.full_name}! I'm EcoBuddy. Ask me about the **Mr. & Miss BKBNC** results or how to earn points! 👑🌿`, 'bot');
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

// SEPARATED UI LOGIC
const appendMessageUI = (text, sender, animate = true) => {
    const div = document.createElement('div');
    div.className = `msg-group w-full flex ${sender === 'user' ? 'justify-end' : 'justify-start'} ${animate ? 'animate-slideUp' : ''}`;
    
    const parsedText = marked.parse(text);

    if (sender === 'user') {
        // User Bubble
        div.innerHTML = `
            <div class="max-w-[85%] p-4 px-5 rounded-[20px] rounded-br-lg text-white shadow-md bg-gradient-to-br from-[#34c46e] to-[#169653]">
                <div class="text-sm leading-relaxed">${parsedText}</div>
            </div>`;
    } else {
        // Bot Bubble WITH EARTH LOGO
        div.innerHTML = `
            <div class="flex items-end gap-2 max-w-[90%]">
                <div class="w-8 h-8 rounded-full bg-white p-0.5 shadow-sm flex-shrink-0 border border-[#c8ffe1]">
                    <img src="https://i.ibb.co/7xwsMnBc/Pngtree-green-earth-globe-clip-art-16672659-1.png" class="w-full h-full object-contain rounded-full">
                </div>
                <div class="p-4 px-5 rounded-[20px] rounded-bl-lg border border-[#c8ffe1]/75 dark:border-white/10 bg-white/85 dark:bg-[#1e3c2d]/70 text-[#2c4434] dark:text-[#e7ffef]">
                    <div class="text-sm leading-relaxed">${parsedText}</div>
                </div>
            </div>`;
    }
    
    const chatOutput = document.getElementById('chatbot-messages');
    if (chatOutput) {
        chatOutput.appendChild(div);
        chatOutput.scrollTop = chatOutput.scrollHeight; 
    }
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
        logUserActivity('chat_message', 'User sent a chat message');

        // 3. UI: Show Typing
        const typingId = 'typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = typingId;
        typingDiv.className = 'msg-group w-full flex justify-start animate-slideUp';
        typingDiv.innerHTML = `
            <div class="flex items-end gap-2 max-w-[90%]">
                <div class="w-8 h-8 rounded-full bg-white p-0.5 shadow-sm flex-shrink-0 border border-[#c8ffe1]">
                    <img src="https://i.ibb.co/7xwsMnBc/Pngtree-green-earth-globe-clip-art-16672659-1.png" class="w-full h-full object-contain rounded-full">
                </div>
                <div class="p-4 px-5 rounded-[20px] rounded-bl-lg border border-[#c8ffe1]/75 dark:border-white/10 bg-white/85 dark:bg-[#1e3c2d]/70 flex items-center gap-1 h-[54px]">
                     <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                </div>
            </div>`;
        
        const chatOutput = document.getElementById('chatbot-messages');
        if(chatOutput) {
             chatOutput.appendChild(typingDiv);
             chatOutput.scrollTop = chatOutput.scrollHeight;
        }

        // 4. API: Fetch Response (Via Edge Function)
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
// 🚪 MODAL LOGIC (Responsive)
// ==========================================

window.openChatbotModal = () => {
    logUserActivity('open_chatbot', 'Opened Chatbot');
    const modal = document.getElementById('chatbot-modal');
    modal.classList.add('open'); // Use .open class for better CSS control
    modal.classList.remove('invisible'); 
    
    // Slight delay for animation triggers
    requestAnimationFrame(() => {
        modal.classList.remove('translate-y-full');
    });
    
    loadChatHistory();
};

window.closeChatbotModal = () => {
    const modal = document.getElementById('chatbot-modal');
    modal.classList.remove('open');
    modal.classList.add('translate-y-full');
    setTimeout(() => {
        modal.classList.add('invisible');
    }, 500); // Match CSS transition time
};

// ==========================================
// 📝 MARKDOWN PARSER
// ==========================================
const marked = {
    parse: (text) => {
        if(!text) return '';
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); 
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>'); 
        text = text.replace(/^- (.*$)/gim, '<li>$1</li>'); 
        text = text.replace(/\n/g, '<br>'); 
        return text;
    }
};
