require('dotenv').config();

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const { Resend } = require('resend');

// Initialize
const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// Log Stripe status
console.log('Stripe key loaded:', process.env.STRIPE_SECRET_KEY ? '✓ Yes' : '✗ Missing');

// Base URL
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// ===== STRIPE CHECKOUT =====
app.post('/create-checkout-session', async (req, res) => {
  try {
    const cartItems = req.body.cartItems;
    
    const lineItems = (cartItems || []).map(item => ({
      price_data: {
        currency: 'gbp',
        product_data: { name: item.name },
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

// ===== BANK ORDER LOGGING =====
app.post('/api/bank-order', (req, res) => {
  const order = req.body;
  console.log('📦 New Bank Transfer Order:', order);
  res.json({ received: true });
});

// ===== BANK DETAILS (from .env) =====
app.get('/api/bank-details', (req, res) => {
  let cartItems = [];
  try {
    cartItems = req.query.cart ? JSON.parse(req.query.cart) : [];
  } catch(e) {
    cartItems = [];
  }
  
  if (cartItems.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }
  
  res.json({
    bankName: process.env.BANK_NAME || 'HSBC',
    accountName: process.env.BANK_ACCOUNT_NAME || 'R Hetherington',
    sortCode: process.env.BANK_SORT_CODE || '40-29-02',
    accountNumber: process.env.BANK_ACCOUNT_NUMBER || '91211463',
    iban: process.env.BANK_IBAN || null,
    reference: `RHSL-${Date.now()}`
  });
});

// ===== SEND EMAIL NOTIFICATION (YOUR PRIMARY NEED) =====
app.post('/api/send-order-email', async (req, res) => {
  try {
    const { order } = req.body;
    
    // Validate required fields
    if (!order || !order.customer || !order.cart) {
      return res.status(400).json({ error: 'Invalid order data' });
    }
    
    // Format cart items for email
    const cartItemsHtml = (order.cart || []).map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${escapeHtml(item.name)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.qty}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">£${((item.price || 0) * (item.qty || 0)).toFixed(2)}</td>
      </tr>
    `).join('');
    
    const emailHtml = `
      <h2>📦 New Bank Transfer Order!</h2>
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Date:</strong> ${new Date(order.date).toLocaleString()}</p>
      
      <h3>Customer Details:</h3>
      <ul>
        <li><strong>Name:</strong> ${escapeHtml(order.customer.fullname)}</li>
        <li><strong>Address:</strong> ${escapeHtml(order.customer.address)}, ${escapeHtml(order.customer.city)}, ${escapeHtml(order.customer.postcode)}</li>
        <li><strong>Email:</strong> ${escapeHtml(order.customer.email)}</li>
        <li><strong>Phone:</strong> ${escapeHtml(order.customer.phone)}</li>
      </ul>
      
      <h3>Order Items:</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr><th style="text-align: left; padding: 8px; background: #f5f5f5;">Product</th>
            <th style="text-align: center; padding: 8px; background: #f5f5f5;">Qty</th>
            <th style="text-align: right; padding: 8px; background: #f5f5f5;">Total</th>
          </tr>
        </thead>
        <tbody>${cartItemsHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding: 12px; text-align: right;"><strong>Grand Total:</strong></td>
            <td style="padding: 12px; text-align: right;"><strong>${order.total}</strong></td>
          </tr>
        </tfoot>
      沉重
      
      <p style="margin-top: 20px;">⚠️ <strong>Action Required:</strong> Customer has chosen Bank Transfer. Please wait for payment to clear before shipping.</p>
      <p>📧 Customer email: <a href="mailto:${escapeHtml(order.customer.email)}">${escapeHtml(order.customer.email)}</a></p>
    `;
    
    // Send using Resend
    const { data, error } = await resend.emails.send({
      from: `RH Sports & Leisure <orders@${process.env.RESEND_DOMAIN || 'rhwebdesign123.co.uk'}>`,
      to: [process.env.ADMIN_EMAIL || 'rhwebdesign123@gmail.com'], // Your email from your site
      subject: `📦 NEW BANK ORDER: ${order.orderId} - ${order.total}`,
      html: emailHtml,
      replyTo: order.customer.email
    });
    
    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('Email sent successfully:', data);
    res.json({ success: true, message: 'Email sent' });
    
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Optional: Webhook endpoint for Resend events (track opens/clicks/bounces)
// Add this if you want Resend to POST to your server when emails are opened
app.post('/api/resend-webhook', (req, res) => {
  const event = req.body;
  console.log('Resend webhook event:', event.type, event.data);
  // You can handle events like 'email.delivered', 'email.bounced', 'email.opened'
  res.status(200).end();
});

// Helper function to prevent HTML injection
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== STATIC FILES (ALWAYS LAST) =====
app.use(express.static('.'));

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
  console.log(`Server running at http://localhost:${PORT}`);
});
