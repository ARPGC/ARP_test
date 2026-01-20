import { supabase } from '../supabase-client.js';
import { state } from '../state.js';
// Import utilities from the root folder
import { showToast, uploadToCloudinary, getPlaceholderImage, logUserActivity } from '../utils.js';

let html5QrcodeScanner = null;
let currentScannedStudentId = null; // UUID of the student
let currentGpsCoords = null;        // "Lat,Long"
let currentProofFile = null;        // File object

// ==========================================
// 1. INITIALIZATION
// ==========================================

export const initVolunteerPanel = () => {
    if (!document.getElementById('volunteer-panel')) return;
    setupEventListeners();
    console.log("Volunteer Panel Initialized");
};

const setupEventListeners = () => {
    // 1. Weight Input Listener (Auto-calculate)
    const weightInput = document.getElementById('v-weight');
    if (weightInput) {
        // Clone to remove old listeners if re-initialized
        const newWeightInput = weightInput.cloneNode(true);
        weightInput.parentNode.replaceChild(newWeightInput, weightInput);
        newWeightInput.addEventListener('input', calculateMetrics);
    }
    
    // 2. File Input Listener (Preview)
    const proofInput = document.getElementById('v-proof-upload');
    if (proofInput) {
        const newProofInput = proofInput.cloneNode(true);
        proofInput.parentNode.replaceChild(newProofInput, proofInput);
        newProofInput.addEventListener('change', handleProofPreview);
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

    // Reset Image Preview
    const img = document.getElementById('v-proof-img');
    const container = document.getElementById('v-proof-preview-container');
    const retakeBtn = document.getElementById('v-retake-btn');

    if (img) {
        img.src = '';
        img.classList.add('hidden');
    }
    if (container) container.classList.remove('hidden');
    if (retakeBtn) retakeBtn.classList.add('hidden');
    
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
    currentProofFile = null;
};

// ==========================================
// 3. SCANNER LOGIC (html5-qrcode)
// ==========================================

const startScanner = () => {
    const scannerContainer = document.getElementById('scanner-container');
    scannerContainer.classList.remove('hidden');
    document.getElementById('collection-form').classList.add('hidden');

    if (html5QrcodeScanner) return; // Prevent duplicates

    // Wait for library if not ready
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

        html5QrcodeScanner.start(
            { facingMode: "environment" }, 
            config,
            onScanSuccess,
            onScanError
        ).catch(err => {
            console.error("Camera Start Error:", err);
            showToast("Camera access denied. Check permissions.", "error");
            window.resetVolunteerForm();
        });
    } catch (e) {
        console.error("Scanner Init Error:", e);
    }
};

const onScanSuccess = async (decodedText, decodedResult) => {
    console.log(`Scan result: ${decodedText}`);
    stopScanner();

    // Validate 7-digit ID
    const studentId = decodedText.trim();
    if (!/^\d{7}$/.test(studentId)) {
        showToast("Invalid QR. Expected 7-digit Student ID.", "error");
        setTimeout(() => {
            if(!html5QrcodeScanner) startScanner();
        }, 2000); 
        return;
    }

    await fetchStudentDetails(studentId);
};

const onScanError = (errorMessage) => {
    // Ignore frame errors to keep console clean
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
        
        // Fetch User UUID based on 7-digit ID
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, profile_img_url, student_id')
            .eq('student_id', studentId)
            .single();

        if (error || !data) throw new Error("Student not found in database.");

        currentScannedStudentId = data.id;

        // Fill UI
        document.getElementById('v-student-name').textContent = data.full_name;
        document.getElementById('v-student-id').textContent = `ID: ${data.student_id}`;
        document.getElementById('v-student-img').src = data.profile_img_url || getPlaceholderImage('100x100', 'User');
        
        // Show Form
        document.getElementById('scanner-container').classList.add('hidden');
        document.getElementById('collection-form').classList.remove('hidden');

        // Start GPS
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
            const retake = document.getElementById('v-retake-btn');
            
            img.src = e.target.result;
            img.classList.remove('hidden');
            container.classList.add('hidden');
            retake.classList.remove('hidden');
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
    
    if (!currentScannedStudentId) {
        showToast("No student selected.", "error");
        return;
    }
    
    const weight = parseFloat(document.getElementById('v-weight').value);
    const program = document.getElementById('v-program').value;
    const locationName = document.getElementById('v-location').value;

    if (!weight || weight < 0.01) {
        showToast("Minimum weight is 0.01 kg.", "warning");
        return;
    }
    
    if (!currentProofFile) {
        showToast("Photo proof is required.", "warning");
        return;
    }

    // Lock UI
    const btn = document.getElementById('v-submit-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin w-4 h-4 mr-2"></i> Uploading...`;
    if(window.lucide) window.lucide.createIcons();

    try {
        // 1. Upload to Cloudinary
        const proofUrl = await uploadToCloudinary(currentProofFile);

        btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin w-4 h-4 mr-2"></i> Saving...`;
        if(window.lucide) window.lucide.createIcons();

        // 2. Insert into Supabase
        const { error } = await supabase.from('plastic_submissions').insert({
            user_id: currentScannedStudentId,    // Who gave plastic
            weight_kg: weight,
            plastic_type: 'PET',                 
            status: 'pending',                   // Pending Admin Approval
            verified_by: state.currentUser.id,   // Volunteer (You)
            verified_at: new Date().toISOString(),
            location: locationName,
            volunteer_coords: currentGpsCoords || 'Unknown',
            submission_url: proofUrl,            // The Cloudinary URL
            program: program
        });

        if (error) throw error;

        // 3. Success
        showToast("Entry Submitted! 🌿", "success");
        
        // Log locally for debugging/audit
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
        btn.disabled = false;
        btn.innerHTML = originalText;
        if(window.lucide) window.lucide.createIcons();
    }
};
