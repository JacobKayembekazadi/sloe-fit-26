import React, { memo } from 'react';

interface TermsOfServiceProps {
  onBack: () => void;
}

const TermsOfService: React.FC<TermsOfServiceProps> = ({ onBack }) => {
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
          <h2 className="text-2xl font-black text-white">TERMS OF SERVICE</h2>
          <p className="text-gray-400 text-sm">Last updated: February 2026</p>
        </div>
      </header>

      {/* Content */}
      <div className="prose prose-invert prose-sm max-w-none space-y-6">
        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">1. Acceptance of Terms</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            By accessing or using SLOE FIT AI ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
          </p>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">2. Description of Service</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            SLOE FIT AI is a fitness application that provides:
          </p>
          <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
            <li>AI-powered workout and nutrition recommendations</li>
            <li>Photo analysis for body composition insights</li>
            <li>Meal tracking and nutritional analysis</li>
            <li>Progress tracking over time</li>
            <li>Optional trainer connectivity features</li>
          </ul>
        </section>

        <section className="card space-y-3 border-yellow-500/30 bg-yellow-500/5">
          <h3 className="text-lg font-bold text-yellow-400">3. Health Disclaimer</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            <strong className="text-yellow-400">IMPORTANT:</strong> SLOE FIT AI provides fitness and nutrition suggestions for informational purposes only. This Service:
          </p>
          <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
            <li>Is NOT a substitute for professional medical advice, diagnosis, or treatment</li>
            <li>Should NOT be used to diagnose or treat any health condition</li>
            <li>Does NOT replace consultation with qualified healthcare providers</li>
          </ul>
          <p className="text-gray-300 text-sm leading-relaxed mt-3">
            Always consult a physician or qualified healthcare provider before starting any diet, exercise program, or making changes to your health regimen. If you experience any pain, discomfort, or adverse effects, stop immediately and seek medical attention.
          </p>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">4. User Accounts</h3>
          <p className="text-gray-300 text-sm leading-relaxed">To use the Service, you must:</p>
          <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
            <li>Be at least 16 years of age</li>
            <li>Provide accurate and complete registration information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Accept responsibility for all activities under your account</li>
          </ul>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">5. Subscription and Payment</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            The Service offers a 7-day free trial. After the trial period:
          </p>
          <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
            <li>Continued access requires an active subscription</li>
            <li>Subscription fees are non-refundable</li>
            <li>We reserve the right to modify pricing with notice</li>
          </ul>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">6. Acceptable Use</h3>
          <p className="text-gray-300 text-sm leading-relaxed">You agree NOT to:</p>
          <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
            <li>Upload inappropriate, offensive, or illegal content</li>
            <li>Attempt to access other users' accounts or data</li>
            <li>Use the Service for any unlawful purpose</li>
            <li>Reverse engineer or attempt to extract source code</li>
            <li>Interfere with the Service's operation or security</li>
            <li>Resell or redistribute the Service without permission</li>
          </ul>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">7. Intellectual Property</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            The Service, including its design, features, and content (excluding user-generated content), is owned by SLOE FIT AI and protected by intellectual property laws. You retain ownership of content you upload but grant us a license to use it for providing the Service.
          </p>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">8. AI-Generated Content</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            The Service uses artificial intelligence to generate recommendations. You acknowledge that:
          </p>
          <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
            <li>AI recommendations may not be perfect or suitable for everyone</li>
            <li>You should use your own judgment when following recommendations</li>
            <li>AI analysis is not a substitute for professional assessment</li>
          </ul>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">9. Limitation of Liability</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW:
          </p>
          <ul className="text-gray-300 text-sm space-y-2 list-disc list-inside">
            <li>The Service is provided "AS IS" without warranties of any kind</li>
            <li>We are not liable for any injuries, health issues, or damages arising from use of the Service</li>
            <li>Our total liability shall not exceed the amount you paid for the Service in the past 12 months</li>
          </ul>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">10. Termination</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            We may suspend or terminate your access to the Service at any time for violation of these terms. You may terminate your account at any time through the Settings page.
          </p>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">11. Changes to Terms</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            We may modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.
          </p>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-bold text-white">12. Contact</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            For questions about these terms, contact us at:
          </p>
          <p className="text-[var(--color-primary)] font-medium">support@sloefit.com</p>
        </section>
      </div>
    </div>
  );
};

export default memo(TermsOfService);
