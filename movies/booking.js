import { supabase } from '../supabase-client.js';

const params = new URLSearchParams(window.location.search);
const screeningId = params.get('id');

const state = {
    selectedSeat: null, // { id: 'A1', price: 100 }
    userPoints: 0,
    config: {
        platinum: 200, gold: 160, silver: 120, bronze: 80
    }
};

async function init() {
    if(!screeningId) { alert("Invalid Show"); window.location.href='index.html'; return; }

    const { data: { user } } = await supabase.auth.getUser();
    if(!user) window.location.href='../login.html';

    // 1. Fetch User Points
    const { data: profile } = await supabase.from('users').select('current_points').eq('id', user.id).single();
    state.userPoints = profile.current_points;
    document.getElementById('userBal').textContent = state.userPoints;

    // 2. Fetch Screening Info
    const { data: screening } = await supabase
        .from('screenings')
        .select(`*, movies(title)`)
        .eq('id', screeningId)
        .single();
    
    document.getElementById('movieTitle').textContent = screening.movies.title;
    const d = new Date(screening.show_time);
    document.getElementById('movieTime').textContent = `${d.toLocaleDateString()} • ${d.toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}`;

    // Update prices from DB
    state.config = {
        platinum: screening.price_platinum,
        gold: screening.price_gold,
        silver: screening.price_silver,
        bronze: screening.price_bronze
    };

    // 3. Fetch Taken Seats
    const { data: bookings } = await supabase
        .from('bookings')
        .select('seat_number')
        .eq('screening_id', screeningId);
    
    const takenSeats = new Set(bookings.map(b => b.seat_number));

    renderSeats(takenSeats);
}

function renderSeats(takenSeats) {
    const leftWing = document.getElementById('leftWing');
    const rightWing = document.getElementById('rightWing');
    const rows = 10;
    const colsPerWing = 5;
    const rowLabels = "ABCDEFGHIJ".split('');

    for(let r=0; r<rows; r++) {
        // Pricing Tier Logic
        let tier = 'bronze';
        let price = state.config.bronze;

        if (r < 2) { tier = 'platinum'; price = state.config.platinum; }
        else if (r < 5) { tier = 'gold'; price = state.config.gold; }
        else if (r < 8) { tier = 'silver'; price = state.config.silver; }

        const rowLetter = rowLabels[r];

        // Left Wing (Gents - Seats 1-5)
        for(let c=1; c<=colsPerWing; c++) {
            createSeat(leftWing, rowLetter, c, tier, price, takenSeats);
        }

        // Right Wing (Ladies - Seats 6-10)
        for(let c=colsPerWing+1; c<=colsPerWing*2; c++) {
            createSeat(rightWing, rowLetter, c, tier, price, takenSeats);
        }
    }
}

function createSeat(container, row, col, tier, price, takenSeats) {
    const seatId = `${row}${col}`;
    const el = document.createElement('div');
    el.className = 'seat';
    el.dataset.tier = tier;
    el.textContent = seatId;
    
    if(takenSeats.has(seatId)) {
        el.classList.add('taken');
    } else {
        el.onclick = () => selectSeat(el, seatId, price);
    }
    container.appendChild(el);
}

function selectSeat(el, id, price) {
    // Deselect previous
    if(state.selectedSeat) {
        state.selectedSeat.el.classList.remove('selected');
        // Toggle off if same clicked
        if(state.selectedSeat.id === id) {
            state.selectedSeat = null;
            updateCheckout();
            return;
        }
    }

    el.classList.add('selected');
    state.selectedSeat = { el, id, price };
    updateCheckout();
}

function updateCheckout() {
    const btn = document.getElementById('btnBook');
    const lbl = document.getElementById('totalPrice');
    
    if(!state.selectedSeat) {
        lbl.textContent = '0 Pts';
        btn.textContent = 'Select Seat';
        btn.disabled = true;
    } else {
        lbl.textContent = `${state.selectedSeat.price} Pts`;
        btn.textContent = `Book ${state.selectedSeat.id}`;
        
        if(state.userPoints < state.selectedSeat.price) {
            btn.textContent = 'Low Points';
            btn.disabled = true;
            btn.style.background = '#ef4444';
        } else {
            btn.disabled = false;
            btn.style.background = 'var(--accent)';
        }
    }
}

window.confirmBooking = async () => {
    if(!state.selectedSeat) return;
    const btn = document.getElementById('btnBook');
    btn.disabled = true;
    btn.textContent = 'Booking...';

    // CALL SQL FUNCTION (Atomic Transaction)
    const { data, error } = await supabase.rpc('book_ticket', {
        p_screening_id: screeningId,
        p_seat_number: state.selectedSeat.id,
        p_price: state.selectedSeat.price
    });

    if(error || (data && !data.success)) {
        alert(error?.message || data?.error || "Booking Failed");
        btn.disabled = false;
        btn.textContent = 'Try Again';
        return;
    }

    // Success!
    window.location.href = 'index.html'; // Go back to tickets tab
};

// Zoom / Drag Logic (Simple)
const vp = document.getElementById('viewport');
const st = document.getElementById('stage');
let scale = 0.9;
st.style.transform = `scale(${scale})`;

init();
