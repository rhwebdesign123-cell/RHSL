require('dotenv').config();

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(cors());
app.use(express.json());

console.log('Stripe key:', process.env.STRIPE_SECRET_KEY ? '✓ Yes' : '✗ Missing');

const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Stripe checkout
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
      shipping_address_collection: { allowed_countries: ['GB'] },
    });
    
    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bank order logging
app.post('/api/bank-order', (req, res) => {
  console.log('📦 Bank order:', req.body);
  res.json({ received: true });
});

// Email endpoint — sends admin notification + customer confirmation
app.post('/api/send-order-email', async (req, res) => {
  try {
    const { order } = req.body;
    const fromDomain = process.env.RESEND_DOMAIN || 'mueyan.resend.app';
    const fromAddress = `RH Sports <noreply@${fromDomain}>`;
    const adminEmail = process.env.ADMIN_EMAIL || 'rhwebdesign123@googlemail.com';
    
    const itemsHtml = order.cart.map(item => `
      <tr><td>${item.name}</td><td>${item.qty}</td><td>£${((item.price||0)*item.qty).toFixed(2)}</td></tr>
    `).join('');
    
    // Bank details from env for customer email
    const bankName = process.env.BANK_NAME || 'HSBC';
    const bankAccount = process.env.BANK_ACCOUNT_NAME || 'R Hetherington';
    const sortCode = process.env.BANK_SORT_CODE || '40-29-02';
    const accountNumber = process.env.BANK_ACCOUNT_NUMBER || '91211463';
    
    // 1️⃣ Admin notification
    await resend.emails.send({
      from: fromAddress,
      to: [adminEmail],
      subject: `📦 NEW BANK ORDER: ${order.orderId} - ${order.total}`,
      html: `
        <h2>New Bank Transfer Order</h2>
        <p><strong>Order ID:</strong> ${order.orderId}</p>
        <p><strong>Date:</strong> ${new Date(order.date).toLocaleString()}</p>
        <h3>👤 Customer Details</h3>
        <p><strong>Name:</strong> ${order.customer.fullname}</p>
        <p><strong>Address:</strong> ${order.customer.address}, ${order.customer.city}, ${order.customer.postcode}</p>
        <p><strong>Email:</strong> ${order.customer.email}</p>
        <p><strong>Phone:</strong> ${order.customer.phone}</p>
        <h3>📦 Order Items</h3>
        <table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;width:100%">
          <tr style="background:#f0f0f0"><th>Item</th><th>Qty</th><th>Price</th></tr>
          ${itemsHtml}
        </table>
        <h3>Total: ${order.total}</h3>
        <p>⏳ Awaiting payment — notify customer once cleared.</p>
      `
    });
    
    // 2️⃣ Customer confirmation
    await resend.emails.send({
      from: fromAddress,
      to: [order.customer.email],
      subject: `✅ Order Confirmed - ${order.orderId} - RH Sports & Leisure`,
      html: `
        <h2>Thank you for your order, ${order.customer.fullname}!</h2>
        <p>Your order has been received. Please send payment via bank transfer to complete your purchase.</p>
        
        <h3>📋 Order Summary</h3>
        <p><strong>Order ID:</strong> ${order.orderId}</p>
        <table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;width:100%">
          <tr style="background:#f0f0f0"><th>Item</th><th>Qty</th><th>Price</th></tr>
          ${itemsHtml}
        </table>
        <h3>Total: ${order.total}</h3>
        
        <h3>🚚 Delivery Address</h3>
        <p>
          ${order.customer.fullname}<br>
          ${order.customer.address}<br>
          ${order.customer.city}<br>
          ${order.customer.postcode}
        </p>
        
        <h3>🏦 Bank Transfer Details</h3>
        <p>Please send payment to:</p>
        <ul>
          <li><strong>Bank:</strong> ${bankName}</li>
          <li><strong>Account Name:</strong> ${bankAccount}</li>
          <li><strong>Sort Code:</strong> ${sortCode}</li>
          <li><strong>Account Number:</strong> ${accountNumber}</li>
        </ul>
        <p><strong>Use Reference:</strong> ${order.orderId}</p>
        <p><strong>Amount:</strong> ${order.total}</p>
        
        <p>⚠️ Your order will be shipped once payment clears (usually 1-2 working days).</p>
        <p>If you have any questions, reply to this email or contact us.</p>
        <hr>
        <p style="color:#888;font-size:0.85em">RH Sports & Leisure</p>
      `
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Static files
app.use(express.static('.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
