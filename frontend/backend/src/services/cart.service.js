const redis = require('../config/redis');

const CART_TTL = 604800; // 7 days

// Key generators
const getUserCartKey = (userId) => `cart:user:${userId}`;
const getGuestCartKey = (sessionId) => `cart:guest:${sessionId}`;

// User cart functions
const getCart = async (userId) => {
    if (!redis.available || !redis.client) {
        return { items: [], coupon: null };
    }
    const data = await redis.client.get(getUserCartKey(userId));
    if (!data) return { items: [], coupon: null };
    try {
        return JSON.parse(data);
    } catch {
        return { items: [], coupon: null };
    }
};

const saveCart = async (userId, cart) => {
    if (!redis.available || !redis.client) return;
    await redis.client.setex(getUserCartKey(userId), CART_TTL, JSON.stringify(cart));
};

const clearCart = async (userId) => {
    if (!redis.available || !redis.client) return;
    await redis.client.del(getUserCartKey(userId));
};

// Guest cart functions
const getGuestCart = async (sessionId) => {
    if (!redis.available || !redis.client) {
        return { items: [], coupon: null };
    }
    const data = await redis.client.get(getGuestCartKey(sessionId));
    if (!data) return { items: [], coupon: null };
    try {
        return JSON.parse(data);
    } catch {
        return { items: [], coupon: null };
    }
};

const saveGuestCart = async (sessionId, cart) => {
    if (!redis.available || !redis.client) return;
    await redis.client.setex(getGuestCartKey(sessionId), CART_TTL, JSON.stringify(cart));
};

const clearGuestCart = async (sessionId) => {
    if (!redis.available || !redis.client) return;
    await redis.client.del(getGuestCartKey(sessionId));
};

// Merge guest cart into user cart after login
const mergeGuestCart = async (userId, sessionId) => {
    if (!redis.available || !redis.client) return null;

    const guestCart = await getGuestCart(sessionId);
    if (!guestCart.items || guestCart.items.length === 0) {
        return null;
    }

    const userCart = await getCart(userId);

    // Merge items
    for (const guestItem of guestCart.items) {
        const existingItemIndex = userCart.items.findIndex(
            item => item.variant_id === guestItem.variant_id
        );

        if (existingItemIndex !== -1) {
            // Item exists - take higher quantity
            userCart.items[existingItemIndex].quantity = Math.max(
                userCart.items[existingItemIndex].quantity,
                guestItem.quantity
            );
        } else {
            // New item - add it
            userCart.items.push(guestItem);
        }
    }

    // If guest had a coupon, apply it to user cart (if user doesn't have one)
    if (guestCart.coupon && !userCart.coupon) {
        userCart.coupon = guestCart.coupon;
    }

    // Save merged cart
    await saveCart(userId, userCart);

    // Clear guest cart
    await clearGuestCart(sessionId);

    return userCart;
};

const calculateTotals = (cart) => {
    const items_total = cart.items.reduce((sum, item) => {
        return sum + parseFloat(item.final_price) * parseInt(item.quantity);
    }, 0);

    const discount_amount = cart.coupon?.discount_amount || 0;
    const shipping_charge = (items_total - discount_amount) >= 500 ? 0 : 99;
    const final_total = items_total - discount_amount + shipping_charge;
    const item_count = cart.items.reduce((sum, item) => sum + parseInt(item.quantity), 0);

    return {
        items_total: Math.round(items_total * 100) / 100,
        discount_amount: Math.round(discount_amount * 100) / 100,
        shipping_charge: Math.round(shipping_charge * 100) / 100,
        final_total: Math.round(final_total * 100) / 100,
        item_count
    };
};

module.exports = {
    getCart,
    saveCart,
    clearCart,
    getGuestCart,
    saveGuestCart,
    clearGuestCart,
    mergeGuestCart,
    calculateTotals
};