import { Link } from "wouter";
import { ArrowLeft, ShieldCheck } from "lucide-react";

const LAST_UPDATED = "July 1, 2025";
const COMPANY = "AllMart Inc.";
const EMAIL = "help@allmarts.us";
const SITE = "allmarts.us";

export default function Terms() {
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
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">Terms of Service</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="flex items-start gap-4 mb-10">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Terms of Service</h1>
            <p className="text-sm text-zinc-500 mt-1">Last updated: {LAST_UPDATED}</p>
          </div>
        </div>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-10 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">

          <p>
            Welcome to {COMPANY}. By accessing or using our website, mobile application, or any services
            we provide (collectively, the <strong>"Services"</strong>), you agree to be bound by these
            Terms of Service (<strong>"Terms"</strong>). Please read them carefully before making a purchase
            or creating an account.
          </p>

          <Section title="1. Acceptance of Terms">
            <p>
              By creating an account, browsing our site, or placing an order, you confirm that you are at
              least 18 years of age (or the legal age of majority in your jurisdiction), have read and
              understood these Terms, and agree to be bound by them. If you do not agree, please do not
              use our Services.
            </p>
          </Section>

          <Section title="2. Account Registration">
            <p>
              To access certain features, you must register for an account. You agree to provide accurate,
              complete, and current information during registration and to update it as necessary. You are
              responsible for maintaining the confidentiality of your login credentials and for all
              activity that occurs under your account.
            </p>
            <p>
              You must notify us immediately at <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a> if
              you suspect unauthorized use of your account. {COMPANY} is not liable for any loss or
              damage arising from your failure to safeguard your credentials.
            </p>
          </Section>

          <Section title="3. Orders & Payments">
            <p>
              All orders placed through AllMart are subject to acceptance and availability. We reserve the
              right to refuse or cancel any order at our discretion, including orders that appear to be
              placed by resellers or for fraudulent purposes.
            </p>
            <ul>
              <li>Prices are displayed in USD and are subject to change without notice.</li>
              <li>Payment must be completed at the time of purchase.</li>
              <li>We accept major credit/debit cards and other methods listed at checkout.</li>
              <li>All transactions are encrypted and processed securely.</li>
            </ul>
          </Section>

          <Section title="4. Shipping & Delivery">
            <p>
              Estimated delivery times are provided at checkout and are not guaranteed. Delays may occur
              due to carrier issues, customs clearance, or events outside our control. Title and risk of
              loss pass to you upon delivery to the carrier.
            </p>
          </Section>

          <Section title="5. Returns & Refunds">
            <p>
              You may return eligible items within <strong>30 days</strong> of delivery for a full refund,
              provided the items are unused, in their original packaging, and accompanied by proof of purchase.
              Certain categories (digital goods, perishables, personalized items) are non-returnable.
            </p>
            <p>
              Refunds are issued to the original payment method within 5–10 business days of receiving the
              returned item. Shipping costs are non-refundable unless the return is due to our error.
            </p>
          </Section>

          <Section title="6. Bonus Balance & Referral Program">
            <p>
              AllMart may offer bonus credits, referral rewards, or promotional balances at our sole
              discretion. These credits:
            </p>
            <ul>
              <li>Have no cash value and cannot be exchanged for cash.</li>
              <li>May expire or be revoked if your account violates these Terms.</li>
              <li>Cannot be transferred to another account.</li>
              <li>Are applied as a discount at checkout and do not affect taxes or shipping fees.</li>
            </ul>
          </Section>

          <Section title="7. Prohibited Conduct">
            <p>You agree not to:</p>
            <ul>
              <li>Use the Services for any unlawful or fraudulent purpose.</li>
              <li>Attempt to gain unauthorized access to any part of the platform.</li>
              <li>Use automated tools (bots, scrapers) to access or extract content.</li>
              <li>Post false, misleading, or defamatory reviews or content.</li>
              <li>Resell products purchased from AllMart without prior written consent.</li>
              <li>Violate any applicable local, national, or international law or regulation.</li>
            </ul>
          </Section>

          <Section title="8. Intellectual Property">
            <p>
              All content on {SITE} — including logos, text, images, graphics, and software — is the
              property of {COMPANY} or its licensors and is protected by applicable intellectual property
              laws. You may not reproduce, distribute, or create derivative works without our express
              written permission.
            </p>
          </Section>

          <Section title="9. Disclaimers">
            <p>
              THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE
              UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, {COMPANY.toUpperCase()} SHALL NOT BE LIABLE FOR
              ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
              PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY. OUR TOTAL LIABILITY FOR ANY
              CLAIM ARISING FROM THESE TERMS SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE ORDER GIVING
              RISE TO THE CLAIM.
            </p>
          </Section>

          <Section title="11. Governing Law">
            <p>
              These Terms are governed by and construed in accordance with the laws of the State of
              Delaware, United States, without regard to its conflict of law provisions. Any disputes
              arising under these Terms shall be resolved exclusively in the state or federal courts
              located in Delaware.
            </p>
          </Section>

          <Section title="12. Changes to These Terms">
            <p>
              We may update these Terms from time to time. When we do, we will post the revised Terms on
              this page and update the "Last updated" date. Your continued use of the Services after any
              changes constitutes your acceptance of the new Terms.
            </p>
          </Section>

          <Section title="13. Contact Us">
            <p>
              If you have any questions about these Terms, please contact us:
            </p>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-5 space-y-1 text-sm">
              <p className="font-semibold text-zinc-900 dark:text-white">{COMPANY}</p>
              <p>Email: <a href={`mailto:${EMAIL}`} className="text-primary underline">{EMAIL}</a></p>
              <p>Website: <a href={`https://${SITE}`} className="text-primary underline">{SITE}</a></p>
            </div>
          </Section>
        </div>

        {/* Footer links */}
        <div className="mt-16 pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-6 text-sm text-zinc-500">
          <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
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
