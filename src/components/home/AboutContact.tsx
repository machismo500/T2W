"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Heart,
  Target,
  Users,
  Send,
  Mail,
  MapPin,
  Instagram,
  Youtube,
  CheckCircle,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api-client";

interface CrewMember {
  id: string;
  name: string;
  role: string;
  linkedRiderId?: string;
  avatarUrl?: string | null;
}

const DEFAULT_ABOUT = {
  story:
    "Tales on 2 Wheels is a premium motorcycle riding community built for those who believe the road is more than just a path between two places—it is where stories are born. Bringing together passionate riders from all walks of life, we curate thoughtfully designed motorcycle journeys that blend adventure, exploration, and camaraderie. From the lush rainforests of the Western Ghats and pristine coastal highways to the towering landscapes of the Himalayas and beyond, every Tales on 2 Wheels ride is crafted to deliver an experience that is as enriching as it is exhilarating.",
  mission:
    "To create a safe, inclusive, and thrilling motorcycle riding community. We believe every ride is a story waiting to be told, every road a chapter waiting to be written. We promote responsible riding, camaraderie, and the pure joy of two wheels.",
  community:
    "From weekend warriors to seasoned tourers, T2W welcomes riders of all experience levels. For many riders, the dream of exploring new destinations on a motorcycle is often held back by the uncertainty of riding alone or venturing into unfamiliar territories. Tales on 2 Wheels exists to change that. With experienced ride leaders, carefully planned routes, and a strong community spirit, we create a safe and welcoming environment where riders can step beyond their comfort zones and discover the true freedom of motorcycling. Whether it’s a first long-distance ride or an epic expedition across borders, we ensure that every rider rides with confidence—turning every journey into a story worth telling.",
};

// Role labels for display in The Crew section
const ROLE_LABELS: Record<string, string> = {
  superadmin: "Core Member",
  core_member: "Core Member",
};

export function AboutContact() {
  const { isSuperAdmin } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  // Editable About content
  const [aboutContent, setAboutContent] = useState(DEFAULT_ABOUT);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(DEFAULT_ABOUT);

  // Dynamic crew members
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);

  useEffect(() => {
    // Load saved About content
    api.aboutContent.get().then((res) => {
      const data = res as unknown as { content: Record<string, string> | null };
      if (data.content) {
        setAboutContent({
          story: data.content.story || DEFAULT_ABOUT.story,
          mission: data.content.mission || DEFAULT_ABOUT.mission,
          community: data.content.community || DEFAULT_ABOUT.community,
        });
        setEditForm({
          story: data.content.story || DEFAULT_ABOUT.story,
          mission: data.content.mission || DEFAULT_ABOUT.mission,
          community: data.content.community || DEFAULT_ABOUT.community,
        });
      }
    });
    // Load crew members dynamically
    api.users.getCrew().then((res) => {
      const data = res as unknown as { crew: CrewMember[] };
      if (data.crew && data.crew.length > 0) {
        setCrewMembers(data.crew);
      }
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const handleSaveAbout = async () => {
    await api.aboutContent.save(editForm);
    setAboutContent(editForm);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditForm(aboutContent);
    setEditing(false);
  };

  const aboutCards = [
    { icon: Heart, title: "Our Story", key: "story" as const },
    { icon: Target, title: "Our Mission", key: "mission" as const },
    { icon: Users, title: "Our Community", key: "community" as const },
  ];

  // Build crew display list - fully dynamic from DB roles
  const crewDisplay = crewMembers.map((m) => {
        // Avatar: prefer DB-backed URL from API, fallback to localStorage
        const localAvatar = m.linkedRiderId ? api.avatars.get(m.linkedRiderId) : null;
        const legacyAvatar = m.linkedRiderId && typeof window !== "undefined"
          ? localStorage.getItem(`t2w_avatar_${m.linkedRiderId}`)
          : null;
        return {
          name: m.name,
          role: ROLE_LABELS[m.role] || m.role,
          initials: m.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2),
          riderId: m.linkedRiderId,
          avatarUrl: m.avatarUrl || localAvatar || legacyAvatar,
        };
      });

  return (
    <section id="about" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* About Section */}
        <div className="mb-24">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3">
              <h2 className="section-title">About T2W</h2>
              {isSuperAdmin && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-lg bg-t2w-surface-light p-2 text-t2w-muted transition-colors hover:bg-t2w-accent/20 hover:text-t2w-accent"
                  title="Edit About T2W"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mx-auto mt-4 max-w-2xl section-subtitle">
              Born from a shared passion for motorcycles and the open road
            </p>
          </div>

          {editing && isSuperAdmin ? (
            <div className="mt-16">
              <div className="grid gap-8 md:grid-cols-3">
                {aboutCards.map(({ icon: Icon, title, key }) => (
                  <div key={key} className="card group text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-t2w-accent/10">
                      <Icon className="h-7 w-7 text-t2w-accent" />
                    </div>
                    <h3 className="font-display text-xl font-bold text-white">{title}</h3>
                    <textarea
                      rows={6}
                      className="mt-3 w-full resize-none rounded-xl border border-t2w-border bg-t2w-surface-light p-3 text-sm leading-relaxed text-white focus:border-t2w-accent focus:outline-none"
                      value={editForm[key]}
                      onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-center gap-3">
                <button onClick={handleSaveAbout} className="btn-primary flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Save Changes
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-2 rounded-xl bg-t2w-surface-light px-4 py-2 text-sm font-medium text-t2w-muted transition-colors hover:text-white"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-16 grid gap-8 md:grid-cols-3">
              {aboutCards.map(({ icon: Icon, title, key }) => (
                <div key={key} className="card group text-center">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-t2w-accent/10 transition-colors group-hover:bg-t2w-accent/20">
                    <Icon className="h-7 w-7 text-t2w-accent" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-t2w-muted">
                    {aboutContent[key]}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Team - only shown when core members exist in DB */}
          {crewDisplay.length > 0 && (
          <div className="mt-16 text-center">
            <h3 className="mb-8 font-display text-2xl font-bold text-white">
              The Crew
            </h3>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 max-w-4xl mx-auto">
              {crewDisplay.map((member) => {
                const content = (
                  <>
                    <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-t2w-accent to-red-600 font-display text-xl font-bold text-white transition-transform group-hover:scale-110">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        member.initials
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-white">
                      {member.name}
                    </h4>
                    <p className="text-xs text-t2w-muted">{member.role}</p>
                  </>
                );
                return member.riderId ? (
                  <Link
                    key={member.name}
                    href={`/rider/${member.riderId}`}
                    className="group text-center transition-opacity hover:opacity-90"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={member.name} className="group text-center">
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
          )}
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
