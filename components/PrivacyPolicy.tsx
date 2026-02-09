import React, { memo } from 'react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div className="w-full space-y-6 pb-8">
      {/* Header */}
      <header className="flex items-center gap-4">
        <button
          onClick={onBack}
          aria-label="Go back"
          className="p-2 -ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-2xl font-black text-white">PRIVACY POLICY</h2>
          <p className="text-gray-400 text-sm">Last updated: February 2026</p>
        </div>
      </header>

      {/* Content */}
      <div className="prose prose-invert prose-sm max-w-none space-y-6">
        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">1. Introduction</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            SLOE FIT AI ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our fitness application.
          </p>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">2. Information We Collect</h3>
          <p className="text-gray-300 text-sm leading-relaxed">We collect information that you provide directly to us:</p>
          <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
            <li><strong>Account Information:</strong> Email address, name, password</li>
            <li><strong>Profile Data:</strong> Age, weight, height, gender, fitness goals, activity level</li>
            <li><strong>Fitness Data:</strong> Workouts, exercise history, training preferences</li>
            <li><strong>Nutrition Data:</strong> Meals logged, calorie and macro tracking</li>
            <li><strong>Photos:</strong> Progress photos, meal photos for AI analysis</li>
            <li><strong>Measurements:</strong> Body measurements over time</li>
          </ul>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">3. How We Use Your Information</h3>
          <p className="text-gray-300 text-sm leading-relaxed">We use your information to:</p>
          <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
            <li>Provide personalized workout and nutrition recommendations</li>
            <li>Analyze photos and provide AI-powered fitness insights</li>
            <li>Track your progress over time</li>
            <li>Improve our services and develop new features</li>
            <li>Send you service-related notifications (if enabled)</li>
          </ul>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">4. AI Processing</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            We use third-party AI services (including OpenAI) to analyze your photos and provide fitness recommendations. When you use AI features:
          </p>
          <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
            <li>Your photos are sent to AI providers for analysis</li>
            <li>AI providers may temporarily process but do not permanently store your images</li>
            <li>Analysis results are stored in your account</li>
          </ul>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">5. Data Sharing</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            We do not sell your personal information. We may share your data with:
          </p>
          <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
            <li><strong>AI Providers:</strong> For photo and meal analysis (as described above)</li>
            <li><strong>Your Trainer:</strong> If you connect with a trainer, they can view your workouts, meals, and progress</li>
            <li><strong>Service Providers:</strong> Cloud hosting (Supabase), necessary for app operation</li>
            <li><strong>Legal Requirements:</strong> If required by law or to protect our rights</li>
          </ul>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">6. Data Security</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            We implement appropriate security measures including:
          </p>
          <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
            <li>Encryption of data in transit (HTTPS/TLS)</li>
            <li>Secure authentication via Supabase Auth</li>
            <li>Row-level security policies on database</li>
            <li>Regular security reviews</li>
          </ul>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">7. Your Rights (GDPR)</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Under GDPR and similar regulations, you have the right to:
          </p>
          <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
            <li><strong>Access:</strong> Request a copy of your data (Settings → Download My Data)</li>
            <li><strong>Rectification:</strong> Update inaccurate data via your profile settings</li>
            <li><strong>Erasure:</strong> Delete your account and all data (Settings → Delete Account)</li>
            <li><strong>Portability:</strong> Export your data in machine-readable format</li>
            <li><strong>Objection:</strong> Contact us to object to certain processing</li>
          </ul>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">8. Data Retention</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            We retain your data for as long as your account is active. When you delete your account:
          </p>
          <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
            <li>All personal data is permanently deleted</li>
            <li>Photos are removed from storage</li>
            <li>Deletion is immediate and cannot be undone</li>
          </ul>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">9. Children's Privacy</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Our service is not intended for users under 16 years of age. We do not knowingly collect data from children.
          </p>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">10. Contact Us</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            For privacy-related questions or to exercise your rights, contact us at:
          </p>
          <p className="text-[var(--color-primary)] font-medium">support@sloefit.com</p>
        </section>
      </div>
    </div>
  );
};

export default memo(PrivacyPolicy);
