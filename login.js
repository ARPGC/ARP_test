// Import the Supabase client
import { supabase } from './supabase-client.js';
import { logActivity } from './utils.js'; // Import centralized logger

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
        if (btnText) btnText.classList.add('hidden');
        if (loader) loader.classList.remove('hidden');
    } else {
        button.disabled = false;
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

    // 1. Offline Check
    if (!navigator.onLine) {
        showMessage("No internet connection. Please connect to log in.");
        return;
    }

    setLoading(loginButton, true);
    showMessage('', false); // Clear previous messages

    const studentId = document.getElementById('login-studentid').value.trim();
    const password = document.getElementById('login-password').value;

    // Log the attempt (never log passwords!)
    logActivity('login_attempt', { studentId: studentId });

    try {
        // Step 1: Securely call the Edge Function
        const { data, error } = await supabase.functions.invoke('login-with-studentid', {
            body: { studentId, password },
        });

        if (error) {
            console.error("Function error:", error);
            throw new Error("Server error. Please try again later.");
        } else if (data.error) {
            throw new Error(data.error);
        } else if (data.session) {
            // Step 2: The function returned a valid session.
            const { error: sessionError } = await supabase.auth.setSession(data.session);
            
            if (sessionError) {
                console.error("Session set error:", sessionError);
                throw new Error("Login failed during session creation.");
            } else {
                // Login successful
                logActivity('login_success', { studentId: studentId });
                window.location.href = 'index.html';
            }
        } else {
            throw new Error("An unexpected error occurred.");
        }

    } catch (err) {
        showMessage(err.message);
        logActivity('login_failure', { studentId: studentId, error: err.message });
    } finally {
        setLoading(loginButton, false);
    }
}


/**
 * Checks if a user is already logged in.
 * If so, redirects them to the main app.
 */
async function checkUserSession() {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
        // User is already logged in, redirect to index.html
        window.location.href = 'index.html';
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    loginForm = document.getElementById('login-form');
    loginButton = document.getElementById('login-button');
    authMessage = document.getElementById('auth-message');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    } else {
        console.error("Login form not found!");
    }

    checkUserSession();
});
