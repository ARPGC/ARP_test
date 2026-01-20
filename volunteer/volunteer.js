import { supabase } from '../supabase-client.js';
import { state } from '../state.js';
// Import from LOCAL utils to avoid circular dependency
import { showToast, uploadToCloudinary, getPlaceholderImage, logUserActivity } from './utils.js';

let html5QrcodeScanner = null;
let currentScannedStudentId = null; // UUID of the student
let currentGpsCoords = null;        // "Lat,Long"
let uploadedProofUrl = null;        // Stores the Cloudinary URL after background upload
let isUploading = false;            // Locks submit button during upload

// ==========================================
// 1. INITIALIZATION
// ==========================================

export const initVolunteerPanel = () => {
    if (!document.getElementById('volunteer-panel')) return;
    setupEventListeners();
    console.log("Volunteer Panel Initialized");
};

const setupEventListeners = () => {
    // 1. Weight Input Listener (Instant Calculation)
    const weightInput = document.getElementById('v-weight');
    if (weightInput) {
        // Allow decimals like .005
        weightInput.setAttribute('step', 'any');
        weightInput.setAttribute('min', '0.001'); 
        
        const newWeightInput = weightInput.cloneNode(true);
        weightInput.parentNode.replaceChild(newWeightInput, weightInput);
        
        // 'input' fires on every keystroke
        newWeightInput.addEventListener('input', calculateMetrics);
        newWeightInput.addEventListener('keyup', calculateMetrics); // Fallback for some mobile keyboards
    }
    
    // 2. File Input Listener (Instant Upload)
    const proofInput = document.getElementById('v-proof-upload');
    if (proofInput) {
        const newProofInput = proofInput.cloneNode(true);
        proofInput.parentNode.replaceChild(newProofInput, proofInput);
        newProofInput.addEventListener('change', handleProofSelect);
    }

    // 3. Form Submission
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

    // Reset Image Preview & Upload State
    const img = document.getElementById('v-proof-img');
    const container = document.getElementById('v-proof-preview-container');
    const retakeBtn = document.getElementById('v-retake-btn');
    const loadingOverlay = document.getElementById('v-upload-loading'); // Helper we will add dynamically

    if (img) {
        img.src = '';
        img.classList.add('hidden');
    }
    if (container) container.classList.remove('hidden');
    if (retakeBtn) retakeBtn.classList.add('hidden');
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    
    // Reset Stats
    const pts = document.getElementById('v-calc-points');
    const co2 = document.getElementById('v-calc-co2');
    if(pts) pts.textContent = '0';
    if(co2) co2.textContent = '0.00';
    
    // Reset Status
    const gpsStat = document.getElementById('v-gps-status');
    if(gpsStat) gpsStat.innerHTML = '<i data-lucide="crosshair" class="w-3 h-3"></i> Waiting for GPS...';
    
    currentScannedStudentId = null;
    currentGpsCoords = null;
    uploadedProofUrl = null;
    isUploading = false;
    toggleSubmitButton(true); // Enable by default (will be validated on click)
};

// ==========================================
// 3. SCANNER LOGIC
// ==========================================

const startScanner = () => {
    const scannerContainer = document.getElementById('scanner-container');
    scannerContainer.classList.remove('hidden');
    document.getElementById('collection-form').classList.add('hidden');

    if (html5QrcodeScanner) return; 

    if (typeof Html5Qrcode === 'undefined') {
        showToast("Scanner library loading...", "warning");
        setTimeout(startScanner, 500);
        return;
    }

    try {
        html5QrcodeScanner = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

        html5QrcodeScanner.start(
            { facingMode: "environment" }, 
            config,
            onScanSuccess,
            onScanError
        ).catch(err => {
            console.error("Camera Start Error:", err);
            showToast("Camera access denied.", "error");
            window.resetVolunteerForm();
        });
    } catch (e) { console.error("Scanner Init Error:", e); }
};

const onScanSuccess = async (decodedText) => {
    console.log(`Scan result: ${decodedText}`);
    stopScanner();

    // Validate 7-digit ID (Standard BKBNC ID format)
    const studentId = decodedText.trim();
    if (!/^\d{7}$/.test(studentId)) {
        showToast("Invalid QR. Expected 7-digit Student ID.", "error");
        setTimeout(() => { if(!html5QrcodeScanner) startScanner(); }, 2000); 
        return;
    }

    await fetchStudentDetails(studentId);
};

const onScanError = () => {}; // Ignore frame errors

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
// 4. DATA FETCHING
// ==========================================

const fetchStudentDetails = async (studentId) => {
    try {
        showToast("Fetching Student Info...", "info");
        
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, profile_img_url, student_id')
            .eq('student_id', studentId)
            .single();

        if (error || !data) throw new Error("Student not found in database.");

        currentScannedStudentId = data.id;

        // Update UI
        document.getElementById('v-student-name').textContent = data.full_name;
        document.getElementById('v-student-id').textContent = `ID: ${data.student_id}`;
        document.getElementById('v-student-img').src = data.profile_img_url || getPlaceholderImage('100x100', 'User');
        
        // Show Form
        document.getElementById('scanner-container').classList.add('hidden');
        document.getElementById('collection-form').classList.remove('hidden');

        getGPSLocation();

    } catch (err) {
        console.error(err);
        showToast(err.message, "error");
        window.resetVolunteerForm();
    }
};

// ==========================================
// 5. METRICS & INSTANT UPLOAD
// ==========================================

const calculateMetrics = (e) => {
    let val = e.target.value;
    
    // Handle empty or invalid inputs gracefully
    if (val === '' || val === '.') {
        document.getElementById('v-calc-points').textContent = '0';
        document.getElementById('v-calc-co2').textContent = '0.00';
        return;
    }

    const weight = parseFloat(val);
    
    // Rule: 1 KG = 100 Points. Min 1 point.
    const points = Math.max(1, Math.round(weight * 100));
    
    // Rule: 1 KG = 1.60 KG CO2 Saved
    const co2 = (weight * 1.60).toFixed(3); // 3 decimals for small weights

    document.getElementById('v-calc-points').textContent = points;
    document.getElementById('v-calc-co2').textContent = co2;
};

// Handle file selection: Preview AND Instant Upload
const handleProofSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Show Preview Immediately
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('v-proof-img');
        const container = document.getElementById('v-proof-preview-container');
        const retake = document.getElementById('v-retake-btn');
        
        img.src = e.target.result;
        img.classList.remove('hidden');
        container.classList.add('hidden');
        retake.classList.remove('hidden');
    };
    reader.readAsDataURL(file);

    // 2. Start Background Upload
    await startInstantUpload(file);
};

const startInstantUpload = async (file) => {
    const btn = document.getElementById('v-submit-btn');
    const container = document.querySelector('.relative'); // Parent of image
    
    // Create/Show Loader overlay on image
    let loader = document.getElementById('v-upload-loading');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'v-upload-loading';
        loader.className = 'absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white rounded-xl z-10';
        loader.innerHTML = `<i data-lucide="loader-2" class="animate-spin w-8 h-8 mb-2"></i><span class="text-xs font-bold">Uploading...</span>`;
        // Find the image wrapper to append to
        const imgWrapper = document.getElementById('v-proof-img').parentNode;
        imgWrapper.appendChild(loader);
        if(window.lucide) window.lucide.createIcons();
    }
    loader.classList.remove('hidden');

    isUploading = true;
    uploadedProofUrl = null;
    toggleSubmitButton(false, "Uploading Photo...");

    try {
        const url = await uploadToCloudinary(file);
        uploadedProofUrl = url;
        
        // Success State
        loader.innerHTML = `<i data-lucide="check-circle" class="w-8 h-8 text-green-400 mb-2"></i><span class="text-xs font-bold text-green-400">Uploaded</span>`;
        if(window.lucide) window.lucide.createIcons();
        
        // Auto-hide success message after 1s
        setTimeout(() => loader.classList.add('hidden'), 1500);
        
    } catch (err) {
        console.error("Upload failed", err);
        loader.innerHTML = `<i data-lucide="alert-circle" class="w-8 h-8 text-red-400 mb-2"></i><span class="text-xs font-bold text-red-400">Failed</span>`;
        if(window.lucide) window.lucide.createIcons();
        showToast("Photo upload failed. Please retake.", "error");
    } finally {
        isUploading = false;
        toggleSubmitButton(true);
    }
};

const toggleSubmitButton = (enabled, text = null) => {
    const btn = document.getElementById('v-submit-btn');
    if (!btn) return;
    
    btn.disabled = !enabled;
    if (text) {
        // Keep icon if possible, just change text
        btn.innerHTML = `<i data-lucide="${enabled ? 'check-circle' : 'loader-2'}" class="w-5 h-5 ${enabled ? '' : 'animate-spin'} mr-2"></i> ${text}`;
    } else {
        btn.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5 mr-2"></i> Submit Entry`;
    }
    if(window.lucide) window.lucide.createIcons();
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
    
    if (isUploading) {
        showToast("Please wait for photo upload to finish.", "warning");
        return;
    }

    if (!currentScannedStudentId) {
        showToast("No student selected.", "error");
        return;
    }
    
    const weight = parseFloat(document.getElementById('v-weight').value);
    const program = document.getElementById('v-program').value;
    const locationName = document.getElementById('v-location').value;

    // Allow weights as low as 0.001 (1 gram)
    if (!weight || weight < 0.001) {
        showToast("Minimum weight is 0.001 kg (1g).", "warning");
        return;
    }
    
    if (!uploadedProofUrl) {
        showToast("Photo proof is missing or upload failed.", "warning");
        return;
    }

    // Lock UI
    toggleSubmitButton(false, "Saving Entry...");

    try {
        // Insert into Supabase (No upload needed here, already done)
        const { error } = await supabase.from('plastic_submissions').insert({
            user_id: currentScannedStudentId,
            weight_kg: weight,
            plastic_type: 'PET',                 
            status: 'pending',
            verified_by: state.currentUser.id,
            verified_at: new Date().toISOString(),
            location: locationName,
            volunteer_coords: currentGpsCoords || 'Unknown',
            submission_url: uploadedProofUrl, // Use the pre-uploaded URL
            program: program
        });

        if (error) throw error;

        showToast("Entry Submitted! 🌿", "success");
        
        logUserActivity(
            'volunteer_collection', 
            `Collected ${weight}kg from user ${currentScannedStudentId}`, 
            state.currentUser.id
        );
        
        window.resetVolunteerForm();

    } catch (err) {
        console.error("Submission Error:", err);
        showToast("Failed to submit. Try again.", "error");
    } finally {
        toggleSubmitButton(true);
    }
};
