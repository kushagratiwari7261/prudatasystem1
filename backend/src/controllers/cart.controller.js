console.log("Loading cart.controller.js");
const Joi = require('joi');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const cartService = require('../services/cart.service');

// Helper to get cart key based on user or session
const getCartKey = (req) => {
    if (req.user) {
        return { type: 'user', id: req.user.id };
    } else {
        // For guest, use session ID from header or body
        const sessionId = req.headers['x-session-id'] || req.body.sessionId;
        if (!sessionId) {
            throw new AppError('Session ID required for guest cart', 400);
        }
        return { type: 'guest', id: sessionId };
    }
};

const getCart = async (req, res, next) => {
    try {
        let cart;
        if (req.user) {
            cart = await cartService.getCart(req.user.id);
        } else {
            const sessionId = req.headers['x-session-id'] || req.query.sessionId;
            if (!sessionId) {
                return sendSuccess(res, { items: [], coupon: null, ...cartService.calculateTotals({ items: [] }) });
            }
            cart = await cartService.getGuestCart(sessionId);
        }
        
        // RECACULATE COUPON DISCOUNT dynamically when getting the cart
        if (cart.coupon && cart.items.length > 0) {
            const items_total = cart.items.reduce((sum, item) => sum + parseFloat(item.final_price) * parseInt(item.quantity), 0);
            let discount_amount = cart.coupon.type === 'percent' 
                ? (items_total * parseFloat(cart.coupon.value) / 100) 
                : parseFloat(cart.coupon.value);
            
            discount_amount = Math.min(discount_amount, items_total);
            cart.coupon.discount_amount = Math.round(discount_amount * 100) / 100;
        }

        const totals = cartService.calculateTotals(cart);
        sendSuccess(res, { items: cart.items, coupon: cart.coupon, ...totals });
    } catch (err) {
        next(err);
    }
};

const addItem = async (req, res, next) => {
    try {
        const schema = Joi.object({
            variant_id: Joi.string().uuid().required(),
            quantity: Joi.number().integer().min(1).max(10).required(),
            sessionId: Joi.string().optional()  // Added for guest users
        });

        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        // Fetch variant + product + stock
        const { rows } = await db.query(
            `SELECT pv.id, pv.product_id, pv.sku, pv.size, pv.color,
              pv.price_adjustment, pv.images,
              p.title, p.base_price, p.discount_price,
              p.images as product_images,
              COALESCE(i.quantity - i.reserved, 0) as available
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN inventory i ON i.variant_id = pv.id
       WHERE pv.id = $1
         AND pv.is_active = true AND p.is_active = true`,
            [value.variant_id]
        );

        if (rows.length === 0) return next(new AppError('Variant not found', 404));
        const variant = rows[0];

        if (variant.available < value.quantity) {
            return next(new AppError('Not enough stock', 400));
        }

        // Get cart based on user or guest
        let cart;
        if (req.user) {
            cart = await cartService.getCart(req.user.id);
        } else {
            if (!value.sessionId) {
                return next(new AppError('Session ID required for guest cart', 400));
            }
            cart = await cartService.getGuestCart(value.sessionId);
        }

        const final_price = parseFloat(variant.discount_price || variant.base_price) +
            parseFloat(variant.price_adjustment || 0);

        const existingIndex = cart.items.findIndex(i => i.variant_id === value.variant_id);

        if (existingIndex !== -1) {
            const newQty = cart.items[existingIndex].quantity + value.quantity;
            if (newQty > variant.available) {
                return next(new AppError('Exceeds available stock', 400));
            }
            cart.items[existingIndex].quantity = newQty;
        } else {
            cart.items.push({
                variant_id: variant.id,
                product_id: variant.product_id,
                product_title: variant.title,
                sku: variant.sku,
                size: variant.size,
                color: variant.color,
                image: variant.images?.[0] || variant.product_images?.[0] || null,
                base_price: parseFloat(variant.base_price),
                discount_price: parseFloat(variant.discount_price || variant.base_price),
                price_adjustment: parseFloat(variant.price_adjustment || 0),
                final_price,
                quantity: value.quantity
            });
        }

        // Save cart based on user or guest
        if (req.user) {
            await cartService.saveCart(req.user.id, cart);
        } else {
            await cartService.saveGuestCart(value.sessionId, cart);
        }

        const totals = cartService.calculateTotals(cart);
        sendSuccess(res, {
            items: cart.items,
            coupon: cart.coupon,
            ...totals
        }, 'Item added to cart');
    } catch (err) {
        next(err);
    }
};

const updateItem = async (req, res, next) => {
    try {
        const schema = Joi.object({
            variant_id: Joi.string().uuid().required(),
            quantity: Joi.number().integer().min(1).max(10).required(),
            sessionId: Joi.string().optional()
        });

        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        // Get cart based on user or guest
        let cart;
        if (req.user) {
            cart = await cartService.getCart(req.user.id);
        } else {
            if (!value.sessionId) {
                return next(new AppError('Session ID required for guest cart', 400));
            }
            cart = await cartService.getGuestCart(value.sessionId);
        }

        const itemIndex = cart.items.findIndex(i => i.variant_id === value.variant_id);
        if (itemIndex === -1) return next(new AppError('Item not found in cart', 404));

        // Check stock
        const { rows } = await db.query(
            `SELECT COALESCE(i.quantity - i.reserved, 0) as available
       FROM inventory i WHERE i.variant_id = $1`,
            [value.variant_id]
        );
        if (rows.length > 0 && rows[0].available < value.quantity) {
            return next(new AppError('Not enough stock', 400));
        }

        cart.items[itemIndex].quantity = value.quantity;

        // Save cart based on user or guest
        if (req.user) {
            await cartService.saveCart(req.user.id, cart);
        } else {
            await cartService.saveGuestCart(value.sessionId, cart);
        }

        const totals = cartService.calculateTotals(cart);
        sendSuccess(res, {
            items: cart.items,
            coupon: cart.coupon,
            ...totals
        }, 'Cart updated');
    } catch (err) {
        next(err);
    }
};

const removeItem = async (req, res, next) => {
    try {
        const { variantId } = req.params;
        const { sessionId } = req.query;  // For guest users

        // Get cart based on user or guest
        let cart;
        if (req.user) {
            cart = await cartService.getCart(req.user.id);
        } else {
            if (!sessionId) {
                return next(new AppError('Session ID required for guest cart', 400));
            }
            cart = await cartService.getGuestCart(sessionId);
        }

        const originalLength = cart.items.length;
        cart.items = cart.items.filter(i => i.variant_id !== variantId);

        if (cart.items.length === originalLength) {
            return next(new AppError('Item not found in cart', 404));
        }

        // Save cart based on user or guest
        if (req.user) {
            await cartService.saveCart(req.user.id, cart);
        } else {
            await cartService.saveGuestCart(sessionId, cart);
        }

        const totals = cartService.calculateTotals(cart);
        sendSuccess(res, {
            items: cart.items,
            coupon: cart.coupon,
            ...totals
        }, 'Item removed from cart');
    } catch (err) {
        next(err);
    }
};

const applyCoupon = async (req, res, next) => {
    try {
        const schema = Joi.object({
            code: Joi.string().required(),
            sessionId: Joi.string().optional()
        });

        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        // Get cart based on user or guest
        let cart;
        if (req.user) {
            cart = await cartService.getCart(req.user.id);
        } else {
            if (!value.sessionId) {
                return next(new AppError('Session ID required for guest cart', 400));
            }
            cart = await cartService.getGuestCart(value.sessionId);
        }

        if (cart.items.length === 0) {
            return next(new AppError('Cart is empty', 400));
        }

        const { rows } = await db.query(
            `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1) AND is_active = true`,
            [value.code]
        );
        if (rows.length === 0) return next(new AppError('Invalid coupon', 400));
        const coupon = rows[0];

        // Check expiry
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
            return next(new AppError('Coupon expired', 400));
        }
        // Check max uses
        if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
            return next(new AppError('Coupon usage limit reached', 400));
        }

        // Check first purchase only
        if (coupon.is_first_purchase_only) {
            if (!req.user) {
                return next(new AppError('Please log in to use this first-purchase coupon', 401));
            }
            const hasOrders = await db.query(
                `SELECT id FROM orders WHERE user_id = $1 AND status != 'cancelled' LIMIT 1`,
                [req.user.id]
            );
            if (hasOrders.rows.length > 0) {
                return next(new AppError('This coupon is reserved for first-time purchases only', 400));
            }
        }

        // Check specific product constraint
        if (coupon.applicable_product_id) {
            const hasProduct = cart.items.some(i => i.product_id === coupon.applicable_product_id);
            if (!hasProduct) {
                return next(new AppError('This coupon is only valid for specific products not currently in your cart', 400));
            }
        }

        const totals = cartService.calculateTotals(cart);

        // Check min order amount
        if (coupon.min_order_amount && totals.items_total < parseFloat(coupon.min_order_amount)) {
            return next(new AppError(`Minimum order amount is ₹${coupon.min_order_amount}`, 400));
        }

        // Calculate discount
        let discount_amount = 0;
        if (coupon.type === 'flat') {
            discount_amount = parseFloat(coupon.value);
        } else if (coupon.type === 'percent') {
            discount_amount = totals.items_total * parseFloat(coupon.value) / 100;
        } else if (coupon.type === 'free_shipping') {
            discount_amount = 0; // Shipping will be waived
        }
        // Cap discount at items_total
        discount_amount = Math.min(discount_amount, totals.items_total);
        discount_amount = Math.round(discount_amount * 100) / 100;

        cart.coupon = {
            code: coupon.code,
            type: coupon.type,
            value: parseFloat(coupon.value),
            discount_amount
        };

        // Save cart based on user or guest
        if (req.user) {
            await cartService.saveCart(req.user.id, cart);
        } else {
            await cartService.saveGuestCart(value.sessionId, cart);
        }

        const newTotals = cartService.calculateTotals(cart);
        sendSuccess(res, {
            items: cart.items,
            coupon: cart.coupon,
            ...newTotals
        }, 'Coupon applied');
    } catch (err) {
        next(err);
    }
};

const removeCoupon = async (req, res, next) => {
    try {
        const { sessionId } = req.query;

        // Get cart based on user or guest
        let cart;
        if (req.user) {
            cart = await cartService.getCart(req.user.id);
        } else {
            if (!sessionId) {
                return next(new AppError('Session ID required for guest cart', 400));
            }
            cart = await cartService.getGuestCart(sessionId);
        }

        cart.coupon = null;

        // Save cart based on user or guest
        if (req.user) {
            await cartService.saveCart(req.user.id, cart);
        } else {
            await cartService.saveGuestCart(sessionId, cart);
        }

        const totals = cartService.calculateTotals(cart);
        sendSuccess(res, {
            items: cart.items,
            coupon: cart.coupon,
            ...totals
        }, 'Coupon removed');
    } catch (err) {
        next(err);
    }
};

const clearCart = async (req, res, next) => {
    try {
        const { sessionId } = req.query;

        if (req.user) {
            await cartService.clearCart(req.user.id);
        } else {
            if (!sessionId) {
                return next(new AppError('Session ID required for guest cart', 400));
            }
            await cartService.clearGuestCart(sessionId);
        }

        sendSuccess(res, null, 'Cart cleared');
    } catch (err) {
        next(err);
    }
};

const mergeCart = async (req, res, next) => {
    try {
        const schema = Joi.object({
            items: Joi.array().items(Joi.object({
                variant_id: Joi.string().uuid().required(),
                product_id: Joi.string().uuid().required(),
                product_title: Joi.string().required(),
                sku: Joi.string().optional().allow('', null),
                size: Joi.string().optional().allow(''),
                color: Joi.string().optional().allow(''),
                image: Joi.string().optional().allow(null, ''),
                base_price: Joi.number().required(),
                discount_price: Joi.number().required(),
                price_adjustment: Joi.number().default(0),
                final_price: Joi.number().required(),
                quantity: Joi.number().integer().min(1).max(10)
            })).optional().default([]),  // Make items optional
            sessionId: Joi.string().optional()
        });

        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        // This endpoint requires authentication
        if (!req.user) {
            return next(new AppError('Authentication required to merge cart', 401));
        }

        // If no items to merge, just return current cart
        if (!value.items || value.items.length === 0) {
            const cart = await cartService.getCart(req.user.id);
            const totals = cartService.calculateTotals(cart);
            return sendSuccess(res, {
                items: cart.items,
                coupon: cart.coupon,
                ...totals
            }, 'No items to merge');
        }

        const serverCart = await cartService.getCart(req.user.id);

        for (const item of value.items) {
            // Check stock
            const { rows } = await db.query(
                `SELECT COALESCE(quantity - reserved, 0) as available
                 FROM inventory WHERE variant_id = $1`,
                [item.variant_id]
            );
            const available = rows.length > 0 ? parseInt(rows[0].available) : 0;

            const existingIdx = serverCart.items.findIndex(
                i => i.variant_id === item.variant_id
            );

            if (existingIdx !== -1) {
                // Item exists in server cart — merge quantities
                let newQty = serverCart.items[existingIdx].quantity + item.quantity;
                if (newQty > available) newQty = available;
                if (newQty > 0) {
                    serverCart.items[existingIdx].quantity = newQty;
                }
            } else if (available > 0) {
                // New item — cap at available
                let qty = item.quantity;
                if (qty > available) qty = available;
                item.quantity = qty;
                serverCart.items.push(item);
            }
        }

        await cartService.saveCart(req.user.id, serverCart);
        const totals = cartService.calculateTotals(serverCart);
        sendSuccess(res, {
            items: serverCart.items,
            coupon: serverCart.coupon,
            ...totals
        }, 'Cart merged successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getCart,
    addItem,
    updateItem,
    removeItem,
    applyCoupon,
    removeCoupon,
    clearCart,
    mergeCart
};

console.log("Cart controller exports:", Object.keys(module.exports));