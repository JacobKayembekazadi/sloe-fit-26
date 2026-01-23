import React from 'react';
import CartIcon from './icons/CartIcon';
import { useShopify } from '../contexts/ShopifyContext';

interface HeaderProps {
  onCartClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onCartClick }) => {
  const { lineItemsCount } = useShopify();

  return (
    <header className="flex justify-between items-center py-4">
      <div className="flex flex-col">
        <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">
          SLOE FIT <span className="text-[var(--color-primary)]">AI</span>
        </h1>
      </div>

      <button
        onClick={onCartClick}
        className="relative p-2 text-gray-400 hover:text-white transition-colors bg-white/5 rounded-full"
      >
        <CartIcon className="w-5 h-5" />
        {lineItemsCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[var(--color-primary)] text-black text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
            {lineItemsCount}
          </span>
        )}
      </button>
    </header>
  );
};

export default Header;
