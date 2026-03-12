const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  secure: false
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: '"Zenwair" <noreply@zenwair.com>',
      to,
      subject,
      html
    });
    logger.info('Email sent');
  } catch (error) {
    logger.error('Failed to send email', { error: error.message });
  }
};

const sendVerificationEmail = async (email, token) => {
  const link = `${process.env.FRONTEND_URL}/verify-email/${token}`;
  const html = `
    <div style="background-color: #0f0f0f; color: white; padding: 20px; font-family: sans-serif;">
      <h2>Welcome to Zenwair!</h2>
      <p>Welcome! Please verify your email address</p>
      <a href="${link}" style="background-color: #ff6b35; color: white; padding: 10px 20px; text-decoration: none; display: inline-block; font-size: 18px; margin: 20px 0;">Verify Email</a>
      <p>This link expires in 24 hours</p>
      <p style="color: #ccc; font-size: 12px;">Link: ${link}</p>
    </div>
  `;
  await sendEmail({ to: email, subject: 'Verify your Zenwair account', html });
};

const sendPasswordResetEmail = async (email, token) => {
  const link = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2>Password Reset Request</h2>
      <p>You requested a password reset</p>
      <a href="${link}" style="background-color: #ff6b35; color: white; padding: 10px 20px; text-decoration: none; display: inline-block; font-size: 18px; margin: 20px 0;">Reset Password</a>
      <p>Expires in 1 hour</p>
      <p>Ignore this email if you didn't request it</p>
      <p style="color: #888; font-size: 12px;">Link: ${link}</p>
    </div>
  `;
  await sendEmail({ to: email, subject: 'Reset your Zenwair password', html });
};

const sendOrderConfirmationEmail = async (to, { orderId, items, total, paymentMethod }) => {
  const shortId = orderId.toString().slice(0, 8).toUpperCase();

  let itemsHtml = items.map(item => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.title || 'Product'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">₹${item.price}</td>
        </tr>
    `).join('');

  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
      <h2>Your Zenwair order #${shortId} is confirmed! 🎉</h2>
      <p>Thank you for shopping with us! Here are your order details:</p>
      
      <table style="width: 100%; max-width: 600px; border-collapse: collapse; margin-top: 20px;">
        <thead>
            <tr style="background-color: #f8f8f8;">
                <th style="padding: 10px; text-align: left;">Item</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Price</th>
            </tr>
        </thead>
        <tbody>
            ${itemsHtml}
        </tbody>
        <tfoot>
            <tr>
                <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold;">Total:</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">₹${total}</td>
            </tr>
        </tfoot>
      </table>
      
      <p style="margin-top: 20px;"><strong>Payment Method:</strong> ${paymentMethod === 'cod' ? 'Cash on Delivery' : 'Razorpay'}</p>
      <p>We'll notify you when it ships.</p>
    </div>
  `;
  await sendEmail({ to, subject: `Your Zenwair order #<${shortId}> is confirmed! 🎉`, html });
};

const sendShippingDispatchEmail = async (to, { orderId, awbCode, courierName, trackingUrl, estimatedDelivery }) => {
  const shortId = orderId.toString().slice(0, 8).toUpperCase();
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
      <h2>Your Zenwair order #${shortId} has been shipped! 🚚</h2>
      <p>Great news! Your order is on its way via ${courierName}.</p>
      <p><strong>AWB Code:</strong> ${awbCode}</p>
      <p><strong>Estimated Delivery:</strong> ${estimatedDelivery || 'To be updated'}</p>
      <a href="${trackingUrl}" style="background-color: #ff6b35; color: white; padding: 10px 20px; text-decoration: none; display: inline-block; font-size: 16px; margin: 20px 0;">Track Order</a>
    </div>
  `;
  await sendEmail({ to, subject: `Your Zenwair order #${shortId} has been shipped! 🚚`, html });
};

const sendDeliveryConfirmationEmail = async (to, { orderId }) => {
  const shortId = orderId.toString().slice(0, 8).toUpperCase();
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
      <h2>Your Zenwair order #${shortId} has been delivered! 🎉</h2>
      <p>Thank you for shopping with us. We hope you love your new items!</p>
      <p>We'd love to hear your thoughts. Would you like to leave a review?</p>
      <a href="${process.env.FRONTEND_URL}/orders/${orderId}" style="background-color: #ff6b35; color: white; padding: 10px 20px; text-decoration: none; display: inline-block; font-size: 16px; margin: 20px 0;">Leave a Review</a>
    </div>
  `;
  await sendEmail({ to, subject: `Your Zenwair order #${shortId} has been delivered! 🎉`, html });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendShippingDispatchEmail,
  sendDeliveryConfirmationEmail
};
