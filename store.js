import { supabase } from './supabase-client.js';
import { state } from './state.js';

export const loadStoreData = async () => {
    const { data } = await supabase
        .from('products')
        .select('*, stores(name, logo_url), product_features(*), product_specifications(*)')
        .eq('is_active', true);
    
    state.products = data || [];
    
    const { data: ord } = await supabase
        .from('orders')
        .select('*, order_items(products(name))')
        .eq('user_id', state.currentUser.id)
        .order('created_at', { ascending: false });
    state.userRewards = ord || [];
};

export const renderRewardsPage = () => {
    const grid = document.getElementById('product-grid');
    const term = document.getElementById('store-search').value.toLowerCase();
    
    const filtered = state.products.filter(p => p.name.toLowerCase().includes(term));
    
    grid.innerHTML = filtered.map(p => `
        <div class="glass-card rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onclick="showProductDetail('${p.id}')">
            <img src="${p.metadata?.image || 'https://placehold.co/300x200'}" class="w-full h-32 object-cover">
            <div class="p-3">
                <p class="text-[10px] font-bold text-gray-400 uppercase mb-0.5">${p.stores?.name}</p>
                <h4 class="font-bold text-sm text-gray-900 dark:text-white truncate leading-tight mb-2">${p.name}</h4>
                <div class="flex items-end justify-between">
                    <span class="font-bold text-green-600 text-sm bg-green-50 px-2 py-0.5 rounded">${p.ecopoints_cost} Pts</span>
                    <span class="text-xs text-gray-400 line-through">₹${p.original_price}</span>
                </div>
            </div>
        </div>
    `).join('');
};

export const showProductDetail = (pid) => {
    const p = state.products.find(x => x.id === pid);
    const detailPage = document.getElementById('product-detail-page');
    
    const feats = p.product_features?.map(f => `<li><i data-lucide="check" class="w-4 h-4 text-green-500 mr-2"></i>${f.feature}</li>`).join('') || '';
    const specs = p.product_specifications?.map(s => 
        `<div class="spec-box"><p class="text-[10px] text-gray-400 uppercase font-bold mb-1">${s.spec_key}</p><p class="text-sm font-bold text-gray-800 dark:text-gray-200">${s.spec_value}</p></div>`
    ).join('') || '';

    detailPage.innerHTML = `
        <div class="p-6 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div class="flex items-center justify-between mb-6">
                <button onclick="document.getElementById('product-detail-page').classList.add('hidden')" class="p-2 bg-gray-100 dark:bg-gray-800 rounded-full"><i data-lucide="arrow-left" class="w-6 h-6 text-gray-600 dark:text-white"></i></button>
                <div class="flex items-center bg-gray-50 dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700"><img src="${p.stores?.logo_url}" class="w-5 h-5 rounded-full mr-2"><span class="text-xs font-bold text-gray-600 dark:text-gray-300">${p.stores?.name}</span></div>
            </div>

            <h1 class="text-2xl font-black text-gray-900 dark:text-white leading-tight mb-2">${p.name}</h1>
            <div class="flex items-center gap-2 mb-6">
                 <span class="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-xs font-bold">${p.ecopoints_cost} EcoPts</span>
                 <span class="bg-gray-100 text-gray-500 px-3 py-1 rounded-lg text-xs font-bold line-through">₹${p.original_price}</span>
            </div>

            <div class="space-y-6">
                <div>
                    <h3 class="font-bold text-sm text-gray-900 dark:text-gray-100 mb-2 flex items-center"><i data-lucide="file-text" class="w-4 h-4 mr-2 text-gray-400"></i>Description</h3>
                    <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${p.description}</p>
                </div>
                <div>
                    <h3 class="font-bold text-sm text-gray-900 dark:text-gray-100 mb-2 flex items-center"><i data-lucide="sparkles" class="w-4 h-4 mr-2 text-gray-400"></i>Highlights</h3>
                    <ul class="product-highlights">${feats}</ul>
                </div>
                <div>
                    <h3 class="font-bold text-sm text-gray-900 dark:text-gray-100 mb-2 flex items-center"><i data-lucide="sliders" class="w-4 h-4 mr-2 text-gray-400"></i>Details</h3>
                    <div class="flex gap-3 overflow-x-auto pb-2">${specs}</div>
                </div>
                <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                    <h4 class="font-bold text-xs text-blue-600 uppercase mb-1">Redemption Info</h4>
                    <p class="text-sm text-blue-800 dark:text-blue-200">Show the QR code generated after purchase at the counter.</p>
                </div>
            </div>
        </div>

        <div class="sticky-footer shadow-2xl">
            <div class="flex items-center justify-between gap-4">
                <div>
                    <p class="text-xs text-gray-400 font-bold">Total Price</p>
                    <div class="flex items-baseline">
                        <span class="text-xl font-black text-gray-900 dark:text-white">₹${p.discounted_price}</span>
                        <span class="text-sm font-bold text-gray-400 mx-1">+</span>
                        <span class="text-lg font-bold text-green-600">${p.ecopoints_cost}</span>
                    </div>
                </div>
                <button onclick="redeemProduct('${p.id}')" class="flex-1 bg-green-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-green-200 dark:shadow-none active:scale-95 transition-transform">Redeem Now</button>
            </div>
        </div>
    `;
    
    detailPage.classList.remove('hidden');
    if(window.lucide) window.lucide.createIcons();
};

window.redeemProduct = async (pid) => {
    if(!confirm('Confirm redemption? Points will be deducted.')) return;
    try {
        const p = state.products.find(x => x.id === pid);
        const { error } = await supabase.from('orders').insert({
            user_id: state.currentUser.id, store_id: p.store_id, total_points: p.ecopoints_cost,
            total_price: p.discounted_price, status: 'confirmed'
        });
        if(error) throw error;
        
        await supabase.from('points_ledger').insert({
            user_id: state.currentUser.id, source_type: 'order', 
            points_delta: -p.ecopoints_cost, description: `Redeemed ${p.name}`
        });
        
        alert('Success! View in Orders.');
        document.getElementById('product-detail-page').classList.add('hidden');
        loadStoreData();
    } catch(e) { alert('Transaction failed.'); }
};
