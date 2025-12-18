import { supabase } from './supabase-client.js';
import { state } from './state.js';
import { els, getPlaceholderImage, formatDate, getUserLevel, logUserActivity, isLowDataMode, showToast } from './utils.js';
import { refreshUserData } from './app.js';

const getProduct = (productId) => state.products.find(p => p.id === productId);
const getStore = (storeId) => state.stores.find(s => s.id === storeId);

// 1. Load Data & Extract Stores (Once per session)
export const loadStoreAndProductData = async () => {
    if (state.storeLoaded) {
        if (document.getElementById('rewards').classList.contains('active')) renderRewards();
        return;
    }

    try {
        // Optimization: Strict Columns, Limit 50
        const { data, error } = await supabase
            .from('products')
            .select(`
                id, name, description, original_price, discounted_price, ecopoints_cost, store_id,
                stores ( id, name, logo_url ), 
                product_images ( image_url, sort_order ),
                product_features ( feature, sort_order ),
                product_specifications ( spec_key, spec_value, sort_order )
            `)
            .eq('is_active', true)
            .limit(50);

        if (error) throw error;

        state.products = data.map(p => ({
            ...p, 
            images: p.product_images?.sort((a,b) => a.sort_order - b.sort_order) || [],
            features: p.product_features?.sort((a,b) => a.sort_order - b.sort_order) || [],
            specs: p.product_specifications?.sort((a,b) => a.sort_order - b.sort_order) || []
        }));

        // Extract unique stores from product data to avoid separate join queries
        const storeMap = new Map();
        data.forEach(p => { if(p.stores) storeMap.set(p.stores.id, p.stores); });
        state.stores = Array.from(storeMap.values());

        state.storeLoaded = true;
        if (document.getElementById('rewards').classList.contains('active')) renderRewards();

    } catch (err) { 
        console.error('Store Load Error:', err); 
        showToast("Failed to load store items.", "error");
    }
};

// 2. Render Rewards List
export const renderRewards = () => {
    const container = els.productGrid;
    if (!container) return;
    
    const query = els.storeSearch.value.toLowerCase();
    const sortBy = els.sortBy.value;

    let filtered = state.products.filter(p => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query));

    if (sortBy === 'points-lh') filtered.sort((a, b) => a.ecopoints_cost - b.ecopoints_cost);
    else if (sortBy === 'points-hl') filtered.sort((a, b) => b.ecopoints_cost - a.ecopoints_cost);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-span-full py-10 text-center text-gray-400">No rewards found for "${query}"</div>`;
        return;
    }

    container.innerHTML = filtered.map(p => {
        const img = p.images[0]?.image_url || getPlaceholderImage('300x300', p.name);
        return `
            <div class="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col transition-transform active:scale-[0.98]" onclick="showProductDetailPage('${p.id}')">
                <div class="relative aspect-square overflow-hidden bg-gray-50 dark:bg-gray-900">
                    <img src="${img}" class="w-full h-full object-cover" loading="lazy">
                    <div class="absolute top-3 right-3 bg-white/90 dark:bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg shadow-sm">
                        <p class="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-tighter">${p.ecopoints_cost} pts</p>
                    </div>
                </div>
                <div class="p-4 flex flex-col flex-grow">
                    <div class="flex items-center gap-1.5 mb-1">
                        <img src="${p.stores?.logo_url || getPlaceholderImage('20x20')}" class="w-4 h-4 rounded-full">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">${p.stores?.name}</span>
                    </div>
                    <h3 class="font-bold text-gray-900 dark:text-white text-sm line-clamp-1 mb-1">${p.name}</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 leading-relaxed">${p.description}</p>
                    <div class="mt-auto flex items-center justify-between">
                        <span class="text-sm font-black text-gray-900 dark:text-white">₹${p.discounted_price}</span>
                        <button class="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 rounded-xl text-[10px] font-bold">View</button>
                    </div>
                </div>
            </div>`;
    }).join('');
};

// 3. Product Detail View
export const showProductDetailPage = (productId) => {
    const p = getProduct(productId);
    if (!p) return;

    window.showPage('product-detail-page');
    const container = els.productDetailPage;

    container.innerHTML = `
        <div class="flex flex-col min-h-full bg-gray-50 dark:bg-gray-950 pb-32">
            <div class="relative w-full aspect-square bg-white dark:bg-gray-900">
                <button onclick="showPage('rewards')" class="absolute top-6 left-6 z-10 w-10 h-10 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-md flex items-center justify-center text-gray-900 dark:text-white"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>
                <img src="${p.images[0]?.image_url || getPlaceholderImage('600x600')}" class="w-full h-full object-cover">
            </div>

            <div class="p-6 -mt-6 bg-gray-50 dark:bg-gray-950 rounded-t-[32px] relative z-10">
                <div class="flex items-center gap-2 mb-4">
                    <span class="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-bold uppercase tracking-widest">${p.ecopoints_cost} EcoPoints</span>
                </div>
                
                <h1 class="text-3xl font-black text-gray-900 dark:text-white mb-2 leading-tight">${p.name}</h1>
                <div class="flex items-baseline gap-2 mb-6">
                    <span class="text-2xl font-black text-gray-900 dark:text-white">₹${p.discounted_price}</span>
                    <span class="text-sm text-gray-400 line-through font-medium">₹${p.original_price}</span>
                </div>

                <div class="space-y-6">
                    <div>
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description</h4>
                        <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">${p.description}</p>
                    </div>

                    ${p.features.length ? `
                        <div>
                            <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Highlights</h4>
                            <ul class="grid grid-cols-1 gap-2">
                                ${p.features.map(f => `<li class="flex items-center text-sm text-gray-700 dark:text-gray-300"><i data-lucide="check-circle-2" class="w-4 h-4 text-green-500 mr-2"></i>${f.feature}</li>`).join('')}
                            </ul>
                        </div>` : ''}
                </div>
            </div>

            <div class="fixed bottom-0 left-0 right-0 p-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 z-20">
                <button onclick="confirmPurchase('${p.id}')" class="w-full bg-gray-900 dark:bg-green-600 text-white font-bold py-4 rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2">
                    <i data-lucide="shopping-bag" class="w-5 h-5"></i>
                    Redeem for ${p.ecopoints_cost} Points
                </button>
            </div>
        </div>`;

    if (window.lucide) window.lucide.createIcons();
};

// 4. Purchase Flow
export const confirmPurchase = async (productId) => {
    const p = getProduct(productId);
    if (!p) return;

    if (state.currentUser.current_points < p.ecopoints_cost) {
        showToast("Not enough EcoPoints!", "error");
        return;
    }

    showToast("Processing order...", "warning");

    try {
        const { error } = await supabase.rpc('purchase_product', {
            p_user_id: state.currentUser.id,
            p_product_id: p.id,
            p_cost: p.ecopoints_cost
        });

        if (error) throw error;

        logUserActivity('purchase_success', `Redeemed ${p.name}`, { productId: p.id });
        showToast("Redeemed successfully!", "success");
        
        await refreshUserData();
        state.userRewardsLoaded = false; // Force reload of "My Orders"
        window.showPage('my-rewards');

    } catch (err) {
        console.error("Purchase Error:", err);
        showToast(err.message || "Purchase failed.", "error");
    }
};

// 5. My Rewards (Orders)
export const loadUserRewardsData = async () => {
    try {
        const { data, error } = await supabase
            .from('user_rewards')
            .select(`
                id, status, claim_code, created_at,
                products ( id, name, ecopoints_cost, product_images ( image_url ) )
            `)
            .eq('user_id', state.currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        state.userRewards = data.map(r => ({
            id: r.id,
            name: r.products?.name,
            cost: r.products?.ecopoints_cost,
            image: r.products?.product_images[0]?.image_url,
            code: r.claim_code,
            status: r.status,
            date: formatDate(r.created_at)
        }));

        if (document.getElementById('my-rewards').classList.contains('active')) renderMyRewardsPage();
    } catch (err) {
        console.error("Load Orders Error:", err);
        showToast("Failed to load orders.", "error");
    }
};

export const renderMyRewardsPage = () => {
    const container = els.allRewardsList;
    if (!container) return;

    if (state.userRewards.length === 0) {
        container.innerHTML = `<div class="text-center py-20 opacity-40"><i data-lucide="shopping-cart" class="w-12 h-12 mx-auto mb-2"></i><p>No orders yet.</p></div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    container.innerHTML = state.userRewards.map(r => `
        <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
            <div class="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900 flex-shrink-0">
                <img src="${r.image || getPlaceholderImage()}" class="w-full h-full object-cover">
            </div>
            <div class="flex-grow">
                <h4 class="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">${r.name}</h4>
                <p class="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">${r.date} • ${r.cost} pts</p>
                <div class="mt-2 flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${r.status === 'claimed' ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-600'}">${r.status}</span>
                </div>
            </div>
            <button onclick="showOrderQR('${r.code}', '${r.name}')" class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300"><i data-lucide="qr-code" class="w-5 h-5"></i></button>
        </div>
    `).join('');
    if (window.lucide) window.lucide.createIcons();
};

window.showOrderQR = (code, name) => {
    const modal = els.qrModal;
    const overlay = els.qrModalOverlay;
    
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${code}`;
    
    modal.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold dark:text-white">Redeem Reward</h3>
            <button onclick="closeQrModal()" class="text-gray-400"><i data-lucide="x" class="w-6 h-6"></i></button>
        </div>
        <div class="flex flex-col items-center text-center">
            <div class="bg-white p-4 rounded-3xl shadow-lg mb-4">
                <img src="${qrUrl}" class="w-48 h-48">
            </div>
            <p class="font-bold text-lg dark:text-white mb-1">${name}</p>
            <p class="text-xs text-gray-500 mb-6">Show this code at the counter to claim.</p>
            <p class="text-2xl font-mono font-black tracking-widest bg-gray-100 dark:bg-gray-700 px-6 py-3 rounded-xl dark:text-white">${code}</p>
        </div>`;
    
    overlay.classList.remove('hidden');
    modal.classList.remove('translate-y-full');
    if (window.lucide) window.lucide.createIcons();
};

window.closeQrModal = () => {
    els.qrModal.classList.add('translate-y-full');
    els.qrModalOverlay.classList.add('hidden');
};

// 6. EcoPoints Page Summary
export const renderEcoPointsPage = () => {
    const user = state.currentUser;
    const balanceEl = document.getElementById('ecopoints-balance');
    if (balanceEl) balanceEl.textContent = user.current_points;

    const level = getUserLevel(user.lifetime_points);
    const titleEl = document.getElementById('ecopoints-level-title');
    const numEl = document.getElementById('ecopoints-level-number');
    const progEl = document.getElementById('ecopoints-level-progress');
    const nextEl = document.getElementById('ecopoints-level-next');

    if (titleEl) titleEl.textContent = level.title;
    if (numEl) numEl.textContent = level.level;
    if (progEl) progEl.style.width = level.progress + '%';
    if (nextEl) nextEl.textContent = level.progressText;

    // Recent Transactions (Sync with History)
    const historyContainer = document.getElementById('ecopoints-recent-activity');
    if (historyContainer) {
        if (state.history.length === 0) {
            historyContainer.innerHTML = `<p class="text-xs text-center text-gray-400 py-4">No recent activity.</p>`;
        } else {
            historyContainer.innerHTML = state.history.slice(0, 5).map(h => `
                <div class="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 last:border-0 pb-2 last:pb-0">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                            <i data-lucide="${h.icon}" class="w-4 h-4 text-gray-600 dark:text-gray-300"></i>
                        </div>
                        <div>
                            <p class="text-sm font-bold text-gray-800 dark:text-gray-200 line-clamp-1">${h.description}</p>
                            <p class="text-[10px] text-gray-400">${h.date}</p>
                        </div>
                    </div>
                    <span class="text-sm font-bold ${h.points >= 0 ? 'text-green-600' : 'text-red-500'}">${h.points > 0 ? '+' : ''}${h.points}</span>
                </div>`).join('');
            
            if (!document.getElementById('view-all-history-btn')) {
                historyContainer.innerHTML += `
                    <div class="mt-3 text-right">
                        <button id="view-all-history-btn" onclick="showPage('history')" class="text-xs font-bold text-green-600 hover:text-green-700">View All</button>
                    </div>`;
            }
        }
    }
    if(window.lucide) window.lucide.createIcons();
};

window.renderRewardsWrapper = renderRewards;
window.renderMyRewardsPageWrapper = renderMyRewardsPage;
window.renderEcoPointsPageWrapper = renderEcoPointsPage;
window.confirmPurchase = confirmPurchase;
window.showProductDetailPage = showProductDetailPage;
