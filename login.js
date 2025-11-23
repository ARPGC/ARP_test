// Import the Supabase client
import { supabase } from './supabase-client.js';
// Import activity logger
import { logActivity } from './utils.js';

// --- DOM Elements ---
let loginForm;
let loginButton;
let authMessage;

// --- Helper Functions ---

/**
 * Shows an error message to the user.
 * @param {string} message The error message to display.
 */
function showMessage(message, isError = true) {
    if (authMessage) {
        authMessage.textContent = message;
        authMessage.className = isError 
            ? 'text-red-500 text-sm text-center mb-4 h-5 font-bold' 
            : 'text-green-500 text-sm text-center mb-4 h-5 font-bold';
            
        // Animation for attention
        if (isError) {
            authMessage.classList.add('animate-pulse');
            setTimeout(() => authMessage.classList.remove('animate-pulse'), 500);
        }
    }
}

/**
 * Toggles the loading state of a button.
 * @param {HTMLButtonElement} button The button element.
 * @param {boolean} isLoading Whether to show the loading state.
 */
function setLoading(button, isLoading) {
    if (!button) return;
    const btnText = button.querySelector('.btn-text');
    const loader = button.querySelector('i');
    
    if (isLoading) {
        button.disabled = true;
        button.classList.add('opacity-80', 'cursor-not-allowed');
        if (btnText) btnText.classList.add('hidden');
        if (loader) loader.classList.remove('hidden');
    } else {
        button.disabled = false;
        button.classList.remove('opacity-80', 'cursor-not-allowed');
        if (btnText) btnText.classList.remove('hidden');
        if (loader) loader.classList.add('hidden');
    }
}

// --- Auth Logic ---

/**
 * Handles the login form submission by calling our Edge Function.
 */
async function handleLogin(event) {
    event.preventDefault();
    
    // 1. Network Check
    if (!navigator.onLine) {
        showMessage("You are offline. Please check your connection.");
        return;
    }

    setLoading(loginButton, true);
    showMessage('', false); // Clear previous messages

    const studentId = document.getElementById('login-studentid').value.trim();
    const password = document.getElementById('login-password').value.trim();

    try {
        // 2. Clear any stale offline data before attempting login
        // This fixes the "Unable to login after logout" bug
        if (window.localforage) {
            await window.localforage.clear();
        }

        // 3. Securely call the Edge Function
        const { data, error } = await supabase.functions.invoke('login-with-studentid', {
            body: { studentId, password },
        });

        if (error) {
            console.error("Function error:", error);
            throw new Error("Server error. Please try again.");
        } 
        
        if (data.error) {
            // This is a logic error message from *within* our function (e.g., "Invalid Password")
            throw new Error(data.error);
        } 
        
        if (data.session) {
            // 4. The function returned a valid session.
            // We must manually set the session in the client-side library.
            const { error: sessionError } = await supabase.auth.setSession(data.session);
            
            if (sessionError) {
                console.error("Session set error:", sessionError);
                throw new Error("Login failed to establish session.");
            } else {
                // Login successful
                // Log activity (we try/catch to ensure no crash if modules aren't fully ready)
                try { logActivity('auth', 'login_success', `User ${studentId} logged in`); } catch(e){}
                
                window.location.replace('index.html');
            }
        } else {
            throw new Error("An unexpected error occurred.");
        }

    } catch (err) {
        // Log failure
        console.error("Login Flow Error:", err);
        showMessage(err.message);
    } finally {
        setLoading(loginButton, false);
    }
}


/**
 * Checks if a user is already logged in.
 * If so, redirects them to the main app.
 * If NOT, ensures the offline cache is cleared so we don't show old data.
 */
async function checkUserSession() {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
        // User is already logged in, redirect to index.html
        window.location.replace('index.html');
    } else {
        // If no session, ensures localForage is empty to prevent ghost data
        if (window.localforage) {
            await window.localforage.clear();
        }
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Now assign the elements
    loginForm = document.getElementById('login-form');
    loginButton = document.getElementById('login-button');
    authMessage = document.getElementById('auth-message');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    } else {
        console.error("Login form not found!");
    }

    // Check for existing session on page load
    checkUserSession();
});
