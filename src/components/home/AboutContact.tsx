"use client";

import { useState } from "react";
import {
  Heart,
  Target,
  Users,
  Send,
  Mail,
  Phone,
  MapPin,
  Instagram,
  Youtube,
  CheckCircle,
} from "lucide-react";

export function AboutContact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <section id="about" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* About Section */}
        <div className="mb-24">
          <div className="text-center">
            <h2 className="section-title">About T2W</h2>
            <p className="mx-auto mt-4 max-w-2xl section-subtitle">
              Born from a shared passion for motorcycles and the open road
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Heart,
                title: "Our Story",
                description:
                  "Tales on 2 Wheels began in March 2024 in Bangalore when Roshan Manuel and a group of passionate riders decided to formalize their weekend rides. What started as 35 riders on Ride #001 to Sakleshpur has grown into a 140+ member community that has completed 27 rides across India, Nepal, and Thailand.",
              },
              {
                icon: Target,
                title: "Our Mission",
                description:
                  "To create a safe, inclusive, and thrilling motorcycle riding community. We believe every ride is a story waiting to be told, every road a chapter waiting to be written. We promote responsible riding, camaraderie, and the pure joy of two wheels.",
              },
              {
                icon: Users,
                title: "Our Community",
                description:
                  "From weekend warriors to seasoned tourers, T2W welcomes riders of all experience levels. Our rides range from easy day trips to challenging multi-day expeditions. Our veteran riders mentor newcomers, ensuring everyone rides safe and has fun.",
              },
            ].map(({ icon: Icon, title, description }) => (
              <div key={title} className="card group text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-t2w-accent/10 transition-colors group-hover:bg-t2w-accent/20">
                  <Icon className="h-7 w-7 text-t2w-accent" />
                </div>
                <h3 className="font-display text-xl font-bold text-white">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-t2w-muted">
                  {description}
                </p>
              </div>
            ))}
          </div>

          {/* Team */}
          <div className="mt-16 text-center">
            <h3 className="mb-8 font-display text-2xl font-bold text-white">
              The Crew
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {[
                {
                  name: "Roshan Manuel",
                  role: "Founder & Lead Organiser",
                  initials: "RM",
                },
                {
                  name: "Sanjeev Kumar",
                  role: "Co-Founder & Sweep Rider",
                  initials: "SK",
                },
                {
                  name: "Jay Trivedi",
                  role: "Ride Organiser & Pilot",
                  initials: "JT",
                },
                {
                  name: "Shreyas BM",
                  role: "Ride Organiser",
                  initials: "SB",
                },
                {
                  name: "Harish Mysuru",
                  role: "Ride Organiser & Accounts",
                  initials: "HM",
                },
              ].map((member) => (
                <div key={member.name} className="group text-center">
                  <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-t2w-accent to-red-600 font-display text-xl font-bold text-white transition-transform group-hover:scale-110">
                    {member.initials}
                  </div>
                  <h4 className="text-sm font-semibold text-white">
                    {member.name}
                  </h4>
                  <p className="text-xs text-t2w-muted">{member.role}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div id="contact" className="scroll-mt-24">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* Contact Info */}
            <div>
              <h2 className="section-title">Get in Touch</h2>
              <p className="mt-4 text-lg text-t2w-muted">
                Have questions about T2W or want to organize a ride with us?
                We&apos;d love to hear from you.
              </p>

              <div className="mt-10 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-t2w-accent/10">
                    <Mail className="h-5 w-5 text-t2w-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-t2w-muted">Email us</p>
                    <a
                      href="mailto:Info@taleson2wheels.com"
                      className="font-medium text-white hover:text-t2w-accent transition-colors"
                    >
                      Info@taleson2wheels.com
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-t2w-accent/10">
                    <MapPin className="h-5 w-5 text-t2w-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-t2w-muted">Headquarters</p>
                    <p className="font-medium text-white">Bangalore, Karnataka, India</p>
                  </div>
                </div>
              </div>

              {/* Social */}
              <div className="mt-10">
                <p className="mb-4 text-sm font-medium text-t2w-muted">
                  Follow our journey
                </p>
                <div className="flex gap-3">
                  {[
                    { icon: Instagram, label: "Instagram", href: "https://www.instagram.com/Tales.On.2.Wheels" },
                    { icon: Youtube, label: "YouTube", href: "https://www.youtube.com/@TalesOn2Wheels" },
                  ].map(({ icon: Icon, label, href }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border border-t2w-border bg-t2w-surface px-4 py-2.5 text-sm text-t2w-muted transition-all hover:border-t2w-accent/50 hover:text-white"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="card">
              <h3 className="mb-6 font-display text-xl font-bold text-white">
                Send us a Message
              </h3>

              {submitted ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-400/10">
                    <CheckCircle className="h-8 w-8 text-green-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-white">
                    Message Sent!
                  </h4>
                  <p className="mt-2 text-sm text-t2w-muted">
                    We&apos;ll get back to you within 24 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-300">
                        Name
                      </label>
                      <input
                        type="text"
                        required
                        className="input-field"
                        placeholder="Your name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-300">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        className="input-field"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Subject
                    </label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder="What's this about?"
                      value={formData.subject}
                      onChange={(e) =>
                        setFormData({ ...formData, subject: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Message
                    </label>
                    <textarea
                      required
                      rows={4}
                      className="input-field resize-none"
                      placeholder="Tell us more..."
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                    />
                  </div>
                  <button type="submit" className="btn-primary flex w-full items-center justify-center gap-2">
                    <Send className="h-4 w-4" />
                    Send Message
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
