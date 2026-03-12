const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET
});

const createRazorpayOrder = async (amount, orderId) => {
    const order = await razorpay.orders.create({
        amount: Math.round(amount * 100), // Convert to paise
        currency: 'INR',
        receipt: orderId.slice(0, 40),
        notes: { order_id: orderId }
    });
    return order;
};

const verifySignature = (razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_SECRET)
        .update(body)
        .digest('hex');
    return expected === razorpay_signature;
};

const fetchPayment = async (razorpay_payment_id) => {
    return await razorpay.payments.fetch(razorpay_payment_id);
};

const initiateRefund = async (razorpay_payment_id, amount) => {
    return await razorpay.payments.refund(razorpay_payment_id, {
        amount: Math.round(amount * 100)
    });
};

module.exports = { createRazorpayOrder, verifySignature, fetchPayment, initiateRefund };
