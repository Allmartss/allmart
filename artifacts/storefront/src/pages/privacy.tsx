import { Link } from "wouter";
import { ArrowLeft, Lock } from "lucide-react";

const LAST_UPDATED = "July 1, 2025";
const COMPANY = "AllMart Inc.";
const EMAIL = "support@allmart.com";
const SITE = "allmart.com";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/">
            <button className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          </Link>
          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">Privacy Policy</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="flex items-start gap-4 mb-10">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Lock className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Privacy Policy</h1>
            <p className="text-sm text-zinc-500 mt-1">Last updated: {LAST_UPDATED}</p>
          </div>
        </div>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-10 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">

          <p>
            At {COMPANY}, your privacy matters. This Privacy Policy explains how we collect, use, share,
            and protect your personal information when you use our website, mobile app, or any related
            services (collectively, the <strong>"Services"</strong>). By using our Services, you agree
            to the practices described here.
          </p>

          <Section title="1. Information We Collect">
            <p>We collect the following categories of information:</p>
            <SubSection title="Information you provide">
              <ul>
                <li><strong>Account details:</strong> name, email address, password (hashed), phone number, and delivery address.</li>
                <li><strong>Order information:</strong> items purchased, shipping details, and payment method type (we do not store full card numbers).</li>
                <li><strong>Communications:</strong> messages you send to our support team.</li>
                <li><strong>Profile information:</strong> optional details such as gender and country.</li>
              </ul>
            </SubSection>
            <SubSection title="Information collected automatically">
              <ul>
                <li><strong>Usage data:</strong> pages visited, search queries, click patterns, and time spent on pages.</li>
                <li><strong>Device data:</strong> IP address, browser type, operating system, and device identifiers.</li>
                <li><strong>Cookies and similar technologies:</strong> session cookies used to keep you logged in and analytics cookies to improve our Services.</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use your information to:</p>
            <ul>
              <li>Process and fulfill your orders.</li>
              <li>Send order confirmations, shipping updates, and receipts.</li>
              <li>Provide customer support and respond to inquiries.</li>
              <li>Personalize your shopping experience and show relevant products.</li>
              <li>Power AI-assisted search and product recommendations.</li>
              <li>Detect and prevent fraud, abuse, and security incidents.</li>
              <li>Comply with legal obligations.</li>
              <li>Send promotional emails (you may opt out at any time).</li>
            </ul>
          </Section>

          <Section title="3. Cookies">
            <p>
              We use cookies to maintain your session (essential), remember your preferences, and
              analyze traffic (analytics). You can control cookies through your browser settings.
              Disabling essential cookies may affect your ability to log in or complete purchases.
            </p>
            <p>
              We do not use third-party advertising cookies or sell your data to ad networks.
            </p>
          </Section>

          <Section title="4. How We Share Your Information">
            <p>
              We do not sell your personal information. We may share it with:
            </p>
            <ul>
              <li><strong>Service providers:</strong> payment processors, shipping carriers, email delivery services, and cloud infrastructure providers — only to the extent necessary to provide our Services.</li>
              <li><strong>Legal authorities:</strong> when required by law, subpoena, or to protect our rights or the safety of others.</li>
              <li><strong>Business transfers:</strong> in the event of a merger, acquisition, or sale of assets, your data may be transferred to the successor entity.</li>
            </ul>
            <p>All third parties are contractually required to protect your data and use it only for the specified purpose.</p>
          </Section>

          <Section title="5. Data Retention">
            <p>
              We retain your personal information for as long as your account is active or as needed to
              provide Services, comply with legal obligations, resolve disputes, and enforce agreements.
              Order records are kept for a minimum of 7 years for tax and accounting purposes.
            </p>
            <p>
              You may request deletion of your account and associated data at any time (see Section 8).
              Certain information may be retained in anonymized form for analytics.
            </p>
          </Section>

          <Section title="6. Data Security">
            <p>
              We implement industry-standard security measures including:
            </p>
            <ul>
              <li>TLS/SSL encryption for all data transmitted between your browser and our servers.</li>
              <li>Passwords stored as salted bcrypt hashes — we never store plaintext passwords.</li>
              <li>Access controls limiting employee access to personal data on a need-to-know basis.</li>
              <li>Regular security reviews and vulnerability assessments.</li>
            </ul>
            <p>
              No method of transmission over the internet is 100% secure. While we strive to protect
              your information, we cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="7. Children's Privacy">
            <p>
              Our Services are not directed to children under the age of 13. We do not knowingly collect
              personal information from children. If you believe a child has provided us with personal
              information, please contact us and we will delete it promptly.
            </p>
          </Section>

          <Section title="8. Your Rights">
            <p>Depending on your location, you may have the right to:</p>
            <ul>
              <li><strong>Access</strong> the personal information we hold about you.</li>
              <li><strong>Correct</strong> inaccurate or incomplete information.</li>
              <li><strong>Delete</strong> your account and personal data.</li>
              <li><strong>Opt out</strong> of marketing communications at any time via the unsubscribe link in any email.</li>
              <li><strong>Data portability</strong> — receive a copy of your data in a machine-readable format.</li>
              <li><strong>Restrict or object</strong> to certain processing activities.</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a>.
              We will respond within 30 days.
            </p>
          </Section>

          <Section title="9. California Privacy Rights (CCPA)">
            <p>
              If you are a California resident, you have additional rights under the California Consumer
              Privacy Act (CCPA), including the right to know what personal information we collect and
              how it is used, the right to deletion, and the right to non-discrimination for exercising
              your privacy rights. We do not sell personal information as defined by the CCPA.
            </p>
          </Section>

          <Section title="10. International Transfers">
            <p>
              Your information may be processed and stored in the United States or other countries where
              our service providers operate. By using our Services, you consent to the transfer of your
              information to countries that may have different data protection laws than your country of
              residence.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              We may update this Privacy Policy periodically. When we make material changes, we will
              notify you by email or by posting a prominent notice on our website and updating the
              "Last updated" date above. Your continued use of the Services after any changes constitutes
              acceptance of the updated policy.
            </p>
          </Section>

          <Section title="12. Contact Us">
            <p>
              If you have questions, concerns, or requests related to your privacy, please reach out:
            </p>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-5 space-y-1 text-sm">
              <p className="font-semibold text-zinc-900 dark:text-white">{COMPANY} — Privacy Team</p>
              <p>Email: <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a></p>
              <p>Website: <a href={`https://${SITE}`} className="text-primary underline">{SITE}</a></p>
            </div>
          </Section>
        </div>

        {/* Footer links */}
        <div className="mt-16 pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-6 text-sm text-zinc-500">
          <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
          <Link href="/" className="hover:text-primary transition-colors">Back to AllMart</Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1">{title}</p>
      {children}
    </div>
  );
}
