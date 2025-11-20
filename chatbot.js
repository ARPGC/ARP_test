import { state } from './state.js';
import { els } from './utils.js';

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
// 1. Get FREE key: https://console.groq.com/keys
// 2. Paste it inside the quotes below:
const GROQ_API_KEY = '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'; 

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ==========================================
// 🧠 AI LOGIC
// ==========================================

const getSystemPrompt = () => {
    const user = state.currentUser || { full_name: 'Student', current_points: 0 };
    
    return `
    You are EcoBot, the friendly AI assistant for the "EcoCampus" app.
    
    USER CONTEXT:
    - Name: ${user.full_name}
    - Current EcoPoints: ${user.current_points}
    - Course: ${user.course || 'General'}

    YOUR KNOWLEDGE BASE:
    1. **App Goal:** Promote sustainability on campus through gamification.
    2. **Earning Points:** - Daily Check-in (+10 pts).
       - Participating in Events (RSVP in 'Events' tab).
       - Uploading photos of eco-actions (in 'Action' tab).
       - Daily Quiz.
    3. **Spending Points:** Go to the 'Store' tab to redeem coupons.
    4. **Leaderboard:** Shows top students and departments.

    PERSONALITY:
    - Be cheerful, encouraging, and concise.
    - Use emojis 🌿♻️.
    - Keep responses under 3 sentences.
    `;
};

const fetchAIResponse = async (userMessage) => {
    if (!GROQ_API_KEY || GROQ_API_KEY.includes('PASTE_YOUR')) {
        return "⚠️ API Key missing. Please get a free key from console.groq.com and paste it in chatbot.js";
    }

    const payload = {
        model: "llama3-8b-8192", // Free, fast, and smart model
        messages: [
            { role: "system", content: getSystemPrompt() },
            { role: "user", content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 150
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error("Groq API Error:", data);
            return `❌ Error: ${data.error?.message || 'Unknown error'}`;
        }

        return data.choices[0].message.content;

    } catch (error) {
        console.error("Network Error:", error);
        return "I'm having trouble connecting to the green network. 🌱 Please check your internet connection.";
    }
};

// ==========================================
// 🎨 UI HANDLERS
// ==========================================

const chatOutput = document.getElementById('chatbot-messages');
const chatForm = document.getElementById('chatbot-form');
const chatInput = document.getElementById('chatbot-input');
const modal = document.getElementById('chatbot-modal');
const modalContent = document.getElementById('chatbot-modal-content');

const appendMessage = (text, sender) => {
    const div = document.createElement('div');
    div.className = 'flex w-full mb-4 animate-fade-in';
    
    if (sender === 'user') {
        div.innerHTML = `
            <div class="ml-auto bg-green-600 text-white p-3 rounded-2xl rounded-tr-none max-w-[80%] shadow-md">
                <p class="text-sm">${text}</p>
            </div>`;
    } else {
        div.innerHTML = `
            <div class="flex items-end">
                <img src="https://i.ibb.co/7xwsMnBc/Pngtree-green-earth-globe-clip-art-16672659-1.png" class="w-6 h-6 mr-2 mb-1 object-contain">
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl rounded-tl-none max-w-[80%] shadow-sm">
                    <p class="text-sm text-gray-800 dark:text-gray-100">${marked.parse(text)}</p> 
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

        appendMessage(message, 'user');
        chatInput.value = '';
        
        const typingId = 'typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = typingId;
        typingDiv.className = 'flex w-full mb-4';
        typingDiv.innerHTML = `
             <div class="flex items-end">
                <img src="https://i.ibb.co/7xwsMnBc/Pngtree-green-earth-globe-clip-art-16672659-1.png" class="w-6 h-6 mr-2 mb-1 object-contain">
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl rounded-tl-none shadow-sm">
                    <div class="flex space-x-1">
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                    </div>
                </div>
            </div>`;
        chatOutput.appendChild(typingDiv);
        chatOutput.scrollTop = chatOutput.scrollHeight;

        const botResponse = await fetchAIResponse(message);

        const typingEl = document.getElementById(typingId);
        if(typingEl) typingEl.remove();
        appendMessage(botResponse, 'bot');
    });
}

window.openChatbotModal = () => {
    modal.classList.remove('invisible', 'opacity-0');
    modal.classList.add('open'); 
    setTimeout(() => {
        modalContent.classList.remove('translate-y-full');
        modalContent.classList.add('translate-y-0');
    }, 10);
};

window.closeChatbotModal = () => {
    modalContent.classList.remove('translate-y-0');
    modalContent.classList.add('translate-y-full');
    setTimeout(() => {
        modal.classList.remove('open');
        modal.classList.add('invisible', 'opacity-0');
    }, 300);
};

const marked = {
    parse: (text) => {
        if(!text) return '';
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/\n/g, '<br>');
        return text;
    }
};
