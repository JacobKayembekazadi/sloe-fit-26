import React from 'react';
import CartIcon from './icons/CartIcon';
import { useShopify } from '../contexts/ShopifyContext';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  onCartClick?: () => void;
  onSettingsClick?: () => void;
  onTrainerClick?: () => void;
  isTrainer?: boolean;
  userName?: string;
}

const Header: React.FC<HeaderProps> = ({ onCartClick, onSettingsClick, onTrainerClick, isTrainer, userName }) => {
  const { lineItemsCount } = useShopify();
  const { user } = useAuth();

  const getInitials = () => {
    if (userName) {
      return userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  return (
    <header className="flex justify-between items-center py-4">
      <div className="flex items-center gap-3">
        {/* Profile Avatar */}
        <button
          onClick={onSettingsClick}
          className="w-10 h-10 bg-gradient-to-br from-[var(--color-primary)] to-purple-600 rounded-full flex items-center justify-center hover:opacity-90 transition-opacity"
          title="Settings"
        >
          <span className="text-sm font-bold text-white">{getInitials()}</span>
        </button>

        <div className="flex flex-col">
          <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">
            SLOE FIT <span className="text-[var(--color-primary)]">AI</span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isTrainer && onTrainerClick && (
          <button
            onClick={onTrainerClick}
            className="p-2 text-gray-400 hover:text-white transition-colors bg-white/5 rounded-full"
            title="Trainer Dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
        )}

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
      </div>
    </header>
  );
};

export default Header;
