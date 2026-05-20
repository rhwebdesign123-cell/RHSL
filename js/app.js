// ========== GLOBALS ==========
let products = [];
let filteredProducts = [];
let currentPage = 'All';
let currentSubcat = '';
let cart = [];

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  loadCart();
  loadProducts();
  setupCartUI();
});

// ========== CSV LOADING (PapaParse) ==========
async function loadProducts() {
  const grid = document.getElementById('product-grid');
  grid.innerHTML = `<div class="loading-state"><p>Loading products…</p></div>`;

  try {
    // Try fetching from root or relative path (handles both server and file:// scenarios)
    let resp = await fetch('products.csv');
    if (!resp.ok) {
      resp = await fetch('/products.csv');
    }
    const csvText = await resp.text();

    // Parse with PapaParse if available, fallback to manual
    let parsed;
    const papaLib = window.Papa || window.PapaParse;
    if (papaLib && papaLib.parse) {
      const result = papaLib.parse(csvText, { header: true, skipEmptyLines: true });
      parsed = result.data;
    } else {
      // Manual fallback
      parsed = parseCSVManual(csvText);
    }

    // Map CSV columns → product objects
    products = parsed.map((row, idx) => {
      // Try all possible image column names (PapaParse strips quotes from headers)
      const rawImages = row.images || row['images'] || row.Images || row.Image || row['picture url'] || row['picture url'] || '';
      const imagesArr = rawImages.split('|').filter(Boolean).map(s => s.trim());
      const rawPrice = row['Price (£)'] || row['Price'] || '';
      const numericPrice = parseFloat(rawPrice);
      const isNumeric = !isNaN(numericPrice);

      return {
        id: 'prod-' + idx + '-' + Date.now(),
        page: (row['Product Page'] || row['Page'] || '').trim(),
        category: (row['Category'] || '').trim(),
        name: (row['Product Name'] || row['Name'] || '').trim(),
        price: isNumeric ? numericPrice : rawPrice.trim(),
        priceNumeric: isNumeric,
        condition: (row['Condition'] || '').trim(),
        description: (row['Description'] || row['Desc'] || '').trim(),
        images: imagesArr,
        image: imagesArr[0] || '',
        raw: row
      };
    }).filter(p => p.name); // Filter out empty rows

    // Build navigation from products
    buildCategoryNav();
    renderProducts(products);
    updateStats();
  } catch (err) {
    console.error('CSV load error:', err);
    grid.innerHTML = `<div class="error-state">
      <strong>Could not load products</strong>
      <p>Please ensure the site is running via a local server (not file://).<br>
      Run <code>npx serve</code> or <code>npm start</code> and try again.</p>
      <p style="font-size:0.8rem;margin-top:8px;opacity:0.6">${err.message}</p>
    </div>`;
  }
}

// ========== MANUAL CSV FALLBACK ==========
function parseCSVManual(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  if (lines.length < 2) return [];

  const rawHeaders = lines[0].split(',');
  // Clean header names: remove surrounding quotes
  const headers = rawHeaders.map(h => h.replace(/^['"]|['"]$/g, '').trim());

  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').replace(/^["']|["']$/g, '').trim();
    });
    result.push(row);
  }
  return result;
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ========== CATEGORY NAV ==========
function buildCategoryNav() {
  const navInner = document.querySelector('.cat-nav-inner');
  if (!navInner) return;

  // Extract unique pages/categories
  const pages = ['All', ...new Set(products.map(p => p.page).filter(Boolean))];

  navInner.innerHTML = pages.map(page => `
    <button class="cat-btn ${page === currentPage ? 'active' : ''}"
            data-page="${page}"
            onclick="switchPage('${page.replace(/'/g, "\\'")}')">
      ${page === 'All' ? 'All Products' : page}
    </button>
  `).join('');
}

function switchPage(page) {
  currentPage = page;
  currentSubcat = '';
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  applyFilters();
}

// ========== SUBCATEGORY FILTER ==========
function buildSubcatNav() {
  const bar = document.getElementById('subcat-bar');
  const inner = document.getElementById('subcat-inner');
  if (!bar || !inner) return;

  const pageProducts = currentPage === 'All' ? products : products.filter(p => p.page === currentPage);
  const categories = [...new Set(pageProducts.map(p => p.category).filter(Boolean))];

  if (categories.length <= 1) {
    bar.classList.add('hidden');
    return;
  }

  bar.classList.remove('hidden');
  inner.innerHTML = `
    <button class="subcat-btn ${!currentSubcat ? 'active' : ''}"
            data-subcat=""
            onclick="switchSubcat('')">All</button>
    ${categories.map(cat => `
      <button class="subcat-btn ${currentSubcat === cat ? 'active' : ''}"
              data-subcat="${cat.replace(/'/g, "\\'")}"
              onclick="switchSubcat('${cat.replace(/'/g, "\\'")}')">
        ${cat}
      </button>
    `).join('')}
  `;
}

function switchSubcat(cat) {
  currentSubcat = cat;
  document.querySelectorAll('.subcat-btn').forEach(b => b.classList.toggle('active', b.dataset.subcat === cat));
  applyFilters();
}

// ========== SEARCH ==========
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => applyFilters(), 200);
    });
  }
});

// ========== FILTERING ==========
function applyFilters() {
  let result = [...products];

  // Page filter
  if (currentPage !== 'All') {
    result = result.filter(p => p.page === currentPage);
  }

  // Subcategory filter
  if (currentSubcat) {
    result = result.filter(p => p.category === currentSubcat);
  }

  // Search filter
  const searchVal = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  if (searchVal) {
    result = result.filter(p =>
      p.name.toLowerCase().includes(searchVal) ||
      p.description.toLowerCase().includes(searchVal) ||
      p.category.toLowerCase().includes(searchVal)
    );
  }

  filteredProducts = result;
  renderProducts(result);
  buildSubcatNav();
}

// ========== RENDER ==========
function renderProducts(prods) {
  const grid = document.getElementById('product-grid');
  const title = document.getElementById('products-title');
  const count = document.getElementById('product-count');

  // Update title
  if (title) {
    if (currentPage === 'All') {
      title.textContent = 'All Products';
    } else {
      title.textContent = currentPage;
    }
  }

  // Update count
  if (count) {
    count.textContent = `${prods.length} product${prods.length !== 1 ? 's' : ''}`;
  }

  if (!grid) return;

  if (prods.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <h3>No products found</h3>
        <p>Try adjusting your search or category filter.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = prods.map(p => {
    const isSwap = p.page === 'Swap Shop';
    const isCamping = p.page === 'Camping';
    const condClass = getConditionClass(p.condition);
    const priceDisplay = p.priceNumeric ? `£${p.price.toFixed(2)}` : p.price;
    const priceClass = p.priceNumeric ? '' : 'offers';
    const imageHtml = p.image
      ? `<img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy"
               onerror="this.parentElement.innerHTML='${getPlaceholderSvg()}'">`
      : getPlaceholderSvg();

    const fullDesc = p.description || '';
    const shortDesc = truncateDesc(fullDesc, 80);

    return `
      <div class="product-card ${isSwap ? 'swap-card' : ''} ${isCamping ? 'camping-card' : ''}" role="listitem">
        <div class="product-img-wrap">
          ${imageHtml}
          ${p.condition ? `<span class="condition-badge ${condClass}">${escapeHtml(p.condition)}</span>` : ''}
          ${isSwap ? '<span class="swap-ribbon">Swap Shop</span>' : ''}
          ${isCamping ? '<span class="camping-ribbon">Camping</span>' : ''}
        </div>
        <div class="product-body">
          <div class="product-meta">${escapeHtml(p.category || p.page)}</div>
          <div class="product-name">${escapeHtml(p.name)}</div>
          <div class="product-price ${priceClass}">${priceDisplay}</div>
          ${fullDesc ? `
            <div class="product-desc" onclick="toggleDesc(this)" data-fulltext="${escapeHtml(fullDesc)}">
              ${escapeHtml(shortDesc)}
            </div>
          ` : ''}
          <button class="btn-add-cart" onclick="addToCart(products.find(pr => pr.id === '${p.id}'))">
            Add to Basket
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function getConditionClass(cond) {
  switch ((cond || '').toLowerCase()) {
    case 'new': return 'badge-new';
    case 'used': return 'badge-used';
    case 'used - good': return 'badge-used-good';
    case 'used - very good': return 'badge-used-very-good';
    default: return 'badge-new';
  }
}

function getPlaceholderSvg() {
  return `<div class="product-placeholder">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  </div>`;
}

function truncateDesc(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '…';
}

function toggleDesc(el) {
  const fullText = el.dataset.fulltext || '';
  const shortText = truncateDesc(fullText, 80);
  
  if (el.classList.contains('expanded')) {
    el.textContent = shortText;
    el.classList.remove('expanded');
  } else {
    el.textContent = fullText;
    el.classList.add('expanded');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== STATS ==========
function updateStats() {
  const statsStrip = document.querySelector('.stats-strip');
  if (!statsStrip) return;

  const cats = new Set(products.map(p => p.page).filter(Boolean));
  const newCount = products.filter(p => (p.condition || '').toLowerCase() === 'new').length;
  const usedCount = products.filter(p => (p.condition || '').toLowerCase() !== 'new' && p.condition).length;

  statsStrip.innerHTML = `
    <span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
        <line x1="7" y1="7" x2="7.01" y2="7"/>
      </svg>
      ${cats.size} Categories
    </span>
    <span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      </svg>
      ${products.length} Products
    </span>
    <span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
      ${newCount} New / ${usedCount} Used
    </span>
  `;
}

// ========== CART ==========
const CART_STORAGE_KEY = 'rh_cart';

function loadCart() {
  const saved = localStorage.getItem(CART_STORAGE_KEY);
  if (saved) {
    try {
      cart = JSON.parse(saved);
      // Sanitize any corrupted cart items (e.g. NaN prices from old sessions)
      cart = cart.filter(item => item && item.id).map(item => ({
        ...item,
        price: typeof item.price === 'number' && !isNaN(item.price) ? item.price : 0,
        qty: typeof item.qty === 'number' && item.qty > 0 ? item.qty : 1
      }));
    } catch (e) {
      cart = [];
    }
  }
  updateCartDisplay();
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function addToCart(product) {
  if (!product) return;
  const price = product.priceNumeric ? product.price : 0;
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: price,
      image: product.image,
      qty: 1
    });
  }
  saveCart();
  updateCartDisplay();
  showMessage(`${product.name} added to basket`);
  openCart();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
  updateCartDisplay();
}

function updateQuantity(id, delta) {
  const item = cart.find(item => item.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(id);
  } else {
    saveCart();
    updateCartDisplay();
  }
}

function getTotal() {
  return cart.reduce((sum, item) => {
    const itemTotal = (Number(item.price) || 0) * (Number(item.qty) || 0);
    return sum + itemTotal;
  }, 0);
}

function updateCartDisplay() {
  const badge = document.getElementById('cart-badge');
  const itemsContainer = document.getElementById('cart-items');
  const totalSpan = document.getElementById('cart-total');

  const itemCount = cart.reduce((sum, item) => sum + (item.qty || 0), 0);
  if (badge) badge.textContent = itemCount;

  if (itemsContainer) {
    if (cart.length === 0) {
      itemsContainer.innerHTML = '<p class="empty-cart-msg">Your basket is currently empty.</p>';
    } else {
      itemsContainer.innerHTML = cart.map(item => {
        const itemTotal = (Number(item.price) || 0) * (Number(item.qty) || 0);
        const imageHtml = item.image
          ? '<img src="' + item.image + '" alt="' + escapeHtml(item.name) + '" onerror="this.style.display=\'none\'">'
          : '<div style="width:100%;height:100%;background:var(--stone);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:1.5rem;">&#x1F4E6;</div>';

        return ''
          + '<div class="cart-item">'
          +   '<div class="cart-item-img">'
          +     imageHtml
          +   '</div>'
          +   '<div class="cart-item-info">'
          +     '<div class="cart-item-name">' + escapeHtml(item.name) + '</div>'
          +     '<div class="cart-item-price">£' + itemTotal.toFixed(2) + '</div>'
          +     '<div class="cart-item-controls">'
          +       '<button class="qty-btn" onclick="updateQuantity(\'' + item.id + '\', -1)">−</button>'
          +       '<span>' + item.qty + '</span>'
          +       '<button class="qty-btn" onclick="updateQuantity(\'' + item.id + '\', 1)">+</button>'
          +       '<button class="remove-btn" onclick="removeFromCart(\'' + item.id + '\')">Remove</button>'
          +     '</div>'
          +   '</div>'
          + '</div>';
      }).join('');
    }
  }

  if (totalSpan) {
    totalSpan.textContent = cart.length === 0 ? '£0.00' : `£${getTotal().toFixed(2)}`;
  }
}

function showMessage(msg) {
  const existing = document.querySelector('.toast-message');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.className = 'toast-message';
  div.textContent = msg;
  div.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--green-primary);color:#fff;padding:12px 20px;border-radius:8px;z-index:9999;font-weight:600;opacity:0;transform:translateY(10px);transition:all 0.25s ease';
  document.body.appendChild(div);
  requestAnimationFrame(() => {
    div.style.opacity = '1';
    div.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transform = 'translateY(10px)';
    setTimeout(() => div.remove(), 300);
  }, 2500);
}

// ========== CART UI TOGGLES ==========
function setupCartUI() {
  const trigger = document.getElementById('cart-trigger');
  const overlay = document.getElementById('cart-overlay');
  const sidebar = document.getElementById('cart-sidebar');
  const closeBtn = document.getElementById('cart-close');

  if (trigger && overlay && sidebar) {
    const open = () => openCart();
    const close = () => closeCart();

    trigger.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);
  }
}

function openCart() {
  const overlay = document.getElementById('cart-overlay');
  const sidebar = document.getElementById('cart-sidebar');
  if (overlay) overlay.classList.add('active');
  if (sidebar) sidebar.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  const overlay = document.getElementById('cart-overlay');
  const sidebar = document.getElementById('cart-sidebar');
  if (overlay) overlay.classList.remove('active');
  if (sidebar) sidebar.classList.remove('active');
  document.body.style.overflow = '';
}

// ========== CHECKOUT ==========
const BASE_URL = window.location.origin;

async function checkoutStripe() {
  if (cart.length === 0) {
    showMessage('Your basket is empty');
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartItems: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.qty,
        image: item.image
      })) })
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      showMessage('Error: ' + (data.error || 'Checkout failed'));
    }
  } catch (err) {
    showMessage('Cannot connect to server. Run: npm start');
  }
}

// ========== HOOK UP CHECKOUT BUTTONS ==========
document.addEventListener('DOMContentLoaded', () => {
  const stripeBtn = document.getElementById('stripe-checkout');
  if (stripeBtn) {
    stripeBtn.addEventListener('click', checkoutStripe);
  }

  // PayPal rendering
  const paypalContainer = document.getElementById('paypal-button-container');
  if (paypalContainer && typeof paypal !== 'undefined' && paypal.Buttons) {
    paypal.Buttons({
      createOrder: function(data, actions) {
        if (cart.length === 0) {
          showMessage('Your basket is empty');
          return actions.reject();
        }
        const total = getTotal().toFixed(2);
        return actions.order.create({
          purchase_units: [{
            amount: { value: total, currency_code: 'GBP' },
            description: 'RH Sports & Leisure Order'
          }]
        });
      },
      onApprove: function(data, actions) {
        return actions.order.capture().then(function(details) {
          localStorage.removeItem(CART_STORAGE_KEY);
          cart = [];
          updateCartDisplay();
          showMessage('Payment successful! Thank you for your order.');
          setTimeout(() => {
            window.location.href = `${BASE_URL}/success.html`;
          }, 1500);
        });
      },
      onError: function(err) {
        showMessage('PayPal error. Please try again.');
        console.error('PayPal error:', err);
      }
    }).render('#paypal-button-container');
  } else if (paypalContainer) {
    // PayPal not loaded yet - hide container
    paypalContainer.style.display = 'none';
  }
});