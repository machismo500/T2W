# Tales on 2 Wheels (T2W)

**India's motorcycle riding community platform** — organizing, managing, and celebrating group rides across India since March 2024.

Built for the T2W brotherhood of 500+ riders based in Bangalore, Karnataka. From weekend getaways to multi-week expeditions through Ladakh, Nepal, and Thailand.

**Live:** [taleson2wheels.com](https://taleson2wheels.com)

---

## Features

### Rides
- Create and manage group rides (day trips, weekends, multi-day expeditions)
- Ride registration with payment tracking, emergency contacts, and indemnity forms
- Live GPS tracking during active rides with break management
- Ride history with distance, route, and participant data
- Customisable registration forms per ride
- CSV export of registrations

### Rider Profiles
- Individual profiles with ride history, total km, and statistics
- Achievement badges earned by km milestones (Silver → Gold → Platinum → Diamond → Ace → Conqueror)
- Motorcycle garage management
- Profile picture uploads
- Emergency contact and blood group info (visible to co-riders)

### Community
- Blog posts with approval workflow (official and personal)
- Ride-specific photo posts and reports
- Notification system for ride announcements and updates
- Riding guidelines and safety protocols

### Admin Dashboard
- User management with approval workflow and role assignment
- Ride CRUD with poster uploads
- Participation matrix for tracking rider attendance and points
- Activity log with rollback support
- Profile deduplication and merging tools
- Blog and content moderation

### Roles
| Role | Access |
|------|--------|
| **Super Admin** | Full access — user management, role changes, all CRUD |
| **Core Member** | Ride management, content approval, admin dashboard |
| **T2W Rider** | Blog/post creation (pending approval), ride registration |
| **Rider** | View rides, register, view own profile |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript 5.9 |
| Database | PostgreSQL via [Neon](https://neon.tech/) (serverless) |
| ORM | [Prisma 6](https://www.prisma.io/) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) |
| Auth | JWT (jose) + bcryptjs |
| Animations | [Framer Motion](https://www.framer.com/motion/) |
| Email | Nodemailer (SMTP) |
| Icons | [Lucide React](https://lucide.dev/) |
| Hosting | [Vercel](https://vercel.com/) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (recommended: [Neon](https://neon.tech/) free tier)

### Setup

```bash
# Clone the repository
git clone https://github.com/xploroshan/T2W.git
cd T2W

# Install dependencies (auto-runs Prisma generate + DB push + seed)
npm install

# Copy environment template
cp .env.example .env
```

### Environment Variables

Edit `.env` with your values:

```env
# Neon Postgres (pooled connection)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
# Direct connection for migrations
DATABASE_URL_UNPOOLED="postgresql://user:pass@host/db?sslmode=require"

# JWT secret (use a strong random string in production)
JWT_SECRET="your-secret-key"

# SMTP for emails (Gmail example — use an App Password)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="Tales on 2 Wheels"
```

### Database Setup

```bash
# Push schema to database
npm run db:push

# Seed initial data (admins, badges, riders, blogs, guidelines, notifications)
npm run db:seed

# Open Prisma Studio (optional — visual DB browser)
npm run db:studio
```

### Development

```bash
npm run dev
# Runs at http://localhost:3000
```

### Production Build

```bash
npm run build
npm start
```

---

## Project Structure

```
T2W/
├── src/
│   ├── app/
│   │   ├── api/                # 50+ API route handlers
│   │   │   ├── auth/           # Login, register, OTP, password reset
│   │   │   ├── rides/          # Ride CRUD + registration + live tracking
│   │   │   ├── riders/         # Rider profiles, participation, merging
│   │   │   ├── users/          # User management + role changes
│   │   │   ├── blogs/          # Blog CRUD + approval
│   │   │   ├── ride-posts/     # Ride photo posts + approval
│   │   │   ├── notifications/  # Notification CRUD
│   │   │   ├── content/        # Content management
│   │   │   ├── badges/         # Achievement badges
│   │   │   ├── guidelines/     # Riding guidelines
│   │   │   ├── upload/         # Image upload + avatar sync
│   │   │   └── ...
│   │   ├── admin/              # Admin dashboard pages
│   │   ├── ride/[id]/          # Individual ride detail pages
│   │   ├── rider/[id]/         # Rider profile pages
│   │   ├── blog/               # Blog listing and detail
│   │   ├── dashboard/          # User dashboard
│   │   └── ...
│   ├── components/
│   │   ├── admin/              # Admin UI (ParticipationMatrix, etc.)
│   │   ├── home/               # Homepage sections (Hero, About, etc.)
│   │   ├── rides/              # Ride detail, live tracking
│   │   ├── rider/              # Rider profile page
│   │   ├── blogs/              # Blog components
│   │   └── layout/             # Navbar, Footer
│   ├── lib/
│   │   ├── db.ts               # Prisma client singleton
│   │   ├── auth.ts             # JWT helpers + getCurrentUser
│   │   ├── api-client.ts       # Client-side API wrapper
│   │   └── geo-utils.ts        # Geolocation utilities
│   ├── context/
│   │   └── AuthContext.tsx      # Auth state + role-based permissions
│   └── types/                  # TypeScript type definitions
├── prisma/
│   └── schema.prisma           # Database schema (20+ models)
├── scripts/                    # Seed scripts (admins, riders, badges, blogs)
├── public/                     # Static assets
├── vercel.json                 # Vercel redirects + HSTS
└── next.config.ts              # Security headers + CSP
```

---

## Database Models

Key entities in `prisma/schema.prisma`:

- **User** — Authentication accounts with role-based access
- **RiderProfile** — Master rider records with stats, avatar, emergency info
- **Ride** — Group ride events with route, crew, and poster
- **RideRegistration** — Individual registrations with payment and contact details
- **RideParticipation** — Actual participation tracking with points
- **Motorcycle** — User's bike details (make, model, cc, nickname)
- **BlogPost** — Community blog with approval workflow
- **RidePost** — Ride-specific photo posts with moderation
- **LiveRideSession / LiveRideLocation / LiveRideBreak** — Real-time ride tracking
- **Badge / UserBadge** — Achievement system by km milestones
- **Notification** — Push notifications (global + per-user)
- **Content** — Admin-managed content items
- **ActivityLog** — Audit trail with rollback support
- **Guideline** — Riding safety and group guidelines

---

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production (generates Prisma client) |
| `npm start` | Start production server |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:seed` | Run all seed scripts |
| `npm run db:reset` | Reset database and re-seed |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:migrate` | Create and apply migrations |
| `npm run lint` | Run ESLint |

---

## Deployment

The app is deployed on **Vercel** with:

- **Database:** Neon PostgreSQL (serverless, auto-scaling)
- **Domain:** taleson2wheels.com with HTTPS redirect and HSTS
- **Image storage:** Base64 data URLs stored directly in PostgreSQL
- **Email:** Gmail SMTP via Nodemailer
- **Security headers:** HSTS, CSP, X-Frame-Options, XSS protection

### Deploy to Vercel

1. Push to GitHub
2. Import in [Vercel Dashboard](https://vercel.com/new)
3. Add environment variables in Vercel project settings
4. Deploy — `postinstall` script handles Prisma generation, DB push, and seeding

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## License

Private repository. All rights reserved.

---

**Ride safe. Ride together.**
*Tales on 2 Wheels — Brotherhood on two wheels since 2024*
