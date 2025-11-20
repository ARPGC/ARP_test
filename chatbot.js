import { state } from './state.js';
import { els } from './utils.js';

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
// 1. Get a free key here: https://aistudio.google.com/app/apikey
// 2. Paste it inside the quotes below:
const GEMINI_API_KEY = 'AIzaSyDnt02vXZKe0LXdMg9eXvqdxMGYdgNJCCU'; 

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
       - Quizzes.
    3. **Spending Points:** Go to the 'Store' tab to redeem coupons for canteen items or merchandise.
    4. **Leaderboard:** Shows top students and departments.

    PERSONALITY:
    - Be cheerful, encouraging, and concise.
    - Use emojis 🌿♻️.
    - If asked about code/technical bugs, jokingly say you are just a leaf-loving bot.
    - Keep responses under 3 sentences when possible.
    `;
};

const fetchAIResponse = async (userMessage) => {
    if (!GEMINI_API_KEY) return "⚠️ Please add your API Key in chatbot.js to enable me!";

    const prompt = {
        contents: [{
            parts: [{
                text: getSystemPrompt() + `\n\nUser: ${userMessage}\nEcoBot:`
            }]
        }]
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prompt)
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        // Extract text from Gemini response
        return data.candidates[0].content.parts[0].text;

    } catch (error) {
        console.error("AI Error:", error);
        return "I'm having trouble connecting to the green network right now. 🌱 Please try again later.";
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

// Add a message to the chat window
const appendMessage = (text, sender) => {
    const div = document.createElement('div');
    div.className = 'flex w-full mb-4 animate-fade-in';
    
    if (sender === 'user') {
        div.innerHTML = `
            <div class="ml-auto bg-green-600 text-white p-3 rounded-2xl rounded-tr-none max-w-[80%] shadow-md">
                <p class="text-sm">${text}</p>
            </div>`;
    } else {
        // Bot message
        div.innerHTML = `
            <div class="flex items-end">
                <img src="https://i.ibb.co/7xwsMnBc/Pngtree-green-earth-globe-clip-art-16672659-1.png" class="w-6 h-6 mr-2 mb-1 object-contain">
                <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-2xl rounded-tl-none max-w-[80%] shadow-sm">
                    <p class="text-sm text-gray-800 dark:text-gray-100">${marked.parse(text)}</p> <!-- markdown parsing -->
                </div>
            </div>`;
    }
    
    chatOutput.appendChild(div);
    chatOutput.scrollTop = chatOutput.scrollHeight; // Auto scroll to bottom
};

// Handle Form Submit
if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = chatInput.value.trim();
        if (!message) return;

        // 1. Show User Message
        appendMessage(message, 'user');
        chatInput.value = '';
        
        // 2. Show Typing Indicator
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

        // 3. Fetch AI Response
        const botResponse = await fetchAIResponse(message);

        // 4. Remove Typing & Show Response
        document.getElementById(typingId).remove();
        appendMessage(botResponse, 'bot');
    });
}

// ==========================================
// 🚪 MODAL LOGIC (Exposed to Window)
// ==========================================

window.openChatbotModal = () => {
    modal.classList.remove('invisible', 'opacity-0');
    modal.classList.add('open'); // Triggers CSS visibility
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

// Simple Markdown Parser for Bold/Italic support
const marked = {
    parse: (text) => {
        // Bold
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Newlines
        text = text.replace(/\n/g, '<br>');
        return text;
    }
};
