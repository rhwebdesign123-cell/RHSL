require('dotenv').config();

// DEBUG: Check if bank env vars are loading
console.log('=== ENVIRONMENT VARIABLES CHECK ===');
console.log('BANK_NAME:', process.env.BANK_NAME || 'NOT SET');
console.log('BANK_ACCOUNT_NAME:', process.env.BANK_ACCOUNT_NAME || 'NOT SET');
console.log('BANK_SORT_CODE:', process.env.BANK_SORT_CODE || 'NOT SET');
console.log('BANK_ACCOUNT_NUMBER:', process.env.BANK_ACCOUNT_NUMBER || 'NOT SET');
console.log('====================================');
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');
const cors = require('cors');

const app = express();

// Middleware (JSON parser must be before routes)
app.use(cors());
app.use(express.json());

// Check if Stripe key is loaded
console.log('Stripe key loaded:', process.env.STRIPE_SECRET_KEY ? '✓ Yes' : '✗ Missing');

// Determine base URL from environment or default
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// ===== STRIPE CHECKOUT ENDPOINT =====
app.post('/create-checkout-session', async (req, res) => {
  try {
    const cartItems = req.body.cartItems;
    
    const lineItems = (cartItems || []).map(item => ({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${BASE_URL}/success.html`,
      cancel_url: `${BASE_URL}/`,
      shipping_address_collection: {
        allowed_countries: ['GB'],
      },
    });
    
    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===== BANK ORDER NOTIFICATION ENDPOINT =====
app.post('/api/bank-order', (req, res) => {
  const order = req.body;
  console.log('📦 New Bank Transfer Order:', order);
  console.log('Customer:', order.customer);
  console.log('Items:', order.cart);
  console.log('Total:', order.total);
  
  res.json({ received: true });
});

// ===== BANK DETAILS ENDPOINT (MOVED BEFORE STATIC FILES) =====
app.get('/api/bank-details', (req, res) => {
    // Optional: Add basic security - check if cart exists or request is from your frontend
    const cartItems = req.query.cart ? JSON.parse(req.query.cart) : [];
    
    if (cartItems.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
    }
    
    // Return bank details from environment variables
    res.json({
        bankName: process.env.BANK_NAME || 'Your Bank',
        accountName: process.env.BANK_ACCOUNT_NAME || 'RH Sports & Leisure',
        sortCode: process.env.BANK_SORT_CODE || '00-00-00',
        accountNumber: process.env.BANK_ACCOUNT_NUMBER || '12345678',
        iban: process.env.BANK_IBAN || null,
        reference: `RHSL-${Date.now()}`
    });
});

// ===== STATIC FILES (ALWAYS LAST) =====
app.use(express.static('.'));

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
