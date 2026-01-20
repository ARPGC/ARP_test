import { supabase } from '../supabase-client.js';
import { state } from '../state.js';
// Importing directly from utils.js to share logic
import { showToast, uploadToCloudinary, getPlaceholderImage, logUserActivity } from './utils.js';

let html5QrcodeScanner = null;
let currentScannedStudentId = null; // This is the UUID of the student being scanned
let currentGpsCoords = null;        // Stores "Lat,Long" string
let currentProofFile = null;        // Stores the file object

// ==========================================
// 1. INITIALIZATION
// ==========================================

export const initVolunteerPanel = () => {
    if (!document.getElementById('volunteer-panel')) return;
    setupEventListeners();
    console.log("Volunteer Panel Initialized");
};

const setupEventListeners = () => {
    // 1. Weight Input Listener (Auto-calculate Points)
    const weightInput = document.getElementById('v-weight');
    if (weightInput) {
        // Remove old listeners by cloning
        const newWeightInput = weightInput.cloneNode(true);
        weightInput.parentNode.replaceChild(newWeightInput, weightInput);
        newWeightInput.addEventListener('input', calculateMetrics);
    }
    
    // 2. File Input Listener (Preview Image)
    const proofInput = document.getElementById('v-proof-upload');
    if (proofInput) {
        const newProofInput = proofInput.cloneNode(true);
        proofInput.parentNode.replaceChild(newProofInput, proofInput);
        newProofInput.addEventListener('change', handleProofPreview);
    }

    // 3. Form Submission Listener
    const form = document.getElementById('plastic-submission-form');
    if (form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        newForm.addEventListener('submit', submitPlasticEntry);
    }
};

// ==========================================
// 2. VIEW CONTROLLERS
// ==========================================

window.openPlasticCollection = () => {
    document.getElementById('volunteer-menu').classList.add('hidden');
    document.getElementById('volunteer-work-area').classList.remove('hidden');
    clearForm();
    startScanner();
};

window.resetVolunteerForm = () => {
    stopScanner();
    document.getElementById('volunteer-work-area').classList.add('hidden');
    document.getElementById('volunteer-menu').classList.remove('hidden');
    document.getElementById('scanner-container').classList.add('hidden');
    document.getElementById('collection-form').classList.add('hidden');
    clearForm();
};

const clearForm = () => {
    const form = document.getElementById('plastic-submission-form');
    if (form) form.reset();

    const img = document.getElementById('v-proof-img');
    if (img) {
        img.src = '';
        img.classList.add('hidden');
    }

    const preview = document.getElementById('v-proof-preview-container');
    if(preview) preview.classList.remove('hidden');
    
    // Reset Counters
    document.getElementById('v-calc-points').textContent = '0';
    document.getElementById('v-calc-co2').textContent = '0.00';
    document.getElementById('v-gps-status').innerHTML = '<i data-lucide="crosshair" class="w-3 h-3"></i> Waiting for GPS...';
    
    currentScannedStudentId = null;
    currentGpsCoords = null;
    currentProofFile = null;
};

// ==========================================
// 3. SCANNER LOGIC (html5-qrcode)
// ==========================================

const startScanner = () => {
    const scannerContainer = document.getElementById('scanner-container');
    scannerContainer.classList.remove('hidden');
    document.getElementById('collection-form').classList.add('hidden');

    if (html5QrcodeScanner) return; // Prevent duplicate instances

    // Check if library is loaded
    if (typeof Html5Qrcode === 'undefined') {
        showToast("Scanner library loading...", "warning");
        setTimeout(startScanner, 500);
        return;
    }

    try {
        html5QrcodeScanner = new Html5Qrcode("qr-reader");

        const config = { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };

        // Prefer back camera ("environment")
        html5QrcodeScanner.start(
            { facingMode: "environment" }, 
            config,
            onScanSuccess,
            onScanError
        ).catch(err => {
            console.error("Camera Start Error:", err);
            showToast("Camera permission denied.", "error");
            window.resetVolunteerForm();
        });
    } catch (e) {
        console.error("Scanner Init Error:", e);
    }
};

const onScanSuccess = async (decodedText, decodedResult) => {
    console.log(`Scan result: ${decodedText}`);
    stopScanner();

    // Basic Validation: Student ID should be ~7 digits
    const studentId = decodedText.trim();
    if (!/^\d{7}$/.test(studentId)) {
        showToast("Invalid QR. Expected 7-digit Student ID.", "error");
        // Restart scanner after a short delay if invalid
        setTimeout(() => {
            if(!html5QrcodeScanner) startScanner();
        }, 2000); 
        return;
    }

    await fetchStudentDetails(studentId);
};

const onScanError = (errorMessage) => {
    // We ignore frame errors to avoid console spam
};

window.closeScanner = () => {
    stopScanner();
    window.resetVolunteerForm();
};

const stopScanner = () => {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        }).catch(err => console.error("Stop Scanner Error:", err));
    }
};

// ==========================================
// 4. DATA FETCHING (Student Info)
// ==========================================

const fetchStudentDetails = async (studentId) => {
    try {
        showToast("Fetching Student Info...", "info");
        
        // Find the user by their 7-digit Student ID
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, profile_img_url, student_id')
            .eq('student_id', studentId)
            .single();

        if (error || !data) throw new Error("Student not found in database.");

        // Store the UUID for the submission
        currentScannedStudentId = data.id;

        // Update UI
        document.getElementById('v-student-name').textContent = data.full_name;
        document.getElementById('v-student-id').textContent = `ID: ${data.student_id}`;
        document.getElementById('v-student-img').src = data.profile_img_url || getPlaceholderImage('100x100', 'User');
        
        // Switch Views
        document.getElementById('scanner-container').classList.add('hidden');
        document.getElementById('collection-form').classList.remove('hidden');

        // Start GPS Fetch
        getGPSLocation();

    } catch (err) {
        console.error(err);
        showToast(err.message, "error");
        window.resetVolunteerForm();
    }
};

// ==========================================
// 5. METRICS & UTILS
// ==========================================

const calculateMetrics = (e) => {
    const weight = parseFloat(e.target.value) || 0;
    
    // Rule: 1 KG = 100 Points
    const points = Math.max(0, Math.round(weight * 100));
    
    // Rule: 1 KG = 1.60 KG CO2 Saved
    const co2 = (weight * 1.60).toFixed(2);

    document.getElementById('v-calc-points').textContent = points;
    document.getElementById('v-calc-co2').textContent = co2;
};

const handleProofPreview = (e) => {
    const file = e.target.files[0];
    if (file) {
        currentProofFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.getElementById('v-proof-img');
            const container = document.getElementById('v-proof-preview-container');
            
            img.src = e.target.result;
            img.classList.remove('hidden');
            container.classList.add('hidden');
            
            // Show retake button
            document.getElementById('v-retake-btn').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
};

const getGPSLocation = () => {
    const statusEl = document.getElementById('v-gps-status');
    
    if (!navigator.geolocation) {
        statusEl.innerHTML = `<span class="text-red-500">GPS Not Supported</span>`;
        return;
    }

    statusEl.innerHTML = `<span class="text-orange-500 flex items-center gap-1"><i data-lucide="loader-2" class="animate-spin w-3 h-3"></i> Locating...</span>`;
    if(window.lucide) window.lucide.createIcons();

    navigator.geolocation.getCurrentPosition(
        (position) => {
            // Store as "Lat,Long" string
            currentGpsCoords = `${position.coords.latitude},${position.coords.longitude}`;
            
            statusEl.innerHTML = `<span class="text-green-600 flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i> Location Locked</span>`;
            statusEl.classList.remove('animate-pulse');
            if(window.lucide) window.lucide.createIcons();
        },
        (error) => {
            console.error("GPS Error", error);
            statusEl.innerHTML = `<span class="text-red-500">GPS Failed (Enable Location)</span>`;
            statusEl.classList.remove('animate-pulse');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
};

// ==========================================
// 6. SUBMISSION
// ==========================================

const submitPlasticEntry = async (e) => {
    e.preventDefault();
    
    // 1. Validations
    if (!currentScannedStudentId) {
        showToast("No student selected.", "error");
        return;
    }
    
    const weight = parseFloat(document.getElementById('v-weight').value);
    const program = document.getElementById('v-program').value; // Get Selected Program
    const locationName = document.getElementById('v-location').value;

    if (!weight || weight <= 0) {
        showToast("Please enter a valid weight.", "warning");
        return;
    }
    
    if (!currentProofFile) {
        showToast("Photo proof is required.", "warning");
        return;
    }

    // 2. Button Loading State
    const btn = document.getElementById('v-submit-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin w-4 h-4 mr-2"></i> Uploading...`;
    if(window.lucide) window.lucide.createIcons();

    try {
        // 3. Upload Photo to Cloudinary
        const proofUrl = await uploadToCloudinary(currentProofFile);

        btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin w-4 h-4 mr-2"></i> Saving...`;
        if(window.lucide) window.lucide.createIcons();

        // 4. Insert into Supabase
        const { error } = await supabase.from('plastic_submissions').insert({
            user_id: currentScannedStudentId,    // Who gave the plastic
            weight_kg: weight,
            plastic_type: 'PET',                 // Hardcoded as per requirement
            status: 'pending',                   // Admin needs to approve
            verified_by: state.currentUser.id,   // Volunteer ID (You)
            verified_at: new Date().toISOString(),
            location: locationName,              // e.g. "Library"
            volunteer_coords: currentGpsCoords || 'Unknown', // Stored in new column
            submission_url: proofUrl,            // Cloudinary Image URL
            program: program                     // "CEP", "Green Club", "Individual"
        });

        if (error) throw error;

        // 5. Success
        showToast("Entry Submitted Successfully! 🌿", "success");
        
        // Log activity (optional, but good for tracking)
        logUserActivity(
            'volunteer_collection', 
            `Collected ${weight}kg from ${currentScannedStudentId}`, 
            state.currentUser.id
        );
        
        window.resetVolunteerForm();

    } catch (err) {
        console.error("Submission Error:", err);
        showToast("Failed to submit. Try again.", "error");
    } finally {
        // Reset Button
        btn.disabled = false;
        btn.innerHTML = originalText;
        if(window.lucide) window.lucide.createIcons();
    }
};
