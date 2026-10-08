import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, MessageSquare, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { BrandFooter } from '../components/BrandFooter';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'support',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    // In production this connects to email/feedback API or direct mailto
    const mailtoUrl = `mailto:munderushikesh66@gmail.com?subject=[SyncWave ${formData.category.toUpperCase()}] From ${encodeURIComponent(formData.name)}&body=${encodeURIComponent(formData.message)}%0A%0AFrom: ${encodeURIComponent(formData.email)}`;
    window.location.href = mailtoUrl;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#050811] text-neutral-300">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-black/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back to SyncWave
            </Link>
          </div>
          <BrandLogo size="sm" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12">
        <div className="space-y-3 border-b border-neutral-800 pb-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-xs font-mono text-cyan-300">
            <Mail size={14} /> Founder & Engineering Desk
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-['Plus_Jakarta_Sans']">
            Contact & Support
          </h1>
          <p className="text-sm text-neutral-400 max-w-xl">
            Have a question, feedback, partnership inquiry, or found a security vulnerability? Contact our developer team directly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Quick Contact Cards */}
          <div className="space-y-4 md:col-span-1">
            <div className="p-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Mail size={16} className="text-cyan-400" /> Direct Email
              </div>
              <p className="text-xs text-neutral-400 font-light">
                Send an email directly to our founder inbox:
              </p>
              <a
                href="mailto:munderushikesh66@gmail.com"
                className="text-xs text-cyan-400 hover:underline font-mono block break-all pt-1"
              >
                munderushikesh66@gmail.com
              </a>
            </div>

            <div className="p-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Clock size={16} className="text-indigo-400" /> Response Time SLA
              </div>
              <p className="text-xs text-neutral-400 font-light leading-relaxed">
                We typically reply within <strong className="text-white">12 to 24 hours</strong> across all user inquiries.
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-neutral-800 bg-neutral-900/40 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <ShieldCheck size={16} className="text-emerald-400" /> Security & Bug Bounty
              </div>
              <p className="text-xs text-neutral-400 font-light leading-relaxed">
                Found a security vulnerability? Report it responsibly to receive attribution and prompt patch deployment.
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="md:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-8">
            {submitted ? (
              <div className="py-12 text-center space-y-3">
                <CheckCircle2 size={40} className="mx-auto text-emerald-400 animate-bounce" />
                <h3 className="text-lg font-bold text-white">Opening Email Client...</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Your message has been formatted. If your email application did not launch automatically, write directly to <strong className="text-white">munderushikesh66@gmail.com</strong>.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <MessageSquare size={16} className="text-cyan-400" /> Send a Message
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-400 font-medium">Your Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Alex Taylor"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-400 font-medium">Your Email</label>
                    <input
                      type="email"
                      required
                      placeholder="alex@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-neutral-400 font-medium">Inquiry Type</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-neutral-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="support">General Support / Question</option>
                    <option value="feedback">Feature Suggestion / Feedback</option>
                    <option value="partnership">Partnership / Advertising Inquiry</option>
                    <option value="security">Security Vulnerability Report</option>
                    <option value="dmca">DMCA / Copyright Takedown</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-neutral-400 font-medium">Message</label>
                  <textarea
                    rows={5}
                    required
                    placeholder="How can we help you today?"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95"
                >
                  Send Message
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <BrandFooter />
    </div>
  );
}
