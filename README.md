# NammaStay
Namma Stay Repo with both front end and backend code. Circle Company (LLC)
# Namma Stay 🏨

**Namma Stay** is a comprehensive property and guest management platform designed for modern hostels, boutique stays, and co-living spaces. It streamlines guest onboarding, bed/room allocations, automated billing, and operational workflows into a unified system.

<Image src="image_agent_tag_4346795138134283781" alt="Namma Stay application dashboard interface overview" caption="Namma Stay operational dashboard overview" />

---

## 📌 Project Architecture & Versioning

The application is structured as a decoupled monorepo (or dual repository setup) enforcing **Semantic Versioning (SemVer)** `MAJOR.MINOR.PATCH` across frontend and backend services.

| Service | Version | Stack | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **Frontend** | `v2.4.0` | React / TypeScript / Vite | Guest self-check-in portal, staff management dashboard, real-time bed visualizer |
| **Backend API** | `v1.8.2` | Node.js / Express / PostgreSQL | Authentication (JWT), payment gateway integration, database ORM, guest auditing |

### Versioning Strategy
- **MAJOR (`1.0.0`)**: Incompatible API changes or UI overhauls breaking existing client requests.
- **MINOR (`1.0.0`)**: Backward-compatible feature additions (e.g., adding a new payment vendor integration).
- **PATCH (`1.0.0`)**: Backward-compatible bug fixes and security hotfixes.

---

## 🛠️ Required Resources & Dependencies

### Runtime & System Prerequisites
* **Node.js**: `v18.x.x` or `v20.x.x` (LTS recommended)
* **Package Manager**: `npm` (v9+) or `pnpm` (v8+)
* **Database**: PostgreSQL `v15+`
* **In-Memory Cache**: Redis `v7.0+` (Session management and rate limiting)

### Key External Services & APIs
* **Payment Gateway**: Razorpay / Stripe API SDK
* **SMS & WhatsApp Messaging**: Twilio / Gupshup (for guest check-in receipts and OTPs)
* **Cloud Storage**: AWS S3 or Google Cloud Storage (for ID verification documents)

---

## 📂 Repository Structure

```text
namma-stay/
├── frontend/                 # React UI application (v2.4.0)
│   ├── public/
│   ├── src/
│   │   ├── components/       # Reusable UI primitives
│   │   ├── features/         # Domain-specific modules (Bookings, Beds, Billing)
│   │   ├── hooks/            # Custom React hooks
│   │   └── services/         # API integrations
│   ├── package.json
│   └── vite.config.ts
├── backend/                  # RESTful API Service (v1.8.2)
│   ├── src/
│   │   ├── controllers/      # Request handlers
│   │   ├── middleware/       # Auth, rate limiting, and validation
│   │   ├── models/           # Prisma / Sequelize ORM Schemas
│   │   ├── routes/           # Endpoint definitions
│   │   └── utils/            # Shared utilities
│   ├── prisma/               # Migrations and database seeders
│   └── package.json
└── README.md
