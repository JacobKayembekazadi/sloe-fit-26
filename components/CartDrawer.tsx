import React from 'react';
import { useShopify } from '../contexts/ShopifyContext';
import TrashIcon from './icons/TrashIcon';

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
    const { checkout, removeLineItem, updateQuantity, getCartURL, lineItemsCount } = useShopify();

    if (!isOpen) return null;

    const handleCheckout = () => {
        const url = getCartURL();
        if (url) {
            window.open(url, '_blank');
        }
    };

    const lineItems = checkout?.lineItems || [];
    const subtotal = checkout?.subtotalPrice || '0.00';

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-[var(--bg-app)] border-l border-white/10 z-50 flex flex-col animate-slide-in-right shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-white/10 bg-[var(--bg-card)]">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black text-white italic tracking-tighter">
                            YOUR CART ({lineItemsCount})
                        </h2>
                        <button
                            onClick={onClose}
                            aria-label="Close cart"
                            className="size-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white text-2xl rounded-full hover:bg-white/10 transition-colors"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {lineItems.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-gray-500 font-medium">Your cart is empty.</p>
                            <button onClick={onClose} className="mt-4 text-[var(--color-primary)] font-bold text-sm uppercase tracking-wide">
                                Continue Shopping
                            </button>
                        </div>
                    ) : (
                        lineItems.map((item: any) => (
                            <div key={item.id} className="card p-3 flex gap-4 items-center">
                                {item.variant.image && (
                                    <img
                                        src={item.variant.image.src}
                                        alt={item.title}
                                        className="w-16 h-16 object-cover rounded-lg bg-gray-800"
                                    />
                                )}
                                <div className="flex-1">
                                    <h3 className="font-bold text-white text-sm mb-1 leading-tight">{item.title}</h3>
                                    <p className="text-xs text-[var(--color-primary)] font-bold mb-2">${item.variant.price}</p>

                                    {/* Quantity Controls */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center bg-black/50 rounded-lg border border-white/10">
                                            <button
                                                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                                aria-label="Decrease quantity"
                                                className="size-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white"
                                            >
                                                −
                                            </button>
                                            <span className="text-white w-6 text-center text-xs font-bold">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                aria-label="Increase quantity"
                                                className="size-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => removeLineItem(item.id)}
                                            aria-label="Remove item"
                                            className="ml-auto size-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-red-500 transition-colors"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {lineItems.length > 0 && (
                    <div className="p-6 border-t border-white/10 bg-[var(--bg-card)]">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-gray-400 font-medium uppercase text-sm tracking-wide">Subtotal</span>
                            <span className="text-2xl font-black text-white">${subtotal}</span>
                        </div>
                        <button
                            onClick={handleCheckout}
                            className="btn-primary w-full shadow-xl"
                        >
                            Checkout Now
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

export default CartDrawer;
