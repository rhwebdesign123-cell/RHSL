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

// Email endpoint (YOUR BACKEND IS READY)
app.post('/api/send-order-email', async (req, res) => {
  try {
    const { order } = req.body;
    
    const itemsHtml = order.cart.map(item => `
      <tr><td>${item.name}</td><td>${item.qty}</td><td>£${((item.price||0)*item.qty).toFixed(2)}</td></tr>
    `).join('');
    
    await resend.emails.send({
      from: `RH Sports <anything@mueyan.resend.app>`,
      to: [process.env.ADMIN_EMAIL || 'rhwebdesign123@gmail.com'],
      subject: `📦 NEW ORDER: ${order.orderId} - ${order.total}`,
      html: `
        <h2>New Bank Transfer Order</h2>
        <p><strong>Order ID:</strong> ${order.orderId}</p>
        <p><strong>Name:</strong> ${order.customer.fullname}</p>
        <p><strong>Address:</strong> ${order.customer.address}, ${order.customer.city}, ${order.customer.postcode}</p>
        <p><strong>Email:</strong> ${order.customer.email}</p>
        <p><strong>Phone:</strong> ${order.customer.phone}</p>
        <table border="1" cellpadding="5">${itemsHtml}</table>
        <h3>Total: ${order.total}</h3>
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
